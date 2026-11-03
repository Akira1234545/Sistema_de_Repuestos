BEGIN;
GRANT INSERT(id) ON public.solicitudes,public.vehiculos TO authenticated;
CREATE OR REPLACE FUNCTION public.catalog_names(p_catalog text,p_ids uuid[])
RETURNS TABLE(id uuid,nombre text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
    IF NOT public.account_is_active() THEN RAISE EXCEPTION 'Cuenta no disponible'; END IF;
    IF p_catalog IS NULL OR p_catalog NOT IN ('categorias_repuesto','tipos_vehiculo','marcas','modelos')
        OR p_ids IS NULL OR cardinality(p_ids)>100 THEN RAISE EXCEPTION 'Catálogo no válido'; END IF;
    RETURN QUERY EXECUTE format('SELECT c.id,c.nombre FROM public.%I c WHERE c.id=ANY($1)',p_catalog) USING p_ids;
END;
$$;
REVOKE ALL ON FUNCTION public.catalog_names(text,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.catalog_names(text,uuid[]) TO authenticated;
CREATE OR REPLACE FUNCTION public.sprint3_admin_list_requests(
    p_status text DEFAULT NULL,
    p_category_id uuid DEFAULT NULL,
    p_date_from date DEFAULT NULL,
    p_date_to date DEFAULT NULL,
    p_search text DEFAULT NULL,
    p_limit integer DEFAULT 25,
    p_offset integer DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    usuario_id uuid,
    cliente_nombre text,
    cliente_correo text,
    vehiculo_id uuid,
    vehiculo_tipo text,
    vehiculo_marca text,
    vehiculo_modelo text,
    vehiculo_anio integer,
    vehiculo_descripcion text,
    categoria_id uuid,
    categoria_nombre text,
    titulo text,
    descripcion text,
    caracteristicas text,
    cantidad integer,
    fotografias text[],
    estado text,
    fecha_creacion timestamptz,
    fecha_actualizacion timestamptz,
    propuesta_seleccionada_id uuid,
    total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_status text := NULLIF(btrim(p_status), '');
    v_search text := NULLIF(btrim(p_search), '');
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Se requiere rol administrador';
    END IF;
    IF v_status IS NOT NULL AND v_status NOT IN (
        'publicada', 'recibiendo_propuestas', 'propuesta_seleccionada', 'atendida', 'cerrada'
    ) THEN
        RAISE EXCEPTION 'Estado de solicitud no válido';
    END IF;
    IF p_date_from IS NOT NULL AND p_date_to IS NOT NULL AND p_date_from > p_date_to THEN
        RAISE EXCEPTION 'La fecha inicial no puede ser posterior a la fecha final';
    END IF;
    IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 OR p_offset IS NULL OR p_offset < 0 THEN
        RAISE EXCEPTION 'Parámetros de paginación no válidos';
    END IF;

    RETURN QUERY
    SELECT
        s.id,
        s.usuario_id,
        concat_ws(' ', u.nombre, u.apellido),
        a.email::text,
        v.id,
        vt.nombre,
        brand.nombre,
        model.nombre,
        v.anio,
        v.descripcion,
        c.id,
        c.nombre,
        s.titulo,
        s.descripcion,
        s.caracteristicas,
        s.cantidad,
        s.fotografias,
        s.estado::text,
        s.fecha_creacion,
        s.fecha_actualizacion,
        s.propuesta_seleccionada_id,
        count(*) OVER ()
    FROM public.solicitudes s
    JOIN public.usuarios u ON u.id = s.usuario_id
    LEFT JOIN auth.users a ON a.id = s.usuario_id
    LEFT JOIN public.vehiculos v ON v.id = s.vehiculo_id
    LEFT JOIN public.tipos_vehiculo vt ON vt.id = v.tipo_vehiculo_id
    LEFT JOIN public.marcas brand ON brand.id = v.marca_id
    LEFT JOIN public.modelos model ON model.id = v.modelo_id
    LEFT JOIN public.categorias_repuesto c ON c.id = s.categoria_id
    WHERE (v_status IS NULL OR s.estado::text = v_status)
      AND (p_category_id IS NULL OR s.categoria_id = p_category_id)
      AND (p_date_from IS NULL OR s.fecha_creacion >= (p_date_from::timestamp AT TIME ZONE 'America/La_Paz'))
      AND (p_date_to IS NULL OR s.fecha_creacion < ((p_date_to + 1)::timestamp AT TIME ZONE 'America/La_Paz'))
      AND (v_search IS NULL OR s.titulo ILIKE '%' || v_search || '%')
    ORDER BY s.fecha_creacion DESC, s.id
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;
CREATE OR REPLACE FUNCTION public.sprint3_admin_list_promotions(
    p_store_id uuid DEFAULT NULL,
    p_category_id uuid DEFAULT NULL,
    p_status public.promotion_status DEFAULT NULL,
    p_date_from date DEFAULT NULL,
    p_date_to date DEFAULT NULL,
    p_search text DEFAULT NULL,
    p_limit integer DEFAULT 25,
    p_offset integer DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    tienda_id uuid,
    tienda_nombre text,
    categoria_id uuid,
    categoria_nombre text,
    titulo text,
    descripcion text,
    marca text,
    precio_anterior numeric,
    precio_oferta numeric,
    porcentaje_descuento numeric,
    caracteristicas text,
    fecha_inicio timestamptz,
    fecha_fin timestamptz,
    fotografias text[],
    estado text,
    fecha_creacion timestamptz,
    fecha_actualizacion timestamptz,
    total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_search text := NULLIF(btrim(p_search), '');
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Se requiere rol administrador';
    END IF;
    IF p_date_from IS NOT NULL AND p_date_to IS NOT NULL AND p_date_from > p_date_to THEN
        RAISE EXCEPTION 'La fecha inicial no puede ser posterior a la fecha final';
    END IF;
    IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 OR p_offset IS NULL OR p_offset < 0 THEN
        RAISE EXCEPTION 'Parámetros de paginación no válidos';
    END IF;

    RETURN QUERY
    SELECT
        p.id,
        p.tienda_id,
        t.nombre::text,
        p.categoria_id,
        c.nombre::text,
        p.titulo,
        p.descripcion,
        p.marca,
        p.precio_anterior,
        p.precio_oferta,
        p.porcentaje_descuento,
        p.caracteristicas,
        p.fecha_inicio,
        p.fecha_fin,
        p.fotografias,
        p.estado::text,
        p.fecha_creacion,
        p.fecha_actualizacion,
        count(*) OVER ()
    FROM public.promociones p
    JOIN public.tiendas t ON t.id = p.tienda_id
    JOIN public.categorias_repuesto c ON c.id = p.categoria_id
    WHERE (p_store_id IS NULL OR p.tienda_id = p_store_id)
      AND (p_category_id IS NULL OR p.categoria_id = p_category_id)
      AND (p_status IS NULL OR p.estado = p_status)
      AND (p_date_from IS NULL OR p.fecha_inicio >= (p_date_from::timestamp AT TIME ZONE 'America/La_Paz'))
      AND (p_date_to IS NULL OR p.fecha_inicio < ((p_date_to + 1)::timestamp AT TIME ZONE 'America/La_Paz'))
      AND (v_search IS NULL OR p.titulo ILIKE '%' || v_search || '%')
    ORDER BY p.fecha_creacion DESC, p.id
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;
CREATE OR REPLACE FUNCTION public.sprint3_admin_save_category(
    p_category_id uuid,
    p_name text,
    p_description text,
    p_parent_id uuid,
    p_active boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_name text := NULLIF(btrim(p_name), '');
    v_description text := NULLIF(btrim(p_description), '');
    v_id uuid;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Se requiere rol administrador';
    END IF;
    IF v_name IS NULL OR length(v_name) > 100 THEN
        RAISE EXCEPTION 'El nombre es obligatorio y no puede superar 100 caracteres';
    END IF;
    IF v_description IS NOT NULL AND length(v_description) > 5000 THEN
        RAISE EXCEPTION 'La descripción no puede superar 5000 caracteres';
    END IF;
    IF p_active IS NULL THEN
        RAISE EXCEPTION 'Indica si la categoría estará activa';
    END IF;
    IF p_category_id IS NOT NULL AND p_parent_id = p_category_id THEN
        RAISE EXCEPTION 'Una categoría no puede ser su propia categoría padre';
    END IF;

    -- Serialize category hierarchy edits to prevent concurrent parent updates
    -- from creating a cycle.
    PERFORM pg_catalog.pg_advisory_xact_lock(20261024::bigint);
    IF EXISTS(SELECT 1 FROM public.categorias_repuesto c WHERE lower(btrim(c.nombre))=lower(v_name)
        AND c.categoria_padre_id IS NOT DISTINCT FROM p_parent_id AND c.id IS DISTINCT FROM p_category_id) THEN
        RAISE EXCEPTION 'Ya existe una categoria con ese nombre en este nivel';
    END IF;

    IF p_category_id IS NOT NULL THEN
        PERFORM 1 FROM public.categorias_repuesto c
        WHERE c.id = p_category_id
        FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'No se encontró la categoría que intentas editar';
        END IF;
    END IF;

    IF p_parent_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.categorias_repuesto c
            WHERE c.id = p_parent_id
              AND (c.activo = TRUE OR NOT p_active)
        ) THEN
            RAISE EXCEPTION 'La categoría padre no existe o está inactiva';
        END IF;

        IF p_category_id IS NOT NULL AND EXISTS (
            WITH RECURSIVE ancestors(category_id, parent_id) AS (
                SELECT c.id, c.categoria_padre_id
                FROM public.categorias_repuesto c
                WHERE c.id = p_parent_id
                UNION
                SELECT parent.id, parent.categoria_padre_id
                FROM ancestors a
                JOIN public.categorias_repuesto parent ON parent.id = a.parent_id
            )
            SELECT 1 FROM ancestors WHERE category_id = p_category_id
        ) THEN
            RAISE EXCEPTION 'La categoría padre elegida generaría un ciclo en la jerarquía';
        END IF;
    END IF;

    IF NOT p_active AND EXISTS (
        SELECT 1 FROM public.categorias_repuesto child
        WHERE child.categoria_padre_id = p_category_id
          AND child.activo = TRUE
    ) THEN
        RAISE EXCEPTION 'Desactiva primero las subcategorías activas';
    END IF;

    IF p_category_id IS NULL THEN
        INSERT INTO public.categorias_repuesto
            (nombre, descripcion, categoria_padre_id, activo)
        VALUES (v_name, v_description, p_parent_id, p_active)
        RETURNING id INTO v_id;
    ELSE
        UPDATE public.categorias_repuesto
        SET nombre = v_name,
            descripcion = v_description,
            categoria_padre_id = p_parent_id,
            activo = p_active
        WHERE id = p_category_id
        RETURNING id INTO v_id;
    END IF;

    RETURN v_id;
END;
$$;
COMMIT;

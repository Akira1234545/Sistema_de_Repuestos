-- Read-only administrative promotion supervision.
-- Apply after 20261024_admin_categorias_solicitudes.sql.
BEGIN;

DO $$
BEGIN
    IF to_regprocedure('public.is_admin()') IS NULL THEN
        RAISE EXCEPTION 'Migración detenida: falta public.is_admin(); aplica primero las migraciones administrativas previas';
    END IF;
    IF to_regclass('public.promociones') IS NULL
       OR to_regclass('public.tiendas') IS NULL
       OR to_regclass('public.categorias_repuesto') IS NULL
       OR to_regtype('public.promotion_status') IS NULL THEN
        RAISE EXCEPTION 'Migración detenida: faltan tablas o el tipo promotion_status del esquema base';
    END IF;
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
      AND (p_date_from IS NULL OR p.fecha_inicio >= p_date_from::timestamptz)
      AND (p_date_to IS NULL OR p.fecha_inicio < (p_date_to + 1)::timestamptz)
      AND (v_search IS NULL OR p.titulo ILIKE '%' || v_search || '%')
    ORDER BY p.fecha_creacion DESC, p.id
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;
REVOKE ALL ON FUNCTION public.sprint3_admin_list_promotions(uuid, uuid, public.promotion_status, date, date, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sprint3_admin_list_promotions(uuid, uuid, public.promotion_status, date, date, text, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.sprint3_admin_list_promotion_stores()
RETURNS TABLE (
    id uuid,
    nombre text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Se requiere rol administrador';
    END IF;

    RETURN QUERY
    SELECT DISTINCT t.id, t.nombre::text
    FROM public.tiendas t
    JOIN public.promociones p ON p.tienda_id = t.id
    ORDER BY t.nombre, t.id;
END;
$$;
REVOKE ALL ON FUNCTION public.sprint3_admin_list_promotion_stores() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sprint3_admin_list_promotion_stores() TO authenticated;

COMMIT;

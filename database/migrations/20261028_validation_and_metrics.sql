BEGIN;
-- NOT VALID preserves legacy rows; all new/changed rows must satisfy constraints.
DO $$
DECLARE item record;
BEGIN
    FOR item IN SELECT * FROM (VALUES
        ('solicitudes','request_text_valid', 'length(btrim(titulo)) BETWEEN 1 AND 160 AND length(btrim(descripcion)) BETWEEN 1 AND 5000 AND coalesce(length(caracteristicas),0)<=5000'),
        ('tiendas','store_text_valid', 'length(btrim(nombre)) BETWEEN 1 AND 160 AND coalesce(length(descripcion),0)<=5000 AND coalesce(length(telefono),0)<=40 AND coalesce(length(direccion),0)<=500'),
        ('tiendas','store_coordinates_valid', '(latitud IS NULL)=(longitud IS NULL) AND (latitud IS NULL OR (latitud BETWEEN -90 AND 90 AND longitud BETWEEN -180 AND 180))'),
        ('propuestas','proposal_price_finite', 'precio::text NOT IN (''NaN'',''Infinity'',''-Infinity'')'),
        ('resenas','review_comment_length', 'coalesce(length(comentario),0)<=2000'),
        ('promociones','promotion_price_finite', 'precio_anterior::text NOT IN (''NaN'',''Infinity'',''-Infinity'') AND precio_oferta::text NOT IN (''NaN'',''Infinity'',''-Infinity'')'),
        ('promociones','promotion_text_valid', 'length(btrim(titulo)) BETWEEN 1 AND 160 AND coalesce(length(descripcion),0)<=5000 AND coalesce(length(caracteristicas),0)<=5000 AND coalesce(length(marca),0)<=100')
    ) AS checks(tab,con,expression) LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=('public.'||item.tab)::regclass AND conname=item.con) THEN
            EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%s) NOT VALID',item.tab,item.con,item.expression);
        END IF;
    END LOOP;
END;
$$;
CREATE OR REPLACE FUNCTION public.sprint3_admin_category_metrics(p_date_from date,p_date_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; start_at timestamptz; end_at timestamptz;
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Se requiere rol administrador'; END IF;
    IF p_date_from IS NULL OR p_date_to IS NULL OR p_date_from>p_date_to OR p_date_to-p_date_from>3660 THEN
        RAISE EXCEPTION 'Selecciona un periodo válido de hasta diez años';
    END IF;
    start_at:=p_date_from::timestamp AT TIME ZONE 'America/La_Paz';
    end_at:=(p_date_to+1)::timestamp AT TIME ZONE 'America/La_Paz';
    SELECT jsonb_build_object('categorias',jsonb_build_object(
        'total',count(*)::text,'activas',count(*) FILTER(WHERE c.activo)::text,
        'inactivas',count(*) FILTER(WHERE NOT c.activo)::text,
        'principales',count(*) FILTER(WHERE c.categoria_padre_id IS NULL)::text,
        'subcategorias',count(*) FILTER(WHERE c.categoria_padre_id IS NOT NULL)::text,
        'creadas_periodo',count(*) FILTER(WHERE c.fecha_creacion>=start_at AND c.fecha_creacion<end_at)::text,
        'solicitudes_por_categoria',coalesce((SELECT jsonb_agg(row_data ORDER BY name,id) FROM (
            SELECT cat.nombre AS name,cat.id,jsonb_build_object('id',cat.id,'nombre',cat.nombre,'activa',cat.activo,
                'solicitudes',count(s.id)::text) AS row_data
            FROM public.categorias_repuesto cat LEFT JOIN public.solicitudes s ON s.categoria_id=cat.id
                AND s.fecha_creacion>=start_at AND s.fecha_creacion<end_at
            GROUP BY cat.id,cat.nombre,cat.activo) grouped),'[]'::jsonb))) INTO result
    FROM public.categorias_repuesto c;
    RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.sprint3_admin_category_metrics(date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sprint3_admin_category_metrics(date,date) TO authenticated;

-- SQL-derived totals avoid downloading every review and work identically for all roles.
CREATE OR REPLACE VIEW public.resenas_resumen WITH(security_barrier=true,security_invoker=false) AS
SELECT t.id AS tienda_id,count(r.id)::bigint AS total,avg(r.calificacion)::numeric(3,2) AS promedio
FROM public.sprint2_tiendas_publicas t LEFT JOIN public.resenas r ON r.tienda_id=t.id GROUP BY t.id;
REVOKE ALL ON public.resenas_resumen FROM PUBLIC;
GRANT SELECT ON public.resenas_resumen TO anon,authenticated;
COMMIT;

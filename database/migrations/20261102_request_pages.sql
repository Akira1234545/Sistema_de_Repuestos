BEGIN;
CREATE OR REPLACE FUNCTION public.request_page(p_available boolean DEFAULT false,p_search text DEFAULT NULL,
    p_state text DEFAULT NULL,p_category uuid DEFAULT NULL,p_from date DEFAULT NULL,p_to date DEFAULT NULL,
    p_offset integer DEFAULT 0,p_limit integer DEFAULT 26)
RETURNS SETOF public.solicitudes LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
    IF NOT public.account_is_active() OR (p_available AND public.sprint1_role() IS DISTINCT FROM 'tienda')
        OR (NOT p_available AND public.sprint1_role() IS DISTINCT FROM 'cliente') THEN RAISE EXCEPTION 'Cuenta no disponible'; END IF;
    IF p_available IS NULL OR p_offset IS NULL OR p_offset<0 OR p_limit IS NULL OR p_limit<1 OR p_limit>26
        OR length(p_search)>160 OR (p_from IS NOT NULL AND p_to IS NOT NULL AND p_from>p_to) THEN
        RAISE EXCEPTION 'Filtros no válidos';
    END IF;
    RETURN QUERY SELECT s.* FROM public.solicitudes s
    JOIN public.vehiculos v ON v.id=s.vehiculo_id
    LEFT JOIN public.marcas ma ON ma.id=v.marca_id
    LEFT JOIN public.modelos mo ON mo.id=v.modelo_id
    LEFT JOIN public.categorias_repuesto c ON c.id=s.categoria_id
    WHERE (CASE WHEN p_available THEN public.sprint2_store_can_view_request(s.id) ELSE s.usuario_id=auth.uid() END)
        AND (p_state IS NULL OR s.estado::text=p_state) AND (p_category IS NULL OR s.categoria_id=p_category)
        AND (p_from IS NULL OR s.fecha_creacion>=(p_from::timestamp AT TIME ZONE 'America/La_Paz'))
        AND (p_to IS NULL OR s.fecha_creacion<((p_to+1)::timestamp AT TIME ZONE 'America/La_Paz'))
        AND (nullif(btrim(p_search),'') IS NULL OR concat_ws(' ',s.titulo,s.descripcion,c.nombre,ma.nombre,mo.nombre,v.anio::text) ILIKE '%'||p_search||'%')
    ORDER BY s.fecha_creacion DESC,s.id LIMIT p_limit OFFSET p_offset;
END;
$$;
REVOKE ALL ON FUNCTION public.request_page(boolean,text,text,uuid,date,date,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_page(boolean,text,text,uuid,date,date,integer,integer) TO authenticated;
COMMIT;

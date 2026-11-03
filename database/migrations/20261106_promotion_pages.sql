BEGIN;
GRANT INSERT(id) ON public.promociones TO authenticated;
CREATE OR REPLACE FUNCTION public.promotion_page(p_owner boolean DEFAULT false,p_search text DEFAULT NULL,
    p_offset integer DEFAULT 0,p_limit integer DEFAULT 26)
RETURNS SETOF public.promociones LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
    IF NOT public.account_is_active() OR (p_owner AND public.sprint1_role() IS DISTINCT FROM 'tienda') THEN RAISE EXCEPTION 'Cuenta no disponible'; END IF;
    IF p_owner IS NULL OR p_offset IS NULL OR p_offset<0 OR p_limit IS NULL OR p_limit<1 OR p_limit>26 OR length(p_search)>160 THEN RAISE EXCEPTION 'Filtros no válidos'; END IF;
    RETURN QUERY SELECT p.* FROM public.promociones p LEFT JOIN public.categorias_repuesto c ON c.id=p.categoria_id
    WHERE CASE WHEN p_owner THEN p.tienda_id=public.get_my_store_id()
        ELSE p.estado='activa' AND p.fecha_inicio<=now() AND p.fecha_fin>now() AND public.store_is_eligible(p.tienda_id) END
        AND (nullif(btrim(p_search),'') IS NULL OR concat_ws(' ',p.titulo,p.descripcion,p.marca,c.nombre) ILIKE '%'||p_search||'%')
    ORDER BY p.fecha_creacion DESC,p.id LIMIT p_limit OFFSET p_offset;
END;
$$;
REVOKE ALL ON FUNCTION public.promotion_page(boolean,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.promotion_page(boolean,text,integer,integer) TO authenticated;
COMMIT;

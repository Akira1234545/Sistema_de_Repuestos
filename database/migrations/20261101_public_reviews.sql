BEGIN;
CREATE OR REPLACE FUNCTION public.public_store_reviews(p_store_ids uuid[])
RETURNS TABLE(tienda_id uuid,total text,promedio numeric,resenas jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
    IF p_store_ids IS NULL OR cardinality(p_store_ids)>25 THEN RAISE EXCEPTION 'Página de tiendas no válida'; END IF;
    RETURN QUERY SELECT summary.tienda_id,summary.total::text,summary.promedio,
        coalesce((SELECT jsonb_agg(to_jsonb(recent) ORDER BY recent.fecha_creacion DESC,recent.id) FROM (
            SELECT r.id,r.tienda_id,r.calificacion,r.comentario,r.fecha_creacion
            FROM public.resenas_publicas r WHERE r.tienda_id=summary.tienda_id
            ORDER BY r.fecha_creacion DESC,r.id LIMIT 3) recent),'[]'::jsonb)
    FROM public.resenas_resumen summary WHERE summary.tienda_id=ANY(p_store_ids);
END;
$$;
REVOKE ALL ON FUNCTION public.public_store_reviews(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_store_reviews(uuid[]) TO anon,authenticated;
COMMIT;

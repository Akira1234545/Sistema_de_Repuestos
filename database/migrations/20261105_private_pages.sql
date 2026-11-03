BEGIN;
CREATE OR REPLACE FUNCTION public.admin_user_page(p_search text DEFAULT NULL,p_offset integer DEFAULT 0,p_limit integer DEFAULT 26)
RETURNS TABLE(id uuid,nombre text,apellido text,telefono text,correo text,rol text,activo boolean,fecha_creacion timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Se requiere rol administrador'; END IF;
    IF p_offset IS NULL OR p_offset<0 OR p_limit IS NULL OR p_limit<1 OR p_limit>26 OR length(p_search)>160 THEN RAISE EXCEPTION 'Filtros no válidos'; END IF;
    RETURN QUERY SELECT u.id,u.nombre,u.apellido,u.telefono,a.email::text,u.rol::text,u.activo,u.fecha_creacion
    FROM public.usuarios u JOIN auth.users a ON a.id=u.id
    WHERE nullif(btrim(p_search),'') IS NULL OR concat_ws(' ',u.nombre,u.apellido,u.telefono,a.email,u.rol::text,u.id::text) ILIKE '%'||p_search||'%'
    ORDER BY u.fecha_creacion DESC,u.id LIMIT p_limit OFFSET p_offset;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_user_page(text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_user_page(text,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_review_page(p_offset integer DEFAULT 0,p_limit integer DEFAULT 25)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE shop_id uuid; shop_name text; result jsonb;
BEGIN
    IF public.sprint1_role() IS DISTINCT FROM 'tienda' THEN RAISE EXCEPTION 'Se requiere una cuenta tienda activa'; END IF;
    IF p_offset IS NULL OR p_offset<0 OR p_limit IS NULL OR p_limit<1 OR p_limit>25 THEN RAISE EXCEPTION 'Página no válida'; END IF;
    SELECT id,nombre INTO shop_id,shop_name FROM public.tiendas WHERE usuario_id=auth.uid();
    IF NOT FOUND THEN RETURN jsonb_build_object('store',NULL,'reviews','[]'::jsonb,'total','0','average',NULL,'hasMore',false); END IF;
    SELECT jsonb_build_object('store',jsonb_build_object('id',shop_id,'nombre',shop_name),
        'total',count(*)::text,'average',avg(r.calificacion),'hasMore',count(*)>p_offset+p_limit,
        'reviews',coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY page.fecha_creacion DESC,page.id) FROM (
            SELECT review.id,review.tienda_id,review.calificacion,review.comentario,review.fecha_creacion,
                u.nombre AS nombre_cliente,u.apellido AS apellido_cliente
            FROM public.resenas review JOIN public.usuarios u ON u.id=review.usuario_id
            WHERE review.tienda_id=shop_id ORDER BY review.fecha_creacion DESC,review.id LIMIT p_limit OFFSET p_offset) page),'[]'::jsonb))
    INTO result FROM public.resenas r WHERE r.tienda_id=shop_id;
    RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.my_review_page(integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_review_page(integer,integer) TO authenticated;
COMMIT;

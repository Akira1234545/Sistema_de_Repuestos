-- Live notifications and per-account dashboard metrics. Safe to run more than once.

-- 1. Push new notifications over Supabase Realtime. Realtime applies the table's RLS,
--    so each account only receives rows its SELECT policies already allow.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notificaciones') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;
  END IF;
END $$;

-- 2. Client dashboard: counts for the signed-in customer only.
CREATE OR REPLACE FUNCTION public.client_dashboard_stats()
RETURNS TABLE(vehiculos bigint, solicitudes_abiertas bigint, propuestas_por_revisar bigint, solicitudes_atendidas bigint, favoritos bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL OR public.sprint1_role() IS DISTINCT FROM 'cliente' THEN
    RAISE EXCEPTION 'Cuenta no disponible' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT
    (SELECT count(*) FROM public.vehiculos v WHERE v.usuario_id = v_user),
    (SELECT count(*) FROM public.solicitudes s WHERE s.usuario_id = v_user AND s.estado::text IN ('publicada', 'recibiendo_propuestas')),
    (SELECT count(*) FROM public.propuestas p JOIN public.solicitudes s ON s.id = p.solicitud_id
      WHERE s.usuario_id = v_user AND s.estado::text IN ('publicada', 'recibiendo_propuestas') AND p.estado::text = 'enviada'),
    (SELECT count(*) FROM public.solicitudes s WHERE s.usuario_id = v_user AND s.estado::text = 'atendida'),
    (SELECT (SELECT count(*) FROM public.favoritos_tienda f WHERE f.usuario_id = v_user)
          + (SELECT count(*) FROM public.favoritos_solicitud f WHERE f.usuario_id = v_user)
          + (SELECT count(*) FROM public.favoritos_promocion f WHERE f.usuario_id = v_user));
END $$;

-- 3. Store dashboard: counts for the signed-in store owner only.
CREATE OR REPLACE FUNCTION public.store_dashboard_stats()
RETURNS TABLE(solicitudes_nuevas bigint, propuestas_enviadas bigint, propuestas_seleccionadas bigint, promociones_activas bigint, resenas bigint, calificacion numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_store uuid := public.get_my_store_id();
BEGIN
  IF (SELECT auth.uid()) IS NULL OR public.sprint1_role() IS DISTINCT FROM 'tienda' THEN
    RAISE EXCEPTION 'Cuenta no disponible' USING ERRCODE = '42501';
  END IF;
  IF v_store IS NULL THEN
    RETURN QUERY SELECT 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, NULL::numeric;
    RETURN;
  END IF;
  RETURN QUERY SELECT
    -- Open requests in this store's categories that it has not answered yet.
    (SELECT count(*) FROM public.solicitudes s
      WHERE s.estado::text IN ('publicada', 'recibiendo_propuestas')
        AND public.store_is_eligible(v_store)
        AND EXISTS (SELECT 1 FROM public.tienda_categorias tc WHERE tc.tienda_id = v_store AND tc.categoria_id = s.categoria_id)
        AND NOT EXISTS (SELECT 1 FROM public.propuestas p WHERE p.solicitud_id = s.id AND p.tienda_id = v_store)),
    (SELECT count(*) FROM public.propuestas p WHERE p.tienda_id = v_store AND p.estado::text = 'enviada'),
    (SELECT count(*) FROM public.propuestas p WHERE p.tienda_id = v_store AND p.estado::text = 'aceptada'),
    (SELECT count(*) FROM public.promociones pr WHERE pr.tienda_id = v_store AND pr.estado::text = 'activa' AND now() >= pr.fecha_inicio AND now() < pr.fecha_fin),
    (SELECT count(*) FROM public.resenas r WHERE r.tienda_id = v_store),
    (SELECT round(avg(r.calificacion)::numeric, 1) FROM public.resenas r WHERE r.tienda_id = v_store);
END $$;

REVOKE EXECUTE ON FUNCTION public.client_dashboard_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.store_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_dashboard_stats() TO authenticated;

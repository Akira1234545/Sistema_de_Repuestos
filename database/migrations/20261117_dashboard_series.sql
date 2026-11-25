-- Sesión 7, parte B: series diarias para los minigráficos de los paneles.
-- dashboard_series(p_dias) devuelve, por serie y por día (hora de Bolivia), los conteos de los
-- últimos 2 × p_dias días: el periodo actual y el anterior, para calcular la variación en %.
-- Solo lectura, sin datos inventados: los días sin eventos salen con 0. Se puede ejecutar más de una vez.

-- Índices por fecha para que las series no recorran las tablas completas.
CREATE INDEX IF NOT EXISTS solicitudes_fecha_creacion_idx ON public.solicitudes (fecha_creacion);
CREATE INDEX IF NOT EXISTS propuestas_fecha_creacion_idx ON public.propuestas (fecha_creacion);
CREATE INDEX IF NOT EXISTS propuestas_tienda_fecha_idx ON public.propuestas (tienda_id, fecha_creacion);
CREATE INDEX IF NOT EXISTS historial_solicitudes_estado_fecha_idx ON public.historial_solicitudes (estado_nuevo, fecha);

DROP FUNCTION IF EXISTS public.dashboard_series(integer);
CREATE OR REPLACE FUNCTION public.dashboard_series(p_dias integer)
RETURNS TABLE(serie text, dia date, total bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
    v_user uuid := (SELECT auth.uid());
    v_role text := public.sprint1_role();
    v_admin boolean := false;
    v_store uuid;
    v_eligible boolean := false;
    v_today date := (now() AT TIME ZONE 'America/La_Paz')::date;
    v_from date;
    v_since timestamptz;
    v_names text[];
BEGIN
    IF v_user IS NULL OR NOT public.account_is_active() THEN
        RAISE EXCEPTION 'Cuenta no disponible' USING ERRCODE = '42501';
    END IF;
    IF p_dias IS NULL OR p_dias NOT IN (7, 30) THEN
        RAISE EXCEPTION 'El periodo debe ser de 7 o 30 días.' USING ERRCODE = '22023';
    END IF;

    v_from := v_today - (2 * p_dias - 1);
    v_since := v_from::timestamp AT TIME ZONE 'America/La_Paz';

    IF v_role = 'cliente' THEN
        v_names := ARRAY['propuestas_recibidas', 'solicitudes_creadas', 'solicitudes_atendidas'];
    ELSIF v_role = 'tienda' THEN
        v_store := public.get_my_store_id();
        v_eligible := v_store IS NOT NULL AND public.store_is_eligible(v_store);
        v_names := ARRAY['solicitudes_publicadas', 'propuestas_enviadas', 'propuestas_seleccionadas'];
    ELSIF public.is_admin() THEN
        v_admin := true;
        v_names := ARRAY['usuarios_nuevos', 'tiendas_nuevas', 'solicitudes_creadas', 'propuestas_enviadas'];
    ELSE
        RAISE EXCEPTION 'Cuenta no disponible' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    WITH days AS (
        SELECT d::date AS dia FROM generate_series(v_from, v_today, interval '1 day') AS d
    ),
    events AS (
        -- Cliente: propuestas que llegaron a sus solicitudes, solicitudes publicadas y atendidas.
        SELECT 'propuestas_recibidas'::text AS serie, p.fecha_creacion AS fecha
        FROM public.propuestas p JOIN public.solicitudes s ON s.id = p.solicitud_id
        WHERE v_role = 'cliente' AND s.usuario_id = v_user AND p.fecha_creacion >= v_since
        UNION ALL
        SELECT 'solicitudes_creadas', s.fecha_creacion FROM public.solicitudes s
        WHERE ((v_role = 'cliente' AND s.usuario_id = v_user) OR v_admin) AND s.fecha_creacion >= v_since
        UNION ALL
        SELECT 'solicitudes_atendidas', h.fecha
        FROM public.historial_solicitudes h JOIN public.solicitudes s ON s.id = h.solicitud_id
        WHERE v_role = 'cliente' AND s.usuario_id = v_user AND h.estado_nuevo = 'atendida' AND h.fecha >= v_since
        UNION ALL
        -- Tienda: solicitudes publicadas en sus categorías (si está habilitada), sus propuestas
        -- enviadas y las seleccionadas (fecha en que el cliente eligió, según el historial).
        SELECT 'solicitudes_publicadas', s.fecha_creacion FROM public.solicitudes s
        WHERE v_eligible AND s.fecha_creacion >= v_since
          AND EXISTS (SELECT 1 FROM public.tienda_categorias tc WHERE tc.tienda_id = v_store AND tc.categoria_id = s.categoria_id)
        UNION ALL
        SELECT 'propuestas_enviadas', p.fecha_creacion FROM public.propuestas p
        WHERE ((v_store IS NOT NULL AND p.tienda_id = v_store) OR v_admin) AND p.fecha_creacion >= v_since
        UNION ALL
        SELECT 'propuestas_seleccionadas', chosen.fecha
        FROM public.propuestas p
        CROSS JOIN LATERAL (
            SELECT max(h.fecha) AS fecha FROM public.historial_solicitudes h
            WHERE h.solicitud_id = p.solicitud_id AND h.estado_nuevo = 'propuesta_seleccionada'
        ) chosen
        WHERE v_store IS NOT NULL AND p.tienda_id = v_store AND p.estado = 'aceptada' AND chosen.fecha >= v_since
        UNION ALL
        -- Admin: altas de cuentas y de tiendas.
        SELECT 'usuarios_nuevos', u.fecha_creacion FROM public.usuarios u WHERE v_admin AND u.fecha_creacion >= v_since
        UNION ALL
        SELECT 'tiendas_nuevas', t.fecha_creacion FROM public.tiendas t WHERE v_admin AND t.fecha_creacion >= v_since
    ),
    per_day AS (
        SELECT e.serie, (e.fecha AT TIME ZONE 'America/La_Paz')::date AS dia, count(*) AS total
        FROM events e GROUP BY 1, 2
    )
    SELECT n.serie, d.dia, coalesce(pd.total, 0)::bigint
    FROM unnest(v_names) AS n(serie)
    CROSS JOIN days d
    LEFT JOIN per_day pd ON pd.serie = n.serie AND pd.dia = d.dia
    ORDER BY n.serie, d.dia;
END $$;

REVOKE EXECUTE ON FUNCTION public.dashboard_series(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_series(integer) TO authenticated;

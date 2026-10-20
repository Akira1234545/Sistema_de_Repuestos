-- Aggregate-only administrative activity reports.
-- Apply after 20261025_admin_promociones.sql.
BEGIN;

DO $$
BEGIN
    IF to_regprocedure('public.is_admin()') IS NULL THEN
        RAISE EXCEPTION 'Migración detenida: falta public.is_admin(); aplica primero las migraciones administrativas previas';
    END IF;
    IF to_regclass('public.usuarios') IS NULL
       OR to_regclass('public.tiendas') IS NULL
       OR to_regclass('public.solicitudes') IS NULL
       OR to_regclass('public.propuestas') IS NULL
       OR to_regclass('public.promociones') IS NULL
       OR to_regtype('public.user_role') IS NULL
       OR to_regtype('public.store_status') IS NULL
       OR to_regtype('public.request_status') IS NULL
       OR to_regtype('public.proposal_status') IS NULL
       OR to_regtype('public.promotion_status') IS NULL THEN
        RAISE EXCEPTION 'Migración detenida: faltan tablas o tipos requeridos en el esquema base';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sprint3_admin_activity_report(
    p_date_from date,
    p_date_to date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_time_zone constant text := 'America/La_Paz';
    v_period_start timestamptz;
    v_period_end timestamptz;
    v_granularity text;
    v_step interval;
    v_report jsonb;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Se requiere rol administrador';
    END IF;
    IF p_date_from IS NULL OR p_date_to IS NULL THEN
        RAISE EXCEPTION 'Indica la fecha inicial y la fecha final';
    END IF;
    IF p_date_from > p_date_to THEN
        RAISE EXCEPTION 'La fecha inicial no puede ser posterior a la fecha final';
    END IF;

    v_period_start := p_date_from::timestamp AT TIME ZONE v_time_zone;
    v_period_end := (p_date_to + 1)::timestamp AT TIME ZONE v_time_zone;
    v_granularity := CASE
        WHEN p_date_to - p_date_from <= 89 THEN 'day'
        WHEN p_date_to - p_date_from <= 364 THEN 'week'
        ELSE 'month'
    END;
    v_step := CASE v_granularity
        WHEN 'day' THEN interval '1 day'
        WHEN 'week' THEN interval '1 week'
        ELSE interval '1 month'
    END;

    WITH
    usuarios_metricas AS (
        SELECT
            count(*)::text AS total,
            count(*) FILTER (WHERE fecha_creacion >= v_period_start AND fecha_creacion < v_period_end)::text AS periodo
        FROM public.usuarios
    ),
    tiendas_metricas AS (
        SELECT
            count(*)::text AS total,
            count(*) FILTER (WHERE activa AND estado = 'aprobada'::public.store_status)::text AS activas,
            count(*) FILTER (WHERE fecha_creacion >= v_period_start AND fecha_creacion < v_period_end)::text AS periodo
        FROM public.tiendas
    ),
    solicitudes_metricas AS (
        SELECT
            count(*)::text AS total,
            count(*) FILTER (WHERE fecha_creacion >= v_period_start AND fecha_creacion < v_period_end)::text AS periodo,
            count(*) FILTER (WHERE estado = 'publicada'::public.request_status)::text AS publicada,
            count(*) FILTER (WHERE estado = 'recibiendo_propuestas'::public.request_status)::text AS recibiendo_propuestas,
            count(*) FILTER (WHERE estado = 'propuesta_seleccionada'::public.request_status)::text AS propuesta_seleccionada,
            count(*) FILTER (WHERE estado = 'atendida'::public.request_status)::text AS atendida,
            count(*) FILTER (WHERE estado = 'cerrada'::public.request_status)::text AS cerrada
        FROM public.solicitudes
    ),
    propuestas_metricas AS (
        SELECT
            count(*)::text AS total,
            count(*) FILTER (WHERE fecha_creacion >= v_period_start AND fecha_creacion < v_period_end)::text AS periodo,
            count(*) FILTER (WHERE estado = 'enviada'::public.proposal_status)::text AS enviada,
            count(*) FILTER (WHERE estado = 'aceptada'::public.proposal_status)::text AS aceptada,
            count(*) FILTER (WHERE estado = 'rechazada'::public.proposal_status)::text AS rechazada,
            count(*) FILTER (WHERE estado = 'retirada'::public.proposal_status)::text AS retirada
        FROM public.propuestas
    ),
    promociones_metricas AS (
        SELECT
            count(*)::text AS total,
            count(*) FILTER (WHERE fecha_creacion >= v_period_start AND fecha_creacion < v_period_end)::text AS periodo,
            count(*) FILTER (WHERE estado = 'activa'::public.promotion_status)::text AS activa,
            count(*) FILTER (WHERE estado = 'pausada'::public.promotion_status)::text AS pausada,
            count(*) FILTER (WHERE estado = 'finalizada'::public.promotion_status)::text AS finalizada
        FROM public.promociones
    ),
    roles_metricas AS (
        SELECT
            count(*) FILTER (WHERE rol = 'superAdministrador'::public.user_role)::text AS super_administrador,
            count(*) FILTER (WHERE rol = 'administrador'::public.user_role)::text AS administrador,
            count(*) FILTER (WHERE rol = 'cliente'::public.user_role)::text AS cliente,
            count(*) FILTER (WHERE rol = 'tienda'::public.user_role)::text AS tienda
        FROM public.usuarios
    ),
    estados_tienda_metricas AS (
        SELECT
            count(*) FILTER (WHERE estado = 'pendiente'::public.store_status)::text AS pendiente,
            count(*) FILTER (WHERE estado = 'aprobada'::public.store_status)::text AS aprobada,
            count(*) FILTER (WHERE estado = 'rechazada'::public.store_status)::text AS rechazada,
            count(*) FILTER (WHERE estado = 'suspendida'::public.store_status)::text AS suspendida
        FROM public.tiendas
    ),
    fechas AS (
        SELECT generate_series(
            date_trunc(v_granularity, p_date_from::timestamp),
            date_trunc(v_granularity, p_date_to::timestamp),
            v_step
        ) AS bucket
    ),
    eventos AS (
        SELECT date_trunc(v_granularity, u.fecha_creacion AT TIME ZONE v_time_zone) AS bucket,
               'usuarios'::text AS entidad
        FROM public.usuarios u
        WHERE u.fecha_creacion >= v_period_start AND u.fecha_creacion < v_period_end
        UNION ALL
        SELECT date_trunc(v_granularity, t.fecha_creacion AT TIME ZONE v_time_zone),
               'tiendas'::text
        FROM public.tiendas t
        WHERE t.fecha_creacion >= v_period_start AND t.fecha_creacion < v_period_end
        UNION ALL
        SELECT date_trunc(v_granularity, s.fecha_creacion AT TIME ZONE v_time_zone),
               'solicitudes'::text
        FROM public.solicitudes s
        WHERE s.fecha_creacion >= v_period_start AND s.fecha_creacion < v_period_end
        UNION ALL
        SELECT date_trunc(v_granularity, p.fecha_creacion AT TIME ZONE v_time_zone),
               'propuestas'::text
        FROM public.propuestas p
        WHERE p.fecha_creacion >= v_period_start AND p.fecha_creacion < v_period_end
        UNION ALL
        SELECT date_trunc(v_granularity, p.fecha_creacion AT TIME ZONE v_time_zone),
               'promociones'::text
        FROM public.promociones p
        WHERE p.fecha_creacion >= v_period_start AND p.fecha_creacion < v_period_end
    ),
    eventos_agrupados AS (
        SELECT bucket,
               count(*) FILTER (WHERE entidad = 'usuarios')::text AS usuarios,
               count(*) FILTER (WHERE entidad = 'tiendas')::text AS tiendas,
               count(*) FILTER (WHERE entidad = 'solicitudes')::text AS solicitudes,
               count(*) FILTER (WHERE entidad = 'propuestas')::text AS propuestas,
               count(*) FILTER (WHERE entidad = 'promociones')::text AS promociones
        FROM eventos
        GROUP BY bucket
    ),
    serie AS (
        SELECT f.bucket,
               coalesce(e.usuarios, '0') AS usuarios,
               coalesce(e.tiendas, '0') AS tiendas,
               coalesce(e.solicitudes, '0') AS solicitudes,
               coalesce(e.propuestas, '0') AS propuestas,
               coalesce(e.promociones, '0') AS promociones
        FROM fechas f
        LEFT JOIN eventos_agrupados e ON e.bucket = f.bucket
    )
    SELECT jsonb_build_object(
        'generado_en', clock_timestamp(),
        'periodo', jsonb_build_object(
            'desde', p_date_from,
            'hasta', p_date_to,
            'zona_horaria', v_time_zone,
            'agrupacion', CASE v_granularity
                WHEN 'day' THEN 'día'
                WHEN 'week' THEN 'semana'
                ELSE 'mes'
            END
        ),
        'totales', jsonb_build_object(
            'usuarios', um.total,
            'tiendas', tm.total,
            'tiendas_activas', tm.activas,
            'solicitudes', sm.total,
            'propuestas', pm.total,
            'promociones', prom.total
        ),
        'creados_periodo', jsonb_build_object(
            'usuarios', um.periodo,
            'tiendas', tm.periodo,
            'solicitudes', sm.periodo,
            'propuestas', pm.periodo,
            'promociones', prom.periodo
        ),
        'distribucion', jsonb_build_object(
            'roles', jsonb_build_object(
                'superAdministrador', rm.super_administrador,
                'administrador', rm.administrador,
                'cliente', rm.cliente,
                'tienda', rm.tienda
            ),
            'tiendas', jsonb_build_object(
                'pendiente', stm.pendiente,
                'aprobada', stm.aprobada,
                'rechazada', stm.rechazada,
                'suspendida', stm.suspendida
            ),
            'solicitudes', jsonb_build_object(
                'publicada', sm.publicada,
                'recibiendo_propuestas', sm.recibiendo_propuestas,
                'propuesta_seleccionada', sm.propuesta_seleccionada,
                'atendida', sm.atendida,
                'cerrada', sm.cerrada
            ),
            'propuestas', jsonb_build_object(
                'enviada', pm.enviada,
                'aceptada', pm.aceptada,
                'rechazada', pm.rechazada,
                'retirada', pm.retirada
            ),
            'promociones', jsonb_build_object(
                'activa', prom.activa,
                'pausada', prom.pausada,
                'finalizada', prom.finalizada
            )
        ),
        'serie_temporal', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'periodo', to_char(s.bucket, 'YYYY-MM-DD'),
                'usuarios', s.usuarios,
                'tiendas', s.tiendas,
                'solicitudes', s.solicitudes,
                'propuestas', s.propuestas,
                'promociones', s.promociones
            ) ORDER BY s.bucket)
            FROM serie s
        ), '[]'::jsonb)
    )
    INTO v_report
    FROM usuarios_metricas um
    CROSS JOIN tiendas_metricas tm
    CROSS JOIN solicitudes_metricas sm
    CROSS JOIN propuestas_metricas pm
    CROSS JOIN promociones_metricas prom
    CROSS JOIN roles_metricas rm
    CROSS JOIN estados_tienda_metricas stm;

    RETURN v_report;
END;
$$;

REVOKE ALL ON FUNCTION public.sprint3_admin_activity_report(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sprint3_admin_activity_report(date, date) TO authenticated;

COMMIT;

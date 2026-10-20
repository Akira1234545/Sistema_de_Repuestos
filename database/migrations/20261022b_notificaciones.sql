-- Secure in-app notifications for proposals, request updates and matching requests.
-- Apply after 20261022a_notificaciones_tipo.sql and the existing feature migrations.

BEGIN;

-- Avoid silently accepting or removing unknown notification policies. RLS
-- policies are permissive by default and combine with OR.
DO $$
DECLARE
    unexpected_policies text;
BEGIN
    SELECT string_agg(policyname, ', ')
      INTO unexpected_policies
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notificaciones'
      AND policyname NOT IN (
    'notificaciones_select_owner',
    'notificaciones_update_owner',
    'notificaciones_select_propias',
    'notificaciones_update_propias'
);

    IF unexpected_policies IS NOT NULL THEN
        RAISE EXCEPTION 'Migración de notificaciones detenida: revisa las políticas existentes en public.notificaciones: %', unexpected_policies;
    END IF;
END;
$$;

ALTER TABLE public.notificaciones
    ADD COLUMN IF NOT EXISTS evento_clave text;

CREATE UNIQUE INDEX IF NOT EXISTS notificaciones_usuario_evento_unique
    ON public.notificaciones (usuario_id, evento_clave)
    WHERE evento_clave IS NOT NULL;

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.notificaciones FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.notificaciones TO authenticated;
GRANT UPDATE (leida) ON TABLE public.notificaciones TO authenticated;

DROP POLICY IF EXISTS notificaciones_select_propias
    ON public.notificaciones;

DROP POLICY IF EXISTS notificaciones_update_propias
    ON public.notificaciones;

DROP POLICY IF EXISTS notificaciones_select_owner ON public.notificaciones;
CREATE POLICY notificaciones_select_owner
    ON public.notificaciones
    FOR SELECT TO authenticated
    USING (usuario_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS notificaciones_update_owner ON public.notificaciones;
CREATE POLICY notificaciones_update_owner
    ON public.notificaciones
    FOR UPDATE TO authenticated
    USING (usuario_id = (SELECT auth.uid()) AND leida = FALSE)
    WITH CHECK (usuario_id = (SELECT auth.uid()) AND leida = TRUE);

CREATE OR REPLACE FUNCTION public.sprint3_notify_new_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.notificaciones
        (usuario_id, tipo, titulo, mensaje, solicitud_id, evento_clave)
    SELECT
        t.usuario_id,
        'nueva_solicitud'::public.notification_type,
        'Nueva solicitud disponible',
        format('Se publicó una solicitud de repuestos: %s', NEW.titulo),
        NEW.id,
        'solicitud:nueva:' || NEW.id::text
    FROM public.tiendas t
    JOIN public.usuarios u ON u.id = t.usuario_id
    JOIN public.tienda_categorias tc ON tc.tienda_id = t.id
    JOIN public.categorias_repuesto c ON c.id = tc.categoria_id
    WHERE tc.categoria_id = NEW.categoria_id
      AND c.activo = TRUE
      AND t.activa = TRUE
      AND t.estado = 'aprobada'
      AND u.activo = TRUE
      AND u.rol::text = 'tienda'
    ON CONFLICT (usuario_id, evento_clave)
        WHERE evento_clave IS NOT NULL
        DO NOTHING;

    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sprint3_notify_new_request() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sprint3_notify_new_request ON public.solicitudes;
CREATE TRIGGER sprint3_notify_new_request
    AFTER INSERT ON public.solicitudes
    FOR EACH ROW
    EXECUTE FUNCTION public.sprint3_notify_new_request();

CREATE OR REPLACE FUNCTION public.sprint3_notify_new_proposal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_customer_id uuid;
    v_request_title text;
    v_store_name text;
BEGIN
    SELECT s.usuario_id, s.titulo, t.nombre
      INTO v_customer_id, v_request_title, v_store_name
    FROM public.solicitudes s
    JOIN public.tiendas t ON t.id = NEW.tienda_id
    JOIN public.usuarios u ON u.id = s.usuario_id
    WHERE s.id = NEW.solicitud_id
      AND u.activo = TRUE
      AND u.rol::text = 'cliente';

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.notificaciones
        (usuario_id, tipo, titulo, mensaje, solicitud_id, propuesta_id, evento_clave)
    VALUES (
        v_customer_id,
        'nueva_propuesta'::public.notification_type,
        'Nueva propuesta recibida',
        format('%s envió una propuesta para «%s».', v_store_name, v_request_title),
        NEW.solicitud_id,
        NEW.id,
        'propuesta:nueva:' || NEW.id::text
    )
    ON CONFLICT (usuario_id, evento_clave)
        WHERE evento_clave IS NOT NULL
        DO NOTHING;

    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sprint3_notify_new_proposal() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sprint3_notify_new_proposal ON public.propuestas;
CREATE TRIGGER sprint3_notify_new_proposal
    AFTER INSERT ON public.propuestas
    FOR EACH ROW
    EXECUTE FUNCTION public.sprint3_notify_new_proposal();

CREATE OR REPLACE FUNCTION public.sprint3_notify_proposal_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_customer_id uuid;
    v_store_owner_id uuid;
    v_request_title text;
    v_store_name text;
    v_notification_type public.notification_type;
    v_title text;
    v_message text;
BEGIN
    IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN
        RETURN NEW;
    END IF;

    SELECT s.usuario_id, s.titulo, t.usuario_id, t.nombre
      INTO v_customer_id, v_request_title, v_store_owner_id, v_store_name
    FROM public.solicitudes s
    JOIN public.tiendas t ON t.id = NEW.tienda_id
    WHERE s.id = NEW.solicitud_id;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    IF NEW.estado = 'aceptada'::public.proposal_status THEN
        v_notification_type := 'propuesta_seleccionada'::public.notification_type;
        v_title := 'Propuesta seleccionada';
        v_message := format('Tu propuesta para «%s» fue seleccionada.', v_request_title);
    ELSE
        v_notification_type := 'cambio_estado_propuesta'::public.notification_type;
        v_title := 'Cambió el estado de tu propuesta';
        v_message := format('Tu propuesta para «%s» ahora está %s.', v_request_title, NEW.estado::text);
    END IF;

    INSERT INTO public.notificaciones
        (usuario_id, tipo, titulo, mensaje, solicitud_id, propuesta_id, evento_clave)
    VALUES (
        v_store_owner_id,
        v_notification_type,
        v_title,
        v_message,
        NEW.solicitud_id,
        NEW.id,
        'propuesta:tienda:' || NEW.id::text || ':' || NEW.estado::text
    )
    ON CONFLICT (usuario_id, evento_clave)
        WHERE evento_clave IS NOT NULL
        DO NOTHING;

    IF NEW.estado = 'aceptada'::public.proposal_status THEN
        INSERT INTO public.notificaciones
            (usuario_id, tipo, titulo, mensaje, solicitud_id, propuesta_id, evento_clave)
        SELECT
            v_customer_id,
            'propuesta_seleccionada'::public.notification_type,
            'Propuesta seleccionada',
            format('Seleccionaste la propuesta de %s para «%s».', v_store_name, v_request_title),
            NEW.solicitud_id,
            NEW.id,
            'propuesta:cliente:' || NEW.id::text || ':aceptada'
        FROM public.usuarios u
        WHERE u.id = v_customer_id
          AND u.activo = TRUE
          AND u.rol::text = 'cliente'
        ON CONFLICT (usuario_id, evento_clave)
            WHERE evento_clave IS NOT NULL
            DO NOTHING;
    ELSIF NEW.estado IN (
        'rechazada'::public.proposal_status,
        'retirada'::public.proposal_status
    ) THEN
        INSERT INTO public.notificaciones
            (usuario_id, tipo, titulo, mensaje, solicitud_id, propuesta_id, evento_clave)
        SELECT
            v_customer_id,
            'cambio_estado_propuesta'::public.notification_type,
            'Cambió el estado de una propuesta',
            format('La propuesta de %s para «%s» ahora está %s.', v_store_name, v_request_title, NEW.estado::text),
            NEW.solicitud_id,
            NEW.id,
            'propuesta:cliente:' || NEW.id::text || ':' || NEW.estado::text
        FROM public.usuarios u
        WHERE u.id = v_customer_id
          AND u.activo = TRUE
          AND u.rol::text = 'cliente'
        ON CONFLICT (usuario_id, evento_clave)
            WHERE evento_clave IS NOT NULL
            DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sprint3_notify_proposal_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sprint3_notify_proposal_status ON public.propuestas;
CREATE TRIGGER sprint3_notify_proposal_status
    AFTER UPDATE OF estado ON public.propuestas
    FOR EACH ROW
    WHEN (OLD.estado IS DISTINCT FROM NEW.estado)
    EXECUTE FUNCTION public.sprint3_notify_proposal_status();

CREATE OR REPLACE FUNCTION public.sprint3_notify_request_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Proposal selection and the transition to recibiendo_propuestas are
    -- reported by their corresponding proposal events instead.
    IF NEW.estado IN (
        'recibiendo_propuestas'::public.request_status,
        'propuesta_seleccionada'::public.request_status
    ) THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.notificaciones
        (usuario_id, tipo, titulo, mensaje, solicitud_id, evento_clave)
    SELECT
        NEW.usuario_id,
        'cambio_estado_solicitud'::public.notification_type,
        'Cambió el estado de tu solicitud',
        format('La solicitud «%s» ahora está %s.', NEW.titulo, NEW.estado::text),
        NEW.id,
        'solicitud:estado:' || NEW.id::text || ':' || NEW.estado::text
    FROM public.usuarios u
    WHERE u.id = NEW.usuario_id
      AND u.activo = TRUE
      AND u.rol::text = 'cliente'
    ON CONFLICT (usuario_id, evento_clave)
        WHERE evento_clave IS NOT NULL
        DO NOTHING;

    IF NEW.estado IN (
        'atendida'::public.request_status,
        'cerrada'::public.request_status
    ) THEN
        INSERT INTO public.notificaciones
            (usuario_id, tipo, titulo, mensaje, solicitud_id, evento_clave)
        SELECT
            t.usuario_id,
            'cambio_estado_solicitud'::public.notification_type,
            'Cambió el estado de una solicitud',
            format('La solicitud «%s» ahora está %s.', NEW.titulo, NEW.estado::text),
            NEW.id,
            'solicitud:tienda:estado:' || NEW.id::text || ':' || NEW.estado::text
        FROM public.propuestas p
        JOIN public.tiendas t ON t.id = p.tienda_id
        JOIN public.usuarios u ON u.id = t.usuario_id
        WHERE p.solicitud_id = NEW.id
          AND u.activo = TRUE
          AND u.rol::text = 'tienda'
        ON CONFLICT (usuario_id, evento_clave)
            WHERE evento_clave IS NOT NULL
            DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sprint3_notify_request_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sprint3_notify_request_status ON public.solicitudes;
CREATE TRIGGER sprint3_notify_request_status
    AFTER UPDATE OF estado ON public.solicitudes
    FOR EACH ROW
    WHEN (OLD.estado IS DISTINCT FROM NEW.estado)
    EXECUTE FUNCTION public.sprint3_notify_request_status();

COMMIT;

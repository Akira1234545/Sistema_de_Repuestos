-- Sesión 3b (DriveFix): correcciones de base de datos del informe de errores.
-- E04+E44 tienda rechazada → pendiente y avisos de estado de tienda · E12 cancelar la selección
-- E15 propuestas > 0 Bs · E07+E42 fotos de vehículo (host, cuota, limpieza, versión, largo de notas)
-- E17 promociones.fotografias · E37 búsquedas con % y _ · E38 clientes desactivados · E13 «Sin responder».
-- Idempotente: se puede ejecutar más de una vez. Aplicar después de 20261115_vehicle_photos.sql.

-- ---------------------------------------------------------------------------
-- 0. Tipo de notificación para cambios de estado de tienda (E44).
--    El valor nuevo solo se usa dentro de funciones, así que puede ir en la misma transacción.
-- ---------------------------------------------------------------------------
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'cambio_estado_tienda';

-- ---------------------------------------------------------------------------
-- 1. E04: una tienda rechazada vuelve a revisión cuando su dueño cambia el perfil.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resubmit_rejected_store()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF OLD.estado = 'rechazada' AND NEW.estado = 'rechazada'
       AND auth.uid() IS NOT NULL AND OLD.usuario_id = auth.uid()
       AND (NEW.nombre, NEW.descripcion, NEW.telefono, NEW.direccion, NEW.latitud, NEW.longitud, NEW.horario, NEW.fotografias)
           IS DISTINCT FROM
           (OLD.nombre, OLD.descripcion, OLD.telefono, OLD.direccion, OLD.latitud, OLD.longitud, OLD.horario, OLD.fotografias) THEN
        NEW.estado := 'pendiente';
        NEW.motivo_estado := NULL;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.resubmit_rejected_store() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS resubmit_rejected_store ON public.tiendas;
CREATE TRIGGER resubmit_rejected_store BEFORE UPDATE ON public.tiendas
    FOR EACH ROW EXECUTE FUNCTION public.resubmit_rejected_store();

-- E44: avisos al dueño cuando otro (el admin) cambia el estado, y a los admins cuando hay una tienda por revisar.
CREATE OR REPLACE FUNCTION public.notify_store_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_stamp text := to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS');
    v_reason text := coalesce(nullif(btrim(NEW.motivo_estado), ''), 'sin detalle');
    v_title text;
    v_message text;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.estado IS NOT DISTINCT FROM OLD.estado THEN RETURN NEW; END IF;

    IF TG_OP = 'UPDATE' AND auth.uid() IS DISTINCT FROM NEW.usuario_id THEN
        v_title := CASE NEW.estado
            WHEN 'aprobada' THEN 'Tu tienda fue aprobada'
            WHEN 'rechazada' THEN 'Tu tienda fue rechazada'
            WHEN 'suspendida' THEN 'Tu tienda fue suspendida'
            ELSE 'Tu tienda está en revisión' END;
        v_message := CASE NEW.estado
            WHEN 'aprobada' THEN 'Ya puedes recibir solicitudes y enviar propuestas.'
            WHEN 'rechazada' THEN format('Motivo: %s. Actualiza tu información para una nueva revisión.', v_reason)
            WHEN 'suspendida' THEN format('Motivo: %s. Contacta con soporte para reactivarla.', v_reason)
            ELSE 'Un administrador revisará tu información.' END;
        INSERT INTO public.notificaciones (usuario_id, tipo, titulo, mensaje, evento_clave)
        SELECT u.id, 'cambio_estado_tienda'::public.notification_type, v_title, v_message,
               'tienda:estado:' || NEW.id::text || ':' || NEW.estado::text || ':' || v_stamp
        FROM public.usuarios u WHERE u.id = NEW.usuario_id AND u.activo
        ON CONFLICT (usuario_id, evento_clave) WHERE evento_clave IS NOT NULL DO NOTHING;
    END IF;

    IF NEW.estado = 'pendiente' THEN
        INSERT INTO public.notificaciones (usuario_id, tipo, titulo, mensaje, evento_clave)
        SELECT u.id, 'cambio_estado_tienda'::public.notification_type,
               CASE WHEN TG_OP = 'INSERT' THEN 'Nueva tienda por revisar' ELSE 'Tienda enviada a revisión' END,
               format('«%s» espera revisión en Administración › Tiendas.', coalesce(nullif(btrim(NEW.nombre), ''), 'Una tienda')),
               'tienda:revision:' || NEW.id::text || ':' || v_stamp
        FROM public.usuarios u
        WHERE u.activo AND u.rol::text IN ('administrador', 'superAdministrador')
        ON CONFLICT (usuario_id, evento_clave) WHERE evento_clave IS NOT NULL DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_store_status() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS notify_store_status ON public.tiendas;
-- No column list: the resubmission trigger changes estado without naming it in the UPDATE.
CREATE TRIGGER notify_store_status AFTER INSERT OR UPDATE ON public.tiendas
    FOR EACH ROW EXECUTE FUNCTION public.notify_store_status();

-- ---------------------------------------------------------------------------
-- 2. E12: cancelar la selección o cerrar una solicitud con propuesta seleccionada.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.selecciones_canceladas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitud_id uuid NOT NULL REFERENCES public.solicitudes(id) ON DELETE CASCADE,
    propuesta_id uuid NOT NULL REFERENCES public.propuestas(id) ON DELETE CASCADE,
    fecha timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT selecciones_canceladas_propuesta_key UNIQUE (propuesta_id)
);
ALTER TABLE public.selecciones_canceladas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.selecciones_canceladas FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS rpc_only_access ON public.selecciones_canceladas;
CREATE POLICY rpc_only_access ON public.selecciones_canceladas AS RESTRICTIVE FOR ALL TO anon, authenticated
    USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.sprint1_guard_request_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_transition text := current_setting('app.sprint2_request_transition', TRUE);
BEGIN
    NEW.fecha_actualizacion := NOW();
    IF (SELECT auth.uid()) IS NULL THEN RETURN NEW; END IF;
    IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN RETURN NEW; END IF;
    IF current_setting('app.confirming_attention',true)='yes'
       AND OLD.usuario_id=auth.uid() AND public.sprint1_role()='cliente'
       AND OLD.estado='propuesta_seleccionada' AND NEW.estado='atendida' THEN RETURN NEW; END IF;

    -- The customer may close an open request, also after selecting a proposal (E12).
    IF OLD.usuario_id = (SELECT auth.uid()) AND public.sprint1_role() = 'cliente'
       AND OLD.estado IN ('publicada'::public.request_status, 'recibiendo_propuestas'::public.request_status,
                          'propuesta_seleccionada'::public.request_status)
       AND NEW.estado = 'cerrada'::public.request_status THEN
        NEW.propuesta_seleccionada_id := NULL;
        RETURN NEW;
    END IF;

    IF v_transition = 'proposal' AND public.sprint1_role() = 'tienda'
       AND OLD.estado = 'publicada'::public.request_status
       AND NEW.estado = 'recibiendo_propuestas'::public.request_status
       AND EXISTS (SELECT 1 FROM public.propuestas p JOIN public.tiendas t ON t.id = p.tienda_id
                   WHERE p.solicitud_id = OLD.id AND t.usuario_id = (SELECT auth.uid())) THEN
        RETURN NEW;
    END IF;

    IF v_transition = 'selection' AND OLD.usuario_id = (SELECT auth.uid())
       AND public.sprint1_role() = 'cliente'
       AND OLD.estado IN ('publicada'::public.request_status, 'recibiendo_propuestas'::public.request_status)
       AND NEW.estado = 'propuesta_seleccionada'::public.request_status
       AND EXISTS (SELECT 1 FROM public.propuestas p
                   WHERE p.id = NEW.propuesta_seleccionada_id AND p.solicitud_id = OLD.id AND p.estado = 'aceptada') THEN
        RETURN NEW;
    END IF;

    IF v_transition = 'cancel_selection' AND OLD.usuario_id = (SELECT auth.uid())
       AND public.sprint1_role() = 'cliente'
       AND OLD.estado = 'propuesta_seleccionada'::public.request_status
       AND NEW.estado = 'recibiendo_propuestas'::public.request_status
       AND NEW.propuesta_seleccionada_id IS NULL THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Transición de estado no permitida';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sprint1_guard_request_update() FROM PUBLIC, anon, authenticated;

-- The owner may also update (close) a request whose proposal is selected; the guard above
-- still decides the allowed transitions and guard_quoted_requirements blocks other edits.
DROP POLICY IF EXISTS sprint1_requests_update_owner ON public.solicitudes;
CREATE POLICY sprint1_requests_update_owner ON public.solicitudes FOR UPDATE TO authenticated
    USING (usuario_id = (SELECT auth.uid()) AND public.sprint1_role() = 'cliente'
           AND estado IN ('publicada'::public.request_status, 'recibiendo_propuestas'::public.request_status,
                          'propuesta_seleccionada'::public.request_status))
    WITH CHECK (usuario_id = (SELECT auth.uid()) AND public.sprint1_role() = 'cliente'
                AND public.sprint1_owns_vehicle(vehiculo_id));

-- Closing rejects the open proposals and, if one was selected, that one too.
CREATE OR REPLACE FUNCTION public.reject_closed_proposals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF NEW.estado='cerrada' AND NEW.estado IS DISTINCT FROM OLD.estado THEN
        IF OLD.estado='propuesta_seleccionada' AND OLD.propuesta_seleccionada_id IS NOT NULL THEN
            INSERT INTO public.selecciones_canceladas(solicitud_id, propuesta_id)
            VALUES (NEW.id, OLD.propuesta_seleccionada_id) ON CONFLICT (propuesta_id) DO NOTHING;
            PERFORM set_config('app.cancel_selection', 'yes', TRUE);
            UPDATE public.propuestas SET estado='rechazada', fecha_actualizacion=now()
            WHERE id=OLD.propuesta_seleccionada_id AND estado='aceptada';
            PERFORM set_config('app.cancel_selection', '', TRUE);
        END IF;
        UPDATE public.propuestas SET estado='rechazada',fecha_actualizacion=now()
        WHERE solicitud_id=NEW.id AND estado='enviada';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reject_closed_proposals() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cancelar_seleccion(p_solicitud_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_state public.request_status; v_selected uuid;
BEGIN
    IF public.sprint1_role() IS DISTINCT FROM 'cliente' THEN RAISE EXCEPTION 'Se requiere una cuenta cliente activa'; END IF;
    SELECT estado, propuesta_seleccionada_id INTO v_state, v_selected
    FROM public.solicitudes WHERE id = p_solicitud_id AND usuario_id = auth.uid() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no disponible'; END IF;
    IF v_state IS DISTINCT FROM 'propuesta_seleccionada' THEN
        RAISE EXCEPTION 'Esta solicitud no tiene una propuesta seleccionada que se pueda cancelar';
    END IF;
    PERFORM 1 FROM public.propuestas WHERE solicitud_id = p_solicitud_id ORDER BY id FOR UPDATE;

    IF v_selected IS NOT NULL THEN
        INSERT INTO public.selecciones_canceladas(solicitud_id, propuesta_id)
        VALUES (p_solicitud_id, v_selected) ON CONFLICT (propuesta_id) DO NOTHING;
        PERFORM set_config('app.cancel_selection', 'yes', TRUE);
        UPDATE public.propuestas SET estado = 'rechazada', fecha_actualizacion = now()
        WHERE id = v_selected AND estado = 'aceptada';
        PERFORM set_config('app.cancel_selection', '', TRUE);
    END IF;

    -- The other proposals were set aside by the selection: they compete again,
    -- except earlier cancelled selections and stores that are no longer available.
    UPDATE public.propuestas p SET estado = 'enviada', fecha_actualizacion = now()
    WHERE p.solicitud_id = p_solicitud_id AND p.estado = 'rechazada' AND p.precio > 0
      AND NOT EXISTS (SELECT 1 FROM public.selecciones_canceladas c WHERE c.propuesta_id = p.id)
      AND public.store_is_eligible(p.tienda_id);

    PERFORM set_config('app.sprint2_request_transition', 'cancel_selection', TRUE);
    UPDATE public.solicitudes SET estado = 'recibiendo_propuestas', propuesta_seleccionada_id = NULL
    WHERE id = p_solicitud_id;
    PERFORM set_config('app.sprint2_request_transition', '', TRUE);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cancelar_seleccion(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_seleccion(uuid) TO authenticated;

-- Proposal notifications: clearer texts for a cancelled selection and for proposals that compete again.
CREATE OR REPLACE FUNCTION public.sprint3_notify_proposal_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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

    IF OLD.estado = 'aceptada' AND NEW.estado = 'rechazada'
       AND current_setting('app.cancel_selection', TRUE) = 'yes' THEN
        INSERT INTO public.notificaciones (usuario_id, tipo, titulo, mensaje, solicitud_id, propuesta_id, evento_clave)
        VALUES (v_store_owner_id, 'cambio_estado_propuesta', 'Selección cancelada',
                format('El cliente canceló la selección de tu propuesta para «%s».', v_request_title),
                NEW.solicitud_id, NEW.id, 'propuesta:tienda:' || NEW.id::text || ':cancelada')
        ON CONFLICT (usuario_id, evento_clave) WHERE evento_clave IS NOT NULL DO NOTHING;
        RETURN NEW;
    END IF;

    IF OLD.estado = 'rechazada' AND NEW.estado = 'enviada' THEN
        INSERT INTO public.notificaciones (usuario_id, tipo, titulo, mensaje, solicitud_id, propuesta_id, evento_clave)
        VALUES (v_store_owner_id, 'cambio_estado_propuesta', 'Tu propuesta vuelve a competir',
                format('La solicitud «%s» vuelve a recibir propuestas y tu propuesta está disponible otra vez.', v_request_title),
                NEW.solicitud_id, NEW.id,
                'propuesta:tienda:' || NEW.id::text || ':reabierta:' || to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS'))
        ON CONFLICT (usuario_id, evento_clave) WHERE evento_clave IS NOT NULL DO NOTHING;
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
REVOKE EXECUTE ON FUNCTION public.sprint3_notify_proposal_status() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. E15 (+E38): el precio debe ser mayor que 0 y la solicitud de un cliente desactivado no se cotiza.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sprint2_crear_propuesta(p_solicitud_id uuid, p_precio numeric, p_marca text, p_disponibilidad text, p_caracteristicas text DEFAULT NULL::text, p_garantia text DEFAULT NULL::text, p_observaciones text DEFAULT NULL::text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_store uuid;
BEGIN
    IF public.sprint1_role() IS DISTINCT FROM 'tienda' THEN RAISE EXCEPTION 'Se requiere una cuenta tienda activa'; END IF;
    IF p_precio IS NULL OR p_precio::text IN ('NaN','Infinity','-Infinity') OR p_precio<=0 OR p_precio>99999999.99 THEN
        RAISE EXCEPTION 'Indica un precio total mayor que 0 Bs';
    END IF;
    IF length(p_marca)>100 OR length(p_disponibilidad)>250 OR length(p_caracteristicas)>5000
        OR length(p_garantia)>250 OR length(p_observaciones)>5000 THEN RAISE EXCEPTION 'La propuesta supera el límite de texto'; END IF;
    PERFORM 1 FROM public.solicitudes WHERE id=p_solicitud_id FOR UPDATE;
    PERFORM 1 FROM public.categorias_repuesto c JOIN public.solicitudes s ON s.categoria_id=c.id
        WHERE s.id=p_solicitud_id AND c.activo FOR SHARE OF c;
    IF NOT FOUND THEN RAISE EXCEPTION 'La categoría de la solicitud ya no está activa'; END IF;
    PERFORM 1 FROM public.usuarios WHERE id=auth.uid() AND activo AND rol::text='tienda' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta no disponible'; END IF;
    SELECT id INTO v_store FROM public.tiendas WHERE usuario_id=auth.uid() AND activa AND estado='aprobada' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La tienda debe estar aprobada y activa'; END IF;
    RETURN app_private.sprint2_crear_propuesta(p_solicitud_id,p_precio,p_marca,p_disponibilidad,p_caracteristicas,p_garantia,p_observaciones);
END;
$$;

CREATE OR REPLACE FUNCTION app_private.sprint2_crear_propuesta(p_solicitud_id uuid, p_precio numeric, p_marca text, p_disponibilidad text, p_caracteristicas text DEFAULT NULL::text, p_garantia text DEFAULT NULL::text, p_observaciones text DEFAULT NULL::text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_tienda_id uuid;
    v_estado public.request_status;
    v_categoria_id uuid;
    v_cliente_activo boolean;
    v_propuesta_id uuid;
BEGIN
    IF public.sprint1_role() <> 'tienda' THEN
        RAISE EXCEPTION 'Solo una cuenta tienda puede enviar propuestas';
    END IF;
    SELECT t.id INTO v_tienda_id
    FROM public.tiendas t
    WHERE t.usuario_id = (SELECT auth.uid()) AND t.activa = TRUE AND t.estado = 'aprobada';
    IF v_tienda_id IS NULL THEN
        RAISE EXCEPTION 'Completa el perfil de tienda antes de enviar propuestas';
    END IF;
    IF p_precio IS NULL OR p_precio <= 0 OR NULLIF(btrim(p_marca), '') IS NULL
       OR NULLIF(btrim(p_disponibilidad), '') IS NULL THEN
        RAISE EXCEPTION 'Indica un precio mayor que 0, la marca y la disponibilidad';
    END IF;

    SELECT s.estado, s.categoria_id, u.activo INTO v_estado, v_categoria_id, v_cliente_activo
    FROM public.solicitudes s
    JOIN public.usuarios u ON u.id = s.usuario_id
    WHERE s.id = p_solicitud_id
    FOR UPDATE OF s;
    IF NOT FOUND OR v_estado NOT IN ('publicada', 'recibiendo_propuestas') OR NOT v_cliente_activo THEN
        RAISE EXCEPTION 'La solicitud ya no acepta propuestas';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.tienda_categorias tc
        WHERE tc.tienda_id = v_tienda_id AND tc.categoria_id = v_categoria_id
    ) THEN
        RAISE EXCEPTION 'La tienda no ofrece repuestos de la categoría solicitada';
    END IF;

    INSERT INTO public.propuestas
        (solicitud_id, tienda_id, precio, marca, disponibilidad, caracteristicas, garantia, observaciones)
    VALUES
        (p_solicitud_id, v_tienda_id, p_precio, btrim(p_marca), btrim(p_disponibilidad),
         NULLIF(btrim(p_caracteristicas), ''), NULLIF(btrim(p_garantia), ''), NULLIF(btrim(p_observaciones), ''))
    RETURNING id INTO v_propuesta_id;

    IF v_estado = 'publicada' THEN
        PERFORM set_config('app.sprint2_request_transition', 'proposal', TRUE);
        UPDATE public.solicitudes
        SET estado = 'recibiendo_propuestas'
        WHERE id = p_solicitud_id;
        PERFORM set_config('app.sprint2_request_transition', '', TRUE);
    END IF;
    RETURN v_propuesta_id;
END;
$$;

-- An open proposal must cost more than 0. Closed proposals (rejected, accepted, withdrawn)
-- keep their legacy price so that old 0 Bs rows never block a later state change.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.propuestas'::regclass AND conname = 'propuestas_precio_positivo') THEN
        ALTER TABLE public.propuestas ADD CONSTRAINT propuestas_precio_positivo
            CHECK (precio > 0 OR estado <> 'enviada') NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.propuestas WHERE precio <= 0 AND estado = 'enviada') THEN
        ALTER TABLE public.propuestas VALIDATE CONSTRAINT propuestas_precio_positivo;
    ELSE
        RAISE NOTICE 'Hay propuestas abiertas de 0 Bs: propuestas_precio_positivo queda NOT VALID hasta revisarlas';
    END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. E07 + E42: fotos de vehículo con host del proyecto, cuota, cola de limpieza y versión.
-- ---------------------------------------------------------------------------
ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS fotos_version integer NOT NULL DEFAULT 0;
ALTER TABLE public.storage_cleanup_jobs ADD COLUMN IF NOT EXISTS bucket_id text NOT NULL DEFAULT 'tiendas';
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.storage_cleanup_jobs'::regclass AND conname = 'storage_cleanup_jobs_bucket_check') THEN
        ALTER TABLE public.storage_cleanup_jobs ADD CONSTRAINT storage_cleanup_jobs_bucket_check
            CHECK (bucket_id IN ('tiendas', 'vehiculos'));
    END IF;
    -- Notes are read by stores: keep them short. NOT VALID keeps legacy rows loadable.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.vehiculos'::regclass AND conname = 'vehicle_notes_length') THEN
        ALTER TABLE public.vehiculos ADD CONSTRAINT vehicle_notes_length
            CHECK (descripcion IS NULL OR length(descripcion) <= 1000) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.vehiculos WHERE length(descripcion) > 1000) THEN
        ALTER TABLE public.vehiculos VALIDATE CONSTRAINT vehicle_notes_length;
    ELSE
        RAISE NOTICE 'Hay notas de vehículo de más de 1000 caracteres: vehicle_notes_length queda NOT VALID';
    END IF;
END;
$$;

-- Photos change only through guardar_fotos_vehiculo (version + ownership checks).
REVOKE INSERT (fotos), UPDATE (fotos), INSERT (fotos_version), UPDATE (fotos_version) ON public.vehiculos FROM anon, authenticated;
GRANT SELECT (fotos_version) ON public.vehiculos TO authenticated;

-- Defense in depth for any write path: new URLs must belong to this project and the owner's folder.
CREATE OR REPLACE FUNCTION public.validate_vehicle_photos()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
    photo text;
    origin text := regexp_replace(coalesce(auth.jwt()->>'iss', ''), '/auth/v1/?$', '');
BEGIN
    FOREACH photo IN ARRAY coalesce(NEW.fotos, '{}') LOOP
        IF TG_OP = 'UPDATE' AND photo = ANY(coalesce(OLD.fotos, '{}')) THEN CONTINUE; END IF;
        IF photo !~ ('^https://[a-z0-9.-]+/storage/v1/object/public/vehiculos/' || NEW.usuario_id::text || '/[0-9a-f-]{36}\.(webp|jpg|png)$')
           OR (auth.uid() IS NOT NULL AND (origin !~ '^https://[^/]+$' OR left(photo, length(origin) + 1) <> origin || '/')) THEN
            RAISE EXCEPTION 'Las fotos del vehículo deben subirse desde la aplicación';
        END IF;
    END LOOP;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.validate_vehicle_photos() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guardar_fotos_vehiculo(p_vehiculo_id uuid, p_urls text[], p_expected_version integer)
RETURNS public.vehiculos LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    car public.vehiculos; url text; v_path text; old_url text;
    origin text := regexp_replace(auth.jwt()->>'iss', '/auth/v1/?$', '');
    prefix text;
BEGIN
    IF public.sprint1_role() IS DISTINCT FROM 'cliente' THEN RAISE EXCEPTION 'Se requiere una cuenta cliente activa'; END IF;
    prefix := origin || '/storage/v1/object/public/vehiculos/';
    SELECT * INTO car FROM public.vehiculos WHERE id = p_vehiculo_id AND usuario_id = auth.uid() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'El vehículo no existe o no pertenece a tu cuenta'; END IF;
    IF car.fotos_version IS DISTINCT FROM p_expected_version THEN
        RAISE EXCEPTION 'Las fotos cambiaron en otra sesión. Actualiza la página';
    END IF;
    IF p_urls IS NULL OR cardinality(p_urls) > 4 OR cardinality(p_urls) <> (SELECT count(DISTINCT x) FROM unnest(p_urls) x) THEN
        RAISE EXCEPTION 'Selecciona hasta 4 fotografías diferentes';
    END IF;
    FOREACH url IN ARRAY p_urls LOOP
        IF url = ANY(car.fotos) THEN CONTINUE; END IF;
        IF origin IS NULL OR origin !~ '^https://[^/]+$' OR left(url, length(prefix)) <> prefix THEN
            RAISE EXCEPTION 'URL de fotografía no válida para este proyecto';
        END IF;
        v_path := substr(url, length(prefix) + 1);
        IF EXISTS (SELECT 1 FROM public.storage_cleanup_jobs j WHERE j.claimed_at IS NOT NULL AND j.path = v_path) THEN
            RAISE EXCEPTION 'Esta fotografía está pendiente de eliminación. Súbela de nuevo';
        END IF;
        IF (storage.foldername(v_path))[1] IS DISTINCT FROM auth.uid()::text OR NOT EXISTS (
            SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'vehiculos' AND o.name = v_path) THEN
            RAISE EXCEPTION 'La fotografía no pertenece a tu cuenta';
        END IF;
        IF EXISTS (SELECT 1 FROM public.vehiculos v WHERE v.usuario_id = auth.uid() AND v.id <> car.id AND url = ANY(v.fotos)) THEN
            RAISE EXCEPTION 'Esa fotografía ya está en otro vehículo';
        END IF;
    END LOOP;
    FOREACH old_url IN ARRAY car.fotos LOOP
        IF NOT old_url = ANY(p_urls) AND old_url LIKE '%/storage/v1/object/public/vehiculos/' || auth.uid()::text || '/%' THEN
            INSERT INTO public.storage_cleanup_jobs(usuario_id, path, bucket_id)
            VALUES (auth.uid(), split_part(old_url, '/storage/v1/object/public/vehiculos/', 2), 'vehiculos')
            ON CONFLICT (path) DO NOTHING;
        END IF;
    END LOOP;
    UPDATE public.vehiculos SET fotos = p_urls, fotos_version = fotos_version + 1
    WHERE id = car.id RETURNING * INTO car;
    RETURN car;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guardar_fotos_vehiculo(uuid, text[], integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_fotos_vehiculo(uuid, text[], integer) TO authenticated;

-- Upload quota per customer: 4 photos per vehicle plus a margin for retries (at least 12 files).
CREATE OR REPLACE FUNCTION public.vehicle_upload_allowed()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE object_count bigint; vehicle_count bigint;
BEGIN
    IF public.sprint1_role() IS DISTINCT FROM 'cliente' THEN RETURN false; END IF;
    IF EXISTS (SELECT 1 FROM public.configuracion_sistema WHERE id = 1 AND mantenimiento_activo) THEN RETURN false; END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 20261116));
    SELECT count(*) INTO object_count FROM storage.objects o
        WHERE o.bucket_id = 'vehiculos' AND (storage.foldername(o.name))[1] = auth.uid()::text;
    SELECT count(*) INTO vehicle_count FROM public.vehiculos v WHERE v.usuario_id = auth.uid();
    RETURN object_count < greatest(12, vehicle_count * 4 + 4);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.vehicle_upload_allowed() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vehicle_upload_allowed() TO authenticated;

DROP POLICY IF EXISTS vehicle_upload_quota ON storage.objects;
CREATE POLICY vehicle_upload_quota ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
    WITH CHECK (bucket_id <> 'vehiculos'
                OR ((storage.foldername(name))[1] = (SELECT auth.uid())::text AND public.vehicle_upload_allowed()));

-- Every upload is queued; the cleanup job skips files that end up attached.
CREATE OR REPLACE FUNCTION public.queue_unattached_upload()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE folder text;
BEGIN
    IF NEW.bucket_id NOT IN ('tiendas', 'vehiculos') THEN RETURN NEW; END IF;
    folder := (storage.foldername(NEW.name))[1];
    IF folder ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        INSERT INTO public.storage_cleanup_jobs(usuario_id, path, bucket_id)
        VALUES (folder::uuid, NEW.name, NEW.bucket_id) ON CONFLICT (path) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.queue_unattached_upload() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.queue_deleted_vehicle_photos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE url text;
BEGIN
    FOREACH url IN ARRAY coalesce(OLD.fotos, ARRAY[]::text[]) LOOP
        IF url LIKE '%/storage/v1/object/public/vehiculos/' || OLD.usuario_id::text || '/%' THEN
            INSERT INTO public.storage_cleanup_jobs(usuario_id, path, bucket_id, available_after)
            VALUES (OLD.usuario_id, split_part(url, '/storage/v1/object/public/vehiculos/', 2), 'vehiculos', now())
            ON CONFLICT (path) DO UPDATE SET available_after = least(public.storage_cleanup_jobs.available_after, now());
        END IF;
    END LOOP;
    RETURN OLD;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.queue_deleted_vehicle_photos() FROM PUBLIC, anon, authenticated;
-- E45 (hallado en la 3b): «Eliminar vehículo» nunca tuvo GRANT DELETE ni política permisiva.
-- The owner may delete a vehicle without requests; its photos go to the cleanup queue.
GRANT DELETE ON public.vehiculos TO authenticated;
DROP POLICY IF EXISTS vehicles_delete_owner ON public.vehiculos;
CREATE POLICY vehicles_delete_owner ON public.vehiculos FOR DELETE TO authenticated
    USING (usuario_id = (SELECT auth.uid()) AND public.sprint1_role() = 'cliente'
           AND NOT EXISTS (SELECT 1 FROM public.solicitudes s WHERE s.vehiculo_id = vehiculos.id));

DROP TRIGGER IF EXISTS queue_deleted_vehicle_photos ON public.vehiculos;
CREATE TRIGGER queue_deleted_vehicle_photos AFTER DELETE ON public.vehiculos
    FOR EACH ROW EXECUTE FUNCTION public.queue_deleted_vehicle_photos();

CREATE OR REPLACE FUNCTION public.claim_storage_cleanup(p_limit integer DEFAULT 100)
RETURNS SETOF public.storage_cleanup_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE task public.storage_cleanup_jobs;
BEGIN
    IF p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'Límite no válido'; END IF;
    FOR task IN SELECT * FROM public.storage_cleanup_jobs
        WHERE available_after<=now() AND (claimed_at IS NULL OR claimed_at<now()-interval '5 minutes')
        ORDER BY created_at,id LIMIT p_limit LOOP
        -- Same lock order as photo edits: owner rows first, then the cleanup job.
        IF task.bucket_id = 'vehiculos' THEN
            PERFORM 1 FROM public.vehiculos WHERE usuario_id=task.usuario_id ORDER BY id FOR UPDATE;
            IF EXISTS(SELECT 1 FROM public.vehiculos v WHERE v.usuario_id=task.usuario_id
                AND EXISTS(SELECT 1 FROM unnest(v.fotos) url WHERE url LIKE '%/vehiculos/'||task.path)) THEN
                DELETE FROM public.storage_cleanup_jobs WHERE id=task.id;
                CONTINUE;
            END IF;
        ELSE
            PERFORM 1 FROM public.tiendas WHERE usuario_id=task.usuario_id FOR UPDATE;
            IF EXISTS(SELECT 1 FROM public.tiendas t WHERE t.usuario_id=task.usuario_id
                AND EXISTS(SELECT 1 FROM unnest(t.fotografias) url WHERE url LIKE '%/tiendas/'||task.path)) THEN
                DELETE FROM public.storage_cleanup_jobs WHERE id=task.id;
                CONTINUE;
            END IF;
        END IF;
        UPDATE public.storage_cleanup_jobs SET claimed_at=now() WHERE id=task.id
            AND (claimed_at IS NULL OR claimed_at<now()-interval '5 minutes') RETURNING * INTO task;
        IF FOUND THEN RETURN NEXT task; END IF;
    END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_storage_cleanup(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_storage_cleanup(integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. E17: las fotos de promociones no se escriben desde el cliente; si llegan, deben ser del proyecto.
-- ---------------------------------------------------------------------------
REVOKE INSERT (fotografias), UPDATE (fotografias) ON public.promociones FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.validate_promotion_photos()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
    photo text;
    origin text := regexp_replace(coalesce(auth.jwt()->>'iss', ''), '/auth/v1/?$', '');
BEGIN
    IF auth.uid() IS NULL THEN RETURN NEW; END IF;
    FOREACH photo IN ARRAY coalesce(NEW.fotografias, '{}') LOOP
        IF TG_OP = 'UPDATE' AND photo = ANY(coalesce(OLD.fotografias, '{}')) THEN CONTINUE; END IF;
        IF origin !~ '^https://[^/]+$'
           OR left(photo, length(origin || '/storage/v1/object/public/tiendas/' || auth.uid()::text || '/'))
              <> origin || '/storage/v1/object/public/tiendas/' || auth.uid()::text || '/' THEN
            RAISE EXCEPTION 'Las fotos de la promoción deben subirse desde la aplicación';
        END IF;
    END LOOP;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.validate_promotion_photos() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS validate_promotion_photos ON public.promociones;
CREATE TRIGGER validate_promotion_photos BEFORE INSERT OR UPDATE OF fotografias ON public.promociones
    FOR EACH ROW EXECUTE FUNCTION public.validate_promotion_photos();

-- ---------------------------------------------------------------------------
-- 6. E38: las solicitudes de clientes desactivados dejan de estar disponibles para las tiendas.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sprint2_store_can_view_request(p_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT public.sprint1_role()='tienda' AND EXISTS(SELECT 1 FROM public.solicitudes s
        JOIN public.usuarios cu ON cu.id=s.usuario_id AND cu.activo
        JOIN public.tienda_categorias tc ON tc.categoria_id=s.categoria_id
        JOIN public.tiendas t ON t.id=tc.tienda_id AND t.usuario_id=auth.uid()
        JOIN public.categorias_repuesto c ON c.id=s.categoria_id AND c.activo
        WHERE s.id=p_request_id AND s.estado IN ('publicada','recibiendo_propuestas') AND public.store_is_eligible(t.id))
$$;

-- A store keeps reading the requests it already quoted (history); new ones need an active customer.
CREATE OR REPLACE FUNCTION public.store_can_read_request(p_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT public.sprint1_role()='tienda' AND EXISTS (
        SELECT 1 FROM public.solicitudes s
        JOIN public.tiendas t ON t.usuario_id=auth.uid()
        WHERE s.id=p_request_id AND (
            (public.store_is_eligible(t.id) AND s.estado IN ('publicada','recibiendo_propuestas')
                AND EXISTS (SELECT 1 FROM public.usuarios cu WHERE cu.id=s.usuario_id AND cu.activo)
                AND EXISTS (SELECT 1 FROM public.tienda_categorias tc
                    WHERE tc.tienda_id=t.id AND tc.categoria_id=s.categoria_id))
            OR EXISTS (SELECT 1 FROM public.propuestas p
                WHERE p.solicitud_id=s.id AND p.tienda_id=t.id)))
$$;

-- ---------------------------------------------------------------------------
-- 7. E37 + E13: búsquedas con % y _ literales, y filtro «Sin responder» en el servidor.
--    LIKE usa la barra invertida como escape por defecto.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.request_page(boolean, text, text, uuid, date, date, integer, integer);
CREATE OR REPLACE FUNCTION public.request_page(p_available boolean DEFAULT false, p_search text DEFAULT NULL::text, p_state text DEFAULT NULL::text, p_category uuid DEFAULT NULL::uuid, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_offset integer DEFAULT 0, p_limit integer DEFAULT 26, p_unanswered boolean DEFAULT false)
RETURNS SETOF public.solicitudes LANGUAGE plpgsql STABLE SET search_path = '' AS $$
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
        AND (nullif(btrim(p_search),'') IS NULL OR concat_ws(' ',s.titulo,s.descripcion,c.nombre,ma.nombre,mo.nombre,v.anio::text)
            ILIKE '%'||replace(replace(replace(p_search,'\','\\'),'%','\%'),'_','\_')||'%')
        AND (NOT coalesce(p_unanswered,false) OR NOT p_available OR NOT EXISTS (
            SELECT 1 FROM public.propuestas p WHERE p.solicitud_id=s.id AND p.tienda_id=public.get_my_store_id()))
    ORDER BY s.fecha_creacion DESC,s.id LIMIT p_limit OFFSET p_offset;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.request_page(boolean, text, text, uuid, date, date, integer, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_page(boolean, text, text, uuid, date, date, integer, integer, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.promotion_page(p_owner boolean DEFAULT false, p_search text DEFAULT NULL::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 26)
RETURNS SETOF public.promociones LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
    IF NOT public.account_is_active() OR (p_owner AND public.sprint1_role() IS DISTINCT FROM 'tienda') THEN RAISE EXCEPTION 'Cuenta no disponible'; END IF;
    IF p_owner IS NULL OR p_offset IS NULL OR p_offset<0 OR p_limit IS NULL OR p_limit<1 OR p_limit>26 OR length(p_search)>160 THEN RAISE EXCEPTION 'Filtros no válidos'; END IF;
    RETURN QUERY SELECT p.* FROM public.promociones p LEFT JOIN public.categorias_repuesto c ON c.id=p.categoria_id
    WHERE CASE WHEN p_owner THEN p.tienda_id=public.get_my_store_id()
        ELSE p.estado='activa' AND p.fecha_inicio<=now() AND p.fecha_fin>now() AND public.store_is_eligible(p.tienda_id) END
        AND (nullif(btrim(p_search),'') IS NULL OR concat_ws(' ',p.titulo,p.descripcion,p.marca,c.nombre)
            ILIKE '%'||replace(replace(replace(p_search,'\','\\'),'%','\%'),'_','\_')||'%')
    ORDER BY p.fecha_creacion DESC,p.id LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Same escaping for the administrative searches (bodies otherwise unchanged).
CREATE OR REPLACE FUNCTION public.admin_user_page(p_search text DEFAULT NULL::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 26)
 RETURNS TABLE(id uuid, nombre text, apellido text, telefono text, correo text, rol text, activo boolean, fecha_creacion timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Se requiere rol administrador'; END IF;
    IF p_offset IS NULL OR p_offset<0 OR p_limit IS NULL OR p_limit<1 OR p_limit>26 OR length(p_search)>160 THEN RAISE EXCEPTION 'Filtros no válidos'; END IF;
    RETURN QUERY SELECT u.id,u.nombre,u.apellido,u.telefono,a.email::text,u.rol::text,u.activo,u.fecha_creacion
    FROM public.usuarios u JOIN auth.users a ON a.id=u.id
    WHERE nullif(btrim(p_search),'') IS NULL OR concat_ws(' ',u.nombre,u.apellido,u.telefono,a.email,u.rol::text,u.id::text) ILIKE '%'||replace(replace(replace(p_search,'\','\\'),'%','\%'),'_','\_')||'%'
    ORDER BY u.fecha_creacion DESC,u.id LIMIT p_limit OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.sprint3_admin_list_requests(p_status text DEFAULT NULL::text, p_category_id uuid DEFAULT NULL::uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_search text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, usuario_id uuid, cliente_nombre text, cliente_correo text, vehiculo_id uuid, vehiculo_tipo text, vehiculo_marca text, vehiculo_modelo text, vehiculo_anio integer, vehiculo_descripcion text, categoria_id uuid, categoria_nombre text, titulo text, descripcion text, caracteristicas text, cantidad integer, fotografias text[], estado text, fecha_creacion timestamp with time zone, fecha_actualizacion timestamp with time zone, propuesta_seleccionada_id uuid, total_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
DECLARE
    v_status text := NULLIF(btrim(p_status), '');
    v_search text := NULLIF(btrim(p_search), '');
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Se requiere rol administrador';
    END IF;
    IF v_status IS NOT NULL AND v_status NOT IN (
        'publicada', 'recibiendo_propuestas', 'propuesta_seleccionada', 'atendida', 'cerrada'
    ) THEN
        RAISE EXCEPTION 'Estado de solicitud no válido';
    END IF;
    IF p_date_from IS NOT NULL AND p_date_to IS NOT NULL AND p_date_from > p_date_to THEN
        RAISE EXCEPTION 'La fecha inicial no puede ser posterior a la fecha final';
    END IF;
    IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 OR p_offset IS NULL OR p_offset < 0 THEN
        RAISE EXCEPTION 'Parámetros de paginación no válidos';
    END IF;

    RETURN QUERY
    SELECT
        s.id,
        s.usuario_id,
        concat_ws(' ', u.nombre, u.apellido),
        a.email::text,
        v.id,
        vt.nombre,
        brand.nombre,
        model.nombre,
        v.anio,
        v.descripcion,
        c.id,
        c.nombre,
        s.titulo,
        s.descripcion,
        s.caracteristicas,
        s.cantidad,
        s.fotografias,
        s.estado::text,
        s.fecha_creacion,
        s.fecha_actualizacion,
        s.propuesta_seleccionada_id,
        count(*) OVER ()
    FROM public.solicitudes s
    JOIN public.usuarios u ON u.id = s.usuario_id
    LEFT JOIN auth.users a ON a.id = s.usuario_id
    LEFT JOIN public.vehiculos v ON v.id = s.vehiculo_id
    LEFT JOIN public.tipos_vehiculo vt ON vt.id = v.tipo_vehiculo_id
    LEFT JOIN public.marcas brand ON brand.id = v.marca_id
    LEFT JOIN public.modelos model ON model.id = v.modelo_id
    LEFT JOIN public.categorias_repuesto c ON c.id = s.categoria_id
    WHERE (v_status IS NULL OR s.estado::text = v_status)
      AND (p_category_id IS NULL OR s.categoria_id = p_category_id)
      AND (p_date_from IS NULL OR s.fecha_creacion >= (p_date_from::timestamp AT TIME ZONE 'America/La_Paz'))
      AND (p_date_to IS NULL OR s.fecha_creacion < ((p_date_to + 1)::timestamp AT TIME ZONE 'America/La_Paz'))
      AND (v_search IS NULL OR s.titulo ILIKE '%' || replace(replace(replace(v_search,'\','\\'),'%','\%'),'_','\_') || '%')
    ORDER BY s.fecha_creacion DESC, s.id
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.sprint3_admin_list_promotions(p_store_id uuid DEFAULT NULL::uuid, p_category_id uuid DEFAULT NULL::uuid, p_status promotion_status DEFAULT NULL::promotion_status, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_search text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, tienda_id uuid, tienda_nombre text, categoria_id uuid, categoria_nombre text, titulo text, descripcion text, marca text, precio_anterior numeric, precio_oferta numeric, porcentaje_descuento numeric, caracteristicas text, fecha_inicio timestamp with time zone, fecha_fin timestamp with time zone, fotografias text[], estado text, fecha_creacion timestamp with time zone, fecha_actualizacion timestamp with time zone, total_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
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
      AND (p_date_from IS NULL OR p.fecha_inicio >= (p_date_from::timestamp AT TIME ZONE 'America/La_Paz'))
      AND (p_date_to IS NULL OR p.fecha_inicio < ((p_date_to + 1)::timestamp AT TIME ZONE 'America/La_Paz'))
      AND (v_search IS NULL OR p.titulo ILIKE '%' || replace(replace(replace(v_search,'\','\\'),'%','\%'),'_','\_') || '%')
    ORDER BY p.fecha_creacion DESC, p.id
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- PostgREST picks up the new request_page signature and RPCs without waiting.
NOTIFY pgrst, 'reload schema';

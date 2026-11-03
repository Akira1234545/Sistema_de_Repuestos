-- Apply after ALL previous migrations, including sprint1a_helpers on fresh installs.
-- Preserves existing rows, including historical reviews. New reviews require attention.
BEGIN;
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;

-- Restrictive policies also constrain any permissive legacy owner policy.
CREATE OR REPLACE FUNCTION public.account_is_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo)
$$;
REVOKE ALL ON FUNCTION public.account_is_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_is_active() TO authenticated;
DO $$
DECLARE tab text;
BEGIN
    FOREACH tab IN ARRAY ARRAY['usuarios','vehiculos','solicitudes','tiendas','propuestas',
        'promociones','resenas','notificaciones','favoritos_tienda','favoritos_solicitud',
        'favoritos_promocion','historial_solicitudes','tienda_categorias'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS active_account_required ON public.%I', tab);
        EXECUTE format('CREATE POLICY active_account_required ON public.%I AS RESTRICTIVE
            FOR ALL TO authenticated USING (public.account_is_active())
            WITH CHECK (public.account_is_active())', tab);
    END LOOP;
END;
$$;

-- Unused complaints are closed to browser roles until their workflow is implemented.
ALTER TABLE public.reportes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reportes FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.store_is_eligible(p_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (SELECT 1 FROM public.tiendas t JOIN public.usuarios u ON u.id=t.usuario_id
        WHERE t.id=p_store_id AND t.activa AND t.estado='aprobada' AND u.activo AND u.rol::text='tienda')
$$;
REVOKE ALL ON FUNCTION public.store_is_eligible(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.store_is_eligible(uuid) TO authenticated;

CREATE OR REPLACE VIEW public.sprint2_tiendas_publicas
WITH (security_barrier=true, security_invoker=false) AS
SELECT t.id,t.nombre,t.descripcion,t.horario,t.fotografias,t.telefono
FROM public.tiendas t JOIN public.usuarios u ON u.id=t.usuario_id
WHERE t.activa AND t.estado='aprobada' AND u.activo AND u.rol::text='tienda';

CREATE OR REPLACE FUNCTION public.store_can_read_request(p_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT public.sprint1_role()='tienda' AND EXISTS (
        SELECT 1 FROM public.solicitudes s
        JOIN public.tiendas t ON t.usuario_id=auth.uid()
        WHERE s.id=p_request_id AND (
            (public.store_is_eligible(t.id) AND s.estado IN ('publicada','recibiendo_propuestas')
                AND EXISTS (SELECT 1 FROM public.tienda_categorias tc
                    WHERE tc.tienda_id=t.id AND tc.categoria_id=s.categoria_id))
            OR EXISTS (SELECT 1 FROM public.propuestas p
                WHERE p.solicitud_id=s.id AND p.tienda_id=t.id)))
$$;
CREATE OR REPLACE FUNCTION public.store_can_read_vehicle(p_vehicle_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (SELECT 1 FROM public.solicitudes s
        WHERE s.vehiculo_id=p_vehicle_id AND public.store_can_read_request(s.id))
$$;
REVOKE ALL ON FUNCTION public.store_can_read_request(uuid),public.store_can_read_vehicle(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.store_can_read_request(uuid),public.store_can_read_vehicle(uuid) TO authenticated;
DROP POLICY IF EXISTS sprint1_requests_read_owner_or_store ON public.solicitudes;
CREATE POLICY sprint1_requests_read_owner_or_store ON public.solicitudes FOR SELECT TO authenticated
USING (usuario_id=auth.uid() OR public.store_can_read_request(id));
DROP POLICY IF EXISTS sprint1_vehicles_read ON public.vehiculos;
CREATE POLICY sprint1_vehicles_read ON public.vehiculos FOR SELECT TO authenticated
USING (usuario_id=auth.uid() OR public.store_can_read_vehicle(id));

DROP POLICY IF EXISTS sprint2_promotions_read_available_or_owner ON public.promociones;
CREATE POLICY sprint2_promotions_read_available_or_owner ON public.promociones FOR SELECT TO authenticated
USING ((estado='activa' AND fecha_inicio<=now() AND fecha_fin>now() AND public.store_is_eligible(tienda_id))
    OR (public.sprint1_role()='tienda' AND tienda_id=public.get_my_store_id()));
DROP POLICY IF EXISTS sprint2_promotions_update_owner ON public.promociones;
CREATE POLICY sprint2_promotions_update_owner ON public.promociones FOR UPDATE TO authenticated
USING (public.sprint1_role()='tienda' AND tienda_id=public.get_my_store_id() AND public.store_is_eligible(tienda_id))
WITH CHECK (public.sprint1_role()='tienda' AND tienda_id=public.get_my_store_id() AND public.store_is_eligible(tienda_id)
    AND EXISTS (SELECT 1 FROM public.categorias_repuesto c WHERE c.id=categoria_id AND c.activo));

-- Keep the proven transactional implementation private, and add eligibility locks.
DO $$
BEGIN
    IF to_regprocedure('app_private.sprint2_crear_propuesta(uuid,numeric,text,text,text,text,text)') IS NULL THEN
        ALTER FUNCTION public.sprint2_crear_propuesta(uuid,numeric,text,text,text,text,text) SET SCHEMA app_private;
        ALTER FUNCTION public.sprint2_seleccionar_propuesta(uuid,uuid) SET SCHEMA app_private;
    END IF;
END;
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.sprint2_crear_propuesta(p_solicitud_id uuid,p_precio numeric,
    p_marca text,p_disponibilidad text,p_caracteristicas text DEFAULT NULL,
    p_garantia text DEFAULT NULL,p_observaciones text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_store uuid;
BEGIN
    IF public.sprint1_role() IS DISTINCT FROM 'tienda' THEN RAISE EXCEPTION 'Se requiere una cuenta tienda activa'; END IF;
    IF p_precio IS NULL OR p_precio::text IN ('NaN','Infinity','-Infinity') OR p_precio<0 OR p_precio>99999999.99 THEN
        RAISE EXCEPTION 'Indica un precio total válido';
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
CREATE OR REPLACE FUNCTION public.sprint2_seleccionar_propuesta(p_solicitud_id uuid,p_propuesta_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_store uuid;
BEGIN
    IF public.sprint1_role() IS DISTINCT FROM 'cliente' THEN RAISE EXCEPTION 'Se requiere una cuenta cliente activa'; END IF;
    PERFORM 1 FROM public.solicitudes WHERE id=p_solicitud_id AND usuario_id=auth.uid() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no disponible'; END IF;
    PERFORM 1 FROM public.usuarios WHERE id=auth.uid() AND activo AND rol::text='cliente' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta no disponible'; END IF;
    SELECT t.id INTO v_store FROM public.tiendas t JOIN public.propuestas p ON p.tienda_id=t.id
        WHERE p.id=p_propuesta_id AND p.solicitud_id=p_solicitud_id AND t.activa AND t.estado='aprobada'
        FOR SHARE OF t;
    IF NOT FOUND THEN RAISE EXCEPTION 'La tienda ya no está disponible'; END IF;
    PERFORM 1 FROM public.usuarios u JOIN public.tiendas t ON t.usuario_id=u.id
        WHERE t.id=v_store AND u.activo AND u.rol::text='tienda' FOR SHARE OF u;
    IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta de la tienda no está disponible'; END IF;
    RETURN app_private.sprint2_seleccionar_propuesta(p_solicitud_id,p_propuesta_id);
END;
$$;
REVOKE ALL ON FUNCTION public.sprint2_crear_propuesta(uuid,numeric,text,text,text,text,text),public.sprint2_seleccionar_propuesta(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sprint2_crear_propuesta(uuid,numeric,text,text,text,text,text),public.sprint2_seleccionar_propuesta(uuid,uuid) TO authenticated;

-- Complete a selected request only as its active customer, serialized with selection.
CREATE OR REPLACE FUNCTION public.confirmar_atencion(p_solicitud_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_state public.request_status;
BEGIN
    IF public.sprint1_role() IS DISTINCT FROM 'cliente' THEN RAISE EXCEPTION 'Se requiere una cuenta cliente activa'; END IF;
    SELECT estado INTO v_state FROM public.solicitudes WHERE id=p_solicitud_id AND usuario_id=auth.uid() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no disponible'; END IF;
    IF v_state='atendida' THEN RETURN; END IF;
    IF v_state<>'propuesta_seleccionada' THEN RAISE EXCEPTION 'Selecciona una propuesta antes de confirmar la atención'; END IF;
    PERFORM set_config('app.confirming_attention','yes',true);
    UPDATE public.solicitudes SET estado='atendida' WHERE id=p_solicitud_id;
    PERFORM set_config('app.confirming_attention','',true);
END;
$$;
REVOKE ALL ON FUNCTION public.confirmar_atencion(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirmar_atencion(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sprint1_guard_request_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_transition text := current_setting('app.sprint2_request_transition', TRUE);
BEGIN
    NEW.fecha_actualizacion := NOW();
    IF (SELECT auth.uid()) IS NULL THEN RETURN NEW; END IF;
    IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN RETURN NEW; END IF;
    IF current_setting('app.confirming_attention',true)='yes'
       AND OLD.usuario_id=auth.uid() AND public.sprint1_role()='cliente'
       AND OLD.estado='propuesta_seleccionada' AND NEW.estado='atendida' THEN RETURN NEW; END IF;

    IF OLD.usuario_id = (SELECT auth.uid()) AND public.sprint1_role() = 'cliente'
       AND OLD.estado IN ('publicada'::public.request_status, 'recibiendo_propuestas'::public.request_status)
       AND NEW.estado = 'cerrada'::public.request_status THEN
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
    RAISE EXCEPTION 'Transición de estado no permitida';
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_quoted_requirements()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
    IF auth.uid() IS NULL THEN RETURN NEW; END IF;
    IF (NEW.vehiculo_id,NEW.categoria_id,NEW.cantidad,NEW.titulo,NEW.descripcion,NEW.caracteristicas)
        IS DISTINCT FROM (OLD.vehiculo_id,OLD.categoria_id,OLD.cantidad,OLD.titulo,OLD.descripcion,OLD.caracteristicas)
        AND EXISTS(SELECT 1 FROM public.propuestas WHERE solicitud_id=OLD.id) THEN
        RAISE EXCEPTION 'Esta solicitud ya recibió propuestas. Crea otra solicitud para cambiar sus requisitos';
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_quoted_requirements ON public.solicitudes;
CREATE TRIGGER guard_quoted_requirements BEFORE UPDATE ON public.solicitudes FOR EACH ROW EXECUTE FUNCTION public.guard_quoted_requirements();

CREATE OR REPLACE FUNCTION public.guard_vehicle_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
    IF auth.uid() IS NULL THEN RETURN NEW; END IF;
    IF (NEW.tipo_vehiculo_id,NEW.marca_id,NEW.modelo_id,NEW.anio,NEW.descripcion) IS DISTINCT FROM
        (OLD.tipo_vehiculo_id,OLD.marca_id,OLD.modelo_id,OLD.anio,OLD.descripcion)
        AND EXISTS (SELECT 1 FROM public.solicitudes WHERE vehiculo_id=OLD.id) THEN
        RAISE EXCEPTION 'Este vehículo tiene solicitudes. Registra otro vehículo para conservar el historial';
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_vehicle_history ON public.vehiculos;
CREATE TRIGGER guard_vehicle_history BEFORE UPDATE ON public.vehiculos FOR EACH ROW EXECUTE FUNCTION public.guard_vehicle_history();

-- A narrow public projection replaces anonymous SELECT on the private table.
CREATE OR REPLACE VIEW public.resenas_publicas WITH(security_barrier=true,security_invoker=false) AS
SELECT r.id,r.tienda_id,r.calificacion,r.comentario,r.fecha_creacion FROM public.resenas r
JOIN public.sprint2_tiendas_publicas t ON t.id=r.tienda_id;
REVOKE ALL ON public.resenas_publicas FROM PUBLIC;
GRANT SELECT ON public.resenas_publicas TO anon,authenticated;
REVOKE SELECT ON public.resenas FROM anon;
DROP POLICY IF EXISTS resenas_read_customer_or_admin ON public.resenas;
CREATE POLICY resenas_read_customer_or_admin ON public.resenas FOR SELECT TO authenticated
USING(usuario_id=auth.uid() OR public.is_admin());
CREATE OR REPLACE FUNCTION public.sprint3_validate_store_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_request_owner uuid;
    v_selected_proposal_id uuid;
    v_request_status public.request_status;
    v_proposal_store_id uuid;
    v_proposal_status public.proposal_status;
BEGIN
    IF (SELECT auth.uid()) IS NULL
       OR NEW.usuario_id IS DISTINCT FROM (SELECT auth.uid())
       OR public.sprint1_role() IS DISTINCT FROM 'cliente' THEN
        RAISE EXCEPTION 'Solo el cliente autenticado puede reseñar su propuesta seleccionada';
    END IF;

    SELECT s.usuario_id, s.propuesta_seleccionada_id, s.estado, p.tienda_id, p.estado
    INTO v_request_owner, v_selected_proposal_id, v_request_status, v_proposal_store_id, v_proposal_status
    FROM public.propuestas p
    JOIN public.solicitudes s ON s.id = p.solicitud_id
    WHERE p.id = NEW.propuesta_id;

    IF NOT FOUND
       OR v_request_owner IS DISTINCT FROM NEW.usuario_id
       OR v_selected_proposal_id IS DISTINCT FROM NEW.propuesta_id
       OR v_request_status IS DISTINCT FROM 'atendida'::public.request_status
       OR v_proposal_store_id IS DISTINCT FROM NEW.tienda_id
       OR v_proposal_status IS DISTINCT FROM 'aceptada'::public.proposal_status THEN
        RAISE EXCEPTION 'Solo puedes reseñar la tienda de una propuesta seleccionada en tu solicitud';
    END IF;

    RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS sprint4_store_images_select_own ON storage.objects;
CREATE POLICY sprint4_store_images_select_own ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='tiendas' AND (storage.foldername(name))[1]=auth.uid()::text AND public.sprint1_role()='tienda');

CREATE INDEX IF NOT EXISTS solicitudes_usuario_fecha_idx ON public.solicitudes(usuario_id,fecha_creacion DESC,id);
CREATE INDEX IF NOT EXISTS solicitudes_categoria_estado_idx ON public.solicitudes(categoria_id,estado,fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS solicitudes_vehiculo_idx ON public.solicitudes(vehiculo_id);
CREATE INDEX IF NOT EXISTS vehiculos_usuario_idx ON public.vehiculos(usuario_id,fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS propuestas_tienda_idx ON public.propuestas(tienda_id,fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS promociones_tienda_idx ON public.promociones(tienda_id,fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS resenas_tienda_fecha_idx ON public.resenas(tienda_id,fecha_creacion DESC,id);
CREATE INDEX IF NOT EXISTS notificaciones_usuario_fecha_idx ON public.notificaciones(usuario_id,fecha_creacion DESC,id);
CREATE INDEX IF NOT EXISTS notificaciones_no_leidas_idx ON public.notificaciones(usuario_id) WHERE NOT leida;
CREATE INDEX IF NOT EXISTS tienda_categorias_categoria_idx ON public.tienda_categorias(categoria_id,tienda_id);
COMMIT;

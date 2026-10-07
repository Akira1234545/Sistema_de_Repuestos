-- Sprint 2 incremental migration. Apply after the Sprint 1 schema and RLS migrations.
-- No existing tables or records are dropped.
BEGIN;

-- Inspect helper signatures and administrative policies before changes.
-- All non-administrative policies on Sprint 2 tables are reconciled below.
-- Admin rules are preserved only when their authenticated role and exact
-- is_admin() predicate pass the read-only checks below. Permissive policies OR.
DO $$
DECLARE
    bad_helpers text;
    unsafe_admin_policies text;
BEGIN
    SELECT string_agg(format('%s: %s', e.name, coalesce(pg_get_function_result(p.oid), '<missing>')), ', ')
      INTO bad_helpers
    FROM (VALUES ('is_admin'), ('get_my_role'), ('get_my_store_id'), ('sprint1_role')) AS e(name)
    LEFT JOIN pg_proc p ON p.pronamespace = 'public'::regnamespace AND p.proname = e.name AND p.pronargs = 0
    WHERE p.oid IS NULL
       OR (e.name = 'is_admin' AND pg_get_function_result(p.oid) <> 'boolean')
       OR (e.name = 'get_my_store_id' AND pg_get_function_result(p.oid) <> 'uuid')
       OR (e.name = 'sprint1_role' AND pg_get_function_result(p.oid) <> 'text')
       OR (e.name = 'get_my_role' AND NOT EXISTS (
            SELECT 1 FROM pg_type t WHERE t.oid = p.prorettype
              AND (t.typname = 'text' OR (t.typtype = 'e' AND t.typname = 'user_role'))
       ));
    IF bad_helpers IS NOT NULL THEN
        RAISE EXCEPTION 'Sprint 2 detenido antes de cambios: firmas de funciones ausentes o incompatibles: %', bad_helpers;
    END IF;
    SELECT string_agg(
        format('%I.%I: %I (roles=%s, command=%s, permissive=%s, using=%s, check=%s)',
            schemaname, tablename, policyname, roles, cmd, permissive,
            coalesce(qual, '<none>'), coalesce(with_check, '<none>')),
        E'\n'
    ) INTO unsafe_admin_policies
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        policyname ILIKE '%admin%'
        OR array_to_string(roles, ',') ILIKE '%admin%'
        OR concat_ws(' ', qual, with_check) ~* '(is_admin|admin|administrador|superadministrador)'
      )
      AND NOT (
        roles <@ ARRAY['authenticated']::name[] AND CASE cmd
          WHEN 'SELECT' THEN coalesce(qual, '') ~* '^\s*is_admin\s*\(\s*\)\s*$'
          WHEN 'INSERT' THEN coalesce(with_check, '') ~* '^\s*is_admin\s*\(\s*\)\s*$'
          WHEN 'UPDATE' THEN coalesce(qual, '') ~* '^\s*is_admin\s*\(\s*\)\s*$' AND coalesce(with_check, '') ~* '^\s*is_admin\s*\(\s*\)\s*$'
          WHEN 'DELETE' THEN coalesce(qual, '') ~* '^\s*is_admin\s*\(\s*\)\s*$'
          WHEN 'ALL' THEN coalesce(qual, '') ~* '^\s*is_admin\s*\(\s*\)\s*$' AND coalesce(with_check, '') ~* '^\s*is_admin\s*\(\s*\)\s*$'
          ELSE FALSE END
      );
    IF unsafe_admin_policies IS NOT NULL THEN
        RAISE EXCEPTION 'Sprint 2 detenido antes de cambios: políticas administrativas no verificadas como is_admin() puro para authenticated:%', unsafe_admin_policies;
    END IF;

END;
$$;

-- Reconcile all policies on the tables fully managed by Sprint 2, including
-- legacy read/insert/update/delete rules regardless of their historical name.
-- The preflight above rejects unsafe admin policies; retain only verified
-- authenticated policies whose complete predicate is is_admin().
DO $$
DECLARE p record;
BEGIN
    FOR p IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('tiendas', 'solicitudes', 'propuestas', 'promociones', 'favoritos_tienda', 'favoritos_solicitud', 'favoritos_promocion', 'vehiculos')
          AND NOT (
            roles <@ ARRAY['authenticated']::name[] AND CASE cmd
              WHEN 'SELECT' THEN coalesce(qual, '') ~* '^\s*is_admin\s*\(\s*\)\s*$'
              WHEN 'INSERT' THEN coalesce(with_check, '') ~* '^\s*is_admin\s*\(\s*\)\s*$'
              WHEN 'UPDATE' THEN coalesce(qual, '') ~* '^\s*is_admin\s*\(\s*\)\s*$' AND coalesce(with_check, '') ~* '^\s*is_admin\s*\(\s*\)\s*$'
              WHEN 'DELETE' THEN coalesce(qual, '') ~* '^\s*is_admin\s*\(\s*\)\s*$'
              WHEN 'ALL' THEN coalesce(qual, '') ~* '^\s*is_admin\s*\(\s*\)\s*$' AND coalesce(with_check, '') ~* '^\s*is_admin\s*\(\s*\)\s*$'
              ELSE FALSE END
          )
    LOOP
        EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
        RAISE NOTICE 'Política anterior reemplazada: %.%.%', p.schemaname, p.tablename, p.policyname;
    END LOOP;
END;
$$;

-- Harden existing role helpers after the read-only preflight passes.
CREATE OR REPLACE FUNCTION public.sprint1_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT u.rol::text FROM public.usuarios u
    WHERE u.id = (SELECT auth.uid()) AND u.activo = TRUE
$$;
REVOKE ALL ON FUNCTION public.sprint1_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sprint1_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = (SELECT auth.uid()) AND u.activo = TRUE
          AND u.rol::text IN ('administrador', 'superAdministrador')
    )
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DO $$
DECLARE role_type text;
BEGIN
    SELECT format('%I.%I', n.nspname, t.typname) INTO role_type
    FROM pg_proc p JOIN pg_type t ON t.oid = p.prorettype
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'get_my_role' AND p.pronargs = 0;
    EXECUTE format($ddl$
        CREATE OR REPLACE FUNCTION public.get_my_role()
        RETURNS %s LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
        AS $body$
            SELECT u.rol::text::%s FROM public.usuarios u
            WHERE u.id = (SELECT auth.uid()) AND u.activo = TRUE
        $body$
    $ddl$, role_type, role_type);
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_store_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT t.id FROM public.tiendas t
    JOIN public.usuarios u ON u.id = t.usuario_id
    WHERE u.id = (SELECT auth.uid()) AND u.activo = TRUE
      AND u.rol::text = 'tienda'
$$;
REVOKE ALL ON FUNCTION public.get_my_store_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_store_id() TO authenticated;

-- Explicitly document the previously observed legacy names; the catalog sweep
-- above already removes them along with other non-administrative policies.
DROP POLICY IF EXISTS favoritos_tienda_insert_propios ON public.favoritos_tienda;
DROP POLICY IF EXISTS favoritos_solicitud_insert_propios ON public.favoritos_solicitud;
DROP POLICY IF EXISTS favoritos_promocion_insert_propios ON public.favoritos_promocion;
DROP POLICY IF EXISTS solicitudes_insert_cliente ON public.solicitudes;
DROP POLICY IF EXISTS solicitudes_update_cliente ON public.solicitudes;
DROP POLICY IF EXISTS "Usuarios pueden crear su propia tienda" ON public.tiendas;
DROP POLICY IF EXISTS "Usuarios pueden editar su propia tienda" ON public.tiendas;
-- Compatibility with the mistaken combined policy name from an earlier draft.
DROP POLICY IF EXISTS "Usuarios pueden crear/editar su propia tienda" ON public.tiendas;
DROP POLICY IF EXISTS tiendas_select_publicas ON public.tiendas;
DROP POLICY IF EXISTS promociones_insert_tienda ON public.promociones;
DROP POLICY IF EXISTS sprint2_selected_store_contact ON public.tiendas;

-- Rebuild the canonical Sprint 1 store/request policies as well, so a policy
-- altered under a trusted-looking name cannot survive this reconciliation.
ALTER TABLE public.tiendas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sprint1_stores_read_owner ON public.tiendas;
CREATE POLICY sprint1_stores_read_owner ON public.tiendas
    FOR SELECT TO authenticated USING (usuario_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS sprint1_stores_insert_owner ON public.tiendas;
CREATE POLICY sprint1_stores_insert_owner ON public.tiendas
    FOR INSERT TO authenticated WITH CHECK (
        usuario_id = (SELECT auth.uid()) AND public.sprint1_role() = 'tienda'
    );
DROP POLICY IF EXISTS sprint1_stores_update_owner ON public.tiendas;
CREATE POLICY sprint1_stores_update_owner ON public.tiendas
    FOR UPDATE TO authenticated
    USING (usuario_id = (SELECT auth.uid()) AND public.sprint1_role() = 'tienda')
    WITH CHECK (usuario_id = (SELECT auth.uid()) AND public.sprint1_role() = 'tienda');

-- Stores can read open requests only when their account and shop are active,
-- the shop is approved, and it offers the requested category.
CREATE OR REPLACE FUNCTION public.sprint2_store_can_view_request(p_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT public.sprint1_role() = 'tienda' AND EXISTS (
        SELECT 1
        FROM public.solicitudes s
        JOIN public.tiendas t ON t.usuario_id = (SELECT auth.uid())
        JOIN public.usuarios u ON u.id = t.usuario_id AND u.activo = TRUE
        JOIN public.tienda_categorias tc ON tc.tienda_id = t.id AND tc.categoria_id = s.categoria_id
        WHERE s.id = $1
          AND t.activa = TRUE AND t.estado = 'aprobada'
          AND s.estado IN ('publicada'::public.request_status, 'recibiendo_propuestas'::public.request_status)
    )
$$;
REVOKE ALL ON FUNCTION public.sprint2_store_can_view_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sprint2_store_can_view_request(uuid) TO authenticated;

ALTER TABLE public.solicitudes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sprint1_requests_read_owner_or_store ON public.solicitudes;
CREATE POLICY sprint1_requests_read_owner_or_store ON public.solicitudes
    FOR SELECT TO authenticated USING (
        usuario_id = (SELECT auth.uid())
        OR public.sprint2_store_can_view_request(id)
    );
DROP POLICY IF EXISTS sprint1_requests_insert_owner ON public.solicitudes;
CREATE POLICY sprint1_requests_insert_owner ON public.solicitudes
    FOR INSERT TO authenticated WITH CHECK (
        usuario_id = (SELECT auth.uid()) AND public.sprint1_role() = 'cliente'
        AND EXISTS (SELECT 1 FROM public.vehiculos v
                    WHERE v.id = vehiculo_id AND v.usuario_id = (SELECT auth.uid()))
        AND EXISTS (SELECT 1 FROM public.categorias_repuesto c
                    WHERE c.id = categoria_id AND c.activo = TRUE)
    );
DROP POLICY IF EXISTS sprint1_requests_update_owner ON public.solicitudes;
CREATE POLICY sprint1_requests_update_owner ON public.solicitudes
    FOR UPDATE TO authenticated
    USING (usuario_id = (SELECT auth.uid()) AND public.sprint1_role() = 'cliente'
        AND estado IN ('publicada'::public.request_status, 'recibiendo_propuestas'::public.request_status))
    WITH CHECK (usuario_id = (SELECT auth.uid()) AND public.sprint1_role() = 'cliente'
        AND EXISTS (SELECT 1 FROM public.vehiculos v
                    WHERE v.id = vehiculo_id AND v.usuario_id = (SELECT auth.uid())));



-- Vehicle details follow the same request visibility boundary. Rebuild all
-- vehicle policies so no permissive legacy rule can widen access.
ALTER TABLE public.vehiculos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sprint1_vehicles_read ON public.vehiculos;
CREATE POLICY sprint1_vehicles_read ON public.vehiculos FOR SELECT TO authenticated
    USING (usuario_id = (SELECT auth.uid()) OR EXISTS (
        SELECT 1 FROM public.solicitudes s
        WHERE s.vehiculo_id = id AND public.sprint2_store_can_view_request(s.id)
    ));
DROP POLICY IF EXISTS sprint1_vehicles_insert_owner ON public.vehiculos;
CREATE POLICY sprint1_vehicles_insert_owner ON public.vehiculos FOR INSERT TO authenticated
    WITH CHECK (usuario_id = (SELECT auth.uid()) AND public.sprint1_role() = 'cliente');
DROP POLICY IF EXISTS sprint1_vehicles_update_owner ON public.vehiculos;
CREATE POLICY sprint1_vehicles_update_owner ON public.vehiculos FOR UPDATE TO authenticated
    USING (usuario_id = (SELECT auth.uid()) AND public.sprint1_role() = 'cliente')
    WITH CHECK (usuario_id = (SELECT auth.uid()) AND public.sprint1_role() = 'cliente');

CREATE OR REPLACE FUNCTION public.sprint2_can_view_selected_store(store_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT public.sprint1_role() = 'cliente' AND EXISTS (
        SELECT 1
        FROM public.solicitudes s
        JOIN public.propuestas p ON p.id = s.propuesta_seleccionada_id
        WHERE s.usuario_id = (SELECT auth.uid()) AND p.tienda_id = $1
    )
$$;
REVOKE ALL ON FUNCTION public.sprint2_can_view_selected_store(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sprint2_can_view_selected_store(uuid) TO authenticated;

-- Boolean helpers intentionally return no target data and bypass target-table
-- RLS only to check eligibility. They preserve Sprint 1 visibility rules.
CREATE OR REPLACE FUNCTION public.sprint2_can_favorite_store(p_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT public.sprint1_role() = 'cliente' AND EXISTS (
        SELECT 1 FROM public.tiendas t
        WHERE t.id = p_store_id AND t.activa = TRUE AND t.estado = 'aprobada'
    )
$$;
CREATE OR REPLACE FUNCTION public.sprint2_can_favorite_request(p_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.solicitudes s
        WHERE s.id = p_request_id AND (
            (public.sprint1_role() = 'cliente' AND s.usuario_id = (SELECT auth.uid())) OR
            public.sprint2_store_can_view_request(s.id)
        )
    )
$$;
REVOKE ALL ON FUNCTION public.sprint2_can_favorite_store(uuid), public.sprint2_can_favorite_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sprint2_can_favorite_store(uuid), public.sprint2_can_favorite_request(uuid) TO authenticated;

-- Selected customers get contact/location only; approval and account fields
-- stay private. This owner-rights view has an explicit row predicate.
CREATE OR REPLACE VIEW public.sprint2_tienda_contacto WITH (security_barrier = true, security_invoker = false) AS
SELECT t.id, t.nombre, t.telefono, t.direccion, t.latitud, t.longitud
FROM public.tiendas t
WHERE public.sprint2_can_view_selected_store(t.id);
REVOKE ALL ON public.sprint2_tienda_contacto FROM PUBLIC, anon;
GRANT SELECT ON public.sprint2_tienda_contacto TO authenticated;

-- Approved store profiles remain discoverable, but contact/location is
-- withheld until selection. No account, approval, or moderation fields leave.
CREATE OR REPLACE VIEW public.sprint2_tiendas_publicas WITH (security_barrier = true, security_invoker = false) AS
SELECT t.id, t.nombre, t.descripcion, t.horario, t.fotografias
FROM public.tiendas t
WHERE t.activa = TRUE AND t.estado = 'aprobada';
REVOKE ALL ON public.sprint2_tiendas_publicas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sprint2_tiendas_publicas TO anon, authenticated;


-- Direct tienda SELECT remains governed by Sprint 1's owner-only policy.
-- The selected customer receives only the narrow view, not a new table policy.

-- HU-7 / HU-8: proposals are private to the request owner and the proposing store.
ALTER TABLE public.propuestas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sprint2_proposals_read_owner_or_store ON public.propuestas;
CREATE POLICY sprint2_proposals_read_owner_or_store ON public.propuestas
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.solicitudes s
                WHERE s.id = solicitud_id AND s.usuario_id = (SELECT auth.uid()))
        OR EXISTS (SELECT 1 FROM public.tiendas t
                   WHERE t.id = tienda_id AND t.usuario_id = (SELECT auth.uid()))
    );
REVOKE ALL ON public.propuestas FROM anon, authenticated;
GRANT SELECT ON public.propuestas TO authenticated;

-- A security-definer RPC serializes proposal creation with close/selection by
-- locking the request and performs the request status transition atomically.
CREATE OR REPLACE FUNCTION public.sprint2_crear_propuesta(
    p_solicitud_id uuid,
    p_precio numeric,
    p_marca text,
    p_disponibilidad text,
    p_caracteristicas text DEFAULT NULL,
    p_garantia text DEFAULT NULL,
    p_observaciones text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_tienda_id uuid;
    v_estado public.request_status;
    v_categoria_id uuid;
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
    IF p_precio IS NULL OR p_precio < 0 OR NULLIF(btrim(p_marca), '') IS NULL
       OR NULLIF(btrim(p_disponibilidad), '') IS NULL THEN
        RAISE EXCEPTION 'Indica un precio válido, la marca y la disponibilidad';
    END IF;

    SELECT s.estado, s.categoria_id INTO v_estado, v_categoria_id
    FROM public.solicitudes s
    WHERE s.id = p_solicitud_id
    FOR UPDATE;
    IF NOT FOUND OR v_estado NOT IN ('publicada', 'recibiendo_propuestas') THEN
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
REVOKE ALL ON FUNCTION public.sprint2_crear_propuesta(uuid, numeric, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sprint2_crear_propuesta(uuid, numeric, text, text, text, text, text) TO authenticated;

-- HU-9: selection changes the proposal set and request status in one transaction.
CREATE OR REPLACE FUNCTION public.sprint2_seleccionar_propuesta(p_solicitud_id uuid, p_propuesta_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_estado public.request_status;
BEGIN
    IF public.sprint1_role() <> 'cliente' THEN
        RAISE EXCEPTION 'Solo el cliente propietario puede seleccionar una propuesta';
    END IF;
    SELECT s.estado INTO v_estado
    FROM public.solicitudes s
    WHERE s.id = p_solicitud_id AND s.usuario_id = (SELECT auth.uid())
    FOR UPDATE;
    IF NOT FOUND OR v_estado NOT IN ('publicada', 'recibiendo_propuestas') THEN
        RAISE EXCEPTION 'La solicitud no existe, no te pertenece o ya no está abierta';
    END IF;
    PERFORM 1 FROM public.propuestas p
    WHERE p.id = p_propuesta_id AND p.solicitud_id = p_solicitud_id AND p.estado = 'enviada'
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La propuesta no pertenece a esta solicitud o ya no está disponible';
    END IF;

    UPDATE public.propuestas
    SET estado = CASE WHEN id = p_propuesta_id THEN 'aceptada'::public.proposal_status
                      ELSE 'rechazada'::public.proposal_status END,
        fecha_actualizacion = NOW()
    WHERE solicitud_id = p_solicitud_id AND estado = 'enviada';

    PERFORM set_config('app.sprint2_request_transition', 'selection', TRUE);
    UPDATE public.solicitudes
    SET propuesta_seleccionada_id = p_propuesta_id,
        estado = 'propuesta_seleccionada'
    WHERE id = p_solicitud_id;
    PERFORM set_config('app.sprint2_request_transition', '', TRUE);
    RETURN p_propuesta_id;
END;
$$;
REVOKE ALL ON FUNCTION public.sprint2_seleccionar_propuesta(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sprint2_seleccionar_propuesta(uuid, uuid) TO authenticated;

-- Permit only the two validated state transitions made by the RPCs above,
-- retaining Sprint 1's customer close transition and trusted SQL maintenance.
CREATE OR REPLACE FUNCTION public.sprint1_guard_request_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_transition text := current_setting('app.sprint2_request_transition', TRUE);
BEGIN
    NEW.fecha_actualizacion := NOW();
    IF (SELECT auth.uid()) IS NULL THEN RETURN NEW; END IF;
    IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN RETURN NEW; END IF;

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

-- HU-10: expose contact/location only after this user selected a store proposal.

-- HU-11: promotions are visible while active and inside their date window;
-- owners can always read/manage their own rows.
ALTER TABLE public.promociones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sprint2_promotions_read_available_or_owner ON public.promociones;
CREATE POLICY sprint2_promotions_read_available_or_owner ON public.promociones
    FOR SELECT TO authenticated USING (
        (estado = 'activa' AND fecha_inicio <= NOW() AND fecha_fin > NOW())
        OR (public.sprint1_role() = 'tienda' AND EXISTS (
            SELECT 1 FROM public.tiendas t WHERE t.id = tienda_id AND t.usuario_id = (SELECT auth.uid())
        ))
    );
DROP POLICY IF EXISTS sprint2_promotions_insert_owner ON public.promociones;
CREATE POLICY sprint2_promotions_insert_owner ON public.promociones
    FOR INSERT TO authenticated WITH CHECK (
        public.sprint1_role() = 'tienda' AND EXISTS (
            SELECT 1 FROM public.tiendas t WHERE t.id = tienda_id
              AND t.usuario_id = (SELECT auth.uid()) AND t.activa = TRUE AND t.estado = 'aprobada'
        ) AND EXISTS (SELECT 1 FROM public.categorias_repuesto c WHERE c.id = categoria_id AND c.activo = TRUE)
    );
DROP POLICY IF EXISTS sprint2_promotions_update_owner ON public.promociones;
CREATE POLICY sprint2_promotions_update_owner ON public.promociones
    FOR UPDATE TO authenticated USING (
        public.sprint1_role() = 'tienda' AND EXISTS (
            SELECT 1 FROM public.tiendas t WHERE t.id = tienda_id AND t.usuario_id = (SELECT auth.uid())
        )
    ) WITH CHECK (
        public.sprint1_role() = 'tienda' AND EXISTS (
            SELECT 1 FROM public.tiendas t WHERE t.id = tienda_id AND t.usuario_id = (SELECT auth.uid())
        )
    );

CREATE OR REPLACE FUNCTION public.sprint2_validate_promotion()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
    IF NULLIF(btrim(NEW.titulo), '') IS NULL OR NEW.precio_anterior < 0
       OR NEW.precio_oferta < 0 OR NEW.precio_oferta > NEW.precio_anterior
       OR NEW.fecha_fin <= NEW.fecha_inicio THEN
        RAISE EXCEPTION 'Revisa título, precios y fechas de la promoción';
    END IF;
    NEW.porcentaje_descuento := CASE WHEN NEW.precio_anterior = 0 THEN 0
        ELSE round(((NEW.precio_anterior - NEW.precio_oferta) / NEW.precio_anterior) * 100, 2) END;
    NEW.fecha_actualizacion := NOW();
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sprint2_validate_promotion ON public.promociones;
CREATE TRIGGER sprint2_validate_promotion BEFORE INSERT OR UPDATE ON public.promociones
    FOR EACH ROW EXECUTE FUNCTION public.sprint2_validate_promotion();

REVOKE ALL ON public.promociones FROM anon, authenticated;
GRANT SELECT ON public.promociones TO authenticated;
GRANT INSERT (tienda_id, categoria_id, titulo, descripcion, marca, precio_anterior,
    precio_oferta, caracteristicas, fecha_inicio, fecha_fin, fotografias) ON public.promociones TO authenticated;
GRANT UPDATE (categoria_id, titulo, descripcion, marca, precio_anterior, precio_oferta,
    caracteristicas, fecha_inicio, fecha_fin, fotografias, estado) ON public.promociones TO authenticated;

-- HU-12: favorite tables already have unique(user_id, item_id); RLS and grants
-- make them private and allow only insert/delete for the signed-in user.
ALTER TABLE public.favoritos_tienda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favoritos_solicitud ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favoritos_promocion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sprint2_fav_store_owner ON public.favoritos_tienda;
CREATE POLICY sprint2_fav_store_owner ON public.favoritos_tienda FOR SELECT TO authenticated
    USING (usuario_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS sprint2_fav_store_add ON public.favoritos_tienda;
CREATE POLICY sprint2_fav_store_add ON public.favoritos_tienda FOR INSERT TO authenticated
    WITH CHECK (usuario_id = (SELECT auth.uid()) AND public.sprint1_role() IN ('cliente', 'tienda')
        AND public.sprint2_can_favorite_store(tienda_id));
DROP POLICY IF EXISTS sprint2_fav_store_remove ON public.favoritos_tienda;
CREATE POLICY sprint2_fav_store_remove ON public.favoritos_tienda FOR DELETE TO authenticated
    USING (usuario_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS sprint2_fav_request_owner ON public.favoritos_solicitud;
CREATE POLICY sprint2_fav_request_owner ON public.favoritos_solicitud FOR SELECT TO authenticated
    USING (usuario_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS sprint2_fav_request_add ON public.favoritos_solicitud;
CREATE POLICY sprint2_fav_request_add ON public.favoritos_solicitud FOR INSERT TO authenticated
    WITH CHECK (usuario_id = (SELECT auth.uid()) AND public.sprint1_role() IN ('cliente', 'tienda')
        AND public.sprint2_can_favorite_request(solicitud_id));
DROP POLICY IF EXISTS sprint2_fav_request_remove ON public.favoritos_solicitud;
CREATE POLICY sprint2_fav_request_remove ON public.favoritos_solicitud FOR DELETE TO authenticated
    USING (usuario_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS sprint2_fav_promotion_owner ON public.favoritos_promocion;
CREATE POLICY sprint2_fav_promotion_owner ON public.favoritos_promocion FOR SELECT TO authenticated
    USING (usuario_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS sprint2_fav_promotion_add ON public.favoritos_promocion;
CREATE POLICY sprint2_fav_promotion_add ON public.favoritos_promocion FOR INSERT TO authenticated
    WITH CHECK (usuario_id = (SELECT auth.uid()) AND public.sprint1_role() IN ('cliente', 'tienda')
        AND EXISTS (SELECT 1 FROM public.promociones p WHERE p.id = promocion_id));
DROP POLICY IF EXISTS sprint2_fav_promotion_remove ON public.favoritos_promocion;
CREATE POLICY sprint2_fav_promotion_remove ON public.favoritos_promocion FOR DELETE TO authenticated
    USING (usuario_id = (SELECT auth.uid()));

REVOKE ALL ON public.favoritos_tienda,
    public.favoritos_solicitud, public.favoritos_promocion FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.favoritos_tienda,
    public.favoritos_solicitud, public.favoritos_promocion TO authenticated;

COMMIT;

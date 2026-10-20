-- Incremental hardening for Sprint 1/2. Apply after 20261006_sprint2.sql.
-- Breaks the solicitudes -> vehiculos -> solicitudes RLS dependency by
-- checking ownership through a narrowly scoped SECURITY DEFINER predicate.
BEGIN;
CREATE OR REPLACE FUNCTION public.sprint1_owns_vehicle(p_vehicle_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.vehiculos v
        WHERE v.id = p_vehicle_id AND v.usuario_id = (SELECT auth.uid())
    )
$$;
REVOKE ALL ON FUNCTION public.sprint1_owns_vehicle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sprint1_owns_vehicle(uuid) TO authenticated;

DROP POLICY IF EXISTS sprint1_requests_insert_owner ON public.solicitudes;
CREATE POLICY sprint1_requests_insert_owner ON public.solicitudes
    FOR INSERT TO authenticated WITH CHECK (
        usuario_id = (SELECT auth.uid())
        AND public.sprint1_role() = 'cliente'
        AND public.sprint1_owns_vehicle(vehiculo_id)
        AND EXISTS (SELECT 1 FROM public.categorias_repuesto c
                    WHERE c.id = categoria_id AND c.activo = TRUE)
    );

DROP POLICY IF EXISTS sprint1_requests_update_owner ON public.solicitudes;
CREATE POLICY sprint1_requests_update_owner ON public.solicitudes
    FOR UPDATE TO authenticated
    USING (usuario_id = (SELECT auth.uid()) AND public.sprint1_role() = 'cliente'
        AND estado IN ('publicada'::public.request_status, 'recibiendo_propuestas'::public.request_status))
    WITH CHECK (usuario_id = (SELECT auth.uid()) AND public.sprint1_role() = 'cliente'
        AND public.sprint1_owns_vehicle(vehiculo_id)
        AND EXISTS (SELECT 1 FROM public.categorias_repuesto c
                    WHERE c.id = categoria_id AND c.activo = TRUE));

-- Store review is available to both administrator roles only. Store owners
-- cannot write estado or activa through the existing column grants.
DROP POLICY IF EXISTS sprint1_admin_stores_read ON public.tiendas;
CREATE POLICY sprint1_admin_stores_read ON public.tiendas
    FOR SELECT TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.sprint1_admin_review_store(
    p_store_id uuid,
    p_action text,
    p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_status public.store_status;
    v_active boolean;
    v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Se requiere rol administrador';
    END IF;
    IF p_action IS NULL OR p_action NOT IN ('aprobar', 'rechazar', 'suspender') THEN
        RAISE EXCEPTION 'Acción administrativa no válida';
    END IF;
    IF length(v_reason) > 500 THEN RAISE EXCEPTION 'El motivo no puede superar 500 caracteres'; END IF;
    IF p_action IN ('rechazar', 'suspender') AND v_reason IS NULL THEN
        RAISE EXCEPTION 'Indica el motivo de rechazo o suspensión';
    END IF;
    v_status := CASE p_action
        WHEN 'aprobar' THEN 'aprobada'::public.store_status
        WHEN 'rechazar' THEN 'rechazada'::public.store_status
        ELSE 'suspendida'::public.store_status END;
    v_active := p_action = 'aprobar';

    UPDATE public.tiendas
       SET estado = v_status, activa = v_active, motivo_estado = v_reason
     WHERE id = p_store_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró la tienda'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.sprint1_admin_review_store(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sprint1_admin_review_store(uuid, text, text) TO authenticated;

-- Verification (read-only):
-- SELECT proname, prosecdef, proconfig FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
--   AND proname IN ('sprint1_owns_vehicle', 'sprint1_admin_review_store');
-- SELECT policyname, roles, cmd, qual, with_check FROM pg_policies
-- WHERE schemaname='public' AND tablename IN ('solicitudes','tiendas');
COMMIT;

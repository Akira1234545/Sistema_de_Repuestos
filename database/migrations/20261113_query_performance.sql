-- Query performance: one permissive SELECT policy per table instead of an admin policy
-- plus an owner policy (Postgres evaluates every permissive policy on every row), and
-- removal of single-column indexes already covered by a composite or unique index.
-- Access is unchanged: each merged policy is the OR of the two it replaces, and the
-- restrictive production boundaries still apply on top. Safe to run more than once.

DROP POLICY IF EXISTS sprint1_users_admin_read ON public.usuarios;
DROP POLICY IF EXISTS sprint1_users_read_self ON public.usuarios;
DROP POLICY IF EXISTS usuarios_read ON public.usuarios;
CREATE POLICY usuarios_read ON public.usuarios FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS sprint1_stores_admin_read ON public.tiendas;
DROP POLICY IF EXISTS sprint1_stores_read_owner ON public.tiendas;
DROP POLICY IF EXISTS sprint1_admin_stores_read ON public.tiendas;
DROP POLICY IF EXISTS tiendas_read ON public.tiendas;
CREATE POLICY tiendas_read ON public.tiendas FOR SELECT TO authenticated
  USING (usuario_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS sprint1_vehicles_admin_read ON public.vehiculos;
DROP POLICY IF EXISTS sprint1_vehicles_read ON public.vehiculos;
DROP POLICY IF EXISTS vehiculos_read ON public.vehiculos;
CREATE POLICY vehiculos_read ON public.vehiculos FOR SELECT TO authenticated
  USING (usuario_id = (SELECT auth.uid()) OR public.store_can_read_vehicle(id) OR public.is_admin());

DROP POLICY IF EXISTS sprint1_requests_admin_read ON public.solicitudes;
DROP POLICY IF EXISTS sprint1_requests_read_owner_or_store ON public.solicitudes;
DROP POLICY IF EXISTS solicitudes_read ON public.solicitudes;
CREATE POLICY solicitudes_read ON public.solicitudes FOR SELECT TO authenticated
  USING (usuario_id = (SELECT auth.uid()) OR public.store_can_read_request(id) OR public.is_admin());

DROP POLICY IF EXISTS sprint2_proposals_admin_read ON public.propuestas;
DROP POLICY IF EXISTS sprint2_proposals_read_owner_or_store ON public.propuestas;
DROP POLICY IF EXISTS propuestas_read ON public.propuestas;
CREATE POLICY propuestas_read ON public.propuestas FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.solicitudes s WHERE s.id = propuestas.solicitud_id AND s.usuario_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.tiendas t WHERE t.id = propuestas.tienda_id AND t.usuario_id = (SELECT auth.uid()))
    OR public.is_admin()
  );

DROP POLICY IF EXISTS sprint1_history_admin_read ON public.historial_solicitudes;
DROP POLICY IF EXISTS sprint1_history_owner_read ON public.historial_solicitudes;
DROP POLICY IF EXISTS historial_solicitudes_read ON public.historial_solicitudes;
CREATE POLICY historial_solicitudes_read ON public.historial_solicitudes FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.solicitudes s WHERE s.id = historial_solicitudes.solicitud_id AND s.usuario_id = (SELECT auth.uid()))
    OR public.is_admin()
  );

DO $$
BEGIN
  IF to_regclass('public.reportes') IS NOT NULL THEN
    DROP POLICY IF EXISTS reportes_select_admin ON public.reportes;
    DROP POLICY IF EXISTS reportes_select_propios ON public.reportes;
    DROP POLICY IF EXISTS reportes_read ON public.reportes;
    CREATE POLICY reportes_read ON public.reportes FOR SELECT TO authenticated
      USING (usuario_id = (SELECT auth.uid()) OR public.is_admin());
  END IF;
END $$;

-- Redundant indexes: each leading column is already the prefix of another index.
DROP INDEX IF EXISTS public.idx_notificaciones_usuario_id;   -- notificaciones_usuario_fecha_idx
DROP INDEX IF EXISTS public.idx_promociones_tienda_id;       -- promociones_tienda_idx
DROP INDEX IF EXISTS public.idx_propuestas_tienda_id;        -- propuestas_tienda_idx
DROP INDEX IF EXISTS public.idx_propuestas_solicitud_id;     -- propuestas_solicitud_id_tienda_id_key
DROP INDEX IF EXISTS public.idx_resenas_tienda_id;           -- resenas_tienda_fecha_idx
DROP INDEX IF EXISTS public.idx_solicitudes_usuario_id;      -- solicitudes_usuario_fecha_idx
DROP INDEX IF EXISTS public.idx_solicitudes_categoria_id;    -- solicitudes_categoria_estado_idx
DROP INDEX IF EXISTS public.idx_tienda_categorias_tienda_id; -- tienda_categorias_tienda_id_categoria_id_key
DROP INDEX IF EXISTS public.idx_tienda_categorias_categoria_id; -- tienda_categorias_categoria_idx
DROP INDEX IF EXISTS public.idx_tiendas_usuario_id;          -- tiendas_usuario_id_key
DROP INDEX IF EXISTS public.idx_vehiculos_usuario_id;        -- vehiculos_usuario_idx

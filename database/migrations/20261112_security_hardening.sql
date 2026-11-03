-- Security hardening: closes write paths through definer views, removes legacy role
-- RPCs that skipped the MFA rule, narrows function execution, consolidates duplicate
-- policies and indexes foreign keys. Safe to run more than once.


-- 1. Definer views are read-only projections. sprint2_tienda_contacto is a simple
--    single-table view (auto-updatable) owned by a role that bypasses RLS, so any
--    INSERT/UPDATE/DELETE granted on it reached public.tiendas without policies.
DO $$
DECLARE v record;
BEGIN
  FOR v IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
  LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM PUBLIC, anon, authenticated', v.relname);
  END LOOP;
END $$;

-- Read access stays exactly as before.
GRANT SELECT ON public.sprint2_tiendas_publicas TO anon, authenticated;
GRANT SELECT ON public.sprint2_tienda_contacto TO authenticated;
DO $$
BEGIN
  IF to_regclass('public.resenas_publicas') IS NOT NULL THEN GRANT SELECT ON public.resenas_publicas TO anon, authenticated; END IF;
  IF to_regclass('public.resenas_resumen') IS NOT NULL THEN GRANT SELECT ON public.resenas_resumen TO anon, authenticated; END IF;
  IF to_regclass('public.sprint3_resenas_tienda') IS NOT NULL THEN GRANT SELECT ON public.sprint3_resenas_tienda TO authenticated; END IF;
END $$;

-- 2. Legacy RPCs that existed only in the hosted project. Roles are assigned by the
--    project owner in SQL; these allowed role changes from the browser, and some
--    checked is_super_admin(), which never required the second factor.
DROP FUNCTION IF EXISTS public.admin_change_user_role(uuid, public.user_role);
DROP FUNCTION IF EXISTS public.change_user_role(uuid, public.user_role);
DROP FUNCTION IF EXISTS public.sprint1_admin_set_user_role(uuid, public.user_role);
DROP FUNCTION IF EXISTS public.set_user_active(uuid, boolean);
DROP FUNCTION IF EXISTS public.cambiar_estado_tienda(uuid, public.store_status, text);
DROP FUNCTION IF EXISTS public.registrar_tienda(text, text, text, text, numeric, numeric, text);
DROP FUNCTION IF EXISTS public.is_super_admin();

-- Administrative overview (requires an active administrator with aal2 via is_admin()).
-- Dropped first because the hosted project had an older version with fewer columns.
DROP FUNCTION IF EXISTS public.get_dashboard_stats();
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS TABLE(total_usuarios bigint, total_clientes bigint, total_tiendas bigint, tiendas_activas bigint,
              tiendas_pendientes bigint, solicitudes_activas bigint, total_propuestas bigint, promociones_activas bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador con segundo factor puede consultar el resumen' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT
    (SELECT count(*) FROM public.usuarios),
    (SELECT count(*) FROM public.usuarios WHERE rol = 'cliente'::public.user_role),
    (SELECT count(*) FROM public.tiendas),
    (SELECT count(*) FROM public.tiendas WHERE estado = 'aprobada'::public.store_status AND activa),
    (SELECT count(*) FROM public.tiendas WHERE estado = 'pendiente'::public.store_status),
    (SELECT count(*) FROM public.solicitudes WHERE estado::text IN ('publicada', 'recibiendo_propuestas')),
    (SELECT count(*) FROM public.propuestas),
    (SELECT count(*) FROM public.promociones WHERE estado = 'activa'::public.promotion_status AND now() >= fecha_inicio AND now() < fecha_fin);
END $$;

-- Lets an active account edit its own name and phone without opening UPDATE on usuarios.
CREATE OR REPLACE FUNCTION public.update_my_profile(new_nombre text, new_apellido text, new_telefono text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_nombre text := NULLIF(btrim(new_nombre), '');
  v_apellido text := NULLIF(btrim(new_apellido), '');
  v_telefono text := NULLIF(btrim(new_telefono), '');
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT public.account_is_active() THEN
    RAISE EXCEPTION 'Debes iniciar sesión con una cuenta activa' USING ERRCODE = '42501';
  END IF;
  IF v_nombre IS NULL OR v_apellido IS NULL THEN
    RAISE EXCEPTION 'El nombre y el apellido son obligatorios' USING ERRCODE = '22023';
  END IF;
  IF length(v_nombre) > 100 OR length(v_apellido) > 100 THEN
    RAISE EXCEPTION 'El nombre y el apellido admiten hasta 100 caracteres' USING ERRCODE = '22023';
  END IF;
  IF v_telefono IS NOT NULL AND v_telefono !~ '^\+?[0-9 ()-]{6,20}$' THEN
    RAISE EXCEPTION 'Escribe un teléfono válido de 6 a 20 dígitos' USING ERRCODE = '22023';
  END IF;
  UPDATE public.usuarios
     SET nombre = v_nombre, apellido = v_apellido, telefono = v_telefono
   WHERE id = (SELECT auth.uid()) AND activo;
  RETURN FOUND;
END $$;

-- 3. Function execution: nothing is callable by anonymous visitors unless listed,
--    trigger functions are never callable as RPCs, and new functions start closed.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature, p.prorettype = 'trigger'::regtype AS is_trigger
           FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.prokind = 'f'
             AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    IF f.is_trigger THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', f.signature);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.signature);
    END IF;
  END LOOP;
END $$;

-- Server-only: the storage cleanup worker runs with the service role key.
DO $$
BEGIN
  IF to_regprocedure('public.claim_storage_cleanup(integer)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.claim_storage_cleanup(integer) FROM PUBLIC, anon, authenticated;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      GRANT EXECUTE ON FUNCTION public.claim_storage_cleanup(integer) TO service_role;
    END IF;
  END IF;
END $$;

-- Public pages: maintenance banner and store reviews.
GRANT EXECUTE ON FUNCTION public.sprint3_get_system_status() TO anon;
GRANT EXECUTE ON FUNCTION public.public_store_reviews(uuid[]) TO anon;

-- 4. Duplicate and unreachable policies. Each table keeps one permissive policy per
--    action; the restrictive production boundaries remain the outer limit.
DROP POLICY IF EXISTS categorias_insert_admin ON public.categorias_repuesto;
DROP POLICY IF EXISTS categorias_select ON public.categorias_repuesto;
DROP POLICY IF EXISTS categorias_select_admin ON public.categorias_repuesto;
DROP POLICY IF EXISTS categorias_update_admin ON public.categorias_repuesto;
DROP POLICY IF EXISTS marcas_select ON public.marcas;
DROP POLICY IF EXISTS modelos_select ON public.modelos;
DROP POLICY IF EXISTS tipos_vehiculo_select ON public.tipos_vehiculo;
DO $$
BEGIN
  -- Older promotion policies are superseded by the *_owner / *_available_or_owner versions.
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'promociones' AND policyname = 'sprint2_promotions_read_available_or_owner') THEN
    DROP POLICY IF EXISTS sprint2_promotions_read ON public.promociones;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'promociones' AND policyname = 'sprint2_promotions_insert_owner') THEN
    DROP POLICY IF EXISTS sprint2_promotions_insert ON public.promociones;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'promociones' AND policyname = 'sprint2_promotions_update_owner') THEN
    DROP POLICY IF EXISTS sprint2_promotions_update ON public.promociones;
  END IF;
END $$;
-- Administrators change stores and accounts only through audited RPCs; the restrictive
-- boundaries already made these direct-write policies unreachable.
DROP POLICY IF EXISTS tiendas_select_admin ON public.tiendas;
DROP POLICY IF EXISTS tiendas_update_admin ON public.tiendas;
DROP POLICY IF EXISTS sprint1_stores_admin_update ON public.tiendas;
DROP POLICY IF EXISTS sprint1_users_admin_update ON public.usuarios;

-- Tables used only by security-definer RPCs: state the deny-all intent explicitly.
DROP POLICY IF EXISTS rpc_only_access ON public.configuracion_sistema;
CREATE POLICY rpc_only_access ON public.configuracion_sistema AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
DO $$
BEGIN
  IF to_regclass('public.storage_cleanup_jobs') IS NOT NULL THEN
    DROP POLICY IF EXISTS rpc_only_access ON public.storage_cleanup_jobs;
    CREATE POLICY rpc_only_access ON public.storage_cleanup_jobs AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
  END IF;
END $$;

-- 5. Evaluate auth.uid() once per statement instead of once per row.
DO $$
DECLARE
  p record;
  new_qual text;
  new_check text;
  pattern constant text := '(?<!SELECT )auth\.uid\(\)';
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname, qual, with_check FROM pg_policies
           WHERE schemaname = 'public'
             AND (coalesce(qual, '') ~ pattern OR coalesce(with_check, '') ~ pattern)
  LOOP
    new_qual := regexp_replace(p.qual, pattern, '(SELECT auth.uid())', 'g');
    new_check := regexp_replace(p.with_check, pattern, '(SELECT auth.uid())', 'g');
    IF p.qual IS NOT NULL AND p.with_check IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)', p.policyname, p.schemaname, p.tablename, new_qual, new_check);
    ELSIF p.qual IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)', p.policyname, p.schemaname, p.tablename, new_qual);
    ELSE
      EXECUTE format('ALTER POLICY %I ON %I.%I WITH CHECK (%s)', p.policyname, p.schemaname, p.tablename, new_check);
    END IF;
  END LOOP;
END $$;

-- 6. Covering indexes for foreign keys used in joins, cascades and admin filters.
CREATE INDEX IF NOT EXISTS categorias_repuesto_padre_idx ON public.categorias_repuesto (categoria_padre_id);
CREATE INDEX IF NOT EXISTS favoritos_promocion_promocion_idx ON public.favoritos_promocion (promocion_id);
CREATE INDEX IF NOT EXISTS favoritos_solicitud_solicitud_idx ON public.favoritos_solicitud (solicitud_id);
CREATE INDEX IF NOT EXISTS favoritos_tienda_tienda_idx ON public.favoritos_tienda (tienda_id);
CREATE INDEX IF NOT EXISTS modelos_tipo_vehiculo_idx ON public.modelos (tipo_vehiculo_id);
CREATE INDEX IF NOT EXISTS notificaciones_propuesta_idx ON public.notificaciones (propuesta_id);
CREATE INDEX IF NOT EXISTS notificaciones_solicitud_idx ON public.notificaciones (solicitud_id);
CREATE INDEX IF NOT EXISTS solicitudes_propuesta_seleccionada_idx ON public.solicitudes (propuesta_seleccionada_id);
CREATE INDEX IF NOT EXISTS vehiculos_marca_idx ON public.vehiculos (marca_id);
CREATE INDEX IF NOT EXISTS vehiculos_tipo_vehiculo_idx ON public.vehiculos (tipo_vehiculo_id);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'configuracion_sistema' AND column_name = 'actualizado_por') THEN
    CREATE INDEX IF NOT EXISTS configuracion_sistema_actualizado_por_idx ON public.configuracion_sistema (actualizado_por);
  END IF;
  IF to_regclass('public.reportes') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS reportes_usuario_idx ON public.reportes (usuario_id);
    CREATE INDEX IF NOT EXISTS reportes_tienda_idx ON public.reportes (tienda_id);
    CREATE INDEX IF NOT EXISTS reportes_propuesta_idx ON public.reportes (propuesta_id);
    CREATE INDEX IF NOT EXISTS reportes_promocion_idx ON public.reportes (promocion_id);
    CREATE INDEX IF NOT EXISTS reportes_solicitud_idx ON public.reportes (solicitud_id);
  END IF;
END $$;


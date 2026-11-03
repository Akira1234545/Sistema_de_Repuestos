-- Fresh-install prerequisites. Apply after sprint1_rls and before sprint2.
-- Existing helpers are checked, not silently overwritten, by Sprint 2.
BEGIN;
DO $migration$
BEGIN
    IF to_regprocedure('public.is_admin()') IS NULL THEN
        EXECUTE $ddl$CREATE FUNCTION public.is_admin() RETURNS boolean
        LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $body$
            SELECT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid()
                AND u.activo AND u.rol::text IN ('administrador', 'superAdministrador'))
        $body$$ddl$;
    END IF;
    IF to_regprocedure('public.get_my_role()') IS NULL THEN
        EXECUTE $ddl$CREATE FUNCTION public.get_my_role() RETURNS text
        LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $body$
            SELECT u.rol::text FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo
        $body$$ddl$;
    END IF;
    IF to_regprocedure('public.get_my_store_id()') IS NULL THEN
        EXECUTE $ddl$CREATE FUNCTION public.get_my_store_id() RETURNS uuid
        LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $body$
            SELECT t.id FROM public.tiendas t JOIN public.usuarios u ON u.id = t.usuario_id
            WHERE u.id = auth.uid() AND u.activo AND u.rol::text = 'tienda'
        $body$$ddl$;
    END IF;
END;
$migration$;
REVOKE ALL ON FUNCTION public.is_admin(), public.get_my_role(), public.get_my_store_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(), public.get_my_role(), public.get_my_store_id() TO authenticated;
COMMIT;

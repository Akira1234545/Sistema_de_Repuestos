-- READ ONLY: run this query in the Supabase SQL Editor before applying
-- database/migrations/20261006_sprint2.sql. Review every row, especially
-- admin policies and any policy not listed in the migration's reconciliation.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    tablename IN (
      'tiendas', 'solicitudes', 'propuestas', 'promociones', 'vehiculos',
      'favoritos_tienda', 'favoritos_solicitud', 'favoritos_promocion'
    )
    OR policyname ILIKE '%admin%'
    OR array_to_string(roles, ',') ILIKE '%admin%'
    OR concat_ws(' ', qual, with_check) ~* '(is_admin|admin|administrador|superadministrador)'
  )
ORDER BY tablename, cmd, policyname;

-- Read-only inspection of all role helpers used by Sprint 2. In particular,
-- sprint1_role() must return no role for inactive accounts.
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_function_result(p.oid) AS return_type,
       p.prosecdef AS security_definer,
       p.proconfig AS function_settings,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('is_admin', 'get_my_role', 'get_my_store_id', 'sprint1_role')
ORDER BY n.nspname, p.proname, arguments;

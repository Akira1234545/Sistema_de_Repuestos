-- Solo lectura. Ejecutar como propietario en staging y revisar cada resultado.
-- Restricciones de datos históricos pendientes de validación.
SELECT conrelid::regclass AS tabla, conname, pg_get_constraintdef(oid) AS regla
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace AND NOT convalidated
ORDER BY 1, 2;

-- Comprobar RLS en todas las tablas públicas; cada excepción requiere revisión.
SELECT categoria_padre_id, lower(btrim(nombre)) AS nombre_normalizado, count(*) AS cantidad
FROM public.categorias_repuesto
GROUP BY categoria_padre_id, lower(btrim(nombre)) HAVING count(*) > 1;

SELECT c.relname AS tabla, c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY 1;

-- Inventario de políticas y permisos: no concede ni revoca acceso.
SELECT schemaname, tablename, policyname, roles, cmd, permissive, qual, with_check
FROM pg_policies WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;

SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY table_name, grantee, privilege_type;

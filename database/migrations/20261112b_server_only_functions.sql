-- 20261112b_server_only_functions
-- Copia recuperada en la sesión 8 (24 nov 2026) desde supabase_migrations.schema_migrations
-- (versión remota 20261103192409). Ya está aplicada en Supabase: NO volver a aplicarla.
-- Solo el rol de servicio (script de limpieza de Storage) puede reclamar trabajos de limpieza.
-- La 20261116_sesion3b.sql repite estas mismas dos órdenes.

REVOKE EXECUTE ON FUNCTION public.claim_storage_cleanup(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_storage_cleanup(integer) TO service_role;

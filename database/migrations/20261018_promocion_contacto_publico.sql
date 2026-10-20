-- Expose the store phone number in the public store view so customers can
-- contact the advertiser directly from a currently available promotion.
-- The phone number is intentionally public after applying this migration.
CREATE OR REPLACE VIEW public.sprint2_tiendas_publicas
    WITH (security_barrier = true, security_invoker = false)
AS
SELECT t.id, t.nombre, t.descripcion, t.horario, t.fotografias, t.telefono
FROM public.tiendas t
WHERE t.activa = TRUE AND t.estado = 'aprobada';

REVOKE ALL ON public.sprint2_tiendas_publicas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sprint2_tiendas_publicas TO anon, authenticated;

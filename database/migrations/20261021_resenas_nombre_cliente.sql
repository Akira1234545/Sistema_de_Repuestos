-- Expose reviewer names only to the store that received each review.
-- Apply after 20261020_resenas_tienda_propietaria.sql.
BEGIN;

CREATE OR REPLACE VIEW public.sprint3_resenas_tienda
    WITH (security_barrier = true, security_invoker = false)
AS
SELECT
    r.id,
    r.tienda_id,
    r.calificacion,
    r.comentario,
    r.fecha_creacion,
    u.nombre AS nombre_cliente,
    u.apellido AS apellido_cliente
FROM public.resenas r
JOIN public.usuarios u ON u.id = r.usuario_id
WHERE public.sprint1_role() = 'tienda'
  AND EXISTS (
      SELECT 1
      FROM public.tiendas t
      WHERE t.id = r.tienda_id
        AND t.usuario_id = (SELECT auth.uid())
  );

REVOKE ALL ON public.sprint3_resenas_tienda FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sprint3_resenas_tienda TO authenticated;

COMMIT;

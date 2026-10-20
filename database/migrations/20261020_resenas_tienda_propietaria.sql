-- Let an authenticated store account read only reviews for its own store.
-- Apply after 20261019_resenas_tienda.sql.
BEGIN;

-- Public reviews remain readable anonymously and by customers, but the
-- authenticated store role is restricted to its own store's reviews below.
DROP POLICY IF EXISTS resenas_read_owner_or_public_store ON public.resenas;
DROP POLICY IF EXISTS resenas_read_public_anon ON public.resenas;
CREATE POLICY resenas_read_public_anon
    ON public.resenas
    FOR SELECT TO anon
    USING (
        EXISTS (
            SELECT 1
            FROM public.sprint2_tiendas_publicas t
            WHERE t.id = resenas.tienda_id
        )
    );

DROP POLICY IF EXISTS resenas_read_customer_or_admin ON public.resenas;
CREATE POLICY resenas_read_customer_or_admin
    ON public.resenas
    FOR SELECT TO authenticated
    USING (
        public.sprint1_role() IS DISTINCT FROM 'tienda'
        AND (
            usuario_id = (SELECT auth.uid())
            OR EXISTS (
                SELECT 1
                FROM public.sprint2_tiendas_publicas t
                WHERE t.id = resenas.tienda_id
            )
        )
    );

DROP POLICY IF EXISTS resenas_read_store_owner ON public.resenas;
CREATE POLICY resenas_read_store_owner
    ON public.resenas
    FOR SELECT TO authenticated
    USING (
        public.sprint1_role() = 'tienda'
        AND EXISTS (
            SELECT 1
            FROM public.tiendas t
            WHERE t.id = resenas.tienda_id
              AND t.usuario_id = (SELECT auth.uid())
        )
    );

COMMIT;

-- Enables store owners to manage the categories they serve.
-- Apply after 20261007_rls_store_review.sql (and after Sprint 2).
BEGIN;

-- Stop if pre-existing permissive rules have not been reviewed. RLS policies
-- combine with OR, so adding the owner rule cannot neutralize a broader rule.
DO $$
DECLARE
    unexpected_policies text;
BEGIN
    SELECT string_agg(format('%I (roles=%s, command=%s, using=%s, check=%s)',
        policyname, roles, cmd, coalesce(qual, '<none>'), coalesce(with_check, '<none>')), E'\n')
      INTO unexpected_policies
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tienda_categorias'
      AND policyname <> 'sprint1_store_categories_read_owner'
      AND NOT (
          roles <@ ARRAY['authenticated']::name[]
          AND cmd = 'SELECT'
          AND coalesce(qual, '') ~* '^\s*is_admin\s*\(\s*\)\s*$'
      );
    IF unexpected_policies IS NOT NULL THEN
        RAISE EXCEPTION 'Migración de categorías detenida: revisa políticas existentes en public.tienda_categorias antes de continuar:%', unexpected_policies;
    END IF;
END;
$$;

ALTER TABLE public.tienda_categorias ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tienda_categorias FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.tienda_categorias TO authenticated;

DROP POLICY IF EXISTS sprint1_store_categories_read_owner ON public.tienda_categorias;
CREATE POLICY sprint1_store_categories_read_owner
    ON public.tienda_categorias
    FOR SELECT TO authenticated
    USING (
        public.sprint1_role() = 'tienda'
        AND EXISTS (
            SELECT 1 FROM public.tiendas t
            WHERE t.id = tienda_categorias.tienda_id
              AND t.usuario_id = (SELECT auth.uid())
        )
    );

CREATE OR REPLACE FUNCTION public.sprint1_update_store_categories(p_category_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_store_id uuid;
    v_category_ids uuid[] := ARRAY(
        SELECT DISTINCT x.category_id
        FROM unnest(coalesce(p_category_ids, ARRAY[]::uuid[])) AS x(category_id)
        WHERE x.category_id IS NOT NULL
        ORDER BY x.category_id
    );
BEGIN
    IF public.sprint1_role() IS DISTINCT FROM 'tienda' THEN
        RAISE EXCEPTION 'Solo una cuenta tienda puede administrar sus categorías';
    END IF;

    SELECT t.id INTO v_store_id
    FROM public.tiendas t
    WHERE t.usuario_id = (SELECT auth.uid())
    FOR UPDATE;
    IF v_store_id IS NULL THEN
        RAISE EXCEPTION 'Registra primero el perfil de tu tienda';
    END IF;

    IF EXISTS (
        SELECT 1 FROM unnest(v_category_ids) AS selected(category_id)
        LEFT JOIN public.categorias_repuesto c ON c.id = selected.category_id
        WHERE c.id IS NULL OR c.activo IS DISTINCT FROM TRUE
    ) THEN
        RAISE EXCEPTION 'Una o más categorías ya no están activas';
    END IF;

    DELETE FROM public.tienda_categorias tc
    WHERE tc.tienda_id = v_store_id
      AND NOT (tc.categoria_id = ANY(v_category_ids));

    INSERT INTO public.tienda_categorias (tienda_id, categoria_id)
    SELECT v_store_id, selected.category_id
    FROM unnest(v_category_ids) AS selected(category_id)
    ON CONFLICT (tienda_id, categoria_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.sprint1_update_store_categories(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sprint1_update_store_categories(uuid[]) TO authenticated;

-- Read-only verification after applying this migration:
-- SELECT policyname, roles, cmd, qual FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'tienda_categorias';
-- SELECT proname, prosecdef, proconfig FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
--   AND proname = 'sprint1_update_store_categories';
COMMIT;

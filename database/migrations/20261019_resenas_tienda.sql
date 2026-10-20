-- Allow customers to review only the proposal selected for their own request.
-- Apply after 20261018_promocion_contacto_publico.sql.
BEGIN;

-- Do not expose or silently remove legacy rows that violate the new rule.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.resenas r
        LEFT JOIN public.propuestas p ON p.id = r.propuesta_id
        LEFT JOIN public.solicitudes s ON s.id = p.solicitud_id
        WHERE p.id IS NULL
           OR s.id IS NULL
           OR r.usuario_id IS DISTINCT FROM s.usuario_id
           OR r.tienda_id IS DISTINCT FROM p.tienda_id
           OR s.propuesta_seleccionada_id IS DISTINCT FROM p.id
           OR s.estado IS DISTINCT FROM 'propuesta_seleccionada'::public.request_status
           OR p.estado IS DISTINCT FROM 'aceptada'::public.proposal_status
    ) THEN
        RAISE EXCEPTION 'Migración de reseñas detenida: hay reseñas que no corresponden a una propuesta seleccionada por su cliente. Revisa esos registros antes de reintentar.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.resenas
        GROUP BY propuesta_id
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Migración de reseñas detenida: hay más de una reseña para una propuesta. Revisa esos registros antes de reintentar.';
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS resenas_propuesta_unique_idx
    ON public.resenas (propuesta_id);

ALTER TABLE public.resenas ENABLE ROW LEVEL SECURITY;

-- Replace any legacy policies: RLS policies are permissive by default and
-- combine with OR, so retaining an unknown rule could widen access.
DO $$
DECLARE
    existing_policy record;
BEGIN
    FOR existing_policy IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'resenas'
    LOOP
        EXECUTE format('DROP POLICY %I ON public.resenas', existing_policy.policyname);
    END LOOP;
END;
$$;

REVOKE ALL ON TABLE public.resenas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.resenas TO anon, authenticated;
GRANT INSERT (usuario_id, tienda_id, propuesta_id, calificacion, comentario)
    ON TABLE public.resenas TO authenticated;

CREATE POLICY resenas_read_owner_or_public_store
    ON public.resenas
    FOR SELECT TO anon, authenticated
    USING (
        usuario_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1
            FROM public.sprint2_tiendas_publicas t
            WHERE t.id = resenas.tienda_id
        )
    );

CREATE POLICY resenas_insert_customer
    ON public.resenas
    FOR INSERT TO authenticated
    WITH CHECK (
        usuario_id = (SELECT auth.uid())
        AND public.sprint1_role() = 'cliente'
    );

CREATE OR REPLACE FUNCTION public.sprint3_validate_store_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_request_owner uuid;
    v_selected_proposal_id uuid;
    v_request_status public.request_status;
    v_proposal_store_id uuid;
    v_proposal_status public.proposal_status;
BEGIN
    IF (SELECT auth.uid()) IS NULL
       OR NEW.usuario_id IS DISTINCT FROM (SELECT auth.uid())
       OR public.sprint1_role() IS DISTINCT FROM 'cliente' THEN
        RAISE EXCEPTION 'Solo el cliente autenticado puede reseñar su propuesta seleccionada';
    END IF;

    SELECT s.usuario_id, s.propuesta_seleccionada_id, s.estado, p.tienda_id, p.estado
    INTO v_request_owner, v_selected_proposal_id, v_request_status, v_proposal_store_id, v_proposal_status
    FROM public.propuestas p
    JOIN public.solicitudes s ON s.id = p.solicitud_id
    WHERE p.id = NEW.propuesta_id;

    IF NOT FOUND
       OR v_request_owner IS DISTINCT FROM NEW.usuario_id
       OR v_selected_proposal_id IS DISTINCT FROM NEW.propuesta_id
       OR v_request_status IS DISTINCT FROM 'propuesta_seleccionada'::public.request_status
       OR v_proposal_store_id IS DISTINCT FROM NEW.tienda_id
       OR v_proposal_status IS DISTINCT FROM 'aceptada'::public.proposal_status THEN
        RAISE EXCEPTION 'Solo puedes reseñar la tienda de una propuesta seleccionada en tu solicitud';
    END IF;

    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sprint3_validate_store_review() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sprint3_validate_store_review ON public.resenas;
CREATE TRIGGER sprint3_validate_store_review
    BEFORE INSERT ON public.resenas
    FOR EACH ROW
    EXECUTE FUNCTION public.sprint3_validate_store_review();

COMMIT;

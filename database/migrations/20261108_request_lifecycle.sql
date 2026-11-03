BEGIN;
CREATE OR REPLACE FUNCTION public.retirar_propuesta(p_propuesta_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE request_id uuid; request_state public.request_status; proposal_state public.proposal_status;
BEGIN
    IF public.sprint1_role() IS DISTINCT FROM 'tienda' THEN RAISE EXCEPTION 'Se requiere una cuenta tienda activa'; END IF;
    SELECT p.solicitud_id INTO request_id FROM public.propuestas p JOIN public.tiendas t ON t.id=p.tienda_id
        WHERE p.id=p_propuesta_id AND t.usuario_id=auth.uid();
    IF NOT FOUND THEN RAISE EXCEPTION 'Propuesta no disponible'; END IF;
    SELECT estado INTO request_state FROM public.solicitudes WHERE id=request_id FOR UPDATE;
    SELECT estado INTO proposal_state FROM public.propuestas WHERE id=p_propuesta_id FOR UPDATE;
    IF proposal_state='retirada' THEN RETURN; END IF;
    IF request_state NOT IN ('publicada','recibiendo_propuestas') OR proposal_state<>'enviada' THEN
        RAISE EXCEPTION 'Esta propuesta ya no se puede retirar';
    END IF;
    UPDATE public.propuestas SET estado='retirada',fecha_actualizacion=now() WHERE id=p_propuesta_id;
END;
$$;
REVOKE ALL ON FUNCTION public.retirar_propuesta(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.retirar_propuesta(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_closed_proposals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
    IF NEW.estado='cerrada' AND NEW.estado IS DISTINCT FROM OLD.estado THEN
        UPDATE public.propuestas SET estado='rechazada',fecha_actualizacion=now()
        WHERE solicitud_id=NEW.id AND estado='enviada';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.reject_closed_proposals() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS reject_closed_proposals ON public.solicitudes;
CREATE TRIGGER reject_closed_proposals AFTER UPDATE OF estado ON public.solicitudes FOR EACH ROW EXECUTE FUNCTION public.reject_closed_proposals();

CREATE OR REPLACE FUNCTION public.sprint2_store_can_view_request(p_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
    SELECT public.sprint1_role()='tienda' AND EXISTS(SELECT 1 FROM public.solicitudes s
        JOIN public.tienda_categorias tc ON tc.categoria_id=s.categoria_id
        JOIN public.tiendas t ON t.id=tc.tienda_id AND t.usuario_id=auth.uid()
        JOIN public.categorias_repuesto c ON c.id=s.categoria_id AND c.activo
        WHERE s.id=p_request_id AND s.estado IN ('publicada','recibiendo_propuestas') AND public.store_is_eligible(t.id))
$$;
DROP POLICY IF EXISTS sprint1_requests_update_owner ON public.solicitudes;
CREATE POLICY sprint1_requests_update_owner ON public.solicitudes FOR UPDATE TO authenticated
USING(usuario_id=auth.uid() AND public.sprint1_role()='cliente' AND estado IN ('publicada','recibiendo_propuestas'))
WITH CHECK(usuario_id=auth.uid() AND public.sprint1_role()='cliente' AND public.sprint1_owns_vehicle(vehiculo_id));
CREATE OR REPLACE FUNCTION public.validate_request_category_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
    IF auth.uid() IS NULL THEN RETURN NEW; END IF;
    IF NEW.categoria_id IS DISTINCT FROM OLD.categoria_id AND NOT EXISTS(
        SELECT 1 FROM public.categorias_repuesto WHERE id=NEW.categoria_id AND activo) THEN
        RAISE EXCEPTION 'Selecciona una categoría activa';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_request_category_change() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS validate_request_category_change ON public.solicitudes;
CREATE TRIGGER validate_request_category_change BEFORE UPDATE ON public.solicitudes FOR EACH ROW EXECUTE FUNCTION public.validate_request_category_change();
COMMIT;

-- Incremental: guarda únicamente la creación y transiciones de estado futuras.
-- No reconstruye eventos anteriores que no están almacenados.
CREATE TABLE IF NOT EXISTS public.historial_solicitudes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitud_id UUID NOT NULL REFERENCES public.solicitudes(id) ON DELETE CASCADE,
    estado_anterior public.request_status,
    estado_nuevo public.request_status NOT NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS historial_solicitudes_solicitud_fecha_idx
    ON public.historial_solicitudes (solicitud_id, fecha DESC);

CREATE OR REPLACE FUNCTION public.registrar_historial_solicitud()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.historial_solicitudes (solicitud_id, estado_nuevo, fecha)
        VALUES (NEW.id, NEW.estado, NEW.fecha_creacion);
    ELSIF NEW.estado IS DISTINCT FROM OLD.estado THEN
        INSERT INTO public.historial_solicitudes (solicitud_id, estado_anterior, estado_nuevo)
        VALUES (NEW.id, OLD.estado, NEW.estado);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS solicitudes_historial_insert ON public.solicitudes;
CREATE TRIGGER solicitudes_historial_insert
    AFTER INSERT ON public.solicitudes
    FOR EACH ROW EXECUTE FUNCTION public.registrar_historial_solicitud();

DROP TRIGGER IF EXISTS solicitudes_historial_estado ON public.solicitudes;
CREATE TRIGGER solicitudes_historial_estado
    AFTER UPDATE OF estado ON public.solicitudes
    FOR EACH ROW EXECUTE FUNCTION public.registrar_historial_solicitud();

ALTER TABLE public.historial_solicitudes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.historial_solicitudes FROM anon, authenticated;
GRANT SELECT ON TABLE public.historial_solicitudes TO authenticated;
DROP POLICY IF EXISTS historial_solicitudes_select_owner ON public.historial_solicitudes;
CREATE POLICY historial_solicitudes_select_owner
    ON public.historial_solicitudes FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.solicitudes s
        WHERE s.id = historial_solicitudes.solicitud_id
          AND s.usuario_id = (SELECT auth.uid())
    ));

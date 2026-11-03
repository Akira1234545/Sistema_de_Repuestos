BEGIN;
CREATE OR REPLACE FUNCTION public.sprint1_validate_vehicle_year()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
    IF NEW.anio<1886 OR NEW.anio>extract(year FROM now() AT TIME ZONE 'America/La_Paz')::integer+1 THEN
        RAISE EXCEPTION 'Indica un año entre 1886 y el próximo año calendario';
    END IF;
    RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.validate_vehicle_catalogs()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
    IF TG_OP='INSERT' OR (NEW.tipo_vehiculo_id,NEW.marca_id,NEW.modelo_id)
        IS DISTINCT FROM (OLD.tipo_vehiculo_id,OLD.marca_id,OLD.modelo_id) THEN
        IF NOT EXISTS(SELECT 1 FROM public.modelos m JOIN public.marcas b ON b.id=m.marca_id
            JOIN public.tipos_vehiculo t ON t.id=m.tipo_vehiculo_id
            WHERE m.id=NEW.modelo_id AND b.id=NEW.marca_id AND t.id=NEW.tipo_vehiculo_id AND m.activo AND b.activo AND t.activo) THEN
            RAISE EXCEPTION 'Selecciona un tipo, marca y modelo activos y compatibles';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_vehicle_catalogs() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS validate_vehicle_catalogs ON public.vehiculos;
CREATE TRIGGER validate_vehicle_catalogs BEFORE INSERT OR UPDATE ON public.vehiculos FOR EACH ROW EXECUTE FUNCTION public.validate_vehicle_catalogs();
DO $$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.usuarios'::regclass AND conname='profile_text_length') THEN
        ALTER TABLE public.usuarios ADD CONSTRAINT profile_text_length CHECK(length(nombre)<=100 AND length(apellido)<=100 AND coalesce(length(telefono),0)<=40) NOT VALID;
    END IF;
END;
$$;
COMMIT;

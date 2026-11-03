-- Vehicle photos in Supabase Storage and a narrower history guard.
-- Requests and quotes depend on the vehicle identity (type, brand, model, year), so those
-- stay locked once a request exists; notes and photos describe the car and stay editable.

ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS fotos text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.vehiculos'::regclass AND conname = 'vehicle_photos_limit') THEN
        ALTER TABLE public.vehiculos ADD CONSTRAINT vehicle_photos_limit CHECK (cardinality(fotos) <= 4);
    END IF;
END;
$$;

GRANT INSERT (fotos), UPDATE (fotos) ON public.vehiculos TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_vehicle_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF auth.uid() IS NULL THEN RETURN NEW; END IF;
    IF (NEW.tipo_vehiculo_id, NEW.marca_id, NEW.modelo_id, NEW.anio) IS DISTINCT FROM
        (OLD.tipo_vehiculo_id, OLD.marca_id, OLD.modelo_id, OLD.anio)
        AND EXISTS (SELECT 1 FROM public.solicitudes WHERE vehiculo_id = OLD.id) THEN
        RAISE EXCEPTION 'Este vehículo tiene solicitudes: el tipo, la marca, el modelo y el año no se pueden cambiar. Puedes editar las notas y las fotos';
    END IF;
    RETURN NEW;
END;
$$;

-- Photo URLs must point at the owner's folder of the public "vehiculos" bucket.
CREATE OR REPLACE FUNCTION public.validate_vehicle_photos()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE photo text;
BEGIN
    FOREACH photo IN ARRAY coalesce(NEW.fotos, '{}') LOOP
        IF photo !~ ('^https://[a-z0-9.-]+/storage/v1/object/public/vehiculos/' || NEW.usuario_id::text || '/[0-9a-f-]{36}\.(webp|jpg|png)$') THEN
            RAISE EXCEPTION 'Las fotos del vehículo deben subirse desde la aplicación';
        END IF;
    END LOOP;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.validate_vehicle_photos() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_vehicle_photos ON public.vehiculos;
CREATE TRIGGER validate_vehicle_photos BEFORE INSERT OR UPDATE OF fotos ON public.vehiculos
    FOR EACH ROW EXECUTE FUNCTION public.validate_vehicle_photos();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('vehiculos', 'vehiculos', true, 3145728, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Clients manage only their own folder; reading goes through the public URL.
DROP POLICY IF EXISTS vehicle_images_select_own ON storage.objects;
CREATE POLICY vehicle_images_select_own ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'vehiculos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS vehicle_images_insert_own ON storage.objects;
CREATE POLICY vehicle_images_insert_own ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'vehiculos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text AND public.sprint1_role() = 'cliente');
DROP POLICY IF EXISTS vehicle_images_delete_own ON storage.objects;
CREATE POLICY vehicle_images_delete_own ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'vehiculos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text AND public.sprint1_role() = 'cliente');

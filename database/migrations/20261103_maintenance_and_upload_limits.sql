BEGIN;
CREATE OR REPLACE FUNCTION public.guard_business_writes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
    -- Trusted SQL/service jobs without an end-user identity remain available.
    IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
        IF NOT public.account_is_active() THEN RAISE EXCEPTION 'Cuenta no disponible'; END IF;
        IF EXISTS(SELECT 1 FROM public.configuracion_sistema WHERE id=1 AND mantenimiento_activo) THEN
            RAISE EXCEPTION 'El sistema está en mantenimiento. Vuelve a intentarlo más tarde';
        END IF;
    END IF;
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_business_writes() FROM PUBLIC,anon,authenticated;
DO $$
DECLARE tab text;
BEGIN
    FOREACH tab IN ARRAY ARRAY['vehiculos','solicitudes','tiendas','propuestas','promociones','resenas',
        'tienda_categorias','favoritos_tienda','favoritos_solicitud','favoritos_promocion'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS a_guard_business_writes ON public.%I',tab);
        EXECUTE format('CREATE TRIGGER a_guard_business_writes BEFORE INSERT OR UPDATE OR DELETE ON public.%I
            FOR EACH ROW EXECUTE FUNCTION public.guard_business_writes()',tab);
    END LOOP;
END;
$$;
CREATE OR REPLACE FUNCTION public.store_upload_allowed()
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE object_count bigint;
BEGIN
    IF public.sprint1_role() IS DISTINCT FROM 'tienda' THEN RETURN false; END IF;
    IF EXISTS(SELECT 1 FROM public.configuracion_sistema WHERE id=1 AND mantenimiento_activo) THEN RETURN false; END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,20261030));
    SELECT count(*) INTO object_count FROM storage.objects o
        WHERE o.bucket_id='tiendas' AND (storage.foldername(o.name))[1]=auth.uid()::text;
    RETURN object_count<24;
END;
$$;
REVOKE ALL ON FUNCTION public.store_upload_allowed() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.store_upload_allowed() TO authenticated;
DROP POLICY IF EXISTS store_upload_quota ON storage.objects;
CREATE POLICY store_upload_quota ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK(bucket_id<>'tiendas' OR ((storage.foldername(name))[1]=auth.uid()::text AND public.store_upload_allowed()));
COMMIT;

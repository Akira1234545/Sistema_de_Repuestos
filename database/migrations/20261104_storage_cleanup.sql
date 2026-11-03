BEGIN;
GRANT SELECT,DELETE ON public.storage_cleanup_jobs TO service_role;
CREATE INDEX IF NOT EXISTS storage_cleanup_ready_idx ON public.storage_cleanup_jobs(available_after,created_at,id) WHERE claimed_at IS NULL;
CREATE INDEX IF NOT EXISTS storage_cleanup_claimed_idx ON public.storage_cleanup_jobs(claimed_at) WHERE claimed_at IS NOT NULL;
CREATE OR REPLACE FUNCTION public.claim_storage_cleanup(p_limit integer DEFAULT 100)
RETURNS SETOF public.storage_cleanup_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE task public.storage_cleanup_jobs;
BEGIN
    IF p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'Límite no válido'; END IF;
    FOR task IN SELECT * FROM public.storage_cleanup_jobs
        WHERE available_after<=now() AND (claimed_at IS NULL OR claimed_at<now()-interval '5 minutes')
        ORDER BY created_at,id LIMIT p_limit LOOP
        -- Same lock order as photo edits: shop, then cleanup job.
        PERFORM 1 FROM public.tiendas WHERE usuario_id=task.usuario_id FOR UPDATE;
        IF EXISTS(SELECT 1 FROM public.tiendas t WHERE t.usuario_id=task.usuario_id
            AND EXISTS(SELECT 1 FROM unnest(t.fotografias) url WHERE url LIKE '%/tiendas/'||task.path)) THEN
            DELETE FROM public.storage_cleanup_jobs WHERE id=task.id;
            CONTINUE;
        END IF;
        UPDATE public.storage_cleanup_jobs SET claimed_at=now() WHERE id=task.id
            AND (claimed_at IS NULL OR claimed_at<now()-interval '5 minutes') RETURNING * INTO task;
        IF FOUND THEN RETURN NEXT task; END IF;
    END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_storage_cleanup(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_storage_cleanup(integer) TO service_role;
CREATE OR REPLACE FUNCTION public.queue_failed_uploads(p_paths text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_path text;
BEGIN
    IF public.sprint1_role() IS DISTINCT FROM 'tienda' OR p_paths IS NULL OR cardinality(p_paths)>12 THEN RAISE EXCEPTION 'Cuenta no disponible'; END IF;
    FOREACH v_path IN ARRAY p_paths LOOP
        IF (storage.foldername(v_path))[1] IS DISTINCT FROM auth.uid()::text THEN RAISE EXCEPTION 'Archivo no autorizado'; END IF;
        INSERT INTO public.storage_cleanup_jobs(usuario_id,path,available_after) VALUES(auth.uid(),v_path,now())
        ON CONFLICT(path) DO UPDATE SET available_after=least(public.storage_cleanup_jobs.available_after,now());
    END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.queue_failed_uploads(text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.queue_failed_uploads(text[]) TO authenticated;
CREATE OR REPLACE FUNCTION public.queue_deleted_store_photos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE url text;
BEGIN
    FOREACH url IN ARRAY coalesce(OLD.fotografias,ARRAY[]::text[]) LOOP
        IF url LIKE '%/storage/v1/object/public/tiendas/'||OLD.usuario_id::text||'/%' THEN
            INSERT INTO public.storage_cleanup_jobs(usuario_id,path)
            VALUES(OLD.usuario_id,split_part(url,'/storage/v1/object/public/tiendas/',2)) ON CONFLICT(path) DO NOTHING;
        END IF;
    END LOOP;
    RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.queue_deleted_store_photos() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS queue_deleted_store_photos ON public.tiendas;
CREATE TRIGGER queue_deleted_store_photos AFTER DELETE ON public.tiendas FOR EACH ROW EXECUTE FUNCTION public.queue_deleted_store_photos();

-- Register every new object, including uploads whose HTTP response is lost.
CREATE OR REPLACE FUNCTION public.queue_unattached_upload()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE folder text;
BEGIN
    IF NEW.bucket_id<>'tiendas' THEN RETURN NEW; END IF;
    folder:=(storage.foldername(NEW.name))[1];
    IF folder ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        INSERT INTO public.storage_cleanup_jobs(usuario_id,path) VALUES(folder::uuid,NEW.name) ON CONFLICT(path) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.queue_unattached_upload() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS queue_unattached_upload ON storage.objects;
CREATE TRIGGER queue_unattached_upload AFTER INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION public.queue_unattached_upload();
COMMIT;

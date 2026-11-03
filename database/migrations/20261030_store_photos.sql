BEGIN;
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS fotografias_version integer NOT NULL DEFAULT 0;
REVOKE UPDATE(fotografias) ON public.tiendas FROM authenticated;
REVOKE INSERT(fotografias) ON public.tiendas FROM authenticated;

CREATE TABLE IF NOT EXISTS public.storage_cleanup_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id uuid NOT NULL,
    path text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), claimed_at timestamptz,
    available_after timestamptz NOT NULL DEFAULT now()+interval '24 hours'
);
ALTER TABLE public.storage_cleanup_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.storage_cleanup_jobs FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.guardar_fotos_tienda(p_urls text[],p_expected_version integer)
RETURNS public.tiendas LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE shop public.tiendas; url text; v_path text; old_url text; origin text;
BEGIN
    IF public.sprint1_role() IS DISTINCT FROM 'tienda' THEN RAISE EXCEPTION 'Se requiere una cuenta tienda activa'; END IF;
    origin:=regexp_replace(auth.jwt()->>'iss','/auth/v1/?$','');
    SELECT * INTO shop FROM public.tiendas WHERE usuario_id=auth.uid() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Registra primero tu tienda'; END IF;
    IF shop.fotografias_version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'Las fotos cambiaron en otra sesión. Actualiza la página'; END IF;
    IF p_urls IS NULL OR cardinality(p_urls)>12 OR cardinality(p_urls)<>(SELECT count(DISTINCT x) FROM unnest(p_urls) x) THEN
        RAISE EXCEPTION 'Selecciona hasta 12 fotografías diferentes';
    END IF;
    FOREACH url IN ARRAY p_urls LOOP
        IF EXISTS(SELECT 1 FROM public.storage_cleanup_jobs j WHERE j.claimed_at IS NOT NULL
            AND j.path=split_part(url,'/storage/v1/object/public/tiendas/',2)) THEN
            RAISE EXCEPTION 'Esta fotografía está pendiente de eliminación. Súbela de nuevo';
        END IF;
        -- Permit unchanged legacy URLs; new photos must reference an owned object.
        IF url=ANY(coalesce(shop.fotografias,ARRAY[]::text[])) THEN CONTINUE; END IF;
        IF origin IS NULL OR origin !~ '^https://[^/]+$' OR
            left(url,length(origin||'/storage/v1/object/public/tiendas/'))<>origin||'/storage/v1/object/public/tiendas/' THEN
            RAISE EXCEPTION 'URL de fotografía no válida para este proyecto';
        END IF;
        v_path:=split_part(url,'/storage/v1/object/public/tiendas/',2);
        IF (storage.foldername(v_path))[1]<>auth.uid()::text OR NOT EXISTS (
            SELECT 1 FROM storage.objects o WHERE o.bucket_id='tiendas' AND o.name=v_path) THEN
            RAISE EXCEPTION 'La fotografía no pertenece a tu cuenta';
        END IF;
    END LOOP;
    FOREACH old_url IN ARRAY coalesce(shop.fotografias,ARRAY[]::text[]) LOOP
        IF NOT old_url=ANY(p_urls) AND old_url LIKE '%/storage/v1/object/public/tiendas/'||auth.uid()::text||'/%' THEN
            INSERT INTO public.storage_cleanup_jobs(usuario_id,path)
            VALUES(auth.uid(),split_part(old_url,'/storage/v1/object/public/tiendas/',2)) ON CONFLICT(path) DO NOTHING;
        END IF;
    END LOOP;
    UPDATE public.tiendas SET fotografias=p_urls,fotografias_version=fotografias_version+1
    WHERE id=shop.id RETURNING * INTO shop;
    RETURN shop;
END;
$$;
REVOKE ALL ON FUNCTION public.guardar_fotos_tienda(text[],integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.guardar_fotos_tienda(text[],integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirmar_limpieza_foto(p_path text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
    IF public.sprint1_role() IS DISTINCT FROM 'tienda' THEN RAISE EXCEPTION 'Cuenta no disponible'; END IF;
    DELETE FROM public.storage_cleanup_jobs WHERE usuario_id=auth.uid() AND path=p_path
        AND NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='tiendas' AND o.name=p_path);
END;
$$;
REVOKE ALL ON FUNCTION public.confirmar_limpieza_foto(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirmar_limpieza_foto(text) TO authenticated;

-- Storage API must still verify the binary MIME type; bucket limits apply server-side.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('tiendas','tiendas',true,5242880,ARRAY['image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO NOTHING;
UPDATE storage.buckets b SET file_size_limit=least(coalesce(b.file_size_limit,5242880),5242880),
    allowed_mime_types=CASE WHEN b.allowed_mime_types IS NULL THEN ARRAY['image/jpeg','image/png','image/webp']
        ELSE ARRAY(SELECT mime FROM unnest(b.allowed_mime_types) mime WHERE mime IN ('image/jpeg','image/png','image/webp')) END
WHERE b.id='tiendas';
COMMIT;

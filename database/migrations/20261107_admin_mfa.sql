BEGIN;
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
    SELECT coalesce(auth.jwt()->>'aal','aal1')='aal2' AND EXISTS(
        SELECT 1 FROM public.usuarios u WHERE u.id=auth.uid() AND u.activo
        AND u.rol::text IN ('administrador','superAdministrador'))
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
-- This endpoint previously checked the actor role directly, so require AAL2 here too.
CREATE OR REPLACE FUNCTION public.sprint3_admin_set_user_active(p_user_id uuid,p_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor_role text; target_role text;
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Se requiere una sesión administrativa con segundo factor'; END IF;
    IF p_user_id IS NULL OR p_active IS NULL THEN RAISE EXCEPTION 'Indica el usuario y el estado de cuenta'; END IF;
    IF p_user_id=auth.uid() THEN RAISE EXCEPTION 'No puedes cambiar el estado de tu propia cuenta'; END IF;
    -- Serialize changes of account activation to avoid actor/target deadlocks.
    PERFORM pg_catalog.pg_advisory_xact_lock(20261107::bigint);
    SELECT rol::text INTO actor_role FROM public.usuarios WHERE id=auth.uid() AND activo FOR UPDATE;
    IF actor_role IS NULL OR actor_role NOT IN ('administrador','superAdministrador') THEN RAISE EXCEPTION 'Cuenta no disponible'; END IF;
    SELECT rol::text INTO target_role FROM public.usuarios WHERE id=p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró el usuario'; END IF;
    IF target_role='superAdministrador' AND actor_role<>'superAdministrador' THEN RAISE EXCEPTION 'Solo un superadministrador puede cambiar esa cuenta'; END IF;
    UPDATE public.usuarios SET activo=p_active WHERE id=p_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.sprint3_admin_set_user_active(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sprint3_admin_set_user_active(uuid,boolean) TO authenticated;
COMMIT;

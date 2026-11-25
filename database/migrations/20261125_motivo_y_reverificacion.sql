-- 20261125_motivo_y_reverificacion (sesión 8, 25 nov 2026)
-- 1. Desactivar una cuenta exige un motivo escrito (como ya ocurría al rechazar o suspender una
--    tienda). El motivo se guarda en usuarios.motivo_estado y se borra al reactivar.
-- 2. Las acciones críticas de administración exigen haber confirmado la identidad hace menos de
--    5 minutos con un segundo factor (huella / passkey WebAuthn o código TOTP). Se comprueba en el
--    servidor con la marca «amr» del JWT de Supabase, que guarda el método y la hora de cada
--    verificación. Acciones críticas: desactivar una cuenta, rechazar o suspender una tienda,
--    desactivar una categoría y activar el modo mantenimiento.
--    Los procesos internos sin usuario (auth.uid() nulo) no se ven afectados.
-- Idempotente.

ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS motivo_estado text;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_motivo_estado_largo' AND conrelid = 'public.usuarios'::regclass) THEN
        ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_motivo_estado_largo CHECK (motivo_estado IS NULL OR length(motivo_estado) <= 500);
    END IF;
END $$;

-- ¿La sesión confirmó un segundo factor en los últimos p_segundos?
CREATE OR REPLACE FUNCTION public.drivefix_reverificacion_reciente(p_segundos integer DEFAULT 300)
RETURNS boolean
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(auth.jwt()->'amr') = 'array' THEN auth.jwt()->'amr' ELSE '[]'::jsonb END) AS e
    WHERE e->>'method' IN ('totp', 'mfa/totp', 'webauthn', 'mfa/webauthn', 'phone', 'mfa/phone')
      AND (e->>'timestamp') ~ '^[0-9]+$'
      AND (e->>'timestamp')::bigint >= extract(epoch FROM now())::bigint - p_segundos
  )
$$;
REVOKE ALL ON FUNCTION public.drivefix_reverificacion_reciente(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.drivefix_reverificacion_reciente(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.drivefix_exigir_reverificacion()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_critica boolean := false;
BEGIN
    IF auth.uid() IS NULL THEN RETURN NEW; END IF;
    IF TG_TABLE_NAME = 'usuarios' THEN
        IF OLD.activo AND NOT NEW.activo THEN
            IF NULLIF(btrim(NEW.motivo_estado), '') IS NULL THEN
                RAISE EXCEPTION 'Indica el motivo para desactivar la cuenta' USING ERRCODE = '22023';
            END IF;
            v_critica := true;
        END IF;
    ELSIF TG_TABLE_NAME = 'tiendas' THEN
        v_critica := NEW.estado IS DISTINCT FROM OLD.estado AND NEW.estado::text IN ('rechazada', 'suspendida') AND public.is_admin();
    ELSIF TG_TABLE_NAME = 'categorias_repuesto' THEN
        v_critica := OLD.activo AND NOT NEW.activo;
    ELSIF TG_TABLE_NAME = 'configuracion_sistema' THEN
        v_critica := NOT coalesce(OLD.mantenimiento_activo, false) AND coalesce(NEW.mantenimiento_activo, false);
    END IF;
    IF v_critica AND NOT public.drivefix_reverificacion_reciente() THEN
        RAISE EXCEPTION 'Confirma tu identidad con tu huella, passkey o código para hacer este cambio' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.drivefix_exigir_reverificacion() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER b_exigir_reverificacion BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.drivefix_exigir_reverificacion();
CREATE OR REPLACE TRIGGER b_exigir_reverificacion BEFORE UPDATE ON public.tiendas FOR EACH ROW EXECUTE FUNCTION public.drivefix_exigir_reverificacion();
CREATE OR REPLACE TRIGGER b_exigir_reverificacion BEFORE UPDATE ON public.categorias_repuesto FOR EACH ROW EXECUTE FUNCTION public.drivefix_exigir_reverificacion();
CREATE OR REPLACE TRIGGER b_exigir_reverificacion BEFORE UPDATE ON public.configuracion_sistema FOR EACH ROW EXECUTE FUNCTION public.drivefix_exigir_reverificacion();

-- Activar / desactivar cuenta con motivo. Es una función nueva: la anterior (sin motivo) queda igual,
-- pero el trigger ya no le deja desactivar sin motivo.
CREATE OR REPLACE FUNCTION public.drivefix_admin_set_user_active(p_user_id uuid, p_active boolean, p_motivo text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE actor_role text; target_role text; v_motivo text := NULLIF(btrim(p_motivo), '');
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Se requiere una sesión administrativa con segundo factor'; END IF;
    IF p_user_id IS NULL OR p_active IS NULL THEN RAISE EXCEPTION 'Indica el usuario y el estado de cuenta'; END IF;
    IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'No puedes cambiar el estado de tu propia cuenta'; END IF;
    IF NOT p_active AND v_motivo IS NULL THEN RAISE EXCEPTION 'Indica el motivo para desactivar la cuenta'; END IF;
    IF length(v_motivo) > 500 THEN RAISE EXCEPTION 'El motivo no puede superar 500 caracteres'; END IF;
    -- Serialize changes of account activation to avoid actor/target deadlocks.
    PERFORM pg_catalog.pg_advisory_xact_lock(20261107::bigint);
    SELECT rol::text INTO actor_role FROM public.usuarios WHERE id = auth.uid() AND activo FOR UPDATE;
    IF actor_role IS NULL OR actor_role NOT IN ('administrador', 'superAdministrador') THEN RAISE EXCEPTION 'Cuenta no disponible'; END IF;
    SELECT rol::text INTO target_role FROM public.usuarios WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró el usuario'; END IF;
    IF target_role = 'superAdministrador' AND actor_role <> 'superAdministrador' THEN RAISE EXCEPTION 'Solo un superadministrador puede cambiar esa cuenta'; END IF;
    UPDATE public.usuarios SET activo = p_active, motivo_estado = CASE WHEN p_active THEN NULL ELSE v_motivo END WHERE id = p_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.drivefix_admin_set_user_active(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.drivefix_admin_set_user_active(uuid, boolean, text) TO authenticated;

-- La lista de usuarios de admin muestra el motivo de las cuentas desactivadas (función nueva para no
-- cambiar el tipo de retorno de admin_user_page).
CREATE OR REPLACE FUNCTION public.drivefix_admin_user_page(p_search text DEFAULT NULL, p_offset integer DEFAULT 0, p_limit integer DEFAULT 26)
RETURNS TABLE(id uuid, nombre text, apellido text, telefono text, correo text, rol text, activo boolean, fecha_creacion timestamptz, motivo_estado text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Se requiere rol administrador'; END IF;
    IF p_offset IS NULL OR p_offset < 0 OR p_limit IS NULL OR p_limit < 1 OR p_limit > 26 OR length(p_search) > 160 THEN RAISE EXCEPTION 'Filtros no válidos'; END IF;
    RETURN QUERY SELECT u.id, u.nombre, u.apellido, u.telefono, a.email::text, u.rol::text, u.activo, u.fecha_creacion, u.motivo_estado
    FROM public.usuarios u JOIN auth.users a ON a.id = u.id
    WHERE nullif(btrim(p_search), '') IS NULL OR concat_ws(' ', u.nombre, u.apellido, u.telefono, a.email, u.rol::text, u.id::text) ILIKE '%' || replace(replace(replace(p_search, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    ORDER BY u.fecha_creacion DESC, u.id LIMIT p_limit OFFSET p_offset;
END;
$$;
REVOKE ALL ON FUNCTION public.drivefix_admin_user_page(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.drivefix_admin_user_page(text, integer, integer) TO authenticated;

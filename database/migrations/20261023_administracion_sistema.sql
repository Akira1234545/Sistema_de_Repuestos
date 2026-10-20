-- Administrative user management and system settings.
-- Apply after 20261006_sprint2.sql and 20261007_rls_store_review.sql.
BEGIN;

DO $$
BEGIN
    IF to_regprocedure('public.is_admin()') IS NULL THEN
        RAISE EXCEPTION 'Migración detenida: aplica primero 20261006_sprint2.sql para crear public.is_admin()';
    END IF;
    
END;
$$;

CREATE TABLE public.configuracion_sistema (
    id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    correo_soporte text,
    telefono_soporte text,
    mantenimiento_activo boolean NOT NULL DEFAULT FALSE,
    mensaje_mantenimiento text NOT NULL DEFAULT 'El sistema está temporalmente en mantenimiento. Inténtalo más tarde.',
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
    CONSTRAINT configuracion_sistema_correo_longitud CHECK (correo_soporte IS NULL OR length(correo_soporte) <= 254),
    CONSTRAINT configuracion_sistema_telefono_longitud CHECK (telefono_soporte IS NULL OR length(telefono_soporte) <= 40),
    CONSTRAINT configuracion_sistema_mensaje_longitud CHECK (length(mensaje_mantenimiento) BETWEEN 1 AND 500)
);

INSERT INTO public.configuracion_sistema (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.configuracion_sistema ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.configuracion_sistema FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sprint3_admin_list_users()
RETURNS TABLE (
    id uuid,
    nombre text,
    apellido text,
    telefono text,
    correo text,
    rol text,
    activo boolean,
    fecha_creacion timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Se requiere rol administrador';
    END IF;

    RETURN QUERY
    SELECT u.id, u.nombre, u.apellido, u.telefono, a.email::text, u.rol::text, u.activo, u.fecha_creacion
    FROM public.usuarios u
    JOIN auth.users a ON a.id = u.id
    ORDER BY u.fecha_creacion DESC, u.id;
END;
$$;
REVOKE ALL ON FUNCTION public.sprint3_admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sprint3_admin_list_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.sprint3_admin_set_user_active(
    p_user_id uuid,
    p_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_role text;
    v_target_role text;
BEGIN
    IF p_user_id IS NULL OR p_active IS NULL THEN
        RAISE EXCEPTION 'Indica el usuario y el estado de cuenta';
    END IF;
    IF p_user_id = (SELECT auth.uid()) THEN
        RAISE EXCEPTION 'No puedes cambiar el estado de tu propia cuenta';
    END IF;

    SELECT u.rol::text INTO v_actor_role
    FROM public.usuarios u
    WHERE u.id = (SELECT auth.uid()) AND u.activo = TRUE
    FOR UPDATE;
    IF NOT FOUND OR v_actor_role NOT IN ('administrador', 'superAdministrador') THEN
        RAISE EXCEPTION 'Se requiere una cuenta administrativa activa';
    END IF;

    SELECT u.rol::text INTO v_target_role
    FROM public.usuarios u
    WHERE u.id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el usuario';
    END IF;
    IF v_target_role = 'superAdministrador' AND v_actor_role <> 'superAdministrador' THEN
        RAISE EXCEPTION 'Solo un superadministrador puede cambiar el estado de otra cuenta superadministradora';
    END IF;

    UPDATE public.usuarios
    SET activo = p_active
    WHERE id = p_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.sprint3_admin_set_user_active(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sprint3_admin_set_user_active(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.sprint3_get_system_status()
RETURNS TABLE (
    mantenimiento_activo boolean,
    mensaje_mantenimiento text,
    correo_soporte text,
    telefono_soporte text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT c.mantenimiento_activo, c.mensaje_mantenimiento,
           c.correo_soporte, c.telefono_soporte
    FROM public.configuracion_sistema c
    WHERE c.id = 1
$$;
REVOKE ALL ON FUNCTION public.sprint3_get_system_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sprint3_get_system_status() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.sprint3_admin_get_system_settings()
RETURNS TABLE (
    correo_soporte text,
    telefono_soporte text,
    mantenimiento_activo boolean,
    mensaje_mantenimiento text,
    actualizado_en timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Se requiere rol administrador';
    END IF;

    RETURN QUERY
    SELECT c.correo_soporte, c.telefono_soporte, c.mantenimiento_activo,
           c.mensaje_mantenimiento, c.actualizado_en
    FROM public.configuracion_sistema c
    WHERE c.id = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.sprint3_admin_get_system_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sprint3_admin_get_system_settings() TO authenticated;

CREATE OR REPLACE FUNCTION public.sprint3_admin_update_system_settings(
    p_support_email text,
    p_support_phone text,
    p_maintenance_enabled boolean,
    p_maintenance_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_email text := NULLIF(btrim(p_support_email), '');
    v_phone text := NULLIF(btrim(p_support_phone), '');
    v_message text := NULLIF(btrim(p_maintenance_message), '');
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Se requiere rol administrador';
    END IF;
    IF p_maintenance_enabled IS NULL THEN
        RAISE EXCEPTION 'Indica si el modo mantenimiento está activo';
    END IF;
    IF v_email IS NOT NULL AND (
        length(v_email) > 254
        OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ) THEN
        RAISE EXCEPTION 'El correo de soporte no tiene un formato válido';
    END IF;
    IF v_phone IS NOT NULL AND length(v_phone) > 40 THEN
        RAISE EXCEPTION 'El teléfono de soporte no puede superar 40 caracteres';
    END IF;
    IF v_message IS NOT NULL AND length(v_message) > 500 THEN
        RAISE EXCEPTION 'El mensaje de mantenimiento no puede superar 500 caracteres';
    END IF;
    IF p_maintenance_enabled AND v_message IS NULL THEN
        RAISE EXCEPTION 'Escribe el mensaje que verán los usuarios durante el mantenimiento';
    END IF;

    INSERT INTO public.configuracion_sistema (
        id, correo_soporte, telefono_soporte, mantenimiento_activo,
        mensaje_mantenimiento, actualizado_en, actualizado_por
    )
    VALUES (
        1, v_email, v_phone, p_maintenance_enabled,
        coalesce(v_message, 'El sistema está temporalmente en mantenimiento. Inténtalo más tarde.'),
        now(), (SELECT auth.uid())
    )
    ON CONFLICT (id) DO UPDATE
    SET correo_soporte = EXCLUDED.correo_soporte,
        telefono_soporte = EXCLUDED.telefono_soporte,
        mantenimiento_activo = EXCLUDED.mantenimiento_activo,
        mensaje_mantenimiento = EXCLUDED.mensaje_mantenimiento,
        actualizado_en = EXCLUDED.actualizado_en,
        actualizado_por = EXCLUDED.actualizado_por;
END;
$$;
REVOKE ALL ON FUNCTION public.sprint3_admin_update_system_settings(text, text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sprint3_admin_update_system_settings(text, text, boolean, text) TO authenticated;

COMMIT;

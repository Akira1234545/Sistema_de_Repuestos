-- Sesión 8 (c): la reverificación también acepta una passkey usada hace poco.
-- Supabase ahora ofrece las passkeys en Authentication → Passkeys (inicio de sesión con WebAuthn),
-- no como factor MFA. La app hace la ceremonia sin reemplazar la sesión del administrador y
-- Supabase Auth registra el uso en auth.webauthn_credentials.last_used_at, que solo actualiza
-- tras validar la firma. Se acepta, para el usuario actual, un uso de menos de p_segundos.
-- Ventana: 25 s (la app vuelve a pedir la verificación pasados 15 s; el resto cubre la red).
-- Se usa SQL dinámico con to_regclass para que la función se cree aunque la tabla no exista
-- (por ejemplo, en la base de pruebas).

CREATE OR REPLACE FUNCTION public.drivefix_reverificacion_reciente(p_segundos integer DEFAULT 25)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_ok boolean := false;
BEGIN
    IF v_uid IS NULL THEN RETURN false; END IF;

    SELECT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(auth.jwt()->'amr') = 'array' THEN auth.jwt()->'amr' ELSE '[]'::jsonb END) AS e
        WHERE e->>'method' IN ('totp', 'mfa/totp', 'webauthn', 'mfa/webauthn', 'phone', 'mfa/phone')
          AND (e->>'timestamp') ~ '^[0-9]+$'
          AND (e->>'timestamp')::bigint >= extract(epoch FROM now())::bigint - p_segundos
    ) INTO v_ok;
    IF v_ok THEN RETURN true; END IF;

    IF to_regclass('auth.webauthn_credentials') IS NOT NULL THEN
        EXECUTE 'SELECT EXISTS (SELECT 1 FROM auth.webauthn_credentials WHERE user_id = $1 AND last_used_at >= now() - make_interval(secs => $2))'
            INTO v_ok USING v_uid, p_segundos;
    END IF;
    RETURN coalesce(v_ok, false);
END;
$$;
REVOKE ALL ON FUNCTION public.drivefix_reverificacion_reciente(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.drivefix_reverificacion_reciente(integer) TO authenticated;

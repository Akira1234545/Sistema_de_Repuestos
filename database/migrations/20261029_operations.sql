BEGIN;
CREATE OR REPLACE FUNCTION public.marcar_notificaciones_leidas(p_ids uuid[] DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
    IF NOT public.account_is_active() THEN RAISE EXCEPTION 'Cuenta no disponible'; END IF;
    IF cardinality(p_ids)>100 THEN RAISE EXCEPTION 'Demasiadas notificaciones'; END IF;
    UPDATE public.notificaciones SET leida=true
    WHERE usuario_id=auth.uid() AND NOT leida AND (p_ids IS NULL OR id=ANY(p_ids));
END;
$$;
REVOKE ALL ON FUNCTION public.marcar_notificaciones_leidas(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.marcar_notificaciones_leidas(uuid[]) TO authenticated;

-- CAS prevents silent replacement of another administrator's settings.
CREATE OR REPLACE FUNCTION public.guardar_configuracion_segura(p_support_email text,p_support_phone text,
    p_maintenance_enabled boolean,p_maintenance_message text,p_expected_version timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE version timestamptz;
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Se requiere rol administrador'; END IF;
    SELECT actualizado_en INTO version FROM public.configuracion_sistema WHERE id=1 FOR UPDATE;
    IF version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'La configuración cambió. Actualiza la página antes de guardar'; END IF;
    PERFORM public.sprint3_admin_update_system_settings(p_support_email,p_support_phone,p_maintenance_enabled,p_maintenance_message);
END;
$$;
REVOKE ALL ON FUNCTION public.guardar_configuracion_segura(text,text,boolean,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.guardar_configuracion_segura(text,text,boolean,text,timestamptz) TO authenticated;
COMMIT;

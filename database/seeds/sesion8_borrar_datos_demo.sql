-- Borra los datos de demostración de la sesión 8 (cuentas @drivefix.test y todo lo que crearon).
-- También quita las propuestas de esas tiendas en solicitudes reales y las reseñas que recibieron
-- JMotors y RepuestoHot de clientes demo. Las fotos de Storage se quitan aparte (carpetas de esos usuarios).
BEGIN;
CREATE TEMP TABLE demo_users ON COMMIT DROP AS SELECT id FROM auth.users WHERE email LIKE '%@drivefix.test';
DELETE FROM public.resenas WHERE usuario_id IN (SELECT id FROM demo_users) OR tienda_id IN (SELECT id FROM public.tiendas WHERE usuario_id IN (SELECT id FROM demo_users));
DELETE FROM public.favoritos_promocion WHERE usuario_id IN (SELECT id FROM demo_users) OR promocion_id IN (SELECT p.id FROM public.promociones p JOIN public.tiendas t ON t.id = p.tienda_id WHERE t.usuario_id IN (SELECT id FROM demo_users));
DELETE FROM public.favoritos_tienda WHERE usuario_id IN (SELECT id FROM demo_users) OR tienda_id IN (SELECT id FROM public.tiendas WHERE usuario_id IN (SELECT id FROM demo_users));
DELETE FROM public.favoritos_solicitud WHERE usuario_id IN (SELECT id FROM demo_users);
DELETE FROM public.notificaciones WHERE usuario_id IN (SELECT id FROM demo_users) OR solicitud_id IN (SELECT id FROM public.solicitudes WHERE usuario_id IN (SELECT id FROM demo_users)) OR propuesta_id IN (SELECT p.id FROM public.propuestas p JOIN public.tiendas t ON t.id = p.tienda_id WHERE t.usuario_id IN (SELECT id FROM demo_users));
UPDATE public.solicitudes SET propuesta_seleccionada_id = NULL WHERE usuario_id IN (SELECT id FROM demo_users);
DELETE FROM public.propuestas WHERE solicitud_id IN (SELECT id FROM public.solicitudes WHERE usuario_id IN (SELECT id FROM demo_users)) OR tienda_id IN (SELECT id FROM public.tiendas WHERE usuario_id IN (SELECT id FROM demo_users));
DELETE FROM public.historial_solicitudes WHERE solicitud_id IN (SELECT id FROM public.solicitudes WHERE usuario_id IN (SELECT id FROM demo_users));
DELETE FROM public.solicitudes WHERE usuario_id IN (SELECT id FROM demo_users);
DELETE FROM public.promociones WHERE tienda_id IN (SELECT id FROM public.tiendas WHERE usuario_id IN (SELECT id FROM demo_users));
DELETE FROM public.vehiculos WHERE usuario_id IN (SELECT id FROM demo_users);
DELETE FROM public.tienda_categorias WHERE tienda_id IN (SELECT id FROM public.tiendas WHERE usuario_id IN (SELECT id FROM demo_users));
DELETE FROM public.tiendas WHERE usuario_id IN (SELECT id FROM demo_users);
DELETE FROM public.usuarios WHERE id IN (SELECT id FROM demo_users);
DELETE FROM auth.users WHERE id IN (SELECT id FROM demo_users);
COMMIT;

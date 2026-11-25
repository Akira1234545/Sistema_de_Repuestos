-- 20261124_seguridad_vistas (sesión 8, 24 nov 2026)
-- Aviso ERROR del linter de Supabase «security_definer_view» en 5 vistas públicas:
--   sprint2_tiendas_publicas, sprint2_tienda_contacto, resenas_publicas, resenas_resumen,
--   sprint3_resenas_tienda.
--
-- Por qué no basta con security_invoker = true: las 5 existen para mostrar columnas públicas de
-- tablas cerradas. Las RLS de tiendas y usuarios solo dejan ver la fila propia (o al admin) y anon no
-- tiene permisos sobre tiendas, usuarios ni resenas. Con security_invoker a secas, la portada,
-- /tiendas, las reseñas y el contacto dejarían de funcionar.
--
-- Decisión: cada vista pasa a security_invoker = true y lee de una función SECURITY DEFINER con
-- search_path = '' y nombres calificados, que devuelve exactamente las mismas columnas y aplica los
-- mismos filtros que la vista anterior:
--   * tienda pública: activa, estado 'aprobada', dueño activo y con rol tienda (suspendidas,
--     pendientes y rechazadas siguen fuera);
--   * contacto: solo el cliente que seleccionó una propuesta de esa tienda
--     (public.sprint2_can_view_selected_store, sin cambios);
--   * reseñas con nombre del cliente: solo la tienda dueña.
-- Los nombres, columnas y tipos de las vistas no cambian (RETURNS TABLE pierde la precisión de
-- numeric, por eso la vista la vuelve a fijar con un cast): el front no se toca.
-- EXECUTE se concede solo a los roles que ya podían leer cada vista; PUBLIC queda sin acceso.
-- Idempotente: CREATE OR REPLACE + ALTER VIEW ... SET + GRANT/REVOKE repetibles.

-- 1. Tiendas públicas (anon y authenticated)
CREATE OR REPLACE FUNCTION public.drivefix_tiendas_publicas()
RETURNS TABLE (id uuid, nombre text, descripcion text, horario text, fotografias text[], telefono text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT t.id, t.nombre, t.descripcion, t.horario, t.fotografias, t.telefono
  FROM public.tiendas t
  JOIN public.usuarios u ON u.id = t.usuario_id
  WHERE t.activa AND t.estado = 'aprobada'::public.store_status AND u.activo AND u.rol::text = 'tienda'
$$;

-- 2. Contacto de la tienda (solo authenticated; la función decide quién ve filas)
CREATE OR REPLACE FUNCTION public.drivefix_tienda_contacto()
RETURNS TABLE (id uuid, nombre text, telefono text, direccion text, latitud numeric(10,7), longitud numeric(10,7))
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT t.id, t.nombre, t.telefono, t.direccion, t.latitud, t.longitud
  FROM public.tiendas t
  WHERE public.sprint2_can_view_selected_store(t.id)
$$;

-- 3. Reseñas públicas (sin datos del cliente)
CREATE OR REPLACE FUNCTION public.drivefix_resenas_publicas()
RETURNS TABLE (id uuid, tienda_id uuid, calificacion integer, comentario text, fecha_creacion timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT r.id, r.tienda_id, r.calificacion, r.comentario, r.fecha_creacion
  FROM public.resenas r
  JOIN public.drivefix_tiendas_publicas() t ON t.id = r.tienda_id
$$;

-- 4. Resumen de reseñas por tienda pública
CREATE OR REPLACE FUNCTION public.drivefix_resenas_resumen()
RETURNS TABLE (tienda_id uuid, total bigint, promedio numeric(3,2))
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT t.id, count(r.id), avg(r.calificacion)::numeric(3,2)
  FROM public.drivefix_tiendas_publicas() t
  LEFT JOIN public.resenas r ON r.tienda_id = t.id
  GROUP BY t.id
$$;

-- 5. Reseñas recibidas con nombre del cliente (solo la tienda dueña)
CREATE OR REPLACE FUNCTION public.drivefix_resenas_tienda_propia()
RETURNS TABLE (id uuid, tienda_id uuid, calificacion integer, comentario text, fecha_creacion timestamptz, nombre_cliente text, apellido_cliente text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT r.id, r.tienda_id, r.calificacion, r.comentario, r.fecha_creacion, u.nombre, u.apellido
  FROM public.resenas r
  JOIN public.usuarios u ON u.id = r.usuario_id
  WHERE public.sprint1_role() = 'tienda'
    AND EXISTS (SELECT 1 FROM public.tiendas t WHERE t.id = r.tienda_id AND t.usuario_id = (SELECT auth.uid()))
$$;

REVOKE ALL ON FUNCTION public.drivefix_tiendas_publicas() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.drivefix_tienda_contacto() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.drivefix_resenas_publicas() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.drivefix_resenas_resumen() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.drivefix_resenas_tienda_propia() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.drivefix_tiendas_publicas() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drivefix_tienda_contacto() TO authenticated;
GRANT EXECUTE ON FUNCTION public.drivefix_resenas_publicas() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drivefix_resenas_resumen() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drivefix_resenas_tienda_propia() TO authenticated;

-- Las vistas conservan nombre, columnas y permisos; solo cambia de dónde leen.
CREATE OR REPLACE VIEW public.sprint2_tiendas_publicas AS
  SELECT id, nombre, descripcion, horario, fotografias, telefono FROM public.drivefix_tiendas_publicas();
CREATE OR REPLACE VIEW public.sprint2_tienda_contacto AS
  SELECT id, nombre, telefono, direccion, latitud::numeric(10,7) AS latitud, longitud::numeric(10,7) AS longitud FROM public.drivefix_tienda_contacto();
CREATE OR REPLACE VIEW public.resenas_publicas AS
  SELECT id, tienda_id, calificacion, comentario, fecha_creacion FROM public.drivefix_resenas_publicas();
CREATE OR REPLACE VIEW public.resenas_resumen AS
  SELECT tienda_id, total, promedio::numeric(3,2) AS promedio FROM public.drivefix_resenas_resumen();
CREATE OR REPLACE VIEW public.sprint3_resenas_tienda AS
  SELECT id, tienda_id, calificacion, comentario, fecha_creacion, nombre_cliente, apellido_cliente FROM public.drivefix_resenas_tienda_propia();

ALTER VIEW public.sprint2_tiendas_publicas SET (security_invoker = true, security_barrier = true);
ALTER VIEW public.sprint2_tienda_contacto SET (security_invoker = true, security_barrier = true);
ALTER VIEW public.resenas_publicas SET (security_invoker = true, security_barrier = true);
ALTER VIEW public.resenas_resumen SET (security_invoker = true, security_barrier = true);
ALTER VIEW public.sprint3_resenas_tienda SET (security_invoker = true, security_barrier = true);

-- Mismos permisos de lectura que antes (por si una instalación los tenía más abiertos).
REVOKE ALL ON public.sprint2_tiendas_publicas, public.sprint2_tienda_contacto, public.resenas_publicas,
  public.resenas_resumen, public.sprint3_resenas_tienda FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sprint2_tiendas_publicas, public.resenas_publicas, public.resenas_resumen TO anon, authenticated;
GRANT SELECT ON public.sprint2_tienda_contacto, public.sprint3_resenas_tienda TO authenticated;

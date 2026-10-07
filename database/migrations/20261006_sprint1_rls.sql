-- Incremental, no destructive changes. Apply after BD_Sistema_Repuestos.sql.
-- Role checks run as the function owner to avoid RLS recursion on public.usuarios.
CREATE OR REPLACE FUNCTION public.sprint1_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT u.rol::text
    FROM public.usuarios AS u
    WHERE u.id = (SELECT auth.uid()) AND u.activo = TRUE
$$;

CREATE OR REPLACE FUNCTION public.sprint1_vehicle_has_open_request(vehicle_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.solicitudes AS s
        WHERE public.sprint1_role() = 'tienda'
          AND s.vehiculo_id = $1
          AND s.estado IN ('publicada'::public.request_status, 'recibiendo_propuestas'::public.request_status)
    )
$$;

REVOKE ALL ON FUNCTION public.sprint1_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sprint1_role() TO authenticated;
REVOKE ALL ON FUNCTION public.sprint1_vehicle_has_open_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sprint1_vehicle_has_open_request(uuid) TO authenticated;

-- Remove any table-level API write grants inherited from project defaults.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.usuarios, public.categorias_repuesto,
    public.tipos_vehiculo, public.marcas, public.modelos, public.vehiculos,
    public.tiendas, public.solicitudes FROM anon, authenticated;

-- The catalogs are read-only in Sprint 1. Only active options are exposed.
ALTER TABLE public.categorias_repuesto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_vehiculo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marcas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modelos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sprint1_catalog_active_read ON public.categorias_repuesto;
CREATE POLICY sprint1_catalog_active_read ON public.categorias_repuesto
    FOR SELECT TO anon, authenticated USING (activo = TRUE);
DROP POLICY IF EXISTS sprint1_catalog_active_read ON public.tipos_vehiculo;
CREATE POLICY sprint1_catalog_active_read ON public.tipos_vehiculo
    FOR SELECT TO anon, authenticated USING (activo = TRUE);
DROP POLICY IF EXISTS sprint1_catalog_active_read ON public.marcas;
CREATE POLICY sprint1_catalog_active_read ON public.marcas
    FOR SELECT TO anon, authenticated USING (activo = TRUE);
DROP POLICY IF EXISTS sprint1_catalog_active_read ON public.modelos;
CREATE POLICY sprint1_catalog_active_read ON public.modelos
    FOR SELECT TO anon, authenticated USING (activo = TRUE);

-- Vehicle owner can manage their own records. A store sees vehicle details only
-- while the vehicle is attached to a currently open request.
ALTER TABLE public.vehiculos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sprint1_vehicles_read ON public.vehiculos;
CREATE POLICY sprint1_vehicles_read ON public.vehiculos
    FOR SELECT TO authenticated
    USING (
        usuario_id = (SELECT auth.uid())
        OR (public.sprint1_role() = 'tienda' AND public.sprint1_vehicle_has_open_request(id))
    );
DROP POLICY IF EXISTS sprint1_vehicles_insert_owner ON public.vehiculos;
CREATE POLICY sprint1_vehicles_insert_owner ON public.vehiculos
    FOR INSERT TO authenticated
    WITH CHECK (usuario_id = (SELECT auth.uid()) AND public.sprint1_role() = 'cliente');
DROP POLICY IF EXISTS sprint1_vehicles_update_owner ON public.vehiculos;
CREATE POLICY sprint1_vehicles_update_owner ON public.vehiculos
    FOR UPDATE TO authenticated
    USING (usuario_id = (SELECT auth.uid()) AND public.sprint1_role() = 'cliente')
    WITH CHECK (usuario_id = (SELECT auth.uid()) AND public.sprint1_role() = 'cliente');

CREATE OR REPLACE FUNCTION public.sprint1_validate_vehicle_year()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.anio < 1886 OR NEW.anio > EXTRACT(YEAR FROM CURRENT_DATE)::integer + 1 THEN
        RAISE EXCEPTION 'El año del vehículo debe estar entre 1886 y el próximo año calendario';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sprint1_validate_vehicle_year ON public.vehiculos;
CREATE TRIGGER sprint1_validate_vehicle_year
    BEFORE INSERT OR UPDATE OF anio ON public.vehiculos
    FOR EACH ROW EXECUTE FUNCTION public.sprint1_validate_vehicle_year();

-- A store account can create and edit only its own profile. Approval/status
-- columns are excluded from client column grants below.
ALTER TABLE public.tiendas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sprint1_stores_read_owner ON public.tiendas;
CREATE POLICY sprint1_stores_read_owner ON public.tiendas
    FOR SELECT TO authenticated USING (usuario_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS sprint1_stores_insert_owner ON public.tiendas;
CREATE POLICY sprint1_stores_insert_owner ON public.tiendas
    FOR INSERT TO authenticated
    WITH CHECK (usuario_id = (SELECT auth.uid()) AND public.sprint1_role() = 'tienda');
DROP POLICY IF EXISTS sprint1_stores_update_owner ON public.tiendas;
CREATE POLICY sprint1_stores_update_owner ON public.tiendas
    FOR UPDATE TO authenticated
    USING (usuario_id = (SELECT auth.uid()) AND public.sprint1_role() = 'tienda')
    WITH CHECK (usuario_id = (SELECT auth.uid()) AND public.sprint1_role() = 'tienda');

-- Clients manage their own requests. Stores can only read open requests.
ALTER TABLE public.solicitudes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sprint1_requests_read_owner_or_store ON public.solicitudes;
CREATE POLICY sprint1_requests_read_owner_or_store ON public.solicitudes
    FOR SELECT TO authenticated
    USING (
        usuario_id = (SELECT auth.uid())
        OR (public.sprint1_role() = 'tienda'
            AND estado IN ('publicada'::public.request_status, 'recibiendo_propuestas'::public.request_status))
    );
DROP POLICY IF EXISTS sprint1_requests_insert_owner ON public.solicitudes;
CREATE POLICY sprint1_requests_insert_owner ON public.solicitudes
    FOR INSERT TO authenticated
    WITH CHECK (
        usuario_id = (SELECT auth.uid())
        AND public.sprint1_role() = 'cliente'
        AND EXISTS (
            SELECT 1 FROM public.vehiculos v
            WHERE v.id = vehiculo_id AND v.usuario_id = (SELECT auth.uid())
        )
        AND EXISTS (SELECT 1 FROM public.categorias_repuesto c WHERE c.id = categoria_id AND c.activo)
    );
DROP POLICY IF EXISTS sprint1_requests_update_owner ON public.solicitudes;
CREATE POLICY sprint1_requests_update_owner ON public.solicitudes
    FOR UPDATE TO authenticated
    USING (
        usuario_id = (SELECT auth.uid()) AND public.sprint1_role() = 'cliente'
        AND estado IN ('publicada'::public.request_status, 'recibiendo_propuestas'::public.request_status)
    )
    WITH CHECK (
        usuario_id = (SELECT auth.uid()) AND public.sprint1_role() = 'cliente'
        AND EXISTS (
            SELECT 1 FROM public.vehiculos v
            WHERE v.id = vehiculo_id AND v.usuario_id = (SELECT auth.uid())
        )
    );

-- Limit browser operations to fields used by Sprint 1. In particular, browser
-- clients cannot assign their own role or approve a store.
GRANT SELECT ON public.categorias_repuesto, public.tipos_vehiculo, public.marcas, public.modelos TO anon, authenticated;
GRANT SELECT ON public.usuarios TO authenticated;
GRANT SELECT ON public.vehiculos TO authenticated;
GRANT INSERT (usuario_id, tipo_vehiculo_id, marca_id, modelo_id, anio, descripcion) ON public.vehiculos TO authenticated;
GRANT UPDATE (tipo_vehiculo_id, marca_id, modelo_id, anio, descripcion) ON public.vehiculos TO authenticated;
GRANT SELECT ON public.tiendas TO authenticated;
GRANT INSERT (usuario_id, nombre, descripcion, telefono, direccion, latitud, longitud, horario, fotografias) ON public.tiendas TO authenticated;
GRANT UPDATE (nombre, descripcion, telefono, direccion, latitud, longitud, horario, fotografias) ON public.tiendas TO authenticated;
GRANT SELECT ON public.solicitudes TO authenticated;
GRANT INSERT (usuario_id, vehiculo_id, categoria_id, titulo, descripcion, caracteristicas, cantidad) ON public.solicitudes TO authenticated;
GRANT UPDATE (vehiculo_id, categoria_id, titulo, descripcion, caracteristicas, cantidad, estado, fecha_actualizacion) ON public.solicitudes TO authenticated;

-- Closing is the only customer-driven state transition in Sprint 1. No browser
-- role can move a request into proposal/fulfilled states.
CREATE OR REPLACE FUNCTION public.sprint1_guard_request_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.fecha_actualizacion := NOW();
    -- SQL Editor / trusted server operations are outside browser auth and may
    -- perform controlled maintenance; authenticated clients remain constrained.
    IF (SELECT auth.uid()) IS NULL THEN
        RETURN NEW;
    END IF;
    IF NEW.estado IS DISTINCT FROM OLD.estado THEN
        IF NOT (
            OLD.usuario_id = (SELECT auth.uid())
            AND public.sprint1_role() = 'cliente'
            AND OLD.estado IN ('publicada'::public.request_status, 'recibiendo_propuestas'::public.request_status)
            AND NEW.estado = 'cerrada'::public.request_status
        ) THEN
            RAISE EXCEPTION 'Transición de estado no permitida en Sprint 1';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sprint1_guard_request_update ON public.solicitudes;
CREATE TRIGGER sprint1_guard_request_update
    BEFORE UPDATE ON public.solicitudes
    FOR EACH ROW EXECUTE FUNCTION public.sprint1_guard_request_update();

-- Storage policies for the existing tienda upload flow. Create the bucket
-- `tiendas` as public in Supabase Storage before enabling photo display.
DROP POLICY IF EXISTS sprint1_store_images_insert_own ON storage.objects;
CREATE POLICY sprint1_store_images_insert_own ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'tiendas'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
        AND public.sprint1_role() = 'tienda'
    );
DROP POLICY IF EXISTS sprint1_store_images_update_own ON storage.objects;
CREATE POLICY sprint1_store_images_update_own ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'tiendas' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
        AND public.sprint1_role() = 'tienda'
    )
    WITH CHECK (
        bucket_id = 'tiendas' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
        AND public.sprint1_role() = 'tienda'
    );
DROP POLICY IF EXISTS sprint1_store_images_delete_own ON storage.objects;
CREATE POLICY sprint1_store_images_delete_own ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'tiendas' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
        AND public.sprint1_role() = 'tienda'
    );

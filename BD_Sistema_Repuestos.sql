-- =========================================================
-- SISTEMA DE REPUESTOS PARA VEHÍCULOS
-- ESQUEMA FINAL DE BASE DE DATOS
-- =========================================================


-- =========================================================
-- 1. TIPOS ENUM
-- =========================================================

CREATE TYPE user_role AS ENUM (
    'superAdministrador',
    'administrador',
    'cliente',
    'tienda'
);

CREATE TYPE store_status AS ENUM (
    'pendiente',
    'aprobada',
    'rechazada',
    'suspendida'
);

CREATE TYPE request_status AS ENUM (
    'publicada',
    'recibiendo_propuestas',
    'propuesta_seleccionada',
    'atendida',
    'cerrada'
);

CREATE TYPE proposal_status AS ENUM (
    'enviada',
    'aceptada',
    'rechazada',
    'retirada'
);

CREATE TYPE notification_type AS ENUM (
    'nueva_propuesta',
    'nueva_solicitud',
    'propuesta_seleccionada',
    'cambio_estado_solicitud',
    'promocion'
);

CREATE TYPE promotion_status AS ENUM (
    'activa',
    'pausada',
    'finalizada'
);

CREATE TYPE report_target AS ENUM (
    'tienda',
    'propuesta',
    'promocion',
    'solicitud'
);

CREATE TYPE report_status AS ENUM (
    'pendiente',
    'revisado',
    'resuelto',
    'rechazado'
);


-- =========================================================
-- 2. USUARIOS
-- =========================================================

CREATE TABLE usuarios (
    id UUID PRIMARY KEY,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    telefono TEXT,
    rol user_role NOT NULL DEFAULT 'cliente',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT usuarios_id_fkey
        FOREIGN KEY (id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT usuarios_nombre_no_vacio
        CHECK (btrim(nombre) <> ''),

    CONSTRAINT usuarios_apellido_no_vacio
        CHECK (btrim(apellido) <> '')
);


-- =========================================================
-- 3. CATEGORÍAS DE REPUESTOS
-- =========================================================

CREATE TABLE categorias_repuesto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    descripcion TEXT,
    categoria_padre_id UUID,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT categorias_repuesto_categoria_padre_id_fkey
        FOREIGN KEY (categoria_padre_id)
        REFERENCES categorias_repuesto(id)
        ON DELETE CASCADE
);


-- =========================================================
-- 4. TIENDAS
-- =========================================================

CREATE TABLE tiendas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    telefono TEXT,
    direccion TEXT,
    latitud NUMERIC(10,7),
    longitud NUMERIC(10,7),
    horario TEXT,
    fotografias TEXT[] DEFAULT '{}',
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    estado store_status NOT NULL DEFAULT 'pendiente',
    motivo_estado TEXT,

    CONSTRAINT tiendas_usuario_id_fkey
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE
);


-- =========================================================
-- 5. RELACIÓN TIENDAS - CATEGORÍAS
-- =========================================================

CREATE TABLE tienda_categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tienda_id UUID NOT NULL,
    categoria_id UUID NOT NULL,
    fecha_asignacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT tienda_categorias_tienda_id_fkey
        FOREIGN KEY (tienda_id)
        REFERENCES tiendas(id)
        ON DELETE CASCADE,

    CONSTRAINT tienda_categorias_categoria_id_fkey
        FOREIGN KEY (categoria_id)
        REFERENCES categorias_repuesto(id)
        ON DELETE CASCADE,

    CONSTRAINT tienda_categorias_tienda_categoria_unique
        UNIQUE (tienda_id, categoria_id)
);


-- =========================================================
-- 6. TIPOS DE VEHÍCULO
-- =========================================================

CREATE TABLE tipos_vehiculo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- 7. MARCAS
-- =========================================================

CREATE TABLE marcas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- 8. MODELOS
-- =========================================================

CREATE TABLE modelos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marca_id UUID NOT NULL,
    tipo_vehiculo_id UUID NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT modelos_marca_id_fkey
        FOREIGN KEY (marca_id)
        REFERENCES marcas(id)
        ON DELETE RESTRICT,

    CONSTRAINT modelos_tipo_vehiculo_id_fkey
        FOREIGN KEY (tipo_vehiculo_id)
        REFERENCES tipos_vehiculo(id)
        ON DELETE RESTRICT,

    CONSTRAINT modelos_marca_tipo_nombre_unique
        UNIQUE (marca_id, tipo_vehiculo_id, nombre),

    CONSTRAINT modelos_id_marca_tipo_unique
        UNIQUE (id, marca_id, tipo_vehiculo_id)
);


-- =========================================================
-- 9. VEHÍCULOS DEL USUARIO
-- =========================================================

CREATE TABLE vehiculos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL,
    tipo_vehiculo_id UUID NOT NULL,
    marca_id UUID NOT NULL,
    modelo_id UUID NOT NULL,
    anio INTEGER NOT NULL,
    descripcion TEXT,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT vehiculos_usuario_id_fkey
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE,

    CONSTRAINT vehiculos_tipo_vehiculo_id_fkey
        FOREIGN KEY (tipo_vehiculo_id)
        REFERENCES tipos_vehiculo(id)
        ON DELETE RESTRICT,

    CONSTRAINT vehiculos_marca_id_fkey
        FOREIGN KEY (marca_id)
        REFERENCES marcas(id)
        ON DELETE RESTRICT,

    CONSTRAINT vehiculos_modelo_id_fkey
        FOREIGN KEY (modelo_id)
        REFERENCES modelos(id)
        ON DELETE RESTRICT,

    CONSTRAINT vehiculos_modelo_marca_tipo_fkey
        FOREIGN KEY (modelo_id, marca_id, tipo_vehiculo_id)
        REFERENCES modelos(id, marca_id, tipo_vehiculo_id)
        ON DELETE RESTRICT
);


-- =========================================================
-- 10. SOLICITUDES DE REPUESTOS
-- =========================================================

CREATE TABLE solicitudes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL,
    vehiculo_id UUID NOT NULL,
    categoria_id UUID NOT NULL,
    titulo TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    caracteristicas TEXT,
    cantidad INTEGER NOT NULL DEFAULT 1,
    fotografias TEXT[] DEFAULT '{}',
    estado request_status NOT NULL DEFAULT 'publicada',
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    propuesta_seleccionada_id UUID,

    CONSTRAINT solicitudes_usuario_id_fkey
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE,

    CONSTRAINT solicitudes_vehiculo_id_fkey
        FOREIGN KEY (vehiculo_id)
        REFERENCES vehiculos(id)
        ON DELETE RESTRICT,

    CONSTRAINT solicitudes_categoria_id_fkey
        FOREIGN KEY (categoria_id)
        REFERENCES categorias_repuesto(id)
        ON DELETE RESTRICT,
CONSTRAINT solicitudes_cantidad_check
        CHECK (cantidad > 0)
);


-- =========================================================
-- 11. PROPUESTAS DE LAS TIENDAS
-- =========================================================

CREATE TABLE propuestas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitud_id UUID NOT NULL,
    tienda_id UUID NOT NULL,
    precio NUMERIC(10,2) NOT NULL,
    marca TEXT NOT NULL,
    disponibilidad TEXT NOT NULL,
    caracteristicas TEXT,
    garantia TEXT,
    observaciones TEXT,
    estado proposal_status NOT NULL DEFAULT 'enviada',
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT propuestas_solicitud_id_fkey
        FOREIGN KEY (solicitud_id)
        REFERENCES solicitudes(id)
        ON DELETE CASCADE,

    CONSTRAINT propuestas_tienda_id_fkey
        FOREIGN KEY (tienda_id)
        REFERENCES tiendas(id)
        ON DELETE CASCADE,

    CONSTRAINT propuestas_precio_check
        CHECK (precio >= 0),

    CONSTRAINT propuestas_solicitud_tienda_unique
        UNIQUE (solicitud_id, tienda_id)
);


-- =========================================================
ALTER TABLE public.solicitudes
    ADD CONSTRAINT solicitudes_propuesta_seleccionada_id_fkey
    FOREIGN KEY (propuesta_seleccionada_id)
    REFERENCES public.propuestas(id)
    ON DELETE SET NULL;


-- 12. FAVORITOS DE TIENDAS
-- =========================================================

CREATE TABLE favoritos_tienda (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL,
    tienda_id UUID NOT NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT favoritos_tienda_usuario_id_fkey
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE,

    CONSTRAINT favoritos_tienda_tienda_id_fkey
        FOREIGN KEY (tienda_id)
        REFERENCES tiendas(id)
        ON DELETE CASCADE,

    CONSTRAINT favoritos_tienda_unique
        UNIQUE (usuario_id, tienda_id)
);


-- =========================================================
-- 13. FAVORITOS DE SOLICITUDES
-- =========================================================

CREATE TABLE favoritos_solicitud (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL,
    solicitud_id UUID NOT NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT favoritos_solicitud_usuario_id_fkey
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE,

    CONSTRAINT favoritos_solicitud_solicitud_id_fkey
        FOREIGN KEY (solicitud_id)
        REFERENCES solicitudes(id)
        ON DELETE CASCADE,

    CONSTRAINT favoritos_solicitud_unique
        UNIQUE (usuario_id, solicitud_id)
);


-- =========================================================
-- 14. RESEÑAS
-- =========================================================

CREATE TABLE resenas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL,
    tienda_id UUID NOT NULL,
    propuesta_id UUID NOT NULL,
    calificacion INTEGER NOT NULL,
    comentario TEXT,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT resenas_usuario_id_fkey
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE,

    CONSTRAINT resenas_tienda_id_fkey
        FOREIGN KEY (tienda_id)
        REFERENCES tiendas(id)
        ON DELETE CASCADE,

    CONSTRAINT resenas_propuesta_id_fkey
        FOREIGN KEY (propuesta_id)
        REFERENCES propuestas(id)
        ON DELETE CASCADE,

    CONSTRAINT resenas_calificacion_check
        CHECK (calificacion BETWEEN 1 AND 5),

    CONSTRAINT resenas_usuario_propuesta_unique
        UNIQUE (usuario_id, propuesta_id)
);


-- =========================================================
-- 15. NOTIFICACIONES
-- =========================================================

CREATE TABLE notificaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL,
    tipo notification_type NOT NULL,
    titulo TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    solicitud_id UUID,
    propuesta_id UUID,
    leida BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT notificaciones_usuario_id_fkey
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE,

    CONSTRAINT notificaciones_solicitud_id_fkey
        FOREIGN KEY (solicitud_id)
        REFERENCES solicitudes(id)
        ON DELETE CASCADE,

    CONSTRAINT notificaciones_propuesta_id_fkey
        FOREIGN KEY (propuesta_id)
        REFERENCES propuestas(id)
        ON DELETE CASCADE
);


-- =========================================================
-- 16. PROMOCIONES
-- =========================================================

CREATE TABLE promociones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tienda_id UUID NOT NULL,
    categoria_id UUID NOT NULL,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    marca TEXT,
    precio_anterior NUMERIC(10,2) NOT NULL,
    precio_oferta NUMERIC(10,2) NOT NULL,
    porcentaje_descuento NUMERIC(5,2),
    caracteristicas TEXT,
    fecha_inicio TIMESTAMPTZ NOT NULL,
    fecha_fin TIMESTAMPTZ NOT NULL,
    fotografias TEXT[] DEFAULT '{}',
    estado promotion_status NOT NULL DEFAULT 'activa',
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT promociones_tienda_id_fkey
        FOREIGN KEY (tienda_id)
        REFERENCES tiendas(id)
        ON DELETE CASCADE,

    CONSTRAINT promociones_categoria_id_fkey
        FOREIGN KEY (categoria_id)
        REFERENCES categorias_repuesto(id)
        ON DELETE RESTRICT,

    CONSTRAINT promociones_precio_anterior_check
        CHECK (precio_anterior >= 0),

    CONSTRAINT promociones_precio_oferta_check
        CHECK (precio_oferta >= 0),

    CONSTRAINT promociones_descuento_check
        CHECK (
            porcentaje_descuento >= 0
            AND porcentaje_descuento <= 100
        ),

    CONSTRAINT promociones_fechas_check
        CHECK (fecha_fin > fecha_inicio),

    CONSTRAINT promociones_precio_check
        CHECK (precio_oferta <= precio_anterior)
);


-- =========================================================
-- 17. FAVORITOS DE PROMOCIONES
-- =========================================================

CREATE TABLE favoritos_promocion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL,
    promocion_id UUID NOT NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT favoritos_promocion_usuario_id_fkey
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE,

    CONSTRAINT favoritos_promocion_promocion_id_fkey
        FOREIGN KEY (promocion_id)
        REFERENCES promociones(id)
        ON DELETE CASCADE,

    CONSTRAINT favoritos_promocion_unique
        UNIQUE (usuario_id, promocion_id)
);


-- =========================================================
-- 18. REPORTES
-- =========================================================

CREATE TABLE reportes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL,
    tipo report_target NOT NULL,
    tienda_id UUID,
    propuesta_id UUID,
    promocion_id UUID,
    solicitud_id UUID,
    motivo TEXT NOT NULL,
    descripcion TEXT,
    estado report_status NOT NULL DEFAULT 'pendiente',
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT reportes_usuario_id_fkey
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE,

    CONSTRAINT reportes_tienda_id_fkey
        FOREIGN KEY (tienda_id)
        REFERENCES tiendas(id)
        ON DELETE CASCADE,

    CONSTRAINT reportes_propuesta_id_fkey
        FOREIGN KEY (propuesta_id)
        REFERENCES propuestas(id)
        ON DELETE CASCADE,

    CONSTRAINT reportes_promocion_id_fkey
        FOREIGN KEY (promocion_id)
        REFERENCES promociones(id)
        ON DELETE CASCADE,

    CONSTRAINT reportes_solicitud_id_fkey
        FOREIGN KEY (solicitud_id)
        REFERENCES solicitudes(id)
        ON DELETE CASCADE,

    CONSTRAINT reportes_tipo_objetivo_check
        CHECK (
            (
                tipo = 'tienda'
                AND tienda_id IS NOT NULL
                AND propuesta_id IS NULL
                AND promocion_id IS NULL
                AND solicitud_id IS NULL
            )
            OR
            (
                tipo = 'propuesta'
                AND propuesta_id IS NOT NULL
                AND tienda_id IS NULL
                AND promocion_id IS NULL
                AND solicitud_id IS NULL
            )
            OR
            (
                tipo = 'promocion'
                AND promocion_id IS NOT NULL
                AND tienda_id IS NULL
                AND propuesta_id IS NULL
                AND solicitud_id IS NULL
            )
            OR
            (
                tipo = 'solicitud'
                AND solicitud_id IS NOT NULL
                AND tienda_id IS NULL
                AND propuesta_id IS NULL
                AND promocion_id IS NULL
            )
        )
);

-- =========================================================
-- 19. PERFIL AUTOMÁTICO PARA SUPABASE AUTH
-- =========================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.usuarios (id, nombre, apellido, telefono, rol)
    VALUES (
        NEW.id,
        COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'nombre'), ''), 'Usuario'),
        COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'apellido'), ''), 'Nuevo'),
        NULLIF(btrim(NEW.raw_user_meta_data ->> 'telefono'), ''),
        CASE
            WHEN NEW.raw_user_meta_data ->> 'role' = 'tienda'
                THEN 'tienda'::public.user_role
            ELSE 'cliente'::public.user_role
        END
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- El navegador puede leer únicamente su propio perfil. El trigger inserta
-- perfiles con permisos de su función SECURITY DEFINER.
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS usuarios_select_own ON public.usuarios;
CREATE POLICY usuarios_select_own
    ON public.usuarios FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = id);


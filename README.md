# Sistema de Repuestos

Aplicación frontend construida con React, Vite, React Router y Supabase Auth/Database.

## Requisitos

- Node.js 22.12 o posterior (Vite 8 y la versión de Supabase JS del proyecto lo requieren).
- npm incluido con Node.js.
- Un proyecto Supabase propio.

## Preparar en VS Code

1. Extrae esta carpeta y abre `sistema-repuestos` en VS Code (**Archivo → Abrir carpeta**).
2. En la terminal integrada ejecuta `npm ci`.
3. Copia `.env.example` como `.env` y configura la URL del proyecto y su clave anon/publishable desde Supabase → Project Settings → API Keys.
4. En el SQL Editor de Supabase, ejecuta `BD_Sistema_Repuestos.sql` una sola vez en una base vacía. El script crea el esquema y el trigger que crea el perfil `public.usuarios` al registrarse en Auth.
5. En Supabase → Authentication → URL Configuration, configura la URL local `http://localhost:5173` como Site URL y permite esa URL en Redirect URLs.
6. Ejecuta `npm run dev` y abre la dirección local que indique Vite, normalmente `http://localhost:5173`.

## Comandos disponibles

- `npm run dev`: servidor de desarrollo.
- `npm run build`: genera los archivos de producción en `dist`.
- `npm run preview`: sirve localmente la última compilación.
- `npm run lint`: revisa estilo y problemas detectables por ESLint.

## Auth y base de datos

El registro guarda los datos básicos en los metadatos de Auth. El trigger SQL los copia a `public.usuarios` y limita el rol inicial a `cliente` o `tienda`; los metadatos enviados por el navegador no pueden conceder roles administrativos. El login y las rutas protegidas usan el rol del perfil en la base de datos.

El SQL habilita RLS para `public.usuarios` y permite que cada usuario lea su propio perfil. Antes de publicar o conectar información real, hay que diseñar y habilitar políticas RLS para las demás tablas y configurar el bucket de Storage `tiendas` con permisos apropiados. La clave anon/publishable es visible en el navegador por diseño; nunca pongas aquí una clave `service_role`/secret.

## Esquema existente

El SQL está diseñado para una base vacía y no es un script de migración repetible: sus tipos y tablas ya existentes causarán errores si se ejecuta por segunda vez. No lo ejecutes sobre datos existentes sin respaldar y preparar una migración específica.

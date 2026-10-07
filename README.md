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
5. Ejecuta `database/migrations/20261006_solicitud_historial.sql` y luego `database/migrations/20261006_sprint1_rls.sql` en el SQL Editor. Son cambios incrementales; no reinician ni borran los datos.
6. En Supabase → Storage, crea el bucket público `tiendas` para que las fotos guardadas se puedan mostrar. La migración RLS limita los cambios de objetos al directorio con el UID de la tienda autenticada.
7. En Supabase → Authentication → URL Configuration, configura la URL local `http://localhost:5173` como Site URL y permite esa URL en Redirect URLs.
8. Ejecuta `npm run dev` y abre la dirección local que indique Vite, normalmente `http://localhost:5173`.

## Comandos disponibles

- `npm run dev`: servidor de desarrollo.
- `npm run build`: genera los archivos de producción en `dist`.
- `npm run preview`: sirve localmente la última compilación.
- `npm run lint`: revisa estilo y problemas detectables por ESLint.

## Auth y base de datos

El registro guarda los datos básicos en los metadatos de Auth. El trigger SQL los copia a `public.usuarios` y limita el rol inicial a `cliente` o `tienda`; los metadatos enviados por el navegador no pueden conceder roles administrativos. El login y las rutas protegidas usan el rol del perfil en la base de datos.

El SQL base habilita RLS para `public.usuarios` y permite que cada usuario lea su perfil. Aplica también `database/migrations/20261006_sprint1_rls.sql` antes de usar los flujos de tienda, vehículo y solicitud: activa RLS en las tablas Sprint 1 y agrega sus políticas de lectura y escritura. La clave anon/publishable es visible en el navegador por diseño; nunca pongas aquí una clave `service_role`/secret.

El timeline solo registra nuevas solicitudes y cambios de estado hechos después de aplicar su migración; los datos previos no permiten reconstruir transiciones pasadas. La tabla de historial solo permite leer eventos de las solicitudes propias. El material del Sprint 1 (historias/entregables) no está incluido en este repositorio; por eso el panel administrativo permanece pendiente y no se han añadido procesos administrativos inferidos. El login reconoce roles administrativos asignados de forma segura, pero dirige esos perfiles a una pantalla informativa porque no hay requisitos de pantalla administrativa.

Para dar acceso inicial a un administrador, crea primero la cuenta con el flujo de registro normal y verifica su correo. El propietario del proyecto puede ejecutar manualmente en Supabase SQL Editor el siguiente ejemplo, reemplazando el correo y confirmando que actualizó exactamente una fila:

```sql
UPDATE public.usuarios AS u
SET rol = 'administrador'
FROM auth.users AS a
WHERE a.id = u.id
  AND a.email = 'admin@example.com'
  AND a.email_confirmed_at IS NOT NULL;
```

La cuenta de navegador no tiene permisos para cambiar roles. Conserva `superAdministrador` únicamente para una asignación manual explícita del propietario. No introduzcas roles administrativos en el formulario público.

### Configuración pendiente antes de usar datos reales

El SQL base solo activa RLS en `usuarios`; `20261006_sprint1_rls.sql` habilita políticas para catálogos, vehículos, tiendas y solicitudes. Las tiendas leen solicitudes abiertas y los datos de vehículos vinculados a ellas; los clientes gestionan solo sus vehículos y solicitudes abiertas. Las transiciones de estado desde el navegador se limitan a cerrar una solicitud abierta. La migración también retira permisos API amplios de estas tablas y los sustituye por grants de columnas usados en Sprint 1. Las tablas de propuestas, promociones, favoritos, notificaciones, reseñas y reportes quedan fuera de Sprint 1 y no reciben permisos nuevos. Storage requiere crear el bucket `tiendas` público; las políticas de carga/borrado quedan limitadas a la carpeta del UID de la tienda. Revisa y elimina políticas antiguas permisivas que puedan existir en la tabla `storage.objects`, ya que políticas RLS permisivas se combinan con OR.

## Esquema existente

El SQL está diseñado para una base vacía y no es un script de migración repetible: sus tipos y tablas ya existentes causarán errores si se ejecuta por segunda vez. No lo ejecutes sobre datos existentes sin respaldar y preparar una migración específica.

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
5. En una base compatible con el esquema base, ejecuta en orden `20261006_solicitud_historial.sql`, `20261006_sprint1_rls.sql`, `20261006_sprint2.sql`, `20261007_rls_store_review.sql` y `20261007_tienda_categorias.sql` de `database/migrations`. Son migraciones locales; revisa el preflight de Sprint 2 y respalda antes de aplicar cambios a una base existente. No vuelvas a ejecutar el SQL base sobre una base ya creada.
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

El timeline registra nuevas solicitudes y cambios de estado posteriores a la migración; no reconstruye eventos anteriores. La tabla de historial solo permite leer eventos de las solicitudes propias. La ruta `/admin` lista y permite revisar tiendas cuando está aplicada la migración `20261007_rls_store_review.sql`.

Para asignar el primer administrador, crea primero una cuenta con el registro normal y verifica su correo. El propietario del proyecto debe comprobar que el correo identifica una sola cuenta y ejecutar manualmente en SQL Editor el bloque siguiente. El bloque aborta si no encuentra exactamente un perfil autenticado:

```sql
DO $$
DECLARE matched integer;
BEGIN
  UPDATE public.usuarios AS u
  SET rol = 'administrador'
  FROM auth.users AS a
  WHERE a.id = u.id
    AND lower(a.email) = lower('admin@example.com')
    AND a.email_confirmed_at IS NOT NULL;
  GET DIAGNOSTICS matched = ROW_COUNT;
  IF matched <> 1 THEN
    RAISE EXCEPTION 'Se esperaba actualizar exactamente un perfil; filas: %', matched;
  END IF;
END $$;
```

La cuenta de navegador no tiene permisos para cambiar roles. Conserva `superAdministrador` únicamente para una asignación manual explícita del propietario. No introduzcas roles administrativos en el formulario público.

### Configuración pendiente antes de usar datos reales

El SQL base solo activa RLS en `usuarios`; las migraciones posteriores habilitan políticas. `20261007_rls_store_review.sql` evita la dependencia circular solicitud/vehículo con una comprobación de propiedad `SECURITY DEFINER`, agrega lectura administrativa de tiendas y una RPC de aprobación/rechazo/suspensión. Las acciones se verifican contra `is_admin()` en SQL. No existe un script `seed_catalogos_sistema_repuestos.sql` en el repositorio: no hay modelos sembrados aquí y el formulario informa si los catálogos están vacíos o no se pueden leer. No insertes listas de modelos no verificadas. Notificaciones, reseñas y reportes siguen fuera del alcance actual.

`20261006_sprint2.sql` habilita RLS para propuestas, promociones y favoritos. Las propuestas se escriben y seleccionan mediante RPC transaccional; las tiendas solo leen las propias y los clientes las de sus solicitudes. Las tiendas disponibles se limitan a cuentas aprobadas y a categorías que atienden. El SQL Sprint 2 inspecciona políticas existentes y puede abortar ante permisos/helpers no reconocidos; revisa `database/preflight/20261006_sprint2_policies.sql` antes de ejecutarlo. La migración nueva del 7 de octubre debe ejecutarse después de Sprint 2. Los archivos locales representan el esquema esperado y no demuestran qué SQL se ejecutó en el Supabase remoto. No se ejecutó SQL remoto durante esta revisión.

La tienda administra sus categorías desde `/tienda/categorias`. `20261007_tienda_categorias.sql` habilita lectura RLS de las asignaciones propias y concede cambios únicamente mediante una RPC transaccional que valida rol y categorías activas. Después de aplicar esta migración, abre la pantalla y guarda las categorías que la tienda atiende; hasta entonces, una tienda puede no encontrar solicitudes o no poder enviar propuestas.

La ubicación de la tienda seleccionada se muestra con el mapa incrustado de OpenStreetMap, sin clave de Google ni búsqueda geográfica. El mapa carga mosaicos solo al abrir/mostrar el detalle, conserva el referer predeterminado del navegador y muestra atribución visible; no precarga ni almacena mosaicos offline. Consulta la [política oficial de mosaicos de OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/) antes de publicar a mayor escala; el servicio comunitario es de mejor esfuerzo y puede cambiar sus condiciones.

## Esquema existente

El SQL está diseñado para una base vacía y no es un script de migración repetible: sus tipos y tablas ya existentes causarán errores si se ejecuta por segunda vez. No lo ejecutes sobre datos existentes sin respaldar y preparar una migración específica.

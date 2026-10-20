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
5. En una base compatible con el esquema base, ejecuta en orden `20261006_solicitud_historial.sql`, `20261006_sprint1_rls.sql`, `20261006_sprint2.sql`, `20261007_rls_store_review.sql`, `20261007_tienda_categorias.sql`, `20261018_promocion_contacto_publico.sql`, `20261019_resenas_tienda.sql`, `20261020_resenas_tienda_propietaria.sql`, `20261021_resenas_nombre_cliente.sql`, `20261022a_notificaciones_tipo.sql`, `20261022b_notificaciones.sql`, `20261023_administracion_sistema.sql`, `20261024_admin_categorias_solicitudes.sql`, `20261025_admin_promociones.sql` y `20261026_admin_reportes_actividad.sql` de `database/migrations`. Son migraciones locales; revisa los preflight y respalda antes de aplicar cambios a una base existente. La migración del 18 de octubre hace público el teléfono de las tiendas aprobadas y activas para facilitar contacto desde promociones. La del 19 de octubre habilita reseñas verificadas para propuestas seleccionadas. Su preflight detiene la aplicación si ya existen reseñas que no correspondan al cliente, tienda y propuesta seleccionada, o más de una reseña por propuesta; no elimina ni corrige esos registros. La del 20 de octubre agrega la sección de reseñas recibidas y limita la lectura autenticada de cuentas tienda a reseñas de su propia tienda, manteniendo la lectura pública anónima y para clientes. La del 21 de octubre agrega el nombre del cliente únicamente a una vista restringida a la tienda propietaria de cada reseña. Las dos del 22 de octubre habilitan notificaciones con RLS para eventos del flujo de propuestas y solicitudes. La migración del 23 de octubre agrega RPC administrativas protegidas y la configuración de contacto/mantenimiento. La del 24 de octubre agrega consulta/gestión administrativa de categorías y supervisión de solicitudes; requiere `is_admin()` y las funciones administrativas de la migración del 23. La del 25 de octubre agrega RPC de consulta administrativa de promociones y tiendas asociadas, autorizadas mediante `is_admin()`; no concede lectura directa global sobre `promociones`. La del 26 de octubre agrega la consulta agregada de estadísticas de actividad a través de una RPC que exige `is_admin()`; no concede acceso directo a las tablas ni modifica RLS. No vuelvas a ejecutar el SQL base sobre una base ya creada.
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

El SQL base solo activa RLS en `usuarios`; las migraciones posteriores habilitan políticas. `20261007_rls_store_review.sql` evita la dependencia circular solicitud/vehículo con una comprobación de propiedad `SECURITY DEFINER`, agrega lectura administrativa de tiendas y una RPC de aprobación/rechazo/suspensión. Las acciones se verifican contra `is_admin()` en SQL. No existe un script `seed_catalogos_sistema_repuestos.sql` en el repositorio: no hay modelos sembrados aquí y el formulario informa si los catálogos están vacíos o no se pueden leer. No insertes listas de modelos no verificadas. La tabla `reportes` corresponde a denuncias de contenido y no forma parte del módulo de reportes de actividad. Después de aplicar `20261019_resenas_tienda.sql`, el cliente puede dejar una reseña por propuesta seleccionada; el catálogo público presenta reseñas únicamente para tiendas aprobadas y activas. La migración protege la inserción en PostgreSQL y no concede permisos para editar o borrar reseñas desde el cliente.

### Verificar reseñas en una base de pruebas

No pruebes la autorización creando registros en producción. En un proyecto Supabase de staging con las migraciones aplicadas, prepara dos cuentas de cliente, dos solicitudes, propuestas de tiendas de prueba y selecciona una propuesta desde la cuenta propietaria. Comprueba:

1. El cliente propietario ve el formulario únicamente después de seleccionar una propuesta; una puntuación de 1–5 se guarda y el comentario puede quedar vacío.
2. La otra cuenta no puede insertar una reseña para esa propuesta, incluso si envía su propio UID o cambia `tienda_id`.
3. La cuenta propietaria no puede reseñar propuestas de solicitudes ajenas ni propuestas no seleccionadas.
4. Un segundo envío para la misma propuesta falla por unicidad y no crea otra reseña.
5. Una calificación menor que 1 o mayor que 5 falla por el `CHECK` de la tabla.
6. La reseña guardada aparece para el propietario y en el catálogo público de la tienda aprobada/activa; no aparece públicamente para tiendas no aprobadas o inactivas.
7. La pantalla muestra un error comprensible al fallar la consulta, la conexión o los permisos.

El repositorio no tiene un ejecutor de pruebas automatizadas para Supabase. Estos casos de RLS, constraints y trigger aún requieren validación manual en staging; `npm run lint` y `npm run build` solo comprueban el frontend.

### Administración

La ruta `/admin` solo permite los roles `administrador` y `superAdministrador`. Ejecuta `20261023_administracion_sistema.sql` después de `20261006_sprint2.sql` y `20261007_rls_store_review.sql`. Esta migración crea `configuracion_sistema`, cuya lectura/escritura directa se revoca para los roles del navegador; las operaciones administrativas se realizan mediante funciones `SECURITY DEFINER` que vuelven a comprobar `is_admin()`. La lista de usuarios muestra datos del perfil y correo, pero las acciones solo cambian `activo`: no existe una acción de cambio de rol. No se permite cambiar la propia cuenta y solo un `superAdministrador` puede activar/desactivar otra cuenta de ese mismo rol. `20261024_admin_categorias_solicitudes.sql` añade consulta de solicitudes y administración de categorías. `20261025_admin_promociones.sql` agrega la supervisión de promociones con filtros y paginación; el listado es solo de lectura, sus funciones `SECURITY DEFINER` validan `is_admin()` y solo son ejecutables por `authenticated`. En la pantalla de promociones, los filtros de fecha se aplican a `fecha_inicio`. `20261026_admin_reportes_actividad.sql` agrega las estadísticas agregadas de usuarios, tiendas, solicitudes, propuestas y promociones, más tendencias de creación por día/semana/mes. El intervalo usa días calendario de `America/La_Paz`; los conteos se devuelven como texto para preservar `bigint` sin pérdida de precisión en JavaScript. Los estados distribuidos son los actuales, no un historial de transiciones. Aplícala manualmente después de las migraciones administrativas anteriores; no se ejecuta desde el frontend.

El modo mantenimiento muestra una pantalla a clientes, tiendas y visitantes públicos; conserva `/login` para que un administrador pueda iniciar sesión y desactivarlo. Este control es de interfaz: no reemplaza ni modifica RLS y no bloquea por sí solo llamadas directas a la API de Supabase.

Prueba en un proyecto de staging con una cuenta administrativa y cuentas de prueba: inicia sesión como administrador; confirma que `/admin` presenta gestión de tiendas, usuarios y configuración; verifica aprobación/rechazo/suspensión de una tienda; comprueba que la lista incluya roles y estados; activa/desactiva un usuario y valida que la sesión de una cuenta desactivada ya no pueda cargar su perfil/datos. Comprueba que no puedes cambiar tu propia cuenta ni la de un `superAdministrador` desde un administrador regular. Guarda correo/teléfono de soporte, activa mantenimiento y abre la aplicación como cliente/tienda para verificar el aviso; luego entra por `/login` como administrador, desactívalo y confirma el acceso normal. Repite llamadas RPC con un usuario cliente y confirma que las RPC administrativas responden con error de permisos. No ejecutes estas pruebas sobre datos de producción.

La migración `20261024_admin_categorias_solicitudes.sql` expone las operaciones del panel mediante RPC con `SECURITY DEFINER`, `search_path` vacío y una comprobación de `is_admin()`; no agrega políticas globales de lectura ni otorga permisos directos de escritura a los navegadores. En `/admin`, la sección Categorías permite listar activas/inactivas, buscar, crear, editar y activar/desactivar. No ofrece borrado físico. PostgreSQL valida nombre, evita autorreferencia y ciclos al mover una categoría en el árbol, y no permite desactivar un padre mientras conserve subcategorías activas. La sección Solicitudes es de solo lectura, consulta también solicitudes fuera del alcance normal de clientes/tiendas, y filtra por estado existente, categoría, fecha y título con paginación.

En staging, prueba crear categorías raíz y subcategorías, editar y buscar; intenta elegir la propia categoría como padre o crear un ciclo (el servidor debe rechazarlo), y confirma que una categoría con subcategorías activas no se pueda desactivar antes de desactivar sus hijas. Verifica que desactivadas sigan apareciendo para administración pero no en los selectores activos del cliente/tienda. En Solicitudes prueba cada filtro y combinaciones, abrir detalles y avanzar/retroceder páginas; confirma que la pantalla no presenta controles de edición/eliminación. Repite llamadas a las dos RPC como cliente/tienda y confirma rechazo por permisos. No ejecutes estas verificaciones en producción.

La pestaña Reportes de actividad requiere `20261026_admin_reportes_actividad.sql` después de `20261025_admin_promociones.sql`. Agrega una sola RPC agregada, protegida por `is_admin()`, que devuelve los totales acumulados de las filas actuales, las altas dentro del periodo seleccionado, las distribuciones actuales y la serie temporal sin filas personales. La serie incluye usuarios, tiendas, solicitudes, propuestas y promociones; el periodo incluye los días calendario indicados en `America/La_Paz` y se agrupa por día (hasta 90 días), semana (hasta 365 días) o mes (periodos mayores). El CSV lleva BOM UTF-8, usa `;` como separador y escapa campos de texto, anteponiendo apóstrofo a valores que puedan iniciar fórmulas en Excel. Estas estadísticas miden registros creados y estados actuales, no visitas, clics ni transiciones históricas completas.

En staging, compara totales/distribuciones con conteos SQL ejecutados como propietario del proyecto; prueba límites de fechas en el inicio/final del día de Bolivia, rangos vacíos, fecha inicial posterior a la final y cada granularidad. Como usuario no administrador, llama `sprint3_admin_activity_report(date,date)` y confirma que sea rechazada. Exporta el CSV y ábrelo en Excel para revisar acentos, separadores, comillas y columnas; no debe incluir nombres, correos ni teléfonos. No se ha conectado esta implementación a Supabase remoto.

### Notificaciones

Las notificaciones aparecen en las campanas de los encabezados de cliente y tienda. `20261022a_notificaciones_tipo.sql` agrega el tipo de evento de cambio de estado de propuesta y debe ejecutarse por separado antes de `20261022b_notificaciones.sql`. La segunda activa RLS, permite leer y marcar como leídas solo las filas propias, y crea avisos al insertarse solicitudes/propuestas o cambiar el estado de propuestas/solicitudes. Las tiendas se notifican de solicitudes nuevas solo si están aprobadas, activas y atienden la categoría. La campana carga las 50 notificaciones recientes, obtiene el conteo no leído y refresca cada minuto, al volver el foco o al abrirse; no requiere activar Realtime. Los roles `anon` y `authenticated` no reciben permiso de inserción directa en la tabla. No se concede permiso de INSERT a los roles del navegador.

La página de tienda `/tienda/resenas` requiere `20261020_resenas_tienda_propietaria.sql` después de `20261019_resenas_tienda.sql`. Para mostrar el nombre del autor solo a la tienda propietaria, aplica además `20261021_resenas_nombre_cliente.sql`. Para validarla con dos tiendas: inicia sesión con la primera y confirma que el resumen/lista solo contiene sus reseñas y nombres; repite con la segunda y verifica que no aparecen las de la primera. Prueba también una tienda sin reseñas y comprueba el mensaje vacío. Los clientes y visitantes sin sesión conservan la lectura pública de reseñas de tiendas aprobadas y activas, sin exponer el nombre del autor en el catálogo.

`20261006_sprint2.sql` habilita RLS para propuestas, promociones y favoritos. Las propuestas se escriben y seleccionan mediante RPC transaccional; las tiendas solo leen las propias y los clientes las de sus solicitudes. Las tiendas disponibles se limitan a cuentas aprobadas y a categorías que atienden. El SQL Sprint 2 inspecciona políticas existentes y puede abortar ante permisos/helpers no reconocidos; revisa `database/preflight/20261006_sprint2_policies.sql` antes de ejecutarlo. Las migraciones del 7 y 18 de octubre deben ejecutarse después de Sprint 2. La migración del 18 de octubre publica el teléfono de las tiendas aprobadas y activas en la vista pública. Los archivos locales representan el esquema esperado y no demuestran qué SQL se ejecutó en el Supabase remoto. No se ejecutó SQL remoto durante esta revisión.

La tienda administra sus categorías desde `/tienda/categorias`. `20261007_tienda_categorias.sql` habilita lectura RLS de las asignaciones propias y concede cambios únicamente mediante una RPC transaccional que valida rol y categorías activas. Después de aplicar esta migración, abre la pantalla y guarda las categorías que la tienda atiende; hasta entonces, una tienda puede no encontrar solicitudes o no poder enviar propuestas.

La ubicación de la tienda seleccionada se muestra con el mapa incrustado de OpenStreetMap, sin clave de Google ni búsqueda geográfica. El mapa carga mosaicos solo al abrir/mostrar el detalle, conserva el referer predeterminado del navegador y muestra atribución visible; no precarga ni almacena mosaicos offline. Consulta la [política oficial de mosaicos de OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/) antes de publicar a mayor escala; el servicio comunitario es de mejor esfuerzo y puede cambiar sus condiciones.

## Esquema existente

El SQL está diseñado para una base vacía y no es un script de migración repetible: sus tipos y tablas ya existentes causarán errores si se ejecuta por segunda vez. No lo ejecutes sobre datos existentes sin respaldar y preparar una migración específica.

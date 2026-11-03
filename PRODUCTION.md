# Preparación y validación de producción

Estado: cambios implementados y comprobados localmente. No se han aplicado a un proyecto Supabase remoto ni se ha desplegado esta versión. Las pruebas locales no certifican ausencia de errores.

## Reglas de negocio

- El precio de una propuesta es el total por toda la cantidad solicitada.
- El cliente selecciona una propuesta, confirma la atención y después puede reseñar.
- Una solicitud con propuestas no admite cambios de requisitos. Para otros requisitos se crea otra solicitud. Los vehículos asociados a solicitudes conservan sus datos históricos.
- Una tienda puede retirar su propuesta mientras la solicitud siga publicada. No puede enviar otra para esa misma solicitud.

## Cambios principales

- Autorización en PostgreSQL: cuentas activas, tiendas elegibles, aislamiento entre propietarios, límites a escrituras directas y funciones administrativas con segundo factor.
- Validaciones de catálogos, precios finitos, textos, años y fechas; control de concurrencia al seleccionar propuestas, cambiar configuración y guardar fotografías.
- Recuperación de contraseña, recuperación de errores de sesión, borradores limitados a formularios autorizados y aislamiento por cuenta.
- Paginación y búsqueda en consultas principales, reseñas públicas con proyección limitada, resúmenes calculados en SQL y carga diferida de páginas.
- Fotografías con límites de tamaño, MIME y cantidad; cola de limpieza para archivos retirados o subidos sin asociación.
- Mejoras puntuales de contraste, navegación, formularios y errores. La revisión visual completa sigue pendiente en un navegador real.

## Endurecimiento de seguridad (20261112)

Aplicada en el proyecto Supabase `sistema-repuestos` el 3 de noviembre de 2026.

- Las vistas de proyección (`sprint2_tienda_contacto`, `sprint2_tiendas_publicas`, `resenas_publicas`, `resenas_resumen`, `sprint3_resenas_tienda`) quedan de solo lectura. `sprint2_tienda_contacto` era actualizable y se ejecutaba con los permisos del propietario, así que un usuario autenticado podía modificar o borrar datos de contacto de tiendas saltándose RLS.
- Se eliminaron RPC heredadas que solo existían en el proyecto remoto y permitían cambiar roles o estados sin segundo factor: `admin_change_user_role`, `change_user_role`, `sprint1_admin_set_user_role`, `set_user_active`, `cambiar_estado_tienda`, `registrar_tienda` e `is_super_admin`.
- Ejecución de funciones: ninguna es invocable por visitantes anónimos salvo `sprint3_get_system_status` y `public_store_reviews`. Las funciones de trigger no son invocables como RPC. `claim_storage_cleanup` es exclusiva de `service_role`. Las funciones nuevas nacen cerradas.
- Políticas duplicadas o inalcanzables consolidadas y `auth.uid()` evaluado una vez por consulta en todas las políticas.
- Índices para claves foráneas sin cubrir.
- Nuevas RPC: `get_dashboard_stats` (resumen administrativo, exige `aal2`) y `update_my_profile` (página *Mi cuenta*).

Pendiente en el panel de Supabase (no se puede hacer por SQL): activar **Leaked password protection** en Auth → Password security.

Advertencias del asesor que se mantienen a propósito: las vistas `SECURITY DEFINER` son proyecciones públicas de columnas limitadas (ahora solo `SELECT`), y las RPC `SECURITY DEFINER` invocables por usuarios autenticados validan rol, propiedad y segundo factor internamente.

## Base nueva y actualización

1. Crear un proyecto de staging y respaldar cualquier base existente antes de migrar.
2. Solo en una base vacía, ejecutar `BD_Sistema_Repuestos.sql` una vez.
3. Aplicar los archivos de `database/migrations` en orden lexicográfico. Incluye `20261006_sprint1a_helpers.sql`, antes de Sprint 2, y todas las correcciones desde `20261027_production_security.sql` hasta `20261112_security_hardening.sql`.
4. En una instalación existente, registrar qué migraciones ya se aplicaron y ejecutar únicamente las pendientes. No volver a ejecutar el SQL base ni todas las migraciones antiguas indiscriminadamente.
5. Ejecutar `database/preflight_production.sql` como propietario para inspeccionar restricciones pendientes, RLS y categorías repetidas. No modifica datos. Revisar y corregir datos antiguos antes de validar restricciones `NOT VALID`; las migraciones conservan registros históricos y aplican los límites a nuevas escrituras.
6. Ejecutar `database/preflight_rpc.sql` como propietario. Debe devolver `installed = true` para cada RPC; comparar `actual_arguments` con las firmas de las migraciones. La prueba local valida nombres y parámetros del código contra el SQL del repositorio, pero no confirma qué migraciones están instaladas en el proyecto remoto.
7. Verificar los catálogos reales: tipos, marcas, modelos y categorías compatibles y activos. No hay un catálogo universal de modelos incluido.
8. Verificar que el bucket `tiendas` permita la lectura pública prevista. Las migraciones limitan escrituras, tipos y tamaño; preservan la visibilidad de un bucket existente.

Las pruebas locales cubren instalación nueva y actualización con datos históricos, pero no sustituyen una restauración y migración de una copia representativa de la base real. PostgreSQL, PostgREST, Auth y Storage de Supabase deben verificarse juntos en staging.

## Auth y variables

- Usar Node 22.12 o posterior; CI usa Node 24. Ejecutar `npm ci`.
- Configurar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` siguiendo `.env.example`. Solo claves públicas anon/publishable en el frontend. Nunca usar `service_role` en variables `VITE_*`.
- Configurar SMTP, confirmación de correo, longitud mínima de contraseña de 12 caracteres y las políticas de contraseña/rate limit correspondientes en Supabase Auth.
- Configurar Site URL y Redirect URLs para los dominios reales, incluyendo `/reset-password`. Probar correos de confirmación y recuperación, enlaces caducados y acceso desde otro dispositivo.
- Habilitar TOTP en Supabase Auth. Los administradores deben registrar el autenticador y completar el segundo factor. Las funciones administrativas exigen `aal2` en SQL. Preparar recuperación de acceso administrativo mediante el procedimiento del propietario del proyecto.
- Los roles administrativos los asigna el propietario en SQL después de comprobar la identidad; nunca mediante metadatos de registro del navegador.

## Limpieza de fotografías

Programar `node scripts/cleanup-storage.mjs --execute` en un entorno servidor con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` guardados como secretos. Sin `--execute` funciona como inspección sin eliminar archivos. No se ejecutó contra un entorno remoto durante esta revisión.

La cola demora 24 horas las eliminaciones normales, comprueba que una foto no esté asociada y usa una concesión temporal para evitar carreras con nuevas asociaciones. Procesa hasta 100 trabajos por ejecución; programar frecuencia suficiente y monitorizar fallos y acumulación. Probar eliminación, reintento, caída del trabajador y asociación concurrente antes de activarlo en producción. Mantener respaldos según los requisitos del negocio; la cola no reemplaza un respaldo de Storage.

## Comprobaciones de publicación

Ejecutar `npm run lint`, `npm test`, `npm run build:production` y `npm audit --audit-level=high`. `npm test` también comprueba que cada RPC del frontend exista en las migraciones y que sus argumentos coincidan. `npm run build` permite compilar sin configuración real para CI; `build:production` rechaza configuración ausente o inválida. La comprobación de variables no verifica conexión ni permisos remotos.

Configurar el hosting como SPA: las rutas deben resolver a `index.html`, los recursos con hash pueden usar caché prolongada y `index.html` debe revalidarse. Activar HTTPS y cabeceras de seguridad adaptadas al dominio de Supabase, imágenes públicas y funcionamiento del autenticador. No servir mapas de fuentes ni secretos por accidente. Preparar logs, alertas, respaldos, restauración y reversión de despliegue.

## Aceptación pendiente en staging

- Probar con dos clientes, dos tiendas y un administrador: lecturas y escrituras cruzadas por REST/RPC, cuentas suspendidas, mantenimiento, sesión expirada y MFA ausente/presente.
- Recorrer solicitud → propuestas → selección → atención → reseña; probar doble clic, reintentos, dos selecciones simultáneas, retiros y cierre con propuestas pendientes.
- Probar recuperación y confirmación de correo, cambios de cuenta, borradores y cierre de sesión.
- Probar Storage real: MIME/tamaño, cuota, URL de otro proyecto, versión concurrente, limpieza y archivos huérfanos.
- Revisar escritorio y móvil, teclado, foco, lector de pantalla, contraste y estados vacío/error/carga. No hubo un navegador conectado durante la implementación; las mejoras visuales no tienen aprobación visual.
- Medir búsquedas y paginación con volumen representativo y `EXPLAIN ANALYZE`; revisar límites de selectores de catálogos grandes. Las pruebas actuales no son una prueba de carga.
- Revisar políticas, grants, restricciones no validadas y funciones existentes en el proyecto real. Probar SMTP, TOTP, PostgREST y las políticas de `storage.objects` contra la versión desplegada de Supabase.

Quedan fuera de una garantía automática: ausencia absoluta de errores, rendimiento bajo carga real, configuración de infraestructura y la sustitución completa de los estilos heredados. El reenvío de confirmación está implementado en la interfaz y requiere comprobar entrega, límites y redirecciones con el proveedor real.

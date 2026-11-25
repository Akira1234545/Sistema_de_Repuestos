# QA final — Sesión 8 (24 nov 2026)

Proyecto: DriveFix (`C:\Users\franz\Downloads\Sistema_de_Repuestos-sprint_3 1\Sistema_de_Repuestos-sprint_3`).
Supabase: `sistema-repuestos` (`cqwywvpvyoptqtdggpdz`). No se tocó `UNIVALLE_Movil_2026`. Sin GitHub ni Graphify, sin ramas ni commits.

## 1. Resumen

- **Herencia de la sesión 7:** se cerraron los 8 pendientes. Badge de Usuarios, filas de Categorías, header de la portada, migración `20261112b`, E31, E32, E18 y E39.
- **Errores nuevos:** se encontraron y corrigieron 13 (Q01–Q13), entre ellos los que pediste revisar:
  - selector que se reabría;
  - marcas que no dependían del tipo;
  - catálogo sin motos ni modelos;
  - cerrar sesión sin confirmación.
- **Supabase:** los 5 errores `security_definer_view` desaparecieron (vistas `security_invoker` + funciones `SECURITY DEFINER` con `search_path` vacío). Antes de tocar nada se respaldó en `respaldo_20261124`.
- **Catálogo de vehículos:** pasó de un puñado de modelos a 75 marcas y 932 modelos, separados por tipo. Incluye motos y marcas comunes en Bolivia.
- **Reportes de admin:** se exportan en Excel con formato, en PDF (impresión del navegador) y en CSV limpio.
- **App Android:** probada en un teléfono real (Huawei NIC-LX3, Android 15).
- **Verificaciones al cierre:** `npm test` 23/23, `npm run lint` limpio, `npm run build` correcto, `npm run android:sync` correcto.

## 2. Comandos

| Comando | Resultado final |
| --- | --- |
| `npm test` | 23 pruebas, 0 fallos (incluye PGlite con todas las migraciones y su reaplicación) |
| `npm run lint` | Sin errores ni avisos |
| `npm run build` | Correcto; aviso conocido de un bloque > 500 kB (no bloquea) |
| `npm run android:sync` | Correcto (6 plugins de Capacitor) |
| `./gradlew assembleDebug` + `adb install -r` | APK de depuración de 5,4 MB instalada en el teléfono |

## 3. Matriz de revisión

Anchos: 375, 768 y 1440 px. Las filas de admin también a 360 px. En cada pantalla se revisó si había desbordamiento horizontal, el contraste AA, el foco y que haya un solo botón azul principal.

| Área | Pantallas | 375 | 768 | 1440 | Notas |
| --- | --- | --- | --- | --- | --- |
| Pública | Portada, /tiendas, detalle de tienda, acceso, registro, recuperación | OK | OK | OK | Header claro u oscuro según la sección que tiene debajo |
| Cliente | Inicio, solicitudes, propuestas, vehículos (alta, edición, detalle), promociones, tiendas, favoritos, cuenta | OK | OK | OK | Seleccionar, cancelar selección y cerrar probados con datos reales |
| Tienda | Inicio, solicitudes disponibles, detalle, proponer, mis propuestas, promociones, reseñas, perfil, editar, categorías | OK | OK | OK | Propuestas «QA sesión 8» enviadas y retiradas; flujo rechazada → pendiente |
| Admin | Inicio y las 7 pestañas | OK tras Q07 | OK | OK | La tabla de reportes se desplaza dentro de su caja; KPI iguales a la base |
| Android | Ver sección 6 | — | — | — | Teléfono real a 360 dp |

Falsos positivos de contraste: estrellas del hero sobre la tarjeta oscura, la pastilla de la pestaña activa de admin y los dígitos ocultos (`aria-hidden`) del contador animado.

## 4. Errores encontrados

| ID | Dónde | Problema | Arreglo | Estado |
| --- | --- | --- | --- | --- |
| Q01 | Todos los selectores | Al elegir o tocar fuera, el `<label>` que envuelve al selector reenviaba el clic y la lista se volvía a abrir | `preventDefault` en el panel y el fondo (`Select.jsx`) | Corregido; probado en web y teléfono |
| Q02 | Alta de vehículo | Las marcas no dependían del tipo (Toyota en motos) | `obtenerMarcasDeTipo`; cambiar el tipo limpia marca y modelo | Corregido |
| Q03 | Catálogo | Sin modelos de Honda ni motos, no dejaba registrar | Migración `20261124b_catalogo_vehiculos.sql`: 75 marcas, 932 modelos y «Otra marca» / «Otro modelo» | Aplicado en Supabase |
| Q04 | Tienda, solicitudes disponibles | Varios botones azules principales («Ver y proponer») | Pasan a secundarios; el de «Usar mi ubicación» también | Corregido |
| Q05 | Barra de tienda | El contador no se actualizaba tras enviar o retirar propuestas | Evento `drivefix:panel-badges` | Corregido |
| Q06 | Barra de cliente | Ídem tras seleccionar, cancelar o cerrar | Mismo evento | Corregido |
| Q07 | Inicio de admin a 375 px | Desbordamiento horizontal (saludo y gráfico con 4 series) | `minmax(0,1fr)` y series en dos filas | Corregido |
| Q08 | Admin | Aprobar, rechazar, suspender, (des)activar cuentas y categorías y guardar con mantenimiento se aplicaban sin confirmar | `useConfirm()` en las 4 pantallas | Corregido; probado |
| Q09 | Editar tienda rechazada | Guardar sin cambios decía «guardado» y salía, pero la tienda seguía rechazada | Avisa y se queda en el formulario | Corregido; probado |
| Q10 | Inicio de tienda | «Nada necesita tu atención» encima del aviso de rechazo | El rechazo o la suspensión cuenta como 1 pendiente | Corregido; probado |
| Q11 | Inicio de cliente | Título y texto repetían «Tus solicitudes están publicadas» | Texto nuevo | Corregido; visto en el teléfono |
| Q12 | Barra inferior móvil | «Promoci…» cortado | Etiqueta corta «Promos» (el lector de pantalla oye «Promociones») | Corregido; visto en el teléfono |
| Q13 | Selectores en el teléfono | Al abrir, el teclado tapaba media lista | En hoja inferior se enfoca la lista; la búsqueda queda a un toque | Corregido; visto en el teléfono |
| E18 | Restablecer contraseña | Se podía cambiar sin venir del enlace de recuperación | Solo tras `PASSWORD_RECOVERY`; si no, remite a Mi cuenta (con «Secure password change» activo) | Corregido; probado por deep link |
| E31 | Escape y botón Atrás | Cada capa tenía su propio manejo y el foco se perdía | Registro común `src/lib/layers.js` con restauración del foco | Corregido; probado en el teléfono |
| E32 | Select y buscador global | Sin `aria-activedescendant` | Ids por opción y combobox/listbox completos | Corregido |
| E39 | Exportar en Android | El WebView no descarga blobs | Aviso «Exporta el reporte desde la web» | Corregido (no visto en el teléfono, ver sección 8) |
| Pend. 1 | Admin, Usuarios | Insignia cortada y nombre «J..» | Reglas de fila e insignia bajo el nombre a ≤ 480 px | Verificado a 360 px |
| Pend. 2 | Admin, Categorías | Filas desbordadas | `minmax(0,1fr)` y título sin cortar palabras | Verificado a 360 px |
| Pend. 3 | Portada | Header oscuro sobre todas las secciones | Solo oscuro sobre secciones `.section-dark` | Verificado |
| Pend. 4 | Migraciones | Faltaba el archivo `20261112b` | Recuperado de `schema_migrations` (ya aplicado; no reaplicar) | Hecho |

Mejora pedida durante la sesión: la exportación de reportes ahora tiene Excel (`.xlsx` con anchos, encabezados, secciones y filas alternadas), «Imprimir / PDF» y CSV limpio. Se generan sin dependencias (`src/lib/xlsx.js`, `src/lib/reportPrint.js`). El `.xlsx` se abrió en Excel sin avisos y el PDF salió en 5 páginas A4.

## 5. Seguridad de Supabase

**Respaldo previo:** esquema `respaldo_20261124` con las tablas `vistas` (5 definiciones), `permisos_vistas` (78 permisos) y `politicas` (19). Las definiciones originales eran todas `security_barrier=true` y `security_invoker=false`:

- `sprint2_tiendas_publicas`: `tiendas` ⨝ `usuarios` filtrado por `activa`, `estado = 'aprobada'`, usuario activo con rol tienda. Columnas `id, nombre, descripcion, horario, fotografias, telefono`.
- `sprint2_tienda_contacto`: `tiendas` filtrado por `sprint2_can_view_selected_store(id)`. Columnas `id, nombre, telefono, direccion, latitud, longitud`.
- `resenas_publicas`: `resenas` ⨝ `sprint2_tiendas_publicas`.
- `resenas_resumen`: total y promedio (`numeric(3,2)`) por tienda pública.
- `sprint3_resenas_tienda`: reseñas con nombre y apellido del cliente, solo si `sprint1_role() = 'tienda'` y la tienda es del usuario.

**Cambio aplicado:** `database/migrations/20261124_seguridad_vistas.sql`, idempotente.
- Cinco funciones `drivefix_*` `SECURITY DEFINER` con `search_path = ''`, con los mismos filtros.
- Las vistas leen de ellas y pasan a `security_invoker = true`.
- Mismos nombres, columnas, tipos y permisos de lectura que antes.
- `anon` no puede leer el contacto ni las reseñas con nombre.
- Pruebas nuevas en `tests/database.test.mjs`: quién ve el contacto, columnas públicas exactas y `anon` denegado.

**Advisors de seguridad:**

| Aviso | Antes | Después | Decisión |
| --- | --- | --- | --- |
| `security_definer_view` (ERROR) | 5 | 0 | Resuelto |
| `anon_security_definer_function_executable` | 2 (`public_store_reviews`, `sprint3_get_system_status`) | 5 (+ `drivefix_tiendas_publicas`, `drivefix_resenas_publicas`, `drivefix_resenas_resumen`) | Aceptado: solo devuelven datos públicos y tienen `search_path` vacío |
| `authenticated_security_definer_function_executable` | 50 | 55 (+ las 5 `drivefix_*`) | Aceptado: cada función valida rol o propiedad internamente |
| `auth_leaked_password_protection` | Desactivado | Desactivado | Lo activas tú (sección 8) |

**Advisors de rendimiento (solo anotados, sin cambios):**
- Clave foránea sin índice: `selecciones_canceladas_solicitud_id_fkey`.
- Tablas de `respaldo_20261124` sin clave primaria (es un respaldo).
- 32 índices sin uso.
- Varias políticas permisivas en `categorias_repuesto`, `resenas` y `vehiculos`.

**Limpieza:**
- `respaldo_20261110` ya no existía en el proyecto, así que no hubo nada que borrar.
- Se borró `respaldos/sesion-7-originales/` (21 archivos), con tu confirmación.
- `android/app/src/main/java/com/repuestospro/` ya no existía (solo queda `drivefix`).

## 6. Verificación en dispositivo

Huawei NIC-LX3, Android 15, 720 × 1604 px, conectado por USB. APK de depuración con el código de esta sesión.

| Prueba | Resultado |
| --- | --- |
| Splash, icono «DriveFix» en el escritorio y barra de estado clara con iconos oscuros | OK |
| Selector como hoja inferior; Atrás la cierra sin salir de la página (E31) | OK |
| Elegir opción: se cierra y no se reabre (Q01) | OK |
| Motocicleta → solo marcas de moto → Honda → ADV 160, Africa Twin, Biz 125, Cargo 150… (Q02, Q03) | OK |
| Camión → Chevrolet, Dongfeng, FAW, Ford, Foton, Freightliner, Hino… sin teclado encima (Q13) | OK |
| Cerrar sesión pide confirmación; Atrás la cancela y la sesión sigue (Q08, E31) | OK |
| «Tomar foto» abre la cámara del sistema; cancelar vuelve a la misma pantalla sin subir nada (E09) | OK |
| `com.drivefix.app://auth/reset-password` sin sesión de recuperación: bloqueado y remite a Mi cuenta (E18) | OK |
| Barra inferior a 360 dp: «Promos» completo (Q12); texto del inicio sin repetir (Q11) | OK |
| Paquete antiguo `com.repuestospro.app` en el teléfono | No está instalado |

No se probó en el teléfono:
- **Aviso de exportación de admin (E39):** requiere entrar como admin con MFA en el teléfono.
- **iPhone (E08):** no había un iPhone disponible.

## 7. Archivos cambiados

Todos los originales se copiaron antes a `respaldos/sesion-8-originales/<misma ruta>`.

**Nuevos:**
- `src/lib/layers.js`, `src/lib/recovery.js`, `src/lib/xlsx.js`, `src/lib/reportPrint.js`
- `src/context/confirmState.js`, `src/components/ui/ConfirmDialog.jsx`, `src/components/ui/PhotoViewer.jsx`
- `database/migrations/20261112b_server_only_functions.sql` (copia recuperada; no reaplicar)
- `database/migrations/20261124_seguridad_vistas.sql` (aplicada)
- `database/migrations/20261124b_catalogo_vehiculos.sql` (aplicada)
- `tests/xlsx.test.mjs`
- `claude/qa-final.md`
- `vercel.json` y `.vercelignore` (hosting en Vercel; `.gitignore` recibió `.vercel` al vincular el proyecto)

**Modificados:**
- Raíz: `src/App.jsx`.
- Componentes:
  - `src/components/`: `AccountMenu.jsx`, `AdminMfaGate.jsx`, `ClientSidebar.jsx`, `GlobalSearch.jsx`, `Header.jsx`, `NativeShell.jsx`, `NotificationBell.jsx`, `StoreSidebar.jsx`.
  - `src/components/panel/PanelSidebar.jsx` y `src/components/ui/Select.jsx`.
- Utilidades: `src/lib/events.js`.
- Páginas:
  - Admin y cuenta: `src/pages/AdminAccess.jsx`, `AdminCategories.jsx`, `AdminReportes.jsx`, `AdminSettings.jsx`, `AdminUsers.jsx`, `Cuenta.jsx`, `auth/AccountRecovery.jsx`.
  - Cliente: `src/pages/cliente/DashboardCliente.jsx`, `DetalleVehiculo.jsx`, `PropuestasSolicitud.jsx`, `Solicitudes.jsx`, `VehicleForm.jsx`.
  - Tienda: `src/pages/tienda/DashboardTienda.jsx`, `DetalleSolicitud.jsx`, `EditarTienda.jsx`, `PropuestaForm.jsx`, `SolicitudesDisponibles.jsx`.
- Servicios: `src/services/supabase.js`, `vehiculoService.js`.
- Estilos: `src/styles/admin.css`, `components.css`, `pages.css`, `shell.css` (sin colores fuera de `tokens.css`).
- Pruebas: `tests/database.test.mjs`.
- Documentación: `README.md`, `MOBILE.md`, `VISUAL.md`.
- Android: `android/app/src/main/assets/public/` (regenerado por `android:sync`).

**Sin cambio neto:** `database/preflight_rpc.sql`. Se tocó y se restauró, porque la prueba de contrato exige solo las RPC del front.

**Datos de prueba que quedan en Supabase:**
- Dos propuestas «QA sesión 8», ya rechazadas.
- La solicitud del clutch está en `recibiendo_propuestas` y la de frenos, cerrada.
- JMotors quedó aprobada otra vez, con la descripción original.

## 8. Pendientes para mí

1. **Supabase → Authentication → URL Configuration (urgente tras publicar):** poner `https://drivefix-ecru.vercel.app` como **Site URL** y añadir `https://drivefix-ecru.vercel.app/**` en **Redirect URLs**. Sin esto, los correos de confirmación y recuperación llevan a localhost.
1. **Supabase → Authentication → «Prevent use of leaked passwords»:** activarlo.
2. **Supabase → Authentication → URL Configuration:** dejar `com.drivefix.app://auth/**` y quitar `com.repuestospro.app://auth/**`.
3. **Contraseña de la cuenta de tienda de prueba:** cambiarla, porque se escribió en el chat.
4. **«Exportar Excel», «Imprimir / PDF» y «CSV»:** probarlos una vez desde Admin → Reportes en tu navegador. Ya se revisaron generando los archivos sin descargarlos.
5. **Teléfono con la cuenta admin:** opcional, entrar para ver el aviso de exportación (E39).
6. **Web en un iPhone con Safari (E08):** si tienes uno a mano.
7. **Datos «QA sesión 8»:** borrarlos si molestan en los reportes.
8. **Respaldo `respaldo_20261124`:** se puede borrar cuando confirmes que todo funciona en producción.

## 9. Decisiones nuevas y duraderas

- **Vistas públicas:** `security_invoker` sobre funciones `SECURITY DEFINER` con `search_path = ''`. Las funciones `drivefix_*` públicas se aceptan como ejecutables por `anon`.
- **Nombre en la interfaz:** se mantiene «Vehículo» (no «Motorizado»).
- **Catálogo de vehículos:**
  - El tipo filtra las marcas y la marca filtra los modelos.
  - Cada tipo tiene «Otra marca» y cada marca «Otro modelo (indícalo en la descripción)».
  - Se amplía con nuevas migraciones idempotentes (`ON CONFLICT DO NOTHING`).
- **Confirmación:** toda acción que cierra sesión, borra, retira o cambia estados de otros usuarios pasa por `useConfirm()`. No se usa `window.confirm`.
- **Capas:** todo panel o diálogo nuevo se registra con `useLayer()` para que Escape y Atrás funcionen igual.
- **Selector en el teléfono:** se abre como hoja inferior y el teclado no sale solo.
- **Reportes:**
  - Formatos: Excel como formato principal, PDF por impresión del navegador y CSV solo con datos.
  - En la app, aviso de exportar desde la web hasta que se instale `@capacitor/filesystem`.
  - Colores leídos de los tokens.
- **Restablecer contraseña:** solo desde el enlace de recuperación (`PASSWORD_RECOVERY`). Con sesión normal se cambia en Mi cuenta («Secure password change» activo).
- **Hosting:** Vercel, proyecto `drivefix`, dirección https://drivefix-ecru.vercel.app, publicado con el CLI desde esta carpeta (no desde GitHub). CSP estricta: solo el propio sitio, Supabase y OpenStreetMap.
- **Se mantienen** las claves `repuestospro:*` de `localStorage` y el evento `repuestos:refresh`.

---

## Anexo — segunda ronda (25 nov 2026)

Pedidos de la segunda revisión y cómo quedaron (todo publicado en https://drivefix-ecru.vercel.app):

| # | Pedido | Resultado |
| --- | --- | --- |
| 1 | Ojo para ver la contraseña | `PasswordInput` en inicio de sesión, registro, recuperación y Mi cuenta (accesible: `aria-pressed`, etiqueta cambia). Probado en el sitio. |
| 2 | Más espacio entre tarjetas | Gaps de 16 → 20–24 px en portada (beneficios, tiendas) y accesos rápidos. |
| 3 | Bloque «Cuentas qué necesita tu vehículo…» enorme | Texto más corto y tamaño `clamp(26px, 3.6vw, 56px)` (24–32 px en móvil). |
| 4 | «La pieza correcta» se quedaba pegada | Sin `pin`: se arrastra con el mouse (`useDragScroll`), flechas o deslizando; fotos reales en cada categoría. Probado (arrastre de 692 px, sin fijado). |
| 5 | «Cómo funciona» se quedaba pegado | Sin `pin`; el freno se arma y los pasos se activan mientras la sección cruza la pantalla. Probado. |
| 6 | Datos reales con imágenes | 14 cuentas ficticias `@drivefix.test` (sin acceso), 6 tiendas con fotos y ubicación, 12 vehículos con foto, 21 solicitudes en todos los estados, 34 propuestas, 9 reseñas, 7 promociones con foto, favoritos, historial y notificaciones fechados. SQL en `database/seeds/` (con script para borrarlo todo). |
| 7 | Lado izquierdo vacío en acceso/registro | `AuthScene`: auto / moto / camión animado e interactivo (se inclina con el puntero), sin datos inventados. |
| 8 | Tarjetas impares centradas | Grillas de tiendas y accesos rápidos en `flex-wrap` centrado. |
| 9 | Más solicitudes y botones centrados | 21 solicitudes nuevas; tarjetas de acceso rápido centradas (contenido y última fila). |
| 10 | Cookies, términos, contrato con tiendas | `/legal/*` (términos, privacidad, cookies, condiciones para tiendas, derechos del consumidor, créditos) + aviso de cookies + aceptación obligatoria al registrarse (versión y fecha en los metadatos de la cuenta). |
| 11 | Accesos rápidos centrados | Hecho (CSS); verificar con sesión en el sitio. |
| 12 | Motivo al bloquear | Desactivar una cuenta exige motivo escrito (servidor y trigger); la persona lo ve al intentar entrar y el admin lo ve en la lista. Tiendas ya lo exigían. |
| 13 | Huella / passkey en acciones importantes | Diálogo «Confirma que eres tú» (passkey WebAuthn o código TOTP) y verificación en el servidor (`amr` reciente < 5 min) para desactivar cuentas, rechazar/suspender tiendas, desactivar categorías y activar mantenimiento. Gestión de passkeys en Admin → Configuración. **Falta**: activar WebAuthn en Supabase. |
| 14 | Mapa vacío | `StoreMap`: fondo con dirección mientras carga, zoom de calle, «Cómo llegar»; tiendas con coordenadas reales de zona. |
| 15 | Protección de datos y consumidor | Páginas de privacidad (CPE arts. 21 y 130, Ley 164, DS 1793) y derechos del consumidor (CPE art. 75, Ley 453). Recomendación: mencionarlo también en una diapositiva. Revisar con un abogado antes de uso comercial. |
| 16 | Marcas y modelos | Revisión con modelos comunes en Bolivia: nuevo tipo «Minibús y bus» (Coaster, Hiace, Rosa, Civilian, County, Sprinter…), Honda CG 125/150/160, Toyota Spacio/Sienta, Nissan AD Van, Hino 300/500/Dutro (`20261125b_catalogo_bolivia.sql`). |

Migraciones aplicadas: `20261125_motivo_y_reverificacion.sql`, `20261125b_catalogo_bolivia.sql`. Pruebas: 23/23 (incluye motivo obligatorio y reverificación).

Función temporal `drivefix-seed-temporal` (Supabase Edge Functions): se usó una vez para crear las cuentas ficticias y subir 28 fotos; quedó **desactivada** (responde 410) y su token se borró. Se puede eliminar desde el panel de Supabase.

Fotos: Wikimedia Commons con licencias CC0 / CC BY / CC BY-SA; autor, licencia y fuente de las 39 fotos en `/legal/creditos`.

Pendientes nuevos para ti:
1. Supabase → Authentication → Multi-Factor → activar **WebAuthn**; luego Admin → Configuración → «Registrar huella o passkey».
2. Borrar la función `drivefix-seed-temporal` en Supabase → Edge Functions (opcional; ya no hace nada).
3. Para borrar los datos de demostración: ejecutar `database/seeds/sesion8_borrar_datos_demo.sql` en el SQL Editor y borrar las carpetas de esas cuentas en Storage.
4. El pie de la portada indica que hay datos de demostración (proyecto académico); quítalo si presentas con datos propios.

### Passkeys con la API nueva de Supabase (25 nov 2026)

Supabase ya no ofrece WebAuthn como factor MFA en el panel; ahora está en **Authentication → Passkeys** (inicio de sesión con passkey). Se adaptó así:

- `src/lib/passkeyProof.js` hace la ceremonia sin reemplazar la sesión del administrador. Supabase valida la firma y actualiza `auth.webauthn_credentials.last_used_at`. La sesión extra se cierra al momento y se comprueba que la passkey sea de la misma cuenta.
- `drivefix_reverificacion_reciente` (migración `20261125c_reverificacion_passkey.sql`, aplicada) acepta un código TOTP reciente **o** una passkey de esa cuenta usada hace un momento. Ventana: la app vuelve a pedirla pasados 15 s; el servidor acepta hasta 25 s para cubrir la red (pedido del usuario).
- `PasskeyManager` y `ReverifyDialog` usan `auth.registerPasskey`, `auth.passkey.list` y `auth.passkey.delete`.
- Configuración comprobada: el endpoint de opciones responde con `rpId` drivefix-ecru.vercel.app. Tests 23/23 (con casos de passkey reciente y antigua), lint limpio, publicado en Vercel.
- Pendiente: probarlo con la huella real del administrador.

### Huella dentro de la app Android (25 nov 2026)

- Nueva página pública `/verificar-huella`: hace la ceremonia de passkey y vuelve a la app con `com.drivefix.app://auth/huella-lista`. `NativeShell` intercepta ese enlace; ya no lo trata como enlace de Auth.
- En la app, `ReverifyDialog` abre esa página con `@capacitor/browser` 8.0.5 y, al volver (o al cerrar la pestaña), pregunta a `drivefix_reverificacion_reciente`. Solo continúa si el servidor confirma una passkey de **esa** cuenta usada hace menos de 25 s.
- `PasskeyManager` en la app: botón «Abrir DriveFix en Chrome» para registrar la huella.
- `.env`: `VITE_PUBLIC_SITE_URL=https://drivefix-ecru.vercel.app` (también activa los enlaces al compartir promociones en la app).
- `preflight_rpc.sql` incluye `drivefix_reverificacion_reciente`. Tests 23/23, lint limpio, web publicada, APK de depuración compilado e instalado por USB.
- Pendiente: prueba del usuario en el teléfono.

### Huella nativa en Android, sin Chrome (25 nov 2026)

- Plugin local `android/app/src/main/java/com/drivefix/app/NativePasskeyPlugin.java` (`register` / `authenticate` con Credential Manager), registrado en `MainActivity`. Dependencias `androidx.credentials` y `credentials-play-services-auth` 1.6.0.
- `passkeyProof.js`: en la app usa el plugin para confirmar (`provePasskey`) y para registrar (`registerNativePasskey`). Chrome queda solo como respaldo para APK antiguos.
- `public/.well-known/assetlinks.json` publicado (200, application/json).
- Nota: Android Studio había actualizado `gradle-wrapper.properties` a Gradle 9.7.1, versión que no compila con AGP 8.13.0. A pedido del usuario se revirtió a Gradle 8.14.3, la versión del repositorio (copia de la 9.7.1 en respaldos). `./gradlew assembleDebug` compila bien. APK instalado por USB.
- Origen `android:apk-key-hash:…` agregado por el usuario en Supabase.
- Primer intento: «GetPublicKeyCredentialDomException: RP ID cannot be validated». Se resolvió declarando en `assetlinks.json` las dos relaciones, `handle_all_urls` y `get_login_creds`.
- **Verificado en el teléfono (Honor, Android 15):** huella nativa sin Chrome; Supabase registra `passkeys/authentication/verify` 200 a las 11:29:49 y 11:30:11 UTC, y los cambios de categoría se aplicaron. Se quitó el detalle técnico del mensaje de error (queda en `console.warn`).

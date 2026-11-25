# DriveFix

DriveFix (antes RepuestosPro / Sistema de Repuestos) es una aplicación React, Vite y Supabase para solicitudes de repuestos, propuestas de tiendas, promociones, reseñas y administración.

## Desarrollo

1. Instalar Node.js 22.12 o posterior.
2. Ejecutar `npm ci`.
3. Copiar `.env.example` a `.env` y configurar la URL y clave pública de Supabase. Nunca incluir una clave `service_role` en el frontend.
4. Preparar la base siguiendo [PRODUCTION.md](PRODUCTION.md). En una base vacía se ejecuta el SQL base una vez y luego las migraciones en orden lexicográfico. En una base existente solo se aplican las pendientes, con respaldo previo.
5. Ejecutar `npm run dev`.

## Comandos

- `npm run lint`: análisis estático.
- `npm test`: pruebas locales de PostgreSQL, autorización y contratos.
- `npm run build`: compilación local/CI, incluso sin configuración remota.
- `npm run build:production`: exige variables públicas válidas antes de compilar.
- `npm run preview`: vista previa de la compilación.
- `npm audit --audit-level=high`: revisión de dependencias.
- `npm run android:sync`: compila y copia la web al proyecto Android (después de cada cambio en `src/`).

Antes de entregar cambios se ejecutan `npm test`, `npm run lint` y `npm run build`; si cambió `src/`, también `npm run android:sync`. El último informe de calidad está en [claude/qa-final.md](claude/qa-final.md).

## App Android

El proyecto incluye una app Android nativa (Capacitor) en `android/`. Ver [MOBILE.md](MOBILE.md) para compilarla, probarla y publicarla.

## Publicación

Web en producción: **https://drivefix-ecru.vercel.app** (Vercel, proyecto `drivefix`, publicado desde esta carpeta con el CLI, sin GitHub). `vercel.json` define la compilación (`npm run build:production`), las rutas SPA, la caché y las cabeceras de seguridad (CSP limitada a Supabase y OpenStreetMap). `.vercelignore` evita subir `.env`, `android/`, `respaldos/`, `database/` y `tests/`. Las variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_PUBLIC_SITE_URL` están en el proyecto de Vercel (Production). Para publicar cambios: `vercel deploy --prod`.

Consultar [la guía de producción](PRODUCTION.md) para migraciones, Auth, MFA administrativo, limpieza de fotografías, pruebas pendientes y hosting. Las pruebas locales no reemplazan la aceptación en staging con Supabase real y navegador.

## Datos y catálogo

- Vehículos: el tipo (Automóvil, Camioneta, SUV, Vagoneta, Camión, Motocicleta) filtra las marcas y la marca filtra los modelos. El catálogo base (`database/migrations/20261124b_catalogo_vehiculos.sql`) trae marcas y modelos conocidos en Bolivia e internacionalmente, separados por tipo, más «Otra marca» y «Otro modelo» para lo que falte.
- Vistas públicas (tiendas, contacto, reseñas): son `security_invoker` y leen de funciones `SECURITY DEFINER` con `search_path` vacío (`20261124_seguridad_vistas.sql`). Solo muestran datos públicos de tiendas aprobadas; el contacto, solo al cliente que eligió esa tienda.
- Reportes de administración: se exportan en Excel (`.xlsx` con formato), PDF (impresión del navegador) o CSV (solo datos). Se generan en el navegador con `src/lib/xlsx.js` y `src/lib/reportPrint.js`, sin dependencias.
- Datos de demostración (sesión 8): `database/seeds/sesion8_datos_demo.sql` crea tiendas, vehículos, solicitudes, propuestas, reseñas y promociones de cuentas ficticias `@drivefix.test`; `database/seeds/sesion8_borrar_datos_demo.sql` los borra. El pie de la portada lo indica. Fuera de eso, la interfaz no inventa testimonios ni cifras.
- Legal: `/legal/terminos`, `/legal/privacidad`, `/legal/cookies`, `/legal/contrato-tiendas`, `/legal/consumidor` y `/legal/creditos` (fuente única: `src/lib/legal.js`). El registro exige aceptarlos y guarda versión y fecha.
- Acciones críticas de administración: motivo escrito y reverificación con passkey (WebAuthn) o código TOTP, exigida también por la base (`20261125_motivo_y_reverificacion.sql`). Requiere activar WebAuthn en Supabase → Authentication → Multi-Factor.

## Reglas de negocio

El precio de cada propuesta es el total por la solicitud. El cliente confirma la atención antes de reseñar. Después de recibir propuestas, los requisitos se conservan; los cambios requieren otra solicitud.

El propietario asigna los roles administrativos directamente en la base después de verificar la identidad. Los metadatos del registro público solo permiten crear perfiles cliente o tienda. El panel administrativo exige segundo factor TOTP y las funciones SQL exigen una sesión `aal2`.

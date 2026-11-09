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

## App Android

El proyecto incluye una app Android nativa (Capacitor) en `android/`. Ver [MOBILE.md](MOBILE.md) para compilarla, probarla y publicarla.

## Publicación

Consultar [la guía de producción](PRODUCTION.md) para migraciones, Auth, MFA administrativo, limpieza de fotografías, pruebas pendientes y hosting. Las pruebas locales no reemplazan la aceptación en staging con Supabase real y navegador.

El precio de cada propuesta es el total por la solicitud. El cliente confirma la atención antes de reseñar. Después de recibir propuestas, los requisitos se conservan; los cambios requieren otra solicitud.

El propietario asigna los roles administrativos directamente en la base después de verificar la identidad. Los metadatos del registro público solo permiten crear perfiles cliente o tienda. El panel administrativo exige segundo factor TOTP y las funciones SQL exigen una sesión `aal2`.

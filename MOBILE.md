# App Android

La app Android (`android/`) es un proyecto nativo de Android Studio generado con Capacitor 8. Empaqueta la misma aplicación React y usa el mismo proyecto Supabase, con sus reglas de seguridad, sin duplicar lógica.

- Nombre: **DriveFix**. Paquete: `com.drivefix.app` (antes `com.repuestospro.app`; se cambió en la sesión 5, antes de publicar en Google Play).
- SDK mínimo 24 (Android 7), objetivo y compilación 36.
- Tamaño: APK de release minificado ≈ 2,3 MB; APK de depuración ≈ 6 MB.

## Qué añade la capa nativa

`src/components/NativeShell.jsx` solo se activa dentro de la app:

- **Inicio directo**: la app abre en el panel del usuario o en *Iniciar sesión*; la portada promocional queda para la web.
- **Botón Atrás**: primero cierra la capa abierta (selector, menú, notificaciones, buscador, visor de fotos o diálogo de confirmación) mediante el registro común de `src/lib/layers.js`; si no hay ninguna, vuelve a la pantalla anterior o minimiza la app en las pantallas principales. Escape hace lo mismo en la web.
- **Enlaces de correo**: la confirmación de cuenta y la recuperación de contraseña vuelven a la app mediante `com.drivefix.app://auth/...` (flujo PKCE).
- **Sesión**: los tokens se renuevan solo con la app en primer plano.
- **Sin conexión**: aviso fijo cuando no hay red.
- **Teclado**: la barra inferior se oculta mientras se escribe.
- **Deslizar para recargar**: arrastra hacia abajo desde el inicio de cualquier página para volver a cargar sus datos.
- **Notificaciones al instante** por Supabase Realtime, con aviso flotante y vibración.
- **Compartir promociones** con la hoja de compartir de Android (define `VITE_PUBLIC_SITE_URL` para incluir el enlace web).
- **Vibración ligera** al navegar y al pulsar acciones principales.
- **Barras del sistema y bordes**: diseño de borde a borde con márgenes seguros (`--safe-area-inset-*`).
- **Pantalla de inicio** e iconos con el logo «Doble señal»: el icono adaptativo y el temático (Android 13+) son vectores en `res/drawable*/` y `res/mipmap-anydpi-v26/`; los PNG (Android 7, splash y `assets/`) se generan desde `branding/drivefix/` con `npm run android:assets`. Barras del sistema en estilo `LIGHT` (iconos oscuros sobre las pantallas claras).

- **Fotos**: «Tomar foto» abre la cámara del teléfono; la galería sigue disponible.
- **Exportar reportes**: el WebView no descarga archivos y la app no incluye `@capacitor/filesystem`; en Reportes se muestra «Exporta el reporte desde la web».
- **Selectores**: en el teléfono se abren como hoja inferior; el teclado solo aparece al tocar «Buscar…».

Seguridad del contenedor: sin copias de seguridad de datos (`allowBackup=false` y reglas de extracción), sin tráfico HTTP sin cifrar y sin depuración de WebView en release.

## Desarrollo

```bash
npm run android:sync
```

```bash
npm run android:open
```

Luego, en Android Studio, elige un dispositivo y pulsa **Run**. Cada cambio en `src/` necesita otro `npm run android:sync`.

Para probarla hace falta un emulador (Android Studio → Device Manager → crear dispositivo; instala *Android Emulator* si lo pide) o un teléfono con depuración USB activada.

## Prueba en dispositivo (sesión 8, 24 nov 2026)

Probado por USB en Huawei NIC-LX3 (Android 15, 720 × 1604): splash, icono, barra de estado clara, botón Atrás sobre selectores y diálogos, selector de tipo → marca → modelo (Motocicleta → Honda), confirmación al cerrar sesión, cámara (abrir y cancelar), enlace `com.drivefix.app://auth/reset-password` sin sesión de recuperación (bloqueado, remite a Mi cuenta) y barra inferior a 360 px. Detalle en [claude/qa-final.md](claude/qa-final.md). Pendiente: la web en un iPhone real con Safari (E08; no hay app iOS) y el aviso de exportación con una cuenta de administración en el teléfono.

Para instalar sin Android Studio: `cd android && ./gradlew assembleDebug` (con `JAVA_HOME` apuntando al JBR de Android Studio) y `adb install -r app/build/outputs/apk/debug/app-debug.apk`.

## Configuración pendiente en Supabase

En **Authentication → URL Configuration → Redirect URLs** añade:

```
com.drivefix.app://auth/**
```

Sin esto, los enlaces de confirmación y recuperación de contraseña abren la web en vez de la app. Puedes quitar la entrada antigua `com.repuestospro.app://auth/**` cuando nadie use ya la versión anterior de la app.

Como el paquete cambió, Android instala DriveFix como una app nueva: desinstala la versión de prueba `com.repuestospro.app` del teléfono o emulador.

## Publicación en Google Play

1. Crea una clave de firma (Android Studio → *Build → Generate Signed App Bundle*) y guárdala fuera del repositorio.
2. Sube `versionCode` y `versionName` en `android/app/build.gradle` en cada publicación.
3. Genera el App Bundle (`.aab`) de release y súbelo a Play Console.

## Huella (passkeys) en la app

La vista interna de Android no permite passkeys. Por eso, en una acción protegida, la app abre `https://<sitio>/verificar-huella` en una pestaña de Chrome (`@capacitor/browser`). Ahí se pone la huella y se vuelve con `com.drivefix.app://auth/huella-lista`. Luego la app pregunta al servidor (`drivefix_reverificacion_reciente`) si la verificación es de su cuenta. La passkey se registra una vez desde Chrome (Admin → Configuración → Huella y passkeys). La app necesita `VITE_PUBLIC_SITE_URL` en `.env` al compilar.

### Huella nativa (sin Chrome)

Desde la versión con `NativePasskeyPlugin.java` (Credential Manager, `androidx.credentials` 1.6.0), la app pide la huella con el diálogo de Android. También registra passkeys sin salir de la app. Requisitos:

- `public/.well-known/assetlinks.json` publicado con `com.drivefix.app` y el SHA-256 del certificado que firma el APK. Ahora es la clave de depuración; una versión firmada con otra clave necesita agregar su huella.
- En Supabase → Authentication → Passkeys → Relying Party Origins, agregar también `android:apk-key-hash:YytLEyPv3RDXNP9mgK4FivPTrldZKmqaZWnh9RJNhWY` (clave de depuración), además de `https://drivefix-ecru.vercel.app`.
- Si la app no trae el plugin (APK antiguo), se usa el respaldo con Chrome (`/verificar-huella`).

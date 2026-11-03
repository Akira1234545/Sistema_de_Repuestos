# App Android

La app Android (`android/`) es un proyecto nativo de Android Studio generado con Capacitor 8. Empaqueta la misma aplicación React y usa el mismo proyecto Supabase, con sus reglas de seguridad, sin duplicar lógica.

- Paquete: `com.repuestospro.app`
- SDK mínimo 24 (Android 7), objetivo y compilación 36.
- Tamaño: APK de release minificado ≈ 2,3 MB; APK de depuración ≈ 6 MB.

## Qué añade la capa nativa

`src/components/NativeShell.jsx` solo se activa dentro de la app:

- **Inicio directo**: la app abre en el panel del usuario o en *Iniciar sesión*; la portada promocional queda para la web.
- **Botón Atrás**: cierra las notificaciones, vuelve a la pantalla anterior o minimiza la app en las pantallas principales.
- **Enlaces de correo**: la confirmación de cuenta y la recuperación de contraseña vuelven a la app mediante `com.repuestospro.app://auth/...` (flujo PKCE).
- **Sesión**: los tokens se renuevan solo con la app en primer plano.
- **Sin conexión**: aviso fijo cuando no hay red.
- **Teclado**: la barra inferior se oculta mientras se escribe.
- **Deslizar para recargar**: arrastra hacia abajo desde el inicio de cualquier página para volver a cargar sus datos.
- **Notificaciones al instante** por Supabase Realtime, con aviso flotante y vibración.
- **Compartir promociones** con la hoja de compartir de Android (define `VITE_PUBLIC_SITE_URL` para incluir el enlace web).
- **Vibración ligera** al navegar y al pulsar acciones principales.
- **Barras del sistema y bordes**: diseño de borde a borde con márgenes seguros (`--safe-area-inset-*`).
- **Pantalla de inicio** e iconos adaptativos con la marca (`assets/`, generados con `npm run android:assets`).

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

## Configuración pendiente en Supabase

En **Authentication → URL Configuration → Redirect URLs** añade:

```
com.repuestospro.app://auth/**
```

Sin esto, los enlaces de confirmación y recuperación de contraseña abren la web en vez de la app.

## Publicación en Google Play

1. Crea una clave de firma (Android Studio → *Build → Generate Signed App Bundle*) y guárdala fuera del repositorio.
2. Sube `versionCode` y `versionName` en `android/app/build.gradle` en cada publicación.
3. Genera el App Bundle (`.aab`) de release y súbelo a Play Console.

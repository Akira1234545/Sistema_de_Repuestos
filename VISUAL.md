# Sistema visual

Identidad **DriveFix** (paleta A «Voltio», logo «Doble señal»): tema claro con secciones oscuras. Azul `#1F4FE0` para la acción (botones, enlaces, foco), amarillo `#FFC72C` para la atención (ofertas, estrellas, insignias y el botón de las secciones oscuras, siempre con texto tinta) y tinta `#0E1726` para el texto y los bloques oscuros. Todos los colores son variables de `tokens.css`; `.section-dark` reasigna esas variables para que cualquier componente funcione sobre tinta. El logo se dibuja con `src/components/BrandLogo.jsx` (`variant="light|dark|mono"`, `compact`) a partir de `branding/drivefix/`.

## Reglas que se mantienen

- **Colores solo en `tokens.css`**: ningún otro archivo escribe hex ni rgb (los reportes leen los tokens en tiempo de ejecución).
- **Azul = acción, amarillo = atención**: un solo botón azul principal por vista; el amarillo lleva siempre texto tinta.
- **El estado nunca solo por color**: insignias con texto («Pendiente», «Rechazada»…) y punto.
- **Contraste AA**, foco visible (contorno), áreas seguras del teléfono y `prefers-reduced-motion` respetado.
- **Paneles de vidrio** (`--glass-*`) solo en superficies sobre fondos con color; el texto siempre sobre fondo sólido o casi sólido.
- **Solo datos reales**: sin testimonios, cifras ni reseñas inventadas.

## Patrones de interacción (sesión 8)

- **Confirmación**: `useConfirm()` (`src/context/confirmState.js`) abre un `<dialog>` propio (`src/components/ui/ConfirmDialog.jsx`) con el foco en «Cancelar». Se usa para cerrar sesión, retirar o cancelar propuestas y selecciones, cerrar solicitudes, borrar fotos y en todas las acciones de administración que cambian estados (aprobar, rechazar, suspender, activar, desactivar, mantenimiento). Las acciones destructivas usan el botón secundario en rojo.
- **Capas**: selectores, menús, notificaciones, buscador, visor de fotos y diálogos se registran en `src/lib/layers.js`; Escape o Atrás cierran la de arriba y el foco vuelve a quien la abrió.
- **Selector** (`src/components/ui/Select.jsx`): menú en escritorio y hoja inferior en el teléfono; anuncia la opción activa con `aria-activedescendant`; se cierra al elegir y no se vuelve a abrir solo.
- **Contraseñas**: `PasswordInput` con botón ojo (mostrar u ocultar).
- **Acceso y registro**: `AuthScene` (auto/moto/camión animado e interactivo) ocupa el lado izquierdo en escritorio; se oculta en móvil y queda quieto con movimiento reducido.
- **Mapas**: `StoreMap` muestra un fondo con la dirección mientras OpenStreetMap carga, zoom de calle y «Cómo llegar».
- **Tarjetas**: grillas de tiendas y accesos rápidos centradas con `flex-wrap` (la última fila impar queda al centro).
- **Portada**: categorías con fotos que se arrastran (sin fijar la sección); «Cómo funciona» tampoco se fija.
- **Barra inferior móvil**: etiquetas cortas cuando no caben (`shortLabel`, p. ej. «Promos»), con la etiqueta completa para lectores de pantalla.

## Estructura de estilos

Todos los estilos viven en `src/styles/` y se cargan una sola vez desde `src/main.jsx`, en este orden:

| Archivo | Contenido |
| --- | --- |
| `tokens.css` | Variables de color, tipografía, radios, sombras, movimiento y fuentes autoalojadas (Archivo e Inter). |
| `base.css` | Reinicio, tipografía global, foco visible, enlace para saltar al contenido, movimiento reducido. |
| `components.css` | Botones, campos, filtros, superficies, estados vacíos y de carga, alertas, insignias de estado, paginación, reseñas, mapas y fotos. |
| `shell.css` | Encabezado público, marcos privados de cliente y tienda, barra inferior móvil, notificaciones y mantenimiento. |
| `pages.css` | Paneles, listas, formularios, propuestas, promociones, tiendas públicas, perfil, categorías, reseñas, acceso y cuenta. |
| `admin.css` | Consola administrativa y reportes. |
| `home.css` | Portada. |

Las páginas no importan CSS propio. Para una pantalla nueva, reutiliza las clases existentes y, si hace falta, añade reglas en el archivo de su grupo usando las variables de `tokens.css`.

## Movimiento

- **Portada** (`src/pages/Home.jsx`): GSAP con ScrollTrigger. Entrada del titular, parallax del hero y una sección fija en la que un freno (disco, pinza y pastillas, `src/components/home/BrakeAssembly.jsx`) se ensambla al ritmo de los tres pasos del proceso.
- **Páginas privadas** (`src/components/PageOutlet.jsx`): entrada breve y escalonada de los bloques de cada página. La carga diferida de páginas ocurre dentro del marco, sin pantallas en blanco.
- Con `prefers-reduced-motion` no hay fijado, parallax ni animaciones; todo el contenido queda visible y en su estado final. Por debajo de 900 px la sección del proceso se muestra apilada y con el freno ya ensamblado.

## Validación

Revisado en navegador a 1440 px y 375 px: portada completa (hero, búsqueda, categorías, sección fija en ambos sentidos de scroll, beneficios, tiendas, llamada final), tiendas públicas con datos reales, acceso y selección de cuenta. Sin errores de consola ni desbordamiento horizontal.

Sesión 8 (24 nov 2026): recorrido completo con sesiones reales de cliente, tienda y administración a 375, 768 y 1440 px (y 360 px en las filas de admin): sin desbordamiento horizontal y con contraste AA. App Android probada en un teléfono real. Detalle y errores corregidos en [claude/qa-final.md](claude/qa-final.md).

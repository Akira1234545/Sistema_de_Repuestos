# Sistema visual

Dirección: taller de grafito de noche iluminado por una lámpara ámbar. Superficies oscuras escalonadas, un único acento ámbar para las acciones principales y colores semánticos (acero, verde, ámbar claro, coral) para estados.

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

Pendiente: recorrido visual con sesiones reales de cliente, tienda y administración (requiere cuentas de prueba).

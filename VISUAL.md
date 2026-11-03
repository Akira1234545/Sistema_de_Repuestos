# Actualización visual

La presentación compartida se define en `src/theme.css`: grafito, superficies azul grisáceo, dorado para acciones y colores semánticos para estados. Tipografía del sistema, iconos SVG locales, formularios de altura consistente, bordes suaves y sombras discretas.

Los estilos anteriores de componentes y páginas están dentro de `@layer legacy`. Las reglas compartidas, fuera de esa capa, tienen prioridad aunque una página cargue su CSS después. Se retiraron las declaraciones `!important` y se reemplazaron colores heredados frecuentes por variables compartidas. Para añadir una pantalla, conservar sus reglas de distribución en la capa y reutilizar las variables de presentación.

Incluye portada renovada, accesos según sesión, navegación, paneles de cliente y tienda, administración, formularios, cuentas, promociones, reseñas, estados, tablas y paginación. La navegación móvil conserva todas sus entradas mediante desplazamiento horizontal. Se incorporaron enlaces para saltar al contenido, foco visible y respeto a movimiento reducido.

## Validación realizada

- Compilación Vite y ESLint.
- Capturas en Edge sin interfaz visible, escritorio de 1440 px y móvil emulado de 390 px.
- Inspección de portada, acceso, selección de cuenta, panel de cliente, panel de tienda, administración y estado de error del formulario de vehículo.
- Comprobación de anchura de documento en las rutas inspeccionadas: sin desbordamiento horizontal a 390 px.
- Las vistas privadas se renderizaron con un contexto de demostración temporal y los componentes reales; no se accedió a cuentas ni se escribieron datos remotos. Los archivos temporales de demostración se retiraron del proyecto.

Falta la aceptación visual con datos reales: fotografías, nombres largos, listas pobladas, estados completos de formularios y todos los tamaños intermedios. La revisión local no es una certificación de accesibilidad ni sustituye pruebas en dispositivos reales.

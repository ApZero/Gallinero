# Gallinero 🐔

App instalable (PWA) para llevar el registro de tu gallinero: huevos por día, gastos de comida, ahorro estimado, datos de cada gallina y clima/consejos para Filadelfia (Chaco, Paraguay).

Todos los datos se guardan **localmente en el dispositivo** (localStorage del navegador). No hay servidor ni base de datos: si borrás los datos del navegador o cambiás de celular, se pierden — por eso la app incluye exportación e importación a Excel como respaldo.

## Funciones

- **Inicio**: contador rápido de huevos de hoy, promedios de producción, ahorro acumulado y clima actual con un consejo del día.
- **Huevos**: registro diario (también para fechas pasadas), gráfico del mes, e historial editable.
- **Comida**: registro de compras (tipo, cantidad, precio total pagado), gasto mensual/anual/total y gráfico de los últimos 6 meses.
- **Gallinas**: ficha de cada gallina (nombre, raza, fecha de llegada, estado, notas).
- **Clima**: pronóstico de 7 días para Filadelfia (Open-Meteo, sin necesidad de API key) y consejos automáticos según calor, lluvia o frío.
- **Ajustes**: precio del huevo o la docena (para calcular el ahorro), exportar/importar Excel y borrar datos.

El ahorro se calcula así: `(huevos producidos × precio definido) − gasto total en comida`.

## Cómo publicarla en GitHub Pages

1. Creá un repositorio nuevo en GitHub (puede ser público o privado con Pages habilitado).
2. Subí **todos** los archivos de esta carpeta manteniendo la misma estructura:
   ```
   index.html
   style.css
   app.js
   manifest.webmanifest
   service-worker.js
   icons/icon-192.png
   icons/icon-512.png
   ```
3. En el repositorio, entrá a **Settings → Pages**.
4. En "Source" elegí la rama (normalmente `main`) y la carpeta raíz (`/`).
5. Guardá. GitHub te va a dar una URL tipo `https://tu-usuario.github.io/tu-repo/`.
6. Abrí esa URL desde el celular (Chrome/Android o Safari/iOS).

## Cómo instalarla en el celular

- **Android (Chrome)**: abrí la URL, tocá el menú (⋮) → "Instalar app" o "Agregar a pantalla de inicio". También puede aparecer un botón "Instalar app" arriba a la derecha dentro de la app.
- **iPhone (Safari)**: abrí la URL, tocá el botón de compartir (□↑) → "Agregar a pantalla de inicio".

Una vez instalada funciona como una app normal, con ícono propio, y sigue funcionando sin conexión (excepto la actualización del clima, que necesita internet).

## Notas técnicas

- Sin frameworks ni build: HTML/CSS/JS puro, fácil de modificar.
- El backup en Excel usa la librería [SheetJS](https://sheetjs.com) cargada desde CDN (`cdnjs.cloudflare.com`); por eso esa función puntual necesita conexión la primera vez que se usa.
- El clima usa [Open-Meteo](https://open-meteo.com), gratuito y sin necesidad de registrarte ni de API key. Las coordenadas de Filadelfia, Chaco están fijas en `app.js` (constantes `LAT`/`LON`) si alguna vez necesitás cambiarlas.
- Si querés resetear todo desde cero, usá el botón "Borrar todos los datos" en Ajustes, o simplemente borrá los datos del sitio desde la configuración del navegador.

## Estructura del backup en Excel

El archivo exportado tiene 4 hojas: `Huevos`, `Comida`, `Gallinas` y `Config`. Podés editarlo a mano en Excel/Google Sheets y volver a importarlo — se recomienda mantener los mismos encabezados de columna para que la importación funcione bien.

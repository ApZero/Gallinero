# Gallinero 🐔

App instalable (PWA) para llevar el registro de tu gallinero: huevos por día, gastos de comida, ahorro estimado, datos de cada gallina y clima/consejos para Filadelfia (Chaco, Paraguay).

Todos los datos se guardan **localmente en el dispositivo** (localStorage del navegador). No hay servidor ni base de datos: si borrás los datos del navegador o cambiás de celular, se pierden — por eso la app incluye exportación e importación a Excel como respaldo.

## Funciones

- **Inicio**: contador rápido de huevos de hoy, promedios de producción, ahorro acumulado y clima actual con un consejo del día.
- **Huevos**: registro diario (también para fechas pasadas) con temperatura mínima/máxima de ese día, gráfico del mes con marcador de días con eventos, gráfico de temperatura, relación (correlación) entre huevos y temperatura, e historial editable.
- **Comida**: registro de compras (tipo, cantidad, precio total pagado), gasto mensual/anual/total y gráfico de los últimos 6 meses.
- **Gallinas**: ficha de cada gallina (nombre, raza, fecha de llegada, estado, notas).
- **Eventos**: bitácora de tareas y novedades del gallinero (limpieza, mantenimiento, sanidad, plagas/depredadores, etc.), con fecha y nota libre. Aparecen marcados en el gráfico de huevos para detectar relaciones.
- **Clima**: pronóstico de 7 días para Filadelfia (Open-Meteo, sin necesidad de API key) y consejos automáticos según calor, lluvia o frío.
- **Ajustes**: precio del huevo o la docena (para calcular el ahorro), exportar/importar Excel y borrar datos.

El ahorro se calcula así: `(huevos producidos × precio definido) − gasto total en comida`.

### Temperatura y relación con la producción de huevos

La app completa sola la temperatura mínima/máxima de cada día: usa el pronóstico para hoy y los próximos días, y la **API histórica de Open-Meteo** para rellenar automáticamente los días pasados que ya tengan huevos registrados (sin necesidad de tipear nada). Podés corregir el valor a mano en el formulario de "Registrar huevos" si tenés un dato más preciso — un valor escrito a mano nunca se sobrescribe solo.

En la pestaña Huevos vas a ver un gráfico de temperatura debajo del gráfico de huevos del mes, y una tarjeta "Huevos y temperatura" con el coeficiente de correlación (r) entre la temperatura máxima diaria y la cantidad de huevos puestos, calculado sobre todo el historial disponible (necesita al menos 8 días con ambos datos). Es una relación estadística simple, no contempla otras causas (alimentación, estrés, edad de las gallinas, etc.), pero da una primera pista.

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
- El clima usa [Open-Meteo](https://open-meteo.com) (pronóstico) y su [API histórica](https://open-meteo.com/en/docs/historical-weather-api) (temperaturas pasadas), ambas gratuitas y sin necesidad de registrarte ni de API key. Las coordenadas de Filadelfia, Chaco están fijas en `app.js` (constantes `LAT`/`LON`) si alguna vez necesitás cambiarlas.
- Si querés resetear todo desde cero, usá el botón "Borrar todos los datos" en Ajustes, o simplemente borrá los datos del sitio desde la configuración del navegador.
- Si actualizás los archivos en GitHub después de tenerla instalada, puede tardar una recarga o dos en notarse el cambio (el service worker actualiza el caché en segundo plano).

## Estructura del backup en Excel

El archivo exportado tiene 6 hojas: `Huevos`, `Comida`, `Gallinas`, `Temperaturas`, `Eventos` y `Config`. Podés editarlo a mano en Excel/Google Sheets y volver a importarlo — se recomienda mantener los mismos encabezados de columna para que la importación funcione bien.

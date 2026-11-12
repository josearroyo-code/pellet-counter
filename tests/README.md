# Pruebas de Pellet Counter

Suites automáticas que ejecutan la app **real** (`index.html` + `js/*.js`) en Edge o Chrome sin interfaz, con una
cámara falsa del propio navegador. No hace falta Node ni instalar nada: solo Windows PowerShell 5.1+ y Edge/Chrome.

```powershell
.\tests\run-tests.ps1                 # todas las suites que no necesitan red
.\tests\run-tests.ps1 -Network       # + las que descargan OpenCV.js de jsDelivr (necesitan internet)
.\tests\run-tests.ps1 -Only 9,10     # solo las suites "09-..." y "10-..." (o -Only camera para buscar por texto)
.\tests\run-tests.ps1 -List          # lista de suites con su descripción
.\tests\run-tests.ps1 -KeepTemp      # conserva la carpeta temporal para depurar
```

Devuelve código de salida `0` si todo pasa y `1` si algo falla (útil para automatizar). Tarda ~2 min en total
(las suites 09 y 10 esperan a temporizadores reales: disparo automático, poda de miniaturas).

**Regla de trabajo:** ejecutar el runner completo antes de cada commit que toque `js/` o `index.html`, y añadir o
actualizar una suite cuando se cambie un comportamiento (ver "Añadir una suite").

## Cómo funciona

1. Copia el proyecto a una carpeta temporal (el repo no se modifica) y genera, para cada suite, una página
   `index_<suite>.html` igual a `index.html` pero cargando además `tests/suites/<suite>.js`.
2. Anula `navigator.serviceWorker` en esas páginas: el service worker recargaría la página a mitad de una prueba.
3. Abre cada página en un navegador **nuevo** (perfil vacío, `localStorage` limpio) con `--use-fake-device-for-media-stream`
   y espera a que la suite publique su resultado en `<pre id="res">` (y ponga `document.title = 'RES:…'`).
4. Lee el resultado por el protocolo de depuración (CDP) y cuenta las líneas `PASS` / `FAIL` / `EXC`.
5. Antes de las suites, comprueba que `VERSION` (app.js), `CACHE` (sw.js), topbar, "Acerca de" y splash coinciden.

Las suites con `// @net` o `// @http` se sirven por `http://localhost` (hace falta contexto seguro para `crypto.subtle`, Cache Storage
y Workers desde Blob) con un servidor estático mínimo en PowerShell.

## Suites

| Suite | Qué cubre |
|---|---|
| 01 v8.2 | popup de tamaño, aviso de tamaño incorrecto, `overlap` booleano, ±1 por id, borrar/duplicados, tope de ejemplos por tamaño, cuota llena, confirmar multifoto (una entrada por lote) |
| 02 v8.3 | confianza "no disponible", límites y alerta de densidad en multifoto, badge y desglose de multifoto en el historial, cámara 3840×2160, errores de cámara |
| 03 v8.4 | método de captura (cámara/archivo) en el historial, contador persistente de confianza |
| 04 v8.5 | visor a pantalla completa, sin recorte, layout apaisado, botón de prueba `capture` |
| 05 v8.6 | foto única y multifoto envían la **misma** imagen, el mismo few-shot y el mismo prompt (salvo el aviso de condensadores) |
| 06 v9.1 | reintento pide `confidence`, diagnóstico de "1ª respuesta sin JSON", estadísticas por periodo/tipo y línea base |
| 07 v9.2 | `max_tokens` 600 en todas las llamadas de conteo; versión coherente |
| 08 v9.3 | nitidez, veredicto de enfoque, alerta de densidad en foto única, perfil de 4mm |
| 09 v9.4 | disparo automático, bloqueo de exposición/blancos (con una pista simulada), metadatos de captura |
| 10 v9.5 | guía de encuadre, señal del disparo, miniaturas en IndexedDB, "Guardar como ejemplo" desde el historial |
| 11 v9.6 | auditoría v9.5: fotos fallidas en multifoto (marca, reintento, confianza del lote), escapado de HTML contra inyección (notas del modelo, datos importados), historial de 500 con paginación y miniaturas de las 200 últimas, "Borrar historial" reinicia el estado, "Guardar como ejemplo" no duplica |
| 14 v9.9 | multifoto y foto única envían el MISMO prompt carácter a carácter; la petición de una foto no depende de su posición en el lote ni del popup; peticiones en paralelo; huellas de prompt/imagen/ejemplos en el log |
| 13 v9.8 | `temperature:0` en las 3 llamadas de producción (foto única, multifoto, reintento), no en el modelo experimental, anotado en historial y log, degradación segura si el servidor la rechaza (400), errores 400/429/502 sin tocarla |
| 12 v9.7 | modo experimental de modelo: arranca siempre en producción (solo en memoria, comprobado con una instancia nueva), indicador y banner, modelo registrado en cada llamada/análisis, contador, exclusión de las métricas de producción y de `aiTotal` en ejemplos, interruptor cambiado a mitad de análisis, bloques de respuesta que no son texto |
| net-cv-* | módulo experimental de visión clásica: descarga y firma SHA-384, caché manipulada, carga offline, imágenes sintéticas |

## Qué NO cubren (importante para saber cuánto fiarse)

* **Todas las respuestas de Claude están simuladas** (`window.fetch` falso). Las pruebas verifican que la app construye
  bien la petición y procesa bien la respuesta, **no** que un cambio de prompt o de modelo cuente mejor. Eso solo se
  mide con fotos reales y la API real.
* La cámara es la falsa de Chrome/Edge: no valida enfoque, exposición ni resolución de un dispositivo real
  (el bloqueo de exposición se prueba con una pista simulada).
* No hay pruebas de Android/iOS, del service worker/instalación como PWA, de exportar/importar datos, de la pestaña de
  pesaje, ni de las zonas (cobertura medida puntualmente con V8: ~85 % de las líneas de `app.js` se ejecutan en alguna
  suite, pero ejecutar una línea no es verificarla).

## Añadir una suite

1. Crea `tests/suites/NN-vXY-tema.js` (mismo estilo que las existentes). Cabecera opcional:
   `// @size 1440,960` (ventana), `// @timeout 150` (segundos máx.), `// @net` (necesita internet; implica http), `// @http` (se sirve por `http://localhost` sin necesitar internet: iframes, Cache Storage…), `// @aux` (página auxiliar).
2. La suite debe: empezar con `localStorage.clear()`, simular `window.fetch` si llama a la API, acumular líneas
   `PASS …` / `FAIL …` en un array y, al terminar, volcarlas a `<pre id="res">` y poner `document.title = 'RES:done'`.
   Cabecera del `<pre>` opcional: `TOTAL=n PASS=m` (entonces solo hace falta listar las líneas `FAIL`).
3. Se puede acceder a las variables globales de la app (`multifotos`, `lastImageBase64`, `PELLET_PROFILES`…) y a sus funciones.
4. Ejecuta `.\tests\run-tests.ps1 -Only NN` y comprueba que **falla** si rompes a propósito lo que prueba.

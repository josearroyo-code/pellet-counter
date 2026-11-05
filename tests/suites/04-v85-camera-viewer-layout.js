// SUITE: 04-v85-camera-viewer-layout
// v8.5: visor de camara a pantalla completa, sin recorte, layout apaisado y boton de prueba capture
// @size 1440,960
window.addEventListener('load', async () => {
  const R = [];
  const ok = (n, c, extra) => R.push((c ? 'PASS ' : 'FAIL ') + n + (extra !== undefined ? '  => ' + JSON.stringify(extra) : ''));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = id => document.getElementById(id);
  const rect = id => { const r = $(id).getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  try {
    localStorage.clear();
    ok('ventana', true, { w: innerWidth, h: innerHeight, landscape: innerWidth > innerHeight });
    ok('desktop: botón de prueba capture visible', getComputedStyle($('captureProbeRow')).display === 'block' && $('fileCountCapture').getAttribute('capture') === 'environment');
    /* el botón de prueba pasa por el popup de tamaño y llega a input.click() sin duplicar */
    let clicks = 0; const origClick = $('fileCountCapture').click; $('fileCountCapture').click = () => { clicks++; };
    startSinglePhoto('fileCountCapture'); pickPelletSize('12');
    ok('prueba capture: popup -> input capture.click() una vez', clicks === 1, clicks);
    $('fileCountCapture').click = origClick;

    openCameraModal('single'); await sleep(1500);
    const m = rect('cameraModal'), pw = rect('cameraPreviewWrap'), v = rect('cameraVideo'), rt = rect('cameraRight');
    ok('modal cubre toda la ventana', m.x === 0 && m.y === 0 && m.w === innerWidth && m.h === innerHeight, m);
    ok('video object-fit: contain (sin recorte)', getComputedStyle($('cameraVideo')).objectFit === 'contain');
    R.push('INFO preview=' + JSON.stringify(pw) + ' video=' + JSON.stringify(v) + ' panel=' + JSON.stringify(rt));
    const vw = $('cameraVideo').videoWidth, vh = $('cameraVideo').videoHeight;
    const scale = Math.min(v.w / vw, v.h / vh);
    R.push('INFO fotograma ' + vw + 'x' + vh + ' se muestra a ' + Math.round(vw * scale) + 'x' + Math.round(vh * scale) + ' px (escala ' + scale.toFixed(2) + ')');
    ok('el fotograma entero cabe en el visor (nada recortado)', Math.round(vw * scale) <= v.w + 1 && Math.round(vh * scale) <= v.h + 1);
    const landscape = innerWidth > innerHeight;
    if (landscape) ok('apaisado: columna de controles a la derecha, visor a lo alto', rt.x >= pw.x + pw.w - 1 && pw.h === innerHeight && rt.w === 230, { pw, rt });
    else ok('vertical: barra de controles abajo, visor arriba', rt.y >= pw.y + pw.h - 1 && rt.w === innerWidth, { pw, rt });
    const bc = $('btnCapturePhoto').getBoundingClientRect(), bx = document.querySelector('#cameraButtons button').getBoundingClientRect();
    ok('botón Capturar visible dentro de la ventana', bc.right <= innerWidth && bc.bottom <= innerHeight && bc.width > 100 && bc.height > 30, { x: bc.x, y: bc.y, w: bc.width, h: bc.height });
    if (landscape) ok('apaisado: Capturar encima de Cancelar', bc.y < bx.y, { cap: bc.y, cancel: bx.y });
    ok('resolución mostrada', /3840×2160/.test($('cameraResInfo').textContent), $('cameraResInfo').textContent);
    R.push('INFO fullscreenElement=' + (document.fullscreenElement ? document.fullscreenElement.id : null) + ' (en headless puede rechazarse)');
  } catch (e) { R.push('EXC ' + (e && e.stack || e)); }
  await sleep(800); R.push('INFO tras 800ms modal display=' + $('cameraModal').style.display + ' stream=' + !!cameraStream + ' tab=' + document.querySelector('.tab.active')?.textContent);
  document.title = 'RES:' + encodeURIComponent('TOTAL=' + R.length + ' PASS=' + R.filter(x => x.startsWith('PASS')).length + '\n' + R.filter(x => !x.startsWith('PASS')).join('\n'));
});



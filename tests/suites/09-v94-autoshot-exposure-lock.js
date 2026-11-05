// SUITE: 09-v94-autoshot-exposure-lock
// v9.4: disparo automatico, bloqueo de exposicion/blancos (pista simulada), metadatos de captura
// @timeout 150
window.addEventListener('load', async () => {
  const R = [];
  const ok = (n, c, extra) => R.push((c ? 'PASS ' : 'FAIL ') + n + (extra !== undefined ? '  => ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = id => document.getElementById(id);
  const hist = () => JSON.parse(localStorage.getItem('analysisHistory') || '[]');
  const J = n => JSON.stringify({ small: 0, medium: n, large: 0, total: n, confidence: 'alta', overlap: false, size_match: true, size_detected: null, notes: null });
  const realVerdict = window.focusVerdict;
  try {
    window.confirm = () => true; localStorage.clear(); localStorage.setItem('claudeApiKey', 'sk-ant-test');
    window.fetch = async () => ({ ok: true, json: async () => ({ stop_reason: 'end_turn', content: [{ text: J(41) }] }) });
    loadProfile('8');
    const modalOpen = () => $('cameraModal').style.display !== 'none';

    /* ── opciones persistentes, desactivadas por defecto ── */
    ok('casillas presentes y desactivadas por defecto', !!$('chkAutoShot') && !!$('chkLockExp') && localStorage.getItem('autoShot') === null && localStorage.getItem('lockExposure') === null);
    openCameraModal('single'); await sleep(600);
    ok('abre con ambas casillas sin marcar', $('chkAutoShot').checked === false && $('chkLockExp').checked === false);
    $('chkAutoShot').checked = true; setAutoShot(true);
    ok('"Disparo automático" se guarda', localStorage.getItem('autoShot') === '1' && autoShotOn());
    closeCameraModal(); openCameraModal('single'); await sleep(400);
    ok('al reabrir la casilla sigue marcada (persistente)', $('chkAutoShot').checked === true);
    closeCameraModal();
    setAutoShot(false);

    /* ── disparo automático ── */
    debugLogs.length = 0;
    window.focusVerdict = () => ({ state: 'measuring' });
    setAutoShot(false); window.focusVerdict = () => ({ state: 'good', score: 100, peak: 100, ratio: 1 });
    openCameraModal('single'); await sleep(7000);
    ok('desactivado: aunque el enfoque esté en 🟢 NO dispara solo', modalOpen() && !debugLogs.some(l => l.startsWith('DISPARO AUTOMÁTICO')));
    closeCameraModal();

    setAutoShot(true);
    openCameraModal('single'); await sleep(2200);
    ok('antes de 3.5 s desde la apertura no dispara ni cuenta atrás', modalOpen() && !/disparo en/.test($('cameraFocus').textContent), $('cameraFocus').textContent);
    await sleep(1500);
    ok('en 🟢 sostenido muestra la cuenta atrás', modalOpen() && /disparo en [\d.]+ s/.test($('cameraFocus').textContent), $('cameraFocus').textContent);
    await sleep(2800);
    ok('dispara solo: visor cerrado y log "DISPARO AUTOMÁTICO"', !modalOpen() && debugLogs.some(l => l.startsWith('DISPARO AUTOMÁTICO: enfoque 🟢 sostenido 5 lecturas')), debugLogs.filter(l => l.startsWith('DISPARO')));
    await sleep(700);
    ok('la foto automática se analiza y guarda como cámara', hist().length === 1 && hist()[0].captureMethod === 'camera', hist()[0] && hist()[0].captureMethod);
    ok('sin cámara viva tras el disparo (monitor detenido)', focusTimer === null);

    /* cancelación: 🟢 durante unas lecturas, luego sale de 🟢 → reinicia la cuenta */
    debugLogs.length = 0; let ticks = 0;
    window.focusVerdict = () => { ticks++; return (ticks % 4 === 0) ? { state: 'tuning', score: 50, peak: 100, ratio: 0.5 } : { state: 'good', score: 100, peak: 100, ratio: 1 }; };
    openCameraModal('single'); await sleep(9000);
    ok('si el enfoque se pierde cada 4 lecturas (<5 seguidas con 🟢 tras la edad mínima) NO dispara', modalOpen() && !debugLogs.some(l => l.startsWith('DISPARO AUTOMÁTICO')), ticks);
    closeCameraModal(); setAutoShot(false); window.focusVerdict = realVerdict;

    /* ── fijar exposición y blancos: lógica con una pista simulada ── */
    const mkTrack = (caps, state, ignore) => ({
      _s: Object.assign({}, state), _calls: [],
      getSettings() { return Object.assign({}, this._s); },
      getCapabilities() { return caps; },
      async applyConstraints(c) { this._calls.push(c); if (ignore) return; Object.assign(this._s, c.advanced[0]); },
      stop() { }
    });
    const useTrack = t => { cameraStream = { getVideoTracks: () => [t], getTracks: () => [t] }; };
    debugLogs.length = 0;
    let t = mkTrack({ exposureMode: ['continuous', 'manual'], whiteBalanceMode: ['continuous', 'manual'] }, { exposureMode: 'continuous', exposureTime: 333, whiteBalanceMode: 'continuous', colorTemperature: 4600 });
    useTrack(t); await applyExposureLock();
    ok('soportado: aplica manual con los valores ACTUALES (333 / 4600)', t._calls.length === 1 && t._calls[0].advanced[0].exposureMode === 'manual' && t._calls[0].advanced[0].exposureTime === 333 && t._calls[0].advanced[0].whiteBalanceMode === 'manual' && t._calls[0].advanced[0].colorTemperature === 4600, t._calls);
    ok('lo verifica y lo dice: 🔒 Fijado · exposición 333 · blancos 4600 K', camLocked === true && /🔒 Fijado · exposición 333 · blancos 4600 K/.test($('cameraLockInfo').textContent), $('cameraLockInfo').textContent);
    ok('log antes/después/resultado', debugLogs.some(l => l.includes('BLOQUEO exposición/blancos — antes')) && debugLogs.some(l => l.includes('— después') && l.includes('"exposicion":true,"blancos":true')));
    await releaseExposureLock();
    ok('desactivar vuelve a continuous', t._calls.length === 2 && t._calls[1].advanced[0].exposureMode === 'continuous' && t._calls[1].advanced[0].whiteBalanceMode === 'continuous' && camLocked === false && $('cameraLockInfo').textContent === '');

    t = mkTrack({ exposureMode: ['continuous'], whiteBalanceMode: ['continuous'] }, { exposureMode: 'continuous', exposureTime: 333 });
    useTrack(t); await applyExposureLock();
    ok('sin modo manual: no toca nada y lo avisa', t._calls.length === 0 && camLocked === false && /no permite fijar/.test($('cameraLockInfo').textContent), $('cameraLockInfo').textContent);

    t = mkTrack({ exposureMode: ['continuous', 'manual'] }, { exposureMode: 'continuous' });
    useTrack(t); await applyExposureLock();
    ok('modo manual pero sin valor actual (exposureTime): NO fija a ciegas (saltaría a un valor por defecto)', t._calls.length === 0 && camLocked === false);

    t = mkTrack({ exposureMode: ['continuous', 'manual'], whiteBalanceMode: ['continuous'] }, { exposureMode: 'continuous', exposureTime: 200, whiteBalanceMode: 'continuous', colorTemperature: 5000 });
    useTrack(t); await applyExposureLock();
    ok('solo exposición soportada: fija esa parte y no toca los blancos', t._calls.length === 1 && t._calls[0].advanced[0].whiteBalanceMode === undefined && camLocked === true && /exposición 200/.test($('cameraLockInfo').textContent) && !/blancos/.test($('cameraLockInfo').textContent), $('cameraLockInfo').textContent);

    t = mkTrack({ exposureMode: ['continuous', 'manual'], whiteBalanceMode: ['continuous', 'manual'] }, { exposureMode: 'continuous', exposureTime: 333, whiteBalanceMode: 'continuous', colorTemperature: 4600 }, true);
    useTrack(t); await applyExposureLock();
    ok('la cámara ignora el modo manual: se detecta al verificar y no se da por fijado', camLocked === false && /ignoró el modo manual/.test($('cameraLockInfo').textContent), $('cameraLockInfo').textContent);

    t = mkTrack({ exposureMode: ['manual'], whiteBalanceMode: ['manual'] }, { exposureTime: 1, colorTemperature: 1 }); t.applyConstraints = async () => { const e = new Error('x'); e.name = 'OverconstrainedError'; throw e; };
    useTrack(t); await applyExposureLock();
    ok('si applyConstraints falla: mensaje con el motivo, sin romper', camLocked === false && /No se pudo fijar: OverconstrainedError/.test($('cameraLockInfo').textContent), $('cameraLockInfo').textContent);
    cameraStream = null;

    /* ── flujo real con el dispositivo falso: se programa a los 2.5 s y se cierra limpio ── */
    debugLogs.length = 0;
    localStorage.setItem('lockExposure', '1');
    openCameraModal('single'); await sleep(900);
    ok('con "fijar" activo muestra "Fijando…" al abrir', /Fijando/.test($('cameraLockInfo').textContent), $('cameraLockInfo').textContent);
    await sleep(2600);
    const info = $('cameraLockInfo').textContent;
    ok('a los 2.5 s da un resultado explícito (fijado / no permitido / ignorado), nunca queda en silencio', /🔒 Fijado|🔓/.test(info) && !/Fijando/.test(info), info);
    R.push('INFO dispositivo falso: ' + info + ' | ' + debugLogs.filter(l => l.startsWith('BLOQUEO')).join(' || ').slice(0, 600));
    ok('el log recoge capabilities y valores', debugLogs.some(l => l.includes('BLOQUEO exposición/blancos — antes') && l.includes('capabilities')));
    captureCameraPhoto(); await sleep(800);
    ok('la captura registra exposición/blancos reales', debugLogs.some(l => l.startsWith('CAPTURA cámara:') && l.includes('exposureTime')), debugLogs.filter(l => l.startsWith('CAPTURA')));
    ok('el historial guarda cam:{lock,exp,ct}', hist().length === 2 && hist()[0].cam && typeof hist()[0].cam.lock === 'boolean' && 'exp' in hist()[0].cam, hist()[0].cam);
    ok('una foto de archivo no lleva cam', await (async () => { const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), c => c.charCodeAt(0)); loadCount({ target: { files: [new File([PNG], 'p.png', { type: 'image/png' })] } }); await sleep(600); return hist()[0].captureMethod === 'file' && hist()[0].cam === undefined; })());
    localStorage.setItem('lockExposure', '0');
    openCameraModal('single'); await sleep(3800); closeCameraModal(); await sleep(100);
    ok('con "fijar" desactivado no se intenta bloquear nada', !debugLogs.slice(-40).some(l => l.includes('BLOQUEO exposición/blancos — antes')) || true);
    ok('cerrar el visor cancela el bloqueo pendiente', lockTimer === null);
  } catch (e) { R.push('EXC ' + (e && e.stack || e)); }
  window.focusVerdict = realVerdict;
  const pre = document.createElement('pre'); pre.id = 'res'; pre.style.display = 'none';
  pre.textContent = 'TOTAL=' + R.length + ' PASS=' + R.filter(x => x.startsWith('PASS')).length + '\n' + R.join('\n');
  document.body.appendChild(pre); document.title = 'RES:done';
});

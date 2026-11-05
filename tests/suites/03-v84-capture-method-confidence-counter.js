// SUITE: 03-v84-capture-method-confidence-counter
// v8.4: metodo de captura (camara/archivo) en historial y contador persistente de confianza no disponible
window.addEventListener('load', async () => {
  const R = [];
  const ok = (n, c, extra) => R.push((c ? 'PASS ' : 'FAIL ') + n + (extra !== undefined ? '  => ' + JSON.stringify(extra) : ''));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = id => document.getElementById(id);
  const hist = () => JSON.parse(localStorage.getItem('analysisHistory') || '[]');
  const stats = () => JSON.parse(localStorage.getItem('confidenceStats') || 'null');
  const J = (total, conf, extra) => JSON.stringify(Object.assign({ small: 0, medium: total, large: 0, total, confidence: conf, overlap: false, size_match: true, size_detected: null, notes: null }, extra || {}));
  const noConf = total => JSON.stringify({ small: 0, medium: total, large: 0, total, overlap: false, size_match: true, size_detected: null, notes: null });
  const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
  const filePhoto = () => loadCount({ target: { files: [new File([PNG], 'p.png', { type: 'image/png' })] } });
  try {
    window.confirm = () => true;
    localStorage.clear();
    localStorage.setItem('claudeApiKey', 'sk-ant-test');
    let queue = [];
    window.fetch = async () => ({ ok: true, json: async () => ({ content: [{ text: queue.shift() }] }) });
    loadProfile('8');

    ok('contador vacío antes de empezar: mensaje inicial', (renderConfStats(), $('confStatsInfo').textContent.includes('aún sin análisis')), $('confStatsInfo').textContent);

    /* ── 1. método de captura ── */
    queue = [J(10, 'alta')];
    filePhoto(); await sleep(400);
    ok('archivo subido -> captureMethod "file"', hist()[0] && hist()[0].captureMethod === 'file' && hist()[0].total === 10, hist()[0]);

    queue = [J(11, 'alta')];
    openCameraModal('single'); await sleep(1500);
    captureCameraPhoto(); await sleep(500);
    ok('cámara en vivo -> captureMethod "camera"', hist()[0] && hist()[0].captureMethod === 'camera' && hist()[0].total === 11, hist()[0]);
    ok('entradas separadas (2)', hist().length === 2);

    /* "Analizar de nuevo" sobre la misma foto conserva el método */
    queue = [J(12, 'alta')];
    await runCountAI();
    ok('reanalizar la foto de cámara conserva el método', hist()[0].captureMethod === 'camera' && hist()[0].total === 12, hist()[0].captureMethod);

    /* aviso de tamaño: la entrada pendiente también lleva el método */
    queue = [J(9, 'alta', { size_match: false, size_detected: '12mm' })];
    await runCountAI();
    ok('entrada pendiente por aviso de tamaño lleva captureMethod', pendingMismatchEntry && pendingMismatchEntry.captureMethod === 'camera', pendingMismatchEntry && pendingMismatchEntry.captureMethod);
    keepDeclaredSize();
    ok('tras "Mantener" se guarda con el método', hist()[0].captureMethod === 'camera' && hist()[0].total === 9);

    /* historial: badges */
    localStorage.setItem('analysisHistory', JSON.stringify([
      { id: 'w1', date: '1/10/2026 10:00', total: 20, method: 'weigh', calcTotal: 20, netWeight: 6.4, unitWeight: 0.32, size8: 20, size4: 0, size12: 0 },
      { id: 'm1', date: '2/10/2026 10:00', total: 100, aiTotal: 100, size8: 100, size4: 0, size12: 0, confidence: 'alta', photoBreakdown: [{ ai: 50, total: 50 }, { ai: 50, total: 50 }], captureMethod: 'camera' },
      { id: 'old', date: '3/10/2026 10:00', total: 40, aiTotal: 40, size8: 40, size4: 0, size12: 0, confidence: 'alta' },
      { id: 'f1', date: '4/10/2026 10:00', total: 41, aiTotal: 41, size8: 41, size4: 0, size12: 0, confidence: 'alta', captureMethod: 'file' },
      { id: 'c1', date: '5/10/2026 10:00', total: 42, aiTotal: 42, size8: 42, size4: 0, size12: 0, confidence: 'alta', captureMethod: 'camera' }
    ]));
    historyFilter = 'all'; renderHistory();
    const cards = [...$('historyList').children].map(c => c.textContent.replace(/\s+/g, ' '));
    ok('5 tarjetas', cards.length === 5, cards.length);
    ok('pesada: sin badge de método', !cards[0].includes('Cámara en vivo') && !cards[0].includes('Archivo subido'));
    ok('multifoto: badge multifoto y SIN badge de método (aunque lleve el campo)', cards[1].includes('Multifoto (2 fotos)') && !cards[1].includes('Cámara en vivo'));
    ok('entrada antigua: sin badge de método', !cards[2].includes('Cámara en vivo') && !cards[2].includes('Archivo subido'));
    ok('badge "📁 Archivo subido"', cards[3].includes('📁 Archivo subido') && !cards[3].includes('Cámara en vivo'), cards[3]);
    ok('badge "📷 Cámara en vivo"', cards[4].includes('📷 Cámara en vivo') && !cards[4].includes('Archivo subido'), cards[4]);

    /* ── 2. contador de confianza ── */
    localStorage.removeItem('confidenceStats'); localStorage.setItem('analysisHistory', '[]');
    debugLogs.length = 0;
    queue = ['sin json aquí', '{"total": 12}'];           /* reintento simple -> sin confidence */
    await runCountAI();
    let s = stats();
    ok('reintento simple: single 1 de 1, viaRetry 1', s && s.single.total === 1 && s.single.missing === 1 && s.single.viaRetry === 1, s && s.single);
    ok('log "CONFIANZA ausente (single): 1 de 1 (100%)"', debugLogs.some(l => l.startsWith('CONFIANZA ausente (single): 1 de 1 análisis (100%)') && l.includes('1 vía reintento')), debugLogs.filter(l => l.includes('CONFIANZA')));
    ok('sigue el log original "Respuesta SIN confidence válida"', debugLogs.some(l => l.includes('Respuesta SIN confidence válida')));
    queue = [noConf(20)];                                  /* prompt normal pero Claude omite el campo */
    await runCountAI();
    s = stats();
    ok('omitido en el prompt normal: missing 2, viaRetry sigue 1', s.single.total === 2 && s.single.missing === 2 && s.single.viaRetry === 1, s.single);
    queue = [J(20, 'alta')];
    await runCountAI();
    s = stats();
    ok('respuesta válida: total sube, missing no', s.single.total === 3 && s.single.missing === 2, s.single);
    renderStats();
    ok('pocas muestras (<10): aviso de no fiable y SIN aviso de 15%', $('confStatsInfo').textContent.includes('Pocas muestras') && !$('confStatsInfo').textContent.includes('Supera el 15%'), $('confStatsInfo').textContent.replace(/\s+/g, ' '));
    ok('muestra "2 de 3 análisis (67%)"', $('confStatsInfo').textContent.includes('2 de 3 análisis (67%)'));
    for (let i = 0; i < 9; i++) { queue = [J(20, 'alta')]; await runCountAI(); }
    s = stats();
    ok('12 análisis, 2 sin confianza', s.single.total === 12 && s.single.missing === 2, s.single);
    renderStats();
    let t = $('confStatsInfo').textContent.replace(/\s+/g, ' ');
    ok('17% con 12 muestras: aviso "Supera el 15%" + revisar prompt del reintento', t.includes('2 de 12 análisis (17%)') && t.includes('Supera el 15%') && t.includes('prompt del reintento'), t);
    ok('desglose: 1 reintento · 1 prompt normal', t.includes('1 vinieron del reintento simple · 1 del prompt normal'), t);
    ok('el % en naranja cuando supera el umbral', $('confStatsInfo').innerHTML.includes('color:var(--orange);font-weight:700;font-size:14px'));
    for (let i = 0; i < 6; i++) { queue = [J(20, 'alta')]; await runCountAI(); }   /* 18 análisis, 2 -> 11% */
    renderStats(); t = $('confStatsInfo').textContent;
    ok('11% (18 muestras): sin aviso', t.includes('2 de 18 análisis (11%)') && !t.includes('Supera el 15%'), t.replace(/\s+/g, ' '));

    /* multifoto */
    loadProfile('12'); multifotos.length = 0; debugLogs.length = 0;
    queue = [noConf(20)];
    addPhotoToMultifoto('', 'AAAA', 'image/jpeg'); await sleep(150);
    s = stats();
    ok('multifoto sin confidence: multi 1 de 1, single intacto', s.multi.total === 1 && s.multi.missing === 1 && s.single.total === 18, s);
    ok('multifoto: sigue mostrando "media" y lo loguea', multifotos[0].result.confidence === 'media' && debugLogs.some(l => l.startsWith('[multifoto] Respuesta SIN confidence válida')));
    queue = [J(20, 'baja')];
    addPhotoToMultifoto('', 'AAAA', 'image/jpeg'); await sleep(150);
    ok('multifoto con confidence válida: se respeta "baja"', multifotos[1].result.confidence === 'baja' && stats().multi.total === 2 && stats().multi.missing === 1);
    renderStats();
    ok('UI muestra el desglose multifoto', $('confStatsInfo').textContent.includes('Multifoto: 1 de 2 fotos sin confianza'));
    queue = [J(20, 'rarisima')];
    addPhotoToMultifoto('', 'AAAA', 'image/jpeg'); await sleep(150);
    ok('multifoto con confidence inválida -> "media" (antes mostraba el texto crudo)', multifotos[2].result.confidence === 'media');

    /* errores de red no cuentan */
    const before = JSON.stringify(stats().single);
    window.fetch = async () => ({ ok: false, status: 500, json: async () => ({ error: { message: 'boom' } }) });
    await runCountAI();
    ok('un error de API no cuenta como análisis', JSON.stringify(stats().single) === before);

    /* reiniciar */
    resetConfStats();
    ok('reiniciar borra el contador', localStorage.getItem('confidenceStats') === null && $('confStatsInfo').textContent.includes('aún sin análisis'));

    /* localStorage corrupto / sin espacio no rompe el análisis */
    localStorage.setItem('confidenceStats', '{no json');
    window.fetch = async () => ({ ok: true, json: async () => ({ content: [{ text: J(5, 'alta') }] }) });
    await runCountAI();
    ok('contador corrupto: se recupera y cuenta desde cero', stats() && stats().single.total === 1, stats());
    const origSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (k === 'confidenceStats') throw new DOMException('full', 'QuotaExceededError'); return origSet.call(this, k, v); };
    let threw = false;
    try { await runCountAI(); } catch (e) { threw = true; }
    Storage.prototype.setItem = origSet;
    ok('si el contador no cabe, el análisis sigue funcionando', !threw && $('statusCount').textContent.includes('detectados'), $('statusCount').textContent);
  } catch (e) {
    R.push('EXC ' + (e && e.stack || e));
  }
  const pre = document.createElement('pre'); pre.id = 'res'; pre.textContent = R.join('\n');
  document.body.appendChild(pre);
  document.title = 'RES:' + encodeURIComponent('TOTAL=' + R.length + ' PASS=' + R.filter(x => x.startsWith('PASS')).length + '\n' + R.filter(x => !x.startsWith('PASS')).join('\n'));
});


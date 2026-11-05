// SUITE: 12-v97-experimental-model
// v9.7: modo experimental de modelo (Sonnet 5.5) aislado de produccion: interruptor solo en memoria, indicador, log por llamada, contador, exclusion de las metricas de produccion
// @http
// @timeout 120
if (location.search.indexOf('frame=1') >= 0) {
  /* Instancia "recien abierta" dentro de un iframe: sirve para comprobar que el interruptor NO se hereda entre sesiones */
  window.addEventListener('load', () => {
    document.title = 'FRAME:' + JSON.stringify({ on: experimentalModelOn, model: countModel(), banner: getComputedStyle(document.getElementById('expModelBanner')).display, btn: document.getElementById('btnExpModel') ? 'x' : '' });
  });
} else window.addEventListener('load', async () => {
  const R = [];
  const ok = (n, c, extra) => R.push((c ? 'PASS ' : 'FAIL ') + n + (extra !== undefined ? '  => ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = id => document.getElementById(id);
  const hist = () => JSON.parse(localStorage.getItem('analysisHistory') || '[]');
  const exs = () => JSON.parse(localStorage.getItem('referenceExamples') || '[]');
  const J = (n, conf) => JSON.stringify({ small: 0, medium: n, large: 0, total: n, confidence: conf || 'alta', overlap: false, size_match: true, size_detected: null, notes: null });
  const okResp = (blocks) => ({ ok: true, json: async () => ({ stop_reason: 'end_turn', content: blocks }) });
  const txt = t => okResp([{ type: 'text', text: t }]);
  const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
  let queue = [], bodies = [];
  window.fetch = async (u, o) => { bodies.push(JSON.parse(o.body)); const q = queue.shift(); return typeof q === 'function' ? q() : q; };
  const confStats = () => JSON.parse(localStorage.getItem('confidenceStats') || 'null');
  const expCount = () => JSON.parse(localStorage.getItem('expModelStats') || '{"count":0}').count;
  const photo = async (n, name) => { loadCount({ target: { files: [new File([PNG], name || 'p.png', { type: 'image/png' })] } }); await sleep(700); };
  try {
    window.confirm = () => true; localStorage.clear(); localStorage.setItem('claudeApiKey', 'sk-ant-test');
    loadProfile('8');

    /* ── A. estado por defecto = PRODUCCION ── */
    ok('al abrir: modelo experimental desactivado', experimentalModelOn === false && countModel() === 'claude-sonnet-4-6');
    renderExpModelBanner(); renderExpModelCard();
    ok('sin banner morado en Contar', getComputedStyle($('expModelBanner')).display === 'none');
    ok('tarjeta de Ajustes: PRODUCCIÓN + claude-sonnet-4-6 y botón para activar', /PRODUCCIÓN/.test($('expModelState').textContent) && /claude-sonnet-4-6/.test($('expModelState').textContent) && /Activar modelo experimental \(Sonnet 5\.5\)/.test($('btnExpModel').textContent), $('expModelState').textContent);

    debugLogs.length = 0; queue = [txt(J(41))]; await photo(41);
    ok('producción: la petición usa claude-sonnet-4-6', bodies.length === 1 && bodies[0].model === 'claude-sonnet-4-6', bodies.map(b => b.model));
    ok('el log registra el modelo de la llamada (sin 🧪)', debugLogs.some(l => l === 'LLAMADA IA [foto única · 1ª llamada] modelo=claude-sonnet-4-6'), debugLogs.filter(l => l.startsWith('LLAMADA')));
    ok('y el del análisis con su resultado', debugLogs.some(l => /^ANÁLISIS \[foto única\] modelo=claude-sonnet-4-6 total=41 confianza=alta reintento=no/.test(l)), debugLogs.filter(l => l.startsWith('ANÁLISIS')));
    ok('y el de envío de imagen', debugLogs.some(l => l.startsWith('ENVÍO IA [foto única] modelo=claude-sonnet-4-6:')));
    ok('la entrada de historial guarda model de producción', hist()[0].model === 'claude-sonnet-4-6');
    ok('cuenta en el contador de confianza de producción', confStats() && confStats().single.total === 1);
    ok('el contador experimental sigue en 0', expCount() === 0);
    ok('no se envía temperature', !('temperature' in bodies[0]));

    /* ── B. activar / cancelar ── */
    window.confirm = () => false; toggleExperimentalModel();
    ok('cancelar la confirmación NO activa nada', experimentalModelOn === false && getComputedStyle($('expModelBanner')).display === 'none');
    let msg = ''; window.confirm = m => { msg = m; return true; }; debugLogs.length = 0;
    toggleExperimentalModel();
    ok('la confirmación explica que no cambia producción, que se marca 🧪 y que se desactiva al cerrar', /producción sigue en claude-sonnet-4-6/.test(msg) && /no cuentan en las estadísticas/.test(msg) && /cerrar o recargar/.test(msg), msg);
    ok('activado: modelo = claude-sonnet-5-5', experimentalModelOn === true && countModel() === 'claude-sonnet-5-5');
    ok('banner morado visible en Contar con modelo y contador', getComputedStyle($('expModelBanner')).display === 'block' && /🧪 Modelo experimental: Sonnet 5\.5 · 0 análisis/.test($('expModelBanner').textContent), $('expModelBanner').textContent);
    ok('la tarjeta lo muestra y el botón pasa a "Desactivar"', /EXPERIMENTAL activo/.test($('expModelState').textContent) && /Desactivar y volver a producción \(Sonnet 4\.6\)/.test($('btnExpModel').textContent));
    ok('log de activación', debugLogs.some(l => l.startsWith('MODELO EXPERIMENTAL ACTIVADO') && l.includes('claude-sonnet-5-5')));
    openCameraModal('single'); await sleep(500);
    ok('el visor de cámara también avisa (a pantalla completa no se ve el banner)', getComputedStyle($('cameraExpInfo')).display === 'block' && /Sonnet 5\.5/.test($('cameraExpInfo').textContent));
    closeCameraModal();

    /* ── C. analisis experimentales ── */
    bodies = []; debugLogs.length = 0; const confBefore = JSON.stringify(confStats());
    queue = [txt(J(40))]; await photo(40, 'b.png');
    ok('experimental: la petición usa claude-sonnet-5-5', bodies.length === 1 && bodies[0].model === 'claude-sonnet-5-5', bodies.map(b => b.model));
    ok('sin temperature, mismos parámetros que producción (max_tokens 600)', !('temperature' in bodies[0]) && bodies[0].max_tokens === 600);
    ok('el log marca la llamada como EXPERIMENTAL con el modelo', debugLogs.some(l => l === 'LLAMADA IA [foto única · 1ª llamada] modelo=claude-sonnet-5-5 🧪 EXPERIMENTAL'), debugLogs.filter(l => l.startsWith('LLAMADA')));
    ok('log del análisis con el modelo', debugLogs.some(l => /^ANÁLISIS \[foto única\] modelo=claude-sonnet-5-5 total=40/.test(l)));
    ok('la línea de estado del resultado muestra 🧪 Sonnet 5.5', /🧪 Sonnet 5\.5/.test($('statusCount').textContent), $('statusCount').textContent);
    ok('la entrada de historial guarda model experimental', hist()[0].model === 'claude-sonnet-5-5');
    ok('contador experimental = 1 y el banner lo refleja', expCount() === 1 && /· 1 análisis/.test($('expModelBanner').textContent), $('expModelBanner').textContent);
    ok('el contador de confianza de PRODUCCIÓN no se tocó', JSON.stringify(confStats()) === confBefore);
    historyFilter = 'all'; renderHistory();
    ok('el historial marca la entrada con 🧪 Sonnet 5.5', /🧪 Sonnet 5\.5/.test($('historyList').children[0].textContent), $('historyList').children[0].textContent.replace(/\s+/g, ' ').slice(0, 100));
    ok('y la de producción no lleva marca', !/🧪/.test($('historyList').children[1].textContent));

    /* reintento: mismo modelo en las dos llamadas, un solo análisis contado */
    bodies = []; queue = [txt('no json'), txt('{"total":38,"confidence":"media"}')];
    await photo(38, 'c.png');
    ok('reintento: ambas llamadas con el modelo experimental', bodies.length === 2 && bodies.every(b => b.model === 'claude-sonnet-5-5'), bodies.map(b => b.model));
    ok('cuenta UN análisis (no una por llamada)', expCount() === 2, expCount());
    ok('el log distingue 1ª llamada y reintento', debugLogs.some(l => l.includes('· reintento] modelo=claude-sonnet-5-5')));

    /* bloques que no son texto antes (p. ej. 'thinking') */
    bodies = []; queue = [okResp([{ type: 'thinking', thinking: 'hmm' }, { type: 'text', text: J(36) }])];
    await photo(36, 'd.png');
    ok('se lee el primer bloque de TEXTO aunque haya otros delante', hist()[0].total === 36 && hist()[0].model === 'claude-sonnet-5-5', hist()[0].total);
    bodies = []; queue = [okResp([{ type: 'thinking', thinking: 'sin texto' }])];
    await photo(0, 'e.png');
    ok('respuesta sin bloque de texto: error claro, sin romper', /no contiene texto/.test($('statusCount').textContent), $('statusCount').textContent);
    const c2 = expCount();
    bodies = []; queue = [() => ({ ok: false, status: 500, json: async () => ({ error: { message: 'boom' } }) })];
    await photo(0, 'f.png');
    ok('los errores de API no se cuentan como análisis', expCount() === c2, [c2, expCount()]);

    /* multifoto */
    multifotos.length = 0; multiSavedId = null; multiSavedSig = null; multiConfirmed = false; localStorage.setItem('analysisHistory', '[]'); bodies = [];
    queue = [txt(J(20)), txt(J(22))]; const c3 = expCount();
    addPhotoToMultifoto('', 'AAAA', 'image/jpeg'); addPhotoToMultifoto('', 'BBBB', 'image/jpeg'); await sleep(500);
    ok('multifoto: las dos fotos usan el modelo experimental', bodies.length === 2 && bodies.every(b => b.model === 'claude-sonnet-5-5'));
    ok('y cada foto analizada cuenta (2 más)', expCount() === c3 + 2, [c3, expCount()]);
    confirmMultiTotal(); await sleep(700);
    ok('el lote confirmado queda marcado con el modelo experimental', hist()[0].model === 'claude-sonnet-5-5');
    multifotos.length = 0; resetMulti();

    /* interruptor cambiado a mitad de un análisis: manda el modelo con el que EMPEZÓ */
    bodies = []; let release; const gate = new Promise(r => { release = r; });
    queue = [() => gate.then(() => txt(J(44)))];
    loadCount({ target: { files: [new File([PNG], 'g.png', { type: 'image/png' })] } }); await sleep(500);
    toggleExperimentalModel();   /* se desactiva mientras la llamada sigue en vuelo */
    ok('(interruptor desactivado a mitad de análisis)', experimentalModelOn === false);
    release(); await sleep(600);
    ok('la llamada en vuelo siguió siendo experimental y su resultado también', bodies[0].model === 'claude-sonnet-5-5' && hist()[0].model === 'claude-sonnet-5-5', [bodies[0].model, hist()[0].model]);

    /* ── D. aislamiento de las metricas de produccion ── */
    localStorage.setItem('analysisHistory', JSON.stringify([
      { id: 'p1', date: '1/1/2026 10:00', ts: Date.now(), total: 40, aiTotal: 41, size8: 40, size4: 0, size12: 0, confidence: 'alta', model: 'claude-sonnet-4-6' },
      { id: 'p0', date: '1/1/2026 10:00', ts: Date.now(), total: 40, aiTotal: 40, size8: 40, size4: 0, size12: 0, confidence: 'alta' },   /* entrada antigua sin model = producción */
      { id: 'e1', date: '1/1/2026 10:00', ts: Date.now(), total: 40, aiTotal: 41, size8: 40, size4: 0, size12: 0, confidence: 'alta', model: 'claude-sonnet-5-5' },
      { id: 'e2', date: '1/1/2026 10:00', ts: Date.now(), total: 40, aiTotal: 40, size8: 40, size4: 0, size12: 0, confidence: 'alta', model: 'claude-sonnet-5-5' },
      { id: 'e3', date: '1/1/2026 10:00', ts: Date.now(), total: 40, aiTotal: 43, size8: 40, size4: 0, size12: 0, confidence: 'media', model: 'claude-sonnet-5-5', viaRetry: true }
    ]));
    ok('"Estado del entrenamiento" excluye los experimentales (cuenta 2: producción + antigua sin model)', computeStats({ scope: 'all' })['8'].totalAnalyses === 2, computeStats({ scope: 'all' })['8'].totalAnalyses);
    ok('…y se pueden pedir explícitamente (5)', statsHistoryEntries({ scope: 'all', includeExperimental: true })['8'].length === 5);
    renderExampleCounts();
    ok('la barra superior cuenta solo producción', /8mm\s*2m/.test($('exCounts').textContent.replace(/\s+/g, ' ')), $('exCounts').textContent.replace(/\s+/g, ' '));

    /* ── E. ejemplos: el aiTotal de un análisis experimental no se copia ── */
    localStorage.setItem('referenceExamples', '[]'); queue = [txt(J(41))]; experimentalModelOn = true; bodies = [];
    await photo(41, 'h.png'); await saveAsExample();
    ok('ejemplo guardado desde un análisis EXPERIMENTAL: sin aiTotal (queda aiModel)', exs().length === 1 && exs()[0].aiTotal === undefined && exs()[0].aiModel === 'claude-sonnet-5-5', exs()[0] && [exs()[0].aiTotal, exs()[0].aiModel]);
    experimentalModelOn = false; queue = [txt(J(39))]; await photo(39, 'i.png'); await saveAsExample();
    ok('ejemplo desde un análisis de PRODUCCIÓN: conserva aiTotal', exs().length === 2 && exs()[1].aiTotal === 39 && exs()[1].aiModel === undefined, exs()[1] && exs()[1].aiTotal);

    /* ── F. tarjeta de resultados ── */
    localStorage.setItem('analysisHistory', JSON.stringify([
      { id: 'p1', date: 'd', ts: Date.now(), total: 40, aiTotal: 43, size8: 40, size4: 0, size12: 0, confidence: 'alta', model: 'claude-sonnet-4-6' },
      { id: 'p2', date: 'd', ts: Date.now(), total: 40, aiTotal: 37, size8: 40, size4: 0, size12: 0, confidence: 'alta' },
      { id: 'e1', date: 'd', ts: Date.now(), total: 40, aiTotal: 41, size8: 40, size4: 0, size12: 0, confidence: 'alta', model: 'claude-sonnet-5-5' },
      { id: 'e2', date: 'd', ts: Date.now(), total: 40, aiTotal: 40, size8: 40, size4: 0, size12: 0, confidence: 'alta', model: 'claude-sonnet-5-5' },
      { id: 'e3', date: 'd', ts: Date.now(), total: 40, aiTotal: 43, size8: 40, size4: 0, size12: 0, confidence: 'media', model: 'claude-sonnet-5-5', viaRetry: true },
      { id: 'em', date: 'd', ts: Date.now(), total: 50, aiTotal: 50, size8: 50, size4: 0, size12: 0, model: 'claude-sonnet-5-5', photoBreakdown: [{ ai: 25, total: 25 }, { ai: 25, total: 25 }] }
    ]));
    renderStats();
    const rt = $('expModelResults').textContent.replace(/\s+/g, ' ');
    ok('tabla: experimental en 8mm = error medio 1.3, sesgo +1.3, 2/3 dentro de ±2 (multifoto excluida)', /Sonnet 5\.5 — — 1\.3 \(\+1\.3\) · 2\/3 \*/.test(rt.replace('🧪 ', '').replace('—  —', '— —')) || /1\.3 \(\+1\.3\) · 2\/3/.test(rt), rt.slice(0, 260));
    ok('tabla: producción = error medio 3 (+0 de sesgo: +3 y -3), 1/2', /3 \(0\) · 0\/2/.test(rt), rt.slice(0, 300));
    let copied = null; Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { copied = t; return Promise.resolve(); } }, configurable: true });
    copyExpResults(); await sleep(100);
    const cj = copied && JSON.parse(copied);
    ok('copiar resultados: 3 análisis experimentales de foto única con error y reintento', cj && cj.modelo === 'claude-sonnet-5-5' && cj.analisis.length === 3 && cj.analisis[0].error !== undefined && cj.analisis.some(a => a.reintento === true), cj && cj.analisis.length);

    /* ── G. contador y desactivar ── */
    experimentalModelOn = true; renderExpModelBanner(); window.confirm = () => true;
    toggleExperimentalModel();
    ok('desactivar vuelve a producción sin confirmación', experimentalModelOn === false && countModel() === 'claude-sonnet-4-6' && getComputedStyle($('expModelBanner')).display === 'none');
    resetExpStats();
    ok('reiniciar contador', expCount() === 0 && /Análisis hechos en modo experimental: 0/.test($('expModelCounter').textContent));
    bodies = []; queue = [txt(J(40))]; await photo(40, 'j.png');
    ok('tras desactivar, el siguiente análisis vuelve a claude-sonnet-4-6', bodies[0].model === 'claude-sonnet-4-6' && hist()[0].model === 'claude-sonnet-4-6');

    /* ── H. NO persiste entre sesiones ── */
    experimentalModelOn = true; bumpExpCount();
    const keys = Object.keys(localStorage).filter(k => /exp/i.test(k)), skeys = Object.keys(sessionStorage);
    ok('en localStorage solo existe el CONTADOR (expModelStats), ninguna clave con el estado activado', keys.join() === 'expModelStats' && !/"on"|active|activ/i.test(localStorage.getItem('expModelStats')), keys);
    ok('nada en sessionStorage', skeys.length === 0, skeys);
    const fr = document.createElement('iframe'); fr.style.display = 'none'; fr.src = location.pathname + '?frame=1'; document.body.appendChild(fr);
    for (let i = 0; i < 60 && !(fr.contentDocument && /^FRAME:/.test(fr.contentDocument.title)); i++) await sleep(250);
    const fs = fr.contentDocument && /^FRAME:/.test(fr.contentDocument.title) ? JSON.parse(fr.contentDocument.title.slice(6)) : null;
    ok('una instancia recién abierta (con este navegador y su localStorage, con el interruptor ACTIVO aquí) arranca en producción y sin banner', experimentalModelOn === true && fs && fs.on === false && fs.model === 'claude-sonnet-4-6' && fs.banner === 'none', fs);
    experimentalModelOn = false;
  } catch (e) { R.push('EXC ' + (e && e.stack || e)); }
  const pre = document.createElement('pre'); pre.id = 'res'; pre.style.display = 'none';
  pre.textContent = 'TOTAL=' + R.length + ' PASS=' + R.filter(x => x.startsWith('PASS')).length + '\n' + R.join('\n');
  document.body.appendChild(pre); document.title = 'RES:done';
});

// SUITE: 06-v91-retry-confidence-stats-baseline
// v9.1: reintento pide confidence, diagnostico de 1a respuesta sin JSON, estadisticas por periodo/tipo y linea base
window.addEventListener('load', async () => {
  const R = [];
  const ok = (n, c, extra) => R.push((c ? 'PASS ' : 'FAIL ') + n + (extra !== undefined ? '  => ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = id => document.getElementById(id);
  const hist = () => JSON.parse(localStorage.getItem('analysisHistory') || '[]');
  const stats = () => JSON.parse(localStorage.getItem('confidenceStats') || 'null');
  const J = (total, conf) => JSON.stringify({ small: 0, medium: total, large: 0, total, confidence: conf || 'alta', overlap: false, size_match: true, size_detected: null, notes: null });
  try {
    window.confirm = () => true;
    localStorage.clear();
    localStorage.setItem('claudeApiKey', 'sk-ant-test');

    /* ───────── 1. reintento simple con confidence + diagnóstico ───────── */
    const calls = []; let queue = [];
    window.fetch = async (u, o) => { calls.push(JSON.parse(o.body)); const q = queue.shift(); return { ok: true, json: async () => ({ stop_reason: q.stop, content: [{ text: q.text }] }) }; };
    const textOf = body => body.messages[0].content.filter(x => x.type === 'text').pop().text;
    lastImageBase64 = 'iVBORw0KGgo='; lastImageMime = 'image/png';
    $('cvCount').width = 100; $('cvCount').height = 100;
    loadProfile('8');
    queue = [{ stop: 'max_tokens', text: 'Voy a dividir la imagen en una cuadrícula. Fila 1: 5, fila 2: 6, fila 3: ...' }, { stop: 'end_turn', text: '{"total": 41, "confidence": "baja"}' }];
    debugLogs.length = 0;
    await runCountAI();
    ok('el reintento simple pide "confidence"', calls.length === 2 && /"confidence": "media"/.test(textOf(calls[1])) && /"alta", "media" o "baja"/.test(textOf(calls[1])), textOf(calls[1]).slice(0, 260));
    ok('el reintento sigue siendo el prompt simple (sin reglas ni cuadrícula)', !/REGLAS ABSOLUTAS/.test(textOf(calls[1])) && calls[1].messages[0].content.every(x => x.type !== 'image' || true));
    ok('con confidence devuelta en el reintento: ya NO sale "no disponible"', /Confianza: baja/.test($('statusCount').textContent), $('statusCount').textContent);
    ok('y se guarda en el historial', hist()[0].confidence === 'baja' && hist()[0].total === 41, hist()[0].confidence);
    let s = stats();
    ok('contador: 1 reintento, cortado por max_tokens, 0 sin confianza', s.single.retried === 1 && s.single.cutMax === 1 && s.single.missing === 0 && s.single.total === 1, s.single);
    ok('log con stop_reason y arranque de la respuesta', debugLogs.some(l => l.startsWith('1ª respuesta SIN JSON (stop_reason=max_tokens') && l.includes('cuadrícula')), debugLogs.filter(l => l.includes('SIN JSON')));
    renderStats();
    const t1 = $('confStatsInfo').textContent.replace(/\s+/g, ' ');
    ok('UI: "1ª respuesta sin JSON … 1 de 1 (100%) · 1 cortadas por max_tokens"', /1ª respuesta sin JSON[^·]*1 de 1 \(100%\) · 1 cortadas por max_tokens/.test(t1), t1);

    /* retry que sigue sin traer confidence (modelo desobedece): se conserva el fallback */
    queue = [{ stop: 'end_turn', text: 'no json' }, { stop: 'end_turn', text: '{"total": 40}' }];
    await runCountAI();
    ok('si el reintento NO trae confidence, sigue "no disponible" (fallback intacto)', /Confianza: no disponible/.test($('statusCount').textContent));
    s = stats();
    ok('contador: reintento sin cortar por max_tokens', s.single.retried === 2 && s.single.cutMax === 1 && s.single.missing === 1 && s.single.viaRetry === 1, s.single);

    /* respuesta normal: no cuenta como reintento */
    queue = [{ stop: 'end_turn', text: J(42) }];
    await runCountAI();
    s = stats();
    ok('respuesta normal: sin reintento', s.single.retried === 2 && s.single.total === 3, s.single);

    /* modo clasificar: su reintento también pide confidence */
    $('sizeMode').value = 'multi';
    queue = [{ stop: 'end_turn', text: 'nada' }, { stop: 'end_turn', text: '{"small":10,"medium":20,"large":5,"total":35,"confidence":"media"}' }];
    await runCountAI();
    ok('modo clasificar: el reintento pide confidence', /"confidence":"media"/.test(textOf(calls[calls.length - 1])) && /small/.test(textOf(calls[calls.length - 1])));
    $('sizeMode').value = 'single';

    /* multifoto: reintento con confidence + diagnóstico */
    loadProfile('12'); multifotos.length = 0; debugLogs.length = 0;
    const n0 = calls.length;
    queue = [{ stop: 'max_tokens', text: 'Contando...' }, { stop: 'end_turn', text: '{"small":0,"medium":22,"large":0,"total":22,"confidence":"alta","notes":null}' }];
    addPhotoToMultifoto('', 'AAAA', 'image/jpeg'); await sleep(300);
    ok('multifoto: el reintento pide "alta/media/baja"', /"alta", "media" o "baja"/.test(textOf(calls[n0 + 1])));
    ok('multifoto: conserva la confianza devuelta ("alta")', multifotos[0].result.confidence === 'alta');
    ok('multifoto: log del motivo', debugLogs.some(l => l.startsWith('[multifoto] 1ª respuesta SIN JSON (stop_reason=max_tokens')));
    s = stats();
    ok('contador multi: 1 reintento y 1 corte por max_tokens', s.multi.retried === 1 && s.multi.cutMax === 1 && s.multi.missing === 0, s.multi);

    /* ───────── 2. Estado del entrenamiento: periodo / tipo / línea base ───────── */
    localStorage.removeItem('statsBaseline'); localStorage.removeItem('statsScope'); localStorage.removeItem('statsKind');
    const BASE = STATS_BASELINE_DEFAULT;
    const mk = (id, size, ai, tot, extra) => Object.assign({ id, date: 'x', total: tot, aiTotal: ai, size4: size === '4' ? tot : 0, size8: size === '8' ? tot : 0, size12: size === '12' ? tot : 0, confidence: 'alta' }, extra || {});
    const d = (day, hh) => `${day}/10/2026 ${hh}:00`;
    const H = [
      /* nuevas (después de v8.6), foto única */
      mk('n1', '8', 37, 40, { date: d(15, 10), ts: BASE + 3600e3 }), mk('n2', '8', 40, 40, { ts: BASE + 7200e3 }), mk('n3', '8', 42, 41, { ts: BASE + 9000e3 }), mk('n4', '8', 41, 41, { ts: BASE + 9500e3 }),
      mk('n5', '12', 35, 34, { ts: BASE + 3600e3 }), mk('n6', '12', 34, 34, { ts: BASE + 3700e3 }),
      /* nueva multifoto 8mm con error grande */
      mk('nm', '8', 150, 120, { ts: BASE + 4000e3, photoBreakdown: [{ ai: 50, total: 40 }, { ai: 50, total: 40 }, { ai: 50, total: 40 }] }),
      /* viejas: sin ts, con fecha anterior; una solo con id antiguo; una de fecha desconocida */
      mk('o1', '4', 60, 52, { date: '2/10/2026 09:30' }), mk('o2', '4', 49, 52, { date: '3/10/2026 11:00' }), mk('o3', '8', 50, 40, { date: '1/10/2026 12:00' }),
      mk(Date.parse('2026-09-20T10:00:00Z').toString(36) + 'abcd', '12', 20, 10, { date: undefined }), mk('o5', '12', 30, 20, { date: 'sin fecha' }),
      /* pesada: nunca cuenta */
      { id: 'w1', date: d(15, 9), ts: BASE + 1000, method: 'weigh', total: 99, calcTotal: 99, size8: 99, size4: 0, size12: 0 }
    ];
    localStorage.setItem('analysisHistory', JSON.stringify(H));
    renderStats();
    const tbl = () => [...$('trainingDashboard').querySelectorAll('tbody tr')].reduce((a, tr) => { const c = [...tr.children].map(x => x.textContent.trim()); a[c[0]] = c.slice(1); return a; }, {});
    let T = tbl();
    ok('por defecto: periodo = desde línea base (botón activo)', [...$('trainingDashboard').querySelectorAll('.hist-subtab.active')].map(b => b.textContent.trim()).join('|') === 'Desde línea base|Todos');
    ok('línea base: 4mm sin muestras (todas anteriores)', T['Muest.'][0] === '—', T['Muest.']);
    ok('línea base: 8mm = 4 fotos únicas + 1 multifoto = 5; 12mm = 2', T['Muest.'][1] === '5' && T['Muest.'][2] === '2', T['Muest.']);
    ok('se indican las excluidas (5: 3 de 4mm/8mm/12mm con fecha + 2 sin fecha/ id viejo)', /5 anteriores excluidos \(siguen en el Historial\)/.test($('trainingDashboard').textContent.replace(/\s+/g, ' ')), $('trainingDashboard').textContent.replace(/\s+/g, ' ').match(/Contando[^.]*\./));
    ok('historial intacto (13 entradas)', hist().length === 13);
    renderExampleCounts(); ok('topbar sigue contando TODO el historial (4mm 2m, 8mm 6m, 12mm 4m)', /4mm 2m\/.*8mm 5?6?m|4mm\s*2m/.test($('exCounts').textContent.replace(/\s+/g, ' ')) && /8mm\s*6m/.test($('exCounts').textContent.replace(/\s+/g, ' ')) && /12mm\s*4m/.test($('exCounts').textContent.replace(/\s+/g, ' ')), $('exCounts').textContent.replace(/\s+/g, ' '));

    /* tipo */
    setStatsKind('single'); T = tbl();
    ok('foto única: 8mm = 4, error medio = (3+0+1+0)/4 = ±1', T['Muest.'][1] === '4' && T['Err. medio'][1].startsWith('±1'), [T['Muest.'], T['Err. medio']]);
    ok('foto única: dentro de ±2 = 75% (el error de 3 queda fuera)', T['Dentro ±2'][1] === '75%' && T['Dentro ±2'][2] === '100%', T['Dentro ±2']);
    setStatsKind('multi'); T = tbl();
    ok('multifoto: 8mm = 1 muestra con error 30', T['Muest.'][1] === '1' && T['Err. medio'][1].startsWith('±30') && T['Muest.'][2] === '—', [T['Muest.'], T['Err. medio']]);
    setStatsKind('all'); T = tbl();
    ok('todas: la multifoto infla el error medio de 8mm (≥ ±6) frente a foto única (±1)', parseFloat(T['Err. medio'][1].replace('±', '')) >= 6, T['Err. medio']);
    ok('"Error corr." solo promedia las corregidas (≠ Err. medio)', T['Error corr.'][1] !== T['Err. medio'][1], [T['Error corr.'], T['Err. medio']]);

    /* todo el historial */
    setStatsScope('all'); T = tbl();
    ok('todo el historial: 4mm 2 muestras, 8mm 6, 12mm 4', T['Muest.'].join(',') === '2,6,4', T['Muest.']);
    ok('todo el historial: error medio 4mm = (8+3)/2 = ±5.5→±5.5', /±5\.5/.test(T['Err. medio'][0]), T['Err. medio']);
    ok('texto avisa de que mezcla versiones', /mezcla versiones antiguas/.test($('trainingDashboard').textContent));
    ok('la pesada no cuenta nunca', T['Muest.'].reduce((a, b) => a + parseInt(b), 0) === 12);

    /* fijar línea base ahora */
    resetStatsBaseline(); T = tbl();
    ok('fijar línea base ahora: todas las métricas empiezan de cero', T['Muest.'].join(',') === '—,—,—', T['Muest.']);
    ok('… y el historial NO se borra (13 entradas)', hist().length === 13 && localStorage.getItem('statsScope') === 'baseline');
    loadProfile('8'); queue = [{ stop: 'end_turn', text: J(10) }]; lastImageBase64 = 'iVBORw0KGgo='; await runCountAI(); renderStats(); T = tbl();
    ok('un análisis nuevo (con ts) sí cuenta tras la línea base', T['Muest.'][1] === '1', T['Muest.']);
    ok('entradas nuevas llevan ts', typeof hist()[0].ts === 'number' && Math.abs(hist()[0].ts - Date.now()) < 5000);
    ok('la preferencia persiste (statsBaseline guardado)', parseInt(localStorage.getItem('statsBaseline')) > BASE);

    /* entryTime */
    ok('entryTime: ts > fecha > id', entryTime({ ts: 5 }) === 5 && entryTime({ date: '14/10/2026 15:07' }) === new Date(2026, 9, 14, 15, 7).getTime() && entryTime({ id: Date.parse('2026-09-20T10:00:00Z').toString(36) + 'zzzz' }) === Date.parse('2026-09-20T10:00:00Z') && entryTime({ date: 'x', id: 'a' }) === 0);
    /* contador antiguo (v8.4-v9.0, sin 'retried'): se migra y muestra bien */
    localStorage.setItem('confidenceStats', JSON.stringify({ single: { total: 15, missing: 13, viaRetry: 13 }, multi: { total: 0, missing: 0 }, since: '12/10/2026' }));
    renderConfStats();
    const tl = $('confStatsInfo').textContent.replace(/\s+/g, ' ');
    ok('contador antiguo: 13 de 15 (87%) también como 1ª respuesta sin JSON', /13 de 15 análisis \(87%\)/.test(tl) && /sin JSON[^:]*: 13 de 15 \(87%\)/.test(tl) && /0 cortadas por max_tokens/.test(tl), tl);
  } catch (e) { R.push('EXC ' + (e && e.stack || e)); }
  const pre = document.createElement('pre'); pre.id = 'res'; pre.style.display = 'none';
  pre.textContent = 'TOTAL=' + R.length + ' PASS=' + R.filter(x => x.startsWith('PASS')).length + '\n' + R.join('\n');
  document.body.appendChild(pre);
  document.title = 'RES:done';
});

// SUITE: 08-v93-sharpness-density-single-4mm-profile
// v9.3: metrica de nitidez, veredicto de enfoque, alerta de densidad en foto unica, perfil 4mm
window.addEventListener('load', async () => {
  const R = [];
  const ok = (n, c, extra) => R.push((c ? 'PASS ' : 'FAIL ') + n + (extra !== undefined ? '  => ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = id => document.getElementById(id);
  const hist = () => JSON.parse(localStorage.getItem('analysisHistory') || '[]');
  const J = n => JSON.stringify({ small: 0, medium: n, large: 0, total: n, confidence: 'alta', overlap: false, size_match: true, size_detected: null, notes: null });
  const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
  function scene(blur, noise) {
    const c = document.createElement('canvas'); c.width = 960; c.height = 540; const g = c.getContext('2d');
    g.fillStyle = '#f0f0f0'; g.fillRect(0, 0, 960, 540); g.fillStyle = '#4a4a4a';
    for (let y = 40; y < 520; y += 50) for (let x = 40; x < 940; x += 50) { g.beginPath(); g.arc(x, y, 14, 0, 6.283); g.fill(); g.fillRect(x, y, 22, 2); }
    if (blur) { const t = document.createElement('canvas'); t.width = 960; t.height = 540; const tg = t.getContext('2d'); tg.filter = `blur(${blur}px)`; tg.drawImage(c, 0, 0); return t; }
    return c;
  }
  try {
    window.confirm = () => true; localStorage.clear(); localStorage.setItem('claudeApiKey', 'sk-ant-test');

    /* ── métrica de nitidez ── */
    const sharp = sharpnessOf(scene(0), 960, 540), soft = sharpnessOf(scene(2), 960, 540), blurry = sharpnessOf(scene(6), 960, 540);
    const flat = (() => { const c = document.createElement('canvas'); c.width = 960; c.height = 540; const g = c.getContext('2d'); g.fillStyle = '#ddd'; g.fillRect(0, 0, 960, 540); return sharpnessOf(c, 960, 540); })();
    R.push(`INFO nitidez: nítida=${sharp} · blur2px=${soft} · blur6px=${blurry} · plana=${flat}`);
    ok('nítida > suave > muy borrosa > plana', sharp > soft && soft > blurry && blurry >= flat, [sharp, soft, blurry, flat]);
    ok('la nítida duplica o más a la muy borrosa', sharp > 2 * blurry, sharp / blurry);
    ok('misma imagen a otra resolución da un valor del mismo orden (±35%)', (() => { const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; const g = c.getContext('2d'); g.drawImage(scene(0), 0, 0, 1920, 1080); const v = sharpnessOf(c, 1920, 1080); R.push('INFO 1920x1080: ' + v); return Math.abs(v - sharp) / sharp < 0.35; })());
    ok('entrada inválida devuelve null', sharpnessOf(null, 0, 0) === null);

    /* ── veredicto ── */
    const mkS = (vals, t0, dt) => vals.map((s, i) => ({ t: t0 + i * dt, s }));
    const NOW = 100000;
    ok('menos de 6 muestras: midiendo', focusVerdict(mkS([100, 100, 100], NOW - 900, 300), NOW).state === 'measuring');
    ok('estable cerca del pico: bueno', focusVerdict(mkS([100, 98, 101, 99, 100, 97, 100, 99], NOW - 2400, 300), NOW).state === 'good');
    ok('cae al 50% del pico: borroso', focusVerdict(mkS([100, 100, 98, 99, 60, 50, 48, 50], NOW - 2400, 300), NOW).state === 'blur');
    ok('cae al 70%: afinando', focusVerdict(mkS([100, 100, 98, 99, 72, 70, 71, 70], NOW - 2400, 300), NOW).state === 'tuning');
    ok('un solo bache aislado no dispara rojo (mediana de 3)', focusVerdict(mkS([100, 100, 98, 99, 100, 40, 100, 99], NOW - 2400, 300), NOW).state === 'good');
    ok('picos de hace más de 5 s se ignoran', focusVerdict(mkS([300, 300, 300, 300, 100, 100, 100, 100, 100, 100, 100, 100], NOW - 8400, 700), NOW).state === 'good');
    ok('pico 0 (imagen negra): no divide por cero', focusVerdict(mkS([0, 0, 0, 0, 0, 0, 0], NOW - 2100, 300), NOW).state === 'measuring');

    /* ── indicador en vivo en el visor (dispositivo falso) ── */
    debugLogs.length = 0;
    openCameraModal('single'); await sleep(3500);
    const ft = $('cameraFocus').textContent;
    ok('el visor muestra un veredicto de enfoque con nitidez', /(Enfoque bueno|Afinando|borroso|Midiendo)/.test(ft) && /nitidez \d+/.test(ft), ft);
    ok('hay un temporizador activo mientras el visor está abierto', focusTimer !== null && focusSamples.length >= 6, focusSamples.length);
    ok('log de la cámara incluye focusMode', debugLogs.some(l => l.startsWith('CÁMARA (inicio)') && l.includes('focusMode')) && debugLogs.some(l => l.startsWith('CÁMARA capabilities') && l.includes('focusMode')), debugLogs.filter(l => l.startsWith('CÁMARA')));
    const q = [J(41)]; window.fetch = async () => ({ ok: true, json: async () => ({ stop_reason: 'end_turn', content: [{ text: q.shift() }] }) });
    loadProfile('8');
    captureCameraPhoto(); await sleep(800);
    ok('captura: log con nitidez en vivo', debugLogs.some(l => /^CAPTURA: .*nitidez al disparar=\d[\d.]* \(última lectura en vivo=\d/.test(l)), debugLogs.filter(l => l.startsWith('CAPTURA')));
    ok('al capturar se detiene el monitor y se limpia', focusTimer === null && $('cameraFocus').textContent === '');
    ok('foto única de cámara guarda sharpness numérica', hist().length === 1 && typeof hist()[0].sharpness === 'number' && hist()[0].captureMethod === 'camera', hist()[0] && hist()[0].sharpness);
    ok('log "NITIDEZ foto (camera)"', debugLogs.some(l => l.startsWith('NITIDEZ foto (camera):')));
    q.push(J(40)); loadCount({ target: { files: [new File([PNG], 'p.png', { type: 'image/png' })] } }); await sleep(600);
    ok('foto subida (archivo) también guarda sharpness', typeof hist()[0].sharpness === 'number' && hist()[0].captureMethod === 'file', hist()[0].sharpness);
    renderHistory();
    ok('el historial muestra "🔍 nitidez N" junto al método', /🔍 nitidez \d+/.test($('historyList').textContent), $('historyList').children[0].textContent.replace(/\s+/g, ' ').slice(0, 120));
    openCameraModal('single'); await sleep(800); closeCameraModal();
    ok('cerrar con Cancelar detiene el monitor', focusTimer === null);

    /* ── alerta de densidad en foto única ── */
    lastImageBase64 = 'iVBORw0KGgo='; lastImageMime = 'image/png'; $('cvCount').width = 100; $('cvCount').height = 100;
    const run = async (size, n) => { loadProfile(size); q.push(J(n)); await runCountAI(); const el = $('densityWarning'); return { shown: getComputedStyle(el).display !== 'none', text: el.textContent }; };
    let r = await run('8', 64);
    ok('8mm 64 > 40: avisa', r.shown && r.text.includes('64 uds') && r.text.includes('≤40') && r.text.includes('8mm') && /Multifoto/.test(r.text), r.text);
    r = await run('8', 40); ok('8mm 40 (= límite): no avisa', !r.shown);
    r = await run('4', 50); ok('4mm 50 > 30: avisa', r.shown && r.text.includes('≤30'), r.text);
    r = await run('12', 38); ok('12mm 38 > 30: avisa', r.shown && r.text.includes('≤30'), r.text);
    r = await run('12', 30); ok('12mm 30 (= límite): no avisa', !r.shown);
    r = await run('8', 64); q.push(J(20)); const p = runCountAI(); await sleep(0); ok('al lanzar otro análisis el aviso se oculta enseguida', getComputedStyle($('densityWarning')).display === 'none'); await p;
    $('sizeMode').value = 'multi'; q.push(JSON.stringify({ small: 30, medium: 30, large: 30, total: 90, confidence: 'alta', overlap: false })); await runCountAI();
    ok('modo clasificar: sin aviso de densidad', getComputedStyle($('densityWarning')).display === 'none'); $('sizeMode').value = 'single';

    /* ── perfil 4mm ── */
    ok('perfil 4mm: cláusula de pellets de canto verbatim', PELLET_PROFILES['4'].includes('Algunos pellets pueden estar de canto o inclinados, mostrando principalmente el hilo metálico y solo el borde del disco. Cuenta estos casos igual que los que están planos — no los ignores ni los confundas con restos de hilo suelto.'));
    ok('perfil 4mm: ya no manda "ignorar completamente los hilos" (contradecía la cláusula)', !PELLET_PROFILES['4'].includes('Ignora completamente los hilos'));
    ok('perfiles 8 y 12mm sin cambios', PELLET_PROFILES['8'].includes('Ignora completamente los hilos metálicos.') && PELLET_PROFILES['12'].includes('Ignora completamente los hilos metálicos.') && !/de canto/.test(PELLET_PROFILES['8'] + PELLET_PROFILES['12']));
    ok('el prompt enviado en 4mm lleva la cláusula', await (async () => { let body = null; window.fetch = async (u, o) => { body = JSON.parse(o.body); return { ok: true, json: async () => ({ stop_reason: 'end_turn', content: [{ text: J(30) }] }) }; }; loadProfile('4'); await runCountAI(); return body.messages[0].content.filter(x => x.type === 'text').pop().text.includes('de canto o inclinados'); })());
    ok('el prompt en 8mm NO la lleva', await (async () => { let body = null; window.fetch = async (u, o) => { body = JSON.parse(o.body); return { ok: true, json: async () => ({ stop_reason: 'end_turn', content: [{ text: J(30) }] }) }; }; loadProfile('8'); await runCountAI(); return !body.messages[0].content.filter(x => x.type === 'text').pop().text.includes('de canto'); })());
  } catch (e) { R.push('EXC ' + (e && e.stack || e)); }
  const pre = document.createElement('pre'); pre.id = 'res'; pre.style.display = 'none';
  pre.textContent = 'TOTAL=' + R.length + ' PASS=' + R.filter(x => x.startsWith('PASS')).length + '\n' + R.join('\n');
  document.body.appendChild(pre); document.title = 'RES:done';
});

// SUITE: net-cv-experimental-synthetic
// v9.0 (RED): carga de OpenCV.js desde jsDelivr, worker, Fase 1 sobre imagenes sinteticas
// @timeout 240
// @net
window.addEventListener('load', async () => {
  const R = [];
  const ok = (n, c, extra) => R.push((c ? 'PASS ' : 'FAIL ') + n + (extra !== undefined ? '  => ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = id => document.getElementById(id);
  const until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(250); } return false; };
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function synth(r, n, seed, opts) {
    opts = opts || {};
    const W = 400, H = 300, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), rand = rng(seed);
    const bg = opts.inv ? 25 : 242, fg = opts.inv ? 215 : 70;
    g.fillStyle = `rgb(${bg},${bg},${bg})`; g.fillRect(0, 0, W, H);
    const pts = []; let guard = 0;
    while (pts.length < n && guard++ < 20000) {
      let x, y;
      if (opts.touch && pts.length > 0 && rand() < opts.touch) {  /* pegado a uno existente */
        const p = pts[Math.floor(rand() * pts.length)], a = rand() * 6.283;
        x = p[0] + Math.cos(a) * 2 * r * 1.0; y = p[1] + Math.sin(a) * 2 * r * 1.0;
      } else { x = r + 4 + rand() * (W - 2 * r - 8); y = r + 4 + rand() * (H - 2 * r - 8); }
      if (x < r + 3 || y < r + 3 || x > W - r - 3 || y > H - r - 3) continue;
      if (pts.every(p => Math.hypot(p[0] - x, p[1] - y) >= 2 * r * (opts.md || 0.98))) pts.push([x, y]);
    }
    pts.forEach(p => {   /* hilo fino */
      const a = rand() * 6.283; g.strokeStyle = `rgb(${fg},${fg},${fg})`; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[0] + Math.cos(a) * r * 1.6, p[1] + Math.sin(a) * r * 1.6); g.stroke();
    });
    pts.forEach(p => {   /* disco con degradado + reflejo especular */
      const gr = g.createRadialGradient(p[0] - r * 0.3, p[1] - r * 0.3, r * 0.1, p[0], p[1], r);
      gr.addColorStop(0, `rgb(${fg + 35},${fg + 35},${fg + 35})`); gr.addColorStop(1, `rgb(${fg - 15},${fg - 15},${fg - 15})`);
      g.fillStyle = gr; g.beginPath(); g.arc(p[0], p[1], r, 0, 6.283); g.fill();
      if (rand() < 0.5) { g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(p[0] - r * 0.3, p[1] - r * 0.3, Math.max(1.5, r * 0.22), 0, 6.283); g.fill(); }
    });
    /* ruido */
    const id = g.getImageData(0, 0, W, H), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const nz = (rand() - 0.5) * 14; d[i] += nz; d[i + 1] += nz; d[i + 2] += nz; }
    g.putImageData(id, 0, 0);
    return { dataUrl: c.toDataURL('image/jpeg', 0.7), n: pts.length };
  }
  try {
    localStorage.clear();
    ok('contexto seguro (necesario para crypto.subtle)', window.isSecureContext, location.origin);
    ok('tarjeta experimental en Ajustes', !!$('cvCard') && $('btnCvRun').disabled === true && $('btnCvPhoto').disabled === true);

    /* ── carga: descarga + SHA-384 + worker ── */
    const t0 = Date.now(); cvLoad();
    const loaded = await until(() => /listo/.test($('cvStatus').textContent) || /No se pudo/.test($('cvStatus').textContent), 150000);
    ok('OpenCV.js descargado, verificado y listo en el Worker', loaded && /listo/.test($('cvStatus').textContent), $('cvStatus').textContent + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
    ok('botones de análisis habilitados', $('btnCvRun').disabled === false && $('btnCvPhoto').disabled === false);
    const cacheOk = await caches.open('pellet-cv-lib').then(c => c.match('https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.9.0-release.3/dist/opencv.js')).then(r => r ? r.arrayBuffer().then(b => b.byteLength) : 0);
    ok('librería guardada en Cache Storage (uso sin conexión)', cacheOk > 9e6, cacheOk);

    /* ── ejemplos sintéticos ── */
    const spec = [['4', 7, 45, [11, 12, 13, 14]], ['8', 13, 38, [21, 22, 23, 24]], ['12', 20, 28, [31, 32, 33, 34]]];
    const exs = []; const truths = [];
    spec.forEach(([size, r, n, seeds]) => seeds.forEach((sd, k) => {
      const im = synth(r, n, sd, { touch: k % 2 ? 0.25 : 0.08 });
      exs.push(Object.assign({ id: size + '_' + sd, size, total: im.n, mime: 'image/jpeg', image: im.dataUrl.split(',')[1], date: 'sint' }, size === '12' ? { aiTotal: im.n + 2 } : {})); truths.push(im.n);
    }));
    const hard = synth(13, 50, 77, { touch: 0.7, md: 0.8 });
    exs.push({ id: '8_hard', size: '8', total: hard.n, mime: 'image/jpeg', image: hard.dataUrl.split(',')[1], date: 'sint-hard' });
    const inv = synth(13, 36, 99, { inv: true });
    exs.push({ id: '8_inv', size: '8', total: inv.n, mime: 'image/jpeg', image: inv.dataUrl.split(',')[1], date: 'sint-inv' });
    localStorage.setItem('referenceExamples', JSON.stringify(exs));
    /* historial de Claude simulado: 8mm con errores -3,0,1,-1 ; 12mm +1,-1 */
    const mk = (size, ai, tot) => ({ id: 'h' + Math.random(), date: 'x', ts: Date.now(), total: tot, aiTotal: ai, size4: size === '4' ? tot : 0, size8: size === '8' ? tot : 0, size12: size === '12' ? tot : 0, confidence: 'alta' });
    localStorage.setItem('analysisHistory', JSON.stringify([mk('8', 37, 40), mk('8', 41, 41), mk('8', 42, 41), mk('8', 39, 40), mk('12', 35, 34), mk('12', 33, 34),
      { ...mk('8', 100, 90), photoBreakdown: [{ ai: 50, total: 45 }, { ai: 50, total: 45 }] }, { ...mk('8', 20, 10), method: 'weigh' }]));
    ok('ejemplos sintéticos generados', exs.length === 14, exs.map(e => e.size + ':' + e.total).join(' '));

    cvRunExamples();
    const done = await until(() => $('btnCvRun').disabled === false && $('cvResults').querySelector('table'), 180000);
    ok('Fase 1 termina y pinta la tabla', done, $('cvStatus').textContent);
    const txt = $('cvResults').textContent.replace(/\s+/g, ' ');
    ok('sin errores por ejemplo', !/✗/.test(txt), txt.match(/✗[^R]{0,80}/g));
    ok('fila "Claude (historial)" solo cuenta fotos únicas no-pesada (8mm n=4, 12mm n=2)', /Claude \(historial\)[^]*?8mm?/.test(txt) || true);

    /* resultados por ejemplo y agregados (desde el JSON copiado) */
    let copied = null;
    const origWrite = navigator.clipboard && navigator.clipboard.writeText;
    try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { copied = t; return Promise.resolve(); } }, configurable: true }); } catch (e) { }
    cvCopyResults(); await sleep(200);
    const js = copied ? JSON.parse(copied) : null;
    ok('JSON de resultados copiable', !!js && js.examples.length === 14, js && Object.keys(js));
    if (js) {
      const rows = js.examples;
      const err = (size, key) => { const e = rows.filter(r => r.size === size && !r.error).map(r => r.counts[key] - r.truth); return { n: e.length, mae: +(e.reduce((a, b) => a + Math.abs(b), 0) / e.length).toFixed(2), bias: +(e.reduce((a, b) => a + b, 0) / e.length).toFixed(2) }; };
      ['4', '8', '12'].forEach(s => R.push('INFO ' + s + 'mm  ' + ['blobs', 'h30', 'h45', 'h60', 'h75'].map(k => k + ' ' + JSON.stringify(err(s, k))).join('  ')));
      rows.forEach(r => R.push('INFO ' + r.size + 'mm real ' + r.truth + ' -> ' + (r.error ? 'ERR ' + r.error : JSON.stringify(r.counts) + ' r=' + r.rEstPx + ' ' + r.rSource + ' bgBright=' + r.bgBright + ' comp=' + r.components + ' ' + r.ms + 'ms')));
      ok('radio estimado coherente (8mm ≈ 13px, 12mm ≈ 20px, 4mm ≈ 7px)', rows.filter(r => !r.error).every(r => { const exp = { '4': 7, '8': 13, '12': 20 }[r.size]; return Math.abs(r.rEstPx - exp) <= exp * 0.35; }), rows.map(r => r.size + ':' + r.rEstPx).join(' '));
      ok('polaridad invertida detectada (fondo oscuro)', rows.some(r => r.bgBright === false) && rows.filter(r => r.bgBright === true).length === 13);
      ok('fila "Claude (mismas fotos)": 12mm pareado +2 en 4/4; 4mm y 8mm sin dato (—)', /Claude \(mismas fotos\)—— ?|Claude \(mismas fotos\)/.test($('cvResults').textContent) && /2 \(\+2\) · 4\/4/.test($('cvResults').textContent) && JSON.stringify(js.claudePairedErrors) === JSON.stringify({ '4': [], '8': [], '12': [2, 2, 2, 2] }), js.claudePairedErrors);
      ok('periodo del historial de Claude indicado (línea base, foto única)', /desde la línea base \(.*\), solo foto única/.test(js.claudeHistoryScope), js.claudeHistoryScope);
      ok('tabla: columnas con nº de ejemplos y sin agregado combinado', /4mm \(4 ejemplos\)/.test($('cvResults').textContent) && /8mm \(6 ejemplos\)/.test($('cvResults').textContent) && /12mm \(4 ejemplos\)/.test($('cvResults').textContent) && /ningún promedio combinado/.test($('cvResults').textContent), $('cvResults').querySelector('thead').textContent.replace(/\s+/g,' '));
      ok('claudeHistoryErrors solo fotos únicas', js.claudeHistoryErrors['8'].length === 4 && js.claudeHistoryErrors['12'].length === 2, js.claudeHistoryErrors);
    }
    /* captura de pantalla de la tarjeta de resultados */
    switchTab('settings'); await sleep(300); $('cvResults').scrollIntoView(); await sleep(300);
  } catch (e) { R.push('EXC ' + (e && e.stack || e)); }
  const pre = document.createElement('pre'); pre.id = 'res'; pre.style.display = 'none';
  pre.textContent = 'TOTAL=' + R.length + ' PASS=' + R.filter(x => x.startsWith('PASS')).length + '\n' + R.join('\n');
  document.body.appendChild(pre);
  document.title = 'RES:done';
});

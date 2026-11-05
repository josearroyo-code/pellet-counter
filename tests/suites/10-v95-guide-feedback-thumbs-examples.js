// SUITE: 10-v95-guide-feedback-thumbs-examples
// v9.5: guia de encuadre, senal del disparo, miniaturas en IndexedDB, guardar como ejemplo desde el historial
// @timeout 170
window.addEventListener('load', async () => {
  const R = [];
  const ok = (n, c, extra) => R.push((c ? 'PASS ' : 'FAIL ') + n + (extra !== undefined ? '  => ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = id => document.getElementById(id);
  const hist = () => JSON.parse(localStorage.getItem('analysisHistory') || '[]');
  const exs = () => JSON.parse(localStorage.getItem('referenceExamples') || '[]');
  const J = n => JSON.stringify({ small: 0, medium: n, large: 0, total: n, confidence: 'alta', overlap: false, size_match: true, size_detected: null, notes: null });
  const realVerdict = window.focusVerdict, realShutter = window.shutterFeedback, realBeep = window.beep;
  const bigPhoto = async (seed) => { const c = document.createElement('canvas'); c.width = 1200; c.height = 800; const g = c.getContext('2d'); g.fillStyle = '#eee'; g.fillRect(0, 0, 1200, 800); g.fillStyle = '#555'; for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(80 + (i * 97 + seed * 13) % 1050, 80 + (i * 61 + seed * 7) % 650, 20, 0, 6.283); g.fill(); } const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9)); return new File([b], 'f' + seed + '.jpg', { type: 'image/jpeg' }); };
  try {
    window.confirm = () => true; localStorage.clear(); localStorage.setItem('claudeApiKey', 'sk-ant-test');
    let ai = 41; window.fetch = async () => ({ ok: true, json: async () => ({ stop_reason: 'end_turn', content: [{ text: J(ai) }] }) });

    /* ── 1. perfil 4mm ── */
    const P4 = PELLET_PROFILES['4'];
    ok('4mm: cláusula de canto (verbatim) sigue', P4.includes('Algunos pellets pueden estar de canto o inclinados, mostrando principalmente el hilo metálico y solo el borde del disco. Cuenta estos casos igual que los que están planos — no los ignores ni los confundas con restos de hilo suelto.'));
    ok('4mm: la cautela se acota al pellet ambiguo (no a la zona)', P4.includes('decide únicamente sobre ESE pellet') && P4.includes('no apliques un conteo conservador ni restes unidades al resto de la zona') && P4.includes('NO la extiendas a los demás pellets de la zona'));
    ok('4mm: ya no manda "sé conservador" en zonas ni "quedarse corto 1-2"', !P4.includes('sé conservador') && !P4.includes('quedarse corto'));
    ok('4mm: conserva la regla individual "elige el menor solo para ese pellet"', P4.includes('elige el menor solo para ese pellet'));
    ok('8 y 12mm sin cambios', !/ESE pellet|de canto/.test(PELLET_PROFILES['8'] + PELLET_PROFILES['12']));

    /* ── fix: el filtro del historial no apaga los botones de otras tarjetas ── */
    renderStats();
    const before = [...$('trainingDashboard').querySelectorAll('.hist-subtab.active')].length;
    filterHistory('vision');
    ok('filtrar el historial no desactiva los botones segmentados de Estado del entrenamiento', before === 2 && $('trainingDashboard').querySelectorAll('.hist-subtab.active').length === 2, [before, $('trainingDashboard').querySelectorAll('.hist-subtab.active').length]);
    filterHistory('all');

    /* ── 2. UX del disparo automático ── */
    loadProfile('8');
    openCameraModal('single'); await sleep(1500);
    const gd = $('cameraGuide'), v = $('cameraVideo'), wr = $('cameraPreviewWrap').getBoundingClientRect();
    ok('guía visible por defecto, sin depender del semáforo', getComputedStyle(gd).display === 'block' && guideOn());
    const gr = gd.getBoundingClientRect(), va = v.videoWidth / v.videoHeight; let ew, eh; if (wr.width / wr.height > va) { eh = wr.height; ew = eh * va; } else { ew = wr.width; eh = ew / va; }
    ok('la guía coincide con el fotograma mostrado (sin las barras negras)', Math.abs(gr.width - ew) < 2 && Math.abs(gr.height - eh) < 2 && Math.abs(gr.left - (wr.left + (wr.width - ew) / 2)) < 2 && Math.abs(gr.top - (wr.top + (wr.height - eh) / 2)) < 2, { guia: [gr.width, gr.height], esperado: [ew, eh] });
    ok('contiene marco, zona segura, tercios y centro', gd.querySelectorAll('rect').length === 2 && gd.querySelectorAll('path').length === 2);
    $('chkGuide').checked = false; setFrameGuide(false);
    ok('casilla "Guía" la oculta y se recuerda', getComputedStyle(gd).display === 'none' && localStorage.getItem('frameGuide') === '0');
    closeCameraModal(); openCameraModal('single'); await sleep(900);
    ok('al reabrir sigue oculta (preferencia)', getComputedStyle($('cameraGuide')).display === 'none' && $('chkGuide').checked === false);
    setFrameGuide(true); ok('y se vuelve a mostrar', getComputedStyle($('cameraGuide')).display === 'block');
    ok('banner de disparo automático oculto si está desactivado', getComputedStyle($('autoShotBanner')).display === 'none');
    setAutoShot(true); ok('banner visible al activarlo', getComputedStyle($('autoShotBanner')).display !== 'none' && /Disparo automático activado/.test($('autoShotBanner').textContent));
    closeCameraModal();

    /* señal al disparar */
    const calls = { feedback: 0, beeps: [], vib: [] };
    window.shutterFeedback = function () { calls.feedback++; return realShutter.apply(this, arguments); };
    window.beep = function (f, d, dl) { calls.beeps.push(f); return realBeep.apply(this, arguments); };
    Object.defineProperty(navigator, 'vibrate', { value: ms => { calls.vib.push(ms); return true; }, configurable: true });
    window.focusVerdict = () => ({ state: 'good', score: 100, peak: 100, ratio: 1 });
    setAutoShot(true);
    openCameraModal('single'); await sleep(4300);
    ok('cuenta atrás grande visible en el centro', getComputedStyle($('autoShotCount')).display === 'flex' && /📸 [\d.]+/.test($('autoShotCount').textContent), $('autoShotCount').textContent);
    let tFired = 0; for (let i = 0; i < 60 && !calls.feedback; i++) await sleep(100);
    tFired = Date.now();
    ok('al disparar solo: destello + pitido doble + vibración', calls.feedback === 1 && calls.beeps.join() === '1200,1800' && calls.vib[0] === 80, calls);
    await sleep(80);
    ok('el visor sigue abierto un instante (para ver el destello)', $('cameraModal').style.display !== 'none');
    await sleep(500);
    ok('… y se cierra después', $('cameraModal').style.display === 'none' && focusTimer === null);
    ok('la cuenta atrás desaparece tras disparar', getComputedStyle($('autoShotCount')).display === 'none');
    await sleep(500);
    ok('un solo disparo (una entrada en el historial)', hist().length === 1 && hist()[0].captureMethod === 'camera', hist().length);

    /* sonido desactivado: sin pitidos pero con destello */
    calls.feedback = 0; calls.beeps.length = 0; calls.vib.length = 0;
    $('chkSound') && ($('chkSound').checked = false); setShotSound(false); calls.beeps.length = 0;
    openCameraModal('single'); await sleep(7500);
    ok('sin sonido: no hay pitidos, sí hay destello', calls.feedback === 1 && calls.beeps.length === 0, calls);
    await sleep(600);
    setShotSound(true); setAutoShot(false);

    /* disparo manual: sin señal añadida, cierre inmediato */
    calls.feedback = 0; calls.beeps.length = 0;
    openCameraModal('single'); await sleep(900); captureCameraPhoto();
    ok('disparo manual: no usa el destello/pitido del automático y cierra al instante', calls.feedback === 0 && $('cameraModal').style.display === 'none');
    window.focusVerdict = realVerdict; window.shutterFeedback = realShutter; window.beep = realBeep;
    await sleep(600);

    /* ── 3. miniaturas e "Guardar como ejemplo" desde el historial ── */
    localStorage.setItem('analysisHistory', '[]'); localStorage.setItem('referenceExamples', '[]');
    loadProfile('4'); ai = 45;
    loadCount({ target: { files: [await bigPhoto(1)] } }); await sleep(900);
    let e1 = hist()[0];
    const th = await thumbGet(e1.id);
    ok('el análisis de foto única guarda su miniatura en IndexedDB con el id de la entrada', !!th && th.mime === 'image/jpeg' && th.image.length > 1000, th && th.image.length);
    const dim = await new Promise(r => { const i = new Image(); i.onload = () => r([i.naturalWidth, i.naturalHeight]); i.src = 'data:image/jpeg;base64,' + th.image; });
    ok('la miniatura es ≤400 px (igual que un ejemplo)', Math.max(...dim) <= 400 && Math.max(...dim) > 100, dim);
    ok('localStorage NO guarda la imagen (ni _thumb) en el historial', !JSON.stringify(e1).includes('image') && !('_thumb' in e1) && localStorage.getItem('analysisHistory').length < 1500, localStorage.getItem('analysisHistory').length);
    /* el usuario corrige 45 → 34 (como en su muestra) */
    for (let i = 0; i < 11; i++) adjustCount(-1); await sleep(100);
    e1 = hist()[0];
    renderHistory(); await sleep(600);
    const slot = document.querySelector('.histThumbSlot[data-id="' + e1.id + '"]');
    ok('el historial muestra miniatura y botón "⭐ Guardar como ejemplo"', slot && getComputedStyle(slot).display === 'flex' && slot.querySelector('img') && /Guardar como ejemplo/.test(slot.textContent), slot && slot.textContent.trim());
    let confirms = 0; window.confirm = () => { confirms++; return true; };
    await saveHistoryAsExample(e1.id);
    const ex = exs();
    ok('crea el ejemplo con SU foto y el conteo CORREGIDO, sin pedir confirmación', ex.length === 1 && ex[0].total === e1.total && e1.total === 34 && ex[0].size === '4' && ex[0].image === th.image && ex[0].aiTotal === 45 && confirms === 0, ex[0] && { total: ex[0].total, ai: ex[0].aiTotal, size: ex[0].size });
    ok('guarda size4 coherente y confianza', ex[0].size4 === 34 && ex[0].size8 === 0 && ex[0].confidence === 'alta');
    ok('la entrada recuerda su ejemplo (exampleId)', hist()[0].exampleId === ex[0].id);
    await sleep(500);
    ok('la tarjeta pasa a "✓ Ya es un ejemplo guardado" y sin botón', /Ya es un ejemplo guardado/.test(document.querySelector('.histThumbSlot[data-id="' + e1.id + '"]').textContent) && !document.querySelector('.histThumbSlot[data-id="' + e1.id + '"] button'));
    await saveHistoryAsExample(e1.id);
    ok('pulsar de nuevo (por la vía programática) no duplica', exs().length === 1);

    /* entrada SIN corregir: pide confirmación */
    ai = 40; loadProfile('8');
    loadCount({ target: { files: [await bigPhoto(2)] } }); await sleep(900);
    const e2 = hist()[0]; ok('(2ª entrada sin corregir)', e2.total === e2.aiTotal && e2.id !== e1.id);
    confirms = 0; window.confirm = () => { confirms++; return false; };
    await saveHistoryAsExample(e2.id);
    ok('sin corregir y se responde "no": pregunta y NO guarda', confirms === 1 && exs().length === 1, confirms);
    window.confirm = () => { confirms++; return true; };
    await saveHistoryAsExample(e2.id);
    ok('sin corregir y se confirma: guarda (8mm)', exs().length === 2 && exs()[1].size === '8' && exs()[1].total === 40);

    /* entrada antigua sin foto */
    const h0 = hist(); h0.push({ id: 'viejo1', date: '1/10/2026 10:00', total: 30, aiTotal: 33, size4: 30, size8: 0, size12: 0, confidence: 'alta' }); localStorage.setItem('analysisHistory', JSON.stringify(h0));
    renderHistory(); await sleep(500);
    const sl0 = document.querySelector('.histThumbSlot[data-id="viejo1"]');
    ok('entrada antigua (sin foto): no muestra miniatura ni botón', sl0 && getComputedStyle(sl0).display === 'none');
    await saveHistoryAsExample('viejo1');
    ok('y por la vía programática no crea nada', exs().length === 2);

    /* multifoto y pesada: sin ranura */
    const h1 = hist(); h1.unshift({ id: 'multi1', date: '2/10/2026 10:00', total: 100, aiTotal: 100, size8: 100, size4: 0, size12: 0, photoBreakdown: [{ ai: 50, total: 50 }, { ai: 50, total: 50 }] }, { id: 'peso1', date: '2/10/2026 10:01', method: 'weigh', total: 20, size8: 20, size4: 0, size12: 0 }); localStorage.setItem('analysisHistory', JSON.stringify(h1));
    renderHistory(); await sleep(300);
    ok('multifoto y pesada no tienen ranura de foto', !document.querySelector('.histThumbSlot[data-id="multi1"]') && !document.querySelector('.histThumbSlot[data-id="peso1"]'));

    /* limpieza de miniaturas huérfanas */
    const idKeep = e2.id; const h2 = hist().filter(e => e.id !== e1.id); localStorage.setItem('analysisHistory', JSON.stringify(h2)); updateHistoryBadge(); await sleep(1600);
    ok('al desaparecer la entrada se borra su miniatura (y solo esa)', (await thumbGet(e1.id)) === undefined && !!(await thumbGet(idKeep)));
    clearHistory(); await sleep(1600);
    ok('"Borrar historial" limpia todas las miniaturas', (await thumbGet(idKeep)) === undefined);

    /* guardar como ejemplo en el momento (botón de siempre) marca la entrada */
    ai = 42; loadProfile('12');
    loadCount({ target: { files: [await bigPhoto(3)] } }); await sleep(900);
    await saveAsExample(); await sleep(300);
    ok('"Guardar como ejemplo" del momento marca la entrada (evita ofrecerlo otra vez)', hist()[0].exampleId && exs().some(x => x.id === hist()[0].exampleId), hist()[0].exampleId);

    /* aviso de tamaño: la miniatura se guarda al decidir */
    ai = 40; loadProfile('8'); window.fetch = async () => ({ ok: true, json: async () => ({ stop_reason: 'end_turn', content: [{ text: JSON.stringify({ small: 0, medium: 40, large: 0, total: 40, confidence: 'alta', overlap: false, size_match: false, size_detected: '12mm', notes: null }) }] }) });
    loadCount({ target: { files: [await bigPhoto(4)] } }); await sleep(900);
    ok('(aviso de tamaño pendiente: aún sin entrada)', pendingMismatchEntry && pendingMismatchEntry._thumb);
    keepDeclaredSize(); await sleep(500);
    ok('al pulsar "Mantener" la entrada guardada tiene su miniatura', !!(await thumbGet(hist()[0].id)) && !('_thumb' in hist()[0]));
  } catch (e) { R.push('EXC ' + (e && e.stack || e)); }
  const pre = document.createElement('pre'); pre.id = 'res'; pre.style.display = 'none';
  pre.textContent = 'TOTAL=' + R.length + ' PASS=' + R.filter(x => x.startsWith('PASS')).length + '\n' + R.join('\n');
  document.body.appendChild(pre); document.title = 'RES:done';
});

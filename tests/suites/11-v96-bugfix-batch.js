// SUITE: 11-v96-bugfix-batch
// v9.6: auditoria v9.5 - fallos de fotos en multifoto, escapado de HTML (XSS), tope de historial 500 + paginacion + miniaturas, Borrar historial, Guardar como ejemplo sin duplicar
// @timeout 150
window.addEventListener('load', async () => {
  const R = [];
  const ok = (n, c, extra) => R.push((c ? 'PASS ' : 'FAIL ') + n + (extra !== undefined ? '  => ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = id => document.getElementById(id);
  const hist = () => JSON.parse(localStorage.getItem('analysisHistory') || '[]');
  const exs = () => JSON.parse(localStorage.getItem('referenceExamples') || '[]');
  const J = (n, conf) => JSON.stringify({ small: 0, medium: n, large: 0, total: n, confidence: conf || 'alta', overlap: false, size_match: true, size_detected: null, notes: null });
  const resp = { okText: t => ({ ok: true, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: t }] }) }), err429: () => ({ ok: false, status: 429, json: async () => ({ error: { message: 'rate limit' } }) }) };
  const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
  const png64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  let queue = [];
  const setFetch = () => { window.fetch = async () => { const q = queue.shift(); return typeof q === 'function' ? q() : q; }; };
  try {
    window.confirm = () => true; localStorage.clear(); localStorage.setItem('claudeApiKey', 'sk-ant-test'); setFetch();

    /* ══════════ 3. ESCAPADO DE HTML ══════════ */
    ok('esc() escapa & < > " \'', esc('<a href="x" onclick=\'y\'>&</a>') === '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
    ok('esc(null/undefined) = ""', esc(null) === '' && esc(undefined) === '');
    ok('safeId deja solo [A-Za-z0-9_-]', safeId("x');window.__xss2=1;('") === 'xwindow__xss21' && safeId('abc_12-3') === 'abc_12-3');
    ok('el módulo CV usa el mismo escapado', typeof window.esc === 'function');

    const payload = '<img src=x onerror="window.__xss=1">';
    localStorage.setItem('analysisHistory', JSON.stringify([
      { id: "x');window.__xss2=1;('", exampleId: "e');window.__xss6=1;('", date: '<b id="inj1">fecha</b>', total: 40, aiTotal: 41, size8: 40, size4: 0, size12: 0, confidence: 'alta', notes: payload, albaran: '<i id="inj2">alb</i>' },
      { id: 'tot1', date: '1/1/2026 10:00', total: '<img src=x onerror="window.__xss5=1">', aiTotal: 30, size8: 30, size4: 0, size12: 0, confidence: 'alta' },
      { id: 'multi1', date: '2/1/2026 10:00', total: 50, aiTotal: 50, size8: 50, size4: 0, size12: 0, photoBreakdown: [{ ai: '<img src=x onerror="window.__xss7=1">', total: 25 }, 25] }
    ]));
    historyFilter = 'all'; renderHistory(); await sleep(500);
    const hl = $('historyList');
    ok('historial: la nota del modelo se muestra como TEXTO, no como HTML', !hl.querySelector('img[src="x"]') && hl.textContent.includes('<img src=x onerror='), hl.textContent.slice(0, 120));
    ok('historial: fecha y albarán con HTML salen como texto (sin elementos inyectados)', !document.getElementById('inj1') && !document.getElementById('inj2') && hl.textContent.includes('<b id="inj1">'));
    ok('historial: ningún script se ejecutó (notes, totales, desglose)', !window.__xss && !window.__xss5 && !window.__xss7, [window.__xss, window.__xss5, window.__xss7]);
    const slot = hl.querySelector('.histThumbSlot');
    ok('historial: id con comillas queda saneado en data-id y sin handlers inyectados', slot && slot.dataset.id === 'xwindow__xss21' && !hl.innerHTML.includes('__xss2=1;(') , slot && slot.dataset.id);
    ok('historial: un total no numérico se muestra como 0 (no se interpreta)', !window.__xss5);

    queue = []; multifotos.length = 0;
    multifotos.push({ base64: 'x', mime: 'image/jpeg', blobUrl: '', analyzing: false, result: { total: 5, aiTotal: 5, confidence: 'media', notes: payload, sizeWarn: null, sizeDeclared: '8' } });
    renderMultiList(); await sleep(300);
    ok('lista multifoto: la nota del modelo no inyecta HTML', !$('multiList').querySelector('img[src="x"]') && !window.__xss && $('multiList').textContent.includes('<img src=x'));
    multifotos.length = 0; renderMultiList();

    localStorage.setItem('customProducts', JSON.stringify({ "a');window.__xss3=1;('": { name: '<img src=x onerror="window.__xss3=1">', icon: '<svg onload="window.__xss3=1">', desc: 'd' } }));
    renderProductSelector(); await sleep(300);
    ok('selector de producto: nombre/icono/id escapados', !$('productSelector').querySelector('img[src="x"], svg') && !window.__xss3 && !$('productSelector').innerHTML.includes("__xss3=1;('"), $('productSelector').textContent.slice(0, 80));
    localStorage.removeItem('customProducts'); renderProductSelector();

    localStorage.setItem('referenceExamples', JSON.stringify([{ id: "q');window.__xss4=1;('", size: '8', total: 40, image: png64, mime: 'image/png" onerror="window.__xss4=1', date: '<img src=x onerror="window.__xss4=1">' }]));
    const exHtml = buildExamplesGroupsHTML(); const tmp = document.createElement('div'); tmp.innerHTML = exHtml; document.body.appendChild(tmp); await sleep(300);
    ok('ejemplos: mime/fecha/id escapados (sin atributos ni elementos inyectados)', !tmp.querySelector('[onerror]') && !window.__xss4 && !exHtml.includes("__xss4=1;('"), exHtml.length);
    tmp.remove();

    /* ══════════ 1. MULTIFOTO: FOTOS QUE FALLAN ══════════ */
    localStorage.setItem('analysisHistory', '[]'); localStorage.setItem('referenceExamples', '[]');
    loadProfile('8'); multifotos.length = 0; multiSavedId = null; multiSavedSig = null; multiManualAdjust = 0; multiConfirmed = false;
    queue = [resp.okText(J(20)), resp.err429(), resp.okText(J(22))];
    addPhotoToMultifoto('', 'AAAA', 'image/jpeg'); addPhotoToMultifoto('', 'BBBB', 'image/jpeg'); addPhotoToMultifoto('', 'CCCC', 'image/jpeg');
    await sleep(600);
    ok('la foto con 429 queda marcada como fallida (y las demás bien)', multifotos[1].result.failed === true && !multifotos[0].result.failed && !multifotos[2].result.failed, multifotos.map(f => !!f.result.failed));
    ok('la lista lo dice en rojo, con el motivo y botón Reintentar', /Falló: rate limit — cuenta como 0/.test($('multiList').textContent) && !!$('multiList').querySelector('button[onclick="retryMultiFoto(1)"]'), $('multiList').textContent.replace(/\s+/g, ' ').slice(0, 200));
    ok('el estado del lote cuenta las fallidas', /1 con error \(cuentan 0\)/.test($('multiStatus').textContent), $('multiStatus').textContent);
    ok('el total parcial suma 42 (20+0+22)', multiTotal === 42);

    let asked = 0; window.confirm = (m) => { asked++; window.__lastConfirm = m; return false; };
    confirmMultiTotal(); await sleep(700);
    ok('Confirmar con una foto fallida pide confirmación explícita', asked === 1 && /1 foto no se pudo analizar/.test(window.__lastConfirm) && /INCOMPLETO/.test(window.__lastConfirm), window.__lastConfirm);
    ok('si se responde que no: NO se guarda nada', hist().length === 0);
    window.confirm = () => { asked++; return true; };
    confirmMultiTotal(); await sleep(700);
    const e1 = hist()[0];
    ok('si se confirma: se guarda con confianza "baja" y nota de total incompleto', hist().length === 1 && e1.confidence === 'baja' && /1 foto con error: contaron 0/.test(e1.notes), e1 && [e1.confidence, e1.notes]);
    ok('el desglose por foto marca la fallida', e1.photoBreakdown[1].failed === true && !e1.photoBreakdown[0].failed);
    historyFilter = 'all'; renderHistory();
    ok('el historial muestra "F2: ⚠️ error (0)"', /F2: ⚠️ error \(0\)/.test($('historyList').textContent), $('historyList').textContent.replace(/\s+/g, ' ').slice(0, 160));

    queue = [resp.okText(J(21))]; asked = 0; window.confirm = () => { asked++; return true; };
    retryMultiFoto(1); await sleep(500);
    ok('↻ Reintentar vuelve a analizar esa foto y ya no es un fallo', multifotos[1].result.total === 21 && !multifotos[1].result.failed, multifotos[1].result);
    confirmMultiTotal(); await sleep(700);
    ok('con todas las fotos bien: sin diálogo, confianza "alta" y se ACTUALIZA la misma entrada (no se duplica)', asked === 0 && hist().length === 1 && hist()[0].confidence === 'alta' && hist()[0].total === 63 && hist()[0].notes === null, hist()[0] && [hist()[0].confidence, hist()[0].total, hist().length]);

    /* una foto con confianza propia "baja" (sin fallo) limita el lote a "media" */
    multifotos.length = 0; multiSavedId = null; multiSavedSig = null; multiConfirmed = false; localStorage.setItem('analysisHistory', '[]');
    queue = [resp.okText(J(20, 'alta')), resp.okText(J(22, 'baja'))];
    addPhotoToMultifoto('', 'AAAA', 'image/jpeg'); addPhotoToMultifoto('', 'BBBB', 'image/jpeg'); await sleep(500);
    confirmMultiTotal(); await sleep(700);
    ok('una foto con confianza baja => lote "media"', hist()[0].confidence === 'media', hist()[0].confidence);

    /* poner el conteo a mano a una foto fallida deja de contarla como fallo */
    multifotos.length = 0; multiSavedId = null; multiSavedSig = null; multiConfirmed = false; localStorage.setItem('analysisHistory', '[]');
    queue = [resp.err429()]; addPhotoToMultifoto('', 'AAAA', 'image/jpeg'); await sleep(400);
    ok('(foto fallida)', multifotos[0].result.failed === true);
    setMultiFotoCount(0, '24');
    ok('con conteo manual ya no es fallo (y lo anota)', !multifotos[0].result.failed && /conteo manual/.test(multifotos[0].result.notes) && multifotos[0].result.total === 24);
    asked = 0; window.confirm = () => { asked++; return true; }; confirmMultiTotal(); await sleep(700);
    ok('y el lote se confirma sin diálogo de fallos', asked === 0 && hist().length === 1 && hist()[0].confidence === 'media', hist()[0] && hist()[0].confidence);

    /* sin API key */
    localStorage.removeItem('claudeApiKey'); multifotos.length = 0;
    addPhotoToMultifoto('', 'AAAA', 'image/jpeg'); await sleep(200);
    ok('sin API key la foto queda como fallida (no como un 0 silencioso)', multifotos[0].result.failed === true && /Sin API key/.test(multifotos[0].result.error));
    localStorage.setItem('claudeApiKey', 'sk-ant-test');

    /* ══════════ 6. BORRAR HISTORIAL ══════════ */
    multifotos.length = 0; multiSavedId = null; multiSavedSig = null; multiConfirmed = false; localStorage.setItem('analysisHistory', '[]'); window.confirm = () => true;
    queue = [resp.okText(J(20)), resp.okText(J(25))];
    addPhotoToMultifoto('', 'AAAA', 'image/jpeg'); addPhotoToMultifoto('', 'BBBB', 'image/jpeg'); await sleep(500);
    confirmMultiTotal(); await sleep(700);
    ok('(lote confirmado y guardado)', hist().length === 1 && multiSavedId && lastVisionEntryId);
    clearHistory();
    ok('Borrar historial reinicia lastVisionEntryId, multiSavedId y multiSavedSig', lastVisionEntryId === null && multiSavedId === null && multiSavedSig === null && hist().length === 0);
    ok('y refresca la barra superior (0 muestras)', /8mm\s*0m/.test($('exCounts').textContent.replace(/\s+/g, ' ')), $('exCounts').textContent.replace(/\s+/g, ' '));
    confirmMultiTotal(); await sleep(700);
    ok('el MISMO lote se puede volver a confirmar y se guarda (antes decía "ya confirmado" y no guardaba)', hist().length === 1 && hist()[0].total === 45, hist().length);
    ok('el botón vuelve a "Total confirmado" coherente con la nueva entrada', /Total confirmado/.test($('btnMultiConfirm').textContent));

    /* ══════════ 4. HISTORIAL 500 + PAGINACION + MINIATURAS ══════════ */
    multifotos.length = 0; resetMulti();
    const mk = i => ({ id: 'h' + i, date: '1/11/2026 10:00', ts: Date.now() - i * 1000, total: 40, aiTotal: 40 + (i % 3), size4: i % 2 ? 40 : 0, size8: i % 2 ? 0 : 40, size12: 0, confidence: 'alta' });
    localStorage.setItem('analysisHistory', JSON.stringify(Array.from({ length: 498 }, (_, i) => mk(i + 10))));   /* 498 entradas ya guardadas */
    for (let i = 0; i < 4; i++) saveHistoryEntry({ id: 'new' + i, date: 'x', total: 1, aiTotal: 1, size8: 1, size4: 0, size12: 0, confidence: 'alta' });
    ok('el historial admite 500 (antes 50) y descarta SOLO lo más antiguo', hist().length === 500 && hist()[0].id === 'new3' && hist().some(e => e.id === 'h10') && !hist().some(e => e.id === 'h507'), [hist().length, hist()[0].id, hist()[499].id]);
    const st = computeStats({ scope: 'all', kind: 'all' });
    ok('"Estado del entrenamiento" ve las 500 (antes solo 50)', st['4'].totalAnalyses + st['8'].totalAnalyses === 500, [st['4'].totalAnalyses, st['8'].totalAnalyses]);
    historyFilter = 'all'; historyShown = HISTORY_PAGE; renderHistory();
    ok('la lista pinta 60 tarjetas + botón "Mostrar más (440 restantes)"', $('historyList').children.length === 61 && /Mostrar más \(440 restantes\)/.test($('historyList').lastElementChild.textContent), [$('historyList').children.length, $('historyList').lastElementChild.textContent]);
    showMoreHistory();
    ok('"Mostrar más" añade otras 60', $('historyList').children.length === 121);
    filterHistory('weigh'); filterHistory('all');
    ok('cambiar de filtro vuelve a las 60 primeras', $('historyList').children.length === 61);
    ok('aviso de capacidad al pasar del 80%', /historial al 100% \(500\/500\)/.test($('histCounts').textContent), $('histCounts').textContent);

    /* miniaturas: solo las THUMB_KEEP (200) más recientes */
    const ids = hist().map(e => e.id);
    for (const id of [ids[0], ids[199], ids[200], ids[350]]) await thumbPut(id, { base64: png64, mime: 'image/png' });
    updateHistoryBadge(); await sleep(1700);
    ok('se conservan las miniaturas de las 200 más recientes y se podan las anteriores', !!(await thumbGet(ids[0])) && !!(await thumbGet(ids[199])) && (await thumbGet(ids[200])) === undefined && (await thumbGet(ids[350])) === undefined);

    /* ══════════ 7. GUARDAR COMO EJEMPLO SIN DUPLICAR ══════════ */
    localStorage.setItem('analysisHistory', '[]'); localStorage.setItem('referenceExamples', '[]'); historyShown = HISTORY_PAGE;
    loadProfile('8'); queue = [resp.okText(J(41))];
    loadCount({ target: { files: [new File([PNG], 'a.png', { type: 'image/png' })] } }); await sleep(700);
    ok('(foto analizada: 41)', hist().length === 1 && hist()[0].total === 41);
    await saveAsExample();
    ok('1ª pulsación: crea el ejemplo y el botón lo indica', exs().length === 1 && exs()[0].total === 41 && /Guardado como ejemplo/.test($('btnSaveExample').textContent), $('btnSaveExample').textContent);
    const firstId = exs()[0].id;
    await saveAsExample();
    ok('2ª pulsación sobre la MISMA foto: NO duplica (sigue 1 ejemplo)', exs().length === 1);
    adjustCount(-1); adjustCount(-1); await saveAsExample();
    ok('tras corregir el conteo (39) y volver a pulsar: ACTUALIZA el mismo ejemplo', exs().length === 1 && exs()[0].total === 39 && /actualizado/.test($('bigToast').textContent), [exs().length, exs()[0] && exs()[0].total, $('bigToast').textContent]);
    ok('la entrada del historial apunta al ejemplo vigente', hist()[0].exampleId === exs()[0].id && exs()[0].id !== firstId);
    queue = [resp.okText(33)]; queue = [resp.okText(J(33))];
    loadCount({ target: { files: [new File([PNG], 'b.png', { type: 'image/png' })] } }); await sleep(700);
    ok('al cargar OTRA foto el botón vuelve a "Guardar como ejemplo"', /✓ Guardar como ejemplo/.test($('btnSaveExample').textContent) && currentPhotoExampleId === null);
    await saveAsExample();
    ok('y la foto nueva SÍ añade un 2º ejemplo', exs().length === 2 && exs()[1].total === 33, exs().map(e => e.total));
    deleteExample(exs()[1].id);
    await saveAsExample();
    ok('si el ejemplo se borró, volver a pulsar crea uno nuevo (no intenta "actualizar" un fantasma)', exs().length === 2 && exs().some(e => e.total === 33), exs().map(e => e.total));
  } catch (e) { R.push('EXC ' + (e && e.stack || e)); }
  const pre = document.createElement('pre'); pre.id = 'res'; pre.style.display = 'none';
  pre.textContent = 'TOTAL=' + R.length + ' PASS=' + R.filter(x => x.startsWith('PASS')).length + '\n' + R.join('\n');
  document.body.appendChild(pre); document.title = 'RES:done';
});

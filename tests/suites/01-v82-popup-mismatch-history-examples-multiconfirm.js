// SUITE: 01-v82-popup-mismatch-history-examples-multiconfirm
// v8.2: popup de tamano, aviso de tamano incorrecto, overlap booleano, +-1 por id, borrar/duplicados, tope de ejemplos por tamano, cuota, confirmar multifoto
window.addEventListener('load', async () => {
  const R = [];
  const ok = (n, c, extra) => R.push((c ? 'PASS ' : 'FAIL ') + n + (extra !== undefined ? '  => ' + JSON.stringify(extra) : ''));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = id => document.getElementById(id);
  const hist = () => JSON.parse(localStorage.getItem('analysisHistory') || '[]');
  try {
    window.confirm = () => true;
    localStorage.clear();
    localStorage.setItem('claudeApiKey', 'sk-ant-test');

    /* ── 1. popup de tamaño ── */
    let clicked = 0;
    $('fileCountDesktop').click = () => { clicked++; };
    localStorage.setItem('singleSize', '12');
    startSinglePhoto('fileCountDesktop');
    ok('popup visible', getComputedStyle($('sizePopup')).display === 'flex');
    ok('ultimo usado (12) resaltado', document.querySelector('.size-pick-btn.last-used')?.dataset.size === '12');
    ok('botones >=80px alto', Math.min(...[...document.querySelectorAll('.size-pick-btn')].map(b => b.getBoundingClientRect().height)) >= 80);
    pickPelletSize('4');
    ok('popup oculto tras elegir', $('sizePopup').style.display === 'none');
    ok('perfil 4mm cargado', $('singleSize').value === '4' && $('productDesc').value.includes('4mm'));
    ok('input de archivo disparado 1 vez', clicked === 1);
    multifotos.push({ base64: 'x', mime: 'image/jpeg', blobUrl: '', result: { total: 5, aiTotal: 5 }, analyzing: false });
    clicked = 0; $('fileMultiDesktop').click = () => { clicked++; };
    startMultiPhoto('fileMultiDesktop');
    ok('multifoto con lote: sin popup', $('sizePopup').style.display === 'none' && clicked === 1);
    multifotos.length = 0;
    startMultiPhoto('fileMultiDesktop');
    ok('multifoto lote vacio: popup', $('sizePopup').style.display === 'flex');
    cancelSizePopup();
    ok('cancelar cierra popup', $('sizePopup').style.display === 'none');

    /* ── 2/4. size_match + overlap con fetch simulado ── */
    let nextResp, lastBody;
    window.fetch = async (u, o) => { lastBody = o && o.body; return { ok: true, json: async () => ({ content: [{ text: JSON.stringify(nextResp) }] }) }; };
    const base = { small: 0, medium: 0, large: 0, total: 30, confidence: 'alta', overlap: false, size_match: true, size_detected: null, notes: null };
    lastImageBase64 = 'iVBORw0KGgo='; lastImageMime = 'image/png';
    $('cvCount').width = 100; $('cvCount').height = 100;
    loadProfile('4');
    nextResp = { ...base, total: 31 };
    await runCountAI();
    ok('analisis normal guardado', hist().length === 1);
    ok('prompt pide overlap y size_match', JSON.parse(lastBody).messages[0].content.slice(-1)[0].text.includes('"overlap":false,"size_match":true,"size_detected":null') && JSON.parse(lastBody).messages[0].content.slice(-1)[0].text.includes('Compara el tamaño visual'));
    nextResp = { ...base, total: 20, overlap: false, notes: 'no hay solapamiento entre pellets' };
    await runCountAI();
    ok('overlap=false con palabra clave en notas -> sin alerta', getComputedStyle($('overlapWarning')).display === 'none');
    nextResp = { ...base, total: 20, overlap: true };
    await runCountAI();
    ok('overlap=true -> alerta', getComputedStyle($('overlapWarning')).display === 'flex');

    let before = hist().length;
    nextResp = { ...base, total: 40, size_match: false, size_detected: '12mm' };
    await runCountAI();
    ok('mismatch: NO guardado aun', hist().length === before);
    ok('mismatch: aviso rojo y texto', getComputedStyle($('sizeMismatchWarning')).display === 'block' && $('sizeMismatchText').textContent.includes('12mm, no de 4mm'), $('sizeMismatchText').textContent);
    ok('mismatch: botones', $('btnSizeRepeat').textContent === 'Repetir con 12mm' && $('btnSizeKeep').textContent === 'Mantener 4mm');
    adjustCount(1);
    ok('ajuste +-1 con aviso pendiente no toca historial', hist().length === before && hist()[0].total !== 41);
    keepDeclaredSize();
    ok('Mantener guarda 1 entrada con total ajustado', hist().length === before + 1 && hist()[0].total === 41 && hist()[0].size4 === 41, hist()[0]);
    ok('aviso oculto tras Mantener', $('sizeMismatchWarning').style.display === 'none');

    before = hist().length;
    nextResp = { ...base, total: 40, size_match: false, size_detected: '12mm' };
    await runCountAI();
    nextResp = { ...base, total: 25 };
    repeatWithDetectedSize();
    await sleep(300);
    ok('Repetir: perfil 12mm cargado', $('singleSize').value === '12');
    ok('Repetir: solo se guarda la correcta (no la erronea)', hist().length === before + 1 && hist()[0].total === 25 && hist()[0].size12 === 25, hist()[0]);
    ok('Repetir: aviso oculto', $('sizeMismatchWarning').style.display === 'none');

    nextResp = { ...base, total: 40, size_match: false, size_detected: '8mm' };
    before = hist().length;
    await runCountAI();           /* aviso pendiente (12 declarado -> parece 8) */
    nextResp = { ...base, total: 33 };
    await runCountAI();           /* nuevo analisis sin resolver el aviso */
    ok('aviso sin resolver + analisis nuevo: no se pierde (2 entradas)', hist().length === before + 2);
    ok('la pendiente queda marcada en notes', hist().some(e => /sin resolver/.test(e.notes || '')));

    saveHistoryEntry({ date: 'x', method: 'weigh', total: 99, size4: 99, size8: 0, size12: 0 });
    const vid = lastVisionEntryId;
    adjustCount(1);
    const hh = hist();
    ok('ajuste +-1 modifica la entrada de vision (por id), no la pesada', hh[0].total === 99 && hh.find(e => e.id === vid).total === 34, { weigh: hh[0].total, vision: hh.find(e => e.id === vid).total });

    /* ── 3/5. borrar y duplicados ── */
    localStorage.setItem('analysisHistory', JSON.stringify([
      { id: 'a', date: '1/1/2026 10:00', total: 50, size4: 50, size8: 0, size12: 0, aiTotal: 50 },
      { id: 'b', date: '1/1/2026 10:00', total: 50, size4: 50, size8: 0, size12: 0, aiTotal: 50 },
      { id: 'c', date: '1/1/2026 10:00', total: 50, size4: 0, size8: 50, size12: 0, aiTotal: 50 },
      { id: 'd', date: '1/1/2026 10:05', total: 50, size4: 50, size8: 0, size12: 0, aiTotal: 48 }]));
    removeDuplicateHistory();
    ok('duplicados: solo se quita el exacto', hist().map(e => e.id).join(',') === 'a,c,d', hist().map(e => e.id));
    removeDuplicateHistory();
    ok('sin duplicados no cambia nada', hist().length === 3);
    renderHistory();
    ok('boton papelera en cada tarjeta', document.querySelectorAll('#historyList button[aria-label="Borrar esta entrada"]').length === 3);
    deleteHistEntry(1);
    ok('borrar entrada individual', hist().map(e => e.id).join(',') === 'a,d');
    ok('estadisticas recalculadas (4mm: 2 muestras)', computeStats({ scope: 'all' })['4'].totalAnalyses === 2 && $('exCounts').textContent.includes('2m'), $('exCounts').textContent);

    /* ── 6. ejemplos por tamaño + cuota ── */
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    localStorage.setItem('referenceExamples', JSON.stringify(Array.from({ length: 10 }, (_, i) => ({ id: 't12_' + i, size: '12', total: 30, image: png, mime: 'image/png', date: 'd' }))));
    lastImageBase64 = png; lastImageMime = 'image/png'; counts = { c4: 0, c8: 0, c12: 0, total: 5 };
    loadProfile('4');
    /* v9.6: pulsar de nuevo sobre la MISMA foto actualiza el ejemplo; aquí cada vuelta simula una foto nueva */
    for (let i = 0; i < 11; i++) { currentPhotoExampleId = null; await saveAsExample(); }
    const ex = getReferenceExamples();
    ok('12mm intactos (10) tras guardar 11 de 4mm', ex.filter(e => e.size === '12').length === 10, ex.map(e => e.size).join(','));
    ok('4mm topado a 10', ex.filter(e => e.size === '4').length === 10);
    ok('aviso de reemplazo al pasar el tope', $('bigToast').textContent.includes('reemplazó'), $('bigToast').textContent);
    const total0 = getReferenceExamples().length;
    const origSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (k === 'referenceExamples') throw new DOMException('quota', 'QuotaExceededError'); return origSet.call(this, k, v); };
    currentPhotoExampleId = null; await saveAsExample();
    Storage.prototype.setItem = origSet;
    ok('cuota llena: no se borra nada', getReferenceExamples().length === total0);
    ok('cuota llena: avisa', $('bigToast').textContent.includes('NO se ha borrado nada'), $('bigToast').textContent);
    renderStorageInfo();
    ok('medidor de almacenamiento', /Almacenamiento: [\d.]+\/5 MB/.test($('storageInfo').textContent), $('storageInfo').textContent.slice(0, 70));

    /* ── 5. confirmar total: una sola entrada por lote ── */
    localStorage.setItem('analysisHistory', '[]');
    multifotos.length = 0;
    multifotos.push({ base64: 'x', mime: 'image/jpeg', blobUrl: '', result: { total: 10, aiTotal: 10, confidence: 'alta' }, analyzing: false });
    multifotos.push({ base64: 'x', mime: 'image/jpeg', blobUrl: '', result: { total: 12, aiTotal: 12, confidence: 'alta' }, analyzing: false });
    multiSavedId = null; multiSavedSig = null; multiManualAdjust = 0; multiConfirmed = false;
    loadProfile('8');
    updateMultiTotal();
    confirmMultiTotal(); confirmMultiTotal();
    ok('doble disparo inmediato -> 1 entrada', hist().length === 1 && hist()[0].total === 22 && hist()[0].confidence === 'alta');
    await sleep(700);
    confirmMultiTotal();
    ok('re-pulsar sin cambios (tras 700ms) -> sigue 1', hist().length === 1);
    ok('boton muestra "Total confirmado"', $('btnMultiConfirm').textContent.includes('Total confirmado'), $('btnMultiConfirm').textContent);
    await sleep(700);
    multifotos[0].result.total = 8; updateMultiTotal();
    ok('al cambiar algo el boton vuelve a "Confirmar total"', $('btnMultiConfirm').textContent.includes('Confirmar total'));
    confirmMultiTotal();
    ok('cambio -> sustituye la entrada (sigue 1, total 20, confianza media)', hist().length === 1 && hist()[0].total === 20 && hist()[0].confidence === 'media', hist()[0]);
    multifotos.length = 0; removeMultiFoto; multiSavedId = null;
  } catch (e) {
    R.push('EXC ' + (e && e.stack || e));
  }
  const pre = document.createElement('pre'); pre.id = 'res'; pre.textContent = R.join('\n');
  document.body.appendChild(pre); document.title='RES:'+encodeURIComponent('TOTAL='+R.length+' PASS='+R.filter(x=>x.startsWith('PASS')).length+'\n'+R.filter(x=>!x.startsWith('PASS')).join('\n'));
});



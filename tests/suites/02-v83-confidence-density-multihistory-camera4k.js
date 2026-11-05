// SUITE: 02-v83-confidence-density-multihistory-camera4k
// v8.3: confianza no disponible, limites y alerta de densidad en multifoto, badge/desglose multifoto en historial, camara 3840x2160 y errores
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

    /* ── 3. confianza "undefined" ── */
    let queue = [];
    window.fetch = async () => ({ ok: true, json: async () => ({ content: [{ text: queue.shift() }] }) });
    lastImageBase64 = 'iVBORw0KGgo='; lastImageMime = 'image/png';
    $('cvCount').width = 100; $('cvCount').height = 100;
    loadProfile('8');
    queue = ['no puedo dar JSON, lo siento', '{"total": 12}'];        /* 1ª sin JSON -> reintento simple SIN confidence */
    await runCountAI();
    ok('reintento sin confidence: estado "no disponible"', $('statusCount').textContent.includes('Confianza: no disponible') && !$('statusCount').textContent.includes('undefined'), $('statusCount').textContent);
    ok('aviso de revisar la foto visible', getComputedStyle($('confWarning')).display === 'block' && $('confWarning').textContent.includes('no disponible'), $('confWarning').textContent);
    ok('historial guarda confidence null (no undefined)', hist()[0].confidence === null && hist()[0].total === 12, hist()[0].confidence);
    ok('log explica la causa', debugLogs.some(l => l.includes('SIN confidence válida')));
    queue = ['{"small":0,"medium":0,"large":0,"total":20,"notes":null}'];   /* JSON completo pero sin confidence */
    await runCountAI();
    ok('JSON sin campo confidence: no "undefined"', !$('statusCount').textContent.includes('undefined'));
    queue = ['{"small":0,"medium":0,"large":0,"total":20,"confidence":"rarisima","notes":null}'];
    await runCountAI();
    ok('confidence inválido -> no disponible', $('statusCount').textContent.includes('no disponible'));
    queue = ['{"small":0,"medium":0,"large":0,"total":20,"confidence":"alta","notes":null}'];
    await runCountAI();
    ok('alta sigue funcionando y sin aviso', $('statusCount').textContent.includes('Confianza: alta') && getComputedStyle($('confWarning')).display === 'none');
    renderHistory();
    ok('historial muestra "Confianza n/d" para entradas sin confianza', $('historyList').textContent.includes('Confianza n/d'));

    /* ── 2/5. límites y alerta de densidad ── */
    ok('tabla de límites', JSON.stringify(MULTI_MAX_PER_PHOTO) === '{"4":30,"8":40,"12":30}');
    $('singleSize').value = '12'; updateMultiSizeTip();
    ok('consejo 12mm = 30', $('multiSizeTip').textContent.includes('Máximo 30 por foto'), $('multiSizeTip').textContent);
    $('singleSize').value = '8'; updateMultiSizeTip();
    ok('consejo 8mm = 40', $('multiSizeTip').textContent.includes('Máximo 40 por foto'));
    $('singleSize').value = '4'; updateMultiSizeTip();
    ok('consejo 4mm = 30', $('multiSizeTip').textContent.includes('Máximo 30 por foto'));
    ok('umbral 12mm: 30 no alerta, 31 sí', multiPhotoOverLimit({ aiTotal: 30, sizeDeclared: '12' }) === null && multiPhotoOverLimit({ aiTotal: 31, sizeDeclared: '12' })?.lim === 30);
    ok('umbral 8mm: 40 no, 41 sí', multiPhotoOverLimit({ aiTotal: 40, sizeDeclared: '8' }) === null && multiPhotoOverLimit({ aiTotal: 41, sizeDeclared: '8' })?.lim === 40);
    ok('umbral 4mm: 30 no, 31 sí', multiPhotoOverLimit({ aiTotal: 30, sizeDeclared: '4' }) === null && multiPhotoOverLimit({ aiTotal: 31, sizeDeclared: '4' })?.lim === 30);
    ok('usa el conteo ORIGINAL aunque se corrija a mano', multiPhotoOverLimit({ aiTotal: 43, total: 28, sizeDeclared: '12' })?.lim === 30);
    loadProfile('12'); multifotos.length = 0;
    queue = ['{"small":0,"medium":43,"large":0,"total":43,"confidence":"alta","size_match":true,"size_detected":null,"notes":null}',
             '{"small":0,"medium":20,"large":0,"total":20,"confidence":"alta","size_match":true,"size_detected":null,"notes":null}'];
    addPhotoToMultifoto('', 'AAAA', 'image/jpeg');
    await sleep(100);
    ok('foto de 43 en 12mm: aviso de densidad en la fila', $('multiList').textContent.includes('Densidad alta') && $('multiList').textContent.includes('≤30'), $('multiList').textContent.replace(/\s+/g, ' ').slice(0, 160));
    ok('toast de densidad', $('toast').textContent.includes('supera el máximo recomendado (30)'), $('toast').textContent);
    addPhotoToMultifoto('', 'AAAA', 'image/jpeg');
    await sleep(100);
    ok('foto de 20: sin aviso en su fila (solo 1 aviso en la lista)', ($('multiList').textContent.match(/Densidad alta/g) || []).length === 1);

    /* ── 4. historial multifoto ── */
    localStorage.setItem('analysisHistory', '[]');
    multiSavedId = null; multiSavedSig = null; multiConfirmed = false;
    multifotos.length = 0;
    multifotos.push({ base64: 'x', mime: 'image/jpeg', blobUrl: '', result: { total: 51, aiTotal: 54, confidence: 'alta', sizeDeclared: '12' }, analyzing: false });
    multifotos.push({ base64: 'x', mime: 'image/jpeg', blobUrl: '', result: { total: 51, aiTotal: 51, confidence: 'alta', sizeDeclared: '12' }, analyzing: false });
    updateMultiTotal(); confirmMultiTotal();
    const hl = [{ id: 'old1', date: '1/9/2026 10:00', total: 150, aiTotal: 150, size4: 0, size8: 150, size12: 0, confidence: 'alta', notes: 'Multifoto 3 fotos · F1:49 F2:51 F3:50' },
                { id: 'old2', date: '2/9/2026 10:00', total: 100, aiTotal: 100, size4: 0, size8: 100, size12: 0, confidence: 'alta', photoBreakdown: [49, 51] },
                { id: 'single', date: '3/9/2026 10:00', total: 52, aiTotal: 52, size4: 0, size8: 52, size12: 0, confidence: 'alta', notes: null }];
    localStorage.setItem('analysisHistory', JSON.stringify([...hist(), ...hl]));
    renderHistory();
    const cards = [...$('historyList').children];
    const txt = i => cards[i].textContent.replace(/\s+/g, ' ');
    ok('entrada nueva: badge con nº de fotos', txt(0).includes('📷 Multifoto (2 fotos)'), txt(0).slice(0, 120));
    ok('entrada nueva: desglose con corrección 54→51 (-3)', txt(0).includes('F1: 54→51 (-3)') && txt(0).includes('F2: 51 uds'), txt(0).slice(0, 200));
    const chips = cards[0].querySelectorAll('span[style*="border-radius:8px"]');
    ok('chip corregido en naranja, el no corregido no', chips.length === 2 && chips[0].getAttribute('style').includes('var(--orange)') && !chips[1].getAttribute('style').includes('color:var(--orange)'));
    ok('tarjeta multifoto con borde azul a la izquierda', cards[0].getAttribute('style').includes('border-left:3px solid var(--blue)'));
    ok('entrada antigua (notes): badge 3 fotos', txt(1).includes('📷 Multifoto (3 fotos)'), txt(1).slice(0, 100));
    ok('entrada v7.9.6 (numeros): badge 2 fotos + chips', txt(2).includes('Multifoto (2 fotos)') && txt(2).includes('F1: 49 uds'));
    ok('foto unica: sin badge multifoto ni borde azul', !txt(3).includes('Multifoto') && !cards[3].getAttribute('style').includes('border-left'));
    ok('copiar resultado incluye Multifoto', buildResultSummary(hist()[0]).includes('Multifoto (2 fotos)'), buildResultSummary(hist()[0]));

    /* ── 1. camara 4K + log de resolucion (dispositivo falso de Chrome) ── */
    debugLogs.length = 0;
    const origGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    let constraintsSeen = null;
    navigator.mediaDevices.getUserMedia = c => { constraintsSeen = c; return origGUM(c); };
    queue = ['{"small":0,"medium":10,"large":0,"total":10,"confidence":"alta","overlap":false,"size_match":true,"size_detected":null,"notes":null}'];
    openCameraModal('single');
    await sleep(1500);
    ok('getUserMedia pide 3840x2160 ideal', constraintsSeen?.video?.width?.ideal === 3840 && constraintsSeen?.video?.height?.ideal === 2160 && constraintsSeen?.video?.facingMode?.ideal === 'environment', constraintsSeen);
    ok('log de resolucion REAL (getSettings)', debugLogs.some(l => l.startsWith('CÁMARA (inicio)') && /"width":\d+/.test(l)), debugLogs.filter(l => l.startsWith('CÁMARA')));
    ok('modal muestra la resolucion', /Resolución de la cámara: \d+×\d+/.test($('cameraResInfo').textContent), $('cameraResInfo').textContent);
    captureCameraPhoto();
    ok('log de captura con frame y tamaño', debugLogs.some(l => /^CAPTURA: frame \d+×\d+, JPEG q=0\.92, base64=\d+/.test(l)), debugLogs.filter(l => l.startsWith('CAPTURA')));
    ok('camara liberada tras capturar', cameraStream === null && $('cameraModal').style.display === 'none');
    await sleep(500);
    ok('la captura llega al flujo de foto unica (se guarda analisis)', hist().some(e => e.total === 10));

    /* limite de tamaño: baja la calidad hasta que quepa */
    openCameraModal('single'); await sleep(1200);
    const origTD = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function (t, q) { return 'data:image/jpeg;base64,' + 'A'.repeat(q > 0.75 ? 5000000 : 1000); };
    debugLogs.length = 0;
    captureCameraPhoto();
    HTMLCanvasElement.prototype.toDataURL = origTD;
    ok('JPEG demasiado grande: baja calidad hasta caber', debugLogs.some(l => /JPEG q=0\.72, base64=1023/.test(l)), debugLogs.filter(l => l.startsWith('CAPTURA')));

    /* mensajes de error de camara */
    const errCase = async (name) => { navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('x'), { name })); openCameraModal('single'); await sleep(50); const t = $('cameraError').textContent; closeCameraModal(); return t; };
    ok('NotAllowedError -> permiso denegado (texto pedido)', (await errCase('NotAllowedError')) === '⚠️ Permiso de cámara denegado — usa 📁 Subir desde archivo');
    ok('NotReadableError -> cámara en uso', (await errCase('NotReadableError')).includes('en uso'));
    ok('NotFoundError -> sin cámara', (await errCase('NotFoundError')).includes('No se encontró'));
    ok('otro error -> nombre del error visible', (await errCase('AbortError')).includes('AbortError'));
    navigator.mediaDevices.getUserMedia = origGUM;
  } catch (e) {
    R.push('EXC ' + (e && e.stack || e));
  }
  const pre = document.createElement('pre'); pre.id = 'res'; pre.textContent = R.join('\n');
  document.body.appendChild(pre); document.title='RES:'+encodeURIComponent('TOTAL='+R.length+' PASS='+R.filter(x=>x.startsWith('PASS')).length+'\n'+R.filter(x=>!x.startsWith('PASS')).join('\n')+'\n'+R.slice(-12).join('\n'));
});




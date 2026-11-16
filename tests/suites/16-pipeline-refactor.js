// SUITE: 16-pipeline-refactor
// Refactor del pipeline (rama fable-audit): JSON cortado o con texto alrededor, foto cambiada durante el analisis, limite de tiempo, conteos como enteros, tabla de modelos y marca experimental en las entradas
// @timeout 120
window.addEventListener('load', async () => {
  const R = [];
  const ok = (n, c, extra) => R.push((c ? 'PASS ' : 'FAIL ') + n + (extra !== undefined ? '  => ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = id => document.getElementById(id);
  const hist = () => JSON.parse(localStorage.getItem('analysisHistory') || '[]');
  const J = (n, extra) => JSON.stringify(Object.assign({ small: 0, medium: n, large: 0, total: n, confidence: 'alta', overlap: false, size_match: true, size_detected: null, notes: null }, extra || {}));
  const txt = t => ({ ok: true, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: t }] }) });
  let queue = [], reqs = [];
  const mockFetch = async (u, o) => { reqs.push(JSON.parse(o.body)); const q = queue.shift(); return typeof q === 'function' ? q(o) : (q || txt(J(30))); };
  const imgOf = b => { const im = b.messages[0].content.filter(x => x.type === 'image'); return im[im.length - 1].source.data; };
  const makeFile = async (color, name) => { const c = document.createElement('canvas'); c.width = 60; c.height = 40; const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 60, 40); const b = await new Promise(r => c.toBlob(r, 'image/png')); const f = new File([b], name, { type: 'image/png' }); const b64 = await new Promise(r => { const rd = new FileReader(); rd.onload = () => r(rd.result.split(',')[1]); rd.readAsDataURL(f); }); return { file: f, b64 }; };
  const load = f => loadCount({ target: { files: [f] } });
  const fresh = () => { localStorage.setItem('analysisHistory', '[]'); reqs = []; queue = []; debugLogs.length = 0; };
  try {
    window.confirm = () => true; localStorage.clear(); localStorage.setItem('claudeApiKey', 'sk-ant-test'); window.fetch = mockFetch;
    loadProfile('8');
    const A = await makeFile('#c33', 'a.png'), B = await makeFile('#36c', 'b.png');
    ok('(dos fotos distintas)', A.b64 !== B.b64 && A.b64.length > 50);

    /* ══ estructura ══ */
    ok('existe UNA función compartida y las rutas ya no llevan su propia copia', typeof analyzeImage === 'function' && !/postCount|extractJson|askClaude|simplePrompt/.test(runCountAI.toString()) && !/postCount|extractJson|askClaude|simplePrompt/.test(analyzeOneFoto.toString()) && /analyzeImage\(/.test(runCountAI.toString()) && /analyzeImage\(/.test(analyzeOneFoto.toString()));
    localStorage.setItem('referenceExamples', JSON.stringify([{ id: '1', size: '8', total: 10, mime: 'image/png', image: A.b64 }, { id: '2', size: '8', total: 20, mime: 'image/png', image: A.b64 }, { id: '3', size: '8', total: 30, mime: 'image/png', image: A.b64 }, { id: '4', size: '4', total: 40, mime: 'image/png', image: A.b64 }]));
    ok('selectFewShot: los FEWSHOT_SEND (2) más recientes del tamaño; ninguno sin tamaño', FEWSHOT_SEND === 2 && selectFewShot('8').map(e => e.total).join() === '20,30' && selectFewShot('4').length === 1 && selectFewShot('12').length === 0 && selectFewShot('').length === 0);
    localStorage.setItem('referenceExamples', '[]');

    /* ══ B2: JSON cortado / con texto alrededor ══ */
    ok('parseJsonObject: objeto limpio', parseJsonObject('{"total":5}').total === 5);
    ok('parseJsonObject: texto antes y después', parseJsonObject('Aquí tienes:\n{"total":7,"notes":"ok"}\nEspero que ayude.').total === 7);
    ok('parseJsonObject: cortado → null', parseJsonObject('{"small":0,"medium":30,"lar') === null);
    ok('parseJsonObject: sin JSON / array / dos objetos', parseJsonObject('nada') === null && parseJsonObject('[1,2]') === null && parseJsonObject('{"total":3} y luego {"total":9}').total === 3);
    ok('parseJsonObject: nota con llaves dentro', parseJsonObject('{"total":4,"notes":"zona {densa} arriba"}').total === 4);

    fresh(); lastImageBase64 = A.b64; lastImageMime = 'image/png';
    queue = [txt('{"small":0,"medium":41,"large":0,"total":41,"confidence":"alta","overlap":false,"size_ma'), txt('{"total":40,"confidence":"media"}')];
    await runCountAI();
    ok('foto única: respuesta CORTADA que empieza por "{" → reintenta (antes: error de JSON)', reqs.length === 2 && hist().length === 1 && hist()[0].total === 40 && hist()[0].viaRetry === true, [reqs.length, $('statusCount').textContent]);
    fresh(); queue = [txt(J(41) + '\n\nNota: había dos pellets muy juntos.')];
    await runCountAI();
    ok('foto única: JSON válido seguido de texto → se acepta sin reintento (antes: error de JSON)', reqs.length === 1 && hist()[0].total === 41 && !hist()[0].viaRetry, [reqs.length, $('statusCount').textContent]);
    fresh(); multifotos.length = 0; resetMulti();
    queue = [txt('{"small":0,"medium":2'), txt('{"small":0,"medium":22,"large":0,"total":22,"confidence":"alta","notes":null}')];
    addPhotoToMultifoto('', A.b64, 'image/png'); await sleep(300);
    ok('multifoto: respuesta cortada → reintenta en vez de marcar la foto como fallida', reqs.length === 2 && multifotos[0].result.total === 22 && !multifotos[0].result.failed && multifotos[0].result.viaRetry === true, multifotos[0].result);
    multifotos.length = 0; resetMulti();

    /* ══ B5: conteos como enteros ══ */
    ok('toCount', toCount('26') === 26 && toCount(26.4) === 26 && toCount(-3) === 0 && toCount(null) === 0 && toCount('abc') === 0 && toCount(undefined) === 0);
    fresh(); queue = [txt(J(0, { total: '26', medium: '26' }))];
    await runCountAI();
    ok('foto única: total como texto "26" → número 26', hist()[0].total === 26 && typeof hist()[0].total === 'number' && typeof hist()[0].size8 === 'number');
    fresh(); multifotos.length = 0; resetMulti(); queue = [txt(J(0, { total: '26', medium: '26' })), txt(J(0, { total: '24', medium: '24' }))];
    addPhotoToMultifoto('', A.b64, 'image/png'); addPhotoToMultifoto('', B.b64, 'image/png'); await sleep(300);
    ok('multifoto: totales como texto se SUMAN (50), no se concatenan', multiTotal === 50 && multifotos[0].result.total === 26, multiTotal);
    multifotos.length = 0; resetMulti(); queue = [txt(JSON.stringify({ small: 21, medium: 0, large: 0, confidence: 'alta' }))]; reqs = [];
    addPhotoToMultifoto('', A.b64, 'image/png'); await sleep(300);
    ok('multifoto: sin "total" y con el conteo en otro campo → se usa la suma (antes daba 0)', multifotos[0].result.total === 21);
    multifotos.length = 0; resetMulti();

    /* ══ B3: se carga otra foto durante el análisis ══ */
    fresh(); let release; queue = [() => new Promise(r => { release = () => r(txt(J(30))); }), txt(J(31))];
    load(A.file); await sleep(600);
    ok('(1ª foto en vuelo)', reqs.length === 1 && imgOf(reqs[0]) === A.b64 && isAnalyzing === true);
    load(B.file); await sleep(600);
    ok('(2ª foto cargada mientras tanto: aún sin petición)', reqs.length === 1 && lastImageBase64 === B.b64);
    release(); await sleep(900);
    ok('el resultado de la foto vieja se descarta y se analiza la NUEVA', reqs.length === 2 && imgOf(reqs[1]) === B.b64 && hist().length === 1 && hist()[0].total === 31, [reqs.length, hist().map(e => e.total)]);
    ok('queda anotado en el log', debugLogs.some(l => l.startsWith('Resultado DESCARTADO')));
    ok('la pantalla muestra el resultado de la foto nueva', /31 detectados/.test($('statusCount').textContent) && isAnalyzing === false, $('statusCount').textContent);

    fresh(); queue = [() => new Promise(r => { release = () => r(txt('sin json')); }), txt('{"total":30,"confidence":"alta"}'), txt(J(33))];
    load(A.file); await sleep(600); load(B.file); await sleep(600); release(); await sleep(1000);
    ok('el REINTENTO envía la misma foto que la 1ª llamada (antes podía enviar la nueva)', reqs.length === 3 && imgOf(reqs[0]) === A.b64 && imgOf(reqs[1]) === A.b64 && imgOf(reqs[2]) === B.b64, reqs.map(r => imgOf(r) === A.b64 ? 'A' : 'B'));
    ok('y solo queda la entrada de la foto nueva', hist().length === 1 && hist()[0].total === 33);

    fresh(); queue = [() => new Promise(r => { release = () => r({ ok: false, status: 500, json: async () => ({ error: { message: 'boom viejo' } }) }); }), txt(J(35))];
    load(A.file); await sleep(600); load(B.file); await sleep(600); release(); await sleep(900);
    ok('un error de la foto vieja no se muestra: se analiza la nueva', !/boom viejo/.test($('statusCount').textContent) && hist().length === 1 && hist()[0].total === 35, $('statusCount').textContent);

    fresh(); queue = [() => new Promise(r => { release = () => r(txt(J(30))); })];
    load(A.file); await sleep(600); load(A.file); await sleep(600); release(); await sleep(900);
    ok('volver a cargar la MISMA foto durante el análisis no descarta ni duplica', reqs.length === 1 && hist().length === 1 && hist()[0].total === 30, [reqs.length, hist().length]);
    ok('la entrada lleva los datos de SU foto (método, nitidez)', hist()[0].captureMethod === 'file' && typeof hist()[0].sharpness === 'number');

    /* ══ B4: límite de tiempo ══ */
    const realTimeout = countTimeoutMs; countTimeoutMs = 1000;
    ok('límite por defecto: 90 s', realTimeout === 90000);
    const hang = (u, o) => { reqs.push(JSON.parse(o.body)); return new Promise((res, rej) => { o.signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))); }); };
    fresh(); window.fetch = hang; lastImageBase64 = A.b64; lastImageMime = 'image/png';
    const t0 = Date.now(); await runCountAI(); const dt = Date.now() - t0;
    ok('foto única: una llamada colgada termina con un mensaje claro', dt >= 900 && dt < 4000 && /no respondió en 1 s/.test($('statusCount').textContent) && hist().length === 0, [dt, $('statusCount').textContent]);
    ok('y la app queda desbloqueada (antes: "analizando" hasta recargar)', isAnalyzing === false && $('btnRecount').disabled === false);
    multifotos.length = 0; resetMulti(); addPhotoToMultifoto('', A.b64, 'image/png'); await sleep(1500);
    ok('multifoto: la foto colgada queda como fallida con el mismo mensaje (y reintentable)', multifotos[0].result.failed === true && /no respondió en 1 s/.test(multifotos[0].result.error), multifotos[0].result.error);
    window.fetch = mockFetch; multifotos.length = 0; resetMulti();
    fresh(); queue = [txt(J(30))]; await runCountAI();
    ok('tras un tiempo agotado, el siguiente análisis funciona', hist().length === 1 && hist()[0].total === 30);
    fresh(); let sig = null; window.fetch = async (u, o) => { sig = o.signal; return txt(J(30)); }; await runCountAI(); await sleep(1300);
    ok('una llamada normal no se aborta después (el temporizador se limpia)', sig && sig.aborted === false);
    window.fetch = mockFetch; countTimeoutMs = realTimeout;

    /* ══ D: tabla de modelos y marca experimental ══ */
    ok('MODELS define etiqueta y temperature de cada modelo', MODELS['claude-sonnet-4-6'].temperature === 0 && MODELS['claude-sonnet-5-5'].temperature === null && MODELS[PRODUCTION_MODEL].label === PRODUCTION_LABEL && modelLabel(EXPERIMENTAL_MODEL) === EXPERIMENTAL_LABEL);
    ok('un modelo que no está en la tabla no recibe temperature y se etiqueta con su id', Object.keys(samplingFor('claude-desconocido-9')).length === 0 && modelLabel('claude-desconocido-9') === 'claude-desconocido-9');
    ok('currentModel devuelve modelo y marca', JSON.stringify(currentModel()) === '{"model":"claude-sonnet-4-6","experimental":false}');
    fresh(); queue = [txt(J(30))]; await runCountAI();
    ok('entrada de producción: experimental=false', hist()[0].experimental === false && hist()[0].model === 'claude-sonnet-4-6');
    experimentalModelOn = true; queue = [txt(J(31))]; await runCountAI();
    ok('entrada del modo experimental: experimental=true', hist()[0].experimental === true && hist()[0].model === 'claude-sonnet-5-5');
    multifotos.length = 0; resetMulti(); multiSavedId = null; queue = [txt(J(20)), txt(J(21))];
    addPhotoToMultifoto('', A.b64, 'image/png'); addPhotoToMultifoto('', B.b64, 'image/png'); await sleep(300); confirmMultiTotal(); await sleep(700);
    ok('lote multifoto experimental: marca y modelo en la entrada', hist()[0].experimental === true && hist()[0].model === 'claude-sonnet-5-5' && Array.isArray(hist()[0].photoBreakdown));
    experimentalModelOn = false; multifotos.length = 0; resetMulti(); multiSavedId = null; queue = [txt(J(20))];
    addPhotoToMultifoto('', A.b64, 'image/png'); await sleep(300); confirmMultiTotal(); await sleep(700);
    ok('lote multifoto de producción: experimental=false', hist()[0].experimental === false && hist()[0].model === 'claude-sonnet-4-6');
    multifotos.length = 0; resetMulti();

    ok('isExperimentalEntry: la marca manda; sin marca (v9.7–v9.9) decide el modelo de entonces', isExperimentalEntry({ experimental: true, model: 'claude-sonnet-4-6' }) === true && isExperimentalEntry({ experimental: false, model: 'claude-sonnet-5-5' }) === false && isExperimentalEntry({ model: 'claude-sonnet-5-5' }) === true && isExperimentalEntry({ model: 'claude-sonnet-4-6' }) === false && isExperimentalEntry({}) === false);
    const e = (id, model, exp) => Object.assign({ id, date: 'd', ts: Date.now(), total: 40, aiTotal: 41, size8: 40, size4: 0, size12: 0, confidence: 'alta', model }, exp === undefined ? {} : { experimental: exp });
    localStorage.setItem('analysisHistory', JSON.stringify([e('a', 'claude-sonnet-4-6', false), e('b', 'claude-modelo-futuro', false), e('c', 'claude-sonnet-4-6', true), e('d', 'claude-sonnet-5-5'), e('f', 'claude-sonnet-4-6'), Object.assign(e('g'), { model: undefined })]));
    const st = computeStats({ scope: 'all' })['8'].totalAnalyses;
    ok('estadísticas: cuentan por la MARCA, no por el nombre del modelo (4 de 6: un modelo futuro no experimental cuenta; uno de producción marcado experimental no)', st === 4, st);
    historyFilter = 'all'; renderHistory();
    const badges = [...$('historyList').children].map(c => /🧪/.test(c.textContent));
    ok('historial: 🧪 solo en las entradas experimentales', badges.join() === 'false,false,true,true,false,false', badges);
  } catch (err) { R.push('EXC ' + (err && err.stack || err)); }
  const pre = document.createElement('pre'); pre.id = 'res'; pre.style.display = 'none';
  pre.textContent = 'TOTAL=' + R.length + ' PASS=' + R.filter(x => x.startsWith('PASS')).length + '\n' + R.join('\n');
  document.body.appendChild(pre); document.title = 'RES:done';
});

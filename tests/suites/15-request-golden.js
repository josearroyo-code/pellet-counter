// SUITE: 15-request-golden
// Huellas SHA-256 de las peticiones EXACTAS (URL + cabeceras + cuerpo, byte a byte) que la app envia a la API en 14 escenarios. Generadas con v9.9 antes del refactor del pipeline: cualquier cambio en prompts, ejemplos, modelo o parametros hace fallar esta suite. Si el cambio es DELIBERADO, actualiza GOLDEN con los valores que imprime el fallo.
// @timeout 90
window.addEventListener('load', async () => {
  const R = [];
  const ok = (n, c, extra) => R.push((c ? 'PASS ' : 'FAIL ') + n + (extra !== undefined ? '  => ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = id => document.getElementById(id);
  /* nº de peticiones : longitud total : SHA-256 (16 hex) — generado con js/app.js de v9.9 (commit 5f68332) */
  const GOLDEN = {
    's01 única 8mm sin ejemplos': '1:3023:738c6235c3fb8658',
    's02 única 8mm con ejemplos (usa los 2 últimos de 8mm)': '1:4066:5939175cfef15649',
    's03 única 4mm con ejemplos': '1:5156:fee420dd75837e39',
    's04 única 12mm (sin ejemplos de 12mm)': '1:3076:5a19525296192a91',
    's05 única modo clasificar (sin few-shot)': '1:2800:c196b6e8f5c5efdc',
    's06 única 8mm con reintento': '2:4965:34a336ca6591e7a2',
    's07 única clasificar con reintento': '2:3735:d12ec30dcfb96452',
    's08 multifoto 8mm 2 fotos con ejemplos': '2:8130:9cb3f7571caf48dc',
    's09 multifoto 12mm 2 fotos sin ejemplos': '2:6150:046e2062fa931c88',
    's10 multifoto 4mm con reintento en la 1ª foto': '3:11231:d566217887c26871',
    's11 EXPERIMENTAL única 8mm con ejemplos': '1:4048:adbe9d088e937571',
    's12 EXPERIMENTAL multifoto 8mm': '2:8094:a0a32c3210986567',
    's13 temperature rechazada (400) y análisis siguiente': '3:9031:6baae2a0ce9e3fd3',
    's14 única con descripción escrita a mano': '1:2374:a1bd3a729aba3c56',
  };
  const IMG_A = 'QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFB', IMG_B = 'QkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJC';
  const png64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const EXAMPLES = [
    { id: 'e1', size: '8', total: 41, mime: 'image/png', image: png64 }, { id: 'e2', size: '4', total: 52, mime: 'image/jpeg', image: IMG_A },
    { id: 'e3', size: '8', total: 38, mime: 'image/png', image: png64 }, { id: 'e4', size: '8', total: 29, mime: 'image/jpeg', image: IMG_B },
    { id: 'e5', size: '4', total: 47, mime: 'image/png', image: png64 }, { id: 'e6', size: null, total: 90, mime: 'image/png', image: png64 }
  ];
  const J = n => JSON.stringify({ small: 0, medium: n, large: 0, total: n, confidence: 'alta', overlap: false, size_match: true, size_detected: null, notes: null });
  const txt = t => ({ ok: true, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: t }] }) });
  const err400 = m => ({ ok: false, status: 400, json: async () => ({ error: { message: m } }) });
  let reqs = [], queue = [];
  window.fetch = async (u, o) => { reqs.push([String(u), o.method, o.headers, o.body]); const q = queue.shift(); return q || txt(J(30)); };
  const sha = async s => { const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); return [...d].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join(''); };
  function reset(o) {
    localStorage.clear(); localStorage.setItem('claudeApiKey', 'sk-ant-test'); window.confirm = () => true;
    if (o.examples) localStorage.setItem('referenceExamples', JSON.stringify(EXAMPLES));
    experimentalModelOn = !!o.experimental; temperatureRejected = false;
    multifotos.length = 0; resetMulti();
    loadProfile(o.size || '8');
    if (o.classify) $('sizeMode').value = 'multi';
    if (o.desc) $('productDesc').value = o.desc;
    reqs = []; queue = (o.queue || []).slice();
  }
  async function single(o) { reset(o); lastImageBase64 = IMG_A; lastImageMime = 'image/jpeg'; await runCountAI(); if (o.again) await runCountAI(); }
  async function multi(o) { reset(o); window._currentProductDesc = $('productDesc').value.trim(); addPhotoToMultifoto('', IMG_A, 'image/jpeg'); addPhotoToMultifoto('', IMG_B, 'image/png'); await sleep(250); multifotos.length = 0; resetMulti(); }
  const SCENARIOS = {
    's01 única 8mm sin ejemplos': () => single({ size: '8' }),
    's02 única 8mm con ejemplos (usa los 2 últimos de 8mm)': () => single({ size: '8', examples: true }),
    's03 única 4mm con ejemplos': () => single({ size: '4', examples: true }),
    's04 única 12mm (sin ejemplos de 12mm)': () => single({ size: '12', examples: true }),
    's05 única modo clasificar (sin few-shot)': () => single({ size: '8', examples: true, classify: true }),
    's06 única 8mm con reintento': () => single({ size: '8', examples: true, queue: [txt('no hay json'), txt('{"total":30,"confidence":"media"}')] }),
    's07 única clasificar con reintento': () => single({ size: '8', classify: true, queue: [txt('no hay json'), txt('{"small":1,"medium":2,"large":3,"total":6,"confidence":"media"}')] }),
    's08 multifoto 8mm 2 fotos con ejemplos': () => multi({ size: '8', examples: true }),
    's09 multifoto 12mm 2 fotos sin ejemplos': () => multi({ size: '12' }),
    's10 multifoto 4mm con reintento en la 1ª foto': () => multi({ size: '4', examples: true, queue: [txt('no hay json'), txt(J(20)), txt(J(21))] }),
    's11 EXPERIMENTAL única 8mm con ejemplos': () => single({ size: '8', examples: true, experimental: true }),
    's12 EXPERIMENTAL multifoto 8mm': () => multi({ size: '8', examples: true, experimental: true }),
    's13 temperature rechazada (400) y análisis siguiente': () => single({ size: '8', queue: [err400('`temperature` is not supported'), txt(J(30)), txt(J(31))], again: true }),
    's14 única con descripción escrita a mano': () => single({ size: '8', desc: 'Tornillos M3 de acero, cabeza "allen" — contar <todos>' })
  };
  try {
    ok('contexto con crypto.subtle (necesario para SHA-256)', !!(window.crypto && crypto.subtle));
    const actual = {};
    for (const [name, fn] of Object.entries(SCENARIOS)) {
      await fn();
      const blob = JSON.stringify(reqs);
      actual[name] = reqs.length + ':' + blob.length + ':' + await sha(blob);
      ok(name, GOLDEN[name] === actual[name], GOLDEN[name] === actual[name] ? actual[name] : { esperado: GOLDEN[name] || '(sin golden)', obtenido: actual[name] });
    }
    experimentalModelOn = false; temperatureRejected = false;
    if (Object.keys(GOLDEN).length === 0) R.push('INFO GOLDEN=' + JSON.stringify(actual));
  } catch (e) { R.push('EXC ' + (e && e.stack || e)); }
  const pre = document.createElement('pre'); pre.id = 'res'; pre.style.display = 'none';
  pre.textContent = 'TOTAL=' + R.length + ' PASS=' + R.filter(x => x.startsWith('PASS')).length + '\n' + R.join('\n');
  document.body.appendChild(pre); document.title = 'RES:done';
});

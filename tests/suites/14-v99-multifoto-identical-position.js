// SUITE: 14-v99-multifoto-identical-position
// v9.9: multifoto y foto unica envian EXACTAMENTE el mismo prompt; la peticion de una foto no depende de su posicion en el lote ni del popup de tamano; las peticiones salen en paralelo; huellas en el log
// @timeout 90
window.addEventListener('load', async () => {
  const R = [];
  const ok = (n, c, extra) => R.push((c ? 'PASS ' : 'FAIL ') + n + (extra !== undefined ? '  => ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const A = 'QUFBQUFBQUFBQUFBQUFB', B = 'QkJCQkJCQkJCQkJCQkJC';
  const png64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const PNG = Uint8Array.from(atob(png64), c => c.charCodeAt(0));
  const RESP = '{"small":0,"medium":20,"large":0,"total":20,"confidence":"alta","notes":null}';
  const textOf = b => b.messages[0].content.filter(x => x.type === 'text').pop().text;
  let log = [];
  const setup = (examples) => {
    localStorage.clear(); localStorage.setItem('claudeApiKey', 'k'); window.confirm = () => true;
    if (examples) localStorage.setItem('referenceExamples', JSON.stringify([{ id: 'a', size: '8', total: 41, mime: 'image/png', image: png64 }, { id: 'b', size: '8', total: 38, mime: 'image/png', image: png64 }]));
    loadProfile('4'); loadProfile('8'); multifotos.length = 0; resetMulti(); log = []; debugLogs.length = 0;
  };
  async function batch(order, viaPopup, hold) {
    setup(true);
    const pending = [];
    window.fetch = (u, o) => { const body = JSON.parse(o.body); const imgs = body.messages[0].content.filter(x => x.type === 'image'); log.push({ img: imgs[imgs.length - 1].source.data, body }); return new Promise(res => { pending.push(() => res({ ok: true, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: RESP }] }) })); }); };
    for (let i = 0; i < order.length; i++) {
      if (viaPopup && i === 0) { const inp = document.getElementById('fileMulti'); inp.click = () => { }; startMultiPhoto('fileMulti'); pickPelletSize('8'); }
      addPhotoToMultifoto('', order[i], 'image/jpeg'); await sleep(80);
    }
    const started = log.length;
    pending.forEach(f => f()); await sleep(300);
    return { log: log.slice(), started };
  }
  try {
    /* ── el prompt ── */
    window.fetch = async (u, o) => { log.push({ body: JSON.parse(o.body) }); return { ok: true, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: RESP }] }) }; };
    for (const ex of [false, true]) {
      setup(ex);
      loadCount({ target: { files: [new File([PNG], 'a.png', { type: 'image/png' })] } }); await sleep(600);
      addPhotoToMultifoto('', png64, 'image/png'); await sleep(300);
      const s = textOf(log[0].body), m = textOf(log[1].body);
      ok(`prompt idéntico carácter a carácter (${ex ? 'con' : 'sin'} ejemplos)`, s === m && s.length > 2000, [s.length, m.length]);
      ok(`cuerpo idéntico salvo la imagen del lote (modelo, max_tokens, temperature, ejemplos) (${ex ? 'con' : 'sin'} ejemplos)`, JSON.stringify([log[0].body.model, log[0].body.max_tokens, log[0].body.temperature, log[0].body.messages[0].content.slice(0, -2)]) === JSON.stringify([log[1].body.model, log[1].body.max_tokens, log[1].body.temperature, log[1].body.messages[0].content.slice(0, -2)]));
      multifotos.length = 0; resetMulti();
    }
    ok('no queda rastro del bloque eliminado', !JSON.stringify(log).includes('IMPORTANTE: Estás contando') && typeof MULTI_ONLY_GUARD === 'undefined');

    /* ── posición en el lote ── */
    const ab = await batch([A, B], true), ba = await batch([B, A], true), ab2 = await batch([A, B], false);
    const bodyOf = (r, img) => JSON.stringify(r.log.find(x => x.img === img).body);
    ok('las dos peticiones salen en PARALELO (ambas antes de recibir ninguna respuesta)', ab.started === 2 && ba.started === 2, [ab.started, ba.started]);
    ok('foto A: petición idéntica cargada 1ª o 2ª', bodyOf(ab, A) === bodyOf(ba, A));
    ok('foto B: petición idéntica cargada 2ª o 1ª', bodyOf(ab, B) === bodyOf(ba, B));
    ok('foto A: idéntica con y sin el popup de tamaño en el lote', bodyOf(ab, A) === bodyOf(ab2, A));
    ok('las dos fotos de un lote reciben los mismos 2 ejemplos y el mismo texto', (() => { const x = ab.log[0].body, y = ab.log[1].body; return textOf(x) === textOf(y) && JSON.stringify(x.messages[0].content.slice(0, -2)) === JSON.stringify(y.messages[0].content.slice(0, -2)) && x.messages[0].content.length === 6; })());

    /* ── huellas en el log ── */
    setup(true); window.fetch = async () => ({ ok: true, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: RESP }] }) });
    addPhotoToMultifoto('', A, 'image/jpeg'); await sleep(200); addPhotoToMultifoto('', A, 'image/jpeg'); await sleep(200);
    loadCount({ target: { files: [new File([PNG], 'a.png', { type: 'image/png' })] } }); await sleep(600);
    const sends = debugLogs.filter(l => l.startsWith('ENVÍO IA'));
    const fp = l => (l.match(/huella prompt=(\w{8}) imagen=(\w{8}) ejemplos=\[([\d,]*)\]/) || []).slice(1);
    ok('cada ENVÍO IA lleva huella de prompt, de imagen y los conteos de los ejemplos', sends.length === 3 && sends.every(l => fp(l).length === 3 && fp(l)[2] === '41,38'), sends[0]);
    ok('misma foto en dos posiciones del lote → mismas huellas', fp(sends[0]).join() === fp(sends[1]).join());
    ok('foto única vs multifoto → MISMA huella de prompt (imagen distinta: otra codificación)', fp(sends[2])[0] === fp(sends[0])[0] && fp(sends[2])[1] !== fp(sends[0])[1]);
    setup(true); window.fetch = async () => ({ ok: true, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: RESP }] }) });
    addPhotoToMultifoto('', A, 'image/jpeg'); await sleep(200);
    const h1 = fp(debugLogs.filter(l => l.startsWith('ENVÍO IA')).pop());
    const exs = JSON.parse(localStorage.getItem('referenceExamples')); exs.push({ id: 'c', size: '8', total: 29, mime: 'image/png', image: png64 }); localStorage.setItem('referenceExamples', JSON.stringify(exs));
    addPhotoToMultifoto('', A, 'image/jpeg'); await sleep(200);
    const h2 = fp(debugLogs.filter(l => l.startsWith('ENVÍO IA')).pop());
    ok('si se guarda un ejemplo entre dos análisis de la misma foto, el log lo delata (ejemplos 41,38 → 38,29)', h1[2] === '41,38' && h2[2] === '38,29' && h1[1] === h2[1], [h1, h2]);
  } catch (e) { R.push('EXC ' + (e && e.stack || e)); }
  const pre = document.createElement('pre'); pre.id = 'res'; pre.style.display = 'none';
  pre.textContent = 'TOTAL=' + R.length + ' PASS=' + R.filter(x => x.startsWith('PASS')).length + '\n' + R.join('\n');
  document.body.appendChild(pre); document.title = 'RES:done';
});

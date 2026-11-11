// SUITE: 13-v98-temperature
// v9.8: temperature:0 en las tres llamadas de conteo de produccion (foto unica, multifoto, reintento), no en el modelo experimental, y degradacion segura si el servidor la rechaza
window.addEventListener('load', async () => {
  const R = [];
  const ok = (n, c, extra) => R.push((c ? 'PASS ' : 'FAIL ') + n + (extra !== undefined ? '  => ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = id => document.getElementById(id);
  const hist = () => JSON.parse(localStorage.getItem('analysisHistory') || '[]');
  const J = n => JSON.stringify({ small: 0, medium: n, large: 0, total: n, confidence: 'alta', overlap: false, size_match: true, size_detected: null, notes: null });
  const txt = t => ({ ok: true, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: t }] }) });
  const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
  let queue = [], reqs = [];
  window.fetch = async (u, o) => { reqs.push({ url: u, headers: o.headers, body: JSON.parse(o.body) }); const q = queue.shift(); return typeof q === 'function' ? q() : q; };
  const photo = async (name) => { loadCount({ target: { files: [new File([PNG], name, { type: 'image/png' })] } }); await sleep(700); };
  try {
    window.confirm = () => true; localStorage.clear(); localStorage.setItem('claudeApiKey', 'sk-ant-test');
    loadProfile('8');

    ok('constantes: temperatura de producción 0', PRODUCTION_TEMPERATURE === 0 && samplingFor('claude-sonnet-4-6').temperature === 0);
    ok('el modelo experimental no lleva temperature', Object.keys(samplingFor('claude-sonnet-5-5')).length === 0);

    /* foto única: 1ª llamada + reintento */
    queue = [txt('sin json'), txt('{"total":40,"confidence":"media"}')]; reqs = [];
    await photo('a.png');
    ok('foto única: 1ª llamada y reintento llevan temperature:0', reqs.length === 2 && reqs.every(r => r.body.temperature === 0), reqs.map(r => r.body.temperature));
    ok('misma versión de API de siempre (2023-06-01): con 2026-10-21 el servidor daría 400', reqs.every(r => r.headers['anthropic-version'] === '2023-06-01'));
    ok('resto de parámetros intactos (modelo, max_tokens 600, mensajes)', reqs[0].body.model === 'claude-sonnet-4-6' && reqs[0].body.max_tokens === 600 && reqs[0].body.messages[0].content.some(b => b.type === 'image'));
    ok('el historial anota la temperatura usada', hist()[0].temp === 0);
    ok('el log la muestra', debugLogs.some(l => l === 'LLAMADA IA [foto única · 1ª llamada] modelo=claude-sonnet-4-6 temperature=0') && debugLogs.some(l => l === 'LLAMADA IA [foto única · reintento] modelo=claude-sonnet-4-6 temperature=0'));

    /* multifoto: 1ª llamada + reintento */
    multifotos.length = 0; reqs = []; queue = [txt('sin json'), txt('{"small":0,"medium":20,"large":0,"total":20,"confidence":"alta","notes":null}'), txt(J(22))];
    addPhotoToMultifoto('', 'AAAA', 'image/jpeg'); addPhotoToMultifoto('', 'BBBB', 'image/jpeg'); await sleep(600);
    ok('multifoto: las 3 llamadas (incluido un reintento) llevan temperature:0', reqs.length === 3 && reqs.every(r => r.body.temperature === 0), reqs.map(r => r.body.temperature));
    multifotos.length = 0; resetMulti();

    /* modelo experimental */
    experimentalModelOn = true; reqs = []; queue = [txt(J(41))];
    await photo('b.png');
    ok('experimental: la petición NO lleva temperature', reqs.length === 1 && !('temperature' in reqs[0].body) && reqs[0].body.model === 'claude-sonnet-5-5', reqs[0] && Object.keys(reqs[0].body));
    ok('y el historial lo anota como "por defecto" (null)', hist()[0].temp === null);
    ok('el log lo dice', debugLogs.some(l => l.includes('modelo=claude-sonnet-5-5 🧪 EXPERIMENTAL temperature=por defecto')));
    experimentalModelOn = false;

    /* el servidor rechaza temperature: se desactiva, se reintenta sin ella, la sesión sigue funcionando */
    reqs = []; debugLogs.length = 0;
    queue = [() => ({ ok: false, status: 400, json: async () => ({ type: 'error', error: { type: 'invalid_request_error', message: '`temperature` is not supported for this model' } }) }), txt(J(39)), txt(J(38))];
    await photo('c.png');
    ok('400 que menciona temperature: se reintenta la MISMA llamada sin temperature y el análisis termina bien', reqs.length === 2 && reqs[0].body.temperature === 0 && !('temperature' in reqs[1].body) && hist()[0].total === 39, reqs.map(r => r.body.temperature));
    ok('queda registrado en el log y en el estado de sesión', temperatureRejected === true && debugLogs.some(l => l.startsWith('⚠️ El servidor rechazó temperature (400)')));
    ok('el historial no afirma temperature:0 para ese análisis', hist()[0].temp === null, hist()[0].temp);
    reqs = []; await photo('d.png');
    ok('las llamadas siguientes ya no la envían (sin otro 400 ni reintento)', reqs.length === 1 && !('temperature' in reqs[0].body) && hist()[0].total === 38);
    ok('el log pasa a "temperature=por defecto"', debugLogs.some(l => l === 'LLAMADA IA [foto única · 1ª llamada] modelo=claude-sonnet-4-6 temperature=por defecto'));

    /* un 400 que NO habla de temperature no dispara la degradación */
    temperatureRejected = false; reqs = []; queue = [() => ({ ok: false, status: 400, json: async () => ({ error: { message: 'image too large' } }) })];
    await photo('e.png');
    ok('otro 400 (p. ej. imagen): se muestra el error y NO se toca temperature', reqs.length === 1 && temperatureRejected === false && /image too large/.test($('statusCount').textContent), $('statusCount').textContent);
    reqs = []; queue = [() => ({ ok: false, status: 429, json: async () => ({ error: { message: 'rate limit' } }) })];
    await photo('f.png');
    ok('un 429 tampoco', reqs.length === 1 && temperatureRejected === false && /rate limit/.test($('statusCount').textContent));
    reqs = []; queue = [() => ({ ok: false, status: 502, json: async () => { throw new SyntaxError('Unexpected token <'); } })];
    await photo('g.png');
    ok('error con cuerpo no JSON: mensaje HTTP legible en vez de "Unexpected token"', reqs.length === 1 && /HTTP 502/.test($('statusCount').textContent), $('statusCount').textContent);
  } catch (e) { R.push('EXC ' + (e && e.stack || e)); }
  const pre = document.createElement('pre'); pre.id = 'res'; pre.style.display = 'none';
  pre.textContent = 'TOTAL=' + R.length + ' PASS=' + R.filter(x => x.startsWith('PASS')).length + '\n' + R.join('\n');
  document.body.appendChild(pre); document.title = 'RES:done';
});

// SUITE: 07-v92-max-tokens-and-version
// v9.2: max_tokens 600 en las llamadas de conteo; version coherente entre topbar y splash
window.addEventListener('load', async () => {
  const R = [];
  const ok = (n, c, extra) => R.push((c ? 'PASS ' : 'FAIL ') + n + (extra !== undefined ? '  => ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = id => document.getElementById(id);
  const J = n => JSON.stringify({ small: 0, medium: n, large: 0, total: n, confidence: 'alta', overlap: false, size_match: true, size_detected: null, notes: null });
  try {
    window.confirm = () => true; localStorage.clear(); localStorage.setItem('claudeApiKey', 'sk-ant-test');
    const bodies = []; let queue = [];
    window.fetch = async (u, o) => { bodies.push(JSON.parse(o.body)); return { ok: true, json: async () => ({ stop_reason: 'end_turn', content: [{ text: queue.shift() }] }) }; };
    lastImageBase64 = 'iVBORw0KGgo='; lastImageMime = 'image/png'; $('cvCount').width = 100; $('cvCount').height = 100;
    loadProfile('8');
    queue = [J(40)]; await runCountAI();
    ok('foto única: max_tokens = 600', bodies.length === 1 && bodies[0].max_tokens === 600, bodies.map(b => b.max_tokens));
    queue = ['sin json', '{"total":40,"confidence":"media"}']; bodies.length = 0; await runCountAI();
    ok('foto única, reintento: max_tokens = 600 en ambas llamadas', bodies.length === 2 && bodies.every(b => b.max_tokens === 600), bodies.map(b => b.max_tokens));
    multifotos.length = 0; bodies.length = 0; queue = [J(20)];
    addPhotoToMultifoto('', 'AAAA', 'image/jpeg'); await sleep(200);
    ok('multifoto: max_tokens = 600', bodies.length === 1 && bodies[0].max_tokens === 600, bodies.map(b => b.max_tokens));
    ok('constante COUNT_MAX_TOKENS = 600', COUNT_MAX_TOKENS === 600);
    ok('versión coherente: VERSION = topbar = splash', document.querySelector('.ver').textContent.trim() === VERSION && document.body.innerHTML.includes('splash ' + VERSION), VERSION);
  } catch (e) { R.push('EXC ' + (e && e.stack || e)); }
  const pre = document.createElement('pre'); pre.id = 'res'; pre.style.display = 'none';
  pre.textContent = 'TOTAL=' + R.length + ' PASS=' + R.filter(x => x.startsWith('PASS')).length + '\n' + R.join('\n');
  document.body.appendChild(pre); document.title = 'RES:done';
});

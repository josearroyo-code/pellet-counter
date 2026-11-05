// SUITE: net-cv-integrity-offline
// v9.0 (RED): firma SHA-384, cache manipulada, carga offline desde Cache Storage, foto de prueba, aiTotal en ejemplos
// @timeout 240
// @net
window.addEventListener('load', async () => {
  const R = [];
  const ok = (n, c, extra) => R.push((c ? 'PASS ' : 'FAIL ') + n + (extra !== undefined ? '  => ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = id => document.getElementById(id);
  const until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(200); } return false; };
  const URL_LIB = 'https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.9.0-release.3/dist/opencv.js';
  try {
    window.confirm = () => true;
    localStorage.clear();
    localStorage.setItem('claudeApiKey', 'sk-ant-test');

    /* ── integridad: caché manipulada → no se ejecuta, se purga, se recupera ── */
    const cache = await caches.open('pellet-cv-lib');
    await cache.put(URL_LIB, new Response('self.postMessage({type:"ready"}); /* código manipulado */', { headers: { 'Content-Type': 'text/javascript' } }));
    cvLoad();
    await until(() => /No se pudo/.test($('cvStatus').textContent), 30000);
    ok('copia manipulada en caché: se rechaza por SHA-384', /SHA-384[^]*NO se ejecuta/.test($('cvStatus').textContent), $('cvStatus').textContent);
    ok('la copia manipulada se elimina de la caché', !(await cache.match(URL_LIB)));
    ok('el botón de carga vuelve a estar disponible', $('btnCvLoad').disabled === false && $('btnCvRun').disabled === true);
    cvLoad();
    await until(() => /listo/.test($('cvStatus').textContent), 120000);
    ok('reintento: descarga limpia y verifica', /listo \(descargado/.test($('cvStatus').textContent), $('cvStatus').textContent);

    /* ── 2ª carga desde la caché (simula uso sin conexión: se bloquea la red) ── */
    const realFetch = window.fetch;
    window.fetch = (u, o) => String(u).includes('jsdelivr') ? Promise.reject(new TypeError('offline')) : realFetch(u, o);
    /* workerReady está memoizado dentro del módulo: se recarga la página de pruebas con un iframe */
    const fr = document.createElement('iframe'); fr.style.display = 'none'; fr.src = location.href.replace(/\.html.*$/, '.b.html'); document.body.appendChild(fr);
    await until(() => { try { return fr.contentDocument && fr.contentDocument.title === 'IFR:done'; } catch (e) { return false; } }, 90000);
    const ifrText = fr.contentDocument ? fr.contentDocument.getElementById('res')?.textContent : '(sin iframe)';
    R.push('INFO iframe offline: ' + ifrText);
    ok('sin red: OpenCV se carga desde la caché local', /desde la caché local/.test(ifrText || ''), ifrText);
    window.fetch = realFetch;

    /* ── Fase 1 sin ejemplos: mensaje claro ── */
    cvRunExamples(); await sleep(300);
    ok('sin ejemplos guardados: mensaje claro, no falla', /No hay ejemplos guardados/.test($('cvResults').textContent));

    /* ── prueba con foto nueva ── */
    const c = document.createElement('canvas'); c.width = 400; c.height = 300; const g = c.getContext('2d');
    g.fillStyle = '#f0f0f0'; g.fillRect(0, 0, 400, 300); g.fillStyle = '#404040';
    let n = 0; for (let y = 40; y < 270; y += 50) for (let x = 40; x < 370; x += 50) { g.beginPath(); g.arc(x, y, 14, 0, 6.283); g.fill(); n++; }
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    cvTestPhoto({ target: { files: [new File([blob], 'rejilla.png', { type: 'image/png' })], value: '' } });
    await until(() => $('cvPhotoCanvas'), 20000);
    const t = $('cvPhotoResult').textContent.replace(/\s+/g, ' ');
    ok('foto nueva: cuenta y dibuja overlay', !!$('cvPhotoCanvas') && /Blobs \d+/.test(t), t.slice(0, 120));
    const blobsN = parseInt((t.match(/Blobs (\d+)/) || [])[1], 10);
    ok('rejilla de ' + n + ' discos: blobs exacto', blobsN === n, blobsN);
    $('cvPhotoTruth').value = String(n); cvPhotoDiff();
    ok('error vs conteo real mostrado', /Blobs \(área\) \+?0/.test($('cvPhotoDiff').textContent), $('cvPhotoDiff').textContent);

    /* ── saveAsExample guarda el conteo ORIGINAL de Claude (aiTotal) ── */
    const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), ch => ch.charCodeAt(0));
    window.fetch = async () => ({ ok: true, json: async () => ({ content: [{ text: JSON.stringify({ small: 0, medium: 41, large: 0, total: 41, confidence: 'alta', overlap: false, size_match: true, size_detected: null, notes: null }) }] }) });
    loadProfile('8');
    loadCount({ target: { files: [new File([PNG], 'p.png', { type: 'image/png' })] } });
    await until(() => JSON.parse(localStorage.getItem('analysisHistory') || '[]').length === 1, 10000);
    adjustCount && adjustCount(-1);   /* el usuario corrige 41 -> 40 */
    await sleep(100);
    await saveAsExample(); await sleep(300);
    const ex = JSON.parse(localStorage.getItem('referenceExamples') || '[]');
    ok('ejemplo guardado con total corregido (40) y aiTotal original (41)', ex.length === 1 && ex[0].total === 40 && ex[0].aiTotal === 41, ex[0] && { total: ex[0].total, aiTotal: ex[0].aiTotal });
  } catch (e) { R.push('EXC ' + (e && e.stack || e)); }
  const pre = document.createElement('pre'); pre.id = 'res'; pre.style.display = 'none';
  pre.textContent = 'TOTAL=' + R.length + ' PASS=' + R.filter(x => x.startsWith('PASS')).length + '\n' + R.join('\n');
  document.body.appendChild(pre);
  document.title = 'RES:done';
});

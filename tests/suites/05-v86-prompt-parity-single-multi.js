// SUITE: 05-v86-prompt-parity-single-multi
// v8.6: prompt y request identicos entre foto unica y multifoto (misma imagen, mismo few-shot), log de envio, contador por tamano
window.addEventListener('load', async () => {
  const R = [];
  const ok = (n, c, extra) => R.push((c ? 'PASS ' : 'FAIL ') + n + (extra !== undefined ? '  => ' + JSON.stringify(extra) : ''));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = id => document.getElementById(id);
  const hash = t => { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return h.toString(16) + ':' + t.length; };
  const J = (total, conf) => JSON.stringify({ small: 0, medium: total, large: 0, total, confidence: conf || 'alta', overlap: false, size_match: true, size_detected: null, notes: null });
  const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
  const mkFile = () => new File([PNG], 'p.png', { type: 'image/png' });
  const bodies = [];
  const textOf = b => { const c = JSON.parse(b).messages[0].content; return c.filter(x => x.type === 'text').pop().text; };
  const imgOf = b => { const c = JSON.parse(b).messages[0].content; return c.filter(x => x.type === 'image').pop().source; };
  try {
    window.confirm = () => true;
    localStorage.clear();
    localStorage.setItem('claudeApiKey', 'sk-ant-test');
    window.fetch = async (u, o) => { bodies.push(o.body); return { ok: true, json: async () => ({ content: [{ text: J(10) }] }) }; };

    /* sin ejemplos guardados */
    loadProfile('8');
    loadCount({ target: { files: [mkFile()] } }); await sleep(500);
    const singleBody = bodies[bodies.length - 1];
    const singlePrompt = textOf(singleBody);
    R.push('INFO single prompt hash ' + hash(singlePrompt));

    /* la MISMA imagen por la ruta de multifoto */
    multifotos.length = 0;
    addMultiFoto({ target: { files: [mkFile()], value: '' } }); await sleep(500);
    const multiBody = bodies[bodies.length - 1];
    const multiPrompt = textOf(multiBody);
    R.push('INFO multi prompt hash ' + hash(multiPrompt));

    if (typeof buildCountPrompt === 'function') {
      ok('multifoto = foto única + SOLO el aviso de condensadores', multiPrompt.replace(MULTI_ONLY_GUARD, '') === singlePrompt);
      ok('el prompt de multifoto ya no dice "uno de varios grupos"/"no asumas un rango"', !/varios grupos|no asumas|más o menos de los esperados/.test(multiPrompt));
      ok('multifoto conserva el aviso "NO condensadores"', multiPrompt.includes('NO condensadores cerámicos'));
      ok('foto única NO lleva el bloque IMPORTANTE de multifoto', !singlePrompt.includes('IMPORTANTE: Estás contando'));
    } else {
      R.push('INFO (app antigua: sin buildCountPrompt)');
      ok('app antigua: multifoto ≠ foto única', multiPrompt !== singlePrompt);
    }
    ok('MISMA imagen enviada (bytes idénticos) por ambas rutas', JSON.stringify(imgOf(singleBody)) === JSON.stringify(imgOf(multiBody)), { mime: imgOf(singleBody).media_type });
    const sb = JSON.parse(singleBody), mb = JSON.parse(multiBody);
    ok('mismo modelo y max_tokens', sb.model === mb.model && sb.max_tokens === mb.max_tokens, [sb.model, sb.max_tokens]);

    /* con ejemplos few-shot guardados: mismo nº de bloques y misma nota */
    const tiny = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z';
    const b64 = tiny.split(',')[1];
    localStorage.setItem('referenceExamples', JSON.stringify([{ size: '8', total: 41, mime: 'image/jpeg', image: b64 }, { size: '8', total: 38, mime: 'image/jpeg', image: b64 }]));
    const exN = getReferenceExamples().filter(e => e.size === '8').length;
    bodies.length = 0;
    loadProfile('8');
    loadCount({ target: { files: [mkFile()] } }); await sleep(500);
    multifotos.length = 0; debugLogs.length = 0;
    addMultiFoto({ target: { files: [mkFile()], value: '' } }); await sleep(500);
    const s2 = JSON.parse(bodies[0]).messages[0].content, m2 = JSON.parse(bodies[1]).messages[0].content;
    ok('few-shot: mismo nº de bloques de contenido en ambas rutas', s2.length === m2.length && s2.length > 2, [s2.length, m2.length, 'ejemplos 8mm=' + exN]);
    const t2s = s2.filter(x => x.type === 'text').pop().text, t2m = m2.filter(x => x.type === 'text').pop().text;
    ok('con ejemplos: misma nota few-shot y mismo prompt salvo el aviso', typeof buildCountPrompt !== 'function' ? true : (t2m.replace(MULTI_ONLY_GUARD, '') === t2s && t2s.includes('indicado por texto')));
    R.push('INFO hash single+ejemplos ' + hash(t2s) + ' | multi+ejemplos ' + hash(t2m));
    if (typeof buildCountPrompt === 'function') {
      ok('log "ENVÍO IA [multifoto]" presente', debugLogs.some(l => l.startsWith('ENVÍO IA [multifoto]: image/png') && l.includes('few-shot ' + Math.min(2, exN))), debugLogs.filter(l => l.startsWith('ENVÍO')));
      debugLogs.length = 0; lastImageBase64 = null;
      loadCount({ target: { files: [mkFile()] } }); await sleep(500);
      ok('log "ENVÍO IA [foto única]" presente y misma imagen/few-shot', debugLogs.some(l => /^ENVÍO IA \[foto única\]: image\/png, imagen \d+ car\. \(~[\d.]+ MB\), few-shot 2, prompt \d+ car\./.test(l)), debugLogs.filter(l => l.startsWith('ENVÍO')));
    }

    /* ── Parte 5: contador por tamaño ── */
    if (typeof recordConfidenceOutcome === 'function') {
      localStorage.removeItem('confidenceStats');
      bodies.length = 0;
      const resp = [];
      window.fetch = async () => ({ ok: true, json: async () => ({ content: [{ text: resp.shift() }] }) });
      const noConf = n => JSON.stringify({ small: 0, medium: n, large: 0, total: n, overlap: false, size_match: true, size_detected: null, notes: null });
      loadProfile('12'); resp.push(noConf(30)); lastImageBase64 = 'iVBORw0KGgo='; lastImageMime = 'image/png'; await runCountAI();
      loadProfile('12'); resp.push(J(30)); await runCountAI();
      loadProfile('8'); resp.push(J(40)); await runCountAI();
      loadProfile('4'); resp.push(noConf(50)); await runCountAI();
      loadProfile('8'); multifotos.length = 0; resp.push(noConf(20));
      addPhotoToMultifoto('', 'AAAA', 'image/jpeg'); await sleep(200);
      const st = JSON.parse(localStorage.getItem('confidenceStats'));
      ok('bySize correcto', JSON.stringify(st.bySize) === JSON.stringify({ '12': { total: 2, missing: 1 }, '8': { total: 2, missing: 1 }, '4': { total: 1, missing: 1 } }), st.bySize);
      renderStats();
      const t = $('confStatsInfo').textContent.replace(/\s+/g, ' ');
      ok('UI: "Por tamaño" con los 3 tamaños', t.includes('Por tamaño') && t.includes('4mm 1/1 (100%)') && t.includes('8mm 1/2 (50%)') && t.includes('12mm 1/2 (50%)'), t);
      ok('sin aviso de "previos" cuando todo tiene tamaño', !t.includes('previos a v8.6'));
      /* datos antiguos (sin bySize) */
      localStorage.setItem('confidenceStats', JSON.stringify({ single: { total: 12, missing: 2, viaRetry: 1 }, multi: { total: 0, missing: 0 }, since: '5/10/2026' }));
      renderStats();
      const t2 = $('confStatsInfo').textContent.replace(/\s+/g, ' ');
      ok('datos pre-v8.6: sigue mostrando totales y no rompe', t2.includes('2 de 12 análisis (17%)') && !t2.includes('Por tamaño'), t2);
      resp.push(J(10)); loadProfile('8'); await runCountAI();
      const t3 = (renderStats(), $('confStatsInfo').textContent.replace(/\s+/g, ' '));
      ok('mezcla: avisa de los análisis previos sin tamaño', t3.includes('Por tamaño') && t3.includes('12 análisis previos a v8.6'), t3);
    }
  } catch (e) { R.push('EXC ' + (e && e.stack || e)); }
  document.title = 'RES:' + encodeURIComponent('TOTAL=' + R.length + ' PASS=' + R.filter(x => x.startsWith('PASS')).length + '\n' + R.filter(x => !x.startsWith('PASS')).join('\n'));
});

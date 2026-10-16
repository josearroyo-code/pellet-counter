/* ══════════════════════════════════════════════════════════════
   EXPERIMENTAL — visión por computador clásica con OpenCV.js (v9.0)
   Investigación: NO toca ningún conteo ni el flujo normal de la app.

   Qué hace: cuenta pellets SIN IA, con umbralización (Otsu) +
   (a) cv.HoughCircles y (b) área de blobs / área de un pellet aislado,
   y compara con el conteo verificado de los ejemplos guardados y con el
   error histórico de Claude Vision, tamaño por tamaño.

   Decisiones de diseño (y por qué):
   - OpenCV.js (≈10 MB) NO se carga con la app: solo al pulsar el botón.
     Se descarga de jsDelivr (versión fija, con CORS), se verifica su
     SHA-384 antes de ejecutarlo y se guarda en Cache Storage para
     funcionar sin conexión. (docs.opencv.org no envía CORS, así que no
     se podría verificar la integridad desde la página.)
   - Corre dentro de un Web Worker creado desde un Blob: un Worker NO
     tiene localStorage, así que una librería de terceros no puede leer
     la API key de Claude ni el historial, que viven en localStorage.
   - El radio del pellet NO es fijo por perfil (4/8/12mm): la distancia
     cámara-pellet cambia entre fotos, y los ejemplos no guardan escala.
     Se estima POR IMAGEN a partir de los blobs aislados (y se devuelve
     para poder revisarlo); el rango de Hough es [0.75r, 1.3r].
   - Hough se evalúa con varios umbrales de acumulador (param2) porque es
     el parámetro más sensible. Se expresan como % de la circunferencia
     (2πr) y no como votos fijos: así escalan con el radio estimado de
     cada foto (con votos fijos, 4mm y 12mm tendrían exigencias muy
     distintas y la comparación por tamaño quedaría confundida).
   - Se añade un 2º estimador (área de blobs) que no se pidió: Hough se
     degrada con pellets solapados y conviene tener una referencia.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CV_LIB_URL = 'https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.9.0-release.3/dist/opencv.js';
  const CV_LIB_SHA384 = 'i0aokRC/FHyybXeYNiEdEj+j/sZBWuQjZLgZSjydZL+Wq7uQeNsmJ2Jv5XOjshzx';
  const CV_CACHE = 'pellet-cv-lib';   /* sw.js la respeta al limpiar cachés viejas */
  const CV_MAX_SIDE = 1280;           /* las fotos grandes se reducen antes de procesar */
  const HOUGH_PCT = [30, 45, 60, 75];   /* ver PCT en el worker */
  const METHODS = [
    { key: 'blobs', label: 'Blobs (área)' },
    ...HOUGH_PCT.map(p => ({ key: 'h' + p, label: 'Hough ' + p + '%' }))
  ];
  const $ = id => document.getElementById(id);

  /* ───────────── Worker (se serializa con toString y se concatena a OpenCV.js) ───────────── */
  function cvWorkerMain() {
    const PCT = [30, 45, 60, 75];   /* umbral del acumulador como % de la circunferencia (2πr) */
    function median(a) {
      if (!a.length) return 0;
      const s = a.slice().sort((x, y) => x - y), m = s.length >> 1;
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    }
    function errText(e) {
      if (typeof e === 'number' && self.cv && cv.exceptionFromPtr) { try { return 'OpenCV: ' + cv.exceptionFromPtr(e).msg; } catch (x) { /* nada */ } }
      return String((e && e.message) || e);
    }
    async function init() {
      if (typeof cv === 'undefined') throw new Error('cv no definido tras cargar la librería');
      if (!cv.Mat) {
        await new Promise((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('OpenCV no terminó de inicializar (timeout 60 s)')), 60000);
          if (typeof cv.then === 'function') cv.then(m => { if (m && m.Mat) self.cv = m; clearTimeout(t); resolve(); });
          else cv.onRuntimeInitialized = () => { clearTimeout(t); resolve(); };
        });
      }
    }

    function analyze(msg) {
      const w = msg.w, h = msg.h, t0 = Date.now();
      const del = [];
      const keep = o => { del.push(o); return o; };
      try {
        const src = keep(new cv.Mat(h, w, cv.CV_8UC4));
        src.data.set(new Uint8Array(msg.buf));
        const gray = keep(new cv.Mat());
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        const blur = keep(new cv.Mat());
        cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);

        /* Polaridad: el fondo es lo que domina el borde de la foto. */
        const gd = blur.data, band = Math.max(2, Math.round(Math.min(w, h) * 0.04)), border = [];
        for (let y = 0; y < h; y++) {
          const full = y < band || y >= h - band;
          for (let x = 0; x < w; x++) if (full || x < band || x >= w - band) border.push(gd[y * w + x]);
        }
        const bgBright = median(border) >= cv.mean(blur)[0];

        const bin = keep(new cv.Mat());
        cv.threshold(blur, bin, 0, 255, (bgBright ? cv.THRESH_BINARY_INV : cv.THRESH_BINARY) | cv.THRESH_OTSU);
        const k3 = keep(cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3)));
        cv.morphologyEx(bin, bin, cv.MORPH_OPEN, k3);

        const minArea = Math.max(20, 0.00005 * w * h);
        function contoursOf(mask) {
          const cs = keep(new cv.MatVector()), hier = keep(new cv.Mat());
          cv.findContours(mask, cs, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
          const list = [];
          for (let i = 0; i < cs.size(); i++) {
            const c = cs.get(i), area = cv.contourArea(c), per = cv.arcLength(c, true);
            list.push({ i, area, circ: per > 0 ? 4 * Math.PI * area / (per * per) : 0 });
            c.delete();
          }
          return { cs, list };
        }
        function fill(c) {
          const m = keep(cv.Mat.zeros(h, w, cv.CV_8UC1));
          c.list.forEach(it => { if (it.area >= minArea) cv.drawContours(m, c.cs, it.i, new cv.Scalar(255), -1); });
          return m;
        }
        /* radio por imagen: mediana del área de los blobs redondos y aislados */
        function isolatedArea(list) {
          const cand = list.filter(it => it.area >= minArea * 2 && it.area <= 0.2 * w * h && it.circ >= 0.8).map(it => it.area);
          if (cand.length < 3) return null;
          const m1 = median(cand), inl = cand.filter(a => a >= 0.5 * m1 && a <= 1.6 * m1);
          return inl.length >= 3 ? median(inl) : m1;
        }

        /* pasada 1: rellenar reflejos (agujeros) y estimar el radio */
        const c1 = contoursOf(bin), filled1 = fill(c1);
        const c1b = contoursOf(keep(filled1.clone()));
        let A = isolatedArea(c1b.list), rSource = 'aislados';
        let r0 = A ? Math.sqrt(A / Math.PI) : 0;
        /* pasada 2: quitar el hilo fino (apertura con ≈0.6 de radio) y reestimar */
        let clean = filled1;
        if (r0 >= 3) {
          const d = Math.max(3, 2 * Math.round(r0 * 0.3) + 1);
          const kw = keep(cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(d, d)));
          clean = keep(new cv.Mat());
          cv.morphologyEx(filled1, clean, cv.MORPH_OPEN, kw);
        }
        const c2 = contoursOf(keep(clean.clone()));
        const A2 = isolatedArea(c2.list);
        if (A2) A = A2;
        let rEst = A ? Math.sqrt(A / Math.PI) : 0;
        if (!A) { /* sin blobs aislados suficientes: radio inscrito (distancia) */
          rSource = 'distancia';
          const dt = keep(new cv.Mat());
          cv.distanceTransform(clean, dt, cv.DIST_L2, 5);
          const mx = [];
          c2.list.filter(it => it.area >= minArea).forEach(it => {
            const c = c2.cs.get(it.i), rect = cv.boundingRect(c); c.delete();
            const roi = dt.roi(rect), mm = cv.minMaxLoc(roi); roi.delete(); mx.push(mm.maxVal);
          });
          rEst = median(mx); A = Math.PI * rEst * rEst;
        }
        if (!(rEst >= 2)) throw new Error('no se pudo estimar el radio del pellet (¿hay pellets visibles?)');

        /* (b) blobs: un componente vale round(área / área de un pellet) */
        let blobs = 0;
        c2.list.forEach(it => { if (it.area >= 0.4 * A) blobs += Math.max(1, Math.round(it.area / A)); });

        /* (a) Hough con radio estimado; solo se cuentan círculos centrados en primer plano */
        const minR = Math.max(2, Math.round(0.75 * rEst)), maxR = Math.max(minR + 1, Math.round(1.3 * rEst));
        const minDist = Math.max(3, 1.3 * rEst);
        const hough = {}, houghRaw = {};
        let overlayCircles = [];
        const p2Used = {};
        PCT.forEach(pct => {
          /* param2 de Hough = votos mínimos; un círculo completo da ≈2πr votos, así que el umbral
             se expresa como % de la circunferencia y escala con el radio estimado de CADA foto
             (con p2 fijo, 4mm y 12mm serían umbrales de exigencia muy distinta). */
          const p2 = Math.max(4, Math.round(pct / 100 * 2 * Math.PI * rEst)); p2Used['h' + pct] = p2;
          const circles = keep(new cv.Mat());
          cv.HoughCircles(blur, circles, cv.HOUGH_GRADIENT, 1, minDist, 100, p2, minR, maxR);
          let n = 0; const keepList = [];
          for (let j = 0; j < circles.cols; j++) {
            const x = circles.data32F[j * 3], y = circles.data32F[j * 3 + 1], r = circles.data32F[j * 3 + 2];
            const xi = Math.min(w - 1, Math.max(0, Math.round(x))), yi = Math.min(h - 1, Math.max(0, Math.round(y)));
            if (clean.ucharPtr(yi, xi)[0] > 0) { n++; keepList.push([x, y, r]); }
          }
          hough['h' + pct] = n; houghRaw['h' + pct] = circles.cols;
          if (pct === 45) overlayCircles = keepList;
        });

        /* overlay para revisar a ojo: contorno de blobs en amarillo, círculos de Hough (45%) en verde */
        const over = keep(src.clone());
        for (let i = 0; i < c2.cs.size(); i++) {
          if (c2.list[i] && c2.list[i].area >= minArea) cv.drawContours(over, c2.cs, i, new cv.Scalar(255, 220, 0, 255), 1);
        }
        overlayCircles.forEach(c => cv.circle(over, new cv.Point(Math.round(c[0]), Math.round(c[1])), Math.max(1, Math.round(c[2])), new cv.Scalar(0, 255, 0, 255), 2));
        const buf = over.data.slice().buffer;
        return {
          rEst, rSource, bgBright, nComp: c2.list.filter(it => it.area >= minArea).length,
          counts: Object.assign({ blobs }, hough), houghRaw, p2Used,
          w, h, overlay: buf, ms: Date.now() - t0
        };
      } finally {
        del.forEach(o => { try { o.delete(); } catch (e) { /* ya liberado */ } });
      }
    }

    self.onmessage = async ev => {
      const m = ev.data;
      if (m.type === 'init') {
        try { await init(); self.postMessage({ type: 'ready' }); }
        catch (e) { self.postMessage({ type: 'error', message: errText(e) }); }
      } else if (m.type === 'analyze') {
        try { const r = analyze(m); r.type = 'result'; r.id = m.id; self.postMessage(r, [r.overlay]); }
        catch (e) { self.postMessage({ type: 'result', id: m.id, error: errText(e) }); }
      }
    };
  }

  /* ───────────── Carga de la librería (descarga + SHA-384 + caché) ───────────── */
  let worker = null, workerReady = null, jobId = 0;
  const pending = new Map();

  function status(msg, kind) {
    const el = $('cvStatus'); if (!el) return;
    el.textContent = msg;
    el.style.color = kind === 'err' ? 'var(--red)' : kind === 'ok' ? 'var(--green)' : 'var(--muted)';
  }

  async function fetchLib() {
    const cache = ('caches' in window) ? await caches.open(CV_CACHE) : null;
    let res = cache ? await cache.match(CV_LIB_URL) : null;
    const cached = !!res;
    if (!res) {
      status('Descargando OpenCV.js (≈10 MB)…');
      res = await fetch(CV_LIB_URL, { mode: 'cors', credentials: 'omit' });
      if (!res.ok) throw new Error('descarga fallida: HTTP ' + res.status);
    }
    const buf = await res.arrayBuffer();
    status('Verificando integridad (SHA-384)…');
    if (!(window.crypto && crypto.subtle)) throw new Error('crypto.subtle no disponible (hace falta HTTPS) — no se ejecuta código sin verificar');
    const d = new Uint8Array(await crypto.subtle.digest('SHA-384', buf));
    let bin = ''; d.forEach(b => { bin += String.fromCharCode(b); });
    if (btoa(bin) !== CV_LIB_SHA384) {
      if (cache && cached) await cache.delete(CV_LIB_URL);
      throw new Error('la firma SHA-384 de OpenCV.js no coincide con la esperada — NO se ejecuta');
    }
    if (cache && !cached) { try { await cache.put(CV_LIB_URL, new Response(buf.slice(0), { headers: { 'Content-Type': 'text/javascript' } })); } catch (e) { /* sin espacio: no pasa nada */ } }
    return { buf, cached };
  }

  function loadLib() {
    if (workerReady) return workerReady;
    workerReady = (async () => {
      const { buf, cached } = await fetchLib();
      status('Iniciando OpenCV en un Worker aislado…');
      const blob = new Blob([new Uint8Array(buf), '\n;(', cvWorkerMain.toString(), ')();'], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);
      worker = new Worker(url);
      worker.onmessage = ev => {
        const m = ev.data;
        if (m.type === 'result') { const p = pending.get(m.id); if (p) { pending.delete(m.id); m.error ? p.reject(new Error(m.error)) : p.resolve(m); } }
      };
      worker.onerror = ev => { pending.forEach(p => p.reject(new Error('error del worker: ' + (ev.message || '')))); pending.clear(); };
      await new Promise((resolve, reject) => {
        const prev = worker.onmessage;
        worker.onmessage = ev => {
          if (ev.data.type === 'ready') { worker.onmessage = prev; resolve(); }
          else if (ev.data.type === 'error') reject(new Error(ev.data.message));
        };
        worker.postMessage({ type: 'init' });
      });
      URL.revokeObjectURL(url);
      return cached;
    })();
    workerReady.catch(() => { workerReady = null; if (worker) { worker.terminate(); worker = null; } });
    return workerReady;
  }

  window.cvLoad = async function () {
    const btn = $('btnCvLoad'); if (btn) btn.disabled = true;
    try {
      const cached = await loadLib();
      status(`✓ OpenCV.js listo${cached ? ' (desde la caché local)' : ' (descargado y guardado para uso sin conexión)'}`, 'ok');
      ['btnCvRun', 'btnCvPhoto'].forEach(id => { const b = $(id); if (b) b.disabled = false; });
      if (btn) btn.style.display = 'none';
    } catch (err) {
      console.error('cvLoad falló:', err && err.message);
      status('✗ No se pudo cargar OpenCV.js: ' + (err && err.message), 'err');
      if (btn) btn.disabled = false;
    }
  };

  /* ───────────── Análisis de una imagen ───────────── */
  function imageToData(src) {  /* src: dataURL → {w,h,buf} reducido a CV_MAX_SIDE */
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, CV_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);
        const id = ctx.getImageData(0, 0, w, h);
        resolve({ w, h, buf: id.data.buffer, origW: img.naturalWidth, origH: img.naturalHeight });
      };
      img.onerror = () => reject(new Error('no se pudo decodificar la imagen'));
      img.src = src;
    });
  }
  function analyzeImage(dataUrl) {
    return imageToData(dataUrl).then(d => new Promise((resolve, reject) => {
      const id = ++jobId;
      const t = setTimeout(() => { pending.delete(id); reject(new Error('timeout (120 s)')); }, 120000);
      pending.set(id, { resolve: r => { clearTimeout(t); r.origW = d.origW; r.origH = d.origH; resolve(r); }, reject: e => { clearTimeout(t); reject(e); } });
      worker.postMessage({ type: 'analyze', id, w: d.w, h: d.h, buf: d.buf }, [d.buf]);
    }));
  }
  function drawOverlay(canvas, r) {
    canvas.width = r.w; canvas.height = r.h;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(r.overlay), r.w, r.h), 0, 0);
  }

  /* ───────────── Fase 1: comparación retrospectiva con los ejemplos guardados ───────────── */
  const sizeKey = e => (e.size === '4' || e.size === '8' || e.size === '12') ? e.size : null;
  let lastRun = null;

  /* Error histórico de Claude por tamaño (solo fotos únicas): |aiTotal − total| sobre TODOS los
     análisis, no solo los corregidos. Si el usuario no corrigió, se asume que acertó. */
  function claudeHistoryBySize() {
    /* v9.1: mismo filtro que "Estado del entrenamiento": SOLO foto única (los ejemplos son fotos
       únicas) y el PERIODO elegido en Ajustes (por defecto, desde la línea base) — así la
       comparación con CV no mezcla pruebas anteriores a los arreglos. */
    const out = { '4': [], '8': [], '12': [] };
    const by = window.statsHistoryEntries({ kind: 'single' });
    ['4', '8', '12'].forEach(s => by[s].forEach(e => out[s].push(e.aiTotal - e.total)));
    return out;
  }
  function claudeScopeText() {
    const base = new Date(window.getStatsBaseline()).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return window.getStatsScope() === 'baseline' ? `desde la línea base (${base}), solo foto única` : 'todo el historial, solo foto única';
  }
  function stats(errs) {
    if (!errs.length) return null;
    const n = errs.length, abs = errs.map(Math.abs);
    return { n, mae: abs.reduce((a, b) => a + b, 0) / n, bias: errs.reduce((a, b) => a + b, 0) / n, within1: abs.filter(a => a <= 1).length, within2: abs.filter(a => a <= 2).length };
  }
  const f1 = x => (Math.round(x * 10) / 10).toString();
  const sgn = x => (x > 0 ? '+' : '') + f1(x);

  window.cvRunExamples = async function () {
    const box = $('cvResults'), btn = $('btnCvRun');
    let ex = []; try { ex = JSON.parse(localStorage.getItem('referenceExamples') || '[]'); } catch (e) { /* vacío */ }
    ex = ex.filter(e => e.image && e.total > 0 && sizeKey(e));
    if (!ex.length) { box.innerHTML = '<div class="tip">No hay ejemplos guardados con tamaño (4/8/12mm). Guarda alguno con "Guardar como ejemplo" tras un conteo verificado.</div>'; return; }
    btn.disabled = true;
    const rows = [];
    try {
      for (let i = 0; i < ex.length; i++) {
        const e = ex[i];
        status(`Analizando ejemplo ${i + 1} de ${ex.length}…`);
        try {
          const r = await analyzeImage(`data:${e.mime || 'image/jpeg'};base64,${e.image}`);
          rows.push({ id: e.id, size: e.size, date: e.date, truth: e.total, claude: (typeof e.aiTotal === 'number' ? e.aiTotal : null), r });
        } catch (err) { rows.push({ id: e.id, size: e.size, date: e.date, truth: e.total, error: err.message }); }
      }
      lastRun = rows;
      status(`✓ ${rows.filter(x => !x.error).length}/${rows.length} ejemplos analizados`, 'ok');
      renderResults(rows);
    } finally { btn.disabled = false; }
  };

  function renderResults(rows) {
    const box = $('cvResults'), claude = claudeHistoryBySize();
    const sizes = ['4', '8', '12'];
    const th = 'padding:4px 6px;text-align:left;border-bottom:1px solid var(--border2);font-size:11px';
    const td = 'padding:4px 6px;border-top:0.5px solid var(--border);font-size:11px';
    let html = `<div style="font-size:12px;font-weight:700;margin:12px 0 6px">Error de conteo por método (estimado − verificado)</div>
      <div style="font-size:11px;color:var(--hint);margin-bottom:6px">Formato: error absoluto medio (sesgo) · aciertos ±2 / n. Menor error absoluto = mejor. <b>Cada columna es un tamaño independiente: no hay ningún promedio combinado</b> (los tamaños tienen muy distinto nº de muestras). * = menos de 5 muestras, poco fiable.</div>
      <div style="overflow-x:auto"><table style="border-collapse:collapse;min-width:300px;width:100%"><thead><tr><th style="${th}">Método</th>${sizes.map(s => `<th style="${th}">${s}mm <span style="font-weight:400;color:var(--hint)">(${rows.filter(x => x.size === s && !x.error).length} ejemplos)</span></th>`).join('')}</tr></thead><tbody>`;
    const cell = st => st ? `<b>${f1(st.mae)}</b> (${sgn(st.bias)}) · ${st.within2}/${st.n}${st.n < 5 ? ' <span style="color:var(--orange)">*</span>' : ''}` : '<span style="color:var(--hint)">—</span>';
    const per = {};
    METHODS.forEach(m => {
      sizes.forEach(s => { per[m.key + s] = stats(rows.filter(x => x.size === s && !x.error).map(x => x.r.counts[m.key] - x.truth)); });
      html += `<tr><td style="${td}">${m.label}</td>${sizes.map(s => `<td style="${td}">${cell(per[m.key + s])}</td>`).join('')}</tr>`;
    });
    const cl = {}; sizes.forEach(s => { cl[s] = stats(claude[s]); });
    html += `<tr><td style="${td};color:var(--blue);font-weight:700">Claude (historial, ${claudeScopeText()})</td>${sizes.map(s => `<td style="${td}">${cell(cl[s])}</td>`).join('')}</tr></tbody></table></div>
      <div style="font-size:11px;color:var(--hint);line-height:1.5;margin:6px 0 10px">«Claude (historial)» = tus fotos únicas de ese tamaño en el Historial dentro del periodo elegido en Ajustes → Estado del entrenamiento (no exactamente las mismas fotos de los ejemplos: los ejemplos no guardaban el conteo original de Claude; los guardados desde v9.0 sí). Si no corregiste un conteo se asume que acertó. Los ejemplos están reducidos a ≤400 px, lo que penaliza sobre todo a 4mm.</div>`;
    /* tarjetas por ejemplo */
    html += '<div style="font-size:12px;font-weight:700;margin:6px 0">Revisión visual (amarillo = contornos de blobs · verde = círculos de Hough 45%)</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">';
    rows.forEach((x, i) => {
      if (x.error) { html += `<div style="background:var(--surface2);border-radius:8px;padding:6px;font-size:11px"><b>${x.size}mm</b> · real ${x.truth}<br><span style="color:var(--red)">✗ ${x.error}</span></div>`; return; }
      const c = x.r.counts, lowRes = x.r.rEst < 5;
      html += `<div style="background:var(--surface2);border-radius:8px;padding:6px;font-size:11px;line-height:1.5">
        <canvas id="cvThumb${i}" style="width:100%;border-radius:6px;background:#000"></canvas>
        <b>${x.size}mm</b> · real <b>${x.truth}</b>${x.claude != null ? ` · Claude ${x.claude}` : ''}<br>
        Blobs ${c.blobs} (${sgn(c.blobs - x.truth)}) · H45 ${c.h45} (${sgn(c.h45 - x.truth)})<br>
        <span style="color:var(--hint)">r≈${f1(x.r.rEst)}px (${x.r.rSource})${lowRes ? ' · <span style="color:var(--orange)">resolución baja</span>' : ''}</span></div>`;
    });
    html += '</div><button onclick="cvCopyResults()" style="width:100%;justify-content:center;margin-top:12px">📋 Copiar resultados (JSON)</button>';
    box.innerHTML = html;
    rows.forEach((x, i) => { if (!x.error) drawOverlay($('cvThumb' + i), x.r); });
  }

  window.cvCopyResults = function () {
    if (!lastRun) return;
    const claude = claudeHistoryBySize();
    const out = {
      version: (typeof VERSION !== 'undefined' ? VERSION : null), lib: CV_LIB_URL, maxSide: CV_MAX_SIDE,
      examples: lastRun.map(x => x.error ? { size: x.size, truth: x.truth, error: x.error } : { size: x.size, truth: x.truth, claudeAI: x.claude, rEstPx: Math.round(x.r.rEst * 10) / 10, rSource: x.r.rSource, bgBright: x.r.bgBright, components: x.r.nComp, counts: x.r.counts, houghRawBeforeMask: x.r.houghRaw, houghParam2: x.r.p2Used, imgPx: [x.r.w, x.r.h], ms: x.r.ms }),
      claudeHistoryErrors: claude,
      claudeHistoryScope: claudeScopeText()
    };
    navigator.clipboard.writeText(JSON.stringify(out, null, 1)).then(() => { if (window.showToast) showToast('Resultados copiados ✓'); });
  };

  /* ───────────── Probar con una foto nueva (no se guarda nada) ───────────── */
  window.cvPickPhoto = function () { $('cvPhotoInput').click(); };
  window.cvTestPhoto = async function (ev) {
    const f = ev.target.files[0]; if (!f) return;
    const box = $('cvPhotoResult'); box.innerHTML = '<div style="font-size:12px;color:var(--muted)">Analizando…</div>';
    try {
      const url = await new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(rd.result); rd.onerror = () => rej(new Error('lectura')); rd.readAsDataURL(f); });
      const r = await analyzeImage(url), c = r.counts;
      box.innerHTML = `<canvas id="cvPhotoCanvas" style="width:100%;border-radius:8px;background:#000;margin:8px 0"></canvas>
        <div style="font-size:12px;line-height:1.7">Blobs <b>${c.blobs}</b> · ${HOUGH_PCT.map(p => `H${p}% <b>${c['h' + p]}</b>`).join(' · ')}<br>
        <span style="color:var(--hint)">r≈${f1(r.rEst)} px (${r.rSource}) · ${r.nComp} componentes · ${r.ms} ms · imagen ${r.w}×${r.h}</span></div>
        <label style="font-size:12px;color:var(--muted);display:block;margin-top:6px">Conteo real (opcional): <input type="number" id="cvPhotoTruth" style="width:80px;min-height:32px;padding:4px" oninput="cvPhotoDiff()"></label>
        <div id="cvPhotoDiff" style="font-size:12px;margin-top:4px"></div>`;
      drawOverlay($('cvPhotoCanvas'), r);
      window._cvPhotoCounts = c;
    } catch (err) { box.innerHTML = `<div style="color:var(--red);font-size:12px">✗ ${err.message}</div>`; }
    ev.target.value = '';
  };
  window.cvPhotoDiff = function () {
    const t = parseInt($('cvPhotoTruth').value, 10), c = window._cvPhotoCounts; if (!c || !(t >= 0)) { $('cvPhotoDiff').textContent = ''; return; }
    $('cvPhotoDiff').textContent = 'Error: ' + METHODS.map(m => `${m.label} ${sgn(c[m.key] - t)}`).join(' · ');
  };
})();

/* ── estado global ───────────────────────────────────────── */
let cvReady = false;
let imgCount = null, imgCalib = null;
let runTimer  = null;
let coinMm    = 23.25;
let calibScale = null, calibThresholds = null, clickPx = null;
let counts = { c4: 0, c8: 0, c12: 0 };

/* ── esperar OpenCV ──────────────────────────────────────── */
const cvCheck = setInterval(() => {
  if (typeof cv !== 'undefined' && cv.Mat) {
    clearInterval(cvCheck);
    cvReady = true;
    qs('#cv-status').style.display = 'none';
    if (imgCount) runCount();
  }
}, 300);

/* ── utilidades ──────────────────────────────────────────── */
const qs  = s => document.querySelector(s);
const qsa = s => document.querySelectorAll(s);

function setStatus(id, msg) {
  const el = qs('#' + id);
  if (!el) return;
  el.style.display = 'block';
  el.textContent   = msg;
}

/* ── tabs ────────────────────────────────────────────────── */
window.switchTab = function(name) {
  qsa('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  qsa('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
};

/* ── calibración: moneda ─────────────────────────────────── */
window.selectCoin = function(el, mm) {
  qsa('.coin-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  coinMm = mm;
  qs('#customMm').value = '';
  if (imgCalib && clickPx) computeScale();
};

window.customCoin = function(v) {
  const f = parseFloat(v);
  if (f > 0) {
    coinMm = f;
    qsa('.coin-btn').forEach(b => b.classList.remove('selected'));
    if (imgCalib && clickPx) computeScale();
  }
};

/* ── carga imagen CONTAR ─────────────────────────────────── */
window.loadCount = function(e) {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = ev => {
    imgCount = new Image();
    imgCount.onload = () => {
      qs('#wrapCount').style.display = 'block';
      qs('#btnRecount').style.display = '';
      if (cvReady) runCount(); else setStatus('statusCount', 'Cargando motor OpenCV…');
    };
    imgCount.src = ev.target.result;
  };
  r.readAsDataURL(f);
};

window.rerun = function() {
  if (!imgCount || !cvReady) return;
  clearTimeout(runTimer);
  runTimer = setTimeout(runCount, 280);
};

function getThresholds() {
  return calibThresholds || { t4: 22, t8: 45, t12: 85 };
}

/* ── detección principal ─────────────────────────────────── */
window.runCount = function() {
  if (!imgCount || !cvReady) return;
  setStatus('statusCount', 'Procesando…');

  const canvas = qs('#cvCount');
  const maxW   = Math.min(window.innerWidth - 32, 720);
  let w = imgCount.naturalWidth, h = imgCount.naturalHeight;
  if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(imgCount, 0, 0, w, h);

  const th   = getThresholds();
  const p1   = parseInt(qs('#p1').value);
  const minR = parseInt(qs('#p2').value);
  const maxR = parseInt(qs('#p3').value);
  const minD = parseInt(qs('#p4').value);

  try {
    let src = cv.imread(canvas), gray = new cv.Mat(), blurred = new cv.Mat(), circles = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(9, 9), 2, 2, cv.BORDER_DEFAULT);
    cv.HoughCircles(blurred, circles, cv.HOUGH_GRADIENT, 1, minD, p1 * 2, p1, minR, maxR);

    let c4 = 0, c8 = 0, c12 = 0, cO = 0;
    for (let i = 0; i < circles.cols; i++) {
      const x = Math.round(circles.data32F[i * 3]);
      const y = Math.round(circles.data32F[i * 3 + 1]);
      const r = Math.round(circles.data32F[i * 3 + 2]);
      let col;
      if      (r <= th.t4)  { c4++;  col = [24, 95, 165, 255]; }
      else if (r <= th.t8)  { c8++;  col = [15, 110, 86, 255]; }
      else if (r <= th.t12) { c12++; col = [153, 60, 29, 255]; }
      else                  { cO++;  col = [136, 135, 128, 255]; }
      cv.circle(src, new cv.Point(x, y), r, col, 2);
      cv.circle(src, new cv.Point(x, y), 3, col, -1);
    }
    cv.imshow(canvas, src);
    src.delete(); gray.delete(); blurred.delete(); circles.delete();

    counts = { c4, c8, c12 };
    qs('#c4').textContent  = c4;
    qs('#c8').textContent  = c8;
    qs('#c12').textContent = c12;
    qs('#cT').textContent  = c4 + c8 + c12;
    qs('#resultsCount').style.display = 'block';
    qs('#exportBox').style.display    = 'block';
    buildOdoo();

    const extra = cO > 0 ? ` · ${cO} fuera de rango` : '';
    setStatus('statusCount', `${c4 + c8 + c12 + cO} círculos detectados${extra} · azul=4mm · verde=8mm · naranja=12mm`);
  } catch (err) {
    setStatus('statusCount', 'Error: ' + err.message);
  }
};

/* ── exportación Odoo ────────────────────────────────────── */
window.buildOdoo = function() {
  const prov  = qs('#exProveedor').value || '—';
  const po    = qs('#exPO').value        || '—';
  const pref  = qs('#exLote').value      || 'P';
  const ubic  = qs('#exUbic').value      || 'WH/Stock';
  const now   = new Date();
  const fecha = now.toLocaleDateString('es-ES');
  const hora  = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const seq   = Math.floor(Math.random() * 900) + 100;
  const pad   = n => String(n).padStart(3, '0');

  const lines = [
    '=== RECEPCIÓN DE PELLETS ===',
    `Fecha:       ${fecha}  ${hora}`,
    `Proveedor:   ${prov}`,
    `PO:          ${po}`,
    `Ubicación:   ${ubic}`,
    '---',
    `Pellet  4mm  |  Lote: ${pref}-4MM-${pad(seq)}    |  Cant: ${counts.c4}`,
    `Pellet  8mm  |  Lote: ${pref}-8MM-${pad(seq+1)}  |  Cant: ${counts.c8}`,
    `Pellet 12mm  |  Lote: ${pref}-12MM-${pad(seq+2)} |  Cant: ${counts.c12}`,
    '---',
    `Total:       ${counts.c4 + counts.c8 + counts.c12} uds`,
    `Verificado:  visión artificial (OpenCV)`,
  ];
  qs('#odooBlock').textContent = lines.join('\n');
};

window.copyOdoo = function() {
  const text = qs('#odooBlock').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const msg = qs('#copiedMsg');
    msg.style.display = 'inline';
    setTimeout(() => msg.style.display = 'none', 2200);
  });
};

/* ── calibración: imagen ─────────────────────────────────── */
window.loadCalib = function(e) {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = ev => {
    imgCalib = new Image();
    imgCalib.onload = () => {
      renderCalibCanvas();
      setStatus('statusCalib', 'Haz clic sobre el centro de la moneda en la imagen.');
    };
    imgCalib.src = ev.target.result;
  };
  r.readAsDataURL(f);
};

function renderCalibCanvas() {
  const canvas = qs('#cvCalib');
  const maxW   = Math.min(window.innerWidth - 32, 720);
  let w = imgCalib.naturalWidth, h = imgCalib.naturalHeight;
  if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(imgCalib, 0, 0, w, h);
  qs('#wrapCalib').style.display = 'block';
  canvas.onclick = onCalibClick;
}

function onCalibClick(e) {
  if (!cvReady) { setStatus('statusCalib', 'OpenCV cargando…'); return; }
  const canvas = qs('#cvCalib');
  const rect   = canvas.getBoundingClientRect();
  const sx = canvas.width  / rect.width;
  const sy = canvas.height / rect.height;
  const cx = Math.round((e.clientX - rect.left) * sx);
  const cy = Math.round((e.clientY - rect.top)  * sy);
  setStatus('statusCalib', 'Detectando moneda…');
  try {
    canvas.getContext('2d').drawImage(imgCalib, 0, 0, canvas.width, canvas.height);
    let src = cv.imread(canvas), gray = new cv.Mat(), blurred = new cv.Mat(), circles = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(9, 9), 2, 2, cv.BORDER_DEFAULT);
    cv.HoughCircles(blurred, circles, cv.HOUGH_GRADIENT, 1, 30, 70, 30, 10, 150);
    let best = null, bestDist = 9999;
    for (let i = 0; i < circles.cols; i++) {
      const x = circles.data32F[i*3], y = circles.data32F[i*3+1], r = circles.data32F[i*3+2];
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d < bestDist) { bestDist = d; best = { x: Math.round(x), y: Math.round(y), r: Math.round(r) }; }
    }
    if (best && bestDist < 60) {
      clickPx = best.r;
      cv.circle(src, new cv.Point(best.x, best.y), best.r, [24, 95, 165, 255], 3);
      cv.circle(src, new cv.Point(best.x, best.y), 4,      [24, 95, 165, 255], -1);
      cv.imshow(canvas, src);
      computeScale();
    } else {
      clickPx = null;
      setStatus('statusCalib', 'No detecté la moneda. Haz clic más cerca del centro.');
    }
    src.delete(); gray.delete(); blurred.delete(); circles.delete();
  } catch (err) { setStatus('statusCalib', 'Error: ' + err.message); }
}

function computeScale() {
  if (!clickPx || !coinMm) return;
  const pxPerMm = clickPx / (coinMm / 2);
  calibScale    = pxPerMm;
  const t4  = Math.round(pxPerMm * 4  / 2 * 1.25);
  const t8  = Math.round(pxPerMm * 8  / 2 * 1.25);
  const t12 = Math.round(pxPerMm * 12 / 2 * 1.25);
  calibThresholds = { t4, t8, t12 };
  qs('#scaleVal').textContent = pxPerMm.toFixed(2);
  qs('#t4v').textContent  = t4;
  qs('#t8v').textContent  = t8;
  qs('#t12v').textContent = t12;
  qs('#calibResult').style.display = 'block';
  setStatus('statusCalib', `Escala: ${pxPerMm.toFixed(2)} px/mm · pulsa "Aplicar calibración".`);
}

window.applyCalib = function() {
  if (!calibThresholds || !calibScale) return;
  qs('#p2').value = Math.max(3, Math.round(calibThresholds.t4 * 0.4));
  qs('#p3').value = Math.min(200, calibThresholds.t12 + 15);
  qs('#v2').textContent = qs('#p2').value;
  qs('#v3').textContent = qs('#p3').value;
  const badge = qs('#scaleBadge');
  badge.textContent    = calibScale.toFixed(1) + ' px/mm';
  badge.style.display  = 'inline-block';
  qs('#calibInfo').style.display = 'block';
  qs('#calibInfo').innerHTML =
    `<strong>Calibración activa</strong> · ${calibScale.toFixed(2)} px/mm · 4mm≤${calibThresholds.t4}px · 8mm≤${calibThresholds.t8}px · 12mm≤${calibThresholds.t12}px`;
  switchTab('count');
  setStatus('statusCount', 'Calibración aplicada. Sube una foto de pellets para contar.');

  /* persistir en localStorage */
  localStorage.setItem('calibScale', calibScale);
  localStorage.setItem('calibThresholds', JSON.stringify(calibThresholds));
};

/* ── recuperar calibración guardada ──────────────────────── */
(function restoreCalib() {
  const sc = localStorage.getItem('calibScale');
  const th = localStorage.getItem('calibThresholds');
  if (sc && th) {
    calibScale      = parseFloat(sc);
    calibThresholds = JSON.parse(th);
    const badge = qs('#scaleBadge');
    if (badge) { badge.textContent = calibScale.toFixed(1) + ' px/mm'; badge.style.display = 'inline-block'; }
    const info = qs('#calibInfo');
    if (info) {
      info.style.display = 'block';
      info.innerHTML = `<strong>Calibración guardada</strong> · ${calibScale.toFixed(2)} px/mm · 4mm≤${calibThresholds.t4}px · 8mm≤${calibThresholds.t8}px · 12mm≤${calibThresholds.t12}px`;
    }
  }
})();

/* ── registrar service worker ────────────────────────────── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });
}

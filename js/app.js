/* ── Pellet Counter — detección nativa sin OpenCV ── */
let imgCount = null, imgCalib = null;
let runTimer = null;
let coinMm = 23.25;
let calibScale = null, calibThresholds = null;
let counts = { c4: 0, c8: 0, c12: 0 };

const qs  = s => document.querySelector(s);
const qsa = s => document.querySelectorAll(s);

/* ── ocultar mensaje de carga inmediatamente ── */
document.addEventListener('DOMContentLoaded', () => {
  const st = qs('#cv-status');
  if (st) st.style.display = 'none';
  restoreCalib();
});

function setStatus(id, msg) {
  const el = qs('#' + id);
  if (!el) return;
  el.style.display = 'block';
  el.textContent = msg;
}

window.switchTab = function(name) {
  qsa('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  qsa('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
};

window.selectCoin = function(el, mm) {
  qsa('.coin-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  coinMm = mm;
  qs('#customMm').value = '';
};

window.customCoin = function(v) {
  const f = parseFloat(v);
  if (f > 0) { coinMm = f; qsa('.coin-btn').forEach(b => b.classList.remove('selected')); }
};

/* ══════════════════════════════════════════
   DETECCIÓN DE CÍRCULOS — algoritmo nativo
   Usa análisis de píxeles en canvas sin libs
   ══════════════════════════════════════════ */
function detectCircles(canvas, minR, maxR, threshold, minDist) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  /* convertir a escala de grises */
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = Math.round(0.299 * data[i*4] + 0.587 * data[i*4+1] + 0.114 * data[i*4+2]);
  }

  /* detectar píxeles brillantes (pellets claros sobre fondo oscuro) */
  const circles = [];
  const step = Math.max(2, Math.floor(minR / 2));

  for (let y = maxR; y < h - maxR; y += step) {
    for (let x = maxR; x < w - maxR; x += step) {
      const centerVal = gray[y * w + x];
      if (centerVal < threshold) continue; /* ignorar fondo oscuro */

      /* probar varios radios */
      for (let r = minR; r <= maxR; r += Math.max(1, Math.floor(r * 0.15))) {
        let ringSum = 0, ringCount = 0;
        const samples = Math.max(16, Math.floor(2 * Math.PI * r));
        for (let s = 0; s < samples; s++) {
          const angle = (2 * Math.PI * s) / samples;
          const px = Math.round(x + r * Math.cos(angle));
          const py = Math.round(y + r * Math.sin(angle));
          if (px < 0 || px >= w || py < 0 || py >= h) continue;
          ringSum += gray[py * w + px];
          ringCount++;
        }
        if (ringCount === 0) continue;
        const ringAvg = ringSum / ringCount;

        /* borde = transición brusca entre interior claro y exterior oscuro */
        const edgeStrength = centerVal - ringAvg;
        if (edgeStrength > 30) {
          circles.push({ x, y, r, score: edgeStrength });
        }
      }
    }
  }

  /* non-maximum suppression por distancia */
  circles.sort((a, b) => b.score - a.score);
  const kept = [];
  for (const c of circles) {
    let tooClose = false;
    for (const k of kept) {
      const d = Math.sqrt((c.x - k.x) ** 2 + (c.y - k.y) ** 2);
      if (d < minDist) { tooClose = true; break; }
    }
    if (!tooClose) kept.push(c);
  }
  return kept;
}

/* ── cargar imagen contar ── */
window.loadCount = function(e) {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = ev => {
    imgCount = new Image();
    imgCount.onload = () => {
      qs('#wrapCount').style.display = 'block';
      qs('#btnRecount').style.display = '';
      runCount();
    };
    imgCount.src = ev.target.result;
  };
  r.readAsDataURL(f);
};

window.rerun = function() {
  clearTimeout(runTimer);
  runTimer = setTimeout(runCount, 300);
};

function getThresholds() {
  return calibThresholds || { t4: 22, t8: 45, t12: 85 };
}

window.runCount = function() {
  if (!imgCount) return;
  setStatus('statusCount', 'Analizando imagen…');

  const canvas = qs('#cvCount');
  const maxW = Math.min(window.innerWidth - 32, 720);
  let w = imgCount.naturalWidth, h = imgCount.naturalHeight;
  if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imgCount, 0, 0, w, h);

  const th   = getThresholds();
  const sens = parseInt(qs('#p1').value);
  const minR = parseInt(qs('#p2').value);
  const maxR = parseInt(qs('#p3').value);
  const minD = parseInt(qs('#p4').value);
  const thr  = Math.round(255 * (1 - sens / 80));

  setTimeout(() => {
    try {
      const circles = detectCircles(canvas, minR, maxR, thr, minD);

      /* redibujar imagen limpia */
      ctx.drawImage(imgCount, 0, 0, w, h);

      let c4 = 0, c8 = 0, c12 = 0, cO = 0;
      for (const c of circles) {
        let color;
        if      (c.r <= th.t4)  { c4++;  color = '#4a9eff'; }
        else if (c.r <= th.t8)  { c8++;  color = '#3ecf8e'; }
        else if (c.r <= th.t12) { c12++; color = '#f97316'; }
        else                    { cO++;  color = '#555552'; }
        ctx.strokeStyle = color;
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 3, 0, 2 * Math.PI);
        ctx.fill();
      }

      counts = { c4, c8, c12 };
      qs('#c4').textContent  = c4;
      qs('#c8').textContent  = c8;
      qs('#c12').textContent = c12;
      qs('#cT').textContent  = c4 + c8 + c12;
      qs('#resultsCount').style.display = 'block';
      qs('#exportBox').style.display    = 'block';
      buildOdoo();

      const extra = cO > 0 ? ` · ${cO} fuera de rango` : '';
      setStatus('statusCount', `${c4+c8+c12+cO} círculos detectados${extra} · azul=4mm · verde=8mm · naranja=12mm`);
    } catch(err) {
      setStatus('statusCount', 'Error: ' + err.message);
    }
  }, 50);
};

/* ── exportación Odoo ── */
window.buildOdoo = function() {
  const prov = qs('#exProveedor').value || '—';
  const po   = qs('#exPO').value        || '—';
  const pref = qs('#exLote').value      || 'P';
  const ubic = qs('#exUbic').value      || 'WH/Stock';
  const now  = new Date();
  const fecha = now.toLocaleDateString('es-ES');
  const hora  = now.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });
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
    `Verificado:  visión artificial`,
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

/* ── calibración ── */
window.loadCalib = function(e) {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = ev => {
    imgCalib = new Image();
    imgCalib.onload = () => {
      renderCalibCanvas();
      setStatus('statusCalib', 'Toca sobre el centro de la moneda.');
    };
    imgCalib.src = ev.target.result;
  };
  r.readAsDataURL(f);
};

function renderCalibCanvas() {
  const canvas = qs('#cvCalib');
  const maxW = Math.min(window.innerWidth - 32, 720);
  let w = imgCalib.naturalWidth, h = imgCalib.naturalHeight;
  if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(imgCalib, 0, 0, w, h);
  qs('#wrapCalib').style.display = 'block';
  canvas.onclick = onCalibClick;
}

function onCalibClick(e) {
  const canvas = qs('#cvCalib');
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
  const cx = Math.round((e.clientX - rect.left) * sx);
  const cy = Math.round((e.clientY - rect.top)  * sy);

  setStatus('statusCalib', 'Detectando moneda…');

  /* medir radio por expansión radial desde el punto tocado */
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imgCalib, 0, 0, canvas.width, canvas.height);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const w = canvas.width, h = canvas.height;

  const getBrightness = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return 0;
    const i = (y * w + x) * 4;
    return 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
  };

  const centerBrightness = getBrightness(cx, cy);
  if (centerBrightness < 60) {
    setStatus('statusCalib', 'El punto tocado parece oscuro. Toca sobre la moneda (parte dorada).');
    return;
  }

  /* expandir radialmente hasta encontrar el borde */
  let radii = [];
  const numRays = 36;
  for (let i = 0; i < numRays; i++) {
    const angle = (2 * Math.PI * i) / numRays;
    for (let r = 2; r < 200; r++) {
      const px = Math.round(cx + r * Math.cos(angle));
      const py = Math.round(cy + r * Math.sin(angle));
      const b = getBrightness(px, py);
      if (b < centerBrightness * 0.45) {
        radii.push(r);
        break;
      }
    }
  }

  if (radii.length < 10) {
    setStatus('statusCalib', 'No pude medir el borde. Toca más cerca del centro de la moneda.');
    return;
  }

  /* mediana de radios para robustez */
  radii.sort((a, b) => a - b);
  const medianR = radii[Math.floor(radii.length / 2)];

  /* dibujar círculo detectado */
  ctx.strokeStyle = '#4a9eff';
  ctx.lineWidth   = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, medianR, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = '#4a9eff';
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
  ctx.fill();

  computeScale(medianR);
}

function computeScale(radiusPx) {
  const pxPerMm = radiusPx / (coinMm / 2);
  calibScale = pxPerMm;
  const t4  = Math.round(pxPerMm * 4  / 2 * 1.3);
  const t8  = Math.round(pxPerMm * 8  / 2 * 1.3);
  const t12 = Math.round(pxPerMm * 12 / 2 * 1.3);
  calibThresholds = { t4, t8, t12 };

  qs('#scaleVal').textContent = pxPerMm.toFixed(2);
  qs('#t4v').textContent  = t4;
  qs('#t8v').textContent  = t8;
  qs('#t12v').textContent = t12;
  qs('#calibResult').style.display = 'block';
  setStatus('statusCalib', `Escala: ${pxPerMm.toFixed(2)} px/mm · radio moneda: ${radiusPx}px · pulsa "Aplicar".`);
}

window.applyCalib = function() {
  if (!calibThresholds) return;
  qs('#p2').value = Math.max(3,   Math.round(calibThresholds.t4 * 0.35));
  qs('#p3').value = Math.min(300, calibThresholds.t12 + 20);
  qs('#v2').textContent = qs('#p2').value;
  qs('#v3').textContent = qs('#p3').value;

  const badge = qs('#scaleBadge');
  badge.textContent   = calibScale.toFixed(1) + ' px/mm';
  badge.style.display = 'inline-block';

  const info = qs('#calibInfo');
  info.style.display = 'block';
  info.innerHTML = `<strong>Calibración activa</strong> · ${calibScale.toFixed(2)} px/mm · 4mm≤${calibThresholds.t4}px · 8mm≤${calibThresholds.t8}px · 12mm≤${calibThresholds.t12}px`;

  localStorage.setItem('calibScale',      calibScale);
  localStorage.setItem('calibThresholds', JSON.stringify(calibThresholds));

  switchTab('count');
  setStatus('statusCount', 'Calibración aplicada. Sube una foto de pellets para contar.');
};

function restoreCalib() {
  const sc = localStorage.getItem('calibScale');
  const th = localStorage.getItem('calibThresholds');
  if (!sc || !th) return;
  calibScale      = parseFloat(sc);
  calibThresholds = JSON.parse(th);
  const badge = qs('#scaleBadge');
  if (badge) { badge.textContent = calibScale.toFixed(1) + ' px/mm'; badge.style.display = 'inline-block'; }
  const info = qs('#calibInfo');
  if (info) {
    info.style.display = 'block';
    info.innerHTML = `<strong>Calibración guardada</strong> · ${calibScale.toFixed(2)} px/mm`;
  }
  qs('#p2').value = Math.max(3,   Math.round(calibThresholds.t4 * 0.35));
  qs('#p3').value = Math.min(300, calibThresholds.t12 + 20);
  qs('#v2').textContent = qs('#p2').value;
  qs('#v3').textContent = qs('#p3').value;
}

/* ── install PWA ── */
let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt = e;
  qs('#installBanner').style.display = 'flex';
});
qs('#installBtn') && qs('#installBtn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  qs('#installBanner').style.display = 'none';
});

/* ── service worker ── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}

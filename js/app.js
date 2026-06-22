/* ── Pellet Counter v7.1 — Claude Vision Full ── */
let imgCount = null;
let lastImageBase64 = null;
let lastImageMime = 'image/jpeg';
let isAnalyzing = false;
let analysisHistory = [];
let counts = { c4: 0, c8: 0, c12: 0, total: 0 };
const UNIT_WEIGHTS = { p4: 0.12, p8: 0.05, p12: 0.12 };

const qs  = s => document.querySelector(s);
const qsa = s => document.querySelectorAll(s);

document.addEventListener('DOMContentLoaded', () => {
  restoreSettings();
  initGrav();
  loadHistory();
  updateHistoryBadge();
  setTimeout(() => { renderProductSelector(); }, 50);
});

/* ══ SETTINGS ══ */
/* ══ PERFILES DE PRODUCTO ══ */
const PROFILES = {
  '4': {
    desc: `Electrodos de disco de plata sinterizada de 4mm de diámetro. Son discos circulares MUY PEQUEÑOS, color marrón claro cuando recién llegan del proveedor, puede oscurecerse con la luz, con un hilo fino de conexión saliendo del centro. INSTRUCCIONES CRÍTICAS: estos objetos son extremadamente pequeños y tienden a agruparse. Examina cada zona oscura con detalle — si ves una masa o grupo, asume que hay múltiples discos individuales y cuenta cada punto oscuro circular por separado. Cuenta cada disco individualmente aunque se toquen o solapen. Ignora completamente los hilos, solo cuenta los discos circulares.`,
    size: 'single', singleSize: '4'
  },
  '8': {
    desc: `Electrodos de disco de plata sinterizada de 8mm de diámetro. Son discos circulares de tamaño mediano, color marrón claro o marrón oscuro dependiendo de la exposición a la luz, con un hilo fino de conexión saliendo del centro. Cuando dos discos se toquen o solapen parcialmente cuenta cada uno como unidad independiente. Si ves zonas con solapamiento cuenta todos los discos visibles individualmente. Ignora completamente los hilos de conexión, solo cuenta los discos circulares.`,
    size: 'single', singleSize: '8'
  },
  '12': {
    desc: `Electrodos de disco de plata sinterizada de 12mm de diámetro. Son discos circulares GRANDES, color marrón claro o marrón oscuro dependiendo de la exposición a la luz, con un hilo fino de conexión saliendo del centro. Al ser grandes generalmente son fáciles de distinguir individualmente. Cuenta cada disco por separado aunque se toquen en los bordes. Ignora completamente los hilos de conexión, solo cuenta los discos circulares.`,
    size: 'single', singleSize: '12'
  },
  'custom': {
    desc: localStorage.getItem('productDesc') || '',
    size: 'single', singleSize: '8'
  }
};

window.loadProfile = function(key) {
  const p = PROFILES[key];
  if (!p) return;

  /* si es custom, solo activa el botón sin sobreescribir el texto */
  if (key !== 'custom') {
    qs('#productDesc').value = p.desc;
    localStorage.setItem('productDesc', p.desc);
  }

  /* selector de tamaño */
  qs('#sizeMode').value = p.size;
  qs('#singleSizeWrap').style.display = p.size === 'single' ? 'block' : 'none';
  if (p.singleSize) qs('#singleSize').value = p.singleSize;

  /* resaltar botón activo */
  ['4','8','12','custom'].forEach(k => {
    const btn = qs('#prof' + k);
    if (!btn) return;
    if (k === key) {
      btn.style.background = 'var(--blue-dim)';
      btn.style.borderColor = 'var(--blue)';
      btn.style.color = 'var(--blue)';
    } else {
      btn.style.background = '';
      btn.style.borderColor = '';
      btn.style.color = '';
    }
  });

  localStorage.setItem('activeProfile', key);
  showToast(key === 'custom' ? 'Perfil personalizado activo' : `Perfil ${key}mm cargado`);
};


function restoreSettings() {
  const key = localStorage.getItem('claudeApiKey');
  if (key && qs('#apiKeyInput')) {
    qs('#apiKeyInput').value = key;
    showApiStatus('✓ API key guardada', '#3ecf8e');
  }
  const desc = localStorage.getItem('productDesc');
  if (desc && qs('#productDesc')) qs('#productDesc').value = desc;
  /* restaurar perfil activo */
  const activeProfile = localStorage.getItem('activeProfile');
  if (activeProfile) {
    setTimeout(() => {
      const btn = qs('#prof' + activeProfile);
      if (btn) { btn.style.background='var(--blue-dim)'; btn.style.borderColor='var(--blue)'; btn.style.color='var(--blue)'; }
    }, 100);
  }
  const w = JSON.parse(localStorage.getItem('unitWeights') || '{}');
  if (qs('#w4'))  qs('#w4').value  = w.p4  || UNIT_WEIGHTS.p4;
  if (qs('#w8'))  qs('#w8').value  = w.p8  || UNIT_WEIGHTS.p8;
  if (qs('#w12')) qs('#w12').value = w.p12 || UNIT_WEIGHTS.p12;
}

function showApiStatus(msg, color) {
  const el = qs('#apiKeyStatus');
  if (!el) return;
  el.textContent = msg;
  el.style.color = color || '';
}

window.saveApiKey = function() {
  const key = qs('#apiKeyInput').value.trim();
  if (!key.startsWith('sk-ant-')) {
    showApiStatus('✗ Clave inválida — debe empezar por sk-ant-', '#f97316');
    return;
  }
  localStorage.setItem('claudeApiKey', key);
  showApiStatus('✓ API key guardada correctamente', '#3ecf8e');
};

window.toggleApiKey = function() {
  const inp = qs('#apiKeyInput');
  inp.type = inp.type === 'password' ? 'text' : 'password';
};

window.saveProductDesc = function() {
  const desc = qs('#productDesc').value.trim();
  localStorage.setItem('productDesc', desc);
  showToast('Descripción guardada');
};

function getApiKey() { return localStorage.getItem('claudeApiKey') || ''; }


/* ══ SISTEMA DE PRODUCTOS ESCALABLE ══ */
const DEFAULT_PRODUCTS = {
  'pellets': {
    name: 'Pellets electrodo',
    icon: '⬤',
    profiles: {
      '4': `Electrodos de disco de plata sinterizada de 4mm de diámetro. Son discos circulares MUY PEQUEÑOS, color marrón claro o marrón oscuro dependiendo de la exposición a la luz, con un hilo fino de conexión saliendo del centro. INSTRUCCIONES CRÍTICAS: estos objetos son extremadamente pequeños y tienden a agruparse. Examina cada zona oscura con detalle — si ves una masa o grupo, asume que hay múltiples discos individuales y cuenta cada punto oscuro circular por separado. Cuenta cada disco individualmente aunque se toquen o solapen. Ignora completamente los hilos, solo cuenta los discos circulares.`,
      '8': `Electrodos de disco de plata sinterizada de 8mm de diámetro. Son discos circulares de tamaño mediano, color marrón claro o marrón oscuro dependiendo de la exposición a la luz, con un hilo fino de conexión saliendo del centro. Cuando dos discos se toquen o solapen parcialmente cuenta cada uno como unidad independiente. Si ves zonas con solapamiento cuenta todos los discos visibles individualmente. Ignora completamente los hilos de conexión, solo cuenta los discos circulares.`,
      '12': `Electrodos de disco de plata sinterizada de 12mm de diámetro. Son discos circulares GRANDES, color marrón claro o marrón oscuro dependiendo de la exposición a la luz, con un hilo fino de conexión saliendo del centro. Al ser grandes generalmente son fáciles de distinguir individualmente. Cuenta cada disco por separado aunque se toquen en los bordes. Ignora completamente los hilos de conexión, solo cuenta los discos circulares.`
    }
  }
};

function getProducts() {
  const saved = localStorage.getItem('customProducts');
  const custom = saved ? JSON.parse(saved) : {};
  return { ...DEFAULT_PRODUCTS, ...custom };
}

function saveCustomProduct(id, name, icon, desc) {
  const saved = JSON.parse(localStorage.getItem('customProducts') || '{}');
  saved[id] = { name, icon, profiles: { custom: desc } };
  localStorage.setItem('customProducts', JSON.stringify(saved));
}

window.renderProductSelector = function() {
  const container = qs('#productSelector');
  if (!container) return;
  const products = getProducts();
  const active = localStorage.getItem('activeProduct') || 'pellets';
  container.innerHTML = Object.entries(products).map(([id, p]) => `
    <button onclick="selectProduct('${id}')" style="flex:1;min-width:80px;justify-content:center;flex-direction:column;gap:2px;padding:8px 4px;font-size:11px;${id===active?'background:var(--blue-dim);border-color:var(--blue);color:var(--blue)':''}">
      <span style="font-size:16px">${p.icon}</span>
      <span>${p.name}</span>
    </button>
  `).join('') + `
    <button onclick="showAddProduct()" style="flex:1;min-width:60px;justify-content:center;flex-direction:column;gap:2px;padding:8px 4px;font-size:11px;">
      <span style="font-size:16px">➕</span>
      <span>Nuevo</span>
    </button>`;
};

window.selectProduct = function(id) {
  localStorage.setItem('activeProduct', id);
  const products = getProducts();
  const p = products[id];
  if (!p) return;
  /* actualizar perfiles disponibles */
  const profiles = p.profiles;
  const firstKey = Object.keys(profiles)[0];
  if (profiles[firstKey]) {
    qs('#productDesc').value = profiles[firstKey];
    localStorage.setItem('productDesc', profiles[firstKey]);
  }
  renderProductSelector();
  /* actualizar botones de perfil según producto */
  updateProfileButtons(profiles);
  showToast(`Producto: ${p.name}`);
};

function updateProfileButtons(profiles) {
  const profileBar = qs('#profileBar');
  if (!profileBar) return;
  const keys = Object.keys(profiles);
  profileBar.innerHTML = keys.map(k => `
    <button onclick="loadProfileKey('${k}')" id="prof${k}" style="flex:1;justify-content:center;font-size:12px;padding:7px 4px">${k === 'custom' ? '✏️ Propio' : `● ${k}${k.match(/^\d+$/) ? 'mm' : ''}`}</button>
  `).join('') + `<button onclick="loadProfile('custom')" style="flex:1;justify-content:center;font-size:12px;padding:7px 4px">✏️</button>`;
}

window.loadProfileKey = function(key) {
  const products = getProducts();
  const activeProduct = localStorage.getItem('activeProduct') || 'pellets';
  const p = products[activeProduct];
  if (!p || !p.profiles[key]) return;
  qs('#productDesc').value = p.profiles[key];
  localStorage.setItem('productDesc', p.profiles[key]);
  /* tamaño automático si es número */
  if (key.match(/^\d+$/)) {
    qs('#sizeMode').value = 'single';
    qs('#singleSizeWrap').style.display = 'block';
    if (['4','8','12'].includes(key)) qs('#singleSize').value = key;
  }
  /* resaltar */
  document.querySelectorAll('#profileBar button').forEach(b => {
    b.style.background = ''; b.style.borderColor = ''; b.style.color = '';
  });
  const btn = qs('#prof' + key);
  if (btn) { btn.style.background='var(--blue-dim)'; btn.style.borderColor='var(--blue)'; btn.style.color='var(--blue)'; }
  localStorage.setItem('activeProfile', key);
  showToast(`Perfil ${key}${key.match(/^\d+$/) ? 'mm' : ''} cargado`);
};

window.showAddProduct = function() {
  const name = prompt('Nombre del nuevo producto:');
  if (!name) return;
  const icon = prompt('Emoji icono (ej: 🔩 💊 🪙):') || '📦';
  const desc = prompt('Descripción para la IA (qué debe contar y cómo):');
  if (!desc) return;
  const id = 'prod_' + Date.now();
  saveCustomProduct(id, name, icon, desc);
  localStorage.setItem('activeProduct', id);
  renderProductSelector();
  showToast(`Producto "${name}" añadido`);
};


/* ══ TABS ══ */
window.switchTab = function(name) {
  qsa('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  qsa('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
};

/* ══ TOAST ══ */
function showToast(msg, isError) {
  let t = qs('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.style.cssText = `position:fixed;bottom:calc(env(safe-area-inset-bottom,0px) + 80px);left:50%;transform:translateX(-50%);background:${isError?'#3a1a06':'#1a3a2c'};color:${isError?'#f97316':'#3ecf8e'};border:0.5px solid ${isError?'#f97316':'#3ecf8e'};padding:10px 18px;border-radius:20px;font-size:13px;z-index:9999;font-weight:500;pointer-events:none;transition:opacity 0.3s`;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.style.opacity = '0', 2500);
};

/* ══ HISTORIA ══ */
function loadHistory() {
  return JSON.parse(localStorage.getItem('analysisHistory') || '[]');
}
function saveHistory(entry) {
  const h = loadHistory();
  h.unshift(entry);
  if (h.length > 50) h.pop();
  localStorage.setItem('analysisHistory', JSON.stringify(h));
  updateHistoryBadge();
  renderHistory();
}
function updateHistoryBadge() {
  const h = loadHistory();
  const badge = qs('#historyBadge');
  if (badge) badge.textContent = h.length > 0 ? h.length : '';
}
function renderHistory() {
  const container = qs('#historyList');
  if (!container) return;
  const h = loadHistory();
  if (h.length === 0) {
    container.innerHTML = '<p style="color:var(--muted);font-size:13px;text-align:center;padding:20px">Sin análisis aún</p>';
    return;
  }
  container.innerHTML = h.map((e, i) => `
    <div style="background:var(--surface);border:0.5px solid var(--border);border-radius:var(--radius);padding:12px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div>
          <span style="font-size:13px;font-weight:600;color:var(--text)">${e.total} uds</span>
          <span style="font-size:11px;color:var(--muted);margin-left:8px">${e.date}</span>
        </div>
        <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${e.confidence==='alta'?'var(--green-dim)':e.confidence==='media'?'#2a1f06':'var(--orange-dim)'};color:${e.confidence==='alta'?'#3ecf8e':e.confidence==='media'?'#f59e0b':'#f97316'}">${e.confidence}</span>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:6px">${e.product || 'Sin descripción'}</div>
      ${e.notes ? `<div style="font-size:11px;color:var(--hint);font-style:italic">${e.notes}</div>` : ''}
      <div style="display:flex;gap:12px;margin-top:8px">
        ${e.size4>0?`<span style="font-size:12px;color:#4a9eff">4mm: ${e.size4}</span>`:''}
        ${e.size8>0?`<span style="font-size:12px;color:#3ecf8e">8mm: ${e.size8}</span>`:''}
        ${e.size12>0?`<span style="font-size:12px;color:#f97316">12mm: ${e.size12}</span>`:''}
      </div>
      ${e.odoo ? `<button onclick="copyHistoryEntry(${i})" style="margin-top:8px;padding:6px 12px;font-size:11px">📋 Copiar Odoo</button>` : ''}
    </div>
  `).join('');
}
window.copyHistoryEntry = function(i) {
  const h = loadHistory();
  if (h[i]?.odoo) navigator.clipboard.writeText(h[i].odoo).then(() => showToast('Copiado'));
};
window.clearHistory = function() {
  if (!confirm('¿Borrar todo el historial?')) return;
  localStorage.removeItem('analysisHistory');
  updateHistoryBadge();
  renderHistory();
};

/* ══ CARGAR IMAGEN ══ */
window.loadCount = function(e) {
  const f = e.target.files[0]; if (!f) return;
  lastImageMime = f.type || 'image/jpeg';
  const reader = new FileReader();
  reader.onload = ev => {
    imgCount = new Image();
    imgCount.onload = () => {
      renderCountCanvas();
      lastImageBase64 = ev.target.result.split(',')[1];
      qs('#btnRecount').style.display = '';
      runCountAI();
    };
    imgCount.src = ev.target.result;
  };
  reader.readAsDataURL(f);
};

function renderCountCanvas() {
  const canvas = qs('#cvCount');
  const maxW = Math.min(window.innerWidth - 32, 800);
  let w = imgCount.naturalWidth, h = imgCount.naturalHeight;
  if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(imgCount, 0, 0, w, h);
  qs('#wrapCount').style.display = 'block';
}

window.rerun = window.runCount = runCountAI;

/* ══ CLAUDE VISION ══ */
async function runCountAI() {
  if (!lastImageBase64 || isAnalyzing) return;
  const apiKey = getApiKey();
  if (!apiKey) {
    showToast('Introduce tu API key en ⚙️ Ajustes', true);
    switchTab('settings');
    return;
  }

  isAnalyzing = true;
  setStatus('statusCount', '🔍 Claude está analizando la imagen…');
  qs('#btnRecount').disabled = true;
  qs('#analyzeSpinner').style.display = 'block';

  const productDesc = qs('#productDesc').value.trim() ||
    'pellets circulares de electrodo sinterizado, discos redondos de color marrón oscuro con un hilo fino saliendo del centro';
  const sizeMode = qs('#sizeMode').value;
  const albaranQty = parseInt(qs('#albaranQty').value) || 0;

  const sizeInstruction = sizeMode === 'single'
    ? `Todos son del mismo tamaño (${qs('#singleSize').value}mm). Devuelve small=0, large=0 y pon el total en medium.`
    : `Clasifica por tamaño relativo: pequeños (~4mm) en "small", medianos (~8mm) en "medium", grandes (~12mm) en "large".`;

  const prompt = `Eres un sistema experto de conteo industrial con precisión máxima.

Objeto a contar: ${productDesc}

${sizeInstruction}

REGLAS CRÍTICAS:
- Cuenta ÚNICAMENTE los objetos descritos. Ignora completamente hilos, cables, algodón, embalaje, fondo y cualquier otro elemento.
- Si los objetos se tocan o solapan parcialmente, cuenta cada uno individualmente.
- Incluye objetos parcialmente visibles en bordes si se ve más del 50% del objeto.
- Si la imagen es borrosa o la iluminación es mala, indícalo en "notes" pero intenta contar igualmente.
- Sé extremadamente preciso — esta cuenta verifica albaranes comerciales con implicaciones económicas.

Responde ÚNICAMENTE con este JSON exacto, sin texto adicional, sin markdown:
{"small":<int>,"medium":<int>,"large":<int>,"total":<int>,"confidence":"alta"|"media"|"baja","notes":<string|null>}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: lastImageMime, data: lastImageBase64 } },
          { type: 'text', text: prompt }
        ]}]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data.content[0].text.trim().replace(/```json|```/g, '').trim();
    const result = JSON.parse(text);

    counts = { c4: result.small||0, c8: result.medium||0, c12: result.large||0, total: result.total||0 };
    if (sizeMode === 'single') counts.total = result.total || counts.c8;

    /* UI resultados */
    qs('#c4').textContent  = sizeMode === 'single' ? '—' : counts.c4;
    qs('#c8').textContent  = sizeMode === 'single' ? counts.total : counts.c8;
    qs('#c12').textContent = sizeMode === 'single' ? '—' : counts.c12;
    qs('#cT').textContent  = counts.total;

    /* verificación albarán */
    if (albaranQty > 0) {
      const diff = counts.total - albaranQty;
      const albaranEl = qs('#albaranResult');
      albaranEl.style.display = 'block';
      if (diff === 0) {
        albaranEl.innerHTML = `<span style="color:#3ecf8e">✓ Coincide con albarán (${albaranQty} uds)</span>`;
      } else if (diff < 0) {
        albaranEl.innerHTML = `<span style="color:#f97316">⚠️ FALTAN ${Math.abs(diff)} uds respecto al albarán (${albaranQty})</span>`;
      } else {
        albaranEl.innerHTML = `<span style="color:#f59e0b">ℹ️ SOBRAN ${diff} uds respecto al albarán (${albaranQty})</span>`;
      }
    }

    /* confianza */
    const confColor = result.confidence==='alta' ? '#3ecf8e' : result.confidence==='media' ? '#f59e0b' : '#f97316';
    const notesText = result.notes ? ` · ${result.notes}` : '';
    setStatus('statusCount', `✓ ${counts.total} objetos detectados · Confianza: ${result.confidence}${notesText}`);
    qs('#statusCount').style.color = confColor;

    /* overlay canvas */
    drawOverlay(counts.total, result.confidence);

    /* mostrar resultados y export */
    qs('#resultsCount').style.display = 'block';
    qs('#exportBox').style.display    = 'block';
    buildOdoo();

    /* guardar en historial */
    const now = new Date();
    saveHistory({
      date: now.toLocaleDateString('es-ES') + ' ' + now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),
      total: counts.total,
      size4: counts.c4, size8: counts.c8, size12: counts.c12,
      product: productDesc.slice(0,60),
      confidence: result.confidence,
      notes: result.notes,
      odoo: qs('#odooBlock').textContent
    });

  } catch(err) {
    setStatus('statusCount', '✗ Error: ' + err.message, true);
    qs('#statusCount').style.color = '#f97316';
    showToast('Error al analizar: ' + err.message, true);
  } finally {
    isAnalyzing = false;
    qs('#btnRecount').disabled = false;
    qs('#analyzeSpinner').style.display = 'none';
  }
}

function drawOverlay(total, confidence) {
  const canvas = qs('#cvCount');
  const ctx = canvas.getContext('2d');
  const confColor = confidence==='alta' ? '#3ecf8e' : confidence==='media' ? '#f59e0b' : '#f97316';
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(10,10,170,58,10); else ctx.rect(10,10,170,58);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px -apple-system,sans-serif';
  ctx.fillText(`${total} uds`, 20, 44);
  ctx.font = '12px -apple-system,sans-serif';
  ctx.fillStyle = confColor;
  ctx.fillText(`Confianza ${confidence}`, 20, 60);
}

function setStatus(id, msg, isError) {
  const el = qs('#' + id);
  if (!el) return;
  el.style.display = 'block';
  el.textContent = msg;
  el.style.color = isError ? '#f97316' : '';
}

/* ══ EXPORT ODOO ══ */
window.buildOdoo = function() {
  const prov=qs('#exProveedor').value||'—', po=qs('#exPO').value||'—';
  const pref=qs('#exLote').value||'P', ubic=qs('#exUbic').value||'WH/Stock';
  const alb=qs('#albaranQty').value||'—';
  const now=new Date();
  const fecha=now.toLocaleDateString('es-ES');
  const hora=now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
  const seq=Math.floor(Math.random()*900)+100;
  const pad=n=>String(n).padStart(3,'0');
  const sizeMode=qs('#sizeMode').value;
  const diff = parseInt(qs('#albaranQty').value) > 0 ? counts.total - parseInt(qs('#albaranQty').value) : null;
  const lines=[
    '=== RECEPCIÓN DE PELLETS — VERIFICADO IA ===',
    `Fecha:        ${fecha}  ${hora}`,
    `Proveedor:    ${prov}`,`PO:           ${po}`,`Ubicación:    ${ubic}`,
    `Albarán:      ${alb} uds`,
    '---',
  ];
  if(sizeMode==='single'){
    const sz=qs('#singleSize').value;
    lines.push(`Pellet ${sz}mm   |  Lote: ${pref}-${sz}MM-${pad(seq)}  |  Cant: ${counts.total}`);
  } else {
    if(counts.c4>0)  lines.push(`Pellet  4mm  |  Lote: ${pref}-4MM-${pad(seq)}    |  Cant: ${counts.c4}`);
    if(counts.c8>0)  lines.push(`Pellet  8mm  |  Lote: ${pref}-8MM-${pad(seq+1)}  |  Cant: ${counts.c8}`);
    if(counts.c12>0) lines.push(`Pellet 12mm  |  Lote: ${pref}-12MM-${pad(seq+2)} |  Cant: ${counts.c12}`);
  }
  lines.push('---');
  lines.push(`Total contado: ${counts.total} uds`);
  if (diff !== null) {
    lines.push(diff === 0 ? '✓ COINCIDE con albarán' : diff < 0 ? `⚠️ FALTAN ${Math.abs(diff)} uds respecto al albarán` : `ℹ️ SOBRAN ${diff} uds respecto al albarán`);
  }
  lines.push(`Método:       Claude Vision AI (claude-sonnet-4-6)`);
  qs('#odooBlock').textContent = lines.join('\n');
};

window.copyOdoo = function() {
  navigator.clipboard.writeText(qs('#odooBlock').textContent)
    .then(() => showToast('Copiado al portapapeles ✓'));
};

/* ══ MÓDULO GRAVIMÉTRICO ══ */
function initGrav() {
  const w = JSON.parse(localStorage.getItem('unitWeights') || '{}');
  if (qs('#w4'))  qs('#w4').value  = w.p4  || UNIT_WEIGHTS.p4;
  if (qs('#w8'))  qs('#w8').value  = w.p8  || UNIT_WEIGHTS.p8;
  if (qs('#w12')) qs('#w12').value = w.p12 || UNIT_WEIGHTS.p12;
}

window.calcGrav = function() {
  const size=qs('#gravSize').value;
  const totalW=parseFloat(qs('#gravTotal').value);
  const tare=parseFloat(qs('#gravTare').value)||0;
  const w4=parseFloat(qs('#w4').value)||UNIT_WEIGHTS.p4;
  const w8=parseFloat(qs('#w8').value)||UNIT_WEIGHTS.p8;
  const w12=parseFloat(qs('#w12').value)||UNIT_WEIGHTS.p12;
  localStorage.setItem('unitWeights',JSON.stringify({p4:w4,p8:w8,p12:w12}));
  if(!totalW||totalW<=0){setStatus('statusGrav','Introduce el peso total.');return;}
  const netW=totalW-tare;
  if(netW<=0){setStatus('statusGrav','Peso neto 0. Revisa la tara.');return;}
  const unitW=size==='4'?w4:size==='8'?w8:w12;
  const qty=Math.round(netW/unitW);
  counts={c4:size==='4'?qty:0,c8:size==='8'?qty:0,c12:size==='12'?qty:0,total:qty};
  qs('#gravQty').textContent=qty.toLocaleString('es-ES');
  qs('#gravNet').textContent=netW.toFixed(3)+' g';
  qs('#gravUnit').textContent=unitW.toFixed(3)+' g';
  qs('#gravResult').style.display='block';
  qs('#exportBoxGrav').style.display='block';
  buildOdooGrav(size,qty);
  setStatus('statusGrav',`Resultado: ${qty.toLocaleString('es-ES')} unidades de pellet ${size}mm`);
};

function buildOdooGrav(size,qty){
  const prov=qs('#gExProveedor').value||'—',po=qs('#gExPO').value||'—';
  const pref=qs('#gExLote').value||'P',ubic=qs('#gExUbic').value||'WH/Stock';
  const now=new Date();
  const seq=Math.floor(Math.random()*900)+100;
  const pad=n=>String(n).padStart(3,'0');
  const netW=(parseFloat(qs('#gravTotal').value||0)-(parseFloat(qs('#gravTare').value)||0)).toFixed(3);
  qs('#odooBlockGrav').textContent=[
    '=== RECEPCIÓN PELLETS (GRAVIMÉTRICO) ===',
    `Fecha:        ${now.toLocaleDateString('es-ES')}  ${now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}`,
    `Proveedor:    ${prov}`,`PO:           ${po}`,`Ubicación:    ${ubic}`,'---',
    `Pellet ${size}mm   |  Lote: ${pref}-${size}MM-${pad(seq)}  |  Cant: ${qty.toLocaleString('es-ES')}`,
    '---',`Peso neto:    ${netW} g`,`Método:       báscula de precisión`,
  ].join('\n');
}
window.updateOdooGrav=function(){const size=qs('#gravSize').value;const qty=parseInt(qs('#gravQty').textContent.replace(/\D/g,''))||0;if(qty>0)buildOdooGrav(size,qty);};
window.copyOdooGrav=function(){navigator.clipboard.writeText(qs('#odooBlockGrav').textContent).then(()=>showToast('Copiado ✓'));};

/* ══ PWA ══ */
let deferredPrompt;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;const b=qs('#installBanner');if(b)b.style.display='flex';});
qs('#installBtn')&&qs('#installBtn').addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;qs('#installBanner').style.display='none';});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));

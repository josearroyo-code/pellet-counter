/* ══════════════════════════════════════════
   Pellet Counter v7.3
   Fix: columna tamaño correcta en modo single
   Fix: JSON parser robusto anti-error
   Fix: color pellets adaptativo
   ══════════════════════════════════════════ */

const VERSION = 'v7.3';
let lastImageBase64 = null;
let lastImageMime   = 'image/jpeg';
let isAnalyzing     = false;
let counts          = { c4:0, c8:0, c12:0, total:0 };
const UNIT_WEIGHTS  = { p4:0.12, p8:0.05, p12:0.12 };

const qs  = s => document.querySelector(s);
const qsa = s => document.querySelectorAll(s);

const PELLET_PROFILES = {
  '4':  `Electrodos de disco de plata sinterizada de 4mm de diámetro. Son discos circulares MUY PEQUEÑOS, color marrón claro o marrón oscuro dependiendo de la exposición a la luz, con un hilo fino de conexión saliendo del centro. INSTRUCCIONES CRÍTICAS: son extremadamente pequeños y tienden a agruparse. Examina cada zona con detalle — si ves una masa o grupo asume múltiples discos individuales y cuenta cada punto circular por separado. Cuenta cada disco individualmente aunque se toquen o solapen. Ignora completamente los hilos, solo cuenta los discos circulares.`,
  '8':  `Electrodos de disco de plata sinterizada de 8mm de diámetro. Son discos circulares de tamaño mediano, color marrón claro o marrón oscuro dependiendo de la exposición a la luz, con un hilo fino de conexión saliendo del centro. Cuando dos discos se toquen o solapen parcialmente cuenta cada uno como unidad independiente. Ignora completamente los hilos, solo cuenta los discos circulares.`,
  '12': `Electrodos de disco de plata sinterizada de 12mm de diámetro. Son discos circulares GRANDES, color marrón claro o marrón oscuro dependiendo de la exposición a la luz, con un hilo fino de conexión saliendo del centro. Son fáciles de distinguir individualmente. Cuenta cada disco por separado aunque se toquen en los bordes. Ignora completamente los hilos, solo cuenta los discos circulares.`
};

/* ══ INIT ══ */
document.addEventListener('DOMContentLoaded', () => {
  restoreSettings();
  initGrav();
  loadHistory();
  updateHistoryBadge();
  renderProductSelector();
  const ap = localStorage.getItem('activeProfile');
  if (ap) setTimeout(() => highlightProfile(ap), 100);
});

/* ══ UTILS ══ */
function setStatus(id, msg, color) {
  const el = qs('#' + id);
  if (!el) return;
  el.style.display = 'block';
  el.textContent   = msg;
  el.style.color   = color || '';
}

function showToast(msg, isError) {
  let t = qs('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent   = msg;
  t.style.cssText = `position:fixed;bottom:calc(env(safe-area-inset-bottom,0px)+80px);left:50%;transform:translateX(-50%);background:${isError?'#3a1a06':'#0e3a26'};color:${isError?'#f97316':'#3ecf8e'};border:0.5px solid ${isError?'#f97316':'#3ecf8e'};padding:10px 18px;border-radius:20px;font-size:13px;z-index:9999;font-weight:500;pointer-events:none;white-space:nowrap`;
  t.style.opacity = '1';
  clearTimeout(t._t);
  t._t = setTimeout(() => t.style.opacity = '0', 2500);
}

/* ══ TABS ══ */
window.switchTab = function(name) {
  qsa('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  qsa('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
  if (name === 'history') renderHistory();
};

/* ══ SETTINGS ══ */
function restoreSettings() {
  const key = localStorage.getItem('claudeApiKey');
  if (key && qs('#apiKeyInput')) { qs('#apiKeyInput').value = key; showApiStatus('✓ API key guardada', '#3ecf8e'); }
  const desc = localStorage.getItem('productDesc');
  if (desc && qs('#productDesc')) qs('#productDesc').value = desc;
  const w = JSON.parse(localStorage.getItem('unitWeights') || '{}');
  if (qs('#w4'))  qs('#w4').value  = w.p4  || UNIT_WEIGHTS.p4;
  if (qs('#w8'))  qs('#w8').value  = w.p8  || UNIT_WEIGHTS.p8;
  if (qs('#w12')) qs('#w12').value = w.p12 || UNIT_WEIGHTS.p12;
  const mode = localStorage.getItem('sizeMode') || 'single';
  if (qs('#sizeMode')) {
    qs('#sizeMode').value = mode;
    qs('#singleSizeWrap').style.display = mode === 'single' ? 'block' : 'none';
  }
  const sz = localStorage.getItem('singleSize') || '8';
  if (qs('#singleSize')) qs('#singleSize').value = sz;
}

function showApiStatus(msg, color) {
  const el = qs('#apiKeyStatus');
  if (el) { el.textContent = msg; el.style.color = color || ''; }
}

window.saveApiKey = function() {
  const key = qs('#apiKeyInput').value.trim();
  if (!key.startsWith('sk-ant-')) { showApiStatus('✗ Clave inválida — debe empezar por sk-ant-', '#f97316'); return; }
  localStorage.setItem('claudeApiKey', key);
  showApiStatus('✓ API key guardada', '#3ecf8e');
  showToast('API key guardada ✓');
};

window.toggleApiKey = function() {
  const i = qs('#apiKeyInput');
  i.type = i.type === 'password' ? 'text' : 'password';
};

window.saveProductDesc = function() { localStorage.setItem('productDesc', qs('#productDesc').value); };
function getApiKey() { return localStorage.getItem('claudeApiKey') || ''; }

/* ══ PRODUCTOS ESCALABLES ══ */
const DEFAULT_PRODUCTS = { pellets: { name: 'Pellets electrodo', icon: '⬤', isDefault: true } };

function getProducts() {
  const custom = JSON.parse(localStorage.getItem('customProducts') || '{}');
  return { ...DEFAULT_PRODUCTS, ...custom };
}

window.renderProductSelector = function() {
  const el = qs('#productSelector'); if (!el) return;
  const active = localStorage.getItem('activeProduct') || 'pellets';
  el.innerHTML = Object.entries(getProducts()).map(([id, p]) =>
    `<button onclick="selectProduct('${id}')" style="flex:1;min-width:70px;justify-content:center;flex-direction:column;gap:2px;padding:8px 4px;font-size:11px;${id===active?'background:var(--blue-dim);border-color:var(--blue);color:var(--blue)':''}">
      <span style="font-size:15px">${p.icon}</span><span>${p.name}</span></button>`
  ).join('') +
  `<button onclick="showAddProduct()" style="flex:1;min-width:55px;justify-content:center;flex-direction:column;gap:2px;padding:8px 4px;font-size:11px;">
    <span style="font-size:15px">➕</span><span>Nuevo</span></button>`;
};

window.selectProduct = function(id) {
  localStorage.setItem('activeProduct', id);
  const custom = JSON.parse(localStorage.getItem('customProducts') || '{}');
  if (custom[id]?.desc) { qs('#productDesc').value = custom[id].desc; localStorage.setItem('productDesc', custom[id].desc); }
  renderProductSelector();
  showToast('Producto seleccionado');
};

window.showAddProduct = function() {
  const name = prompt('Nombre del nuevo producto:'); if (!name) return;
  const icon = prompt('Emoji icono (ej: 🔩 💊 🪙):') || '📦';
  const desc = prompt('Descripción para la IA — qué debe contar y cómo:'); if (!desc) return;
  const id   = 'prod_' + Date.now();
  const custom = JSON.parse(localStorage.getItem('customProducts') || '{}');
  custom[id] = { name, icon, desc };
  localStorage.setItem('customProducts', JSON.stringify(custom));
  localStorage.setItem('activeProduct', id);
  renderProductSelector();
  qs('#productDesc').value = desc;
  localStorage.setItem('productDesc', desc);
  showToast(`"${name}" añadido`);
};

/* ══ PERFILES POR TAMAÑO ══ */
window.loadProfile = function(key) {
  const activeProduct = localStorage.getItem('activeProduct') || 'pellets';
  let desc = '';
  if (activeProduct === 'pellets' && PELLET_PROFILES[key]) {
    desc = PELLET_PROFILES[key];
  } else {
    const custom = JSON.parse(localStorage.getItem('customProducts') || '{}');
    desc = custom[activeProduct]?.desc || qs('#productDesc').value || '';
  }
  if (key !== 'custom' && desc) { qs('#productDesc').value = desc; localStorage.setItem('productDesc', desc); }
  if (['4','8','12'].includes(key)) {
    qs('#sizeMode').value = 'single';
    qs('#singleSizeWrap').style.display = 'block';
    qs('#singleSize').value = key;
    localStorage.setItem('sizeMode', 'single');
    localStorage.setItem('singleSize', key);
  }
  localStorage.setItem('activeProfile', key);
  highlightProfile(key);
  showToast(key === 'custom' ? 'Perfil personalizado' : `Perfil ${key}mm cargado`);
};

function highlightProfile(key) {
  qsa('.prof-btn').forEach(b => {
    const active = b.dataset.key === key;
    b.style.background  = active ? 'var(--blue-dim)' : '';
    b.style.borderColor = active ? 'var(--blue)' : '';
    b.style.color       = active ? 'var(--blue)' : '';
  });
}

/* ══ CARGA IMAGEN ══ */
window.loadCount = function(e) {
  const f = e.target.files[0]; if (!f) return;
  lastImageMime = f.type || 'image/jpeg';
  const reader  = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const canvas = qs('#cvCount');
      const maxW   = Math.min(window.innerWidth - 28, 800);
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      qs('#wrapCount').style.display = 'block';
      qs('#btnRecount').style.display = '';
      lastImageBase64 = ev.target.result.split(',')[1];
      runCountAI();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(f);
};

window.rerun = window.runCount = runCountAI;

/* ══ CLAUDE VISION ══ */
async function runCountAI() {
  if (!lastImageBase64 || isAnalyzing) return;
  const apiKey = getApiKey();
  if (!apiKey) { showToast('Introduce tu API key en ⚙️ Ajustes', true); switchTab('settings'); return; }

  isAnalyzing = true;
  qs('#analyzeSpinner').style.display = 'block';
  qs('#btnRecount').disabled = true;
  setStatus('statusCount', '🔍 Claude está analizando la imagen…');
  qs('#statusCount').style.color = '';
  qs('#albaranResult').style.display = 'none';
  qs('#resultsCount').style.display  = 'none';
  qs('#exportBox').style.display     = 'none';

  const productDesc = qs('#productDesc').value.trim() || PELLET_PROFILES['8'];
  const sizeMode    = qs('#sizeMode').value;
  const singleSize  = qs('#singleSize').value;
  const albaranQty  = parseInt(qs('#albaranQty').value) || 0;

  const sizeInstruction = sizeMode === 'single'
    ? `Todos los objetos son del mismo tamaño (${singleSize}mm). Devuelve small=0, large=0 y pon el total en medium.`
    : `Clasifica por tamaño: pequeños (~4mm) en "small", medianos (~8mm) en "medium", grandes (~12mm) en "large".`;

  const prompt = `Eres un sistema experto de conteo industrial de precisión máxima.

OBJETO A CONTAR: ${productDesc}

${sizeInstruction}

REGLAS ABSOLUTAS:
1. Cuenta ÚNICAMENTE los objetos descritos. Ignora hilos, cables, algodón, fondo, sombras.
2. Si objetos se tocan o solapan, cuenta cada uno individualmente.
3. Incluye objetos parcialmente visibles si se ve más del 50%.
4. Esta cuenta verifica albaranes comerciales — la precisión es crítica económicamente.

RESPONDE EXCLUSIVAMENTE CON ESTE JSON. CERO palabras antes o después. CERO markdown:
{"small":0,"medium":0,"large":0,"total":0,"confidence":"alta","notes":null}

Sustituye los 0 por los conteos reales. confidence: "alta" "media" o "baja". notes: string o null.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
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
          { type: 'text',  text: prompt }
        ]}]
      })
    });

    if (!res.ok) { const err = await res.json(); throw new Error(err.error?.message || `HTTP ${res.status}`); }

    const data = await res.json();
    let text = data.content[0].text.trim().replace(/```json|```/g, '').trim();
    if (!text.startsWith('{')) {
      const m = text.match(/\{[\s\S]*?"total"[\s\S]*?\}/);
      if (m) text = m[0]; else throw new Error('La IA no devolvió JSON. Pulsa "Analizar de nuevo".');
    }
    const result = JSON.parse(text);
    const total  = result.total || (result.small||0) + (result.medium||0) + (result.large||0);

    /* ── asignar columna correcta según tamaño seleccionado ── */
    counts = { c4: 0, c8: 0, c12: 0, total };
    if (sizeMode === 'single') {
      if      (singleSize === '4')  counts.c4  = total;
      else if (singleSize === '12') counts.c12 = total;
      else                          counts.c8  = total;
    } else {
      counts.c4  = result.small  || 0;
      counts.c8  = result.medium || 0;
      counts.c12 = result.large  || 0;
    }

    /* ── UI ── */
    if (sizeMode === 'single') {
      qs('#c4').textContent  = singleSize === '4'  ? total : '—';
      qs('#c8').textContent  = singleSize === '8'  ? total : '—';
      qs('#c12').textContent = singleSize === '12' ? total : '—';
    } else {
      qs('#c4').textContent  = counts.c4;
      qs('#c8').textContent  = counts.c8;
      qs('#c12').textContent = counts.c12;
    }
    qs('#cT').textContent = total;

    /* ── verificación albarán ── */
    if (albaranQty > 0) {
      const diff  = total - albaranQty;
      const albEl = qs('#albaranResult');
      albEl.style.display = 'block';
      if (diff === 0)    albEl.innerHTML = `<span style="color:#3ecf8e">✓ COINCIDE con albarán (${albaranQty} uds)</span>`;
      else if (diff < 0) albEl.innerHTML = `<span style="color:#f97316">⚠️ FALTAN ${Math.abs(diff)} uds (albarán: ${albaranQty})</span>`;
      else               albEl.innerHTML = `<span style="color:#f59e0b">ℹ️ SOBRAN ${diff} uds (albarán: ${albaranQty})</span>`;
    }

    const confColor = result.confidence==='alta' ? '#3ecf8e' : result.confidence==='media' ? '#f59e0b' : '#f97316';
    setStatus('statusCount', `✓ ${total} detectados · Confianza: ${result.confidence}${result.notes ? ' · ' + result.notes : ''}`);
    qs('#statusCount').style.color = confColor;

    drawOverlay(total, result.confidence);
    qs('#resultsCount').style.display = 'block';
    qs('#exportBox').style.display    = 'block';
    buildOdoo();

    saveHistoryEntry({
      date: new Date().toLocaleDateString('es-ES') + ' ' + new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),
      total, size4: counts.c4, size8: counts.c8, size12: counts.c12,
      product: productDesc.slice(0, 60), confidence: result.confidence,
      notes: result.notes, albaran: albaranQty || null, odoo: buildOdooText()
    });

  } catch(err) {
    setStatus('statusCount', '✗ ' + err.message, '#f97316');
    showToast(err.message, true);
  } finally {
    isAnalyzing = false;
    qs('#btnRecount').disabled = false;
    qs('#analyzeSpinner').style.display = 'none';
  }
}

function drawOverlay(total, confidence) {
  const canvas = qs('#cvCount'), ctx = canvas.getContext('2d');
  const col = confidence==='alta'?'#3ecf8e':confidence==='media'?'#f59e0b':'#f97316';
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(10,10,175,58,10); else ctx.rect(10,10,175,58);
  ctx.fill();
  ctx.fillStyle='#fff'; ctx.font='bold 26px -apple-system,sans-serif'; ctx.fillText(`${total} uds`,20,44);
  ctx.fillStyle=col;    ctx.font='12px -apple-system,sans-serif';       ctx.fillText(`Confianza ${confidence}`,20,60);
}

/* ══ EXPORT ODOO ══ */
function buildOdooText() {
  const prov=qs('#exProveedor')?.value||'—', po=qs('#exPO')?.value||'—';
  const pref=qs('#exLote')?.value||'P', ubic=qs('#exUbic')?.value||'WH/Stock';
  const alb=qs('#albaranQty')?.value||'—';
  const now=new Date(), seq=Math.floor(Math.random()*900)+100, pad=n=>String(n).padStart(3,'0');
  const mode=qs('#sizeMode')?.value||'single', sz=qs('#singleSize')?.value||'8';
  const albNum=parseInt(qs('#albaranQty')?.value)||0;
  const diff=albNum>0?counts.total-albNum:null;
  const lines=[
    '=== RECEPCIÓN PELLETS — VERIFICADO IA ===',
    `Fecha:        ${now.toLocaleDateString('es-ES')}  ${now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}`,
    `Proveedor:    ${prov}`,`PO:           ${po}`,`Ubicación:    ${ubic}`,`Albarán:      ${alb} uds`,'---',
  ];
  if (mode==='single') {
    lines.push(`Pellet ${sz}mm   |  Lote: ${pref}-${sz}MM-${pad(seq)}  |  Cant: ${counts.total}`);
  } else {
    if (counts.c4>0)  lines.push(`Pellet  4mm  |  Lote: ${pref}-4MM-${pad(seq)}    |  Cant: ${counts.c4}`);
    if (counts.c8>0)  lines.push(`Pellet  8mm  |  Lote: ${pref}-8MM-${pad(seq+1)}  |  Cant: ${counts.c8}`);
    if (counts.c12>0) lines.push(`Pellet 12mm  |  Lote: ${pref}-12MM-${pad(seq+2)} |  Cant: ${counts.c12}`);
  }
  lines.push('---',`Total:        ${counts.total} uds`);
  if (diff!==null) lines.push(diff===0?'✓ COINCIDE con albarán':diff<0?`⚠️ FALTAN ${Math.abs(diff)} uds`:`ℹ️ SOBRAN ${diff} uds`);
  lines.push(`Motor:        Claude Vision AI ${VERSION}`);
  return lines.join('\n');
}
window.buildOdoo = function() { const el=qs('#odooBlock'); if(el) el.textContent=buildOdooText(); };
window.copyOdoo  = function() { navigator.clipboard.writeText(buildOdooText()).then(()=>showToast('Copiado ✓')); };

/* ══ GRAVIMÉTRICO ══ */
function initGrav() {
  const w=JSON.parse(localStorage.getItem('unitWeights')||'{}');
  if(qs('#w4'))  qs('#w4').value =w.p4  ||UNIT_WEIGHTS.p4;
  if(qs('#w8'))  qs('#w8').value =w.p8  ||UNIT_WEIGHTS.p8;
  if(qs('#w12')) qs('#w12').value=w.p12 ||UNIT_WEIGHTS.p12;
}
window.calcGrav=function(){
  const size=qs('#gravSize').value, total=parseFloat(qs('#gravTotal').value), tare=parseFloat(qs('#gravTare').value)||0;
  const w4=parseFloat(qs('#w4').value)||UNIT_WEIGHTS.p4, w8=parseFloat(qs('#w8').value)||UNIT_WEIGHTS.p8, w12=parseFloat(qs('#w12').value)||UNIT_WEIGHTS.p12;
  localStorage.setItem('unitWeights',JSON.stringify({p4:w4,p8:w8,p12:w12}));
  if(!total||total<=0){setStatus('statusGrav','Introduce el peso total.');return;}
  const netW=total-tare; if(netW<=0){setStatus('statusGrav','Peso neto 0.');return;}
  const unitW=size==='4'?w4:size==='8'?w8:w12, qty=Math.round(netW/unitW);
  counts={c4:size==='4'?qty:0,c8:size==='8'?qty:0,c12:size==='12'?qty:0,total:qty};
  qs('#gravQty').textContent=qty.toLocaleString('es-ES');
  qs('#gravNet').textContent=netW.toFixed(3)+' g';
  qs('#gravUnit').textContent=unitW.toFixed(3)+' g';
  qs('#gravResult').style.display='block';
  qs('#exportBoxGrav').style.display='block';
  buildOdooGrav(size,qty);
  setStatus('statusGrav',`Resultado: ${qty.toLocaleString('es-ES')} uds pellet ${size}mm`);
};
function buildOdooGrav(size,qty){
  const prov=qs('#gExProveedor').value||'—',po=qs('#gExPO').value||'—',pref=qs('#gExLote').value||'P',ubic=qs('#gExUbic').value||'WH/Stock';
  const now=new Date(),seq=Math.floor(Math.random()*900)+100,pad=n=>String(n).padStart(3,'0');
  const net=(parseFloat(qs('#gravTotal').value||0)-(parseFloat(qs('#gravTare').value)||0)).toFixed(3);
  qs('#odooBlockGrav').textContent=[
    '=== RECEPCIÓN PELLETS (GRAVIMÉTRICO) ===',
    `Fecha:        ${now.toLocaleDateString('es-ES')}  ${now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}`,
    `Proveedor:    ${prov}`,`PO:           ${po}`,`Ubicación:    ${ubic}`,'---',
    `Pellet ${size}mm   |  Lote: ${pref}-${size}MM-${pad(seq)}  |  Cant: ${qty.toLocaleString('es-ES')}`,
    '---',`Peso neto:    ${net} g`,`Motor:        báscula de precisión`,
  ].join('\n');
}
window.updateOdooGrav=function(){const size=qs('#gravSize').value,qty=parseInt(qs('#gravQty').textContent.replace(/\D/g,''))||0;if(qty>0)buildOdooGrav(size,qty);};
window.copyOdooGrav=function(){navigator.clipboard.writeText(qs('#odooBlockGrav').textContent).then(()=>showToast('Copiado ✓'));};

/* ══ HISTORIAL ══ */
function loadHistory(){return JSON.parse(localStorage.getItem('analysisHistory')||'[]');}
function saveHistoryEntry(entry){
  const h=loadHistory();h.unshift(entry);
  if(h.length>50)h.pop();
  localStorage.setItem('analysisHistory',JSON.stringify(h));
  updateHistoryBadge();
}
function updateHistoryBadge(){const h=loadHistory(),b=qs('#historyBadge');if(b)b.textContent=h.length>0?h.length:'';}
window.renderHistory=function(){
  const el=qs('#historyList');if(!el)return;
  const h=loadHistory();
  if(h.length===0){el.innerHTML='<p style="color:var(--muted);font-size:13px;text-align:center;padding:24px">Sin análisis aún</p>';return;}
  el.innerHTML=h.map((e,i)=>{
    const col=e.confidence==='alta'?'#3ecf8e':e.confidence==='media'?'#f59e0b':'#f97316';
    return `<div style="background:var(--surface);border:0.5px solid var(--border);border-radius:var(--radius);padding:12px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
        <span style="font-size:15px;font-weight:700">${e.total} uds</span>
        <span style="font-size:10px;padding:2px 8px;border-radius:10px;background:${col}22;color:${col};font-weight:700">${e.confidence||'—'}</span>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:4px">${e.date}</div>
      ${e.notes?`<div style="font-size:11px;color:var(--hint);font-style:italic;margin-bottom:6px">${e.notes}</div>`:''}
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px">
        ${e.size4>0?`<span style="font-size:11px;color:#4a9eff">4mm:${e.size4}</span>`:''}
        ${e.size8>0?`<span style="font-size:11px;color:#3ecf8e">8mm:${e.size8}</span>`:''}
        ${e.size12>0?`<span style="font-size:11px;color:#f97316">12mm:${e.size12}</span>`:''}
        ${e.albaran?`<span style="font-size:11px;color:var(--muted)">Albarán:${e.albaran}</span>`:''}
      </div>
      ${e.odoo?`<button onclick="copyHistEntry(${i})" style="font-size:11px;padding:5px 10px">📋 Copiar Odoo</button>`:''}
    </div>`;
  }).join('');
};
window.copyHistEntry=function(i){const h=loadHistory();if(h[i]?.odoo)navigator.clipboard.writeText(h[i].odoo).then(()=>showToast('Copiado ✓'));};
window.clearHistory=function(){if(!confirm('¿Borrar todo el historial?'))return;localStorage.removeItem('analysisHistory');updateHistoryBadge();renderHistory();};

/* ══ PWA ══ */
let deferredPrompt;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;const b=qs('#installBanner');if(b)b.style.display='flex';});
qs('#installBtn')&&qs('#installBtn').addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;qs('#installBanner').style.display='none';});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));

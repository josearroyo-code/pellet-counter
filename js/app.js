/* ── Pellet Counter v4 — algoritmo mejorado sin OpenCV ── */
let imgCount = null, imgCalib = null;
let runTimer = null;
let coinMm = 23.25;
let calibScale = null, calibThresholds = null;
let counts = { c4: 0, c8: 0, c12: 0 };

const qs  = s => document.querySelector(s);
const qsa = s => document.querySelectorAll(s);

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
  el.classList.add('selected'); coinMm = mm;
  qs('#customMm').value = '';
};

window.customCoin = function(v) {
  const f = parseFloat(v);
  if (f > 0) { coinMm = f; qsa('.coin-btn').forEach(b => b.classList.remove('selected')); }
};

/* ══════════════════════════════════════════════════════
   NÚCLEO DE DETECCIÓN v4
   1. Umbral dinámico por histograma (Otsu adaptado)
   2. Mapa de gradiente para encontrar bordes reales
   3. Hough circle transform simplificado en canvas
   4. Filtro de circularidad para eliminar fantasmas
   5. Non-maximum suppression por distancia
   ══════════════════════════════════════════════════════ */

function toGray(data, w, h) {
  const g = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++)
    g[i] = (77*data[i*4] + 150*data[i*4+1] + 29*data[i*4+2]) >> 8;
  return g;
}

function gaussianBlur(g, w, h) {
  const out = new Uint8Array(w * h);
  const k = [1,2,1,2,4,2,1,2,1];
  for (let y=1; y<h-1; y++) for (let x=1; x<w-1; x++) {
    let s=0;
    for (let ky=-1; ky<=1; ky++) for (let kx=-1; kx<=1; kx++)
      s += g[(y+ky)*w+(x+kx)] * k[(ky+1)*3+(kx+1)];
    out[y*w+x] = s >> 4;
  }
  return out;
}

function otsuThreshold(g, w, h) {
  const hist = new Int32Array(256);
  for (let i=0; i<w*h; i++) hist[g[i]]++;
  const total = w*h;
  let sum=0; for (let i=0;i<256;i++) sum+=i*hist[i];
  let sumB=0, wB=0, max=0, thresh=0;
  for (let i=0;i<256;i++) {
    wB+=hist[i]; if(!wB) continue;
    const wF=total-wB; if(!wF) break;
    sumB+=i*hist[i];
    const mB=sumB/wB, mF=(sum-sumB)/wF;
    const between=wB*wF*(mB-mF)*(mB-mF);
    if(between>max){max=between;thresh=i;}
  }
  return thresh;
}

function gradientMag(g, w, h) {
  const mag = new Uint8Array(w * h);
  for (let y=1;y<h-1;y++) for (let x=1;x<w-1;x++) {
    const gx = -g[(y-1)*w+(x-1)] - 2*g[y*w+(x-1)] - g[(y+1)*w+(x-1)]
               +g[(y-1)*w+(x+1)] + 2*g[y*w+(x+1)] + g[(y+1)*w+(x+1)];
    const gy = -g[(y-1)*w+(x-1)] - 2*g[(y-1)*w+x] - g[(y-1)*w+(x+1)]
               +g[(y+1)*w+(x-1)] + 2*g[(y+1)*w+x] + g[(y+1)*w+(x+1)];
    mag[y*w+x] = Math.min(255, Math.sqrt(gx*gx+gy*gy) >> 1);
  }
  return mag;
}

function detectCirclesV4(canvas, minR, maxR, minDist, sensitivityPct) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const raw = ctx.getImageData(0,0,w,h).data;

  const gray    = toGray(raw, w, h);
  const blurred = gaussianBlur(gray, w, h);
  const otsu    = otsuThreshold(blurred, w, h);
  const mag     = gradientMag(blurred, w, h);

  /* umbral de borde adaptativo */
  const edgeThr = Math.max(15, Math.round(otsu * 0.25 * (1 - sensitivityPct/100)));

  /* acumulador Hough simplificado */
  const acc = new Float32Array(w * h);
  const step = Math.max(1, Math.floor(minR / 3));

  for (let y=maxR; y<h-maxR; y+=step) {
    for (let x=maxR; x<w-maxR; x+=step) {
      if (mag[y*w+x] < edgeThr) continue;
      for (let r=minR; r<=maxR; r+=Math.max(1,Math.floor(r*0.12))) {
        const samples = Math.max(20, Math.floor(2*Math.PI*r/2));
        let edgeVotes=0;
        for (let s=0; s<samples; s++) {
          const a = (2*Math.PI*s)/samples;
          const cx = Math.round(x - r*Math.cos(a));
          const cy = Math.round(y - r*Math.sin(a));
          if (cx<0||cx>=w||cy<0||cy>=h) continue;
          acc[cy*w+cx] += 1/samples;
        }
      }
    }
  }

  /* encontrar picos en acumulador */
  const minScore = 0.18 * (1 - sensitivityPct/200);
  const candidates = [];
  for (let y=maxR; y<h-maxR; y++) for (let x=maxR; x<w-maxR; x++) {
    if (acc[y*w+x] < minScore) continue;
    /* verificar que es máximo local */
    let isMax = true;
    for (let dy=-3; dy<=3 && isMax; dy++)
      for (let dx=-3; dx<=3 && isMax; dx++)
        if (dx||dy) if (acc[(y+dy)*w+(x+dx)] > acc[y*w+x]) isMax=false;
    if (!isMax) continue;

    /* encontrar radio más probable para este centro */
    let bestR=minR, bestRScore=0;
    for (let r=minR; r<=maxR; r+=Math.max(1,Math.floor(r*0.1))) {
      const samples = Math.max(20, Math.floor(2*Math.PI*r/2));
      let edgeCount=0, totalSamples=0;
      for (let s=0; s<samples; s++) {
        const a = (2*Math.PI*s)/samples;
        const px = Math.round(x + r*Math.cos(a));
        const py = Math.round(y + r*Math.sin(a));
        if (px<0||px>=w||py<0||py>=h) continue;
        totalSamples++;
        if (mag[py*w+px] >= edgeThr) edgeCount++;
      }
      const score = totalSamples>0 ? edgeCount/totalSamples : 0;
      if (score > bestRScore) { bestRScore=score; bestR=r; }
    }

    /* filtro de circularidad — descartar si < 25% del borde es real */
    if (bestRScore < 0.22) continue;

    /* verificar interior más claro o más oscuro que exterior (objeto real) */
    const innerVal = blurred[y*w+x];
    const outerX = Math.round(x + bestR*1.6);
    const outerY = y;
    const outerVal = (outerX<w) ? blurred[outerY*w+outerX] : 0;
    const contrast = Math.abs(innerVal - outerVal);
    if (contrast < 12) continue;

    candidates.push({ x, y, r: bestR, score: acc[y*w+x] * bestRScore });
  }

  /* non-maximum suppression */
  candidates.sort((a,b) => b.score - a.score);
  const kept = [];
  for (const c of candidates) {
    let tooClose = false;
    for (const k of kept) {
      if (Math.sqrt((c.x-k.x)**2+(c.y-k.y)**2) < minDist) { tooClose=true; break; }
    }
    if (!tooClose) kept.push(c);
  }
  return kept;
}

/* ── cargar y contar ── */
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

window.rerun = function() { clearTimeout(runTimer); runTimer = setTimeout(runCount, 350); };

function getThresholds() { return calibThresholds || { t4:22, t8:45, t12:85 }; }

window.runCount = function() {
  if (!imgCount) return;
  setStatus('statusCount', 'Analizando imagen…');

  const canvas = qs('#cvCount');
  const maxW = Math.min(window.innerWidth - 32, 720);
  let w = imgCount.naturalWidth, h = imgCount.naturalHeight;
  if (w > maxW) { h = Math.round(h*maxW/w); w = maxW; }
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(imgCount, 0, 0, w, h);

  const th     = getThresholds();
  const sens   = parseInt(qs('#p1').value);
  const minR   = parseInt(qs('#p2').value);
  const maxR   = parseInt(qs('#p3').value);
  const minD   = parseInt(qs('#p4').value);

  setStatus('statusCount', 'Calculando… (puede tardar 2-3 seg en móvil)');

  setTimeout(() => {
    try {
      const circles = detectCirclesV4(canvas, minR, maxR, minD, sens);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgCount, 0, 0, w, h);

      let c4=0, c8=0, c12=0, cO=0;
      for (const c of circles) {
        let color;
        if      (c.r <= th.t4)  { c4++;  color='#4a9eff'; }
        else if (c.r <= th.t8)  { c8++;  color='#3ecf8e'; }
        else if (c.r <= th.t12) { c12++; color='#f97316'; }
        else                    { cO++;  color='#555552'; }
        ctx.strokeStyle=color; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(c.x,c.y,c.r,0,2*Math.PI); ctx.stroke();
        ctx.fillStyle=color;
        ctx.beginPath(); ctx.arc(c.x,c.y,3,0,2*Math.PI); ctx.fill();
      }

      counts={c4,c8,c12};
      qs('#c4').textContent=c4; qs('#c8').textContent=c8;
      qs('#c12').textContent=c12; qs('#cT').textContent=c4+c8+c12;
      qs('#resultsCount').style.display='block';
      qs('#exportBox').style.display='block';
      buildOdoo();

      const extra = cO>0 ? ` · ${cO} fuera de rango`:'' ;
      setStatus('statusCount',`${c4+c8+c12+cO} detectados${extra} · azul=4mm · verde=8mm · naranja=12mm`);
    } catch(err) { setStatus('statusCount','Error: '+err.message); }
  }, 80);
};

/* ── exportación Odoo ── */
window.buildOdoo = function() {
  const prov=qs('#exProveedor').value||'—', po=qs('#exPO').value||'—';
  const pref=qs('#exLote').value||'P', ubic=qs('#exUbic').value||'WH/Stock';
  const now=new Date();
  const fecha=now.toLocaleDateString('es-ES');
  const hora=now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
  const seq=Math.floor(Math.random()*900)+100;
  const pad=n=>String(n).padStart(3,'0');
  qs('#odooBlock').textContent=[
    '=== RECEPCIÓN DE PELLETS ===',
    `Fecha:       ${fecha}  ${hora}`,
    `Proveedor:   ${prov}`,`PO:          ${po}`,`Ubicación:   ${ubic}`,'---',
    `Pellet  4mm  |  Lote: ${pref}-4MM-${pad(seq)}    |  Cant: ${counts.c4}`,
    `Pellet  8mm  |  Lote: ${pref}-8MM-${pad(seq+1)}  |  Cant: ${counts.c8}`,
    `Pellet 12mm  |  Lote: ${pref}-12MM-${pad(seq+2)} |  Cant: ${counts.c12}`,'---',
    `Total:       ${counts.c4+counts.c8+counts.c12} uds`,
    `Verificado:  visión artificial v4`,
  ].join('\n');
};

window.copyOdoo = function() {
  navigator.clipboard.writeText(qs('#odooBlock').textContent).then(()=>{
    const m=qs('#copiedMsg'); m.style.display='inline';
    setTimeout(()=>m.style.display='none',2200);
  });
};

/* ── calibración por expansión radial ── */
window.loadCalib = function(e) {
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=ev=>{
    imgCalib=new Image();
    imgCalib.onload=()=>{ renderCalibCanvas(); setStatus('statusCalib','Toca el centro de la moneda.'); };
    imgCalib.src=ev.target.result;
  };
  r.readAsDataURL(f);
};

function renderCalibCanvas() {
  const canvas=qs('#cvCalib');
  const maxW=Math.min(window.innerWidth-32,720);
  let w=imgCalib.naturalWidth,h=imgCalib.naturalHeight;
  if(w>maxW){h=Math.round(h*maxW/w);w=maxW;}
  canvas.width=w;canvas.height=h;
  canvas.getContext('2d').drawImage(imgCalib,0,0,w,h);
  qs('#wrapCalib').style.display='block';
  canvas.onclick=onCalibClick;
}

function onCalibClick(e) {
  const canvas=qs('#cvCalib');
  const rect=canvas.getBoundingClientRect();
  const sx=canvas.width/rect.width, sy=canvas.height/rect.height;
  const cx=Math.round((e.clientX-rect.left)*sx);
  const cy=Math.round((e.clientY-rect.top)*sy);
  setStatus('statusCalib','Midiendo radio de la moneda…');

  const ctx=canvas.getContext('2d');
  ctx.drawImage(imgCalib,0,0,canvas.width,canvas.height);
  const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const w=canvas.width,h=canvas.height;

  const getBr=(x,y)=>{
    if(x<0||x>=w||y<0||y>=h) return 0;
    const i=(y*w+x)*4;
    return (77*data[i]+150*data[i+1]+29*data[i+2])>>8;
  };

  const cb=getBr(cx,cy);
  if(cb<40){setStatus('statusCalib','Zona muy oscura. Toca sobre la moneda.');return;}

  const radii=[];
  for(let i=0;i<48;i++){
    const a=(2*Math.PI*i)/48;
    for(let r=3;r<250;r++){
      const px=Math.round(cx+r*Math.cos(a));
      const py=Math.round(cy+r*Math.sin(a));
      if(getBr(px,py)<cb*0.5){radii.push(r);break;}
    }
  }

  if(radii.length<12){setStatus('statusCalib','No pude medir. Toca más cerca del centro.');return;}
  radii.sort((a,b)=>a-b);
  const medR=radii[Math.floor(radii.length/2)];

  ctx.strokeStyle='#4a9eff';ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(cx,cy,medR,0,2*Math.PI);ctx.stroke();
  ctx.fillStyle='#4a9eff';ctx.beginPath();ctx.arc(cx,cy,4,0,2*Math.PI);ctx.fill();

  const pxPerMm=medR/(coinMm/2);
  calibScale=pxPerMm;
  const t4=Math.round(pxPerMm*4/2*1.3);
  const t8=Math.round(pxPerMm*8/2*1.3);
  const t12=Math.round(pxPerMm*12/2*1.3);
  calibThresholds={t4,t8,t12};

  qs('#scaleVal').textContent=pxPerMm.toFixed(2);
  qs('#t4v').textContent=t4;qs('#t8v').textContent=t8;qs('#t12v').textContent=t12;
  qs('#calibResult').style.display='block';
  setStatus('statusCalib',`Escala: ${pxPerMm.toFixed(2)} px/mm · radio: ${medR}px · pulsa "Aplicar".`);
}

window.applyCalib=function(){
  if(!calibThresholds) return;
  qs('#p2').value=Math.max(3,Math.round(calibThresholds.t4*0.35));
  qs('#p3').value=Math.min(300,calibThresholds.t12+20);
  qs('#v2').textContent=qs('#p2').value;
  qs('#v3').textContent=qs('#p3').value;
  const badge=qs('#scaleBadge');
  badge.textContent=calibScale.toFixed(1)+' px/mm';badge.style.display='inline-block';
  const info=qs('#calibInfo');
  info.style.display='block';
  info.innerHTML=`<strong>Calibración activa</strong> · ${calibScale.toFixed(2)} px/mm · 4mm≤${calibThresholds.t4}px · 8mm≤${calibThresholds.t8}px · 12mm≤${calibThresholds.t12}px`;
  localStorage.setItem('calibScale',calibScale);
  localStorage.setItem('calibThresholds',JSON.stringify(calibThresholds));
  switchTab('count');
  setStatus('statusCount','Calibración aplicada. Sube foto para contar.');
};

function restoreCalib(){
  const sc=localStorage.getItem('calibScale');
  const th=localStorage.getItem('calibThresholds');
  if(!sc||!th) return;
  calibScale=parseFloat(sc);calibThresholds=JSON.parse(th);
  const badge=qs('#scaleBadge');
  if(badge){badge.textContent=calibScale.toFixed(1)+' px/mm';badge.style.display='inline-block';}
  const info=qs('#calibInfo');
  if(info){info.style.display='block';info.innerHTML=`<strong>Calibración guardada</strong> · ${calibScale.toFixed(2)} px/mm`;}
  qs('#p2').value=Math.max(3,Math.round(calibThresholds.t4*0.35));
  qs('#p3').value=Math.min(300,calibThresholds.t12+20);
  qs('#v2').textContent=qs('#p2').value;
  qs('#v3').textContent=qs('#p3').value;
}

/* ── PWA ── */
let deferredPrompt;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;qs('#installBanner').style.display='flex';});
qs('#installBtn')&&qs('#installBtn').addEventListener('click',async()=>{
  if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;
  deferredPrompt=null;qs('#installBanner').style.display='none';
});
if('serviceWorker'in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));

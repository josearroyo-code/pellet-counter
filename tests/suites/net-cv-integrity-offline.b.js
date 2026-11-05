// SUITE: net-cv-integrity-offline.b
// pagina auxiliar (iframe sin red) de net-cv-integrity-offline
// @aux
/* iframe: misma origen, sin red hacia jsdelivr → carga desde Cache Storage */
window.addEventListener('load', async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const realFetch = window.fetch;
  window.fetch = (u, o) => String(u).includes('jsdelivr') ? Promise.reject(new TypeError('offline')) : realFetch(u, o);
  cvLoad();
  const t0 = Date.now();
  while (Date.now() - t0 < 60000 && !/listo|No se pudo/.test(document.getElementById('cvStatus').textContent)) await sleep(200);
  const pre = document.createElement('pre'); pre.id = 'res'; pre.textContent = document.getElementById('cvStatus').textContent; document.body.appendChild(pre);
  document.title = 'IFR:done';
});

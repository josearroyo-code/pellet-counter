/* ══════════════════════════════════════════
   Pellet Counter v8.1 — cámara nativa en Windows/desktop/Surface
   PATCH CÁMARA: botón "🔄 Cambiar cámara" (`switchCamera`) — tras
          conceder el permiso se enumeran las cámaras disponibles
          (enumerateDevices) y, si hay más de una, el botón aparece
          para alternar entre ellas por deviceId. facingMode:
          {ideal:'environment'} ya pedía la trasera con fallback
          automático a cualquier otra cámara disponible — eso no era
          nuevo de este patch, ya estaba así en la primera versión de
          v8.1 (constraint "ideal", no "exact": el navegador no falla
          si no hay trasera, usa la que haya). VERSION se mantiene en
          'v8.1' (no se muestra un número nuevo) — solo se bumpea
          CACHE en sw.js, mismo patrón que v7.5.1/v7.6.1/v7.8.1.
   NUEVO: en Android/iOS (detectado por user-agent) todo sigue igual
          — el <input capture="environment"> sigue abriendo la cámara
          nativa del sistema, sin cambios. En cualquier otra
          plataforma (Windows/desktop/Surface, donde ese atributo no
          hace nada), la upload-zone se sustituye por dos botones:
          "📁 Subir desde archivo" (selector de archivo normal, sin
          capture) y "📷 Usar cámara" (getUserMedia con su propio
          <video>/<canvas>, overlay a pantalla completa). Mismo flujo
          en foto única y en multifoto — ambas comparten el modal de
          cámara (`openCameraModal(modo)`) y la lógica de captura
          (`processSinglePhotoDataUrl`/`addPhotoToMultifoto`, ambas
          extraídas de loadCount()/addMultiFoto() para reutilizarse).
          Si se deniega el permiso o el navegador no soporta cámara,
          se avisa y se sugiere usar "Subir desde archivo". En
          landscape ≥1024px el preview ocupa la columna izquierda
          (mín. 400px alto) y los controles la derecha, igual que el
          resto de layouts de dos columnas de la app desde v7.9.7.
   v8.0: NUEVO: Ajustes → "🔄 Sincronización entre dispositivos" —
          exportAllData() descarga un JSON (historial, ejemplos,
          pesos unitarios, perfiles/productos personalizados y el
          estado de tamaño activo) con nombre
          pellet-counter-backup-YYYY-MM-DD.json; importAllData() lee
          ese JSON, muestra un resumen (nº análisis + ejemplos por
          tamaño) y pide confirmación antes de sobrescribir, luego
          recarga la página para que todo se re-renderice desde el
          localStorage importado. La API key se excluye a propósito
          del export — es una credencial por dispositivo, y el flujo
          previsto (mandar el JSON por WhatsApp/email) la expondría
          en texto plano si se incluyera. Ver SYNC_KEYS/SYNC_JSON_KEYS.
   v7.9.9: FIX REAL (con datos A/B del usuario): la MISMA foto daba 52/52 por
          foto única y 62/52 (+10) por multifoto. Eso confirmó que el
          problema estaba en analyzeOneFoto(), no en los pellets ni
          el perfil. Causa real: el prompt de multifoto era menos
          riguroso que el de runCountAI() (sin técnica de cuadrícula
          ni REGLAS ABSOLUTAS) y afirmaba un rango fijo "20-30"
          potencialmente sesgado. Se alinea el prompt con el de foto
          única y se quita esa afirmación. La sospecha del usuario de
          que la imagen se reenviaba redimensionada a 400px en
          multifoto se descartó leyendo el código: ese resize
          (EXAMPLE_MAX_DIM) solo se usa al guardar un ejemplo
          few-shot, nunca en el envío a analizar.
   NUEVO: captura de console.log/console.error en memoria + botón
          "🔍 Ver último log" en Ajustes, para depurar sin DevTools en
          el móvil (copiar/limpiar incluido).
   NUEVO: console.log de prompt (primeros 200 car.) y tamaño de
          imagen en ambos flujos (foto única y multifoto), para poder
          compararlos directamente en el log.
   FIX: "Confirmar total" duplicaba la entrada en Historial — guarda
          multiConfirmed (con auto-reset a los 600ms, no permanente,
          para no bloquear una segunda confirmación legítima tras
          añadir más fotos al mismo lote) más onclick directo en el
          botón además de la delegación de v7.9.8, por si acaso.
   v7.9.8: FIX CRÍTICO: "✓ Confirmar total" no respondía en Android real. El
          onclick inline en el HTML se sustituyó por delegación de
          eventos en document (DOMContentLoaded) — pedido así
          explícitamente, aunque #btnMultiConfirm nunca se recrea
          dinámicamente (es markup estático); la delegación es de
          todas formas más robusta y es lo que se pidió.
   NUEVO: card destacada "📦 Bote vacío: 47.86 g" en tab Pesar —
          siempre visible, sin colapsar, con borde azul.
   NUEVO: tercer intento contra "condensadores cerámicos" en
          multifoto — línea "IMPORTANTE" explícita al principio del
          prompt de analyzeOneFoto(), antes del perfil, nombrando
          los componentes concretos con los que se confunde.
   NUEVO: texto instructivo de multifoto reescrito en 3 pasos
          numerados más claros.
   NUEVO: la etiqueta del ajuste global del total aclara que es
          "solo si es necesario" y que primero hay que usar la
          corrección por foto — para no confundirlo con el ±1 por
          foto, que es el método principal.
   NUEVO: el desglose por foto en Historial ahora guarda {ai,total}
          por foto (no solo el total final), así se puede mostrar
          qué fotos se corrigieron y cuánto, ej. "F1: 54→51 (-3)".
          Compatible con entradas v7.9.6/v7.9.7 (solo número).
   v7.9.7: NUEVO: PELLET_PROFILES['4'] añade un aviso anti-sobreconteo —
          ante la duda entre N y N+1, elegir el menor; ser
          conservador con zonas oscuras de pellets muy juntos.
   SIMPLIFICADO: la card "Referencia del bote" en tab Pesar perdió el
          bloque de avisos "⚠️ IMPORTANTE" y el procedimiento en 5
          pasos — ahora es solo una línea con el peso del bote vacío
          (toggleBoteRef/initBoteRef se eliminaron, ya no hay nada
          que colapsar).
   NUEVO: adaptación responsive a Surface Pro y tablets en general —
          nuevos breakpoints en index.html (tablet portrait 768-
          1024px: controles/inputs más grandes, áreas de toque
          ≥48px; tablet landscape >1024px: layout de dos columnas en
          Contar y Pesar, Historial en grid de 2 columnas; >1200px
          landscape: columna de foto fija/sticky mientras la de
          controles hace scroll propio). Sin cambios en JS más allá
          de un pequeño ajuste de tamaño en el input de corrección
          por foto de multifoto para que no herede el min-height:48px
          de los inputs normales.
   FIX: manifest.json tenía "orientation":"portrait", que bloquearía
          el layout horizontal en la PWA instalada en un Surface —
          cambiado a "orientation":"any".
   v7.9.6: FIX CRÍTICO: el refuerzo de PELLET_PROFILES de v7.9.5 no bastó —
          Claude seguía diciendo "condensadores cerámicos" en
          multifoto en pruebas reales. analyzeOneFoto() ya no vuelve
          a leer #productDesc en cada foto: usa un snapshot congelado
          en window._currentProductDesc, asignado una sola vez por
          lote en addMultiFoto() antes de programar ningún análisis,
          para eliminar cualquier posibilidad de lectura tardía del
          DOM mientras el lote se resuelve de forma asíncrona.
   FIX: miniaturas de multifoto en negro — el bug real era
          `f.base64.slice(0,100)` en el src de la imagen, que
          truncaba el base64 a un data-URI inválido. Ahora usa
          `URL.createObjectURL(file)` (blobUrl), revocada al borrar
          la foto o al reiniciar el lote.
   NUEVO: corrección de foto con rango amplio — junto a cada
          miniatura, campo numérico editable directamente (más los
          ±1 ya existentes para ajustes finos).
   NUEVO: corrección del total con rango amplio — el total acumulado
          de multifoto es ahora un campo numérico editable
          directamente (recalcula multiManualAdjust para que el ±1
          siga funcionando después).
   NUEVO: confianza de multifoto pasa a "media" si el total
          confirmado difiere de la suma de lo que Claude reportó
          originalmente por foto (antes de cualquier corrección
          manual, por foto o global) — igual que ya ocurre en visión
          de foto única.
   NUEVO: toast "✓ Total confirmado: N uds de Xmm" + scroll automático
          a los resultados al confirmar el total de multifoto.
   NUEVO: texto instructivo fijo encima de la lista de fotos en
          multifoto.
   NUEVO: desglose por foto en Historial para entradas de multifoto
          ("📷 Foto 1: N uds"), más visible que el antiguo "F1:N F2:N"
          comprimido en el campo notes — vía el nuevo campo
          `photoBreakdown`.
   v7.9.5: analyzeOneFoto() (multifoto) ya usaba el mismo productDesc que
          runCountAI (verificado) — se refuerza PELLET_PROFILES para
          que Claude no confunda los pellets con condensadores
          cerámicos (visualmente similares: disco pequeño + hilo).
          (Insuficiente — ver el FIX CRÍTICO de v7.9.6 arriba.)
   RETIRADO: toda la exportación a Odoo (Contar, Pesar, Historial) —
          código comentado con "// ODOO - pendiente de implementar"
          en vez de borrado, para poder recuperarlo fácilmente.
          Historial usa ahora "📋 Copiar resultado" en texto plano.
   NUEVO: botón "💾 Guardar pesada" explícito en Pesada rápida — ya
          NO se guarda automáticamente (se quita el debounce de 1.2s
          y el commit-on-change de v7.9.4), el operario decide qué
          guardar. El botón pasa a "✓ Guardado" 2s tras pulsarlo.
   NUEVO: corrección manual en Pesada rápida ahora se ve en Historial
          igual que en visión IA: "⚖️ 100 uds (calculado) → ✏️ 98 uds
          (-2 corregido)", vía el nuevo campo `calcTotal`.
   NUEVO: ajuste manual ±1 en multifoto — global sobre el total
          acumulado y también foto a foto en cada miniatura.
   PROTEGIDO: pesos unitarios (#w4/#w8/#w12) ya no son editables desde
          tab Pesar — se movieron a Ajustes → "Pesos unitarios", tras
          un PIN simple (1234, protección básica anti-error, no
          seguridad real). Pesar solo muestra los valores como texto.
   v7.9.4: peso unitario 4mm corregido a 0.071g/ud (antes 0.0811g,
          erróneo) — verificado con 2 básculas distintas, 7.10-7.11g
          para ~100 uds. Migración automática de localStorage una
          sola vez (migrateP4Weight) para que los dispositivos que ya
          tenían el valor viejo guardado se autocorrijan.
   NUEVO: card "📦 Referencia del bote" en tab Pesar (colapsable,
          expandida por defecto, estado guardado en localStorage) con
          peso de bote vacío, avisos de báscula y procedimiento en
          5 pasos.
   NUEVO: mensajes de precisión de Pesada rápida y tabla de Ajustes
          actualizados con el segundo test físico (4mm ±1/100, 8mm
          ±2/200, 12mm ±1/94, verificado con 2 básculas).
   FIX CRÍTICO: analyzeOneFoto() (modo multifoto) ahora tiene el mismo
          reintento con prompt ultra-simple que runCountAI ya tenía
          para foto única — antes fallaba con error JSON sin reintentar.
   NUEVO: ajuste manual ±1 también en Pesada rápida, con nota
          "Ajustado manualmente ±N" guardada en Historial.
   FIX: Pesada rápida no siempre guardaba en Historial si el usuario
          no perdía el foco del campo de peso neto (el evento "change"
          es poco fiable en teclados numéricos móviles) — ahora también
          se guarda automáticamente 1.2s después de dejar de escribir.
   NUEVO: filtro de Historial con 3 botones (Todos/Visión/Báscula) en
          vez de toggle, más un contador combinado "📷 N análisis ·
          ⚖️ N pesadas".
   NUEVO: aviso de variabilidad de peso entre botes en 4mm, con acceso
          directo para actualizar el peso unitario desde la propia
          Pesada rápida sin ir a la card de pesos.
   v7.9.3: mensajes de precisión de Pesada rápida actualizados con
          test físico real (4mm ±1-2/20, 8mm ±2/200, 12mm ±0/94) —
          eliminado el aviso de "precisión limitada" en 4mm, los
          datos reales lo desmienten.
   NUEVO: eliminado el módulo gravimétrico clásico (tara manual +
          peso total) — Pesada rápida lo sustituye por completo.
          "Pesos unitarios" pasa a card colapsable ("⚙️ Editar
          pesos"), oculta por defecto; Pesada rápida es ahora la
          sección principal, siempre visible.
   NUEVO: botón "📷 Verificar con visión IA" tras el resultado de
          báscula — lleva a Contar con el tamaño y el albarán
          pre-rellenados con el resultado pesado (flujo báscula
          cuenta → visión confirma → export Odoo).
   NUEVO: Historial con sub-tabs 📷 Visión IA / ⚖️ Báscula —
          contador propio en cada uno, por defecto muestra ambos.
   NUEVO: contador de pesadas en la topbar, separado del contador
          de análisis de visión IA.
   NUEVO: card "📐 Precisión verificada con datos reales" en
          Ajustes, con la tabla del test físico de hoy.
   NUEVO: nota de procedimiento en 4 pasos numerados en tab Pesar.
   v7.9.2: modo "⚖️ Pesada rápida de lote" en tab Pesar — el
          operario ya hace la tara en la báscula física, así que
          solo pide el peso NETO y calcula unidades en vivo al
          escribir (sin botón), reutilizando los pesos unitarios
          de #w4/#w8/#w12. Resultado grande (48px) + precisión
          esperada por tamaño + export a Odoo + guarda en
          Historial con icono ⚖️ (distinto de 📷 visión IA).
   v7.9.1: UNIT_WEIGHTS y PELLET_PROFILES actualizados con pesos
          reales verificados en báscula de laboratorio (100 uds):
          4mm=0.0811g, 8mm=0.3213g, 12mm=0.6969g. Ya NO pesan
          igual el 4mm y el 12mm (dato viejo, ver Ajustes/Pesar).
   NUEVO: miniaturas (multifoto y ejemplos guardados) con borde
          de color según confianza del análisis que las generó.
   NUEVO: alerta de solapamiento — si las notas de Claude
          mencionan solapamiento, aviso con botón directo para
          activar multifoto.
   NUEVO: consejo por tamaño al activar multifoto (máx. por foto).
   NUEVO: fila "Recom." en el dashboard de entrenamiento —
          Ajustar prompt si el error es consistente, Multifoto
          con grupos chicos si el error varía de signo.
   NUEVO: nota de precisión de báscula por tamaño en tab Pesar.
   v7.9:  FIX botón Zonas con addEventListener (el "no responde"
          real era el toast pequeño en ≤30 pellets, ya grande).
          Historial sin conflicto de color confianza/tamaño.
          "Estado del entrenamiento" en Ajustes. Contador topbar
          con muestreos y ejemplos por separado.
   v7.8 (patch .1): perfiles 4/8/12mm reescritos a partir de
          foto real, reintento JSON, recarga automática de SW,
          historial IA vs corrección, estadísticas, tablet 768px.
   v7.8:  FIX real de "Vista normal" (colisión de especificidad
          CSS con [hidden]), albarán como texto simple, toast
          grande al guardar ejemplo, vibración en patrón,
          contador con iconos de color, aviso few-shot activo.
   v7.7:  Modo zonas, contador few-shot, vibración, WakeLock,
          layout horizontal.
   v7.6:  FIX "Guardar como ejemplo" — redimensiona a 400px,
          toast de éxito/error. Pantalla de ejemplos en
          Ajustes. Few-shot conectado a cada análisis.
   v7.5:  1 sola llamada API en foto única (coste x1).
          Si confidence es "media"/"baja", aviso visual
          destacado para revisar la foto y ajustar ±1.
   v7.4:  Modo multifoto con suma automática
          Ajuste manual ±1 post-análisis
   Fix: columna tamaño correcta en single mode
   Fix: JSON parser robusto
   ══════════════════════════════════════════ */

const VERSION = 'v8.1';

/* ══ CAPTURA DE LOGS (v7.9.9) ══
   No hay DevTools a mano en un móvil real — esto guarda los últimos
   console.log/console.error en memoria para poder verlos desde
   Ajustes → "🔍 Ver último log" y copiarlos para depurar a distancia. */
let debugLogs = [];
const MAX_DEBUG_LOGS = 300;
function pushDebugLog(prefix, args) {
  try {
    const line = prefix + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    debugLogs.push(line);
    if (debugLogs.length > MAX_DEBUG_LOGS) debugLogs.shift();
  } catch (err) { /* nunca romper la app por un fallo al loguear */ }
}
const _origConsoleLog = console.log.bind(console);
console.log = (...args) => { _origConsoleLog(...args); pushDebugLog('', args); };
const _origConsoleError = console.error.bind(console);
console.error = (...args) => { _origConsoleError(...args); pushDebugLog('[ERROR] ', args); };

let lastImageBase64 = null;
let lastImageMime   = 'image/jpeg';
let isAnalyzing     = false;
let counts          = { c4:0, c8:0, c12:0, total:0 };
let lastConfidence  = null;
/* 4mm corregido en v7.9.4: 0.071g/ud verificado con 2 básculas (antes
   0.0811g, erróneo). Ver migrateP4Weight() para la migración one-shot
   de localStorage. */
const UNIT_WEIGHTS  = { p4:0.071, p8:0.3213, p12:0.6969 };

/* ── estado multifoto ── */
let multifotos = [];
let multiTotal  = 0;
let multiMode   = false;
let multiManualAdjust = 0;
/* v7.9.9: guarda contra doble ejecución de confirmMultiTotal() (el
   historial se duplicaba al pulsar Confirmar) — se resetea en
   resetMulti(), es decir, cada vez que se activa/desactiva multifoto. */
let multiConfirmed = false;

/* ── estado zonas / wakelock ── */
let zonesActive = false;
let wakeLock    = null;

const qs  = s => document.querySelector(s);
const qsa = s => document.querySelectorAll(s);

const PELLET_PROFILES = {
  '4': "Electrodos de disco sinterizado de 4mm de diámetro, de aplicación médica — NO son condensadores cerámicos, resistencias ni ningún otro componente electrónico, aunque el disco pequeño con un hilo metálico pueda recordar a uno. Son los discos MÁS PEQUEÑOS de la imagen — significativamente más pequeños que los de 8mm y 12mm. Color rosado o marrón claro cuando son nuevos, se vuelven gris oscuro o marrón oscuro con la exposición a la luz — ambos colores son el mismo producto. Pesan aproximadamente 0.08g cada uno. Tienen un hilo fino metálico saliendo del centro, muy difícil de ver a esta escala. INSTRUCCIONES CRÍTICAS: son extremadamente pequeños y tienden a agruparse. Si ves una zona con varios puntos oscuros juntos, asume que son múltiples discos individuales y cuenta cada punto circular por separado. Cuenta cada disco individualmente aunque se toquen o solapen. Ignora completamente los hilos metálicos — son líneas finas, no discos. ATENCIÓN AL SOBRECONTEO: estos pellets son muy pequeños y tienden a aparecer más de lo que realmente son. Si dudas entre N y N+1, elige siempre el número menor. Cuando veas una zona oscura con pellets muy juntos, sé conservador — es mejor quedarse corto 1-2 unidades que pasarse.",
  '8': "Electrodos de disco sinterizado de 8mm de diámetro, de aplicación médica — NO son condensadores cerámicos, resistencias ni ningún otro componente electrónico, aunque el disco con un hilo metálico pueda recordar a uno. Son discos de tamaño MEDIANO — más pequeños que los de 12mm pero claramente más grandes que los de 4mm. Color rosado, malva o marrón dependiendo de la exposición a la luz. Pesan aproximadamente 0.32g cada uno. Tienen un hilo fino metálico saliendo del centro. Cuando dos discos se toquen o solapen parcialmente cuenta cada uno como unidad independiente. Si hay solapamiento en zona central agrupa visualmente y estima cuántos discos hay en esa zona. Ignora completamente los hilos metálicos.",
  '12': "Electrodos de disco sinterizado de 12mm de diámetro, de aplicación médica — NO son condensadores cerámicos, resistencias ni ningún otro componente electrónico, aunque el disco con un hilo metálico pueda recordar a uno. Son los discos MÁS GRANDES de la imagen — notablemente más grandes que los de 8mm. Color rosado, malva o marrón dependiendo de la exposición a la luz — pueden verse claros (rosado/beige) o más oscuros (marrón). Pesan aproximadamente 0.70g cada uno. Tienen un hilo fino metálico de conexión saliendo del centro, a veces doblado o pegado al disco y difícil de ver. Al ser grandes son fáciles de distinguir individualmente. Cuenta cada disco circular grande por separado aunque se toquen en los bordes. Ignora completamente los hilos metálicos."
};

/* Peso 4mm corregido en v7.9.4 (0.0811g→0.071g, verificado con 2
   básculas). Se ejecuta una sola vez por dispositivo: si ya había un
   valor guardado en localStorage (viejo o no), se fuerza al nuevo
   default una única vez, para no pisar una edición manual posterior. */
function migrateP4Weight() {
  if (localStorage.getItem('p4WeightFixedV794')) return;
  const w = JSON.parse(localStorage.getItem('unitWeights') || '{}');
  w.p4 = UNIT_WEIGHTS.p4;
  localStorage.setItem('unitWeights', JSON.stringify(w));
  localStorage.setItem('p4WeightFixedV794', '1');
}

/* ══ INIT ══ */
document.addEventListener('DOMContentLoaded', () => {
  migrateP4Weight();
  restoreSettings(); initUnitWeights(); loadHistory(); updateHistoryBadge();
  renderProductSelector(); renderExampleCounts(); updateFewshotNotice(); renderWeighCounts();
  applyPlatformUploadUI();
  selectQuickSize(quickSize);
  const ap = localStorage.getItem('activeProfile');
  if (ap) setTimeout(() => highlightProfile(ap), 100);
  /* FIX: addEventListener en vez de onclick inline para el botón de zonas */
  const btnZones = document.getElementById('btnZones');
  if (btnZones) btnZones.addEventListener('click', toggleZones);
  /* Alerta de solapamiento: botón directo para activar multifoto */
  const btnActivateMultifoto = document.getElementById('btnActivateMultifoto');
  if (btnActivateMultifoto) btnActivateMultifoto.addEventListener('click', () => {
    if (!multiMode) toggleMultiMode();
    qs('#overlapWarning').style.display = 'none';
  });
  /* FIX v7.9.8: "Confirmar total" (multifoto) no respondía en Android real.
     Delegación de eventos en document en vez de onclick inline, por si el
     listener directo se perdía al reemplazar #multiList con innerHTML en
     cada foto añadida/corregida (el botón en sí nunca se recrea, pero la
     delegación es robusta a eso igualmente y es la solución pedida). */
  document.addEventListener('click', e => {
    if (e.target.id === 'btnMultiConfirm' || e.target.closest('#btnMultiConfirm')) {
      confirmMultiTotal();
    }
  });
});

/* ══ UTILS ══ */
function setStatus(id, msg, color) {
  const el = qs('#' + id); if (!el) return;
  el.style.display = 'block'; el.textContent = msg; el.style.color = color || '';
}
function showToast(msg, isError) {
  let t = qs('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.style.cssText = `position:fixed;bottom:calc(env(safe-area-inset-bottom,0px)+80px);left:50%;transform:translateX(-50%);background:${isError?'#3a1a06':'#0e3a26'};color:${isError?'#f97316':'#3ecf8e'};border:0.5px solid ${isError?'#f97316':'#3ecf8e'};padding:10px 18px;border-radius:20px;font-size:13px;z-index:9999;font-weight:500;pointer-events:none;white-space:nowrap`;
  t.style.opacity = '1'; clearTimeout(t._t);
  t._t = setTimeout(() => t.style.opacity = '0', 2500);
}

/* ══ VER LOG (Ajustes → 🔍 Depuración) ══ */
window.showDebugLog = function() {
  const box = qs('#debugLogBox'), ta = qs('#debugLogText');
  const show = box.style.display === 'none';
  box.style.display = show ? 'block' : 'none';
  if (show) ta.value = debugLogs.length ? debugLogs.join('\n') : '(sin logs todavía)';
};
window.copyDebugLog = function() {
  navigator.clipboard.writeText(debugLogs.join('\n') || '(sin logs)').then(() => showToast('Log copiado ✓'));
};
window.clearDebugLog = function() {
  debugLogs = [];
  const ta = qs('#debugLogText'); if (ta) ta.value = '';
  showToast('Log borrado');
};

async function acquireWakeLock() {
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); }
  catch (err) { /* no crítico: algunos navegadores/pestañas en background lo rechazan */ }
}
function releaseWakeLock() {
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}
function vibrateDone() {
  if (navigator.vibrate) navigator.vibrate([100,50,100]);
}
function vibrateShort() {
  if (navigator.vibrate) navigator.vibrate(80);
}

function showBigToast(msg, isError) {
  let t = qs('#bigToast');
  if (!t) { t = document.createElement('div'); t.id = 'bigToast'; t.className = 'big-toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'big-toast ' + (isError ? 'big-toast-error' : 'big-toast-ok');
  clearTimeout(t._t);
  t.classList.remove('show');
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  t._t = setTimeout(() => t.classList.remove('show'), 3000);
}

/* ══ TABS ══ */
window.switchTab = function(name) {
  qsa('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  qsa('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
  if (name === 'history') { renderHistory(); renderHistoryExamples(); }
  if (name === 'settings') { renderExamplesSettings(); renderStats(); }
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
  if (qs('#sizeMode')) { qs('#sizeMode').value = mode; qs('#singleSizeWrap').style.display = mode==='single'?'block':'none'; }
  const sz = localStorage.getItem('singleSize') || '8';
  if (qs('#singleSize')) qs('#singleSize').value = sz;
}
function showApiStatus(msg, color) { const el=qs('#apiKeyStatus'); if(el){el.textContent=msg;el.style.color=color||'';} }
window.saveApiKey = function() {
  const key = qs('#apiKeyInput').value.trim();
  if (!key.startsWith('sk-ant-')) { showApiStatus('✗ Clave inválida','#f97316'); return; }
  localStorage.setItem('claudeApiKey', key); showApiStatus('✓ API key guardada','#3ecf8e'); showToast('API key guardada ✓');
};
window.toggleApiKey = function() { const i=qs('#apiKeyInput'); i.type=i.type==='password'?'text':'password'; };
window.saveProductDesc = function() { localStorage.setItem('productDesc', qs('#productDesc').value); };
function getApiKey() { return localStorage.getItem('claudeApiKey') || ''; }

/* ══ PRODUCTOS ══ */
const DEFAULT_PRODUCTS = { pellets: { name:'Pellets electrodo', icon:'⬤' } };
function getProducts() { return {...DEFAULT_PRODUCTS,...JSON.parse(localStorage.getItem('customProducts')||'{}')}; }
window.renderProductSelector = function() {
  const el=qs('#productSelector'); if(!el) return;
  const active=localStorage.getItem('activeProduct')||'pellets';
  el.innerHTML=Object.entries(getProducts()).map(([id,p])=>
    `<button onclick="selectProduct('${id}')" style="flex:1;min-width:70px;justify-content:center;flex-direction:column;gap:2px;padding:8px 4px;font-size:11px;${id===active?'background:var(--blue-dim);border-color:var(--blue);color:var(--blue)':''}">
      <span style="font-size:15px">${p.icon}</span><span>${p.name}</span></button>`
  ).join('')+
  `<button onclick="showAddProduct()" style="flex:1;min-width:55px;justify-content:center;flex-direction:column;gap:2px;padding:8px 4px;font-size:11px;">
    <span style="font-size:15px">➕</span><span>Nuevo</span></button>`;
};
window.selectProduct = function(id) {
  localStorage.setItem('activeProduct',id);
  const c=JSON.parse(localStorage.getItem('customProducts')||'{}');
  if(c[id]?.desc){qs('#productDesc').value=c[id].desc;localStorage.setItem('productDesc',c[id].desc);}
  renderProductSelector(); showToast('Producto seleccionado');
};
window.showAddProduct = function() {
  const name=prompt('Nombre:'); if(!name)return;
  const icon=prompt('Emoji:')||'📦';
  const desc=prompt('Descripción para la IA:'); if(!desc)return;
  const id='prod_'+Date.now();
  const c=JSON.parse(localStorage.getItem('customProducts')||'{}');
  c[id]={name,icon,desc}; localStorage.setItem('customProducts',JSON.stringify(c));
  localStorage.setItem('activeProduct',id); renderProductSelector();
  qs('#productDesc').value=desc; localStorage.setItem('productDesc',desc);
  showToast(`"${name}" añadido`);
};

/* ══ PERFILES ══ */
window.loadProfile = function(key) {
  const ap=localStorage.getItem('activeProduct')||'pellets';
  let desc='';
  if(ap==='pellets'&&PELLET_PROFILES[key])desc=PELLET_PROFILES[key];
  else{const c=JSON.parse(localStorage.getItem('customProducts')||'{}');desc=c[ap]?.desc||qs('#productDesc').value||'';}
  if(key!=='custom'&&desc){qs('#productDesc').value=desc;localStorage.setItem('productDesc',desc);}
  if(['4','8','12'].includes(key)){
    qs('#sizeMode').value='single';qs('#singleSizeWrap').style.display='block';
    qs('#singleSize').value=key;localStorage.setItem('sizeMode','single');localStorage.setItem('singleSize',key);
  }
  localStorage.setItem('activeProfile',key);highlightProfile(key);
  updateFewshotNotice();
  showToast(key==='custom'?'Perfil personalizado':`Perfil ${key}mm cargado`);
};
function highlightProfile(key) {
  qsa('.prof-btn').forEach(b=>{const a=b.dataset.key===key;b.style.background=a?'var(--blue-dim)':'';b.style.borderColor=a?'var(--blue)':'';b.style.color=a?'var(--blue)':'';});
}

/* ══════════════════════════════════════
   MODO MULTIFOTO
   ══════════════════════════════════════ */
window.toggleMultiMode = function() {
  multiMode = !multiMode;
  const btn=qs('#btnMultiMode'), panel=qs('#multiPanel');
  if(multiMode){
    btn.style.background='var(--green-dim)';btn.style.borderColor='var(--green)';btn.style.color='var(--green)';
    btn.textContent='📚 Multifoto ON';panel.style.display='block';
    resetMulti();
    updateMultiSizeTip();
    showToast('Modo multifoto activado — añade fotos en grupos de 20-30 pellets');
  } else {
    btn.style.background='';btn.style.borderColor='';btn.style.color='';
    btn.textContent='📚 Multifoto';panel.style.display='none';
    resetMulti();
  }
};

/* ══ CONSEJO POR TAMAÑO EN MULTIFOTO ══ */
const MULTI_SIZE_TIPS={'4':'Máximo 30 por foto','8':'Máximo 25 por foto','12':'Máximo 15 por foto — son grandes'};
function updateMultiSizeTip(){
  const el=qs('#multiSizeTip'); if(!el) return;
  const size=qs('#singleSize')?.value;
  el.textContent=MULTI_SIZE_TIPS[size]?`💡 ${size}mm: ${MULTI_SIZE_TIPS[size]}`:'';
}

/* v7.9.6: revoca las blob URLs de las miniaturas antes de descartarlas,
   para no acumular memoria en una sesión larga de la PWA. */
function resetMulti() {
  multifotos.forEach(f=>{if(f.blobUrl)URL.revokeObjectURL(f.blobUrl);});
  multifotos=[]; multiTotal=0; multiManualAdjust=0; multiConfirmed=false; renderMultiList(); updateMultiTotal();
}

function renderMultiList() {
  const el=qs('#multiList'); if(!el)return;
  if(multifotos.length===0){
    el.innerHTML='<p style="color:var(--hint);font-size:12px;text-align:center;padding:12px">Añade fotos del mismo bote en grupos de 20-30 pellets</p>';
    return;
  }
  el.innerHTML=multifotos.map((f,i)=>{
    const confBorder=confBorderColor(f.result?.confidence);
    return `
    <div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--surface2);border-radius:var(--radius);margin-bottom:6px;border:0.5px solid var(--border)">
      <img src="${f.blobUrl}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;flex-shrink:0;background:var(--surface);border:2px solid ${confBorder}">
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:6px">
          ${f.result?`
            <button onclick="adjustMultiFotoCount(${i},-1)" style="width:24px;height:24px;padding:0;font-size:13px;border-radius:6px;justify-content:center;flex-shrink:0">−</button>
            <input type="number" value="${f.result.total}" onchange="setMultiFotoCount(${i},this.value)" style="width:56px;min-height:24px;text-align:center;padding:4px 2px;font-size:14px;font-weight:700;flex-shrink:0">
            <button onclick="adjustMultiFotoCount(${i},1)" style="width:24px;height:24px;padding:0;font-size:13px;border-radius:6px;justify-content:center;flex-shrink:0">＋</button>
            <span style="font-size:11px;color:var(--muted)">uds</span>
          `:`<span style="font-size:14px;font-weight:700;color:var(--muted)">${f.analyzing?'⏳ Analizando…':'⏸ En cola'}</span>`}
        </div>
        <div style="font-size:11px;color:var(--hint);margin-top:2px">Foto ${i+1}${f.result?' · Confianza '+f.result.confidence:''}</div>
        ${f.result?.notes?`<div style="font-size:10px;color:var(--hint);font-style:italic">${f.result.notes}</div>`:''}
      </div>
      <button onclick="removeMultiFoto(${i})" style="padding:4px 8px;font-size:11px;color:var(--orange);border-color:var(--orange);flex-shrink:0">✕</button>
    </div>`;
  }).join('');
}
function confBorderColor(confidence){
  return {alta:'var(--green)',media:'var(--orange)',baja:'var(--red)'}[confidence]||'var(--border)';
}

/* Ajuste ±1 por foto individual (antes de confirmar el total) */
window.adjustMultiFotoCount=function(i,delta){
  const f=multifotos[i]; if(!f||!f.result)return;
  f.result.total=Math.max(0,f.result.total+delta);
  renderMultiList();
  updateMultiTotal();
};

/* v7.9.6: edición directa del total de una foto (correcciones grandes,
   ej. 62→49, serían 13 pulsaciones de ±1). onchange (no oninput) para
   no perder el foco del campo al re-renderizar la lista en cada tecla. */
window.setMultiFotoCount=function(i,value){
  const f=multifotos[i]; if(!f||!f.result)return;
  f.result.total=Math.max(0,parseInt(value)||0);
  renderMultiList();
  updateMultiTotal();
};

/* Ajuste ±1 global sobre el total acumulado, por encima de la suma de fotos */
window.adjustMultiTotalManual=function(delta){
  multiManualAdjust+=delta;
  updateMultiTotal();
};

/* v7.9.6: edición directa del total acumulado. Recalcula multiManualAdjust
   para que sum(fotos)+multiManualAdjust siga dando el valor escrito, así
   el ±1 posterior sigue funcionando de forma incremental desde ahí. */
window.setMultiTotalManual=function(value){
  const sum=multifotos.reduce((s,f)=>s+(f.result?.total||0),0);
  const n=Math.max(0,parseInt(value)||0);
  multiManualAdjust=n-sum;
  updateMultiTotal();
};

function updateMultiTotal() {
  multiTotal=Math.max(0,multifotos.reduce((s,f)=>s+(f.result?.total||0),0)+multiManualAdjust);
  const el=qs('#multiTotal'); if(el)el.value=multiTotal;
  const ready=multifotos.length>0&&multifotos.every(f=>f.result);
  const btn=qs('#btnMultiConfirm');
  if(btn)btn.style.display=ready?'flex':'none';
  const adjEl=qs('#multiManualAdj');
  if(adjEl)adjEl.style.display=ready?'flex':'none';
  /* estado de fotos pendientes */
  const pending=multifotos.filter(f=>f.analyzing).length;
  const statusEl=qs('#multiStatus');
  if(statusEl){
    statusEl.style.display=multifotos.length>0?'block':'none';
    statusEl.textContent=pending>0?`⏳ Analizando ${pending} foto${pending>1?'s':''}…`:`✓ ${multifotos.filter(f=>f.result).length} fotos analizadas · Total parcial: ${multiTotal} uds`;
    statusEl.style.color=pending>0?'#f59e0b':'#3ecf8e';
  }
}

window.removeMultiFoto = function(i) {
  const f=multifotos[i];
  if(f?.blobUrl)URL.revokeObjectURL(f.blobUrl);
  multifotos.splice(i,1); renderMultiList(); updateMultiTotal();
};

/* Compartido entre el selector de archivos y la cámara nativa (v8.1) */
function addPhotoToMultifoto(blobUrl, base64, mime) {
  const entry={base64,mime,blobUrl,result:null,analyzing:true};
  multifotos.push(entry); renderMultiList(); updateMultiTotal();
  analyzeOneFoto(entry);
}

window.addMultiFoto = function(e) {
  /* v7.9.6 FIX: se congela la descripción de producto UNA vez por lote,
     antes de programar ningún analyzeOneFoto — evita cualquier lectura
     tardía de #productDesc si el DOM cambiase mientras las fotos de
     este lote siguen resolviéndose de forma asíncrona. */
  window._currentProductDesc=qs('#productDesc').value.trim()||PELLET_PROFILES['8'];
  Array.from(e.target.files).forEach(f => {
    const blobUrl=URL.createObjectURL(f);
    const reader=new FileReader();
    reader.onload=ev=>addPhotoToMultifoto(blobUrl, ev.target.result.split(',')[1], f.type||'image/jpeg');
    reader.readAsDataURL(f);
  });
  e.target.value='';
};

async function analyzeOneFoto(entry) {
  const apiKey=getApiKey();
  if(!apiKey){entry.analyzing=false;entry.result={total:0,aiTotal:0,confidence:'baja',notes:'Sin API key'};renderMultiList();updateMultiTotal();return;}
  /* v7.9.5: verificado — esto ya leía el mismo #productDesc (con el
     perfil 4/8/12mm cargado) que runCountAI(), no un texto genérico;
     el refuerzo en PELLET_PROFILES contra "condensador cerámico" no
     bastó (el usuario lo siguió viendo en pruebas reales). v7.9.6:
     en vez de volver a leer el DOM aquí (que podría no reflejar el
     perfil activo si cambia mientras este lote sigue resolviéndose
     de forma asíncrona), se usa el snapshot congelado por
     addMultiFoto() en window._currentProductDesc, idéntico para
     todas las fotos de un mismo lote. */
  const productDesc=window._currentProductDesc||qs('#productDesc').value.trim()||PELLET_PROFILES['8'];
  const singleSize=qs('#singleSize').value;
  const fewShotCount=getReferenceExamples().filter(e=>e.size===singleSize).slice(-2).length;
  const fewShotNote=fewShotCount>0
    ?`\nNOTA: antes de la foto a analizar se incluyen ${fewShotCount} imagen(es) de referencia con su conteo ya confirmado por texto. Son solo contexto de calibración — NO las cuentes. La imagen a contar es la ÚLTIMA, justo antes de este texto.\n`
    :'';
  /* v7.9.9 FIX REAL: el usuario aportó un A/B con datos reales —
     la MISMA foto daba 52/52 exacto por foto única y 62/52 (+10) por
     multifoto. Eso descarta que el problema fuera los pellets o el
     perfil (serían los mismos en ambos casos) y apunta directamente
     a que este prompt era simplemente menos riguroso que el de
     runCountAI(): le faltaba la técnica de cuadrícula mental y las
     REGLAS ABSOLUTAS, y encima afirmaba "esto es un grupo de 20-30"
     de forma fija — falso y potencialmente sesgando el conteo al
     probar con una foto que en realidad tenía más. Se alinea el
     rigor con runCountAI() y se quita la afirmación de rango fijo.
     (La sospecha del usuario de que la imagen se reenviaba
     redimensionada a 400px en multifoto NO es cierta — ese resize
     [EXAMPLE_MAX_DIM] solo se aplica al guardar un ejemplo few-shot,
     nunca al envío para análisis; ambas rutas ya mandaban la imagen
     en su resolución original. Verificado leyendo el código, no
     solo con los console.log de abajo.) */
  const prompt=`Eres un sistema experto de conteo industrial de precisión máxima.

IMPORTANTE: Estás contando electrodos de disco de plata sinterizada, NO condensadores cerámicos, NO termistores, NO varistores. Son discos metálicos con un hilo fino.

OBJETO A CONTAR: ${productDesc}

Esta foto es uno de varios grupos en los que se ha dividido un bote más grande para contar con más precisión. Cuenta ÚNICAMENTE los pellets visibles en ESTA foto — no asumas un rango de cantidad, cuenta exactamente lo que ves aunque sean más o menos de los esperados.

Todos son del mismo tamaño (${singleSize}mm). Devuelve small=0, large=0 y pon el total en medium.
${fewShotNote}
REGLAS ABSOLUTAS:
1. Cuenta ÚNICAMENTE los objetos descritos. Ignora hilos, cables, algodón, fondo, sombras.
2. Divide mentalmente la imagen en una cuadrícula de filas y columnas, cuenta cada celda por separado y luego suma el total.
3. Si los objetos se tocan o solapan, nunca los agrupes como uno solo — cuenta cada uno individualmente.
4. Incluye objetos parcialmente visibles si se ve más del 50%.
5. Esta cuenta verifica albaranes comerciales — la precisión es crítica económicamente.
6. Sé honesto con tu propia incertidumbre: si los objetos están muy amontonados, solapados, mal iluminados o hay cualquier duda razonable sobre el conteo exacto, responde confidence "media" o "baja" en vez de "alta".

RESPONDE EXCLUSIVAMENTE CON ESTE JSON, CERO texto adicional:
{"small":0,"medium":0,"large":0,"total":0,"confidence":"alta","notes":null}

Sustituye los 0 por los conteos reales. confidence: "alta" "media" o "baja". notes: string o null.`;

  console.log('MULTIFOTO PROMPT:', prompt.slice(0, 200));
  console.log('MULTIFOTO IMAGE SIZE:', entry.base64.length);

  /* FIX CRÍTICO v7.9.4: mismo reintento con prompt ultra-simple que
     runCountAI ya tenía para foto única — antes analyzeOneFoto solo
     intentaba un regex de rescate y, si fallaba, daba error directo
     sin reintentar con una segunda llamada a la API. */
  async function askClaude(promptText, includeFewShot) {
    const fewShot=includeFewShot?buildFewShotBlocks(singleSize):[];
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:300,messages:[{role:'user',content:[
        ...fewShot,
        {type:'image',source:{type:'base64',media_type:entry.mime,data:entry.base64}},
        {type:'text',text:promptText}
      ]}]})
    });
    if(!res.ok){const err=await res.json();throw new Error(err.error?.message||`HTTP ${res.status}`);}
    const data=await res.json();
    return data.content[0].text.trim().replace(/```json|```/g,'').trim();
  }
  function extractJson(text){
    if(text.startsWith('{'))return text;
    const m=text.match(/\{[\s\S]*?\}/);
    return m?m[0]:null;
  }

  try {
    let text=extractJson(await askClaude(prompt,true));
    if(!text){
      const simplePrompt=`Cuenta los objetos circulares visibles en la imagen.\nResponde SOLO con este JSON sin ningún texto adicional:\n{"small":0,"medium":0,"large":0,"total":0,"confidence":"media","notes":null}\nSustituye los 0 de "medium" y "total" por el número real que cuentes (deben ser iguales).`;
      text=extractJson(await askClaude(simplePrompt,false));
      if(!text)throw new Error('La IA no devolvió JSON tras reintentar. Pulsa la foto de nuevo o elimínala y repite.');
    }
    const r=JSON.parse(text);
    const total=r.total||r.medium||0;
    entry.result={total,aiTotal:total,confidence:r.confidence||'media',notes:r.notes};
  } catch(err) {
    entry.result={total:0,aiTotal:0,confidence:'baja',notes:'Error: '+err.message};
  } finally {
    entry.analyzing=false; renderMultiList(); updateMultiTotal();
  }
}

window.confirmMultiTotal = function() {
  console.log('confirmMultiTotal called');
  /* v7.9.9: evita guardar dos veces en Historial si confirmMultiTotal()
     se dispara más de una vez para el MISMO toque (ej. si el onclick
     directo y la delegación en document llegaran a disparar ambos, o
     un "ghost click" duplicado en Android). multiConfirmed se resetea
     solo 600ms después — no de forma permanente — para no bloquear una
     SEGUNDA confirmación legítima si el operario añade más fotos al
     mismo lote y vuelve a pulsar Confirmar más tarde. También se
     resetea en resetMulti() (activar/desactivar multifoto). */
  if (multiConfirmed) return;
  multiConfirmed = true;
  setTimeout(() => { multiConfirmed = false; }, 600);
  const singleSize=qs('#singleSize').value;
  /* v7.9.6: confianza "alta" solo si el total confirmado coincide
     exactamente con la suma de lo que Claude reportó originalmente
     por foto (aiTotal) — cualquier corrección, por foto o global,
     baja la confianza a "media", igual que el operario la vería
     si hubiese corregido una foto única. */
  const rawSum=multifotos.reduce((s,f)=>s+(f.result?.aiTotal??f.result?.total??0),0);
  const wasCorrected=multiTotal!==rawSum;
  const confidence=wasCorrected?'media':'alta';
  counts={c4:singleSize==='4'?multiTotal:0,c8:singleSize==='8'?multiTotal:0,c12:singleSize==='12'?multiTotal:0,total:multiTotal};
  qs('#c4').textContent=singleSize==='4'?multiTotal:'—';
  qs('#c8').textContent=singleSize==='8'?multiTotal:'—';
  qs('#c12').textContent=singleSize==='12'?multiTotal:'—';
  qs('#cT').textContent=multiTotal;
  setStatus('statusCount',`✓ Total ${multiTotal} uds de ${multifotos.length} fotos`,'#3ecf8e');
  const alb=parseInt(qs('#albaranQty').value)||0;
  renderAlbaranStatus(multiTotal,alb);
  qs('#resultsCount').style.display='block';
  qs('#manualAdj').style.display='flex';
  qs('#btnSaveExample').style.display='none';
  qs('#btnZones').style.display='none'; exitZonesView();
  lastConfidence=confidence;
  saveHistoryEntry({
    date:new Date().toLocaleDateString('es-ES')+' '+new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),
    total:multiTotal,aiTotal:rawSum,size4:counts.c4,size8:counts.c8,size12:counts.c12,
    product:(qs('#productDesc').value||'').slice(0,60),confidence,
    notes:null,
    /* v7.9.8: {ai,total} por foto (no solo el total final) para poder
       mostrar en Historial qué fotos se corrigieron y cuánto, ej.
       "F1: 54→51 (-3)". */
    photoBreakdown:multifotos.map(f=>({ai:f.result?.aiTotal??f.result?.total??0,total:f.result?.total||0})),
    albaran:alb||null
    // ODOO - pendiente de implementar: odoo:buildOdooText()
  });
  renderExampleCounts();
  showToast(`✓ Total confirmado: ${multiTotal} uds de ${singleSize}mm`);
  vibrateDone();
  const resEl=qs('#resultsCount');
  if(resEl)setTimeout(()=>resEl.scrollIntoView({behavior:'smooth',block:'start'}),50);
};

/* ══ FOTO ÚNICA ══ */
/* Compartido entre el selector de archivos y la cámara nativa (v8.1) */
function processSinglePhotoDataUrl(dataUrl, mime) {
  lastImageMime=mime;
  const img=new Image();
  img.onload=()=>{
    const canvas=qs('#cvCount'),maxW=Math.min(window.innerWidth-28,800);
    let w=img.naturalWidth,h=img.naturalHeight;
    if(w>maxW){h=Math.round(h*maxW/w);w=maxW;}
    canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(img,0,0,w,h);
    qs('#wrapCount').style.display='block';qs('#btnRecount').style.display='';
    lastImageBase64=dataUrl.split(',')[1];
    runCountAI();
  };
  img.src=dataUrl;
}

window.loadCount = function(e) {
  if(multiMode){window.addMultiFoto(e);return;}
  const f=e.target.files[0]; if(!f)return;
  const reader=new FileReader();
  reader.onload=ev=>processSinglePhotoDataUrl(ev.target.result, f.type||'image/jpeg');
  reader.readAsDataURL(f);
};

/* ══ CÁMARA NATIVA — Windows/desktop/Surface (v8.1, patch cámara v8.1.1) ══
   En Android/iOS el <input capture="environment"> ya abre la cámara
   nativa del sistema — eso no cambia. En desktop ese atributo no hace
   nada (el navegador lo ignora y abre un selector de archivo normal),
   así que ahí se sustituye la upload-zone por dos botones: "Subir
   desde archivo" (input sin capture) y "Usar cámara" (getUserMedia +
   <video>/<canvas> propios, dentro de la app).
   facingMode:{ideal:'environment'} (no "exact") ya pedía la trasera
   con fallback automático a cualquier otra cámara si no hay trasera
   — eso ya estaba así desde v8.1, confirmado al revisar este patch.
   Lo nuevo es el botón "🔄 Cambiar cámara": una vez concedido el
   permiso, se enumeran las cámaras disponibles (los labels solo son
   fiables DESPUÉS de tener permiso) y, si hay más de una, el botón
   aparece para ir alternando entre ellas por deviceId. */
const isMobilePlatform = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
let cameraStream = null;
let cameraTargetMode = null; // 'single' | 'multi'
let cameraDevices = [];
let cameraDeviceIndex = 0;

function applyPlatformUploadUI() {
  if (isMobilePlatform) return; // HTML ya trae el flujo móvil visible por defecto
  const zm=qs('#uploadZoneMobile'); if(zm) zm.style.display='none';
  const cd=qs('#uploadChoiceDesktop'); if(cd) cd.style.display='flex';
  const zmm=qs('#uploadZoneMultiMobile'); if(zmm) zmm.style.display='none';
  const cdm=qs('#uploadChoiceMultiDesktop'); if(cdm) cdm.style.display='flex';
}

function startCameraStream(videoConstraints){
  const video=qs('#cameraVideo'), errEl=qs('#cameraError'), btnSwitch=qs('#btnSwitchCamera');
  if(cameraStream){cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null;}
  navigator.mediaDevices.getUserMedia({
    video: Object.assign({ width:{ideal:1920}, height:{ideal:1080} }, videoConstraints)
  }).then(async stream=>{
    cameraStream=stream;
    video.srcObject=stream;
    errEl.style.display='none';
    /* Los deviceId/label de enumerateDevices() solo vienen completos
       una vez concedido el permiso — por eso se enumera aquí y no antes. */
    try {
      const devices=await navigator.mediaDevices.enumerateDevices();
      cameraDevices=devices.filter(d=>d.kind==='videoinput');
    } catch(err) { cameraDevices=[]; }
    if(btnSwitch) btnSwitch.style.display = cameraDevices.length>1 ? 'inline-flex' : 'none';
  }).catch(()=>{
    errEl.textContent='⚠️ Permiso de cámara denegado — usa 📁 Subir desde archivo';
    errEl.style.display='block';
  });
}

window.openCameraModal = function(mode){
  cameraTargetMode = mode;
  cameraDevices=[]; cameraDeviceIndex=0;
  const modal=qs('#cameraModal'), errEl=qs('#cameraError'), btnSwitch=qs('#btnSwitchCamera');
  errEl.style.display='none'; errEl.textContent='';
  if(btnSwitch) btnSwitch.style.display='none';
  modal.style.display='flex';
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    errEl.textContent='⚠️ Tu navegador no soporta acceso a la cámara — usa 📁 Subir desde archivo';
    errEl.style.display='block';
    return;
  }
  startCameraStream({ facingMode:{ideal:'environment'} });
};

/* Alterna a la siguiente cámara disponible (deviceId), reiniciando el
   stream — ej. para pasar de la trasera a la frontal en un Surface
   con varias cámaras. */
window.switchCamera = function(){
  if(cameraDevices.length<2) return;
  cameraDeviceIndex=(cameraDeviceIndex+1)%cameraDevices.length;
  startCameraStream({ deviceId:{exact:cameraDevices[cameraDeviceIndex].deviceId} });
};

window.closeCameraModal = function(){
  if(cameraStream){cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null;}
  const video=qs('#cameraVideo'); if(video) video.srcObject=null;
  const modal=qs('#cameraModal'); if(modal) modal.style.display='none';
  cameraTargetMode=null; cameraDevices=[]; cameraDeviceIndex=0;
};

window.captureCameraPhoto = function(){
  const video=qs('#cameraVideo');
  if(!video||!video.videoWidth) return; // stream aún no listo
  const canvas=qs('#cameraCaptureCanvas');
  canvas.width=video.videoWidth; canvas.height=video.videoHeight;
  canvas.getContext('2d').drawImage(video,0,0);
  const dataUrl=canvas.toDataURL('image/jpeg',0.92);
  const mode=cameraTargetMode;
  closeCameraModal();
  if(mode==='single'){
    processSinglePhotoDataUrl(dataUrl,'image/jpeg');
  } else if(mode==='multi'){
    window._currentProductDesc=qs('#productDesc').value.trim()||PELLET_PROFILES['8'];
    fetch(dataUrl).then(r=>r.blob()).then(blob=>{
      addPhotoToMultifoto(URL.createObjectURL(blob), dataUrl.split(',')[1], 'image/jpeg');
    });
  }
};

window.rerun=window.runCount=runCountAI;

async function runCountAI() {
  if(!lastImageBase64||isAnalyzing)return;
  const apiKey=getApiKey();
  if(!apiKey){showToast('Introduce tu API key en ⚙️ Ajustes',true);switchTab('settings');return;}
  isAnalyzing=true;
  acquireWakeLock();
  qs('#analyzeSpinner').style.display='block';qs('#btnRecount').disabled=true;
  setStatus('statusCount','🔍 Claude está analizando la imagen…');qs('#statusCount').style.color='';
  qs('#confWarning').style.display='none';
  qs('#overlapWarning').style.display='none';
  qs('#albaranResult').style.display='none';qs('#resultsCount').style.display='none';
  qs('#manualAdj').style.display='none';qs('#btnSaveExample').style.display='none';
  qs('#btnZones').style.display='none'; exitZonesView();

  const productDesc=qs('#productDesc').value.trim()||PELLET_PROFILES['8'];
  const sizeMode=qs('#sizeMode').value,singleSize=qs('#singleSize').value;
  const albaranQty=parseInt(qs('#albaranQty').value)||0;
  const sizeInstruction=sizeMode==='single'
    ?`Todos los objetos son del mismo tamaño (${singleSize}mm). Devuelve small=0, large=0 y pon el total en medium.`
    :`Clasifica: pequeños (~4mm) en "small", medianos (~8mm) en "medium", grandes (~12mm) en "large".`;
  const fewShotCount=sizeMode==='single'?getReferenceExamples().filter(e=>e.size===singleSize).slice(-2).length:0;
  const fewShotNote=fewShotCount>0
    ?`\nNOTA: antes de la foto a analizar se incluyen ${fewShotCount} imagen(es) de referencia, cada una con su conteo ya confirmado indicado por texto. Son solo contexto de calibración de escala/densidad — NO las cuentes. La imagen que debes contar es la ÚLTIMA imagen, la que aparece justo antes de este texto.\n`
    :'';

  const prompt=`Eres un sistema experto de conteo industrial de precisión máxima.

OBJETO A CONTAR: ${productDesc}

${sizeInstruction}
${fewShotNote}
REGLAS ABSOLUTAS:
1. Cuenta ÚNICAMENTE los objetos descritos. Ignora hilos, cables, algodón, fondo, sombras.
2. Divide mentalmente la imagen en una cuadrícula de filas y columnas, cuenta cada celda por separado y luego suma el total.
3. Si los objetos se tocan o solapan, nunca los agrupes como uno solo — cuenta cada uno individualmente.
4. Incluye objetos parcialmente visibles si se ve más del 50%.
5. Esta cuenta verifica albaranes comerciales — la precisión es crítica económicamente.
6. Sé honesto con tu propia incertidumbre: si los objetos están muy amontonados, solapados, mal iluminados o hay cualquier duda razonable sobre el conteo exacto, responde confidence "media" o "baja" en vez de "alta".

RESPONDE EXCLUSIVAMENTE CON ESTE JSON. CERO palabras antes o después. CERO markdown:
{"small":0,"medium":0,"large":0,"total":0,"confidence":"alta","notes":null}

Sustituye los 0 por los conteos reales. confidence: "alta" "media" o "baja". notes: string o null.`;

  console.log('SINGLE PROMPT:', prompt.slice(0, 200));
  console.log('SINGLE IMAGE SIZE:', lastImageBase64.length);

  async function askClaude(promptText, includeFewShot) {
    const fewShot=(includeFewShot&&sizeMode==='single')?buildFewShotBlocks(singleSize):[];
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:300,messages:[{role:'user',content:[
        ...fewShot,
        {type:'image',source:{type:'base64',media_type:lastImageMime,data:lastImageBase64}},
        {type:'text',text:promptText}
      ]}]})
    });
    if(!res.ok){const err=await res.json();throw new Error(err.error?.message||`HTTP ${res.status}`);}
    const data=await res.json();
    return data.content[0].text.trim().replace(/```json|```/g,'').trim();
  }

  function extractJson(text){
    if(text.startsWith('{'))return text;
    const m=text.match(/\{[\s\S]*?\}/);
    return m?m[0]:null;
  }

  async function callClaude(prompt) {
    let text=extractJson(await askClaude(prompt,true));
    if(!text){
      /* FIX CRÍTICO: reintento único con prompt ultra-simple antes de rendirse */
      const simplePrompt=sizeMode==='single'
        ?`Cuenta cuántos discos circulares hay en esta imagen. Responde EXCLUSIVAMENTE con este JSON, sin ningún texto antes ni después: {"total": 0}. Sustituye el 0 por el número real que cuentes.`
        :`Cuenta discos circulares y clasifícalos por tamaño relativo: pequeños en "small", medianos en "medium", grandes en "large". Responde EXCLUSIVAMENTE con este JSON, sin texto antes ni después: {"small":0,"medium":0,"large":0,"total":0}. Sustituye los 0 por los números reales.`;
      text=extractJson(await askClaude(simplePrompt,false));
      if(!text)throw new Error('La IA no devolvió JSON tras reintentar. Pulsa "Analizar de nuevo".');
    }
    const r=JSON.parse(text);
    r.total=r.total||(r.small||0)+(r.medium||0)+(r.large||0);
    return r;
  }

  try {
    const result=await callClaude(prompt);
    const total=result.total;
    counts={c4:0,c8:0,c12:0,total};
    if(sizeMode==='single'){
      if(singleSize==='4')counts.c4=total;
      else if(singleSize==='12')counts.c12=total;
      else counts.c8=total;
    } else {counts.c4=result.small||0;counts.c8=result.medium||0;counts.c12=result.large||0;}

    qs('#c4').textContent=sizeMode==='single'?(singleSize==='4'?total:'—'):counts.c4;
    qs('#c8').textContent=sizeMode==='single'?(singleSize==='8'?total:'—'):counts.c8;
    qs('#c12').textContent=sizeMode==='single'?(singleSize==='12'?total:'—'):counts.c12;
    qs('#cT').textContent=total;

    renderAlbaranStatus(total,albaranQty);

    const confColor=result.confidence==='alta'?'#3ecf8e':result.confidence==='media'?'#f59e0b':'#f97316';
    setStatus('statusCount',`✓ ${total} detectados · Confianza: ${result.confidence}${result.notes?' · '+result.notes:''}`);
    qs('#statusCount').style.color=confColor;

    const confWarnEl=qs('#confWarning');
    if(result.confidence==='media'||result.confidence==='baja'){
      confWarnEl.style.display='block';
      confWarnEl.style.color=confColor;
      confWarnEl.textContent=`⚠️ Confianza ${result.confidence} — revisa la foto y usa ±1 si necesitas ajustar`;
    } else {
      confWarnEl.style.display='none';
    }
    lastConfidence=result.confidence;
    checkOverlapNotice(result.notes);

    drawOverlay(total,result.confidence);
    qs('#resultsCount').style.display='block';qs('#manualAdj').style.display='flex';qs('#btnSaveExample').style.display='flex';qs('#btnZones').style.display='';
    saveHistoryEntry({
      date:new Date().toLocaleDateString('es-ES')+' '+new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),
      total,aiTotal:total,size4:counts.c4,size8:counts.c8,size12:counts.c12,
      product:(qs('#productDesc').value||'').slice(0,60),
      confidence:result.confidence,notes:result.notes,albaran:albaranQty||null
      // ODOO - pendiente de implementar: odoo:buildOdooText()
    });
    renderExampleCounts();
    vibrateDone();
  } catch(err) {
    setStatus('statusCount','✗ '+err.message,'#f97316');showToast(err.message,true);
  } finally {
    isAnalyzing=false;qs('#btnRecount').disabled=false;qs('#analyzeSpinner').style.display='none';
    releaseWakeLock();
  }
}

function drawOverlay(total,confidence){
  const canvas=qs('#cvCount'),ctx=canvas.getContext('2d');
  const col=confidence==='alta'?'#3ecf8e':confidence==='media'?'#f59e0b':'#f97316';
  ctx.fillStyle='rgba(0,0,0,0.7)';ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(10,10,175,58,10);else ctx.rect(10,10,175,58);
  ctx.fill();ctx.fillStyle='#fff';ctx.font='bold 26px -apple-system,sans-serif';ctx.fillText(`${total} uds`,20,44);
  ctx.fillStyle=col;ctx.font='12px -apple-system,sans-serif';ctx.fillText(`Confianza ${confidence}`,20,60);
}

/* ══ ALERTA DE SOLAPAMIENTO ══ */
const OVERLAP_KEYWORDS=['solapan','solapa','superponen','superpone','solapamiento','touching','overlapping'];
function checkOverlapNotice(notes){
  const el=qs('#overlapWarning'); if(!el) return;
  const hit=!!notes && OVERLAP_KEYWORDS.some(k=>notes.toLowerCase().includes(k));
  el.style.display=hit?'flex':'none';
}

/* ══ COMPARACIÓN ALBARÁN ══ */
function renderAlbaranStatus(total, albaranQty) {
  const el=qs('#albaranResult'); if(!el) return;
  if(!albaranQty||albaranQty<=0){ el.style.display='none'; return; }
  el.style.display='block';
  const diff=total-albaranQty;
  if(diff===0){
    el.innerHTML=`<span style="color:var(--green)">📋 Albarán: ${albaranQty} · Contado: ${total} · ✓ COINCIDE</span>`;
  } else if(diff<0){
    el.innerHTML=`<span style="color:var(--red)">📋 Albarán: ${albaranQty} · Contado: ${total} · ⚠️ FALTAN ${Math.abs(diff)} uds</span>`;
  } else {
    el.innerHTML=`<span style="color:var(--orange)">📋 Albarán: ${albaranQty} · Contado: ${total} · ℹ️ SOBRAN ${diff} uds</span>`;
  }
}

/* ══ AJUSTE MANUAL ±1 ══ */
window.adjustCount = function(delta) {
  counts.total=Math.max(0,counts.total+delta);
  const sizeMode=qs('#sizeMode').value,singleSize=qs('#singleSize').value;
  if(sizeMode==='single'){
    if(singleSize==='4'){counts.c4=counts.total;qs('#c4').textContent=counts.total;}
    else if(singleSize==='12'){counts.c12=counts.total;qs('#c12').textContent=counts.total;}
    else{counts.c8=counts.total;qs('#c8').textContent=counts.total;}
  } else {counts.c8=Math.max(0,counts.c8+delta);qs('#c8').textContent=counts.c8;}
  qs('#cT').textContent=counts.total;
  renderAlbaranStatus(counts.total,parseInt(qs('#albaranQty').value)||0);
  if(zonesActive)exitZonesView();
  updateLastHistoryTotal(counts.total,counts.c4,counts.c8,counts.c12);
  showToast(`Total ajustado: ${counts.total} uds`);
};

/* ══════════════════════════════════════
   MODO ZONAS — subtotales por cuadrante
   (distribución proporcional por área, sin llamada a la API)
   ══════════════════════════════════════ */
function distributeInts(total, n) {
  const base=Math.floor(total/n), rem=total-base*n;
  return Array.from({length:n},(_,i)=>base+(i<rem?1:0));
}
function largestRemainderRound(values, total) {
  const floors=values.map(Math.floor);
  const sum=floors.reduce((a,b)=>a+b,0);
  const remainder=total-sum;
  const order=values.map((v,i)=>({i,frac:v-Math.floor(v)})).sort((a,b)=>b.frac-a.frac);
  const result=floors.slice();
  for(let k=0;k<remainder && order.length>0;k++) result[order[k%order.length].i]++;
  return result;
}
window.toggleZones = function() {
  if(zonesActive){ exitZonesView(); return; }
  const total=counts.total;
  if(total<=30){ showBigToast('Pocos pellets (≤30) — vista normal ya es suficiente'); return; }
  const big=total>=81, n=big?3:2;
  enterZonesView(n,n,total);
};
function enterZonesView(rows, cols, total) {
  const canvas=qs('#cvCount'); if(!canvas||!canvas.width) return;
  const colWidths=distributeInts(canvas.width,cols);
  const rowHeights=distributeInts(canvas.height,rows);
  const areas=[];
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++) areas.push(colWidths[c]*rowHeights[r]);
  const totalArea=canvas.width*canvas.height;
  const raw=areas.map(a=>total*a/totalArea);
  const zoneCounts=largestRemainderRound(raw,total);
  const maxIdx=zoneCounts.indexOf(Math.max(...zoneCounts));

  const overlay=qs('#zoneOverlay');
  overlay.style.gridTemplateColumns=colWidths.map(w=>w+'fr').join(' ');
  overlay.style.gridTemplateRows=rowHeights.map(h=>h+'fr').join(' ');
  overlay.innerHTML=zoneCounts.map((n,i)=>
    `<div class="zone-cell${i===maxIdx?' zone-max':''}"><span class="zone-badge">${n}</span></div>`
  ).join('');
  overlay.hidden=false;
  zonesActive=true;
  qs('#btnZones').textContent='📷 Vista normal';
}
function exitZonesView() {
  const overlay=qs('#zoneOverlay');
  if(overlay){ overlay.hidden=true; overlay.innerHTML=''; }
  zonesActive=false;
  const btn=qs('#btnZones'); if(btn) btn.textContent='⊞ Zonas';
}

/* ══ EJEMPLOS DE REFERENCIA (few-shot) ══ */
const MAX_REFERENCE_EXAMPLES = 10;
const EXAMPLE_MAX_DIM = 400;
const FEWSHOT_TARGET = 5;
const FEWSHOT_MIN = 3;

function renderExampleCounts() {
  const el = qs('#exCounts'); if (!el) return;
  const stats = computeStats();
  /* m = muestreos (análisis), e = ejemplos guardados — colores distintos para no confundirlos */
  el.innerHTML = ['4','8','12'].map(s => {
    const st = stats[s];
    const eDone = st.exampleCount >= FEWSHOT_TARGET;
    return `<span>${s}mm <span style="color:var(--muted)">${st.totalAnalyses}m</span>/<span style="color:${eDone?'var(--green)':'var(--blue)'};font-weight:800">${st.exampleCount}e${eDone?'✓':''}</span></span>`;
  }).join('<span style="color:var(--hint)"> · </span>');
}

function updateFewshotNotice() {
  const el = qs('#fewshotNotice'); if (!el) return;
  const sizeMode = qs('#sizeMode')?.value;
  const singleSize = qs('#singleSize')?.value;
  if (sizeMode !== 'single' || !singleSize) { el.style.display='none'; return; }
  const n = getReferenceExamples().filter(e => e.size === singleSize).length;
  if (n >= FEWSHOT_MIN) {
    el.style.display='flex';
    el.textContent = `✦ Few-shot activo para ${singleSize}mm (${n} ejemplo${n>1?'s':''})`;
  } else {
    el.style.display='none';
  }
}

function resizeImageBase64(base64, mime, maxDim) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > maxDim || h > maxDim) {
        if (w >= h) { h = Math.round(h * maxDim / w); w = maxDim; }
        else { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        resolve({ base64: dataUrl.split(',')[1], mime: 'image/jpeg' });
      } catch (err) { reject(err); }
    };
    img.onerror = () => reject(new Error('No se pudo procesar la imagen'));
    img.src = `data:${mime};base64,${base64}`;
  });
}

function getReferenceExamples() {
  try { return JSON.parse(localStorage.getItem('referenceExamples') || '[]'); }
  catch (err) { return []; }
}

function buildFewShotBlocks(size) {
  if(!size) return [];
  const recent=getReferenceExamples().filter(e=>e.size===size).slice(-2);
  return recent.flatMap((ex,i)=>[
    {type:'text',text:`Ejemplo de referencia confirmado #${i+1}: esta foto contiene EXACTAMENTE ${ex.total} unidades de ${ex.size}mm. Úsala como referencia de escala y densidad visual para el conteo que viene a continuación.`},
    {type:'image',source:{type:'base64',media_type:ex.mime,data:ex.image}}
  ]);
}

function persistReferenceExamples(examples) {
  while (true) {
    try { localStorage.setItem('referenceExamples', JSON.stringify(examples)); return true; }
    catch (err) {
      if (examples.length === 0) return false;
      examples.shift();
    }
  }
}

window.saveAsExample = async function() {
  if(!lastImageBase64){showBigToast('No hay foto para guardar',true);return;}
  try {
    const resized = await resizeImageBase64(lastImageBase64, lastImageMime, EXAMPLE_MAX_DIM);
    const sizeMode = qs('#sizeMode').value, singleSize = qs('#singleSize').value;
    const entry = {
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      date: new Date().toLocaleDateString('es-ES') + ' ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      image: resized.base64, mime: resized.mime,
      total: counts.total, size4: counts.c4, size8: counts.c8, size12: counts.c12,
      size: sizeMode === 'single' ? singleSize : null,
      confidence: lastConfidence,
      product: (qs('#productDesc').value || '').slice(0, 60)
    };
    let examples = getReferenceExamples();
    examples.push(entry);
    while (examples.length > MAX_REFERENCE_EXAMPLES) examples.shift();
    if (!persistReferenceExamples(examples)) { showBigToast('No se pudo guardar: almacenamiento lleno', true); return; }
    const sizeCount = entry.size ? examples.filter(e => e.size === entry.size).length : null;
    if (entry.size && sizeCount === FEWSHOT_TARGET) {
      showBigToast(`¡Few-shot activo para ${entry.size}mm! (${FEWSHOT_TARGET} ejemplos)`);
    } else if (entry.size) {
      showBigToast(`✓ Ejemplo ${entry.size}mm guardado (${sizeCount}/${FEWSHOT_TARGET})`);
    } else {
      showBigToast(`✓ Ejemplo guardado (${examples.length} en total)`);
    }
    vibrateShort();
    renderExamplesSettings();
    renderHistoryExamples();
    renderExampleCounts();
    updateFewshotNotice();
  } catch (err) {
    showBigToast('Error al guardar ejemplo: ' + err.message, true);
  }
};

window.deleteExample = function(id) {
  const examples = getReferenceExamples().filter(e => e.id !== id);
  if (!persistReferenceExamples(examples)) { showToast('Error al borrar',true); return; }
  renderExamplesSettings();
  renderHistoryExamples();
  renderExampleCounts();
  updateFewshotNotice();
  showToast('Ejemplo borrado');
};

window.deleteExamplesBySize = function(size) {
  if (!confirm(`¿Borrar todos los ejemplos de ${size}mm?`)) return;
  const examples = getReferenceExamples().filter(e => e.size !== size);
  persistReferenceExamples(examples);
  renderExamplesSettings();
  renderHistoryExamples();
  renderExampleCounts();
  updateFewshotNotice();
  showToast(`Ejemplos de ${size}mm borrados`);
};

function buildExamplesGroupsHTML() {
  const examples = getReferenceExamples();
  if (examples.length === 0) {
    return '<p style="color:var(--muted);font-size:12px;text-align:center;padding:16px">Sin ejemplos guardados aún. Tras un análisis en la pestaña Contar, usa "✓ Guardar como ejemplo".</p>';
  }
  const groups = { '4': [], '8': [], '12': [], other: [] };
  examples.forEach(e => { (groups[e.size] || groups.other).push(e); });
  const sizeLabel = { '4': '4mm', '8': '8mm', '12': '12mm', other: 'Sin tamaño único (modo clasificar)' };
  return ['4', '8', '12', 'other'].filter(k => groups[k].length > 0).map(k => {
    const n = groups[k].length;
    let progress = '';
    if (k !== 'other') {
      if (n >= FEWSHOT_TARGET) progress = `<div style="font-size:11px;color:var(--green);font-weight:700;margin-bottom:8px">${n}/${FEWSHOT_TARGET} ejemplos — ✓ few-shot completamente activo</div>`;
      else if (n >= FEWSHOT_MIN) progress = `<div style="font-size:11px;color:var(--blue);margin-bottom:8px">${n}/${FEWSHOT_TARGET} ejemplos — few-shot parcialmente activo</div>`;
      else progress = `<div style="font-size:11px;color:var(--muted);margin-bottom:8px">${n}/${FEWSHOT_TARGET} ejemplos</div>`;
    }
    return `
    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;flex-wrap:wrap;gap:6px">
        <span style="font-size:12px;font-weight:700">${sizeLabel[k]} · ${n} ejemplo${n>1?'s':''}</span>
        ${k!=='other'?`<button onclick="deleteExamplesBySize('${k}')" style="font-size:10px;padding:4px 8px;color:var(--orange);border-color:var(--orange)">🗑 Borrar todos los ejemplos de ${k}mm</button>`:''}
      </div>
      ${progress}
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${groups[k].map(e => `
          <div style="position:relative;width:72px">
            <img src="data:${e.mime};base64,${e.image}" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:2px solid ${confBorderColor(e.confidence)};display:block">
            <div style="font-size:10px;text-align:center;color:var(--muted);margin-top:2px">${e.total} uds</div>
            <div style="font-size:9px;text-align:center;color:var(--hint)">${e.date}</div>
            <button onclick="deleteExample('${e.id}')" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;padding:0;border-radius:50%;font-size:10px;line-height:1;background:var(--orange-dim);border-color:var(--orange);color:var(--orange);display:flex;align-items:center;justify-content:center">✕</button>
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

window.renderExamplesSettings = function() {
  const el = qs('#examplesSettings'); if (!el) return;
  el.innerHTML = buildExamplesGroupsHTML();
};

function renderHistoryExamples() {
  const el = qs('#historyExamplesList'); if (!el) return;
  el.innerHTML = buildExamplesGroupsHTML();
}

/* ══ EXPORT ODOO ══ */
// ODOO - pendiente de implementar (retirado en v7.9.5, código conservado para recuperarlo fácilmente)
// function buildOdooText(){
//   const prov=qs('#exProveedor')?.value||'—',po=qs('#exPO')?.value||'—';
//   const pref=qs('#exLote')?.value||'P',ubic=qs('#exUbic')?.value||'WH/Stock';
//   const alb=qs('#albaranQty')?.value||'—';
//   const now=new Date(),seq=Math.floor(Math.random()*900)+100,pad=n=>String(n).padStart(3,'0');
//   const mode=qs('#sizeMode')?.value||'single',sz=qs('#singleSize')?.value||'8';
//   const albNum=parseInt(qs('#albaranQty')?.value)||0,diff=albNum>0?counts.total-albNum:null;
//   const lines=[
//     '=== RECEPCIÓN PELLETS — VERIFICADO IA ===',
//     `Fecha:        ${now.toLocaleDateString('es-ES')}  ${now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}`,
//     `Proveedor:    ${prov}`,`PO:           ${po}`,`Ubicación:    ${ubic}`,`Albarán:      ${alb} uds`,'---',
//   ];
//   if(mode==='single'){lines.push(`Pellet ${sz}mm   |  Lote: ${pref}-${sz}MM-${pad(seq)}  |  Cant: ${counts.total}`);}
//   else{
//     if(counts.c4>0)lines.push(`Pellet  4mm  |  Lote: ${pref}-4MM-${pad(seq)}    |  Cant: ${counts.c4}`);
//     if(counts.c8>0)lines.push(`Pellet  8mm  |  Lote: ${pref}-8MM-${pad(seq+1)}  |  Cant: ${counts.c8}`);
//     if(counts.c12>0)lines.push(`Pellet 12mm  |  Lote: ${pref}-12MM-${pad(seq+2)} |  Cant: ${counts.c12}`);
//   }
//   lines.push('---',`Total:        ${counts.total} uds`);
//   if(multiMode&&multifotos.length>0)lines.push(`Método:       Multifoto (${multifotos.length} fotos)`);
//   if(diff!==null)lines.push(diff===0?'✓ COINCIDE con albarán':diff<0?`⚠️ FALTAN ${Math.abs(diff)} uds`:`ℹ️ SOBRAN ${diff} uds`);
//   lines.push(`Motor:        Claude Vision AI ${VERSION}`);
//   return lines.join('\n');
// }
// window.buildOdoo=function(){const el=qs('#odooBlock');if(el)el.textContent=buildOdooText();};
// window.copyOdoo=function(){navigator.clipboard.writeText(buildOdooText()).then(()=>showToast('Copiado ✓'));};

/* ══ PESOS UNITARIOS ══
   El módulo gravimétrico clásico (tara manual + peso total) se
   eliminó en v7.9.3 — Pesada rápida lo sustituye por completo.
   v7.9.5: la edición se movió de tab Pesar a Ajustes → "Pesos
   unitarios", protegida por un PIN simple (no es seguridad real,
   solo un freno para que un operario no la toque sin querer). Tab
   Pesar solo muestra los valores actuales como texto informativo
   (`renderPesosReadOnly`). */
const PESOS_PIN='1234';
function initUnitWeights(){
  const w=JSON.parse(localStorage.getItem('unitWeights')||'{}');
  if(qs('#w4'))qs('#w4').value=w.p4||UNIT_WEIGHTS.p4;
  if(qs('#w8'))qs('#w8').value=w.p8||UNIT_WEIGHTS.p8;
  if(qs('#w12'))qs('#w12').value=w.p12||UNIT_WEIGHTS.p12;
  renderPesosReadOnly();
}
function renderPesosReadOnly(){
  const w=JSON.parse(localStorage.getItem('unitWeights')||'{}');
  const p4=w.p4||UNIT_WEIGHTS.p4,p8=w.p8||UNIT_WEIGHTS.p8,p12=w.p12||UNIT_WEIGHTS.p12;
  const line=`4mm: ${p4.toFixed(4)}g/ud · 8mm: ${p8.toFixed(4)}g/ud · 12mm: ${p12.toFixed(4)}g/ud`;
  const ro=qs('#pesosReadOnly'); if(ro)ro.textContent=line;
  const info=qs('#pesosInfoLine'); if(info)info.textContent=line;
}
window.toggleWeightsCard=function(){
  const el=qs('#pesosCard'),btn=qs('#btnTogglePesos');
  const show=el.style.display==='none';
  if(show){
    const pin=prompt('PIN de administrador para editar pesos unitarios:');
    if(pin===null)return;
    if(pin!==PESOS_PIN){showToast('PIN incorrecto',true);return;}
  }
  el.style.display=show?'block':'none';
  btn.textContent=show?'🔒 Ocultar pesos':'🔒 Editar pesos (PIN admin)';
};
window.saveUnitWeights=function(){
  localStorage.setItem('unitWeights',JSON.stringify({
    p4:parseFloat(qs('#w4').value)||UNIT_WEIGHTS.p4,
    p8:parseFloat(qs('#w8').value)||UNIT_WEIGHTS.p8,
    p12:parseFloat(qs('#w12').value)||UNIT_WEIGHTS.p12
  }));
  renderPesosReadOnly();
};

/* v7.9.7: la card "Referencia del bote" (colapsable, con avisos y
   procedimiento) se simplificó a una sola línea informativa en el
   HTML — toggleBoteRef/initBoteRef ya no tienen elementos que
   controlar y se eliminaron. */

/* ══ PESADA RÁPIDA ══
   El operario ya hace la tara en la báscula física — la app recibe
   directamente el peso NETO. Sin campo de tara, cálculo en vivo al
   escribir. Usa los mismos pesos unitarios (#w4/#w8/#w12, protegidos
   por PIN en Ajustes desde v7.9.5) que el módulo gravimétrico
   clásico, así una recalibración vale para ambos.
   v7.9.5: se elimina el autoguardado (debounce + commit-on-change de
   v7.9.4) — ahora el operario guarda explícitamente con "💾 Guardar
   pesada" (saveQuickPesada), para tener control total sobre qué
   pesadas quedan registradas. */
let quickSize='8';
let lastQuickResult=null;

/* Verificado con segundo test físico (2 básculas distintas): 4mm ±1/100,
   8mm ±2/200 (≈±1/100), 12mm ±1/94 — las tres tallas rondan ±1 por 100. */
const QUICK_ERROR_PER_100={'4':1,'8':1,'12':1};
const QUICK_PRECISION_NOTES={
  '4': '✅ Error máximo ±1 ud en 100 uds (verificado con 2 básculas)',
  '8': '✅ Error máximo ±2 uds en 200 uds (verificado)',
  '12':'✅ Error máximo ±1 ud en 94 uds (verificado)'
};

window.selectQuickSize=function(size){
  quickSize=size;
  qsa('.quick-size-btn').forEach(b=>{
    const active=b.dataset.key===size;
    b.style.background=active?'var(--blue-dim)':'';
    b.style.borderColor=active?'var(--blue)':'';
    b.style.color=active?'var(--blue)':'';
  });
  calcQuickWeigh();
};

function quickUnitWeight(size){
  const map={'4':'#w4','8':'#w8','12':'#w12'};
  return parseFloat(qs(map[size])?.value)||UNIT_WEIGHTS['p'+size];
}

function resetSaveButtonState(){
  const btn=qs('#btnSaveQuick'); if(!btn)return;
  clearTimeout(btn._t);
  btn.textContent='💾 Guardar pesada';
  btn.disabled=false;
}

window.calcQuickWeigh=function(){
  const net=parseFloat(qs('#quickNetWeight')?.value);
  const resultBox=qs('#quickResultBox');
  if(!net||net<=0){
    resultBox.style.display='none';
    qs('#quick4mmTip').style.display='none';
    lastQuickResult=null;
    return;
  }
  const unitW=quickUnitWeight(quickSize);
  const qty=Math.round(net/unitW);
  const errEstimate=Math.max(1,Math.round(qty/100*QUICK_ERROR_PER_100[quickSize]));
  qs('#quickQty').textContent=qty.toLocaleString('es-ES');
  qs('#quickErrorLine').textContent=`±${errEstimate} ud${errEstimate>1?'s':''} (FC-2000)`;
  qs('#quickMeta').textContent=`${net.toFixed(3)} g ÷ ${unitW.toFixed(4)} g/ud`;
  qs('#quickPrecisionNote').textContent=QUICK_PRECISION_NOTES[quickSize]||'';
  qs('#quick4mmTip').style.display=quickSize==='4'?'block':'none';
  resultBox.style.display='block';
  lastQuickResult={size:quickSize,net,unitW,qty,originalQty:qty};
  resetSaveButtonState();
};

/* ══ AJUSTE MANUAL ±1 (Pesada rápida) — solo en memoria, hasta que se guarde ══ */
window.adjustQuickCount=function(delta){
  if(!lastQuickResult)return;
  lastQuickResult.qty=Math.max(0,lastQuickResult.qty+delta);
  qs('#quickQty').textContent=lastQuickResult.qty.toLocaleString('es-ES');
  resetSaveButtonState();
};

/* ══ GUARDAR PESADA (explícito) ══ */
window.saveQuickPesada=function(){
  if(!lastQuickResult)return;
  const {size,net,unitW,qty,originalQty}=lastQuickResult;
  saveQuickHistoryEntry({size,net,unitW,qty,calcTotal:originalQty});
  showToast('✓ Pesada guardada en historial');
  const btn=qs('#btnSaveQuick');
  if(btn){
    clearTimeout(btn._t);
    btn.textContent='✓ Guardado';
    btn.disabled=true;
    btn._t=setTimeout(()=>{btn.textContent='💾 Guardar pesada';btn.disabled=false;},2000);
  }
};

function saveQuickHistoryEntry({size,net,unitW,qty,calcTotal}){
  saveHistoryEntry({
    date:new Date().toLocaleDateString('es-ES')+' '+new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),
    method:'weigh',
    total:qty,calcTotal,size4:size==='4'?qty:0,size8:size==='8'?qty:0,size12:size==='12'?qty:0,
    netWeight:net,unitWeight:unitW,
    product:'Pesada rápida',notes:null,albaran:null
    // ODOO - pendiente de implementar: odoo:buildQuickOdooText()
  });
  renderWeighCounts();
}

// ODOO - pendiente de implementar (retirado en v7.9.5, código conservado para recuperarlo fácilmente)
// function buildQuickOdooText(){
//   if(!lastQuickResult)return '—';
//   const prov=qs('#qExProveedor')?.value||'—',po=qs('#qExPO')?.value||'—';
//   const pref=qs('#qExLote')?.value||'P',ubic=qs('#qExUbic')?.value||'WH/Stock';
//   const now=new Date(),seq=Math.floor(Math.random()*900)+100,pad=n=>String(n).padStart(3,'0');
//   const {size,net,qty}=lastQuickResult;
//   return [
//     '=== RECEPCIÓN PELLETS (PESADA RÁPIDA) ===',
//     `Fecha:        ${now.toLocaleDateString('es-ES')}  ${now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}`,
//     `Proveedor:    ${prov}`,`PO:           ${po}`,`Ubicación:    ${ubic}`,'---',
//     `Pellet ${size}mm   |  Lote: ${pref}-${size}MM-${pad(seq)}  |  Cant: ${qty.toLocaleString('es-ES')}`,
//     '---',`Peso neto:    ${net.toFixed(3)} g`,`Método:       báscula FC-2000 (peso neto)`,
//   ].join('\n');
// }
// window.buildQuickOdoo=function(){const el=qs('#quickOdooBlock');if(el)el.textContent=buildQuickOdooText();};
// window.copyQuickOdoo=function(){navigator.clipboard.writeText(buildQuickOdooText()).then(()=>showToast('Copiado ✓'));};

/* ══ VERIFICACIÓN CRUZADA: báscula cuenta → visión confirma ══ */
window.verifyWithVision=function(){
  if(!lastQuickResult)return;
  const {size,qty}=lastQuickResult;
  loadProfile(size);
  qs('#albaranQty').value=qty;
  switchTab('count');
};

function renderWeighCounts(){
  const el=qs('#weighCounts'); if(!el) return;
  const counts={'4':0,'8':0,'12':0};
  loadHistory().filter(e=>e.method==='weigh').forEach(e=>{
    const sizesUsed=[e.size4>0?'4':null,e.size8>0?'8':null,e.size12>0?'12':null].filter(Boolean);
    if(sizesUsed.length===1)counts[sizesUsed[0]]++;
  });
  el.innerHTML='⚖️ '+['4','8','12'].map(s=>`${s}mm:${counts[s]}`).join(' · ');
}

/* ══ SINCRONIZACIÓN ENTRE DISPOSITIVOS (v8.0) ══
   Exporta/importa un JSON con todo el localStorage "de datos" de la
   app, para pasar historial/ejemplos/pesos/perfiles entre dispositivos
   (ej. móvil → tablet) sin backend. La API key se excluye a propósito
   — es una credencial por dispositivo, no "datos", y el flujo previsto
   (enviar el JSON por WhatsApp/email) la expondría en texto plano si
   se incluyera. */
const SYNC_KEYS = ['unitWeights','activeProfile','productDesc','sizeMode','singleSize','customProducts','activeProduct','referenceExamples','analysisHistory'];
const SYNC_JSON_KEYS = ['unitWeights','customProducts','referenceExamples','analysisHistory'];

window.exportAllData = function(){
  const data = {};
  SYNC_KEYS.forEach(k => {
    const v = localStorage.getItem(k);
    if (v !== null) data[k] = v;
  });
  const backup = { app:'Pellet Counter', version:VERSION, exportedAt:new Date().toISOString(), data };
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const pad = n => String(n).padStart(2,'0');
  const now = new Date();
  const a = document.createElement('a');
  a.href = url;
  a.download = `pellet-counter-backup-${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('✓ Datos exportados');
};

window.importAllData = function(e){
  const f = e.target.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = ev => {
    let backup;
    try { backup = JSON.parse(ev.target.result); }
    catch(err) { showToast('Archivo JSON inválido', true); e.target.value=''; return; }
    const data = backup && typeof backup === 'object' ? (backup.data || backup) : null;
    if (!data || typeof data !== 'object') { showToast('El archivo no contiene datos reconocibles', true); e.target.value=''; return; }

    let historyCount=0, ex4=0, ex8=0, ex12=0;
    try { historyCount = JSON.parse(data.analysisHistory || '[]').length; } catch(err) {}
    try {
      const examples = JSON.parse(data.referenceExamples || '[]');
      ex4 = examples.filter(x => x.size === '4').length;
      ex8 = examples.filter(x => x.size === '8').length;
      ex12 = examples.filter(x => x.size === '12').length;
    } catch(err) {}
    const summary = `Importados: ${historyCount} análisis, ${ex4} ejemplos 4mm, ${ex8} ejemplos 8mm, ${ex12} ejemplos 12mm`;
    const ok = confirm(`${summary}\n\n¿Sobreescribir datos actuales? Esta acción no se puede deshacer.`);
    if (!ok) { e.target.value=''; return; }

    const skipped = [];
    SYNC_KEYS.forEach(k => {
      if (data[k] === undefined) return;
      if (SYNC_JSON_KEYS.includes(k)) {
        try { JSON.parse(data[k]); } catch(err) { skipped.push(k); return; }
      }
      localStorage.setItem(k, data[k]);
    });
    /* Un solo showToast: dos llamadas seguidas se pisarían (mismo
       elemento #toast reusado) y el aviso de "skipped" nunca se vería
       antes de la recarga de la página 800ms después. */
    showToast(skipped.length
      ? `✓ Importado con avisos — no se pudo leer: ${skipped.join(', ')}. Recargando…`
      : '✓ Datos importados — recargando…', skipped.length>0);
    e.target.value = '';
    setTimeout(() => window.location.reload(), 800);
  };
  reader.onerror = () => showToast('No se pudo leer el archivo', true);
  reader.readAsText(f);
};

/* ══ HISTORIAL ══ */
function loadHistory(){return JSON.parse(localStorage.getItem('analysisHistory')||'[]');}
function saveHistoryEntry(entry){
  const h=loadHistory();h.unshift(entry);if(h.length>50)h.pop();
  localStorage.setItem('analysisHistory',JSON.stringify(h));updateHistoryBadge();
}
function updateLastHistoryTotal(newTotal,size4,size8,size12){
  const h=loadHistory(); if(h.length===0)return;
  h[0].total=newTotal; h[0].size4=size4; h[0].size8=size8; h[0].size12=size12;
  localStorage.setItem('analysisHistory',JSON.stringify(h));
}
function updateHistoryBadge(){const h=loadHistory(),b=qs('#historyBadge');if(b)b.textContent=h.length>0?h.length:'';}

/* ══ FILTRO HISTORIAL: Todos / Visión IA / Báscula ══
   v7.9.4: 3 botones tipo radio en vez de toggle (antes solo había
   Visión/Báscula y pulsar de nuevo volvía a 'all', sin un botón
   "Todos" explícito). */
let historyFilter='all';
window.filterHistory=function(type){
  historyFilter=type;
  qsa('.hist-subtab').forEach(b=>b.classList.toggle('active',b.dataset.histsub===historyFilter));
  renderHistory();
};
window.renderHistory=function(){
  const el=qs('#historyList');if(!el)return;
  /* _i conserva el índice REAL en analysisHistory (para copyHistEntry),
     distinto de la posición dentro de la lista ya filtrada por sub-tab. */
  let h=loadHistory().map((e,i)=>({...e,_i:i}));
  const visionCount=h.filter(e=>e.method!=='weigh').length;
  const weighCount=h.filter(e=>e.method==='weigh').length;
  const hc=qs('#histCounts');
  if(hc)hc.textContent=`📷 ${visionCount} análisis · ⚖️ ${weighCount} pesadas`;
  if(historyFilter==='vision')h=h.filter(e=>e.method!=='weigh');
  else if(historyFilter==='weigh')h=h.filter(e=>e.method==='weigh');
  if(h.length===0){el.innerHTML='<p style="color:var(--muted);font-size:13px;text-align:center;padding:24px">Sin análisis aún</p>';return;}
  /* Confianza: icono de FORMA distinta (no solo color) + texto siempre visible,
     para no chocar visualmente con los colores de los badges de tamaño. */
  const confDisplay={
    alta:{icon:'✅',label:'alta',color:'var(--green)'},
    media:{icon:'⚠️',label:'media',color:'var(--orange)'},
    baja:{icon:'❌',label:'baja',color:'var(--red)'}
  };
  /* Tamaño: fondo sólido + texto blanco, distinto de los colores de confianza */
  const sizeBg={4:'var(--blue-dim)',8:'var(--green-dim)',12:'var(--orange-dim)'};
  el.innerHTML=h.map((e)=>{
    const notesShort=e.notes?(e.notes.length>80?e.notes.slice(0,80)+'...':e.notes):'';
    const sizesUsed=[e.size4>0?4:null,e.size8>0?8:null,e.size12>0?12:null].filter(Boolean);
    const sizeBadge=sizesUsed.length===1
      ?`<span style="font-size:11px;font-weight:700;color:#fff;background:${sizeBg[sizesUsed[0]]};padding:2px 9px;border-radius:10px">● ${sizesUsed[0]}mm</span>`
      :sizesUsed.map(s=>`<span style="font-size:11px;font-weight:700;color:#fff;background:${sizeBg[s]};padding:2px 9px;border-radius:10px;margin-right:4px">● ${s}mm:${e['size'+s]}</span>`).join('');
    const isWeigh=e.method==='weigh';
    const wasCorrected=isWeigh
      ?e.calcTotal!==undefined&&e.calcTotal!==e.total
      :e.aiTotal!==undefined&&e.aiTotal!==e.total;
    const baseVal=isWeigh?e.calcTotal:e.aiTotal;
    const baseLabel=isWeigh?'⚖️ ':'IA: ';
    const totalDisplay=wasCorrected
      ?`<span style="font-size:13px;font-weight:700">${baseLabel}${baseVal} uds (calculado) → ✏️ ${e.total} uds (${e.total-baseVal>0?'+':''}${e.total-baseVal} corregido)</span>`
      :`<span style="font-size:15px;font-weight:700">${isWeigh?'⚖️ ':''}${e.total} uds</span>`;
    const cd=confDisplay[e.confidence];
    const confBadge=isWeigh
      ?`<span style="font-size:11px;color:var(--muted);flex-shrink:0;font-family:'SF Mono','Fira Code',monospace">${e.netWeight?.toFixed(3)}g ÷ ${e.unitWeight?.toFixed(3)}g/ud</span>`
      :cd
      ?`<span style="font-size:12px;font-weight:700;color:${cd.color};display:inline-flex;align-items:center;gap:3px;flex-shrink:0">${cd.icon} ${cd.label}</span>`
      :`<span style="font-size:12px;color:var(--muted);flex-shrink:0">—</span>`;
    /* v7.9.6: desglose por foto de las entradas de multifoto, más
       visible que el antiguo "F1:49 F2:51" comprimido en notes.
       v7.9.8: cada foto pasó a guardar {ai,total} en vez de solo el
       total final, para poder mostrar qué fotos se corrigieron y
       cuánto (ej. "F1: 54→51 (-3)"). `typeof p==='number'` mantiene
       compatibilidad con entradas guardadas en v7.9.6/v7.9.7, que
       solo tenían el número final. */
    const photoBreakdownHtml=Array.isArray(e.photoBreakdown)&&e.photoBreakdown.length>0
      ?`<div style="font-size:11px;color:var(--hint);margin-bottom:6px;line-height:1.6">
          📷 ${e.photoBreakdown.map((p,idx)=>{
            const label=`F${idx+1}`;
            if(typeof p==='number')return `${label}: ${p} uds`;
            if(p.ai===p.total)return `${label}: ${p.total} uds`;
            const diff=p.total-p.ai;
            return `${label}: ${p.ai}→${p.total} (${diff>0?'+':''}${diff})`;
          }).join(' · ')}
        </div>
        <div style="border-top:0.5px dashed var(--border);margin-bottom:6px"></div>`
      :'';
    return `<div style="background:var(--surface);border:0.5px solid var(--border);border-radius:var(--radius);padding:12px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;gap:8px">
        ${totalDisplay}
        ${confBadge}
      </div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:4px">${e.date}</div>
      ${photoBreakdownHtml}
      ${notesShort?`<div style="font-size:11px;color:var(--hint);font-style:italic;margin-bottom:6px">${notesShort}</div>`:''}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;align-items:center">
        ${sizeBadge}
        ${e.albaran?`<span style="font-size:11px;color:var(--muted)">Albarán:${e.albaran}</span>`:''}
      </div>
      <button onclick="copyHistEntry(${e._i})" style="font-size:11px;padding:5px 10px">📋 Copiar resultado</button>
    </div>`;
  }).join('');
};
/* v7.9.5: ya no copia formato Odoo, solo un resumen en texto plano,
   ej. "Pellet 8mm · 55 uds · 23/9/2026 18:22 · Confianza alta". */
function buildResultSummary(e){
  const sizesUsed=[e.size4>0?4:null,e.size8>0?8:null,e.size12>0?12:null].filter(Boolean);
  const sizeLabel=sizesUsed.length===1?`${sizesUsed[0]}mm`:sizesUsed.map(s=>`${s}mm:${e['size'+s]}`).join(' + ');
  const parts=[`Pellet ${sizeLabel}`,`${e.total} uds`,e.date];
  if(e.method==='weigh')parts.push('Pesada báscula');
  else if(e.confidence)parts.push(`Confianza ${e.confidence}`);
  return parts.join(' · ');
}
window.copyHistEntry=function(i){
  const h=loadHistory();const e=h[i];if(!e)return;
  navigator.clipboard.writeText(buildResultSummary(e)).then(()=>showToast('Copiado ✓'));
};
window.clearHistory=function(){if(!confirm('¿Borrar todo el historial?'))return;localStorage.removeItem('analysisHistory');updateHistoryBadge();renderHistory();renderWeighCounts();};

/* ══ ESTADO DEL ENTRENAMIENTO (dashboard en Ajustes) ══ */
function computeStats() {
  const bySize={'4':[],'8':[],'12':[]};
  loadHistory().forEach(e=>{
    if(e.aiTotal===undefined)return;
    const sizesUsed=[e.size4>0?'4':null,e.size8>0?'8':null,e.size12>0?'12':null].filter(Boolean);
    if(sizesUsed.length!==1)return;
    bySize[sizesUsed[0]].push(e);
  });
  const examples=getReferenceExamples();
  const stats={};
  ['4','8','12'].forEach(size=>{
    const entries=bySize[size];
    const corrected=entries.filter(e=>e.total!==e.aiTotal);
    stats[size]={
      totalAnalyses:entries.length,
      correctedCount:corrected.length,
      exampleCount:examples.filter(e=>e.size===size).length,
      avgAbsError:corrected.length?corrected.reduce((s,e)=>s+Math.abs(e.total-e.aiTotal),0)/corrected.length:null,
      avgSignedError:corrected.length?corrected.reduce((s,e)=>s+(e.total-e.aiTotal),0)/corrected.length:null,
      precisionPct:entries.length?Math.round((entries.length-corrected.length)/entries.length*100):null
    };
  });
  return stats;
}
function trainingBarHTML(size,count){
  const filled='█'.repeat(Math.min(count,FEWSHOT_TARGET));
  const empty='░'.repeat(Math.max(0,FEWSHOT_TARGET-count));
  const status=count===0?'inactivo':count>=FEWSHOT_TARGET?'activo':'parcial';
  const color=count===0?'var(--muted)':count>=FEWSHOT_TARGET?'var(--green)':'var(--blue)';
  return `<div style="font-family:'SF Mono','Fira Code',monospace;font-size:12px;margin-bottom:6px">
    <span style="color:var(--muted)">${size}mm:</span> <span style="color:${color}">[${filled}${empty}]</span> ${count}/${FEWSHOT_TARGET} ejemplos — few-shot ${status}
  </div>`;
}
/* Error consistente (siempre en la misma dirección) sugiere ajustar el
   prompt; error que varía de signo sugiere que el problema es la foto
   (amontonamiento), no el prompt — ahí conviene multifoto con grupos chicos. */
function trainingRecommendation(s){
  if(s.totalAnalyses===0||s.correctedCount===0)return '—';
  const consistency=Math.abs(s.avgSignedError)/s.avgAbsError;
  return consistency>0.6?'Ajustar prompt':'Multifoto, grupos chicos';
}
window.renderStats = function renderStats() {
  const el=qs('#trainingDashboard'); if(!el)return;
  const stats=computeStats();
  const sizes=['4','8','12'];
  const row=(label,fn)=>`<tr><td style="padding:5px 4px;color:var(--muted);font-weight:700;text-align:left;border-top:0.5px solid var(--border)">${label}</td>${sizes.map(s=>`<td style="padding:5px 4px;text-align:center;border-top:0.5px solid var(--border)">${fn(stats[s])}</td>`).join('')}</tr>`;
  const table=`<div style="overflow-x:auto;margin-bottom:14px"><table style="width:100%;border-collapse:collapse;font-size:11px;min-width:280px">
    <thead><tr>
      <th></th>${sizes.map(s=>`<th style="padding:5px 4px;color:var(--text);font-size:11px;border-bottom:1px solid var(--border2)">${s}mm</th>`).join('')}
    </tr></thead>
    <tbody>
      ${row('Muest.',s=>s.totalAnalyses===0?'—':s.totalAnalyses)}
      ${row('Ejem.',s=>`${s.exampleCount}/${FEWSHOT_TARGET}`)}
      ${row('Error',s=>s.totalAnalyses===0?'—':(s.correctedCount===0?'±0':'±'+Math.round(s.avgAbsError)))}
      ${row('Tend.',s=>s.totalAnalyses===0?'—':(s.correctedCount===0?'OK':(s.avgSignedError>0.3?'sub':s.avgSignedError<-0.3?'sobre':'OK')))}
      ${row('Prec.',s=>s.totalAnalyses===0?'—':s.precisionPct+'%')}
      ${row('Recom.',s=>trainingRecommendation(s))}
    </tbody>
  </table></div>`;
  el.innerHTML=table+sizes.map(s=>trainingBarHTML(s,stats[s].exampleCount)).join('');
};

/* ══ PWA ══ */
let deferredPrompt;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;const b=qs('#installBanner');if(b)b.style.display='flex';});
qs('#installBtn')&&qs('#installBtn').addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;qs('#installBanner').style.display='none';});
if('serviceWorker'in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
  /* recarga automática cuando un SW nuevo toma el control, para que las
     actualizaciones (fixes) lleguen sin tener que cerrar y reabrir la app */
  let swReloaded=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(swReloaded)return; swReloaded=true; window.location.reload();
  });
}

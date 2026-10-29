const $ = selector => document.querySelector(selector);
const view = $('#view'), dialog = $('#dialog');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = value => new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 }).format(value);
const date = value => new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' }).format(new Date(value));
const labels = { available: 'Disponible', reserved: 'Reservado', delivered: 'Entregado', expired: 'Plazo vencido' };
let data, tab = 'available', search = '', token = sessionStorage.getItem('mermacero-token') || '', noticeTimer;
const org = id => data.organizations.find(o => o.id === id);
const hoursLeft = lot => Math.max(0, (+new Date(lot.pickupBy) - Date.now()) / 3600000);
function notice(message, error = false) {
  const el = $('#notice'); el.textContent = message; el.classList.toggle('error', error); el.hidden = false;
  clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { el.hidden = true; }, 6000);
}
async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401) { token = ''; sessionStorage.removeItem('mermacero-token'); updateAuth(); }
    throw new Error(result.error || 'No se pudo completar la solicitud.');
  }
  return result;
}
function updateAuth() { $('#auth-button').textContent = token ? 'Coordinador · Cerrar sesión' : 'Ingresar como coordinador'; }
function modal(title, html) {
  $('#dialog-title').textContent = title; $('#dialog-body').innerHTML = html;
  if (!dialog.open) dialog.showModal();
}
$('#close-dialog').addEventListener('click', () => dialog.close());
function login(after) {
  modal('Acceso de coordinación', `<p class="muted">La consulta es pública. Para registrar y coordinar rescates necesitas la clave del proyecto.</p>${data?.storage === 'demo' ? '<p>Clave de la demo local: <strong>mermacero-demo</strong></p>' : ''}<form id="login-form"><label class="field">Clave<input name="password" type="password" required autocomplete="current-password" minlength="12"></label><p class="form-error" role="alert"></p><div class="form-actions"><button class="primary">Ingresar</button></div></form>`);
  $('#login-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget, button = form.querySelector('button'); button.disabled = true;
    try { const result = await api('/login', { method: 'POST', body: JSON.stringify({ password: form.elements.password.value }) }); token = result.token; sessionStorage.setItem('mermacero-token', token); updateAuth(); dialog.close(); if (after) after(); }
    catch (error) { form.querySelector('.form-error').textContent = error.message; }
    finally { button.disabled = false; }
  });
}
function admin(action) { if (token) action(); else login(action); }
$('#auth-button').addEventListener('click', async () => {
  if (!token) return login();
  try { await api('/logout', { method: 'POST', body: '{}' }); } catch { /* token may have expired */ }
  token = ''; sessionStorage.removeItem('mermacero-token'); updateAuth(); notice('Sesión cerrada.');
});
async function load() {
  data = await api('/data');
  $('#connection').textContent = data.storage === 'mongodb' ? 'MongoDB · Conectado' : 'Demo local · Memoria temporal';
  render();
}
function route() { return ['rescates', 'red', 'proyecto'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'rescates'; }
function render() {
  const current = route();
  document.querySelectorAll('[data-nav]').forEach(a => { if (a.dataset.nav === current) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (!data) return;
  if (current === 'rescates') renderRescues();
  if (current === 'red') renderNetwork();
  if (current === 'proyecto') renderProject();
}
function sampleNotice() {
  const hasSamples = data.lots.some(l => l.isSample) || data.organizations.some(o => o.isSample);
  return hasSamples ? `<div class="sample-notice"><span>Contiene registros ficticios, marcados como «Ejemplo».</span><span>${data.storage === 'demo' ? 'Los cambios se pierden al reiniciar.' : 'Persistencia real en MongoDB.'}</span></div>` : '';
}
function renderRescues() {
  const s = data.summary;
  const urgent = data.lots.filter(l => l.effectiveStatus === 'available').sort((a, b) => a.pickupBy.localeCompare(b.pickupBy)).slice(0, 3);
  view.innerHTML = `<div class="title-row"><div><h1>Rescates</h1><p>${s.urgentCount ? `${s.urgentCount} ${s.urgentCount === 1 ? 'lote necesita' : 'lotes necesitan'} recojo en menos de 6 horas.` : 'Cada lote cuenta. Coordina su próximo destino.'}</p></div><button class="primary" data-action="new-lot">+ Publicar lote</button></div>
    ${sampleNotice()}<section class="metrics" aria-label="Balance de toda la red"><div class="metric"><span>Por recoger</span><strong>${num(s.availableKg)} <small>kg</small></strong></div><div class="metric"><span>En coordinación</span><strong>${num(s.reservedKg)} <small>kg</small></strong></div><div class="metric"><span>Entrega confirmada</span><strong>${num(s.deliveredKg)} <small>kg</small></strong></div></section>
    <div class="layout"><section aria-label="Lista de lotes"><div class="tabs" aria-label="Filtrar por estado">${Object.entries(labels).map(([id, label]) => `<button data-tab="${id}" aria-pressed="${tab === id}">${label} <span>(${data.lots.filter(l => l.effectiveStatus === id).length})</span></button>`).join('')}</div><div class="toolbar"><input id="search" aria-label="Buscar alimento, mercado o distrito" placeholder="Buscar alimento o mercado" value="${esc(search)}"><span id="result-count"></span><button data-action="refresh" aria-label="Actualizar datos">↻</button></div><div id="lot-list"></div></section>
    <aside><section class="panel"><div class="panel-head"><h2>Primero, lo urgente</h2><small>Plazo de recojo</small></div><ol class="priority-list">${urgent.map(l => `<li><strong>${esc(l.title)}</strong><small>${num(l.kg)} kg · ${num(Math.round(hoursLeft(l) * 10) / 10)} h restantes</small><button class="text" data-action="detail" data-id="${esc(l.id)}">${l.recommendations.length ? `${l.recommendations.length} comedores compatibles →` : 'Ver condiciones →'}</button></li>`).join('') || '<li class="muted">No hay lotes pendientes de recojo.</li>'}</ol></section>
    <section class="panel"><h2>Un rescate, tres pasos</h2><div class="chain"><b>Publicar</b><span>→</span><b>Reservar</b><span>→</span><b>Entregar</b></div><p class="muted">La recomendación cruza plazo, distancia y capacidad. Solo las entregas confirmadas suman kilos recuperados.</p><a href="#proyecto">Cómo se decide la prioridad →</a></section>
    <small>Actualizado: ${date(data.updatedAt)} · hora de Lima.<br>Balance acumulado de toda la red, independiente del filtro.</small></aside></div><p class="footer-note">El plazo lo declara el mercado. La recomendación logística no certifica la inocuidad del alimento.</p>`;
  renderLots();
  $('#search').addEventListener('input', event => { search = event.target.value; renderLots(); });
}
function renderLots() {
  const needle = search.toLocaleLowerCase('es');
  const rows = data.lots.filter(l => l.effectiveStatus === tab && `${l.title} ${org(l.marketId)?.name} ${org(l.marketId)?.district}`.toLocaleLowerCase('es').includes(needle)).sort((a, b) => a.pickupBy.localeCompare(b.pickupBy));
  $('#result-count').textContent = `${rows.length} ${rows.length === 1 ? 'lote' : 'lotes'}`;
  $('#lot-list').innerHTML = rows.map(l => {
    const market = org(l.marketId), kitchen = org(l.kitchenId), urgent = tab === 'available' && hoursLeft(l) < 6;
    return `<article class="lot"><div class="lot-top"><div><h2 class="lot-title"><button class="text" data-action="detail" data-id="${esc(l.id)}">${esc(l.title)}</button></h2><div class="lot-meta">${esc(market?.name)} · ${esc(market?.district)}${l.isSample ? ' · Ejemplo' : ''}<br>${esc(l.category)}${l.refrigerated ? ' · Requiere refrigeración' : ''}</div></div><div class="lot-kg">${num(l.kg)} <small>kg</small></div></div><div class="lot-bottom"><span class="status ${urgent ? 'urgent' : tab === 'delivered' ? 'delivered' : ''}">${tab === 'reserved' ? `Para ${esc(kitchen?.name)}` : tab === 'delivered' ? `Entregado · ${date(l.deliveredAt)}` : `${urgent ? 'Recojo urgente · ' : 'Recoger antes del '}${date(l.pickupBy)}`}</span><button class="lot-action" data-action="detail" data-id="${esc(l.id)}">${tab === 'available' ? 'Ver destinos' : 'Ver detalle'} →</button></div></article>`;
  }).join('') || '<div class="empty">No hay lotes con este estado y búsqueda.</div>';
}
function renderNetwork() {
  view.innerHTML = `<div class="title-row"><div><h1>Mercados y comedores</h1><p>${data.organizations.filter(o => o.type === 'market').length} mercados y ${data.organizations.filter(o => o.type === 'kitchen').length} comedores en la red.</p></div><button class="primary" data-action="new-org">+ Registrar organización</button></div>${sampleNotice()}<div class="orgs">${data.organizations.map(o => `<article class="org"><small>${o.type === 'market' ? 'Mercado donante' : 'Comedor receptor'}${o.isSample ? ' · Ejemplo' : ''}</small><h2>${esc(o.name)}</h2><p>${esc(o.district)}</p>${o.type === 'kitchen' ? `<p>${o.categories.map(esc).join(' · ')}</p><div class="keyvalues"><div><span>Capacidad por recojo</span><b>${num(o.capacityKg)} kg</b></div><div><span>Radio máximo</span><b>${num(o.maxDistanceKm)} km</b></div><div><span>Refrigeración</span><b>${o.refrigeration ? 'Disponible' : 'Sin refrigeración'}</b></div></div>` : '<p>Publica excedentes y declara el plazo de recojo de cada lote.</p>'}<small>Coordenadas: ${o.lat}, ${o.lng}</small></article>`).join('') || '<p class="empty">Registra primero un mercado y un comedor para coordinar el primer rescate.</p>'}</div><p class="footer-note">La capacidad es por lote/recojo, no un límite diario acumulado. Los registros de ejemplo no representan entidades reales.</p>`;
}
function renderProject() {
  view.innerHTML = `<div class="title-row"><div><h1>Sobre MermaCero</h1><p>Del excedente al siguiente plato.</p></div></div><article class="prose"><h2>El problema que abordamos</h2><p>Un excedente puede perderse mientras un comedor cercano necesita insumos. Publicar el alimento es solo una parte: también hay que coordinar quién puede recibirlo, cuánto puede recoger y dentro de qué plazo.</p><h2>La propuesta de innovación</h2><p>Una red local que combina el plazo declarado del lote con las condiciones de los comedores y explica cada recomendación. Su aporte propuesto es coordinar decisiones de rescate con recursos limitados, sin exigir sensores ni equipamiento nuevo a cada mercado.</p><p>Está planteada para la línea de sistemas agroalimentarios resilientes y cadenas regionales del <a href="https://solve.mit.edu/challenges/2027-global-climate-challenge" target="_blank" rel="noopener">Global Climate Challenge 2027 de MIT Solve</a>. Este es un prototipo académico; su novedad y utilidad deben validarse con usuarios y soluciones existentes.</p><h2>Cómo funciona el motor de recomendaciones</h2><p>Primero descarta comedores que no aceptan la categoría, no tienen capacidad para todo el lote, exceden su radio, carecen de refrigeración cuando se requiere o no llegarían dentro del plazo estimado.</p><div class="formula"><strong>Puntaje = 100 × (0,50 × urgencia + 0,30 × cercanía + 0,20 × ajuste de capacidad)</strong></div><ul><li>Urgencia: máximo entre 0 y (1 − horas restantes / 24).</li><li>Cercanía: máximo entre 0 y (1 − distancia / radio del comedor).</li><li>Ajuste: kilos del lote / capacidad por recojo. Se prioriza aprovechar la capacidad disponible.</li><li>Distancia: fórmula de Haversine, en línea recta.</li><li>Tiempo ilustrativo: distancia / 15 km/h + 30 minutos. No considera tráfico ni rutas reales.</li></ul><p>La urgencia es común a los destinos de un mismo lote; cercanía y capacidad distinguen a los comedores. El puntaje es una heurística, no una probabilidad ni una predicción con inteligencia artificial.</p><h2>Qué podemos demostrar</h2><div class="split"><section class="panel"><h3>En este prototipo</h3><p>Registro de mercados y comedores, CRUD de lotes disponibles, recomendaciones explicadas, reserva exclusiva, liberación, entrega confirmada e historial por lote.</p></section><section class="panel"><h3>Validación pendiente</h3><p>Entrevistas, piloto con organizaciones reales, tiempos de recojo medidos, protocolos de manipulación y evaluación del impacto ambiental neto.</p></section></div><h2>Medición honesta del impacto</h2><p>Los indicadores suman kilos disponibles, reservados y entregados. Solo una entrega confirmada suma al indicador de recuperación. No se presentan toneladas de CO₂ evitadas: se necesitarían factores documentados, una línea base y emisiones del transporte.</p><h2>Modelo sostenible propuesto</h2><p>Acceso para mercados y comedores, financiado inicialmente por un piloto universitario o municipal. Una fase posterior evaluaría convenios con municipios y asociaciones de mercados para sostener la coordinación.</p><h2>Arquitectura y datos</h2><p>Interfaz web adaptable → API en Node.js y Express, alojada en Render → MongoDB Atlas. Las colecciones son <strong>organizations</strong> y <strong>lots</strong>; cada lote incluye su historial. La clave de coordinación y la conexión de MongoDB se configuran en el servidor.</p><p>El prototipo usa una sola cuenta de coordinación. No incluye validación de organizaciones, roles independientes, logística real ni certificación sanitaria. Usa únicamente datos de prueba durante la presentación pública.</p><div class="form-actions"><button data-action="seed">Cargar registros ficticios de ejemplo</button></div><p class="footer-note">La carga agrega únicamente ejemplos que no existan; no borra ni sobrescribe tus registros. Los ejemplos existentes mantienen sus fechas y estados.</p></article>`;
}
function localDate(value) { const d = new Date(value); return new Date(+d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function field(label, input, wide = false) { return `<label class="field${wide ? ' wide' : ''}">${label}${input}</label>`; }
function lotForm(id) {
  const lot = data.lots.find(l => l.id === id);
  const markets = data.organizations.filter(o => o.type === 'market');
  if (!markets.length) { notice('Registra primero un mercado.', true); return orgForm(); }
  modal(lot ? 'Editar lote disponible' : 'Publicar un lote', `<form id="lot-form"><div class="form-grid">${field('Alimento', `<input name="title" required minlength="2" maxlength="100" value="${esc(lot?.title || '')}" placeholder="Por ejemplo: tomates maduros">`, true)}${field('Mercado', `<select name="marketId">${markets.map(o => `<option value="${esc(o.id)}" ${lot?.marketId === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select>`)}${field('Categoría', `<select name="category">${data.categories.map(c => `<option ${lot?.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>`)}${field('Peso total (kg)', `<input name="kg" type="number" min="0.1" max="10000" step="0.01" required value="${lot?.kg || ''}">`)}${field('Recoger antes de (hora de tu dispositivo)', `<input name="pickupBy" type="datetime-local" required value="${localDate(lot?.pickupBy || Date.now() + 6 * 3600000)}">`)}<label class="check field wide"><input name="refrigerated" type="checkbox" ${lot?.refrigerated ? 'checked' : ''}>Requiere refrigeración (obligatoria para lácteos)</label>${field('Observaciones de conservación y recojo', `<textarea name="notes" rows="3" maxlength="500">${esc(lot?.notes || '')}</textarea>`, true)}</div><p class="form-error" role="alert"></p><div class="form-actions"><button class="primary">${lot ? 'Guardar cambios' : 'Publicar lote'}</button></div></form>`);
  bindForm('#lot-form', async form => {
    const body = Object.fromEntries(new FormData(form)); body.kg = Number(body.kg); body.pickupBy = new Date(body.pickupBy).toISOString(); body.refrigerated = form.elements.refrigerated.checked;
    await api(id ? `/lots/${encodeURIComponent(id)}` : '/lots', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    tab = 'available'; await load(); notice('Lote guardado.');
  });
}
function orgForm() {
  modal('Registrar organización', `<form id="org-form"><div class="form-grid">${field('Nombre', '<input name="name" required minlength="2" maxlength="100">', true)}${field('Tipo', '<select name="type" id="org-type"><option value="market">Mercado</option><option value="kitchen">Comedor</option></select>')}${field('Distrito', '<input name="district" required minlength="2" maxlength="100">')}${field('Latitud', '<input name="lat" type="number" step="any" min="-90" max="90" placeholder="-12.111" required>')}${field('Longitud', '<input name="lng" type="number" step="any" min="-180" max="180" placeholder="-77.011" required>')}<div class="field wide"><small>Usa coordenadas decimales del punto de recojo o recepción.</small></div><div id="kitchen-fields" class="field wide" hidden><div class="form-grid">${field('Capacidad por recojo (kg)', '<input name="capacityKg" type="number" min="0.1" max="10000" step="0.1" value="30">')}${field('Radio de recojo (km)', '<input name="maxDistanceKm" type="number" min="0.1" max="100" step="0.1" value="10">')}<label class="check field wide"><input name="refrigeration" type="checkbox">Cuenta con refrigeración</label><fieldset class="wide"><legend>Categorías aceptadas</legend><div class="check-group">${data.categories.map(c => `<label class="check"><input name="categories" type="checkbox" value="${esc(c)}" checked>${esc(c)}</label>`).join('')}</div></fieldset></div></div></div><p class="form-error" role="alert"></p><div class="form-actions"><button class="primary">Registrar organización</button></div></form>`);
  $('#org-type').addEventListener('change', event => { $('#kitchen-fields').hidden = event.target.value !== 'kitchen'; });
  bindForm('#org-form', async form => {
    const body = Object.fromEntries(new FormData(form));
    for (const k of ['lat', 'lng', 'capacityKg', 'maxDistanceKm']) body[k] = Number(body[k]);
    body.categories = [...form.querySelectorAll('[name=categories]:checked')].map(el => el.value); body.refrigeration = form.elements.refrigeration.checked;
    await api('/organizations', { method: 'POST', body: JSON.stringify(body) }); await load(); notice('Organización registrada.');
  });
}
function bindForm(selector, work) {
  $(selector).addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget, button = form.querySelector('button[type=submit], .form-actions button'); button.disabled = true;
    try { await work(form); dialog.close(); }
    catch (error) { form.querySelector('.form-error').textContent = error.message; }
    finally { button.disabled = false; }
  });
}
function detail(id) {
  const lot = data.lots.find(l => l.id === id); if (!lot) return notice('El lote ya no existe. Actualiza los datos.', true);
  const market = org(lot.marketId), kitchen = org(lot.kitchenId);
  modal(lot.title, `<p class="muted">${esc(market?.name)} · ${esc(market?.district)}${lot.isSample ? ' · Ejemplo ficticio' : ''}</p><div class="keyvalues"><div><span>Estado</span><b>${labels[lot.effectiveStatus]}</b></div><div><span>Peso / categoría</span><b>${num(lot.kg)} kg · ${esc(lot.category)}</b></div><div><span>Plazo de recojo (Lima)</span><b>${date(lot.pickupBy)}</b></div><div><span>Refrigeración requerida</span><b>${lot.refrigerated ? 'Sí' : 'No'}</b></div>${kitchen ? `<div><span>Comedor reservado</span><b>${esc(kitchen.name)}</b></div>` : ''}</div><p class="footer-note">${esc(lot.notes)}</p>
    ${lot.effectiveStatus === 'available' ? `<h3>Destinos compatibles</h3><p class="muted">Puntaje de prioridad, de 0 a 100. Las distancias son en línea recta y los tiempos son ilustrativos.</p>${lot.recommendations.map((c, i) => `<section class="candidate"><div class="candidate-head"><div><strong>${i + 1}. ${esc(c.kitchenName)}</strong><small>${esc(c.district)} · ${c.estimatedMinutes} min estimados</small></div><span class="score">${c.score}<small> /100</small></span></div><ul>${c.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul><button data-action="reserve" data-id="${esc(lot.id)}" data-kitchen="${esc(c.kitchenId)}">Reservar para este comedor</button></section>`).join('') || '<p class="empty">Ningún comedor cumple las condiciones. Puedes registrar otro comedor o revisar el lote.</p>'}` : ''}
    ${lot.status === 'reserved' ? `<div class="form-actions"><button data-action="release" data-id="${esc(lot.id)}">Liberar reserva</button>${lot.effectiveStatus === 'reserved' ? `<button class="primary" data-action="confirm-delivery" data-id="${esc(lot.id)}">Registrar recepción</button>` : ''}</div>` : ''}
    ${lot.status === 'available' ? `<div class="form-actions"><button data-action="edit-lot" data-id="${esc(lot.id)}">Editar lote</button><button class="danger" data-action="confirm-delete" data-id="${esc(lot.id)}">Eliminar lote</button></div>` : ''}
    <h3 class="section-heading">Historial del lote</h3><ol class="history">${lot.history.map(h => `<li>${esc(h.action === 'edited' ? 'Datos editados' : h.action === 'released' ? 'Reserva liberada' : labels[h.status] || h.status)} · ${date(h.at)}</li>`).join('')}</ol>`);
}
async function mutate(path, body, message, nextTab) {
  await api(path, { method: 'POST', body: JSON.stringify(body) });
  if (nextTab) tab = nextTab;
  await load(); dialog.close(); notice(message);
}
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action], [data-tab]'); if (!button) return;
  if (button.dataset.tab) { tab = button.dataset.tab; return renderRescues(); }
  const { action, id, kitchen } = button.dataset;
  try {
    if (action === 'refresh') { await load(); notice('Datos actualizados.'); }
    if (action === 'new-lot') admin(() => lotForm());
    if (action === 'edit-lot') admin(() => lotForm(id));
    if (action === 'new-org') admin(orgForm);
    if (action === 'detail') detail(id);
    if (action === 'reserve') admin(async () => {
      button.disabled = true;
      try { await mutate(`/lots/${encodeURIComponent(id)}/reserve`, { kitchenId: kitchen }, 'Reserva registrada.', 'reserved'); }
      catch (error) { notice(error.message, true); } finally { button.disabled = false; }
    });
    if (action === 'release') admin(async () => { try { await mutate(`/lots/${encodeURIComponent(id)}/release`, {}, 'Reserva liberada.', 'available'); } catch (error) { notice(error.message, true); } });
    if (action === 'confirm-delivery') admin(() => {
      modal('Confirmar recepción', `<p>Confirma la recepción completa de <strong>${esc(data.lots.find(l => l.id === id)?.title)}</strong>. La entrega sumará al total de kilos recuperados.</p><form id="delivery-form"><label class="check"><input type="checkbox" required>El comedor confirmó que recibió todo el lote.</label><p class="form-error" role="alert"></p><div class="form-actions"><button class="primary">Confirmar entrega</button></div></form>`);
      bindForm('#delivery-form', () => mutate(`/lots/${encodeURIComponent(id)}/deliver`, { receiptConfirmed: true }, 'Entrega registrada.', 'delivered'));
    });
    if (action === 'confirm-delete') admin(() => {
      modal('Eliminar lote', `<p>Se eliminará definitivamente <strong>${esc(data.lots.find(l => l.id === id)?.title)}</strong> y su historial. Solo se permite si no está reservado ni entregado.</p><form id="delete-form"><p class="form-error" role="alert"></p><div class="form-actions"><button class="danger">Eliminar definitivamente</button></div></form>`);
      bindForm('#delete-form', async () => { await api(`/lots/${encodeURIComponent(id)}`, { method: 'DELETE' }); await load(); notice('Lote eliminado.'); });
    });
    if (action === 'seed') admin(async () => { try { const result = await api('/seed', { method: 'POST', body: '{}' }); await load(); notice(`${result.inserted} registros de ejemplo agregados.`); } catch (error) { notice(error.message, true); } });
  } catch (error) { notice(error.message, true); }
});
window.addEventListener('hashchange', render);
updateAuth();
load().catch(error => { view.innerHTML = `<h1>No se pudo cargar la red</h1><p>${esc(error.message)}</p><button data-action="refresh">Reintentar</button>`; $('#connection').textContent = 'Sin conexión'; });
setInterval(() => { if (!dialog.open && !document.hidden) load().catch(() => { $('#connection').textContent = 'No se pudo actualizar · Datos anteriores'; }); }, 60000);

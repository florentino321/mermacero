export const categories = ['Comida preparada', 'Panadería', 'Verduras', 'Frutas', 'Abarrotes', 'Lácteos'];
export const recoveryMethods = ['compost', 'biodigestion'];
export const routeOf = lot => lot.route || 'donation';
export class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fail = message => { throw new AppError(message); };
function text(value, label, min = 2, max = 100) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) fail(`${label}: entre ${min} y ${max} caracteres.`);
  return value.trim();
}
function number(value, label, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(`${label}: debe estar entre ${min} y ${max}.`);
  return value;
}
export function organizationInput(body) {
  if (!['market', 'kitchen', 'recycler'].includes(body.type)) fail('Selecciona donante, organización social o gestor orgánico.');
  const org = {
    name: text(body.name, 'Nombre'), type: body.type,
    district: text(body.district, 'Distrito'),
    lat: number(body.lat, 'Latitud', -90, 90), lng: number(body.lng, 'Longitud', -180, 180)
  };
  if (body.type === 'market') org.donorKind = ['restaurant', 'cafeteria', 'event', 'bakery', 'other'].includes(body.donorKind) ? body.donorKind : 'other';
  if (['kitchen', 'recycler'].includes(body.type)) {
    if (!Array.isArray(body.categories) || !body.categories.length || body.categories.some(c => !categories.includes(c))) fail('Selecciona categorías válidas.');
    if (body.type === 'kitchen' && typeof body.refrigeration !== 'boolean') fail('Indica si cuenta con refrigeración.');
    Object.assign(org, {
      categories: [...new Set(body.categories)], refrigeration: body.refrigeration === true,
      hotHolding: body.type === 'kitchen' && body.hotHolding === true,
      capacityKg: number(body.capacityKg, 'Capacidad por recojo (kg)', 0.1, 10000),
      maxDistanceKm: number(body.maxDistanceKm, 'Radio de recojo (km)', 0.1, 100)
    });
    if (body.type === 'recycler') {
      if (!Array.isArray(body.recoveryMethods) || !body.recoveryMethods.length || body.recoveryMethods.some(m => !recoveryMethods.includes(m))) fail('Elige un método de aprovechamiento válido.');
      org.recoveryMethods = [...new Set(body.recoveryMethods)];
    }
  }
  return org;
}
export function lotInput(body, now = Date.now()) {
  if (!categories.includes(body.category)) fail('Categoría inválida.');
  if (typeof body.refrigerated !== 'boolean') fail('Indica si requiere refrigeración.');
  if (body.route !== 'organic' && body.category === 'Lácteos' && !body.refrigerated) fail('En este prototipo los lácteos requieren refrigeración.');
  const pickupBy = new Date(body.pickupBy);
  if (typeof body.pickupBy !== 'string' || !Number.isFinite(+pickupBy) || +pickupBy <= now || +pickupBy > now + 30 * 86400000) fail('El plazo debe ser futuro y estar dentro de los próximos 30 días.');
  const route = body.route || 'donation';
  if (!['donation', 'organic'].includes(route)) fail('Ruta de destino inválida.');
  const extra = { route, modelVersion: 2 };
  if (route === 'donation') {
    if (body.foodSafetyConfirmed !== true) fail('El responsable debe confirmar aptitud para donar y conservación adecuada.');
    extra.foodSafetyConfirmed = true;
    extra.allergens = text(body.allergens, 'Ingredientes y alérgenos', 2, 500);
    if (body.category === 'Comida preparada') {
      const preparedAt = new Date(body.preparedAt);
      if (typeof body.preparedAt !== 'string' || !Number.isFinite(+preparedAt) || +preparedAt > now || +preparedAt >= +pickupBy || +preparedAt < now - 7 * 86400000) fail('Indica una hora de preparación válida dentro de los últimos 7 días. Esto no determina su vida útil.');
      if (!['cold', 'hot'].includes(body.preservation)) fail('Para comida preparada indica conservación en frío o en caliente.');
      if (+pickupBy - now > 24 * 3600000) fail('Para comida preparada coordina el recojo dentro de las próximas 24 horas. Ese límite es logístico, no sanitario.');
      Object.assign(extra, { preparedAt: preparedAt.toISOString(), preservation: body.preservation,
        portions: number(body.portions, 'Porciones declaradas', 1, 100000) });
      if (!Number.isInteger(extra.portions)) fail('Las porciones deben ser enteras.');
      if ((body.preservation === 'cold') !== body.refrigerated) fail('La conservación en frío debe coincidir con la refrigeración requerida.');
    }
  } else {
    if (!recoveryMethods.includes(body.recoveryMethod)) fail('Elige compostaje o biodigestión.');
    Object.assign(extra, { recoveryMethod: body.recoveryMethod, foodSafetyConfirmed: false });
  }
  return {
    ...extra,
    title: text(body.title, 'Alimento'), category: body.category,
    kg: Math.round(number(body.kg, 'Peso (kg)', 0.1, 10000) * 100) / 100,
    marketId: text(body.marketId, 'Donante', 1, 80),
    pickupBy: pickupBy.toISOString(), refrigerated: body.refrigerated,
    notes: text(body.notes || 'Sin observaciones adicionales.', 'Observaciones', 2, 500)
  };
}
export function distanceKm(a, b) {
  const rad = v => v * Math.PI / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function effectiveStatus(lot, now = Date.now()) {
  return ['available', 'reserved'].includes(lot.status) && +new Date(lot.pickupBy) <= now ? 'expired' : lot.status;
}
// Heurística explicable; no estima vida útil, inocuidad ni rutas de tránsito.
export function recommendations(lot, organizations, now = Date.now()) {
  if (effectiveStatus(lot, now) !== 'available') return [];
  const market = organizations.find(o => o.id === lot.marketId && o.type === 'market');
  if (!market) return [];
  const hours = (+new Date(lot.pickupBy) - now) / 3600000;
  const route = routeOf(lot);
  if (route === 'donation' && lot.modelVersion >= 2 && lot.foodSafetyConfirmed !== true) return [];
  return organizations.filter(o => o.type === (route === 'organic' ? 'recycler' : 'kitchen')).flatMap(kitchen => {
    const distance = distanceKm(market, kitchen);
    // 15 km/h + 30 min es un supuesto didáctico configurable en código.
    const estimatedMinutes = Math.ceil(distance / 15 * 60 + 30);
    if (!kitchen.categories.includes(lot.category) || kitchen.capacityKg < lot.kg || distance > kitchen.maxDistanceKm || estimatedMinutes >= hours * 60) return [];
    if (route === 'organic' && !kitchen.recoveryMethods?.includes(lot.recoveryMethod)) return [];
    if (route === 'donation' && ((lot.refrigerated && !kitchen.refrigeration) || (lot.preservation === 'hot' && !kitchen.hotHolding))) return [];
    const urgency = Math.max(0, 1 - hours / 24);
    const proximity = Math.max(0, 1 - distance / kitchen.maxDistanceKm);
    const fit = lot.kg / kitchen.capacityKg;
    return [{ kitchenId: kitchen.id, kitchenName: kitchen.name, district: kitchen.district,
      distanceKm: Math.round(distance * 10) / 10, estimatedMinutes,
      score: Math.round(100 * (0.5 * urgency + 0.3 * proximity + 0.2 * fit)),
      reasons: [`${Math.round(hours * 10) / 10} h para recoger`, `${Math.round(distance * 10) / 10} km en línea recta`, `${lot.kg} de ${kitchen.capacityKg} kg por recojo`, route === 'organic' ? 'Gestor compatible con el método declarado' : lot.preservation === 'hot' ? 'Puede mantener la conservación en caliente' : lot.refrigerated ? 'Cuenta con refrigeración' : 'Categoría aceptada']
    }];
  }).sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm || a.kitchenId.localeCompare(b.kitchenId));
}
export function summary(lots, now = Date.now()) {
  const sum = status => Math.round(lots.filter(l => effectiveStatus(l, now) === status).reduce((n, l) => n + l.kg, 0) * 100) / 100;
  const completed = lots.filter(l => ['delivered', 'distributed'].includes(l.status));
  const kgFor = route => Math.round(completed.filter(l => routeOf(l) === route).reduce((a, l) => a + l.kg, 0) * 100) / 100;
  return { availableKg: sum('available'), reservedKg: sum('reserved'), deliveredKg: Math.round((sum('delivered') + sum('distributed')) * 100) / 100,
    donatedKg: kgFor('donation'), recoveredKg: kgFor('organic'),
    familiesReached: completed.reduce((a, l) => a + (l.distribution?.families || 0), 0),
    portionsDistributed: completed.reduce((a, l) => a + (l.distribution?.portions || 0), 0),
    deliveredCount: completed.length,
    urgentCount: lots.filter(l => effectiveStatus(l, now) === 'available' && +new Date(l.pickupBy) - now < 6 * 3600000).length };
}

export function distributionInput(body, lot) {
  const families = number(body.families, 'Familias atendidas en esta entrega', 1, 100000);
  const portions = number(body.portions, 'Porciones distribuidas', 1, 100000);
  if (!Number.isInteger(families) || !Number.isInteger(portions)) fail('Usa cantidades enteras.');
  if (families > portions) fail('Las familias no pueden superar las porciones distribuidas.');
  if (lot.portions && portions > lot.portions) fail('No puedes distribuir más porciones de las declaradas.');
  return { families, portions };
}

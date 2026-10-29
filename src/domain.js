export const categories = ['Verduras', 'Frutas', 'Panadería', 'Abarrotes', 'Lácteos'];
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
  if (!['market', 'kitchen'].includes(body.type)) fail('Selecciona mercado o comedor.');
  const org = {
    name: text(body.name, 'Nombre'), type: body.type,
    district: text(body.district, 'Distrito'),
    lat: number(body.lat, 'Latitud', -90, 90), lng: number(body.lng, 'Longitud', -180, 180)
  };
  if (body.type === 'kitchen') {
    if (!Array.isArray(body.categories) || !body.categories.length || body.categories.some(c => !categories.includes(c))) fail('Selecciona categorías válidas.');
    if (typeof body.refrigeration !== 'boolean') fail('Indica si cuenta con refrigeración.');
    Object.assign(org, {
      categories: [...new Set(body.categories)], refrigeration: body.refrigeration,
      capacityKg: number(body.capacityKg, 'Capacidad por recojo (kg)', 0.1, 10000),
      maxDistanceKm: number(body.maxDistanceKm, 'Radio de recojo (km)', 0.1, 100)
    });
  }
  return org;
}
export function lotInput(body, now = Date.now()) {
  if (!categories.includes(body.category)) fail('Categoría inválida.');
  if (typeof body.refrigerated !== 'boolean') fail('Indica si requiere refrigeración.');
  if (body.category === 'Lácteos' && !body.refrigerated) fail('En este prototipo los lácteos requieren refrigeración.');
  const pickupBy = new Date(body.pickupBy);
  if (typeof body.pickupBy !== 'string' || !Number.isFinite(+pickupBy) || +pickupBy <= now || +pickupBy > now + 30 * 86400000) fail('El plazo debe ser futuro y estar dentro de los próximos 30 días.');
  return {
    title: text(body.title, 'Alimento'), category: body.category,
    kg: Math.round(number(body.kg, 'Peso (kg)', 0.1, 10000) * 100) / 100,
    marketId: text(body.marketId, 'Mercado', 1, 80),
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
  return organizations.filter(o => o.type === 'kitchen').flatMap(kitchen => {
    const distance = distanceKm(market, kitchen);
    // 15 km/h + 30 min es un supuesto didáctico configurable en código.
    const estimatedMinutes = Math.ceil(distance / 15 * 60 + 30);
    if (!kitchen.categories.includes(lot.category) || kitchen.capacityKg < lot.kg || distance > kitchen.maxDistanceKm || (lot.refrigerated && !kitchen.refrigeration) || estimatedMinutes >= hours * 60) return [];
    const urgency = Math.max(0, 1 - hours / 24);
    const proximity = Math.max(0, 1 - distance / kitchen.maxDistanceKm);
    const fit = lot.kg / kitchen.capacityKg;
    return [{ kitchenId: kitchen.id, kitchenName: kitchen.name, district: kitchen.district,
      distanceKm: Math.round(distance * 10) / 10, estimatedMinutes,
      score: Math.round(100 * (0.5 * urgency + 0.3 * proximity + 0.2 * fit)),
      reasons: [`${Math.round(hours * 10) / 10} h para recoger`, `${Math.round(distance * 10) / 10} km en línea recta`, `${lot.kg} de ${kitchen.capacityKg} kg por recojo`, lot.refrigerated ? 'Cuenta con refrigeración' : 'Categoría aceptada']
    }];
  }).sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm || a.kitchenId.localeCompare(b.kitchenId));
}
export function summary(lots, now = Date.now()) {
  const sum = status => Math.round(lots.filter(l => effectiveStatus(l, now) === status).reduce((n, l) => n + l.kg, 0) * 100) / 100;
  return { availableKg: sum('available'), reservedKg: sum('reserved'), deliveredKg: sum('delivered'),
    deliveredCount: lots.filter(l => l.status === 'delivered').length,
    urgentCount: lots.filter(l => effectiveStatus(l, now) === 'available' && +new Date(l.pickupBy) - now < 6 * 3600000).length };
}

export function sampleData(now = Date.now()) {
  const organizations = [
    { id: 'market-sur', name: 'Mercado Huerta Sur', type: 'market', district: 'Surquillo', lat: -12.111, lng: -77.011 },
    { id: 'market-centro', name: 'Mercado La Cosecha', type: 'market', district: 'La Victoria', lat: -12.073, lng: -77.017 },
    { id: 'kitchen-semilla', name: 'Comedor Semilla', type: 'kitchen', district: 'Surquillo', lat: -12.115, lng: -77.008, capacityKg: 50, maxDistanceKm: 12, refrigeration: true, categories: ['Verduras', 'Frutas', 'Panadería', 'Abarrotes', 'Lácteos'] },
    { id: 'kitchen-manana', name: 'Comedor Buen Mañana', type: 'kitchen', district: 'La Victoria', lat: -12.077, lng: -77.013, capacityKg: 30, maxDistanceKm: 8, refrigeration: false, categories: ['Verduras', 'Frutas', 'Panadería', 'Abarrotes'] },
    { id: 'kitchen-raices', name: 'Comedor Raíces', type: 'kitchen', district: 'San Borja', lat: -12.099, lng: -76.999, capacityKg: 80, maxDistanceKm: 15, refrigeration: true, categories: ['Verduras', 'Frutas', 'Abarrotes', 'Lácteos'] }
  ].map(o => ({ ...o, isSample: true, createdAt: new Date(now).toISOString() }));
  const lot = (id, title, category, kg, marketId, hours, refrigerated = false) => ({ id, title, category, kg, marketId, refrigerated, pickupBy: new Date(now + hours * 3600000).toISOString(), notes: 'Datos ficticios para demostración académica.', status: 'available', isSample: true, createdAt: new Date(now).toISOString(), history: [{ status: 'available', at: new Date(now).toISOString() }] });
  return { organizations, lots: [
    lot('sample-tomates', 'Tomates maduros', 'Verduras', 24, 'market-sur', 3),
    lot('sample-pan', 'Pan del día', 'Panadería', 12, 'market-centro', 5),
    lot('sample-platanos', 'Plátanos de estación', 'Frutas', 18, 'market-sur', 9),
    lot('sample-yogur', 'Yogur envasado', 'Lácteos', 8, 'market-centro', 12, true)
  ] };
}

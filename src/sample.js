export function sampleData(now = Date.now()) {
  const organizations = [
    { id: 'market-sur', name: 'Mercado Huerta Sur', type: 'market', district: 'Surquillo', lat: -12.111, lng: -77.011 },
    { id: 'market-centro', name: 'Mercado La Cosecha', type: 'market', district: 'La Victoria', lat: -12.073, lng: -77.017 },
    { id: 'kitchen-semilla', name: 'Comedor Semilla', type: 'kitchen', district: 'Surquillo', lat: -12.115, lng: -77.008, capacityKg: 50, maxDistanceKm: 12, refrigeration: true, categories: ['Verduras', 'Frutas', 'Panadería', 'Abarrotes', 'Lácteos'] },
    { id: 'kitchen-manana', name: 'Comedor Buen Mañana', type: 'kitchen', district: 'La Victoria', lat: -12.077, lng: -77.013, capacityKg: 30, maxDistanceKm: 8, refrigeration: false, categories: ['Verduras', 'Frutas', 'Panadería', 'Abarrotes'] },
    { id: 'kitchen-raices', name: 'Comedor Raíces', type: 'kitchen', district: 'San Borja', lat: -12.099, lng: -76.999, capacityKg: 80, maxDistanceKm: 15, refrigeration: true, categories: ['Verduras', 'Frutas', 'Abarrotes', 'Lácteos'] }
  ].map(o => ({ ...o, isSample: true, createdAt: new Date(now).toISOString() }));
  const lot = (id, title, category, kg, marketId, hours, refrigerated = false) => ({ id, title, category, kg, marketId, refrigerated, foodSafetyConfirmed: true, allergens: 'Información ficticia para pruebas. Verificar antes de donar.', pickupBy: new Date(now + hours * 3600000).toISOString(), notes: 'Datos ficticios del enfoque anterior.', status: 'available', isSample: true, createdAt: new Date(now).toISOString(), history: [{ status: 'available', at: new Date(now).toISOString() }] });
  return { organizations, lots: [
    lot('sample-tomates', 'Tomates maduros', 'Verduras', 24, 'market-sur', 3),
    lot('sample-pan', 'Pan del día', 'Panadería', 12, 'market-centro', 5),
    lot('sample-platanos', 'Plátanos de estación', 'Frutas', 18, 'market-sur', 9),
    lot('sample-yogur', 'Yogur envasado', 'Lácteos', 8, 'market-centro', 12, true)
  ] };
}

export function preparedFoodData(now = Date.now()) {
  const at = new Date(now).toISOString();
  const accepted = ['Comida preparada', 'Panadería', 'Verduras', 'Frutas', 'Abarrotes', 'Lácteos'];
  const organizations = [
    { id: 'food-donor-mesa', name: 'Restaurante La Buena Mesa', type: 'market', donorKind: 'restaurant', district: 'Surquillo', lat: -12.111, lng: -77.011 },
    { id: 'food-donor-evento', name: 'Eventos Encuentro', type: 'market', donorKind: 'event', district: 'La Victoria', lat: -12.073, lng: -77.017 },
    { id: 'food-social-red', name: 'Red Solidaria de Alimentos', type: 'kitchen', district: 'Surquillo', lat: -12.115, lng: -77.008, capacityKg: 60, maxDistanceKm: 15, refrigeration: true, hotHolding: true, categories: accepted },
    { id: 'food-organic-ciclo', name: 'Gestor BioCiclo', type: 'recycler', district: 'La Victoria', lat: -12.077, lng: -77.013, capacityKg: 200, maxDistanceKm: 20, refrigeration: false, hotHolding: false, categories: accepted, recoveryMethods: ['compost', 'biodigestion'] }
  ].map(o => ({ ...o, isSample: true, modelVersion: 2, createdAt: at }));
  const make = (id, title, kg, marketId, route, fields) => ({ id, title, category: 'Comida preparada', kg, marketId, route, modelVersion: 2,
    pickupBy: new Date(now + 3 * 3600000).toISOString(), status: 'available', isSample: true, createdAt: at,
    notes: 'Demostración ficticia. La aptitud y las condiciones requieren revisión del responsable y del receptor.',
    history: [{ status: 'available', at }], refrigerated: route === 'donation', foodSafetyConfirmed: route === 'donation', ...fields });
  return { organizations, lots: [
    make('food-sample-arroz', 'Arroz con pollo excedente', 12, 'food-donor-mesa', 'donation', { portions: 40, preparedAt: new Date(now - 3600000).toISOString(), preservation: 'cold', allergens: 'Revisar receta e ingredientes. Información ficticia.' }),
    make('food-sample-lentejas', 'Guiso de lentejas del evento', 15, 'food-donor-evento', 'donation', { portions: 50, preparedAt: new Date(now - 2 * 3600000).toISOString(), preservation: 'hot', refrigerated: false, allergens: 'Contiene ingredientes declarados por el organizador. Ejemplo ficticio.' }),
    make('food-sample-compost', 'Restos orgánicos separados de cocina', 18, 'food-donor-mesa', 'organic', { recoveryMethod: 'compost' }),
    make('food-sample-biogas', 'Residuos de comida para biodigestión', 8, 'food-donor-evento', 'organic', { recoveryMethod: 'biodigestion' })
  ] };
}

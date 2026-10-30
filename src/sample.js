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
    { id: 'food-organic-ciclo', name: 'Gestor BioCiclo', type: 'recycler', district: 'La Victoria', lat: -12.077, lng: -77.013, capacityKg: 200, maxDistanceKm: 20, refrigeration: false, hotHolding: false, categories: accepted, recoveryMethods: ['compost', 'biodigestion'] },
    { id: 'food-donor-jardin', name: 'Cafetería Jardín', type: 'market', donorKind: 'cafeteria', district: 'Miraflores', lat: -12.121, lng: -77.028 },
    { id: 'food-donor-horno', name: 'Panadería Horno Compartido', type: 'market', donorKind: 'bakery', district: 'Barranco', lat: -12.146, lng: -77.021 },
    { id: 'food-social-puente', name: 'Comedor Puente Solidario', type: 'kitchen', district: 'Santiago de Surco', lat: -12.135, lng: -76.999, capacityKg: 40, maxDistanceKm: 12, refrigeration: true, hotHolding: false, categories: accepted },
    { id: 'food-social-manos', name: 'Asociación Manos Cercanas', type: 'kitchen', district: 'La Victoria', lat: -12.081, lng: -77.019, capacityKg: 80, maxDistanceKm: 18, refrigeration: true, hotHolding: true, categories: accepted },
    { id: 'food-organic-tierra', name: 'Gestor Tierra Viva', type: 'recycler', district: 'Santiago de Surco', lat: -12.139, lng: -76.995, capacityKg: 150, maxDistanceKm: 15, refrigeration: false, hotHolding: false, categories: accepted, recoveryMethods: ['compost'] },
    { id: 'food-organic-energia', name: 'Gestor Energía Circular', type: 'recycler', district: 'Ate', lat: -12.058, lng: -76.951, capacityKg: 250, maxDistanceKm: 25, refrigeration: false, hotHolding: false, categories: accepted, recoveryMethods: ['biodigestion'] }
  ].map(o => ({ ...o, isSample: true, modelVersion: 2, createdAt: at }));
  const make = (id, title, kg, marketId, route, fields) => ({ id, title, category: 'Comida preparada', kg, marketId, route, modelVersion: 2,
    pickupBy: new Date(now + 3 * 3600000).toISOString(), status: 'available', isSample: true, createdAt: at,
    notes: 'Demostración ficticia. La aptitud y las condiciones requieren revisión del responsable y del receptor.',
    history: [{ status: 'available', at }], refrigerated: route === 'donation', foodSafetyConfirmed: route === 'donation', ...fields });
  return { organizations, lots: [
    make('food-sample-arroz', 'Arroz con pollo excedente', 12, 'food-donor-mesa', 'donation', { portions: 40, preparedAt: new Date(now - 3600000).toISOString(), preservation: 'cold', allergens: 'Revisar receta e ingredientes. Información ficticia.' }),
    make('food-sample-lentejas', 'Guiso de lentejas del evento', 15, 'food-donor-evento', 'donation', { portions: 50, preparedAt: new Date(now - 2 * 3600000).toISOString(), preservation: 'hot', refrigerated: false, allergens: 'Contiene ingredientes declarados por el organizador. Ejemplo ficticio.' }),
    make('food-sample-compost', 'Restos orgánicos separados de cocina', 18, 'food-donor-mesa', 'organic', { recoveryMethod: 'compost' }),
    make('food-sample-biogas', 'Residuos de comida para biodigestión', 8, 'food-donor-evento', 'organic', { recoveryMethod: 'biodigestion' }),
    make('food-demo-tallarines', 'Tallarines con verduras del almuerzo', 9, 'food-donor-jardin', 'donation', { portions: 30, preparedAt: new Date(now - 3600000).toISOString(), preservation: 'cold', allergens: 'Ejemplo: trigo y huevo. Revisar receta y contaminación cruzada.', pickupBy: new Date(now + 4 * 3600000).toISOString() }),
    make('food-demo-menestra', 'Menestra con arroz del comedor', 8, 'food-donor-mesa', 'donation', { portions: 32, preparedAt: new Date(now - 3600000).toISOString(), preservation: 'hot', refrigerated: false, allergens: 'Ejemplo: receta con legumbres. Confirmar ingredientes antes de aceptar.', pickupBy: new Date(now + 5 * 3600000).toISOString() }),
    make('food-demo-sopa', 'Sopa de verduras del evento', 6, 'food-donor-evento', 'donation', { portions: 24, preparedAt: new Date(now - 1800000).toISOString(), preservation: 'hot', refrigerated: false, allergens: 'Ejemplo: puede contener apio y trigo. Verificar receta.', pickupBy: new Date(now + 2 * 3600000).toISOString() }),
    make('food-demo-pan', 'Panes integrales del día', 10, 'food-donor-horno', 'donation', { category: 'Panadería', refrigerated: false, allergens: 'Ejemplo: trigo, gluten y sésamo; posible contacto con leche y huevo.', pickupBy: new Date(now + 8 * 3600000).toISOString() }),
    make('food-demo-arroz-verduras', 'Arroz con verduras del servicio', 14, 'food-donor-evento', 'donation', { portions: 42, preparedAt: new Date(now - 3600000).toISOString(), preservation: 'cold', allergens: 'Ejemplo: revisar receta, condimentos e ingredientes compuestos.', pickupBy: new Date(now + 6 * 3600000).toISOString() }),
    make('food-demo-verduras', 'Verduras cocidas de la cafetería', 7, 'food-donor-jardin', 'donation', { portions: 28, preparedAt: new Date(now - 1800000).toISOString(), preservation: 'cold', allergens: 'Ejemplo: puede contener leche en la preparación. Confirmar receta.', pickupBy: new Date(now + 4 * 3600000).toISOString() }),
    make('food-demo-cascaras', 'Cáscaras y recortes vegetales separados', 20, 'food-donor-jardin', 'organic', { category: 'Verduras', recoveryMethod: 'compost', pickupBy: new Date(now + 10 * 3600000).toISOString() }),
    make('food-demo-biodigestor', 'Restos orgánicos del servicio de evento', 16, 'food-donor-evento', 'organic', { recoveryMethod: 'biodigestion', pickupBy: new Date(now + 12 * 3600000).toISOString() })
  ] };
}

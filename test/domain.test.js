import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendations, summary, effectiveStatus, lotInput, organizationInput, distanceKm } from '../src/domain.js';
import { sampleData, preparedFoodData } from '../src/sample.js';

const now = Date.parse('2026-10-29T15:00:00Z');
test('la recomendación excluye comedores incompatibles y explica el puntaje', () => {
  const { organizations, lots } = sampleData(now);
  const dairy = lots.find(l => l.category === 'Lácteos');
  const candidates = recommendations(dairy, organizations, now);
  assert.ok(candidates.length > 0);
  assert.ok(candidates.every(c => organizations.find(o => o.id === c.kitchenId).refrigeration));
  assert.ok(candidates.every(c => c.score >= 0 && c.score <= 100 && c.reasons.length === 4));
  const tiny = organizations.map(o => o.type === 'kitchen' ? { ...o, capacityKg: 1 } : o);
  assert.deepEqual(recommendations(dairy, tiny, now), []);
  assert.deepEqual(recommendations(dairy, organizations.map(o => ({ ...o, categories: [] })), now), []);
  assert.deepEqual(recommendations(dairy, organizations.map(o => o.type === 'kitchen' ? { ...o, maxDistanceKm: 0.001 } : o), now), []);
});
test('lotes vencidos o sin margen de traslado no se recomiendan', () => {
  const { organizations, lots } = sampleData(now);
  const lot = lots[0];
  assert.equal(effectiveStatus(lot, now + 4 * 3600000), 'expired');
  assert.deepEqual(recommendations(lot, organizations, now + 4 * 3600000), []);
  assert.deepEqual(recommendations({ ...lot, pickupBy: new Date(now + 5 * 60000).toISOString() }, organizations, now), []);
  assert.deepEqual(recommendations({ ...lot, status: 'reserved' }, organizations, now), []);
});
test('el impacto solo cuenta entregas y conserva los decimales', () => {
  const { lots } = sampleData(now);
  lots[0].status = 'delivered'; lots[1].status = 'reserved';
  assert.deepEqual(summary(lots, now), { availableKg: 26, reservedKg: 12, deliveredKg: 24, donatedKg: 24, recoveredKg: 0, familiesReached: 0, portionsDistributed: 0, deliveredCount: 1, urgentCount: 0 });
  assert.equal(summary(lots, now + 48 * 3600000).deliveredKg, 24);
  assert.equal(summary(lots, now + 48 * 3600000).reservedKg, 0);
});

test('separa consumo humano y orgánicos, conservación y declaraciones obligatorias', () => {
  const { lots, organizations } = preparedFoodData(now);
  const cold = lots.find(l=>l.route==='donation' && l.preservation==='cold');
  const hot = lots.find(l=>l.route==='donation' && l.preservation==='hot');
  const organic = lots.find(l=>l.route==='organic');
  assert.equal(lotInput(cold,now).portions, 40);
  assert.throws(()=>lotInput({...cold,foodSafetyConfirmed:false},now));
  assert.throws(()=>lotInput({...cold,preparedAt:new Date(now+1000).toISOString()},now));
  assert.throws(()=>lotInput({...cold,refrigerated:false},now));
  assert.deepEqual(recommendations({...cold,foodSafetyConfirmed:false},organizations,now),[]);
  assert.deepEqual(recommendations(hot,organizations.map(o=>({...o,hotHolding:false})),now),[]);
  assert.ok(recommendations(organic,organizations,now).every(c=>organizations.find(o=>o.id===c.kitchenId).type==='recycler'));
  assert.deepEqual(recommendations(organic,organizations.map(o=>({...o,recoveryMethods:[]})),now),[]);
  cold.status='distributed';cold.distribution={portions:40,families:10};organic.status='delivered';
  const metrics=summary(lots,now);
  assert.equal(metrics.donatedKg,cold.kg);assert.equal(metrics.recoveredKg,organic.kg);
  assert.equal(metrics.familiesReached,10);assert.equal(metrics.portionsDistributed,40);
});
test('valida entradas y evita operadores MongoDB o condiciones inconsistentes', () => {
  const { lots, organizations } = sampleData(now);
  assert.throws(() => lotInput({ ...lots[0], marketId: { $ne: null } }, now));
  assert.throws(() => lotInput({ ...lots[0], kg: -1 }, now));
  assert.throws(() => lotInput({ ...lots[0], kg: NaN }, now));
  assert.throws(() => lotInput({ ...lots[0], pickupBy: 'ayer' }, now));
  assert.throws(() => lotInput({ ...lots[0], category: 'Lácteos', refrigerated: false }, now));
  assert.throws(() => organizationInput({ ...organizations[2], lat: 100 }));
  assert.throws(() => organizationInput({ ...organizations[2], refrigeration: 'sí' }));
  assert.equal(lotInput({ ...lots[0], status: 'delivered' }, now).status, undefined);
  assert.equal(distanceKm(organizations[0], organizations[0]), 0);
});

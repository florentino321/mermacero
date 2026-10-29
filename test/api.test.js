import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { connectStore } from '../src/store.js';

test('flujo HTTP: acceso, CRUD, reserva exclusiva, recepción y métricas', async t => {
  const store = await connectStore({ DEMO_MODE: 'true' });
  const server = createApp(store, 'clave-para-test-123').listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let token = '';
  async function req(path, method = 'GET', body) {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, body: await res.json() };
  }
  assert.equal((await req('/health')).body.storage, 'demo');
  assert.equal((await req('/lots', 'POST', {})).status, 401);
  assert.equal((await req('/login', 'POST', { password: 'incorrecta' })).status, 401);
  token = (await req('/login', 'POST', { password: 'clave-para-test-123' })).body.token;
  assert.ok(token);
  const organization = await req('/organizations', 'POST', { name: 'Mercado de prueba', district: 'Surquillo', type: 'market', lat: -12.111, lng: -77.011 });
  assert.equal(organization.status, 201);
  assert.equal((await req('/lots', 'POST', { title: 'Prueba', category: 'Verduras', kg: 5, marketId: { $ne: null }, pickupBy: new Date(Date.now() + 3600000).toISOString(), refrigerated: false })).status, 400);
  const fields = { title: '<script>Prueba</script>', category: 'Verduras', kg: 5.5, marketId: organization.body.id, pickupBy: new Date(Date.now() + 4 * 3600000).toISOString(), refrigerated: false };
  const created = await req('/lots', 'POST', fields);
  assert.equal(created.status, 201);
  const id = created.body.id;
  assert.equal((await req(`/lots/${id}`, 'PUT', { ...fields, kg: 6.25 })).status, 200);
  let all = (await req('/data')).body;
  const candidate = all.lots.find(l => l.id === id).recommendations[0]; assert.ok(candidate);
  const attempts = await Promise.all([req(`/lots/${id}/reserve`, 'POST', { kitchenId: candidate.kitchenId }), req(`/lots/${id}/reserve`, 'POST', { kitchenId: candidate.kitchenId })]);
  assert.deepEqual(attempts.map(r => r.status).sort(), [200, 409]);
  assert.equal((await req(`/lots/${id}`, 'DELETE')).status, 409);
  assert.equal((await req(`/lots/${id}`, 'PUT', fields)).status, 409);
  assert.equal((await req(`/lots/${id}/deliver`, 'POST', {})).status, 400);
  assert.equal((await req(`/lots/${id}/release`, 'POST', {})).status, 200);
  assert.equal((await req(`/lots/${id}/reserve`, 'POST', { kitchenId: candidate.kitchenId })).status, 200);
  assert.equal((await req(`/lots/${id}/deliver`, 'POST', { receiptConfirmed: true })).status, 200);
  assert.equal((await req(`/lots/${id}/deliver`, 'POST', { receiptConfirmed: true })).status, 409);
  all = (await req('/data')).body;
  assert.equal(all.summary.deliveredKg, 6.25);
  assert.equal(all.lots.find(l => l.id === id).history.filter(h => h.status === 'delivered').length, 1);
  const disposable = (await req('/lots', 'POST', fields)).body.id;
  assert.equal((await req(`/lots/${disposable}`, 'DELETE')).status, 200);
  assert.equal((await req('/logout', 'POST', {})).status, 200);
  assert.equal((await req('/organizations', 'POST', {})).status, 401);
});
test('producción exige MongoDB real y contraseña válida', async () => {
  await assert.rejects(connectStore({ DEMO_MODE: 'true', NODE_ENV: 'production' }), /producción/);
  await assert.rejects(connectStore({}), /MONGODB_URI/);
  assert.throws(() => createApp({}, 'corta'), /ADMIN_PASSWORD/);
});

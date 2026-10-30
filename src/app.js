import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomUUID, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { AppError, categories, organizationInput, lotInput, recommendations, effectiveStatus, summary, routeOf, distributionInput, recoveryMethods } from './domain.js';

export function createApp(store, password) {
  if (!password || password.length < 12) throw new Error('ADMIN_PASSWORD debe tener al menos 12 caracteres.');
  const app = express();
  const sessions = new Map();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: { directives: {
    'upgrade-insecure-requests': null,
    'style-src': ["'self'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'https://fonts.gstatic.com'],
    'script-src': ["'self'"], 'img-src': ["'self'", 'data:']
  } } }));
  app.use(express.json({ limit: '20kb' }));
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api', rateLimit({ windowMs: 60000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Demasiadas solicitudes. Reintenta en un minuto.' } }));
  const requireAdmin = (req, _res, next) => {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (!sessions.has(token) || sessions.get(token) <= Date.now()) { sessions.delete(token); return next(new AppError('Ingresa como coordinador para realizar cambios.', 401)); }
    next();
  };
  const findLot = async id => { const lot = await store.get('lots', id); if (!lot) throw new AppError('Lote no encontrado.', 404); return lot; };
  app.get('/api/health', async (_req, res) => {
    try { await store.ping(); res.json({ ok: true, storage: store.mode }); }
    catch { res.status(503).json({ ok: false, storage: store.mode }); }
  });
  app.post('/api/login', rateLimit({ windowMs: 15 * 60000, limit: 10, message: { error: 'Demasiados intentos. Espera 15 minutos.' } }), (req, res) => {
    const hash = v => createHash('sha256').update(v).digest();
    if (typeof req.body?.password !== 'string' || !timingSafeEqual(hash(req.body.password), hash(password))) throw new AppError('Clave incorrecta.', 401);
    for (const [token, expiry] of sessions) if (expiry <= Date.now()) sessions.delete(token);
    const token = randomBytes(32).toString('hex'); sessions.set(token, Date.now() + 8 * 3600000);
    res.json({ token });
  });
  app.post('/api/logout', requireAdmin, (req, res) => { sessions.delete(req.headers.authorization.slice(7)); res.json({ ok: true }); });
  app.get('/api/data', async (_req, res) => {
    const [organizations, lots] = await Promise.all([store.list('organizations'), store.list('lots')]);
    const now = Date.now();
    res.json({ storage: store.mode, focus: 'prepared-food', categories, recoveryMethods, organizations, lots: lots.map(l => ({ ...l, route: routeOf(l), effectiveStatus: effectiveStatus(l, now), recommendations: recommendations(l, organizations, now) })), summary: summary(lots, now), updatedAt: new Date(now).toISOString() });
  });
  app.post('/api/organizations', requireAdmin, async (req, res) => {
    const org = { ...organizationInput(req.body || {}), id: randomUUID(), createdAt: new Date().toISOString(), isSample: false };
    res.status(201).json(await store.insert('organizations', org));
  });
  async function validatedLot(body) {
    const fields = lotInput(body || {});
    const market = await store.get('organizations', fields.marketId);
    if (!market || market.type !== 'market') throw new AppError('Elige un donante registrado.');
    return fields;
  }
  app.post('/api/lots', requireAdmin, async (req, res) => {
    const fields = await validatedLot(req.body);
    const at = new Date().toISOString();
    res.status(201).json(await store.insert('lots', { ...fields, id: randomUUID(), status: 'available', createdAt: at, isSample: false, history: [{ status: 'available', at }] }));
  });
  app.put('/api/lots/:id', requireAdmin, async (req, res) => {
    const original = await findLot(req.params.id);
    if (routeOf(original) === 'organic' && req.body?.route !== 'organic') throw new AppError('Un lote destinado a residuos orgánicos no puede volver a donación para consumo humano.');
    const fields = await validatedLot(req.body);
    const changed = await store.update(req.params.id, 'available', fields, { action: 'edited', at: new Date().toISOString() });
    if (!changed) throw new AppError('Solo puedes editar lotes disponibles. Actualiza la página.', 409);
    res.json(changed);
  });
  app.delete('/api/lots/:id', requireAdmin, async (req, res) => {
    if (!await store.remove(req.params.id)) throw new AppError('Solo puedes eliminar lotes sin reserva.', 409);
    res.json({ ok: true });
  });
  app.post('/api/lots/:id/reserve', requireAdmin, async (req, res) => {
    const lot = await findLot(req.params.id);
    const orgs = await store.list('organizations');
    const candidate = recommendations(lot, orgs).find(c => c.kitchenId === req.body?.kitchenId);
    if (!candidate) throw new AppError('El comedor no cumple las condiciones o el plazo ya venció.', 409);
    const at = new Date().toISOString();
    const updated = await store.update(lot.id, 'available', { status: 'reserved', kitchenId: candidate.kitchenId, reservation: candidate }, { status: 'reserved', at, kitchenId: candidate.kitchenId }, at);
    if (!updated) throw new AppError('Otra operación reservó el lote o el plazo venció. Actualiza la página.', 409);
    res.json(updated);
  });
  app.post('/api/lots/:id/release', requireAdmin, async (req, res) => {
    const at = new Date().toISOString();
    const lot = await store.update(req.params.id, 'reserved', { status: 'available', kitchenId: null, reservation: null }, { status: 'available', action: 'released', at });
    if (!lot) throw new AppError('El lote ya no está reservado.', 409);
    res.json(lot);
  });
  app.post('/api/lots/:id/deliver', requireAdmin, async (req, res) => {
    const original = await findLot(req.params.id);
    if (req.body?.receiptConfirmed !== true) throw new AppError('Confirma que la organización recibió el lote.');
    if (routeOf(original) === 'donation' && original.modelVersion >= 2 && req.body?.inspectionConfirmed !== true) throw new AppError('La organización receptora debe confirmar la revisión de conservación e información del alimento.');
    const at = new Date().toISOString();
    const lot = await store.update(req.params.id, 'reserved', { status: 'delivered', deliveredAt: at, inspectionConfirmed: req.body.inspectionConfirmed === true }, { status: 'delivered', at }, at);
    if (!lot) throw new AppError('El lote no está reservado o venció el plazo. No se registró la entrega.', 409);
    res.json(lot);
  });
  app.post('/api/lots/:id/distribute', requireAdmin, async (req, res) => {
    const original = await findLot(req.params.id);
    if (routeOf(original) !== 'donation') throw new AppError('Los residuos orgánicos no se distribuyen para consumo humano.');
    if (original.status !== 'delivered') throw new AppError('Primero confirma la recepción. La distribución solo se registra una vez.', 409);
    const distribution = { ...distributionInput(req.body || {}, original), at: new Date().toISOString() };
    const lot = await store.update(original.id, 'delivered', { status: 'distributed', distribution }, { status: 'distributed', at: distribution.at });
    if (!lot) throw new AppError('La distribución ya fue registrada. Actualiza la página.', 409);
    res.json(lot);
  });
  app.post('/api/lots/:id/divert', requireAdmin, async (req, res) => {
    const original = await findLot(req.params.id);
    if (routeOf(original) !== 'donation' || original.status !== 'available') throw new AppError('Libera primero la reserva. Solo puedes derivar un lote de donación sin entregar.', 409);
    if (!recoveryMethods.includes(req.body?.recoveryMethod)) throw new AppError('Elige compostaje o biodigestión.');
    const fields = lotInput({ ...original, ...req.body, title: original.title, category: original.category, marketId: original.marketId, kg: original.kg, route: 'organic' });
    const at = new Date().toISOString();
    const lot = await store.update(original.id, 'available', { ...fields, donationPickupBy: original.pickupBy, preservation: null, portions: null, allergens: null }, { action: 'diverted', status: 'available', recoveryMethod: fields.recoveryMethod, at });
    if (!lot) throw new AppError('El lote cambió de estado. Actualiza la página.', 409);
    res.json(lot);
  });
  app.post('/api/seed', requireAdmin, async (_req, res) => res.json({ inserted: await store.seed() }));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
  app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));
  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    if (status >= 500) console.error('Error interno de solicitud:', err.name, err.code || '');
    res.status(status).json({ error: status >= 500 ? 'No se pudo completar la operación. Reintenta.' : err.message });
  });
  return app;
}

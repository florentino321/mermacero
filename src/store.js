import { MongoClient } from 'mongodb';
import { sampleData } from './sample.js';

export async function connectStore(env = process.env) {
  if (env.DEMO_MODE === 'true') {
    if (env.NODE_ENV === 'production') throw new Error('DEMO_MODE no está permitido en producción. Configura MongoDB.');
    const data = sampleData();
    return {
      mode: 'demo', list: async name => structuredClone(data[name]),
      get: async (name, id) => structuredClone(data[name].find(o => o.id === id)),
      insert: async (name, doc) => { data[name].push(structuredClone(doc)); return doc; },
      update: async (id, status, patch, event, after) => {
        const lot = data.lots.find(l => l.id === id && l.status === status && (!after || l.pickupBy > after));
        if (!lot) return null;
        Object.assign(lot, structuredClone(patch)); if (event) lot.history.push(event);
        return structuredClone(lot);
      },
      remove: async id => { const i = data.lots.findIndex(l => l.id === id && l.status === 'available'); if (i < 0) return false; data.lots.splice(i, 1); return true; },
      seed: async () => 0, ping: async () => true, close: async () => {}
    };
  }
  if (!env.MONGODB_URI) throw new Error('Falta MONGODB_URI. Para una prueba local sin MongoDB ejecuta npm run demo.');
  const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const db = client.db(env.MONGODB_DB || 'mermacero');
    await Promise.all(['organizations', 'lots'].map(name => db.collection(name).createIndex({ id: 1 }, { unique: true })));
    await db.collection('lots').createIndex({ status: 1, pickupBy: 1 });
    return {
      mode: 'mongodb',
      list: name => db.collection(name).find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray(),
      get: (name, id) => db.collection(name).findOne({ id }, { projection: { _id: 0 } }),
      insert: async (name, doc) => { await db.collection(name).insertOne({ ...doc }); return doc; },
      update: (id, status, patch, event, after) => db.collection('lots').findOneAndUpdate(
        { id, status, ...(after ? { pickupBy: { $gt: after } } : {}) },
        { $set: patch, ...(event ? { $push: { history: event } } : {}) },
        { returnDocument: 'after', projection: { _id: 0 } }
      ),
      remove: async id => (await db.collection('lots').deleteOne({ id, status: 'available' })).deletedCount === 1,
      seed: async () => {
        const sample = sampleData(); let added = 0;
        for (const name of ['organizations', 'lots']) for (const doc of sample[name]) {
          const result = await db.collection(name).updateOne({ id: doc.id }, { $setOnInsert: doc }, { upsert: true }); added += result.upsertedCount;
        }
        return added;
      },
      ping: async () => { await db.command({ ping: 1 }); return true; }, close: () => client.close()
    };
  } catch (error) { await client.close(); throw error; }
}

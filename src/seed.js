import 'dotenv/config';
import { connectStore } from './store.js';
if (process.env.SEED_DEMO_DATA !== 'true') throw new Error('Para insertar datos ficticios, configura SEED_DEMO_DATA=true. No se borran ni sobrescriben registros.');
const store = await connectStore();
try { console.log(`Insertados ${await store.seed()} registros ficticios nuevos.`); }
finally { await store.close(); }

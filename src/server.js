import 'dotenv/config';
import { connectStore } from './store.js';
import { createApp } from './app.js';
try {
  const store = await connectStore();
  const app = createApp(store, process.env.ADMIN_PASSWORD);
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, '0.0.0.0', () => console.log(`MermaCero: http://localhost:${port} | almacenamiento: ${store.mode}`));
  let stopping = false;
  const stop = () => {
    if (stopping) return; stopping = true;
    server.close(async () => { await store.close(); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
} catch (error) {
  console.error('No se pudo iniciar MermaCero:', /MONGODB_URI|ADMIN_PASSWORD|DEMO_MODE/.test(error.message) ? error.message : 'Comprueba la conexión, usuario y lista de acceso de MongoDB.');
  process.exitCode = 1;
}

// Acepta URI completo o una plantilla y contraseña separada sin codificar.
export function mongoUri(env) {
  const uri = env.MONGODB_URI;
  if (!uri) throw new Error('Falta MONGODB_URI. Para una prueba local sin MongoDB ejecuta npm run demo.');
  if (!uri.includes('<db_password>')) return uri;
  if (!env.MONGODB_PASSWORD) throw new Error('Falta MONGODB_PASSWORD para completar MONGODB_URI.');
  return uri.replaceAll('<db_password>', encodeURIComponent(env.MONGODB_PASSWORD));
}

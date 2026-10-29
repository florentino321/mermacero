import test from 'node:test';
import assert from 'node:assert/strict';
import { mongoUri } from '../src/config.js';

test('contraseña separada conserva caracteres especiales y falla si falta el secreto', () => {
  const uri = 'mongodb+srv://example:<db_password>@example.mongodb.net/?retryWrites=true';
  const password = 'prueba:@/#?% $ñ';
  const resolved = new URL(mongoUri({ MONGODB_URI: uri, MONGODB_PASSWORD: password }));
  assert.equal(decodeURIComponent(resolved.password), password);
  assert.equal(resolved.hostname, 'example.mongodb.net');
  assert.equal(resolved.searchParams.get('retryWrites'), 'true');
  assert.throws(() => mongoUri({ MONGODB_URI: uri }), /Falta MONGODB_PASSWORD/);
  const full = 'mongodb://example:already%40encoded@localhost';
  assert.equal(mongoUri({ MONGODB_URI: full }), full);
});

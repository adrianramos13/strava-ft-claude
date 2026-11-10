// Puente del asistente: solo deja pasar peticiones del asistente de Entreno, y la clave nunca sale del Worker.
const test = require('node:test');
const assert = require('node:assert');

const cargar = () => import('../worker/asistente.mjs');
const NOMBRES = ['rehacer_semana', 'rehacer_plan_completo', 'editar_sesion', 'ver_semana', 'guardar_preferencia', 'borrar_preferencia', 'deshacer'];
const cuerpo = (cambios = {}) => ({
  messages: [{role: 'system', content: 'Eres el asistente de Entreno, una app…'}, {role: 'user', content: 'hola'}],
  tools: NOMBRES.map((name) => ({type: 'function', function: {name, parameters: {type: 'object'}}})), ...cambios});
const ENV = {GEMINI_API_KEY: 'clave-secreta', ORIGENES: 'https://adrianramos13.github.io', MODELO: 'gemini-x'};
const pedir = (body, origen = 'https://adrianramos13.github.io') => new Request('https://x.workers.dev/',
  {method: 'POST', headers: {Origin: origen, 'content-type': 'application/json'}, body: JSON.stringify(body)});

test('validar: acepta al asistente y rechaza otros usos', async () => {
  const {validar} = await cargar();
  assert.strictEqual(validar(cuerpo()), null);
  assert.ok(validar(cuerpo({messages: [{role: 'system', content: 'Eres un pirata'}, {role: 'user', content: 'hola'}]})));
  assert.ok(validar(cuerpo({messages: [{role: 'user', content: 'hola'}]})));
  assert.ok(validar(cuerpo({tools: []})));
  assert.ok(validar(cuerpo({tools: [...cuerpo().tools.slice(1), {type: 'google_search', function: {name: 'rehacer_semana'}}]})));
});

test('reenvía a Gemini con la clave del Worker, su modelo y solo los campos permitidos', async (t) => {
  const worker = (await cargar()).default;
  let enviado;
  t.mock.method(globalThis, 'fetch', async (url, init) => { enviado = {url, init}; return new Response('{"choices":[]}', {status: 200, headers: {'content-type': 'application/json'}}); });
  const r = await worker.fetch(pedir(cuerpo({model: 'gemini-pro-caro', max_tokens: 999999})), ENV);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.headers.get('Access-Control-Allow-Origin'), 'https://adrianramos13.github.io');
  assert.match(enviado.url, /generativelanguage\.googleapis\.com/);
  assert.strictEqual(enviado.init.headers.Authorization, 'Bearer clave-secreta');
  const b = JSON.parse(enviado.init.body);
  assert.strictEqual(b.model, 'gemini-x');
  assert.strictEqual(b.max_tokens, undefined);
});

test('si un modelo está saturado o no contesta a tiempo, prueba con el siguiente de MODELO', async (t) => {
  const worker = (await cargar()).default;
  const usados = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const {model} = JSON.parse(init.body); usados.push(model);
    // el temporizador de AbortSignal.timeout no mantiene vivo a Node: este sí, hasta que se aborta
    if (model === 'lento') return new Promise((res, rej) => { const vivo = setTimeout(() => {}, 5000); init.signal.addEventListener('abort', () => { clearTimeout(vivo); rej(init.signal.reason); }); });
    if (model === 'saturado') return new Response('{"error":{"message":"high demand"}}', {status: 503});
    return new Response('{"choices":[]}', {status: 200});
  });
  const env = {...ENV, MODELO: 'saturado, lento, bueno', ESPERA_MS: '50'};
  const r = await worker.fetch(pedir(cuerpo()), env);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(usados.join(), 'saturado,lento,bueno');
  // si todos fallan, devuelve el último error
  const r2 = await worker.fetch(pedir(cuerpo()), {...env, MODELO: 'saturado'});
  assert.strictEqual(r2.status, 503);
  const r3 = await worker.fetch(pedir(cuerpo()), {...env, MODELO: 'lento'});
  assert.strictEqual(r3.status, 503);
});

test('rechaza otros orígenes, peticiones raras, exceso de mensajes y falta de clave', async (t) => {
  const worker = (await cargar()).default;
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('no debería llamar a Gemini'); });
  assert.strictEqual((await worker.fetch(pedir(cuerpo(), 'https://otra-web.com'), ENV)).status, 403);
  assert.strictEqual((await worker.fetch(pedir(cuerpo({tools: []})), ENV)).status, 400);
  assert.strictEqual((await worker.fetch(pedir(cuerpo()), {...ENV, LIMITE: {limit: async () => ({success: false})}})).status, 429);
  assert.strictEqual((await worker.fetch(pedir(cuerpo()), {ORIGENES: ENV.ORIGENES})).status, 500);
});

test('preflight CORS solo para orígenes permitidos', async () => {
  const worker = (await cargar()).default;
  const pre = (origen) => new Request('https://x.workers.dev/', {method: 'OPTIONS', headers: {Origin: origen, 'Access-Control-Request-Headers': 'content-type'}});
  assert.strictEqual((await worker.fetch(pre('https://adrianramos13.github.io'), ENV)).status, 204);
  assert.strictEqual((await worker.fetch(pre('https://otra-web.com'), ENV)).status, 403);
});

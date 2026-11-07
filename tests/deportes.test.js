// El plan se construye en el deporte de cada persona y con sus tamaños de sesión, no en carrera por defecto.
// Sin objetivos: se mantiene lo que ya hace (mismos deportes, mismo volumen, sin progresión).
const test = require('node:test');
const assert = require('node:assert');
const {AN, PLAN} = require('./cargar')();

const hoy = AN.parse('2026-03-02');
const dia = (n) => AN.iso(AN.addDays(hoy, n));
const TODOS = [0, 1, 2, 3, 4, 5, 6];
const MIN = {0: 90, 1: 90, 2: 90, 3: 90, 4: 90, 5: 180, 6: 180};

// semanas de historial: cada sesión [día de la semana, tipo Strava, minutos, km]
function historial(semanas, sesiones) {
  const acts = [];
  for (let w = semanas; w >= 1; w--) sesiones.forEach(([d, tipo, min, km]) => acts.push({fecha: dia(-7 * w + d), tipo, nombre: tipo, seg_mov: min * 60, metros: km * 1000}));
  return acts;
}
const plan = (acts, objetivos = [], perfil = {}) => PLAN.generarCompleto(AN.analizar(acts, {objetivos, ...perfil}, hoy), {}, dia(7), TODOS, MIN);
const todas = (p) => p.semanas.flatMap((s) => s.sesiones);
const deSport = (s, sp) => s.sesiones.filter((x) => x.sport === sp);

const NADADORA = historial(8, [[0, 'Swim', 50, 2.4], [2, 'Swim', 45, 2], [4, 'Swim', 55, 2.6], [6, 'Swim', 65, 3]]);
const SENIOR = historial(8, [[1, 'WeightTraining', 50, 0], [4, 'WeightTraining', 50, 0], [2, 'Walk', 50, 4.5], [6, 'Walk', 60, 5.5]]);
const CORREDOR = historial(8, [[1, 'Run', 45, 8], [3, 'Run', 40, 7], [6, 'Run', 80, 14]]);
const CICLISTA = historial(8, [[1, 'Ride', 75, 28], [3, 'Ride', 60, 22], [5, 'Ride', 150, 60]]);

test('sin objetivos, la fase es «mantener»', () => {
  assert.ok(plan(NADADORA).semanas.every((s) => s.faseTipo === 'mantener'));
});

test('nadadora sin objetivos: sigue nadando 4 días, sin carrera y con sesiones de su tamaño', () => {
  plan(NADADORA).semanas.forEach((s) => {
    assert.strictEqual(deSport(s, 'run').length, 0, `${s.semana}: ${s.sesiones.map((x) => x.titulo)}`);
    assert.ok(deSport(s, 'swim').length >= 4, `${s.semana}: ${s.sesiones.map((x) => x.titulo)}`);
  });
  // nada 2–3 km por sesión: las sesiones van en metros, en ese rango, con su ritmo por 100 m
  const nado = todas(plan(NADADORA)).filter((x) => x.sport === 'swim');
  nado.forEach((x) => {
    assert.ok(x.metros >= 1800 && x.metros <= 3300, `${x.titulo}: ${x.metros} m`);
    assert.match(x.detalle, /\/100 m/);
  });
});

test('sin objetivos no hay progresión: el volumen de cada semana es el de siempre', () => {
  const mins = plan(NADADORA).semanas.map((s) => deSport(s, 'swim').reduce((t, x) => t + x.min, 0));
  assert.ok(Math.max(...mins) - Math.min(...mins) <= 10, mins.join(', '));
  const km = plan(CORREDOR).semanas.map((s) => s.kmCarrera);
  km.forEach((k) => assert.ok(k >= 29 * 0.85 && k <= 29 * 1.1, km.join(', ')));
});

test('60 años, gimnasio 2 días y caminar 2: ni carrera ni burpees; fuerza con equilibrio y caminatas', () => {
  const p = plan(SENIOR, [], {fecha_nacimiento: '1966-01-01'});
  p.semanas.forEach((s) => {
    assert.strictEqual(deSport(s, 'run').length, 0, `${s.semana}: ${s.sesiones.map((x) => x.titulo)}`);
    assert.ok(deSport(s, 'strength').length >= 2, `${s.semana}: ${s.sesiones.map((x) => x.titulo)}`);
    assert.ok(deSport(s, 'walk').length >= 1, `${s.semana}: ${s.sesiones.map((x) => x.titulo)}`);
  });
  assert.ok(!todas(p).some((x) => /burpee/i.test(x.detalle)));
});

test('objetivo «forma» caminando: la sesión intensa es caminando, no HIIT de burpees, y dura lo que suele', () => {
  const p = plan(historial(8, [[1, 'Walk', 50, 4.5], [3, 'Walk', 50, 4.5], [6, 'Walk', 70, 6]]),
    [{id: 'f', tipo: 'forma', objetivo: 'Ponerme en forma', dias_semana: 4, dia: dia(84)}]);
  assert.ok(!todas(p).some((x) => /burpee/i.test(x.detalle)));
  assert.ok(!todas(p).some((x) => x.sport === 'run'));
  const cardio = todas(p).filter((x) => x.sport === 'walk' && !x.larga);
  assert.ok(cardio.length && cardio.every((x) => x.min >= 45), cardio.map((x) => x.min).join(', '));
});

test('travesía a nado: las sesiones salen de su historial y la larga crece sin pasar un 10 % por semana', () => {
  const p = plan(NADADORA, [{id: 'a', tipo: 'aguas', objetivo: 'Travesía 5 km', distancia_km: 5, dia: dia(7 * 10 - 1)}]);
  const largas = p.semanas.map((s) => s.sesiones.find((x) => x.sport === 'swim' && x.larga)).filter(Boolean);
  assert.ok(largas.length >= 3);
  assert.ok(largas[0].metros <= 3000 * 1.1 + 1, `primera larga ${largas[0].metros} m`);
  for (let i = 1; i < largas.length; i++) assert.ok(largas[i].metros <= Math.max(...largas.slice(0, i).map((x) => x.metros)) * 1.1 + 1, largas.map((x) => x.metros).join(', '));
  assert.ok(Math.max(...largas.map((x) => x.metros)) > 3000, 'la larga debe progresar');
});

test('ciclista con objetivo de ciclismo lejano: la base también es en bici', () => {
  const p = plan(CICLISTA, [{id: 'c', tipo: 'ciclismo', objetivo: 'Marcha 150 km', distancia_km: 150, dia: dia(7 * 16 - 1)}]);
  const base = p.semanas.filter((s) => s.faseTipo === 'base');
  assert.ok(base.length);
  base.forEach((s) => assert.strictEqual(deSport(s, 'run').length, 0, `${s.semana}: ${s.sesiones.map((x) => x.titulo)}`));
});

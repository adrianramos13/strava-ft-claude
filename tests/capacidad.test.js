// Capacidad de la persona (historial reciente + datos físicos) y reglas generales del plan.
const test = require('node:test');
const assert = require('node:assert');
const {AN, PLAN} = require('./cargar')();

const hoy = AN.parse('2026-03-02');
const dia = (n) => AN.iso(AN.addDays(hoy, n));
const TODOS = [0, 1, 2, 3, 4, 5, 6];
const MIN = {0: 60, 1: 60, 2: 60, 3: 60, 4: 60, 5: 120, 6: 120};
const run = (n, km, min) => ({fecha: dia(n), tipo: 'Run', nombre: 'Rodaje', seg_mov: min * 60, metros: km * 1000});

// 8 semanas: 3 carreras (8 + 7,5 + 15 km) y 1 de fuerza por semana
function historial8() {
  const acts = [];
  for (let w = 8; w >= 1; w--) {
    const l = -7 * w;
    acts.push(run(l + 1, 8, 45), run(l + 3, 7.5, 40), run(l + 6, 15, 90));
    acts.push({fecha: dia(l + 4), tipo: 'WeightTraining', nombre: 'Fuerza', seg_mov: 3300, metros: 0});
  }
  return acts;
}
const analizar = (acts, perfil = {}, objetivos = []) => AN.analizar(acts, {objetivos, ...perfil}, hoy);

test('sin historial: no hay capacidad suficiente ni plan', () => {
  const R = analizar([]);
  assert.strictEqual(R.capacidad.suficiente, false);
  assert.strictEqual(PLAN.puedePlanificar(R), false);
  assert.strictEqual(PLAN.proponer(R, {}, dia(7), TODOS, MIN), null);
  assert.strictEqual(PLAN.generarCompleto(R, {}, dia(7), TODOS, MIN), null);
});

test('historial escaso (3 entrenos en una sola semana): sin plan', () => {
  const R = analizar([run(-3, 5, 30), run(-2, 5, 30), run(-1, 5, 30)]);
  assert.strictEqual(R.capacidad.suficiente, false);
  assert.strictEqual(PLAN.proponer(R, {}, dia(7), TODOS, MIN), null);
});

test('actividad antigua (hace 3 meses) no cuenta como historial reciente', () => {
  const R = analizar(historial8().map((a) => ({...a, fecha: AN.iso(AN.addDays(AN.parse(a.fecha), -90))})));
  assert.strictEqual(R.capacidad.suficiente, false);
});

test('historial de 8 semanas: media semanal por deporte y sesión más larga', () => {
  const c = analizar(historial8()).capacidad;
  assert.strictEqual(c.suficiente, true);
  assert.strictEqual(c.semanasActivas, 8);
  assert.strictEqual(c.sesionesSemana, 4);
  assert.strictEqual(c.horasSemana, 3.8);
  assert.deepStrictEqual({...c.porDeporte.run}, {sesiones: 3, min: 175, km: 30.5, maxMin: 90, maxKm: 15});
  assert.strictEqual(c.porDeporte.strength.sesiones, 1);
  assert.ok(c.forma > 0);
});

test('edad, IMC y FC máxima estimada (Tanaka) desde el perfil', () => {
  const perfil = {fecha_nacimiento: '1966-03-03', altura_cm: 175, pesos: [{dia: dia(-40), kg: 101}, {dia: dia(-10), kg: 98}]};
  const c = analizar(historial8(), perfil).capacidad;
  assert.strictEqual(c.edad, 59);  // cumple 60 mañana
  assert.strictEqual(c.peso_kg, 98);
  assert.strictEqual(c.imc, 32);
  assert.strictEqual(c.fcMaxEstimada, Math.round(208 - 0.7 * 59));
});

test('sin datos físicos: edad, IMC y FC estimada quedan en null', () => {
  const c = analizar(historial8()).capacidad;
  assert.deepStrictEqual([c.edad, c.imc, c.fcMaxEstimada], [null, null, null]);
});

test('la FC máxima estimada por edad se usa si no hay otra (ni perfil ni actividades)', () => {
  const conPulso = historial8().map((a) => ({...a, fc: 150}));
  assert.strictEqual(analizar(conPulso).meta.fc_max, null);
  assert.strictEqual(analizar(conPulso, {fecha_nacimiento: '1986-01-01'}).meta.fc_max, Math.round(208 - 0.7 * 40));
  assert.strictEqual(analizar(conPulso, {fecha_nacimiento: '1986-01-01', fc_max: 195}).meta.fc_max, 195);
});

test('nada de dieta: ni el plan ni los objetivos hablan de alimentación o calorías', () => {
  const objetivos = [{id: 'p', tipo: 'peso', objetivo: 'Bajar a 75 kg', peso_inicial: 82, peso_objetivo: 75, dia: dia(120)}];
  const R = analizar(historial8(), {pesos: [{dia: dia(-30), kg: 82}, {dia: dia(-1), kg: 81}]}, objetivos);
  const textos = [...R.objetivos.flatMap((o) => o.notas), ...PLAN.generarCompleto(R, {}, dia(7), TODOS, MIN).semanas.flatMap((s) => s.notas)].join(' ');
  assert.doesNotMatch(textos, /aliment|kcal|calor|déficit|nutricion/i);
});

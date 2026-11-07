// Tests de referencia (snapshot) del planificador: congelan la salida actual de proponer/generarCompleto.
// Ejecutar: node --test tests/      Regenerar tras un cambio intencionado: UPDATE=1 node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const {AN, PLAN} = require('./cargar')();

const HOY = '2026-03-02';  // lunes
const hoy = AN.parse(HOY);
const dia = (n) => AN.iso(AN.addDays(hoy, n));
const TODOS = [0, 1, 2, 3, 4, 5, 6];
const MIN = {0: 60, 1: 60, 2: 60, 3: 60, 4: 60, 5: 120, 6: 120};

// 8 semanas de historial: 3 rodajes (uno largo) y 1 de fuerza por semana
function historial(extra = []) {
  const acts = [];
  for (let w = 8; w >= 1; w--) {
    const l = -7 * w;
    acts.push({fecha: dia(l + 1), tipo: 'Run', nombre: 'Rodaje', seg_mov: 2700, metros: 8000, fc: 145});
    acts.push({fecha: dia(l + 3), tipo: 'Run', nombre: 'Series', seg_mov: 2400, metros: 7500, fc: 160});
    acts.push({fecha: dia(l + 4), tipo: 'WeightTraining', nombre: 'Fuerza', seg_mov: 3300, metros: 0});
    acts.push({fecha: dia(l + 6), tipo: 'Run', nombre: 'Largo', seg_mov: 5400, metros: 15000, fc: 148});
  }
  return acts.concat(extra);
}
const R = (objetivos, acts = historial(), perfil = {}) => AN.analizar(acts, {fc_max: 190, fc_reposo: 55, objetivos, ...perfil}, hoy);
const comp = (id, tipo, semanas, extra = {}) => ({id, tipo, objetivo: `${tipo} ${id}`, dia: dia(7 * semanas - 1), ...extra});

const ESCENARIOS = {
  'completo: media maratón': () => PLAN.generarCompleto(R([comp('m', 'carrera', 12, {distancia_km: 21.0975, meta_min: 110})]), {}, dia(7), TODOS, MIN),
  'completo: 10K con 3 días': () => PLAN.generarCompleto(R([comp('k', 'carrera', 8, {distancia_km: 10, meta_min: 50})]), {}, dia(7), [1, 3, 6], MIN),
  'completo: hyrox': () => PLAN.generarCompleto(R([comp('h', 'hyrox', 10, {meta_min: 90})]), {}, dia(7), TODOS, MIN),
  'completo: triatlón 70.3': () => PLAN.generarCompleto(R([comp('t', 'triatlon', 16, {distancia: 'half', meta_min: 330})]), {}, dia(7), TODOS, MIN),
  'completo: trail': () => PLAN.generarCompleto(R([comp('tr', 'trail', 10, {distancia_km: 35})]), {}, dia(7), TODOS, MIN),
  'completo: obstáculos': () => PLAN.generarCompleto(R([comp('o', 'ocr', 8, {distancia_km: 12})]), {}, dia(7), TODOS, MIN),
  'completo: duatlón': () => PLAN.generarCompleto(R([comp('d', 'duatlon', 8, {distancia: 'sprint'})]), {}, dia(7), TODOS, MIN),
  'completo: ciclismo': () => PLAN.generarCompleto(R([comp('c', 'ciclismo', 8, {distancia_km: 100})]), {}, dia(7), TODOS, MIN),
  'completo: aguas abiertas': () => PLAN.generarCompleto(R([comp('a', 'aguas', 8, {distancia_km: 3})]), {}, dia(7), TODOS, MIN),
  'completo: dos carreras seguidas': () => PLAN.generarCompleto(R([comp('a', 'carrera', 6, {distancia_km: 10}), comp('b', 'carrera', 12, {distancia_km: 21.0975})]), {}, dia(7), TODOS, MIN),
  'completo: peso + 10K': () => PLAN.generarCompleto(R([comp('k', 'carrera', 8, {distancia_km: 10}),
    {id: 'p', tipo: 'peso', objetivo: 'Bajar a 75 kg', peso_inicial: 82, peso_objetivo: 75, dia: dia(120)}], historial(), {pesos: [{dia: dia(-30), kg: 82}, {dia: dia(-1), kg: 81}]}), {}, dia(7), TODOS, MIN),
  'completo: solo peso': () => PLAN.generarCompleto(R([{id: 'p', tipo: 'peso', objetivo: 'Bajar a 75 kg', peso_inicial: 82, peso_objetivo: 75, dia: dia(84)}], historial(), {pesos: [{dia: dia(-1), kg: 81}]}), {}, dia(7), TODOS, MIN),
  'completo: fuerza': () => PLAN.generarCompleto(R([{id: 'f', tipo: 'fuerza', objetivo: 'Sentadilla 120', ejercicio: 'Sentadilla', rm_objetivo: 120, dia: dia(84)}]), {}, dia(7), TODOS, MIN),
  'semana: dos objetivos de fuerza (tope de 3 sesiones)': () => PLAN.proponer(R([
    {id: 'f1', tipo: 'fuerza', objetivo: 'Sentadilla 120', ejercicio: 'Sentadilla', rm_objetivo: 120, dia: dia(84)},
    {id: 'f2', tipo: 'fuerza', objetivo: 'Banca 90', ejercicio: 'Press banca', rm_objetivo: 90, dia: dia(84)}]), {}, dia(7), TODOS, MIN, {hoy: HOY, futuro: true}),
  'completo: forma 5 días': () => PLAN.generarCompleto(R([{id: 'fo', tipo: 'forma', objetivo: 'Ponerme en forma', dias_semana: 5, dia: dia(84)}]), {}, dia(7), TODOS, MIN),
  'completo: sin objetivos': () => PLAN.generarCompleto(R([]), {}, dia(7), [0, 2, 4, 6], MIN),
  'semana: normal': () => PLAN.proponer(R([comp('m', 'carrera', 12, {distancia_km: 21.0975, meta_min: 110})]), {}, dia(7), TODOS, MIN, {hoy: HOY}),
  'semana: muy cargado': () => {
    const bloque = [0, 1, 2, 3, 4, 5].map((n) => ({fecha: dia(-6 + n), tipo: 'Run', nombre: 'Duro', seg_mov: 7200, metros: 22000, fc: 175}));
    return PLAN.proponer(R([comp('m', 'carrera', 12, {distancia_km: 21.0975})], historial(bloque)), {}, dia(7), TODOS, MIN, {hoy: HOY});
  },
  'semana: 2 días y poco tiempo': () => PLAN.proponer(R([comp('m', 'carrera', 12, {distancia_km: 21.0975})]), {}, dia(7), [2, 5], {2: 30, 5: 45}, {hoy: HOY}),
  'semana: competición': () => PLAN.proponer(R([comp('k', 'carrera', 2, {distancia_km: 10, meta_min: 50})]), {}, dia(7), TODOS, MIN, {hoy: HOY}),
};

// `creado` es la hora de generación: no forma parte del algoritmo
const limpiar = (x) => JSON.parse(JSON.stringify(x, (k, v) => (k === 'creado' ? undefined : v)));
const SNAP = path.join(__dirname, 'planner.snap.json');
const actual = Object.fromEntries(Object.entries(ESCENARIOS).map(([k, f]) => [k, limpiar(f())]));

if (process.env.UPDATE || !fs.existsSync(SNAP)) fs.writeFileSync(SNAP, JSON.stringify(actual, null, 1) + '\n');
const guardado = JSON.parse(fs.readFileSync(SNAP, 'utf8'));

for (const nombre of Object.keys(ESCENARIOS)) {
  test(nombre, () => assert.deepStrictEqual(actual[nombre], guardado[nombre]));
}

test('cobertura: los escenarios recorren todas las fases y casos especiales', () => {
  const semanas = Object.values(actual).flatMap((x) => x.semanas || [x]);
  const tipos = new Set(semanas.map((s) => s.faseTipo));
  for (const t of ['base', 'carrera', 'hyrox', 'triatlon', 'trail', 'ocr', 'duatlon', 'ciclismo', 'aguas', 'peso', 'fuerza', 'forma', 'afinar']) assert.ok(tipos.has(t), `falta fase ${t}`);
  assert.ok(semanas.some((s) => s.competicion), 'falta semana de competición');
  assert.ok(semanas.some((s) => s.recuperacion), 'falta semana de recuperación');
  assert.ok(semanas.some((s) => s.descarga), 'falta semana de descarga');
  assert.ok(semanas.some((s) => s.notas.some((n) => n.includes('muy cargado'))), 'falta caso de fatiga');
  assert.ok(semanas.some((s) => s.sesiones.some((x) => x.detalle.includes('Ajustado a tus'))), 'falta recorte por minutos');
});

test('determinista: dos ejecuciones dan lo mismo', () => {
  for (const [k, f] of Object.entries(ESCENARIOS)) assert.deepStrictEqual(limpiar(f()), actual[k], k);
});

// Importación: actividades en JSON con el formato de la API de Strava (/athlete/activities).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = vm.createContext({window: {}});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../site/js/importar.js'), 'utf8'), ctx);
const {IMP} = ctx.window;

const API = {id: 123, name: 'Rodaje', sport_type: 'Run', type: 'Run', start_date: '2026-11-04T19:15:14Z', start_date_local: '2026-11-04T20:15:14Z',
  elapsed_time: 3000, moving_time: 2900, distance: 8000.5, total_elevation_gain: 40, average_heartrate: 145, max_heartrate: 170, suffer_score: 30};

test('lee una lista de actividades de la API de Strava', () => {
  const [a] = IMP.actividadesDesdeJson(JSON.stringify([API]));
  assert.strictEqual(JSON.stringify(a), JSON.stringify({id: 's123', origen: 'strava', fecha: '2026-11-04T20:15:14', nombre: 'Rodaje', tipo: 'Run', descripcion: null,
    seg_total: 3000, seg_mov: 2900, metros: 8000.5, fc_max: 170, fc: 145, esfuerzo: 30, desnivel: 40}));
});

test('acepta {activities: [...]}, usa type si falta sport_type y descarta lo que no es actividad', () => {
  const sinSport = {...API, id: 2, sport_type: undefined, type: 'Ride', average_heartrate: undefined};
  const acts = IMP.actividadesDesdeJson(JSON.stringify({activities: [sinSport, {foo: 1}, null]}));
  assert.strictEqual(acts.length, 1);
  assert.strictEqual(acts[0].tipo, 'Ride');
  assert.strictEqual(acts[0].fc, null);
});

test('acepta una sola actividad (GET /activities/{id})', () => {
  const acts = IMP.actividadesDesdeJson(JSON.stringify(API));
  assert.strictEqual(acts.length, 1);
  assert.strictEqual(acts[0].id, 's123');
});

test('lee un entreno de fuerza exportado por Hevy y deja las series en texto para el 1RM', () => {
  const hevy = {start_time: '2026-11-10T18:05:34.000Z', utc_offset: 3600, elapsed_time: 4488, active_time: 4488, creator: {name: 'Hevy'},
    sets: [{exercise_type: 'OVERHEAD_DUMBBELL_PRESS', repetitions: 10, weight: 36}, {exercise_type: 'OVERHEAD_DUMBBELL_PRESS', repetitions: 8, weight: 40},
      {exercise_type: 'CABLE_BICEPS_CURL', repetitions: 10, weight: 22.5}]};
  const [a] = IMP.actividadesDesdeJson(JSON.stringify(hevy));
  assert.strictEqual(a.sport, 'strength');
  assert.strictEqual(a.fecha, '2026-11-10T19:05:34');
  assert.strictEqual(a.seg_mov, 4488);
  assert.strictEqual(a.descripcion, 'Overhead dumbbell press\nSerie 1: 36 kg x 10\nSerie 2: 40 kg x 8\n\nCable biceps curl\nSerie 1: 22.5 kg x 10');
});

test('JSON no válido o sin actividades da un error claro', () => {
  assert.throws(() => IMP.actividadesDesdeJson('{no es json'), /JSON/);
  assert.strictEqual(IMP.actividadesDesdeJson('{"hola": 1}').length, 0);
});

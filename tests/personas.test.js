// Reglas que todo plan debe cumplir, para personas muy distintas (de casi sedentaria a élite).
// Umbrales: research_notes/Parámetros de planes de entrenamiento/ (Frandsen 2025, Nielsen 2014, Seiler, Herbert 2015...).
const test = require('node:test');
const assert = require('node:assert');
const {AN, PLAN} = require('./cargar')();

const hoy = AN.parse('2026-03-02');
const dia = (n) => AN.iso(AN.addDays(hoy, n));
const TODOS = [0, 1, 2, 3, 4, 5, 6];
const MIN = {0: 90, 1: 90, 2: 90, 3: 90, 4: 90, 5: 180, 6: 180};
const PRESUPUESTO_CALIDAD = [0, 1, 2, 2, 2];

// semanas de historial: cada sesión [día de la semana, tipo Strava, minutos, km]
function historial(semanas, sesiones) {
  const acts = [];
  for (let w = semanas; w >= 1; w--) sesiones.forEach(([d, tipo, min, km]) => acts.push({fecha: dia(-7 * w + d), tipo, nombre: tipo, seg_mov: min * 60, metros: km * 1000}));
  return acts;
}
const PERSONAS = {
  'casi sedentaria, 62 años, IMC 33': {acts: historial(3, [[1, 'Walk', 30, 2.5], [5, 'Walk', 40, 3.5]]), perfil: {fecha_nacimiento: '1964-01-10', altura_cm: 165, pesos: [{dia: dia(-3), kg: 90}]}, nivel: 0},
  'principiante, 2 rodajes cortos': {acts: historial(8, [[1, 'Run', 25, 4], [5, 'Run', 25, 4]]), perfil: {fecha_nacimiento: '1996-05-01'}, nivel: 1},
  'intermedia, 30 km/semana': {acts: historial(8, [[1, 'Run', 45, 8], [3, 'Run', 40, 7.5], [4, 'WeightTraining', 55, 0], [6, 'Run', 90, 15]]), perfil: {}, nivel: 2},
  'avanzada de 56 años, 60 km/semana': {acts: historial(8, [[0, 'Run', 55, 10], [1, 'Run', 60, 12], [3, 'Run', 45, 8], [4, 'Run', 55, 10], [6, 'Run', 100, 20]]), perfil: {fecha_nacimiento: '1970-02-01'}, nivel: 3},
  'élite, ~110 km/semana': {acts: historial(8, [[0, 'Run', 60, 14], [1, 'Run', 70, 16], [1, 'Run', 35, 8], [2, 'Run', 60, 14], [3, 'Run', 70, 16], [3, 'Run', 35, 8], [4, 'Run', 45, 10], [5, 'Run', 60, 14], [6, 'Run', 120, 30]]), perfil: {}, nivel: 4},
};
const OBJETIVOS = {
  '10K': (sem) => ({id: 'k', tipo: 'carrera', objetivo: '10K', distancia_km: 10, dia: dia(7 * sem - 1)}),
  'maratón': (sem) => ({id: 'm', tipo: 'carrera', objetivo: 'Maratón', distancia_km: 42.195, dia: dia(7 * sem - 1)}),
  'forma': (sem) => ({id: 'f', tipo: 'forma', objetivo: 'Ponerme en forma', dias_semana: 4, dia: dia(7 * sem - 1)}),
};
const planes = [];
for (const [np, p] of Object.entries(PERSONAS)) {
  for (const [no, o] of Object.entries(OBJETIVOS)) {
    const R = AN.analizar(p.acts, {objetivos: [o(no === 'maratón' ? 16 : 12)], ...p.perfil}, hoy);
    // 130 km/semana no caben en 90 min al día: la élite marca más tiempo disponible
    const minutos = p.nivel === 4 ? {0: 150, 1: 150, 2: 150, 3: 150, 4: 150, 5: 200, 6: 200} : MIN;
    planes.push({nombre: `${np} · ${no}`, p, R, plan: PLAN.generarCompleto(R, {}, dia(7), TODOS, minutos)});
  }
}
const kmRun = (s) => s.sesiones.filter((x) => x.sport === 'run' && x.km).reduce((t, x) => t + x.km, 0);
const especial = (s) => s.competicion || s.recuperacion;
const dias = (a, b) => (AN.parse(b.dia) - AN.parse(a.dia)) / 864e5;

test('el nivel sale del historial', () => {
  for (const [np, p] of Object.entries(PERSONAS)) assert.strictEqual(AN.analizar(p.acts, p.perfil, hoy).capacidad.nivel, p.nivel, np);
});

for (const {nombre, p, R, plan} of planes) {
  const edad = R.capacidad.edad || 0;
  test(`${nombre}: sesiones de calidad dentro del presupuesto de su nivel y bien separadas`, () => {
    const sep = edad >= 50 ? 3 : 2;
    plan.semanas.forEach((s) => {
      const cal = s.sesiones.filter((x) => x.calidad);
      if (!especial(s)) assert.ok(cal.length <= PRESUPUESTO_CALIDAD[p.nivel], `${s.semana}: ${cal.length} de calidad (máx ${PRESUPUESTO_CALIDAD[p.nivel]})`);
      for (let i = 1; i < cal.length; i++) assert.ok(dias(cal[i - 1], cal[i]) >= sep, `${s.semana}: calidad a menos de ${sep} días`);
    });
  });

  test(`${nombre}: ninguna carrera supera en más de un 10 % la más larga de los 30 días previos`, () => {
    const hechas = R.acts.filter((a) => a.sport === 'run').map((a) => ({dia: AN.iso(a.d), km: a.km}));
    const plan30 = [];
    plan.semanas.forEach((s) => s.sesiones.filter((x) => x.sport === 'run' && x.km && !x.titulo.startsWith('Competición')).forEach((x) => {
      const desde = AN.iso(AN.addDays(AN.parse(x.dia), -30));
      const previas = [...hechas, ...plan30].filter((h) => h.dia >= desde && h.dia < x.dia).map((h) => h.km);
      const tope = previas.length ? Math.max(...previas) * 1.1 : 3;
      assert.ok(x.km <= Math.max(tope, 3) + 0.5, `${x.dia} ${x.titulo}: ${x.km} km > ${tope.toFixed(1)}`);
      plan30.push({dia: x.dia, km: x.km});
    }));
  });

  test(`${nombre}: el volumen de carrera sube de forma gradual`, () => {
    const actual = (R.capacidad.porDeporte.run || {km: 0}).km;
    const cap = [0.2, 0.2, 0.15, 0.1, 0.1][p.nivel];
    let ref = actual;
    plan.semanas.forEach((s) => {
      const km = kmRun(s);
      if (!especial(s) && !s.descarga) assert.ok(km <= Math.max(ref * (1 + cap), ref + 3) + 0.5, `${s.semana}: ${km} km tras ${ref} km`);
      if (!s.descarga && !especial(s)) ref = Math.max(ref, km);
    });
  });

  if (edad >= 50) {
    test(`${nombre}: a partir de 50 años, al menos 2 sesiones de fuerza si hay 4 o más sesiones`, () => {
      plan.semanas.filter((s) => !especial(s) && s.sesiones.length >= 4).forEach((s) => {
        assert.ok(s.sesiones.filter((x) => x.sport === 'strength').length >= 2, `${s.semana}: ${s.sesiones.map((x) => x.titulo).join(', ')}`);
      });
    });
  }
}

test('quien no corre 30 min seguidos empieza con carrera-caminata, no con rodajes ni series', () => {
  for (const {nombre, plan} of planes.filter((x) => x.p.nivel <= 1 && !x.nombre.endsWith('forma'))) {
    const s1 = plan.semanas[0].sesiones.filter((x) => x.sport === 'run');
    assert.ok(s1.length && s1.every((x) => x.correrAndar), `${nombre}: ${s1.map((x) => x.titulo).join(', ')}`);
  }
});

test('IMC ≥ 30 sin historial de carrera: la primera semana suma como mucho ~3 km corriendo (≤ 24 min)', () => {
  const {plan} = planes.find((x) => x.nombre.startsWith('casi sedentaria') && x.nombre.endsWith('10K'));
  const min = plan.semanas[0].sesiones.reduce((t, x) => t + (x.minCorriendo || 0), 0);
  assert.ok(min > 0 && min <= 24, `${min} min corriendo`);
});

test('la élite no baja de su volumen: el pico supera lo que ya corre', () => {
  for (const {nombre, R, plan} of planes.filter((x) => x.p.nivel === 4 && !x.nombre.endsWith('forma'))) {
    const pico = Math.max(...plan.semanas.map(kmRun));
    assert.ok(pico >= R.capacidad.porDeporte.run.km - 0.5,`${nombre}: pico ${pico} < actual ${R.capacidad.porDeporte.run.km}`);
  }
});

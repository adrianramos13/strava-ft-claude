// Asistente: las herramientas que usa Claude para cambiar el plan, sin red ni pantalla.
const test = require('node:test');
const assert = require('node:assert');
const {AN, PLAN, ASIS} = require('./cargar')();

const hoy = AN.parse('2026-03-02');
const dia = (n) => AN.iso(AN.addDays(hoy, n));
const SEM = dia(0);  // lunes 2 de marzo
function historial(semanas, sesiones) {
  const acts = [];
  for (let w = semanas; w >= 1; w--) sesiones.forEach(([d, tipo, min, km]) => acts.push({fecha: dia(-7 * w + d), tipo, nombre: tipo, seg_mov: min * 60, metros: km * 1000}));
  return acts;
}
// corredor con gimnasio y una media maratón: fuerza de pierna y tirada larga en la misma semana
const ACTS = historial(8, [[0, 'WeightTraining', 50, 0], [1, 'Run', 45, 8], [3, 'Run', 40, 7], [4, 'WeightTraining', 50, 0], [6, 'Run', 80, 14]]);
const OBJ = [{id: 'm', tipo: 'carrera', objetivo: 'Media maratón', distancia_km: 21.1, dia: dia(7 * 12 - 1)}];
const R = AN.analizar(ACTS, {objetivos: OBJ}, hoy);
const MIN = {0: 60, 1: 60, 2: 60, 3: 60, 4: 60, 5: 120, 6: 120};

const base = () => {
  const plan = PLAN.proponer(R, {}, SEM, [0, 1, 3, 4, 6], MIN, {futuro: true});
  return {R, perfil: {objetivos: OBJ}, hoy: SEM, semanaObjetivo: SEM, planes: {[SEM]: plan}, planCompleto: null, preferencias: [], pila: [], minutosDia: MIN};
};
const ses = (p, d) => p.sesiones.filter((s) => s.dia === AN.iso(AN.addDays(AN.parse(p.semana), d)));

test('la tirada larga va el día que se pide', () => {
  const {est, ok} = ASIS.ejecutar('rehacer_semana', {semana: SEM, dias: null, minutos: null, dia_larga: 4, factor_carga: null}, base());
  assert.ok(ok);
  assert.ok(ses(est.planes[SEM], 4).some((s) => s.larga), est.planes[SEM].sesiones.map((s) => `${s.nombreDia} ${s.titulo}`).join(' · '));
});

test('nunca hay fuerza de pierna el día antes de la tirada larga', () => {
  for (const d of [1, 2, 3, 4, 5, 6]) {
    const p = PLAN.proponer(R, {}, SEM, [0, 1, 2, 3, 4, 5, 6], MIN, {futuro: true, diaLarga: d});
    const larga = p.sesiones.find((s) => s.larga);
    const antes = p.sesiones.find((s) => s.dia === AN.iso(AN.addDays(AN.parse(larga.dia), -1)));
    assert.ok(!antes || !/pierna|sentadilla|zancada/i.test(`${antes.titulo} ${antes.detalle}`), `larga el ${larga.nombreDia}, antes: ${antes && antes.titulo}`);
  }
});

test('menos carga: baja minutos y km de toda la semana', () => {
  const b = base();
  const {est} = ASIS.ejecutar('rehacer_semana', {semana: SEM, dias: null, minutos: null, dia_larga: null, factor_carga: 0.8}, b);
  const tot = (p) => p.sesiones.reduce((t, s) => t + s.min, 0);
  assert.ok(tot(est.planes[SEM]) < tot(b.planes[SEM]) * 0.9, `${tot(est.planes[SEM])} vs ${tot(b.planes[SEM])}`);
  assert.ok(est.planes[SEM].kmCarrera < b.planes[SEM].kmCarrera);
});

test('cambiar días: solo usa los días pedidos', () => {
  const {est} = ASIS.ejecutar('rehacer_semana', {semana: SEM, dias: [1, 3, 5], minutos: [{dia: 5, min: 150}], dia_larga: null, factor_carga: null}, base());
  const dows = est.planes[SEM].sesiones.map((s) => (AN.parse(s.dia) - AN.parse(SEM)) / 864e5);
  assert.ok(dows.every((d) => [1, 3, 5].includes(d)), dows.join(','));
  assert.strictEqual(est.planes[SEM].minutosDia[5], 150);
});

test('editar sesiones: mover intercambia, quitar borra, poner sustituye', () => {
  const b = base();
  const p0 = b.planes[SEM];
  const [d1, d2] = [...new Set(p0.sesiones.map((s) => (AN.parse(s.dia) - AN.parse(SEM)) / 864e5))];
  const t1 = ses(p0, d1)[0].titulo, t2 = ses(p0, d2)[0].titulo;

  const m = ASIS.ejecutar('editar_sesion', {semana: SEM, dia: d1, accion: 'mover', a_dia: d2, sesion: null}, b).est.planes[SEM];
  assert.strictEqual(ses(m, d2)[0].titulo, t1);
  assert.strictEqual(ses(m, d1)[0].titulo, t2);

  const q = ASIS.ejecutar('editar_sesion', {semana: SEM, dia: d1, accion: 'quitar', a_dia: null, sesion: null}, b).est.planes[SEM];
  assert.strictEqual(ses(q, d1).length, 0);

  const nueva = {sport: 'swim', titulo: 'Nado suave', detalle: '1.500 m tranquilos', min: 40, km: null};
  const pu = ASIS.ejecutar('editar_sesion', {semana: SEM, dia: 2, accion: 'poner', a_dia: null, sesion: nueva}, b).est.planes[SEM];
  assert.strictEqual(JSON.stringify(ses(pu, 2).map((s) => [s.titulo, s.nombreDia, s.min])), JSON.stringify([['Nado suave', 'Miércoles', 40]]));

  // el estado de partida no cambia
  assert.strictEqual(b.planes[SEM], p0);
  assert.strictEqual(ses(p0, d1)[0].titulo, t1);
});

test('deshacer vuelve al plan anterior', () => {
  const b = base();
  const e1 = ASIS.ejecutar('editar_sesion', {semana: SEM, dia: 0, accion: 'quitar', a_dia: null, sesion: null}, b).est;
  const e2 = ASIS.ejecutar('deshacer', {}, e1).est;
  assert.strictEqual(e2.planes[SEM], b.planes[SEM]);
  assert.strictEqual(ASIS.ejecutar('deshacer', {}, e2).ok, false);
});

test('entradas fuera de rango se rechazan sin tocar nada', () => {
  const b = base();
  for (const [n, i] of [['editar_sesion', {semana: SEM, dia: 9, accion: 'quitar', a_dia: null, sesion: null}],
    ['editar_sesion', {semana: '2020-01-06', dia: 1, accion: 'quitar', a_dia: null, sesion: null}],
    ['editar_sesion', {semana: SEM, dia: 1, accion: 'poner', a_dia: null, sesion: null}],
    ['rehacer_semana', {semana: SEM, dias: [], minutos: null, dia_larga: null, factor_carga: null}],
    ['inventada', {}]]) {
    const r = ASIS.ejecutar(n, i, b);
    assert.strictEqual(r.ok, false, `${n} ${JSON.stringify(i)}`);
    assert.strictEqual(r.est, b);
  }
});

test('el plan completo se rehace con los cambios en todas las semanas', () => {
  const b = {...base(), planCompleto: PLAN.generarCompleto(R, {}, dia(7), [1, 3, 5, 6], MIN)};
  const {est, ok} = ASIS.ejecutar('rehacer_plan_completo', {dias: null, minutos: null, dia_larga: 5, factor_carga: null}, b);
  assert.ok(ok);
  assert.strictEqual(est.planCompleto.semanas.length, b.planCompleto.semanas.length);
  est.planCompleto.semanas.filter((s) => s.sesiones.some((x) => x.larga)).forEach((s) => assert.strictEqual(s.sesiones.find((x) => x.larga).nombreDia, 'Sábado'));
});

test('preferencias: se guardan, se borran y aparecen en el contexto', () => {
  const e1 = ASIS.ejecutar('guardar_preferencia', {texto: 'No puedo entrenar los miércoles'}, base()).est;
  assert.strictEqual(JSON.stringify(e1.preferencias), '["No puedo entrenar los miércoles"]');
  const ctx = ASIS.contexto(e1);
  assert.match(ctx, /No puedo entrenar los miércoles/);
  assert.match(ctx, /Tirada larga/);
  assert.match(ctx, /Media maratón/);
  assert.strictEqual(ASIS.ejecutar('borrar_preferencia', {indice: 1}, e1).est.preferencias.length, 0);
});

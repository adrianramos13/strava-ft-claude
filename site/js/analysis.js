/* Motor de análisis: actividades + perfil -> métricas, objetivos y plan.
   Todo se calcula en el móvil; nada sale del dispositivo. */
(() => {
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
  const ETIQUETA = {run: 'Carrera', hyrox: 'HYROX / funcional', strength: 'Fuerza', bike: 'Bici', swim: 'Natación', walk: 'Caminata', other: 'Otros'};
  const ORDEN = Object.keys(ETIQUETA);
  const CARGA_MIN = {run: 1.4, hyrox: 1.3, swim: 1.0, bike: 0.8, strength: 0.5, walk: 0.3, other: 0.5};
  const TRI = {sprint: [0.75, 20, 5, 4], olimpico: [1.5, 40, 10, 5]};
  const DIA = 864e5;

  // ---------------------------------------------------------------- fechas
  const iso = (d) => d.toISOString().slice(0, 10);
  const parse = (s) => new Date(String(s).slice(0, 10) + 'T00:00:00Z');
  const addDays = (d, n) => new Date(d.getTime() + n * DIA);
  const lunes = (d) => addDays(d, -((d.getUTCDay() + 6) % 7));
  const hoyUTC = () => { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); };
  const fechaTxt = (d) => `${d.getUTCDate()} ${MES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  const hm = (mins) => { if (mins == null) return null; const t = Math.round(mins); const h = Math.floor(t / 60), m = t % 60; return h ? `${h}:${String(m).padStart(2, '0')}` : `${m} min`; };
  const ritmo = (p) => { if (!p) return ''; let m = Math.floor(p), s = Math.round((p - m) * 60); if (s === 60) { m += 1; s = 0; } return `${m}:${String(s).padStart(2, '0')}`; };
  const dec = (x, n = 1) => x.toFixed(n).replace('.', ',');
  const riegel = (t, d1, d2) => t * Math.pow(d2 / d1, 1.06);

  // --------------------------------------------------------------- deporte
  function deporte(a) {
    if (a.sport) return a.sport;
    const n = (a.nombre || '').toLowerCase(), t = a.tipo || '';
    if (n.includes('hyrox')) return 'hyrox';
    if (['Run', 'TrailRun', 'VirtualRun'].includes(t)) return 'run';
    if (['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide', 'Velomobile'].includes(t)) return 'bike';
    if (t === 'Swim') return 'swim';
    if (t === 'WeightTraining') return 'strength';
    if (['Crossfit', 'HighIntensityIntervalTraining'].includes(t)) return 'hyrox';
    if (t === 'Workout') return (n.includes('ride') || n.includes('bici') || n.includes('ciclo')) ? 'bike' : 'hyrox';
    if (['Walk', 'Hike'].includes(t)) return 'walk';
    return 'other';
  }

  function carga(a, fcMax, fcRep) {
    if (a.esfuerzo) return [a.esfuerzo, 'strava'];
    const mins = a.seg_mov / 60;
    if (a.fc && fcMax && a.fc > fcRep) {
      const hrr = Math.min(1, (a.fc - fcRep) / (fcMax - fcRep));
      return [mins * hrr * 0.64 * Math.exp(1.92 * hrr), 'pulso'];
    }
    // sRPE (minutos x esfuerzo percibido) llevado a la escala del Esfuerzo Relativo; la fuerza carga menos el sistema cardiovascular
    if (a.rpe) return [mins * a.rpe * ({strength: 0.1, walk: 0.12, other: 0.18}[a.sport] || 0.28), 'sensaciones'];
    return [mins * CARGA_MIN[a.sport], 'estimada'];
  }

  // -------------------------------------------------- series de Hevy en texto
  const SERIE = /Serie\s*\d+\s*:\s*([\d.,]+)\s*kg\s*x\s*(\d+)|Set\s*\d+\s*:\s*([\d.,]+)\s*kg\s*x\s*(\d+)/i;
  function seriesHevy(texto) {
    const out = [];
    String(texto || '').split(/\n\s*\n/).forEach((bloque) => {
      const lineas = bloque.trim().split('\n').map((l) => l.trim()).filter(Boolean);
      if (lineas.length < 2 || !SERIE.test(lineas[1])) return;
      lineas.slice(1).forEach((l) => {
        const m = l.match(SERIE);
        if (m) out.push([lineas[0], parseFloat((m[1] || m[3]).replace(',', '.')), parseInt(m[2] || m[4], 10)]);
      });
    });
    return out;
  }

  // -------------------------------------------------------------- análisis
  function analizar(actividades, perfil, hoy = hoyUTC()) {
    const acts = actividades.map((a) => {
      const o = {...a};
      o.sport = deporte(o);
      o.d = parse(o.fecha);
      o.min = (o.seg_mov || 0) / 60;
      o.km = (o.metros || 0) / 1000;
      return o;
    }).filter((a) => a.d <= hoy).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    if (!acts.length) {
      const objetivos = (perfil.objetivos || []).map((o) => estimarObjetivo(o, {acts: [], hoy, perfil, sesiones: {}, ctl: 0}));
      return {vacio: true, estado: null, objetivos, kmSemana: planKm([], objetivos, hoy), fases: planFases(objetivos, hoy), ritmo10k: null, acts: [], recientes: []};
    }

    const maxs = acts.map((a) => a.fc_max).filter(Boolean).sort((a, b) => a - b);
    const fcMax = +perfil.fc_max || (maxs.length ? maxs[Math.floor(maxs.length * 0.98)] : null);
    const fcRep = +perfil.fc_reposo || 60;
    acts.forEach((a) => { [a.carga, a.carga_tipo] = carga(a, fcMax, fcRep); });

    // forma (42 d), fatiga (7 d), frescura
    const diaria = new Map();
    acts.forEach((a) => { const k = iso(a.d); diaria.set(k, (diaria.get(k) || 0) + a.carga); });
    let ctl = 0, atl = 0;
    const pmc = [];
    for (let d = acts[0].d; d <= hoy; d = addDays(d, 1)) {
      const l = diaria.get(iso(d)) || 0;
      ctl += (l - ctl) / 42; atl += (l - atl) / 7;
      if (d > addDays(hoy, -365)) pmc.push({dia: iso(d), carga: l, forma: ctl, fatiga: atl, frescura: ctl - atl});
    }

    const sem0 = lunes(hoy);
    const semanas = Array.from({length: 26}, (_, i) => addDays(sem0, -7 * (25 - i)));
    const horas = new Map(semanas.map((w) => [iso(w), Object.fromEntries(ORDEN.map((k) => [k, 0]))]));
    acts.forEach((a) => { const h = horas.get(iso(lunes(a.d))); if (h) h[a.sport] += a.min / 60; });
    const horasSemana = semanas.map((w) => ({semana: iso(w), ...horas.get(iso(w))}));

    const sum = (lo, hi) => acts.filter((a) => a.d > lo && a.d <= hi).reduce((s, a) => s + a.carga, 0);
    const c28 = sum(addDays(hoy, -28), hoy), c28p = sum(addDays(hoy, -56), addDays(hoy, -28));
    const fres = Math.round(ctl - atl);
    const estado = {
      forma: Math.round(ctl), fatiga: Math.round(atl), frescura: fres, carga4: Math.round(c28), carga4_prev: Math.round(c28p),
      cambio_pct: c28p ? Math.round((c28 - c28p) / c28p * 100) : null,
      estado: fres > 5 ? 'fresco' : fres >= -10 ? 'equilibrado' : fres >= -30 ? 'cargando' : 'en sobrecarga',
      nivel: fres >= -10 ? 'ok' : fres >= -30 ? 'warn' : 'bad',
    };

    const resumen = (dias) => {
      const by = {};
      acts.filter((a) => a.d > addDays(hoy, -dias)).forEach((a) => { const b = by[a.sport] || (by[a.sport] = [0, 0, 0]); b[0]++; b[1] += a.min / 60; b[2] += a.km; });
      return Object.entries(by).sort((a, b) => b[1][1] - a[1][1]).map(([k, v]) => ({deporte: ETIQUETA[k], sport: k, sesiones: v[0], horas: v[1], km: v[2]}));
    };

    // carrera
    const pace = (a) => (a.km ? a.min / a.km : null);
    const runs = acts.filter((a) => a.sport === 'run' && a.km >= 2 && a.seg_mov);
    const carreras = runs.filter((a) => a.d > addDays(hoy, -365)).map((a) => ({
      dia: iso(a.d), nombre: a.nombre, km: a.km, ritmo_min_km: pace(a), ritmo: ritmo(pace(a)), fc: a.fc,
      m_por_latido: a.fc ? a.metros / a.min / a.fc : null}));
    const mejores = [];
    [['5K', 4.95], ['10K', 9.9], ['Media', 21], ['15K+', 14.9]].forEach(([et, minkm]) => {
      const c = runs.filter((a) => a.km >= minkm);
      if (!c.length || (et === '15K+' && mejores.some((m) => m.distancia === 'Media'))) return;
      const b = c.reduce((x, y) => (pace(y) < pace(x) ? y : x));
      mejores.push({distancia: et, fecha: fechaTxt(b.d), nombre: b.nombre, km: b.km, ritmo: ritmo(pace(b)), fc: b.fc});
    });

    // fuerza
    const sesiones = {};
    acts.filter((a) => a.sport === 'strength' && a.descripcion).forEach((a) => {
      seriesHevy(a.descripcion).forEach(([ej, kg, reps]) => {
        if (kg > 0 && reps >= 1 && reps <= 15) {
          const e1 = kg * (1 + reps / 30), k = iso(a.d);
          const s = sesiones[ej] || (sesiones[ej] = {});
          s[k] = Math.max(s[k] || 0, e1);
        }
      });
    });
    const lo180 = iso(addDays(hoy, -180));
    const top = Object.entries(sesiones).map(([ej, v]) => [ej, Object.keys(v).filter((k) => k >= lo180).length])
      .filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([ej]) => ej);
    const fuerza = top.flatMap((ej) => Object.entries(sesiones[ej]).filter(([k]) => k >= lo180).sort().map(([k, v]) => ({ejercicio: ej, dia: k, rm: v})));

    // ritmo de referencia (10K equivalente) para zonas y estimaciones
    const refs = acts.filter((a) => a.sport === 'run' && a.km >= 5 && a.d >= addDays(hoy, -90) && a.min / a.km < 7.5);
    const ref10 = refs.length ? refs.reduce((b, a) => (riegel(a.min, a.km, 10) < riegel(b.min, b.km, 10) ? a : b)) : null;
    const ritmo10k = ref10 ? riegel(ref10.min, ref10.km, 10) / 10 : null;

    const objetivos = (perfil.objetivos || []).map((o) => estimarObjetivo(o, {acts, hoy, perfil, sesiones, ctl}));
    const kmSemana = planKm(acts, objetivos, hoy);
    const fases = planFases(objetivos, hoy);

    const recientes = acts.slice(-20).reverse().map((a) => ({
      id: a.id, fecha: fechaTxt(a.d), dia: iso(a.d), nombre: a.nombre, sport: a.sport, deporte: ETIQUETA[a.sport],
      duracion: a.min >= 60 ? `${Math.floor(a.min / 60)} h ${String(Math.round(a.min % 60)).padStart(2, '0')} min` : `${Math.round(a.min)} min`,
      km: a.km || null, fc: a.fc, carga: Math.round(a.carga), carga_tipo: a.carga_tipo, origen: a.origen}));

    return {
      meta: {total: acts.length, desde: fechaTxt(acts[0].d), hoy: iso(hoy), fc_max: fcMax,
        cobertura_fc: Math.round(acts.filter((a) => a.carga_tipo !== 'estimada').length / acts.length * 100)},
      estado, pmc, horasSemana, deportes90: resumen(90), deportes7: resumen(7), carreras, mejores, fuerza, recientes,
      objetivos, kmSemana, fases, ritmo10k, acts,
      largo8: Math.max(0, ...runs.filter((a) => a.d > addDays(hoy, -56)).map((a) => a.km)),
      ejercicios: Object.keys(sesiones).sort(),
      cardioPref: (resumen(90).find((r) => ['run', 'bike', 'swim', 'walk'].includes(r.sport)) || {sport: 'run'}).sport,
    };
  }

  // -------------------------------------------------------------- objetivos
  function refCarrera(acts, hoy, minKm) {
    return acts.filter((a) => a.sport === 'run' && a.km >= minKm && a.d >= addDays(hoy, -90) && a.min / a.km < 7.5);
  }
  function mejorPara(c, dist) { return c.reduce((b, a) => (riegel(a.min, a.km, dist) < riegel(b.min, b.km, dist) ? a : b)); }

  function estimar(o0, acts, hoy) {
    const o = {...o0, notas: []};
    o.fecha_txt = o.fecha_txt || fechaTxt(parse(o.dia));
    o.meta = o.meta_min ? hm(o.meta_min) : 'por definir';
    let est = null;
    if (o.tipo === 'carrera') {
      const dist = +o.distancia_km;
      const c = refCarrera(acts, hoy, Math.max(5, Math.round(dist * 0.35)));
      if (c.length) {
        const b = mejorPara(c, dist);
        est = riegel(b.min, b.km, dist);
        Object.assign(o, {ref_km: b.km, ref_tiempo: `${Math.floor(b.seg_mov / 60)}:${String(Math.floor(b.seg_mov % 60)).padStart(2, '0')}`,
          ref_ritmo: ritmo(b.min / b.km), ref_fecha: fechaTxt(b.d)});
        o.base = `Proyección (fórmula de Riegel) desde tus ${dec(b.km)} km del ${fechaTxt(b.d)}.`;
      } else o.base = 'Aún no hay una carrera continua reciente que sirva de referencia.';
      if (o.meta_min) {
        o.ritmo_meta = o.meta_min / dist;
        o.notas.push(`Ritmo objetivo: ${ritmo(o.ritmo_meta)}/km.`);
        if (dist > 10) { const t = o.meta_min * Math.pow(10 / dist, 1.06); o.notas.push(`Equivale a correr un 10K en unos ${Math.floor(t)}:${String(Math.round(t % 1 * 60)).padStart(2, '0')}.`); }
      }
    } else if (o.tipo === 'hyrox') {
      const h = acts.filter((a) => (a.nombre || '').toLowerCase().includes('hyrox') && a.seg_total > 3600);
      if (h.length) { const u = h[h.length - 1]; est = u.seg_total / 60; o.base = `Tu último HYROX completo registrado (${fechaTxt(u.d)}), tiempo total del reloj.`; } else o.base = 'Aún no hay un HYROX completo registrado.';
      const c = refCarrera(acts, hoy, 5);
      if (c.length && o.meta_min) {
        const b = mejorPara(c, 10), p = riegel(b.min, b.km, 10) / 10 + 0.5, correr = p * 8;
        o.notas.push(`Si corres los 8 km a ${ritmo(p)}/km (${Math.round(correr)} min), te quedan ${Math.round(o.meta_min - correr)} min para las 8 estaciones y las transiciones.`);
      }
    } else if (o.tipo === 'triatlon') {
      const [nado, bici, corre, trans] = TRI[o.distancia || 'olimpico'];
      const lo = addDays(hoy, -180);
      const sw = acts.filter((a) => a.sport === 'swim' && a.km >= 0.4 && a.d >= lo).map((a) => a.seg_mov / a.km / 10).sort((a, b) => a - b);
      const bk = acts.filter((a) => a.sport === 'bike' && a.km >= 15 && a.d >= lo && a.tipo !== 'VirtualRide' && !/clase|ciclo|group cycle|spinning/i.test(a.nombre || '')).map((a) => a.km / (a.seg_mov / 3600));
      const c = refCarrera(acts, hoy, 5);
      if (sw.length && bk.length && c.length) {
        const p100 = sw[Math.floor(sw.length / 2)], kmh = Math.max(...bk), b = mejorPara(c, corre);
        const tN = p100 * nado * 10 / 60, tB = bici / kmh * 60, tC = riegel(b.min, b.km, corre) * 1.06;
        est = tN + tB + tC + trans;
        o.base = `Suma aproximada: natación a ${Math.floor(p100 / 60)}:${String(Math.round(p100 % 60)).padStart(2, '0')}/100 m, bici a ${dec(kmh)} km/h, ${corre} km corriendo tras la bici y transiciones.`;
        if (o.meta_min) { const resto = o.meta_min - tN - tC - trans; if (resto > 0) o.notas.push(`Con tu natación (${hm(tN)}) y tu carrera (${hm(tC)}) actuales más ${trans} min de transiciones, necesitas la bici a ${dec(bici / (resto / 60))} km/h de media. Ahora vas a ${dec(kmh)} km/h en exterior.`); }
      } else o.base = 'Faltan datos recientes de natación, bici en exterior o carrera para estimarlo.';
      o.notas.push(`Distancia ${o.distancia === 'sprint' ? 'sprint' : 'olímpica'}: ${String(nado).replace('.', ',')} km nadando, ${bici} km en bici y ${corre} km corriendo.`);
    }
    o.estimacion_min = est;
    o.estimacion = est ? hm(est) : '—';
    if (est && o.meta_min) {
      o.diferencia_min = est - o.meta_min;
      const pct = o.diferencia_min / o.meta_min * 100;
      o.estado = pct <= 2 ? 'en camino' : pct <= 10 ? 'alcanzable' : 'exigente';
    } else { o.diferencia_min = null; o.estado = o.meta_min ? 'sin datos' : 'fija una meta'; }
    return o;
  }

  // ---------------------------------------------- objetivos no competitivos
  const COMPETICION = ['carrera', 'hyrox', 'triatlon'];
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const kg = (x) => `${dec(x, 1).replace(',0', '')} kg`;
  // pendiente (unidades por día) de una regresión lineal sobre [{d, v}]
  function tendencia(pts) {
    if (pts.length < 2) return null;
    const xs = pts.map((p) => p.d / DIA), ys = pts.map((p) => p.v);
    const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
    const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    return den ? xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / den : null;
  }
  const semanasHasta = (o, hoy) => (o.dia ? Math.max(0, (parse(o.dia) - hoy) / DIA / 7) : null);
  const estadoPorRitmo = (necesario, real) => {
    if (necesario <= 0) return 'en camino';
    if (real == null) return 'en marcha';
    const r = real / necesario;
    return r >= 0.95 ? 'en camino' : r >= 0.7 ? 'alcanzable' : 'exigente';
  };

  function estimarObjetivo(o0, ctx) {
    const {acts, hoy, perfil, sesiones, ctl} = ctx;
    if (COMPETICION.includes(o0.tipo)) {
      const o = estimar(o0, acts, hoy);
      o.competicion = true;
      const diff = o.diferencia_min == null ? '—' : `${o.diferencia_min > 0 ? '+' : '−'}${dec(Math.abs(o.diferencia_min))} min`;
      o.nums = [['Meta', o.meta], ['Nivel actual', o.estimacion], ['Diferencia', diff]];
      o.progreso = o.estimacion_min && o.meta_min ? clamp01(o.meta_min / o.estimacion_min) : null;
      return o;
    }
    const o = {...o0, notas: [], competicion: false};
    o.fecha_txt = o.dia ? (o.fecha_txt || fechaTxt(parse(o.dia))) : 'Sin fecha límite';
    const sem = semanasHasta(o, hoy);

    if (o.tipo === 'peso') {
      const pesos = (perfil.pesos || []).map((p) => ({d: parse(p.dia), v: +p.kg})).sort((a, b) => a.d - b.d);
      const ini = +o.peso_inicial || (pesos[0] && pesos[0].v);
      const act = pesos.length ? pesos[pesos.length - 1].v : ini;
      const meta = +o.peso_objetivo;
      const falta = act - meta;  // positivo si hay que bajar
      o.nums = [['Meta', kg(meta)], ['Ahora', kg(act)], [falta >= 0 ? 'Te faltan' : 'Te sobran', kg(Math.abs(falta))]];
      o.progreso = ini !== meta ? clamp01((ini - act) / (ini - meta)) : 1;
      const recientes = pesos.filter((p) => p.d >= addDays(hoy, -35));
      const pend = tendencia(recientes);  // kg/día
      const necesario = sem ? Math.abs(falta) / sem : null;  // kg/semana
      const realSem = pend == null ? null : -Math.sign(falta) * pend * 7;  // kg/semana en la buena dirección
      o.estado = Math.abs(falta) < 0.3 ? 'conseguido' : necesario == null ? (realSem > 0 ? 'en camino' : 'en marcha') : estadoPorRitmo(necesario, realSem);
      o.base = pend == null
        ? 'Registra tu peso 1–2 veces por semana (mismo día y hora, en ayunas) para ver tu ritmo.'
        : `Tu tendencia de las últimas semanas: ${pend * 7 <= 0 ? '−' : '+'}${dec(Math.abs(pend * 7), 2)} kg/semana.`;
      if (necesario != null && Math.abs(falta) >= 0.3) {
        o.notas.push(`Necesitas ${dec(necesario, 2)} kg/semana para llegar a tiempo.`);
        if (falta > 0 && necesario > act * 0.01) o.notas.push('Es un ritmo muy agresivo (más del 1 % de tu peso por semana): plantéate alargar la fecha para no perder músculo.');
      }
      if (falta > 0) o.notas.push('El plan prioriza fuerza 2–3 días para conservar músculo y cardio suave para gastar más. Lo que más pesa es la alimentación: un déficit moderado (unas 300–500 kcal al día) suele bastar. Si tienes dudas, consulta con un nutricionista.');
      o.foco = falta > 0 ? 'peso' : 'fuerza';
    } else if (o.tipo === 'fuerza') {
      const buscar = (o.ejercicio || '').toLowerCase();
      const nombre = Object.keys(sesiones).find((e) => e.toLowerCase() === buscar) || Object.keys(sesiones).find((e) => e.toLowerCase().includes(buscar));
      const pts = nombre ? Object.entries(sesiones[nombre]).map(([k, v]) => ({d: parse(k), v})).sort((a, b) => a.d - b.d) : [];
      const ult = pts.filter((p) => p.d >= addDays(hoy, -45));
      const act = ult.length ? Math.max(...ult.map((p) => p.v)) : (pts.length ? pts[pts.length - 1].v : null);
      const meta = +o.rm_objetivo;
      o.ejercicio_dato = nombre || o.ejercicio;
      o.rm_actual = act;
      o.nums = [['Meta 1RM', kg(meta)], ['Ahora', act ? kg(act) : '—'], ['Te faltan', act ? kg(Math.max(0, meta - act)) : '—']];
      o.progreso = act ? clamp01(act / meta) : null;
      const pend = tendencia(pts.filter((p) => p.d >= addDays(hoy, -120)));
      const necesario = sem && act ? Math.max(0, meta - act) / sem : null;
      o.estado = act && act >= meta ? 'conseguido' : !act ? 'sin datos' : necesario == null ? 'en marcha' : estadoPorRitmo(necesario, pend == null ? null : pend * 7);
      o.base = !nombre ? `Aún no hay series de «${o.ejercicio}». Llegan desde Hevy (vía Strava) o pegándolas al añadir un entreno de fuerza.`
        : `Mejor serie de los últimos 45 días convertida a 1RM (fórmula de Epley)${pend != null ? `; tendencia ${pend * 30 >= 0 ? '+' : '−'}${dec(Math.abs(pend * 30))} kg/mes` : ''}.`;
      if (necesario != null && act < meta) o.notas.push(`Necesitas ganar unos ${dec(necesario * 4.3)} kg de 1RM al mes.`);
      o.notas.push(`El plan incluye ${o.ejercicio} 2 veces por semana: una pesada (series de 3–5) y otra de volumen (series de 6–8).`);
      o.foco = 'fuerza';
    } else if (o.tipo === 'forma') {
      const objDias = +o.dias_semana || 4;
      const dias = new Set(acts.filter((a) => a.d > addDays(hoy, -28)).map((a) => iso(a.d))).size / 4;
      const fObj = +o.forma_objetivo || null;
      o.nums = [['Días/semana', `${objDias}`], ['Ahora', dec(dias)], fObj ? ['Forma', `${Math.round(ctl)} / ${fObj}`] : ['Forma', `${Math.round(ctl)}`]];
      const pDias = clamp01(dias / objDias), pForma = fObj ? clamp01(ctl / fObj) : null;
      o.progreso = pForma == null ? pDias : (pDias + pForma) / 2;
      o.estado = o.progreso >= 0.95 ? 'en camino' : o.progreso >= 0.7 ? 'alcanzable' : 'exigente';
      o.base = `Media de días con entreno en las últimas 4 semanas: ${dec(dias)} de ${objDias}.${fObj ? ` Forma actual ${Math.round(ctl)}, objetivo ${fObj}.` : ''}`;
      if (fObj && ctl < fObj && sem) o.notas.push(`Para llegar a ${fObj} de forma necesitas subir unos ${dec((fObj - ctl) / sem)} puntos por semana; más de 3–5 por semana es arriesgado.`);
      o.foco = 'forma';
    } else if (o.tipo === 'volumen') {
      const sp = o.deporte || 'run';
      const desde = parse(o.desde || o.creado || iso(addDays(hoy, -1)));
      const hecho = acts.filter((a) => a.sport === sp && a.d >= desde).reduce((s, a) => s + a.km, 0);
      const meta = +o.km_objetivo;
      const ult4 = acts.filter((a) => a.sport === sp && a.d > addDays(hoy, -28)).reduce((s, a) => s + a.km, 0) / 4;
      o.nums = [['Meta', `${dec(meta, 0)} km`], ['Llevas', `${dec(hecho, 0)} km`], ['Te faltan', `${dec(Math.max(0, meta - hecho), 0)} km`]];
      o.progreso = clamp01(hecho / meta);
      const necesario = sem ? Math.max(0, meta - hecho) / sem : null;
      o.km_semana_necesarios = necesario;
      o.estado = hecho >= meta ? 'conseguido' : necesario == null ? 'en marcha' : estadoPorRitmo(necesario, ult4);
      o.base = `Desde el ${fechaTxt(desde)} en ${ETIQUETA[sp].toLowerCase()}. Últimas 4 semanas: ${dec(ult4)} km/semana.`;
      if (necesario != null && hecho < meta) o.notas.push(`Necesitas ${dec(necesario)} km por semana hasta la fecha.`);
      o.foco = sp === 'run' ? 'base' : 'forma';
    } else {
      o.nums = null; o.progreso = null; o.estado = 'en marcha';
      o.base = o.nota || 'Objetivo personal.';
      o.foco = o.enfoque || 'forma';
    }
    return o;
  }

  function planKm(acts, objetivos, hoy) {
    const real = new Map();
    acts.filter((a) => a.sport === 'run').forEach((a) => { const k = iso(lunes(a.d)); real.set(k, (real.get(k) || 0) + a.km); });
    const carrera = objetivos.filter((o) => o.tipo === 'carrera' && parse(o.dia) > hoy).sort((a, b) => (a.dia < b.dia ? -1 : 1));
    const l0 = lunes(hoy);
    const fin = carrera.length ? lunes(parse(carrera[0].dia)) : addDays(l0, 84);
    const dist = carrera.length ? +carrera[0].distancia_km : 10;
    const pico = dist <= 10 ? 35 : dist <= 21.1 ? 45 : 60;
    let ult4 = 0; for (let i = 1; i <= 4; i++) ult4 += real.get(iso(addDays(l0, -7 * i))) || 0;
    const inicio = Math.max(10, Math.round(ult4 / 4));
    const otros = new Set(objetivos.filter((o) => (o.tipo === 'hyrox' || o.tipo === 'triatlon') && parse(o.dia) < fin).map((o) => iso(lunes(parse(o.dia)))));
    const semanasPlan = Math.max(1, Math.round((fin - l0) / DIA / 7));
    const construir = Math.max(1, semanasPlan - 2);
    const out = [];
    for (let w = addDays(l0, -7 * 25); w <= fin; w = addDays(w, 7)) {
      let p = null;
      if (w >= l0) {
        const k = Math.round((w - l0) / DIA / 7);
        if (k < construir) { p = inicio + (pico - inicio) * k / Math.max(1, construir - 1); if (k % 4 === 3) p *= 0.8; }
        else p = pico * (k === construir ? 0.75 : 0.5);
        if (otros.has(iso(w))) p *= 0.6;
      }
      out.push({semana: iso(w), km_real: w <= hoy ? (real.get(iso(w)) || 0) : null, km_plan: p == null ? null : Math.round(p), descarga: p != null && w >= l0 && Math.round((w - l0) / DIA / 7) % 4 === 3});
    }
    return out;
  }

  const TEXTO = {
    base: ['Base aeróbica', 'Rodajes suaves en Z2, una sesión de series cortas y una tirada larga que crece poco a poco. Fuerza dos veces por semana.'],
    carrera: ['Específico: {n}', 'Tempo a ritmo objetivo en bloques cada vez más largos y tirada larga con los últimos km a ritmo. Sube el volumen sin pasar de un 10 % por semana.'],
    hyrox: ['Específico: {n}', 'Carrera "comprometida": 1 km fuerte y una estación justo después (sled, wall balls, lunges). Simulación completa cada 3–4 semanas.'],
    triatlon: ['Específico: {n}', 'Natación 2–3 veces por semana, bici en exterior 2 veces (una larga) y sesiones combinadas de bici y carrera.'],
    afinar: ['Afinar y competir: {n}', 'Baja el volumen un 40 %, mantén algo de intensidad y descansa los 2 días previos.'],
  };
  function planFases(objetivos, hoy) {
    const fases = [];
    let ini = addDays(hoy, (8 - hoy.getUTCDay()) % 7);
    if (ini < hoy) ini = hoy;
    const fut = objetivos.filter((o) => o.competicion && parse(o.dia) > hoy).sort((a, b) => (a.dia < b.dia ? -1 : 1));
    const otros = objetivos.filter((o) => !o.competicion && (!o.dia || parse(o.dia) > hoy) && o.estado !== 'conseguido');
    const FOCO = {
      peso: ['Fuerza y cardio para perder peso', 'Fuerza 2–3 días para conservar músculo, cardio suave en Z2 que vaya alargándose y una sesión corta de intervalos. Camina a diario.'],
      fuerza: ['Bloque de fuerza', 'Fuerza 3 días con progresión de cargas (sube un poco cada semana mientras mantengas la técnica), cardio suave para la recuperación.'],
      forma: ['Ponerte en forma', 'Constancia por encima de todo: cardio suave, fuerza 2 días y una sesión algo más intensa. Sube la carga poco a poco.'],
      base: ['Base aeróbica', TEXTO.base[1]],
    };
    fut.forEach((o, n) => {
      const dia = parse(o.dia);
      const esp = addDays(dia, -7 * (n === 0 ? 10 : 5));
      if (n === 0 && (esp - ini) / DIA >= 21) { fases.push({tipo: 'base', desde: iso(ini), hasta: iso(addDays(esp, -1)), titulo: TEXTO.base[0], texto: TEXTO.base[1]}); ini = esp; }
      const afinar = addDays(dia, -6);
      if ((afinar - ini) / DIA >= 7) fases.push({tipo: o.tipo, objetivo: o.id, desde: iso(ini), hasta: iso(addDays(afinar, -1)), titulo: TEXTO[o.tipo][0].replace('{n}', o.objetivo), texto: TEXTO[o.tipo][1]});
      fases.push({tipo: 'afinar', objetivo: o.id, desde: iso(afinar > ini ? afinar : ini), hasta: iso(dia), titulo: TEXTO.afinar[0].replace('{n}', o.objetivo), texto: TEXTO.afinar[1]});
      ini = addDays(dia, 2);
    });
    if (!fut.length) {
      const p = otros.slice().sort((a, b) => ((a.dia || '9999') < (b.dia || '9999') ? -1 : 1))[0];
      const fin = p && p.dia ? parse(p.dia) : addDays(hoy, 84);
      if (p) { const [t, x] = FOCO[p.foco] || FOCO.forma; fases.push({tipo: p.foco || 'forma', objetivo: p.id, desde: iso(hoy), hasta: iso(fin), titulo: `${t}: ${p.objetivo}`, texto: x}); }
      else fases.push({tipo: 'base', desde: iso(hoy), hasta: iso(fin), titulo: 'Mantener y mejorar la base', texto: 'Sin objetivos a la vista: constancia, rodajes suaves, algo de intensidad y fuerza. Añade un objetivo en tu perfil para un plan a medida.'});
    }
    // los objetivos no competitivos se trabajan a la vez que las fases
    if (otros.length) fases.forEach((f) => { const p = otros.filter((o) => o.id !== f.objetivo).map((o) => o.objetivo); if (p.length) f.paralelo = `A la vez: ${p.join(', ')}.`; });
    fases.forEach((f) => { const a = parse(f.desde), b = parse(f.hasta); f.cuando = `${a.getUTCDate()} ${MES[a.getUTCMonth()]} – ${b.getUTCDate()} ${MES[b.getUTCMonth()]} ${b.getUTCFullYear()}`; });
    return fases;
  }

  window.AN = {analizar, seriesHevy, deporte, ETIQUETA, ORDEN, MES, iso, parse, addDays, lunes, hoyUTC, fechaTxt, hm, ritmo, riegel, DIA, COMPETICION};
})();

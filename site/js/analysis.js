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
      const objetivos = (perfil.objetivos || []).map((o) => estimar(o, [], hoy));
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

    const objetivos = (perfil.objetivos || []).map((o) => estimar(o, acts, hoy));
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
    const otros = new Set(objetivos.filter((o) => o.tipo !== 'carrera' && parse(o.dia) < fin).map((o) => iso(lunes(parse(o.dia)))));
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
    const fut = objetivos.filter((o) => parse(o.dia) > hoy).sort((a, b) => (a.dia < b.dia ? -1 : 1));
    fut.forEach((o, n) => {
      const dia = parse(o.dia);
      const esp = addDays(dia, -7 * (n === 0 ? 10 : 5));
      if (n === 0 && (esp - ini) / DIA >= 21) { fases.push({tipo: 'base', desde: iso(ini), hasta: iso(addDays(esp, -1)), titulo: TEXTO.base[0], texto: TEXTO.base[1]}); ini = esp; }
      const afinar = addDays(dia, -6);
      if ((afinar - ini) / DIA >= 7) fases.push({tipo: o.tipo, objetivo: o.id, desde: iso(ini), hasta: iso(addDays(afinar, -1)), titulo: TEXTO[o.tipo][0].replace('{n}', o.objetivo), texto: TEXTO[o.tipo][1]});
      fases.push({tipo: 'afinar', objetivo: o.id, desde: iso(afinar > ini ? afinar : ini), hasta: iso(dia), titulo: TEXTO.afinar[0].replace('{n}', o.objetivo), texto: TEXTO.afinar[1]});
      ini = addDays(dia, 2);
    });
    if (!fut.length) fases.push({tipo: 'base', desde: iso(hoy), hasta: iso(addDays(hoy, 84)), titulo: 'Mantener y mejorar la base', texto: 'Sin objetivos a la vista: constancia, rodajes suaves, algo de intensidad y fuerza. Añade un objetivo en tu perfil para un plan a medida.'});
    fases.forEach((f) => { const a = parse(f.desde), b = parse(f.hasta); f.cuando = `${a.getUTCDate()} ${MES[a.getUTCMonth()]} – ${b.getUTCDate()} ${MES[b.getUTCMonth()]} ${b.getUTCFullYear()}`; });
    return fases;
  }

  window.AN = {analizar, seriesHevy, deporte, ETIQUETA, ORDEN, MES, iso, parse, addDays, lunes, hoyUTC, fechaTxt, hm, ritmo, riegel, DIA};
})();

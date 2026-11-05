/* Propuesta de entrenos de una semana según objetivos, fase, estado de forma y días disponibles. */
(() => {
  const {iso, parse, addDays, ritmo} = window.AN;
  const NOMBRE_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  function proponer(R, perfil, semanaIso, disponibles, minutosDia) {
    const w0 = parse(semanaIso);
    const fin = addDays(w0, 6);
    const objetivos = (R ? R.objetivos : []) || [];
    const fases = R ? R.fases : [];
    const fase = fases.find((f) => f.desde <= iso(fin) && f.hasta >= semanaIso) || {tipo: 'base', titulo: 'Base aeróbica'};
    const futuros = objetivos.filter((o) => o.competicion && o.dia >= semanaIso);
    const tieneTri = futuros.some((o) => o.tipo === 'triatlon');
    const tieneHyrox = futuros.some((o) => o.tipo === 'hyrox');
    const carrera = futuros.find((o) => o.tipo === 'carrera');
    const competicion = objetivos.find((o) => o.competicion && o.dia >= semanaIso && o.dia <= iso(fin));
    // objetivos sin competición que siguen activos (peso, fuerza, forma, volumen, otros)
    const otros = objetivos.filter((o) => !o.competicion && o.estado !== 'conseguido' && (!o.dia || o.dia >= semanaIso));
    const pesoObj = otros.find((o) => o.foco === 'peso');
    const fuerzaObjs = otros.filter((o) => o.tipo === 'fuerza');
    const formaObj = otros.find((o) => o.tipo === 'forma');
    const volObj = otros.find((o) => o.tipo === 'volumen');
    const cardio = (R && R.cardioPref) || 'run';

    // ritmos
    const r10 = (R && R.ritmo10k) || 6.0;
    const z = {suave: r10 + 1.1, largo: r10 + 1.0, tempo: carrera && carrera.ritmo_meta ? carrera.ritmo_meta : r10 + 0.25, series: r10 - 0.1, hyrox: r10 + 0.5};
    const rz = (p) => `${ritmo(p)}/km`;
    const rango = (p) => `${ritmo(p - 0.1)}–${ritmo(p + 0.1)}/km`;

    // volumen de carrera de la semana
    const plan = R ? R.kmSemana.find((s) => s.semana === semanaIso) : null;
    let km = plan && plan.km_plan != null ? plan.km_plan : 20;
    const notas = [];
    if (volObj && volObj.deporte === 'run' && volObj.km_semana_necesarios) km = Math.max(km, Math.round(volObj.km_semana_necesarios));
    let factor = 1;
    if (R && R.estado.frescura < -25) { factor = 0.8; notas.push(`Vienes muy cargado (frescura ${R.estado.frescura}): bajo el volumen un 20 % y quito intensidad.`); }
    if (plan && plan.descarga) notas.push('Semana de descarga: menos volumen para asimilar lo entrenado.');
    km *= factor;

    const capLargo = carrera ? (carrera.distancia_km <= 10 ? 14 : carrera.distancia_km <= 21.1 ? 20 : 32) : tieneHyrox ? 16 : 15;
    // la tirada larga no baja de lo que ya has hecho hace poco (sin pasar del tope del objetivo)
    const reciente = R && R.largo8 ? Math.round(R.largo8 * 0.9) : 0;
    const largoKm = Math.max(6, Math.min(capLargo, Math.max(Math.round(km * 0.33), reciente)));
    const dur = (kms, p) => Math.round(kms * p + 10);

    const S = {
      largo: () => ({sport: 'run', dura: true, larga: true, titulo: 'Tirada larga', km: largoKm, min: dur(largoKm, z.largo),
        detalle: fase.tipo === 'carrera' ? `${largoKm} km suaves (${rango(z.largo)}); los últimos ${Math.min(5, Math.round(largoKm / 4))} km a ritmo objetivo (${rz(z.tempo)}).` : `${largoKm} km a ritmo cómodo (${rango(z.largo)}), pudiendo hablar.`}),
      series: () => ({sport: 'run', dura: true, titulo: 'Series', km: 8, min: 55,
        detalle: `15 min de calentamiento, ${fase.tipo === 'base' ? '8 × 400 m' : '5 × 1 km'} a ${rz(z.series)} con 2 min de trote suave entre series, y 10 min de vuelta a la calma.`}),
      tempo: () => ({sport: 'run', dura: true, titulo: 'Tempo a ritmo objetivo', km: 10, min: 60,
        detalle: `15 min suaves, 2 × 15–20 min a ${rz(z.tempo)} con 3 min suaves entre medias, y 10 min de vuelta a la calma.`}),
      suave: (n = 1) => { const k = Math.max(6, Math.min(10, Math.round(km * 0.2))); return {sport: 'run', titulo: n > 1 ? 'Rodaje suave (2)' : 'Rodaje suave', km: k, min: dur(k, z.suave), detalle: `${k} km en Z2 (${rango(z.suave)}). Tiene que parecerte fácil.`}; },
      fuerza: (n = 1) => ({sport: 'strength', titulo: n > 1 ? 'Fuerza: tren superior y core' : 'Fuerza: pierna y core', min: 55,
        detalle: n > 1 ? 'Press, remo, dominadas o jalón y core. 3–4 series de 6–10 repeticiones.' : 'Sentadilla, peso muerto o hip thrust, zancadas y core. 3–4 series de 5–8 repeticiones, sin llegar al fallo.'}),
      hyrox: () => ({sport: 'hyrox', dura: true, titulo: 'HYROX: carrera comprometida', min: 60,
        detalle: `5 × (1 km a ${rz(z.hyrox)} + una estación: sled push, burpee broad jumps, remo, wall balls o lunges). Descansa 2 min entre bloques.`}),
      simulacro: () => ({sport: 'hyrox', dura: true, larga: true, titulo: 'Simulacro HYROX', min: 80,
        detalle: 'Media simulación: 4 × (1 km + estación) a ritmo de carrera, apuntando tiempos de cada estación y de las transiciones.'}),
      nado: (n = 1) => ({sport: 'swim', titulo: n > 1 ? 'Natación: series' : 'Natación técnica', min: 45,
        detalle: n > 1 ? '300 m de calentamiento, 10 × 100 m a ritmo fuerte con 20 s de descanso y 200 m suaves.' : '1.500–2.000 m: ejercicios de técnica, respiración bilateral y 4 × 200 m cómodos.'}),
      biciLarga: () => ({sport: 'bike', dura: true, larga: true, titulo: 'Bici larga en exterior', min: 150, detalle: '2–3 h en Z2 con 3 × 10 min a ritmo de competición. Practica comer y beber en marcha.'}),
      combinado: () => ({sport: 'bike', dura: true, titulo: 'Combinado bici + carrera', min: 85, detalle: '60 min de bici con los últimos 15 a ritmo de competición y, sin parar, 15–20 min de carrera a ritmo de 10K.'}),
      activacion: () => ({sport: 'run', titulo: 'Activación', km: 5, min: 35, detalle: `20 min suaves + 4 × 1 min a ritmo de competición y 4 rectas progresivas.`}),
      movilidad: () => ({sport: 'other', titulo: 'Movilidad y estiramientos', min: 25, detalle: '20–30 min de movilidad de cadera, tobillos y espalda. Recuperación activa.'}),
      // sesiones para objetivos de salud, peso y fuerza
      cardioZ2: (larga, n = 1) => {
        const t = larga ? 75 : 45;
        const txt = {run: larga ? `Rodaje largo y suave (${rango(z.largo)})` : `Rodaje suave en Z2 (${rango(z.suave)})`, bike: 'Bici en Z2, cadencia cómoda', swim: 'Natación continua a ritmo cómodo', walk: 'Caminata rápida, a ritmo de no poder cantar'}[cardio];
        return {sport: cardio, larga: !!larga, dura: !!larga, titulo: larga ? 'Cardio largo suave' : n > 1 ? 'Cardio suave (2)' : 'Cardio suave', min: t,
          detalle: `${t} min. ${txt}. Debes poder mantener una conversación.${pesoObj ? ' Es la sesión que más grasa quema sin fatigarte.' : ''}`};
      },
      hiit: () => ({sport: 'hyrox', dura: true, titulo: 'Intervalos (HIIT)', min: 30,
        detalle: '10 min de calentamiento y 10 × (40 s fuerte / 20 s suave) en bici, remo, burpees o kettlebell swings. 5 min de vuelta a la calma.'}),
      fuerzaTotal: (n = 1) => ({sport: 'strength', titulo: n > 1 ? 'Fuerza cuerpo completo (B)' : 'Fuerza cuerpo completo (A)', min: 55,
        detalle: n > 1 ? 'Peso muerto o hip thrust, press de hombros, jalón o dominadas, zancadas y core. 3 series de 8–10.' : 'Sentadilla, press de banca, remo, puente de glúteo y plancha. 3–4 series de 6–10, dejando 1–2 repeticiones en recámara.'}),
      fuerzaObjetivo: (o, pesada) => {
        const rm = o.rm_actual;
        const carga = (p) => (rm ? ` (~${String(Math.round(rm * p / 2.5) * 2.5).replace('.', ',')} kg)` : '');
        return {sport: 'strength', dura: pesada, titulo: `Fuerza: ${o.ejercicio}${pesada ? ' pesado' : ' volumen'}`, min: 60,
          detalle: pesada
            ? `${o.ejercicio}: calentamiento progresivo y 5 × 3–5 al 80–85 %${carga(0.825)}, descansando 3 min. Después, 2–3 accesorios del mismo grupo muscular.`
            : `${o.ejercicio}: 4 × 6–8 al 70–75 %${carga(0.725)}, descansando 2 min, con técnica perfecta. Después, accesorios y core.`};
      },
    };

    let prioridad;
    if (competicion) prioridad = [S.activacion, S.suave, S.movilidad, S.fuerza, S.suave, S.movilidad, S.movilidad];
    else if (fase.tipo === 'carrera') prioridad = [S.largo, S.tempo, S.fuerza, S.suave, S.series, tieneTri ? S.nado : () => S.suave(2), S.movilidad];
    else if (fase.tipo === 'hyrox') prioridad = [S.hyrox, S.largo, S.fuerza, S.series, () => (Math.round((w0 - parse(fase.desde)) / 6048e5) % 3 === 2 ? S.simulacro() : S.hyrox()), S.suave, () => S.fuerza(2)];
    else if (fase.tipo === 'triatlon') prioridad = [S.biciLarga, S.nado, S.series, S.combinado, () => S.nado(2), S.fuerza, S.suave];
    else if (fase.tipo === 'peso') prioridad = [() => S.fuerzaTotal(1), () => S.cardioZ2(false), S.hiit, () => S.fuerzaTotal(2), () => S.cardioZ2(true), () => S.cardioZ2(false, 2), S.movilidad];
    else if (fase.tipo === 'fuerza') prioridad = [() => S.fuerzaTotal(1), () => S.cardioZ2(false), () => S.fuerzaTotal(2), S.hiit, () => S.cardioZ2(true), S.movilidad, () => S.cardioZ2(false, 2)];
    else if (fase.tipo === 'forma') prioridad = [() => S.cardioZ2(false), () => S.fuerzaTotal(1), cardio === 'run' ? S.series : S.hiit, () => S.fuerzaTotal(2), () => S.cardioZ2(true), S.movilidad, () => S.cardioZ2(false, 2)];
    else prioridad = [S.largo, S.series, S.fuerza, S.suave, tieneHyrox ? S.hyrox : () => S.fuerza(2), tieneTri ? S.nado : () => S.suave(2), S.movilidad];

    // los objetivos no competitivos añaden lo que necesitan a la semana
    if (!competicion) {
      const meter = (pos, f) => { prioridad.splice(Math.min(pos, prioridad.length), 0, f); };
      // fuerza: el ejercicio objetivo sustituye a una sesión de fuerza genérica, y una segunda sesión sube en prioridad
      fuerzaObjs.slice(0, 2).forEach((o, i) => {
        const idx = prioridad.findIndex((f) => { const s = f(); return s.sport === 'strength' && !s.objetivo; });
        const pesada = () => ({...S.fuerzaObjetivo(o, true), objetivo: o.id});
        const volumen = () => ({...S.fuerzaObjetivo(o, false), objetivo: o.id});
        if (idx >= 0 && i === 0) prioridad[idx] = pesada; else meter(1 + i, pesada);
        meter(4, volumen);
      });
      if (pesoObj && !['peso', 'fuerza', 'forma'].includes(fase.tipo)) {
        // con una carrera a la vista, el peso pide más fuerza y más cardio suave, no más intensidad
        const fuerzaPronto = prioridad.slice(0, 3).some((f) => f().sport === 'strength');
        if (!fuerzaPronto) meter(2, () => S.fuerzaTotal(1));
        meter(5, () => S.cardioZ2(false, 2));
      }
    }
    const dias = [...disponibles].sort((a, b) => a - b);
    // evita sesiones repetidas de más (máx. 3 de fuerza) al recortar a los días disponibles
    const sesiones = [];
    for (const f of prioridad) {
      if (sesiones.length >= dias.length) break;
      const s = f();
      if (s.sport === 'strength' && sesiones.filter((x) => x.sport === 'strength').length >= 3) continue;
      if (sesiones.some((x) => x.titulo === s.titulo)) continue;
      sesiones.push(s);
    }
    while (sesiones.length < dias.length) sesiones.push(S.movilidad());
    if (dias.length <= 2 && !sesiones.some((s) => s.sport === 'strength') && dias.length) notas.push('Con tan pocos días, prioriza las sesiones de carrera; la fuerza puede ir en 20 min al final de una de ellas.');
    if (formaObj && dias.length < (+formaObj.dias_semana || 0)) notas.push(`Tu objetivo «${formaObj.objetivo}» pide ${formaObj.dias_semana} días por semana y esta semana marcas ${dias.length}. Si puedes, añade aunque sean 30 min otro día.`);
    if (pesoObj) notas.push(`Para «${pesoObj.objetivo}»: además de los entrenos, intenta caminar 8.000–10.000 pasos al día y cuidar la alimentación.`);
    if (volObj && volObj.km_semana_necesarios) notas.push(`Para «${volObj.objetivo}» necesitas unos ${Math.round(volObj.km_semana_necesarios)} km esta semana.`);

    // reparto: larga en fin de semana, sesiones duras separadas
    const asign = new Map();
    const libres = new Set(dias);
    const larga = sesiones.find((s) => s.larga);
    if (larga) {
      const finde = [5, 6].filter((d) => libres.has(d));
      const d = finde.length ? finde.reduce((a, b) => ((minutosDia[b] || 60) >= (minutosDia[a] || 60) ? b : a)) : dias[dias.length - 1];
      asign.set(d, larga); libres.delete(d);
    }
    const duras = sesiones.filter((s) => s.dura && s !== larga), resto = sesiones.filter((s) => !s.dura && s !== larga);
    const distDura = (d) => { let m = 7; asign.forEach((s, k) => { if (s.dura) m = Math.min(m, Math.abs(k - d)); }); return m; };
    duras.forEach((s) => {
      const d = [...libres].sort((a, b) => distDura(b) - distDura(a) || a - b)[0];
      if (d != null) { asign.set(d, s); libres.delete(d); }
    });
    resto.forEach((s) => { const d = [...libres].sort((a, b) => a - b)[0]; if (d != null) { asign.set(d, s); libres.delete(d); } });

    if (competicion) {
      const dc = (parse(competicion.dia) - w0) / 864e5;
      asign.set(dc, {sport: competicion.tipo === 'carrera' ? 'run' : competicion.tipo === 'triatlon' ? 'bike' : 'hyrox', dura: true, titulo: `Competición: ${competicion.objetivo}`, min: competicion.meta_min || 60,
        detalle: competicion.meta_min ? `Meta: ${competicion.meta}. Sal controlado y aprieta en la segunda mitad.` : 'A disfrutar.'});
      notas.push(`Semana de competición: ${competicion.objetivo}. Llega fresco.`);
    }

    // ajustar a los minutos disponibles de cada día
    const out = [];
    asign.forEach((s, d) => {
      const cap = minutosDia[d];
      const o = {...s, dia: iso(addDays(w0, d)), nombreDia: NOMBRE_DIA[d]};
      if (cap && o.min > cap && !o.titulo.startsWith('Competición')) {
        const f = cap / o.min;
        o.min = cap;
        if (o.km) o.km = Math.max(3, Math.round(o.km * f));
        o.detalle += ` (Ajustado a tus ${cap} min: acórtalo proporcionalmente.)`;
      }
      out.push(o);
    });
    out.sort((a, b) => (a.dia < b.dia ? -1 : 1));
    const kmTot = out.reduce((s, x) => s + (x.sport === 'run' && x.km ? x.km : 0), 0);
    return {semana: semanaIso, fase: fase.titulo, faseTipo: fase.tipo, sesiones: out, kmCarrera: kmTot, notas, creado: new Date().toISOString(), disponibles: dias, minutosDia};
  }

  window.PLAN = {proponer, NOMBRE_DIA};
})();

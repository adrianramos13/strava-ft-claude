/* Propuesta de entrenos de una semana según la capacidad de la persona (historial, nivel, edad, IMC), sus objetivos y sus días.
   Flujo de proponer(): contexto → catálogo de sesiones → prioridad por fase → nº de sesiones y días → selección → reparto → km → minutos.
   Umbrales y fuentes: reports/Parámetros de planes de entrenamiento.md */
(() => {
  const {iso, parse, addDays, ritmo, subidaMax} = window.AN;
  const NOMBRE_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const DEPORTE_COMP = {carrera: 'run', trail: 'run', ocr: 'run', hyrox: 'hyrox', triatlon: 'bike', duatlon: 'run', ciclismo: 'bike', aguas: 'swim'};
  // sesiones por semana recomendadas en cada fase, antes de ajustarlas al nivel de la persona
  const BASE_FASE = {base: 4, carrera: 5, trail: 5, ocr: 4, hyrox: 5, triatlon: 6, duatlon: 5, ciclismo: 4, aguas: 4, peso: 5, fuerza: 4, forma: 4, afinar: 4};
  // [mín, máx] de sesiones por semana según nivel 0–4
  const SESIONES_NIVEL = [[2, 3], [3, 4], [4, 5], [5, 6], [7, 7]];
  // sesiones de calidad (intensas) por semana según nivel: ~2 es el óptimo; 3 no mejora (Billat 1999, Seiler)
  const CALIDAD_NIVEL = [0, 1, 2, 2, 2];
  // carrera-caminata para quien no aguanta 30 min corriendo seguidos (tipo Couch to 5K, con una etapa intermedia):
  // [repeticiones, min corriendo, min andando]; se avanza una etapa por semana
  const CORRER_ANDAR = [[8, 1, 1.5], [6, 1.5, 2], [4, 2.5, 2], [4, 3, 2], [4, 4, 2], [3, 6, 2], [2, 10, 3], [1, 20, 0], [1, 25, 0], [1, 30, 0]];
  const MIN_KM_CORRIENDO = 7;  // ritmo de referencia de un principiante para estimar km

  const r1 = (x) => Math.round(x * 10) / 10;
  const rz = (p) => `${ritmo(p)}/km`;
  const rango = (p) => `${ritmo(p - 0.1)}–${ritmo(p + 0.1)}/km`;
  const dur = (kms, p) => Math.round(kms * p + 10);
  const num = (x) => String(x).replace('.', ',');
  // de varios días candidatos, el que más minutos tiene (a igualdad, el último)
  const mejorDia = (cands, minutosDia) => cands.reduce((a, b) => ((minutosDia[b] || 60) >= (minutosDia[a] || 60) ? b : a));
  // opts.futuro: semana de un plan a largo plazo (no se ajusta por el cansancio de hoy)
  const cansado = (R, opts) => !opts.futuro && R && R.estado && R.estado.frescura < -25;
  const esCarrera = (s) => s.sport === 'run' && s.km && !s.correrAndar && !s.titulo.startsWith('Competición');

  // ------------------------------------------------------------------ contexto de la semana
  function objetivosSemana(R, semanaIso) {
    const w0 = parse(semanaIso);
    const fin = addDays(w0, 6);
    const objetivos = (R ? R.objetivos : []) || [];
    const fases = R ? R.fases : [];
    const fase = fases.find((f) => f.desde <= iso(fin) && f.hasta >= semanaIso) || {tipo: 'base', titulo: 'Base aeróbica'};
    const futuros = objetivos.filter((o) => o.competicion && o.dia >= semanaIso);
    const competicion = objetivos.find((o) => o.competicion && o.dia >= semanaIso && o.dia <= iso(fin));
    // semana siguiente a una competición: recuperación (salvo que haya otra prueba esta misma semana)
    const recien = !competicion && objetivos.find((o) => o.competicion && o.dia < semanaIso && o.dia >= iso(addDays(w0, -7)));
    // objetivos sin competición que siguen activos (peso, fuerza, forma, volumen, otros)
    const otros = objetivos.filter((o) => !o.competicion && o.estado !== 'conseguido' && (!o.dia || o.dia >= semanaIso));
    // objetivo de la fase en curso (para ajustar distancias de las sesiones)
    const objFase = objetivos.find((o) => o.id === fase.objetivo) || null;
    const proxima = futuros.slice().sort((a, b) => (a.dia < b.dia ? -1 : 1))[0] || null;
    const cardio = (R && R.cardioPref) || 'run';
    return {semanaIso, w0, fase, competicion, recien, objFase, proxima,
      // sin objetivos: mismos deportes y mismo volumen, sin progresión
      mantener: fase.tipo === 'mantener',
      // el plan lleva carrera si la persona corre o si su próxima prueba es de correr
      corre: cardio === 'run' || (!!proxima && DEPORTE_COMP[proxima.tipo] === 'run'),
      carrera: futuros.find((o) => o.tipo === 'carrera'),
      tieneTri: futuros.some((o) => o.tipo === 'triatlon'),
      tieneHyrox: futuros.some((o) => o.tipo === 'hyrox'),
      pesoObj: otros.find((o) => o.foco === 'peso'),
      fuerzaObjs: otros.filter((o) => o.tipo === 'fuerza'),
      formaObj: otros.find((o) => o.tipo === 'forma'),
      volObj: otros.find((o) => o.tipo === 'volumen'),
      cardio,
      largaDist: !!objFase && objFase.tipo === 'triatlon' && ['half', 'ironman'].includes(objFase.distancia)};
  }

  // lo personal: nivel, edad, carrera más larga reciente (techo de cualquier sesión), carrera-caminata y presupuesto de calidad
  function personal(R, semanaIso, opts, mantener) {
    const cap = R.capacidad;
    // manteniendo no se avanza de etapa ni crecen las sesiones largas
    const semanaPlan = mantener ? 0 : opts.semanaPlan || 0;
    // sesión típica de cada deporte en las últimas 8 semanas: minutos y km medios y la más larga
    const habito = Object.fromEntries(Object.entries(cap.porDeporte).filter(([, p]) => p.sesiones > 0)
      .map(([sp, p]) => [sp, {sesiones: p.sesiones, min: p.min / p.sesiones, km: p.km / p.sesiones, maxMin: p.maxMin, maxKm: p.maxKm}]));
    const desde = iso(addDays(parse(semanaIso), -30));
    const largo30 = opts.largo30 != null ? opts.largo30
      : Math.max(0, ...R.acts.filter((a) => a.sport === 'run' && iso(a.d) >= desde && iso(a.d) < semanaIso).map((a) => a.km));
    // etapa de carrera-caminata: empieza en la que corresponde a lo que ya corres seguido y avanza una por semana
    const inicio = CORRER_ANDAR.findIndex(([r, c]) => r * c >= cap.correrSeguido);
    const etapa = cap.correrSeguido < 30 && inicio >= 0 && inicio + semanaPlan < CORRER_ANDAR.length ? inicio + semanaPlan : null;
    const edad = cap.edad || 0;
    return {cap, nivel: cap.nivel, edad, semanaPlan, etapa, habito,
      // sesión larga de cualquier deporte: crece un 10 % por semana desde la más larga reciente, hasta el objetivo
      progresa: (actual, objetivo) => (mantener ? actual : Math.min(objetivo, actual * 1.1 ** (semanaPlan + 1))),
      // ninguna sesión más de un 10 % por encima de la carrera más larga de los últimos 30 días (Frandsen 2025)
      techo: Math.max(3, r1(largo30 * 1.1)),
      // sin calidad hasta correr 30 min seguidos; como mucho 1 si vienes cansado
      // manteniendo, una sesión algo más intensa a la semana basta para conservar la forma (si ya tienes base)
      presupuesto: etapa != null ? 0 : Math.min(CALIDAD_NIVEL[cap.nivel], cansado(R, opts) || mantener ? 1 : 9),
      // días mínimos entre sesiones de calidad: la recuperación es más lenta desde los 50 (Herbert 2015, Borges 2016)
      sep: edad >= 50 ? 3 : 2};
  }

  function ritmos(R, carrera) {
    const r10 = (R && R.ritmo10k) || 6.0;
    return {suave: r10 + 1.1, largo: r10 + 1.0, tempo: carrera && carrera.ritmo_meta ? carrera.ritmo_meta : r10 + 0.25, series: r10 - 0.1, hyrox: r10 + 0.5};
  }

  // km de carrera de la semana: los del plan, sin subir más de lo que permite el nivel, ajustados por cansancio y recuperación
  function volumenSemana(R, c, opts) {
    if (c.mantener) {
      const km = (c.cap.porDeporte.run || {km: 0}).km;
      return {plan: null, maxPlan: km, km, notasVolumen: ['Sin objetivos: mantengo tus deportes y tu volumen actuales, sin subir la carga. Añade un objetivo en tu perfil si quieres progresar.']};
    }
    const plan = R.kmSemana.find((s) => s.semana === c.semanaIso);
    // fuera del horizonte del plan de km (después de la carrera principal) se mantiene un volumen de carrera moderado
    const maxPlan = Math.max(0, ...R.kmSemana.map((s) => s.km_plan || 0));
    let km = plan && plan.km_plan != null ? plan.km_plan : (maxPlan ? Math.round(maxPlan * 0.6) : 20);
    const notas = [];
    if (c.volObj && c.volObj.deporte === 'run' && c.volObj.km_semana_necesarios) km = Math.max(km, Math.round(c.volObj.km_semana_necesarios));
    const previo = opts.kmPrevio != null ? opts.kmPrevio : (c.cap.porDeporte.run || {km: 0}).km;
    km = Math.min(km, subidaMax(previo, c.nivel));
    let factor = 1;
    if (cansado(R, opts)) { factor = 0.8; notas.push(`Vienes muy cargado (frescura ${R.estado.frescura}): bajo el volumen un 20 % y quito intensidad.`); }
    if (plan && plan.descarga && !c.competicion && !c.recien) notas.push('Semana de descarga: menos volumen para asimilar lo entrenado.');
    if (c.recien) { factor = 0.5; notas.push(`Semana de recuperación tras ${c.recien.objetivo}: todo suave y corto. Vuelve a apretar solo si las piernas responden.`); }
    return {plan, maxPlan, km: r1(km * factor), notasVolumen: notas};
  }

  // progreso del plan (0 → 1) y km de la tirada larga
  function largoYProgreso(R, c, km, maxPlan) {
    const base = c.carrera ? (c.carrera.distancia_km <= 10 ? 14 : c.carrera.distancia_km <= 21.1 ? 20 : 32) : c.tieneHyrox ? 16 : 15;
    // a mucho volumen, la larga es ~25 % de la semana (Knopp 2024)
    const capLargo = Math.max(base, Math.round(km * 0.25));
    const reciente = R.largo8 ? Math.round(R.largo8 * 0.9) : 0;
    const kmIni = (R.kmSemana.find((s) => s.km_plan != null) || {}).km_plan || km;
    const progreso = maxPlan > kmIni ? Math.max(0, Math.min(1, (km - kmIni) / (maxPlan - kmIni))) : 0;
    const baseLargo = Math.min(capLargo, Math.max(Math.round(km * 0.33), reciente));
    return {progreso, largoKm: Math.min(c.techo, Math.max(3, Math.round(baseLargo + (capLargo - baseLargo) * progreso)))};
  }

  function contexto(R, semanaIso, opts) {
    const o = objetivosSemana(R, semanaIso);
    const c = {...o, ...personal(R, semanaIso, opts, o.mantener)};
    const v = volumenSemana(R, c, opts);
    return {...c, ...v, ...largoYProgreso(R, c, v.km, v.maxPlan), z: ritmos(R, c.carrera), diaLarga: opts.diaLarga};
  }

  // ------------------------------------------------------------------ catálogo de sesiones
  // calidad: sesión intensa (cuenta para el presupuesto y se separa de las demás) · relleno: rodaje que absorbe los km que falten
  function sesionesCarrera(c) {
    const {z, fase, objFase, progreso, largoKm, km, nivel} = c;
    return {
      largo: () => ({sport: 'run', dura: true, larga: true, titulo: 'Tirada larga', km: largoKm, min: dur(largoKm, z.largo),
        detalle: fase.tipo === 'carrera' && nivel >= 2 ? `${largoKm} km suaves (${rango(z.largo)}); los últimos ${Math.min(5, Math.round(largoKm / 4))} km a ritmo objetivo (${rz(z.tempo)}).` : `${largoKm} km a ritmo cómodo (${rango(z.largo)}), pudiendo hablar.`}),
      // las series y el tempo crecen con el progreso del plan y con el nivel
      series: () => {
        const base = fase.tipo === 'base' || nivel <= 1;
        const reps = (base ? 6 + Math.round(progreso * 4) : 4 + Math.round(progreso * 3)) - (nivel <= 1 ? 2 : 0);
        const tramo = base ? 400 : 1000;
        const k = Math.round(5 + reps * tramo / 1000 * 1.4);
        return {sport: 'run', dura: true, calidad: true, titulo: 'Series', km: k, min: Math.round(30 + reps * (base ? 3.5 : 6.5)),
          detalle: `15 min de calentamiento, ${reps} × ${tramo === 1000 ? '1 km' : '400 m'} a ${rz(z.series)} con ${base ? '90 s' : '2 min'} de trote suave entre series, y 10 min de vuelta a la calma.`};
      },
      tempo: () => {
        const bloque = (nivel <= 1 ? 8 : 10) + Math.round(progreso * 3) * 5;
        const k = Math.round(5 + (2 * bloque) / z.tempo);
        return {sport: 'run', dura: true, calidad: true, titulo: 'Tempo a ritmo objetivo', km: k, min: 30 + 2 * bloque + 3,
          detalle: `15 min suaves, 2 × ${bloque} min a ${rz(z.tempo)} con 3 min suaves entre medias, y 10 min de vuelta a la calma.`};
      },
      suave: (n = 1, kmFijo) => {
        const k = kmFijo || Math.max(3, Math.min(10, Math.round(km * 0.2)));
        return {sport: 'run', relleno: true, titulo: n > 1 ? `Rodaje suave (${n})` : 'Rodaje suave', km: k, min: dur(k, z.suave), detalle: `${num(k)} km en Z2 (${rango(z.suave)}). Tiene que parecerte fácil.`};
      },
      correrAndar: (n = 1) => {
        const [rep, corre, anda] = CORRER_ANDAR[c.etapa];
        const mc = rep * corre, ma = rep * anda + 10;
        return {sport: 'run', correrAndar: true, minCorriendo: mc, titulo: n > 1 ? `Correr y andar (${n})` : 'Correr y andar', km: r1(mc / MIN_KM_CORRIENDO), min: Math.round(mc + ma),
          detalle: rep === 1 ? `5 min andando a paso vivo, ${mc} min corriendo muy suave sin parar y 5 min andando.`
            : `5 min andando a paso vivo, ${rep} × (${num(corre)} min corriendo muy suave + ${num(anda)} min andando) y 5 min andando. Si se te hace duro, repite esta semana.`};
      },
      hyrox: () => ({sport: 'hyrox', dura: true, calidad: true, titulo: 'HYROX: carrera comprometida', min: 60,
        detalle: `5 × (1 km a ${rz(z.hyrox)} + una estación: sled push, burpee broad jumps, remo, wall balls o lunges). Descansa 2 min entre bloques.`}),
      simulacro: () => ({sport: 'hyrox', dura: true, larga: true, calidad: true, titulo: 'Simulacro HYROX', min: 80,
        detalle: 'Media simulación: 4 × (1 km + estación) a ritmo de carrera, apuntando tiempos de cada estación y de las transiciones.'}),
      cuestas: () => ({sport: 'run', dura: true, calidad: true, titulo: 'Cuestas', km: 8, min: 55, detalle: '15 min suaves, 8–10 × 60–90 s subiendo fuerte una cuesta con buena pendiente, bajando al trote, y 10 min suaves.'}),
      largoMontana: () => {
        const h = objFase && objFase.distancia_km > 30 ? '3–4 h' : '1 h 30 – 2 h 30';
        return {sport: 'run', dura: true, larga: true, titulo: 'Tirada larga por montaña', min: objFase && objFase.distancia_km > 30 ? 210 : 120,
          detalle: `${h} por senderos con desnivel, a ritmo cómodo (andando en las subidas fuertes). Practica las bajadas y el avituallamiento.`};
      },
      circuito: () => ({sport: 'hyrox', dura: true, calidad: true, titulo: 'Circuito de carrera + obstáculos', min: 50, detalle: '6 × (600 m fuerte + 10 burpees + 20 m de arrastre o transporte de peso). 2 min de descanso entre bloques.'}),
      activacion: () => ({sport: 'run', titulo: 'Activación', km: 5, min: 35, detalle: `20 min suaves + 4 × 1 min a ritmo de competición y 4 rectas progresivas.`}),
    };
  }

  // natación, bici y combinados (triatlón, duatlón, ciclismo, aguas abiertas)
  // Natación en metros a tu ritmo por 100 m y bici en tus minutos habituales (sin historial, valores de partida prudentes)
  const R100 = 150;  // 2:30/100 m si no hay historial de natación
  const cien = (m) => Math.max(400, Math.floor(m / 100) * 100);
  const por100 = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}/100 m`;
  const miles = (m) => String(m).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const cinco = (x) => Math.max(20, Math.round(x / 5) * 5);
  const horas = (min) => (min < 90 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`);

  function sesionesMulti(c) {
    const {objFase, largaDist, habito, progresa} = c;
    const sw = habito.swim, bk = habito.bike;
    const ritmo100 = sw && sw.km ? (sw.min * 60) / (sw.km * 10) : R100;
    const mHabitual = sw && sw.km ? cien(sw.km * 1000) : 1500;
    const nadar = (m, extra) => ({sport: 'swim', metros: m, min: Math.round((m / 100) * (ritmo100 + (extra || 0)) / 60 + 5)});
    const minBici = bk ? cinco(bk.min) : 75;
    return {
      nado: (n = 1) => {
        if (n > 1) {
          const reps = Math.max(6, Math.round((mHabitual - 500) / 100));
          return {...nadar(500 + reps * 100, 10), titulo: 'Natación: series',
            detalle: `300 m suaves, ${reps} × 100 m a ${por100(ritmo100 - 8)} con 20 s de descanso y 200 m suaves.`};
        }
        return {...nadar(mHabitual, 10), titulo: 'Natación técnica',
          detalle: `${miles(mHabitual)} m: 300 suaves, ejercicios de técnica y respiración bilateral, y el resto en series de 200 m cómodas (~${por100(ritmo100 + 5)}).`};
      },
      nadoSuave: (n = 1) => ({...nadar(mHabitual, 5), titulo: n > 1 ? `Nado continuo (${n})` : 'Nado continuo',
        detalle: `${miles(mHabitual)} m seguidos a ritmo cómodo (~${por100(ritmo100 + 5)}), cuidando la técnica.`}),
      biciLarga: () => {
        const objetivo = largaDist ? 210 : 150;
        const min = cinco(progresa(bk ? bk.maxMin : 90, objetivo));
        return {sport: 'bike', dura: true, larga: true, titulo: 'Bici larga en exterior', min,
          detalle: largaDist ? `${horas(min)} en Z2 con 2–3 bloques de 20 min a ritmo de competición. Practica beber y avituallarte en marcha como en la prueba.`
            : `${horas(min)} en Z2 con 3 × 10 min a ritmo de competición. Practica beber en marcha.`};
      },
      biciSeries: () => ({sport: 'bike', dura: true, calidad: true, titulo: 'Bici: intervalos', min: Math.max(60, minBici), detalle: '20 min suaves, 4–5 × 6–8 min a ritmo fuerte y constante (como subiendo un puerto) con 3 min suaves, y 10 min suaves.'}),
      biciSuave: (n = 1) => ({sport: 'bike', titulo: n > 1 ? `Bici suave (${n})` : 'Bici suave', min: minBici, detalle: `${horas(minBici)} en Z2, cadencia ágil (85–95 rpm). Debes poder hablar.`}),
      biciSubida: () => ({sport: 'bike', dura: true, calidad: true, titulo: 'Bici: subidas', min: 120, detalle: 'Ruta con subidas largas: súbelas a ritmo constante, sentado, sin cebarte al principio. Practica el desarrollo que llevarás.'}),
      dua: () => ({sport: 'run', dura: true, calidad: true, titulo: 'Combinado carrera + bici + carrera', min: 80, detalle: '15 min de carrera a ritmo de duatlón, 40 min de bici con cambios de ritmo y 10 min de carrera. Practica las transiciones.'}),
      nadoLargo: () => {
        const actual = sw ? sw.maxKm * 1000 : 1500;
        const objetivo = objFase && objFase.distancia_km ? objFase.distancia_km * 800 : actual * 1.2;
        const m = cien(progresa(actual, objetivo));
        return {...nadar(m, 5), dura: true, larga: true, titulo: 'Natación continua larga',
          detalle: `${miles(m)} m seguidos a ritmo cómodo (~${por100(ritmo100 + 5)})${objFase && objFase.tipo === 'aguas' ? ', levantando la vista cada 6–8 brazadas para practicar la orientación' : ''}.`};
      },
      combinado: () => ({sport: 'bike', dura: true, calidad: true, titulo: 'Combinado bici + carrera', min: 85, detalle: '60 min de bici con los últimos 15 a ritmo de competición y, sin parar, 15–20 min de carrera a ritmo de 10K.'}),
    };
  }

  // fuerza, movilidad y sesiones para objetivos de salud y fuerza
  function sesionesFuerzaSalud(c) {
    const {z, cardio, pesoObj, edad, habito, progresa} = c;
    const wk = habito.walk;
    const minAndar = wk ? cinco(wk.min) : 45;
    // a partir de 65 años, equilibrio al menos 3 días por semana (OMS 2020): va al final de la fuerza
    const equilibrio = edad >= 65 ? ' Termina con 10 min de equilibrio: apoyo a una pierna, marcha talón-punta y levantarte de la silla sin manos.' : '';
    return {
      fuerza: (n = 1) => ({sport: 'strength', titulo: n > 1 ? 'Fuerza: tren superior y core' : 'Fuerza: pierna y core', min: 55,
        detalle: (n > 1 ? 'Press, remo, dominadas o jalón y core. 3–4 series de 6–10 repeticiones.' : 'Sentadilla, peso muerto o hip thrust, zancadas y core. 3–4 series de 5–8 repeticiones, sin llegar al fallo.') + equilibrio}),
      agarre: () => ({sport: 'strength', titulo: 'Fuerza y agarre', min: 55, detalle: 'Dominadas o colgarse de la barra, farmer walks, remo, zancadas con peso y core. Termina con 3 × 30 s colgado.'}),
      movilidad: () => ({sport: 'other', titulo: 'Movilidad y estiramientos', min: 25, detalle: '20–30 min de movilidad de cadera, tobillos y espalda. Recuperación activa.'}),
      cardioZ2: (larga, n = 1) => {
        const h = habito[cardio];
        // tu duración habitual en ese deporte; la larga crece desde la más larga que has hecho
        const t = larga ? cinco(progresa(h ? h.maxMin : 60, 90)) : h ? cinco(h.min) : 45;
        const txt = {run: larga ? `Rodaje largo y suave (${rango(z.largo)})` : `Rodaje suave en Z2 (${rango(z.suave)})`, bike: 'Bici en Z2, cadencia cómoda', swim: 'Natación continua a ritmo cómodo', walk: 'Caminata rápida, a ritmo de no poder cantar'}[cardio] || 'Cardio suave a tu elección';
        return {sport: cardio, larga: !!larga, dura: !!larga, titulo: larga ? 'Cardio largo suave' : n > 1 ? `Cardio suave (${n})` : 'Cardio suave', min: t,
          detalle: `${t} min. ${txt}. Debes poder mantener una conversación.${pesoObj ? ' Es la sesión que más grasa quema sin fatigarte.' : ''}`};
      },
      hiit: () => ({sport: 'hyrox', dura: true, calidad: true, titulo: 'Intervalos (HIIT)', min: 30,
        detalle: '10 min de calentamiento y 10 × (40 s fuerte / 20 s suave) en bici, remo, burpees o kettlebell swings. 5 min de vuelta a la calma.'}),
      caminata: (larga, n = 1) => {
        const min = larga ? cinco(progresa(wk ? wk.maxMin : 60, 120)) : minAndar;
        return {sport: 'walk', larga: !!larga, titulo: larga ? 'Caminata larga' : n > 1 ? `Caminata (${n})` : 'Caminata', min,
          detalle: `${horas(min)} a paso vivo${larga ? ', mejor por terreno variado o con algo de desnivel' : ''}. Puedes hablar, pero no cantar.`};
      },
      caminataRitmo: () => ({sport: 'walk', dura: true, calidad: true, titulo: 'Caminata con cambios de ritmo', min: minAndar,
        detalle: `${horas(minAndar)}: 10 min suaves, 6 × (2 min lo más rápido que puedas andar o subiendo una cuesta + 2 min normal) y el resto tranquilo.`}),
      fuerzaTotal: (n = 1) => ({sport: 'strength', titulo: n > 1 ? 'Fuerza cuerpo completo (B)' : 'Fuerza cuerpo completo (A)', min: 55,
        detalle: (n > 1 ? 'Peso muerto o hip thrust, press de hombros, jalón o dominadas, zancadas y core. 3 series de 8–10.' : 'Sentadilla, press de banca, remo, puente de glúteo y plancha. 3–4 series de 6–10, dejando 1–2 repeticiones en recámara.') + equilibrio}),
      fuerzaObjetivo: (o, pesada) => {
        const rm = o.rm_actual;
        const carga = (p) => (rm ? ` (~${String(Math.round(rm * p / 2.5) * 2.5).replace('.', ',')} kg)` : '');
        return {sport: 'strength', dura: pesada, titulo: `Fuerza: ${o.ejercicio}${pesada ? ' pesado' : ' volumen'}`, min: 60,
          detalle: pesada
            ? `${o.ejercicio}: calentamiento progresivo y 5 × 3–5 al 80–85 %${carga(0.825)}, descansando 3 min. Después, 2–3 accesorios del mismo grupo muscular.`
            : `${o.ejercicio}: 4 × 6–8 al 70–75 %${carga(0.725)}, descansando 2 min, con técnica perfecta. Después, accesorios y core.`};
      },
    };
  }

  function catalogo(c) {
    const S = {...sesionesCarrera(c), ...sesionesMulti(c), ...sesionesFuerzaSalud(c)};
    // la sesión intensa se hace en tu deporte; el HIIT de gimnasio solo si no hay otro
    S.intensa = () => ({walk: S.caminataRitmo, swim: () => S.nado(2), bike: S.biciSeries}[c.cardio] || S.hiit)();
    // cuando el cardio es nadar o caminar, sus sesiones propias (en metros o con su progresión)
    const cardioZ2 = S.cardioZ2;
    S.cardioZ2 = (larga, n = 1) => (c.cardio === 'swim' ? (larga ? S.nadoLargo() : S.nadoSuave(n)) : c.cardio === 'walk' ? S.caminata(larga, n) : cardioZ2(larga, n));
    // activación previa a la competición en su deporte
    S.activacionDe = (deporte) => (deporte === 'bike' ? () => ({...S.biciSuave(), titulo: 'Activación en bici', min: 45, detalle: '30 min suaves con 4 × 1 min a ritmo de competición.'})
      : deporte === 'swim' ? () => ({...S.nado(1), titulo: 'Activación en el agua', metros: 1000, min: 30, detalle: '1.000 m suaves con 4 × 50 m a ritmo de prueba.'}) : S.activacion);
    return S;
  }

  // sesión suave del mismo deporte, para sustituir una de calidad que no cabe
  function facil(sport, S, sesiones) {
    const n = (pre) => sesiones.filter((x) => x.titulo.startsWith(pre)).length + 1;
    if (sport === 'run') return S.suave(n('Rodaje suave'));
    if (sport === 'bike') return S.biciSuave(n('Bici suave'));
    if (sport === 'swim') return S.nadoSuave(n('Nado continuo'));
    if (sport === 'walk') return S.caminata(false, n('Caminata'));
    return S.cardioZ2(false, n('Cardio suave'));
  }

  // ------------------------------------------------------------------ prioridad de sesiones
  // Orden de preferencia de las sesiones en cada fase: si hay menos días, se quedan las primeras.
  const PRIORIDAD_FASE = {
    carrera: (S, c) => [S.largo, S.tempo, S.fuerza, S.suave, S.series, c.tieneTri ? S.nado : () => S.suave(2), S.movilidad],
    // cada 3 semanas de la fase, la sesión HYROX se convierte en un simulacro
    hyrox: (S, c) => [S.hyrox, S.largo, S.fuerza, S.series, () => (Math.round((c.w0 - parse(c.fase.desde)) / 6048e5) % 3 === 2 ? S.simulacro() : S.hyrox()), S.suave, () => S.fuerza(2)],
    triatlon: (S) => [S.biciLarga, S.nado, S.series, S.combinado, () => S.nado(2), S.fuerza, S.suave],
    trail: (S) => [S.largoMontana, S.cuestas, S.fuerza, S.suave, S.series, () => S.suave(2), S.movilidad],
    ocr: (S) => [S.circuito, S.largo, S.agarre, S.cuestas, S.suave, S.fuerza, S.movilidad],
    duatlon: (S) => [S.dua, S.series, S.biciLarga, S.suave, S.fuerza, S.biciSuave, S.movilidad],
    ciclismo: (S) => [S.biciLarga, S.biciSeries, S.biciSuave, S.fuerza, S.biciSubida, () => S.biciSuave(2), S.movilidad],
    aguas: (S) => [() => S.nado(1), () => S.nado(2), S.nadoLargo, S.fuerza, () => S.cardioZ2(false), S.movilidad, () => S.cardioZ2(false, 2)],
    peso: (S) => [() => S.fuerzaTotal(1), () => S.cardioZ2(false), S.intensa, () => S.fuerzaTotal(2), () => S.cardioZ2(true), () => S.cardioZ2(false, 2), S.movilidad],
    fuerza: (S) => [() => S.fuerzaTotal(1), () => S.cardioZ2(false), () => S.fuerzaTotal(2), S.intensa, () => S.cardioZ2(true), S.movilidad, () => S.cardioZ2(false, 2)],
    forma: (S, c) => [() => S.cardioZ2(false), () => S.fuerzaTotal(1), c.cardio === 'run' ? S.series : S.intensa, () => S.fuerzaTotal(2), () => S.cardioZ2(true), S.movilidad, () => S.cardioZ2(false, 2)],
    mantener: (S, c) => sesionesHabituales(S, c),
  };

  // Mantener: la semana que ya haces. Cada deporte conserva sus sesiones por semana (repartidas por turnos, para que
  // con menos días no desaparezca ninguno), con una larga, una algo más intensa y el resto suaves, a tu tamaño.
  function sesionesHabituales(S, c) {
    const suaves = (f) => [2, 3, 4, 5, 6].map((n) => () => f(n));
    const VARIANTES = {
      run: [S.largo, () => S.suave(1), S.series, ...suaves(S.suave)],
      swim: [S.nadoLargo, () => S.nado(1), () => S.nado(2), () => S.nadoSuave(1), ...suaves(S.nadoSuave)],
      bike: [S.biciLarga, () => S.biciSuave(1), S.biciSeries, ...suaves(S.biciSuave)],
      walk: [() => S.caminata(true), () => S.caminata(false, 1), S.caminataRitmo, ...suaves((n) => S.caminata(false, n))],
      strength: [() => S.fuerzaTotal(1), () => S.fuerzaTotal(2)],
    };
    const deportes = Object.entries(c.habito).filter(([sp, h]) => VARIANTES[sp] && h.sesiones >= 0.5).sort((a, b) => b[1].sesiones - a[1].sesiones);
    if (!deportes.length) return [() => S.cardioZ2(false), () => S.fuerzaTotal(1), () => S.cardioZ2(false, 2), () => S.fuerzaTotal(2), S.movilidad];
    const out = [];
    for (let i = 0; i < 7; i++) {
      deportes.forEach(([sp, h]) => { if (i < Math.max(1, Math.round(h.sesiones)) && VARIANTES[sp][i]) out.push(VARIANTES[sp][i]); });
    }
    return [...out, S.movilidad];
  }
  // base, afinar, recuperación y cualquier otra fase
  const PRIORIDAD_DEFECTO = (S, c) => [S.largo, S.series, S.fuerza, S.suave, c.tieneHyrox ? S.hyrox : () => S.fuerza(2), c.tieneTri ? S.nado : () => S.suave(2), S.movilidad];

  function prioridadBase(c, S) {
    if (c.competicion) return [S.activacionDe(DEPORTE_COMP[c.competicion.tipo]), S.suave, S.movilidad, S.fuerza, S.suave, S.movilidad, S.movilidad];
    if (c.recien) {
      return [S.suave, S.movilidad, () => ({...S.fuerzaTotal(1), titulo: 'Fuerza ligera', detalle: 'Circuito suave de cuerpo completo con poco peso, sin llegar a cansarte. Solo para activar.'}),
        () => S.cardioZ2(false), () => S.suave(2), S.movilidad, () => S.cardioZ2(false, 2)];
    }
    // la base de una prueba de bici, agua o triatlón se hace en esos deportes, no corriendo
    const tipo = c.fase.tipo === 'base' && c.proxima && ['ciclismo', 'aguas', 'triatlon'].includes(c.proxima.tipo) ? c.proxima.tipo : c.fase.tipo;
    return (PRIORIDAD_FASE[tipo] || PRIORIDAD_DEFECTO)(S, c);
  }

  // los objetivos no competitivos añaden lo que necesitan a la semana
  function inyectarObjetivos(prioridad, c, S) {
    if (c.competicion) return prioridad;
    const p = [...prioridad];
    const meter = (pos, f) => { p.splice(Math.min(pos, p.length), 0, f); };
    // fuerza: el ejercicio objetivo sustituye a una sesión de fuerza genérica, y una segunda sesión sube en prioridad
    c.fuerzaObjs.slice(0, 2).forEach((o, i) => {
      const idx = p.findIndex((f) => { const s = f(); return s.sport === 'strength' && !s.objetivo; });
      const pesada = () => ({...S.fuerzaObjetivo(o, true), objetivo: o.id});
      const volumen = () => ({...S.fuerzaObjetivo(o, false), objetivo: o.id});
      if (idx >= 0 && i === 0) p[idx] = pesada; else meter(1 + i, pesada);
      meter(4, volumen);
    });
    if (c.pesoObj && !['peso', 'fuerza', 'forma'].includes(c.fase.tipo)) {
      // con una carrera a la vista, el peso pide más fuerza y más cardio suave, no más intensidad
      const fuerzaPronto = p.slice(0, 3).some((f) => f().sport === 'strength');
      if (!fuerzaPronto) meter(2, () => S.fuerzaTotal(1));
      meter(5, () => S.cardioZ2(false, 2));
    }
    return p;
  }

  // ------------------------------------------------------------------ cuántas sesiones y qué días
  // Los días marcados son el máximo, no una obligación.
  function numSesiones(R, c, nDisp, opts) {
    const [lo, hi] = SESIONES_NIVEL[c.nivel];
    // manteniendo: las sesiones que ya haces por semana
    if (c.mantener) return {n: Math.min(nDisp, Math.max(2, Math.min(7, Math.round(c.cap.sesionesSemana)))), motivo: ['es lo que sueles hacer']};
    let rec = Math.max(lo, Math.min(hi, BASE_FASE[c.fase.tipo] || 4));
    const motivo = [];
    if (c.formaObj && +c.formaObj.dias_semana > rec) { rec = +c.formaObj.dias_semana; motivo.push(`tu objetivo «${c.formaObj.objetivo}» pide ${c.formaObj.dias_semana} días`); }
    // no saltar de golpe: como mucho una sesión más que ahora, y otra más cada 3 semanas de plan
    const tope = Math.ceil(c.cap.sesionesSemana) + 1 + Math.floor(c.semanaPlan / 3);
    if (rec > tope) { rec = tope; motivo.push(`subes poco a poco desde tus ${num(c.cap.sesionesSemana)} sesiones por semana actuales`); }
    if (c.competicion) { rec = 3; motivo.push('es semana de competición (la prueba va aparte)'); }
    if (c.recien) { rec = 3; motivo.push('toca recuperar tras la prueba'); }
    if (c.plan && c.plan.descarga && !c.competicion && !c.recien) { rec -= 1; motivo.push('es semana de descarga'); }
    if (cansado(R, opts)) { rec -= 1; motivo.push('vienes muy cargado'); }
    rec = Math.max(2, Math.min(7, rec));
    return {n: Math.min(nDisp, rec), motivo};
  }

  // si sobran días, se eligen los más repartidos (con el fin de semana para la sesión larga)
  function elegirDias(disp, n, minutosDia) {
    if (n >= disp.length) return disp;
    const elegidos = [];
    const finde = disp.filter((d) => d >= 5);
    if (finde.length) elegidos.push(mejorDia(finde, minutosDia));
    while (elegidos.length < n) {
      const gap = (d) => Math.min(...elegidos.map((e) => Math.min(Math.abs(e - d), 7 - Math.abs(e - d))), 7);
      const cand = disp.filter((d) => !elegidos.includes(d)).sort((a, b) => gap(b) - gap(a) || (minutosDia[b] || 60) - (minutosDia[a] || 60) || a - b);
      elegidos.push(cand[0]);
    }
    return elegidos.sort((a, b) => a - b);
  }

  // toma las sesiones por orden de prioridad: carrera-caminata si aún no corres 30 min seguidos, calidad solo dentro
  // del presupuesto (si no, una suave del mismo deporte), sin repetidas ni más de 3 de fuerza; si faltan, movilidad
  function seleccionar(prioridad, nDias, S, c) {
    const sesiones = [];
    const cuenta = (pred) => sesiones.filter(pred).length;
    for (const f of prioridad) {
      if (sesiones.length >= nDias) break;
      let s = f();
      if (c.etapa != null && s.sport === 'run') s = S.correrAndar(cuenta((x) => x.correrAndar) + 1);
      else if (s.calidad && cuenta((x) => x.calidad) >= c.presupuesto) s = facil(s.sport, S, sesiones);
      if (s.sport === 'strength' && cuenta((x) => x.sport === 'strength') >= 3) continue;
      if (sesiones.some((x) => x.titulo === s.titulo)) continue;
      sesiones.push(s);
    }
    while (sesiones.length < nDias) sesiones.push(S.movilidad());
    return sesiones;
  }

  // desde los 50, fuerza al menos 2 días (OMS 2020, ACSM): sustituye la última sesión de relleno o movilidad
  function asegurarFuerza(sesiones, c, S) {
    if (c.edad < 50 || sesiones.length < 4 || sesiones.filter((s) => s.sport === 'strength').length >= 2) return sesiones;
    const i = sesiones.map((s) => s.relleno || s.titulo.startsWith('Movilidad')).lastIndexOf(true);
    if (i < 0) return sesiones;
    const nueva = sesiones.some((s) => s.titulo === 'Fuerza cuerpo completo (A)') ? S.fuerzaTotal(2) : S.fuerzaTotal(1);
    return sesiones.map((s, j) => (j === i ? nueva : s));
  }

  function notasFinales(c, disp, sesiones, dias) {
    const notas = [];
    if (sesiones.some((s) => s.correrAndar)) notas.push(`Empiezas combinando correr y andar (etapa ${c.etapa + 1} de ${CORRER_ANDAR.length}). Si terminas la semana sin dolor que dure más de un día, pasa a la siguiente; si no, repítela.`);
    if (dias.length <= 2 && !sesiones.some((s) => s.sport === 'strength') && dias.length) notas.push('Con tan pocos días, prioriza las sesiones de carrera; la fuerza puede ir en 20 min al final de una de ellas.');
    if (c.formaObj && disp.length < (+c.formaObj.dias_semana || 0)) notas.push(`Tu objetivo «${c.formaObj.objetivo}» pide ${c.formaObj.dias_semana} días por semana y esta semana tienes ${disp.length}. Si puedes, añade aunque sean 30 min otro día.`);
    if (c.pesoObj) notas.push(`Para «${c.pesoObj.objetivo}»: además de los entrenos, intenta caminar 8.000–10.000 pasos al día.`);
    // OMS 2020: al menos 150 min de actividad moderada por semana
    const minSemana = sesiones.reduce((t, s) => t + (s.sport === 'other' ? 0 : s.min || 0), 0);
    if (c.mantener && minSemana < 150) notas.push(`La OMS recomienda al menos 150 min de actividad moderada a la semana; esta semana suman ${minSemana}. Si te apetece, añade paseos a paso vivo.`);
    if (c.volObj && c.volObj.km_semana_necesarios) notas.push(`Para «${c.volObj.objetivo}» necesitas unos ${Math.round(c.volObj.km_semana_necesarios)} km esta semana.`);
    return notas;
  }

  // ------------------------------------------------------------------ reparto en la semana
  // larga en fin de semana (el día con más minutos), duras lo más separadas posible y la calidad a `sep` días como mínimo
  // (si no cabe, se cambia por una suave), el resto en los huecos
  function asignarDias(sesiones, dias, minutosDia, c, suave) {
    const asign = new Map();
    const libres = new Set(dias);
    const larga = sesiones.find((s) => s.larga);
    if (larga) {
      const finde = [5, 6].filter((d) => libres.has(d));
      const d = libres.has(c.diaLarga) ? c.diaLarga : finde.length ? mejorDia(finde, minutosDia) : dias[dias.length - 1];
      asign.set(d, larga); libres.delete(d);
    }
    const duras = sesiones.filter((s) => s.dura && s !== larga), resto = sesiones.filter((s) => !s.dura && s !== larga);
    const dist = (d, pred) => { let m = 7; asign.forEach((s, k) => { if (pred(s)) m = Math.min(m, Math.abs(k - d)); }); return m; };
    duras.forEach((s) => {
      const cands = [...libres].sort((a, b) => dist(b, (x) => x.dura) - dist(a, (x) => x.dura) || a - b);
      const d = s.calidad ? cands.find((x) => dist(x, (y) => y.calidad) >= c.sep) : cands[0];
      if (d != null) { asign.set(d, s); libres.delete(d); } else resto.push(suave(s));
    });
    resto.forEach((s) => { const d = [...libres].sort((a, b) => a - b)[0]; if (d != null) { asign.set(d, s); libres.delete(d); } });
    return asign;
  }

  // cambia los km de una sesión de carrera manteniendo su ritmo
  function conKm(s, km, c, S) {
    if (s.relleno) return {...S.suave(1, km), titulo: s.titulo};
    return {...s, km, min: Math.max(15, Math.round(s.min * km / s.km)), detalle: `${s.detalle} (Recortada a ${num(km)} km para subir de forma segura.)`};
  }

  // Los km de la semana mandan: ninguna carrera pasa del techo, los rodajes de relleno absorben lo que falte y,
  // si sobra, se recorta todo en proporción. Los muy entrenados cambian la movilidad por rodajes si no llegan.
  function repartirKm(sesiones, c, S) {
    // cada sesión de calidad, como mucho ~25 % de la semana: el grueso del volumen va suave (80/20)
    const topeCalidad = Math.max(5, r1(c.km * 0.25));
    const tope = (s) => (s.calidad ? Math.min(c.techo, topeCalidad) : c.techo);
    let out = sesiones.map((s) => (esCarrera(s) && s.km > tope(s) ? conKm(s, r1(tope(s)), c, S) : s));
    // en semanas de competición o de recuperación los rodajes no rellenan volumen
    if (c.competicion || c.recien) return out;
    const total = () => out.filter(esCarrera).reduce((t, s) => t + s.km, 0);
    while (c.corre && !c.mantener && c.nivel >= 3 && total() < c.km * 0.95 && out.some((s) => s.titulo.startsWith('Movilidad'))) {
      const i = out.findIndex((s) => s.titulo.startsWith('Movilidad'));
      out = out.map((s, j) => (j === i ? S.suave(out.filter((x) => x.relleno).length + 1) : s));
    }
    const rellenos = out.filter((s) => esCarrera(s) && s.relleno).length;
    if (rellenos) {
      const fijos = out.filter((s) => esCarrera(s) && !s.relleno).reduce((t, s) => t + s.km, 0);
      const k = Math.max(3, Math.min(c.techo, r1((c.km - fijos) / rellenos)));
      out = out.map((s) => (esCarrera(s) && s.relleno ? conKm(s, k, c, S) : s));
    }
    const t = total();
    if (t > c.km) out = out.map((s) => (esCarrera(s) ? conKm(s, Math.max(2, r1(s.km * c.km / t)), c, S) : s));
    return out;
  }

  function sesionCompeticion(comp) {
    return {sport: DEPORTE_COMP[comp.tipo] || 'run', dura: true, titulo: `Competición: ${comp.objetivo}`, min: comp.meta_min || 60,
      detalle: comp.meta_min ? `Meta: ${comp.meta}. Sal controlado y aprieta en la segunda mitad.` : 'A disfrutar.'};
  }

  // ajusta cada sesión a los minutos disponibles de su día y la fecha
  function ajustarMinutos(asign, minutosDia, w0) {
    const out = [];
    asign.forEach((s, d) => {
      const cap = minutosDia[d];
      const o = {...s, dia: iso(addDays(w0, d)), nombreDia: NOMBRE_DIA[d]};
      if (cap && o.min > cap && !o.titulo.startsWith('Competición')) {
        const f = cap / o.min;
        o.min = cap;
        if (o.km) o.km = Math.max(o.correrAndar ? o.km : 2, r1(o.km * f));
        o.detalle += ` (Ajustado a tus ${cap} min: acórtalo proporcionalmente.)`;
      }
      out.push(o);
    });
    return out.sort((a, b) => (a.dia < b.dia ? -1 : 1));
  }

  // la víspera de la tirada larga, nada de pierna: llegaría con las piernas cargadas. Esa fuerza pasa a tren superior.
  const PIERNA = /pierna|sentadilla|zancada/i;
  function sinPiernaAntesDeLarga(asign, S) {
    const dLarga = [...asign.keys()].find((d) => asign.get(d).larga);
    const previa = dLarga != null && asign.get(dLarga - 1);
    if (!previa || previa.sport !== 'strength' || !PIERNA.test(`${previa.titulo} ${previa.detalle}`)) return asign;
    return new Map([...asign].map(([d, s]) => [d, d === dLarga - 1 ? S.fuerza(2) : s]));
  }

  // más o menos carga que la prevista (lo pide la persona): escala minutos y km de todo menos la competición
  function escalarCarga(sesiones, f) {
    if (!f || f === 1) return sesiones;
    return sesiones.map((s) => (s.titulo.startsWith('Competición') ? s : {...s, min: Math.max(10, Math.round(s.min * f)), ...(s.km ? {km: r1(s.km * f)} : {})}));
  }

  // ------------------------------------------------------------------ API
  // sin historial reciente suficiente no hay plan: no sabemos de dónde parte la persona
  const puedePlanificar = (R) => !!(R && R.capacidad && R.capacidad.suficiente);

  // opts.futuro: semana de un plan a largo plazo · opts.semanaPlan: nº de semana dentro del plan (0 = la primera)
  // opts.largo30 / opts.kmPrevio: carrera más larga de los 30 días previos y km de la última semana de carga (los pasa generarCompleto)
  function proponer(R, perfil, semanaIso, disponibles, minutosDia, opts = {}) {
    if (!puedePlanificar(R)) return null;
    const c = contexto(R, semanaIso, opts);
    const S = catalogo(c);
    const prioridad = inyectarObjetivos(prioridadBase(c, S), c, S);
    const disp = [...disponibles].sort((a, b) => a - b);
    const {n, motivo} = numSesiones(R, c, disp.length, opts);
    const dias = elegirDias(disp, n, minutosDia);
    const sesiones = asegurarFuerza(seleccionar(prioridad, dias.length, S, c), c, S);
    const asign = sinPiernaAntesDeLarga(asignarDias(sesiones, dias, minutosDia, c, (s) => facil(s.sport, S, sesiones)), S);
    const conKms = repartirKm([...asign.values()], c, S);
    const final = new Map([...asign.keys()].map((d, i) => [d, conKms[i]]));
    if (c.competicion) final.set((parse(c.competicion.dia) - c.w0) / 864e5, sesionCompeticion(c.competicion));
    const out = escalarCarga(ajustarMinutos(final, minutosDia, c.w0), opts.factorCarga);
    const notas = [
      ...(n < disp.length ? [`Tienes ${disp.length} días disponibles y te propongo ${n} sesiones${motivo.length ? ` porque ${motivo.join(' y ')}` : ': es lo que mejor encaja con tu fase'}. Los demás días, descanso o un paseo.`] : []),
      ...c.notasVolumen,
      ...notasFinales(c, disp, conKms, dias),
      ...(c.competicion ? [`Semana de competición: ${c.competicion.objetivo}. Llega fresco.`] : []),
      ...(opts.factorCarga && opts.factorCarga !== 1 ? [`Carga ajustada a petición tuya: ${opts.factorCarga < 1 ? 'un' : 'hasta un'} ${Math.round(Math.abs(1 - opts.factorCarga) * 100)} % ${opts.factorCarga < 1 ? 'menos' : 'más'} de lo previsto.`] : []),
    ];
    const kmTot = r1(out.reduce((s, x) => s + (x.sport === 'run' && x.km ? x.km : 0), 0));
    return {semana: semanaIso, fase: c.fase.titulo, faseTipo: c.fase.tipo, nivel: c.nivel, sesiones: out, kmCarrera: kmTot, notas, creado: new Date().toISOString(), disponibles: disp, minutosDia,
      descarga: !!(c.plan && c.plan.descarga) && !c.competicion && !c.recien, competicion: c.competicion ? c.competicion.objetivo : null, recuperacion: c.recien ? c.recien.objetivo : null,
      horas: Math.round(out.reduce((s, x) => s + (x.min || 0), 0) / 6) / 10};
  }

  // Plan completo: una propuesta por semana desde el lunes indicado hasta el último objetivo con fecha (o 12 semanas).
  // Cada semana parte de lo planificado antes: la carrera más larga de los 30 días previos y los km de la última semana de carga.
  // extra: opciones que se aplican a todas las semanas (diaLarga, factorCarga)
  function generarCompleto(R, perfil, desdeIso, disponibles, minutosDia, extra = {}) {
    if (!puedePlanificar(R)) return null;
    const w0 = parse(desdeIso);
    const fechas = (R.objetivos || []).filter((o) => o.dia && o.dia >= desdeIso).map((o) => o.dia).sort();
    const ultimo = fechas.length ? parse(fechas[fechas.length - 1]) : addDays(w0, 7 * 11);
    const corridas = R.acts.filter((a) => a.sport === 'run').map((a) => ({dia: iso(a.d), km: a.km}));
    let kmPrevio = (R.capacidad.porDeporte.run || {km: 0}).km;
    const semanas = [];
    for (let w = w0, n = 1; w <= ultimo && n <= 80; w = addDays(w, 7), n++) {
      const wIso = iso(w), desde = iso(addDays(w, -30));
      const largo30 = Math.max(0, ...corridas.filter((x) => x.dia >= desde && x.dia < wIso).map((x) => x.km));
      const p = proponer(R, perfil, wIso, disponibles, minutosDia, {...extra, futuro: true, semanaPlan: n - 1, largo30, kmPrevio});
      p.numero = n;
      p.sesiones.filter(esCarrera).forEach((s) => corridas.push({dia: s.dia, km: s.km}));
      p.sesiones.filter((s) => s.correrAndar).forEach((s) => corridas.push({dia: s.dia, km: s.km}));
      if (!p.descarga && !p.competicion && !p.recuperacion) kmPrevio = Math.max(kmPrevio, p.kmCarrera);
      semanas.push(p);
    }
    return {creado: new Date().toISOString(), desde: desdeIso, hasta: semanas.length ? semanas[semanas.length - 1].semana : desdeIso,
      disponibles: [...disponibles], minutosDia: {...minutosDia}, semanas};
  }

  window.PLAN = {proponer, generarCompleto, puedePlanificar, NOMBRE_DIA};
})();

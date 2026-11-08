/* Asistente: le escribes qué no te gusta del plan y Claude lo cambia con estas herramientas.
   Las herramientas son puras (estado → estado nuevo) y se prueban en Node; el bucle con la API y la ventana solo corren en el navegador. */
(() => {
  const {iso, parse, addDays, lunes, ETIQUETA} = window.AN;
  const {NOMBRE_DIA} = window.PLAN;
  const MODELO = 'claude-opus-5-5';
  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.3.0/+esm';
  const MAX_VUELTAS = 10;   // llamadas a la API por mensaje: corta bucles de herramientas sin fin
  const MAX_PREFS = 20;

  const SISTEMA = `Eres el asistente de Entreno, una app que planifica entrenamientos a partir del historial real de la persona.
Hablas en español, de tú, breve y claro. Tu trabajo es cambiar su plan cuando algo no le encaja y explicar por qué está como está.

Cómo actuar:
- Cada mensaje de la persona llega con <estado_actual>: su nivel, deportes, objetivos, preferencias guardadas y planes. Básate solo en eso; no inventes datos.
- Si el cambio toca días, carga o estructura de la semana, rehazla con rehacer_semana (o rehacer_plan_completo si habla del plan entero). Para cambios puntuales (mover, quitar o poner una sesión) usa editar_sesion.
- Para ver una semana del plan completo con detalle, usa ver_semana.
- Si pide algo «siempre», «nunca» o «a partir de ahora», guárdalo con guardar_preferencia además de aplicarlo. Respeta siempre las preferencias guardadas.
- Si la petición es clara, actúa sin preguntar y después resume en 1–3 frases qué has cambiado. Si es ambigua y el cambio sería grande, pregunta antes.
- Si te pide deshacer, usa deshacer.
- Si una herramienta devuelve error, corrige la llamada o explica a la persona qué pasa.

Reglas de seguridad que mantienes aunque te pidan otra cosa (explica por qué si chocan):
- Nada de dieta ni nutrición: solo entrenamiento.
- No subas el volumen semanal más de un 10 % respecto a lo que ya hace.
- Deja al menos 48 h entre sesiones intensas (72 h si tiene 50 años o más).
- Nada de fuerza de pierna la víspera de una tirada larga o de una sesión dura.
- Sin historial suficiente no hay plan: dile que importe sus entrenos.
- Ante dolor o lesión, baja la carga y recomienda consultar a un profesional sanitario.

Convenciones: días 0 = lunes … 6 = domingo; las semanas se nombran por su lunes en formato AAAA-MM-DD.`;

  const nul = (t) => ({type: [t, 'null']});
  const DIAS_SCHEMA = {type: ['array', 'null'], items: {type: 'integer'}, description: 'Días disponibles (0 = lunes … 6 = domingo). null = los mismos que ahora.'};
  const MIN_SCHEMA = {type: ['array', 'null'], description: 'Minutos disponibles por día. null = los mismos que ahora.',
    items: {type: 'object', properties: {dia: {type: 'integer'}, min: {type: 'integer'}}, required: ['dia', 'min'], additionalProperties: false}};
  const LARGA_SCHEMA = {...nul('integer'), description: 'Día de la tirada larga o sesión larga (0–6). null = lo decide el plan.'};
  const CARGA_SCHEMA = {...nul('number'), description: 'Multiplica minutos y km: 0.5–1.3 (0.8 = un 20 % menos). null = la prevista.'};
  const herramienta = (name, description, properties) => ({name, description, strict: true,
    input_schema: {type: 'object', properties, required: Object.keys(properties), additionalProperties: false}});

  const HERRAMIENTAS = [
    herramienta('rehacer_semana', 'Vuelve a generar una semana con el planificador de la app (respeta fase, objetivos, nivel y progresión segura) aplicando los cambios pedidos. Sirve para la semana que toca planificar o cualquier semana del plan completo.',
      {semana: {type: 'string', description: 'Lunes de la semana, AAAA-MM-DD.'}, dias: DIAS_SCHEMA, minutos: MIN_SCHEMA, dia_larga: LARGA_SCHEMA, factor_carga: CARGA_SCHEMA}),
    herramienta('rehacer_plan_completo', 'Vuelve a generar el plan completo (todas las semanas hasta el último objetivo) aplicando los cambios a todas las semanas. Si no existe, lo crea desde el lunes que viene.',
      {dias: DIAS_SCHEMA, minutos: MIN_SCHEMA, dia_larga: LARGA_SCHEMA, factor_carga: CARGA_SCHEMA}),
    herramienta('editar_sesion', 'Cambio puntual en una semana ya planificada: quitar la sesión de un día, moverla a otro día (si el destino tiene sesión, se intercambian) o poner una sesión escrita por ti en un día (sustituye lo que hubiera).',
      {semana: {type: 'string', description: 'Lunes de la semana, AAAA-MM-DD.'}, dia: {type: 'integer', description: 'Día afectado (0–6).'},
        accion: {type: 'string', enum: ['quitar', 'mover', 'poner']}, a_dia: {...nul('integer'), description: 'Solo para mover: día de destino.'},
        sesion: {type: ['object', 'null'], description: 'Solo para poner: la sesión nueva.', additionalProperties: false, required: ['sport', 'titulo', 'detalle', 'min', 'km'],
          properties: {sport: {type: 'string', enum: Object.keys(ETIQUETA)}, titulo: {type: 'string'}, detalle: {type: 'string', description: 'Qué hacer exactamente, con ritmos o intensidad.'},
            min: {type: 'integer'}, km: {...nul('number'), description: 'Solo si es carrera, bici o caminata con distancia.'}}}}),
    herramienta('ver_semana', 'Devuelve el detalle completo de una semana (planificada o del plan completo).', {semana: {type: 'string', description: 'Lunes de la semana, AAAA-MM-DD.'}}),
    herramienta('guardar_preferencia', 'Guarda una preferencia permanente de la persona (p. ej. «nunca fuerza de pierna antes de la tirada larga») para tenerla en cuenta en adelante.', {texto: {type: 'string'}}),
    herramienta('borrar_preferencia', 'Borra una preferencia guardada por su número (1 = la primera).', {indice: {type: 'integer'}}),
    herramienta('deshacer', 'Deshace el último cambio hecho por el asistente.', {}),
  ];

  // ------------------------------------------------------------ herramientas (puras)
  const esDia = (d) => Number.isInteger(d) && d >= 0 && d <= 6;
  const dow = (semana, fecha) => Math.round((parse(fecha) - parse(semana)) / 864e5);
  const fallo = (est, texto) => ({est, ok: false, texto});
  const conPila = (antes, est, texto) => ({ok: true, texto,
    est: {...est, pila: [...antes.pila, {planes: antes.planes, planCompleto: antes.planCompleto, preferencias: antes.preferencias}]}});
  const r1 = (x) => Math.round(x * 10) / 10;
  const totales = (p) => ({...p, kmCarrera: r1(p.sesiones.reduce((t, s) => t + (s.sport === 'run' && s.km ? s.km : 0), 0)),
    horas: Math.round(p.sesiones.reduce((t, s) => t + (s.min || 0), 0) / 6) / 10});

  function buscarSemana(est, semana) {
    if (est.planes[semana]) return {plan: est.planes[semana], i: -1};
    const i = est.planCompleto ? est.planCompleto.semanas.findIndex((s) => s.semana === semana) : -1;
    return i >= 0 ? {plan: est.planCompleto.semanas[i], i} : null;
  }
  const conSemana = (est, i, plan) => (i < 0
    ? {...est, planes: {...est.planes, [plan.semana]: plan}}
    : {...est, planCompleto: {...est.planCompleto, semanas: est.planCompleto.semanas.map((s, k) => (k === i ? plan : s))}});

  // días, minutos, día de la larga y carga validados; devuelve un texto de error si algo no cuadra
  function opciones(input, prev, est, primero = 0) {
    const dias = [...new Set((input.dias || prev.disponibles || [1, 3, 5, 6]))].filter((d) => d >= primero).sort((a, b) => a - b);
    if (!dias.length || !dias.every(esDia)) return {error: primero ? 'No quedan días de esa semana con esos datos.' : 'Hacen falta días válidos (0–6).'};
    const pedidos = input.minutos || [];
    if (!pedidos.every((m) => esDia(m.dia) && Number.isInteger(m.min) && m.min >= 10 && m.min <= 600)) return {error: 'Minutos por día fuera de rango (10–600).'};
    if (input.dia_larga != null && !esDia(input.dia_larga)) return {error: 'dia_larga debe ser 0–6.'};
    if (input.factor_carga != null && !(input.factor_carga >= 0.5 && input.factor_carga <= 1.3)) return {error: 'factor_carga debe estar entre 0.5 y 1.3.'};
    const base = {...est.minutosDia, ...(prev.minutosDia || {}), ...Object.fromEntries(pedidos.map((m) => [m.dia, m.min]))};
    const minutos = Object.fromEntries(dias.map((d) => [d, base[d] || (d >= 5 ? 90 : 60)]));
    const extra = {...(input.dia_larga != null ? {diaLarga: input.dia_larga} : {}), ...(input.factor_carga != null ? {factorCarga: input.factor_carga} : {})};
    return {dias, minutos, extra};
  }

  function rehacerSemana(input, est) {
    if (!window.PLAN.puedePlanificar(est.R)) return fallo(est, 'Sin historial suficiente no hay plan: hay que importar entrenos.');
    const hallada = buscarSemana(est, input.semana);
    if (!hallada && input.semana !== est.semanaObjetivo) return fallo(est, `No hay plan para la semana ${input.semana}. Semanas disponibles: ${semanasConocidas(est).join(', ') || 'ninguna'}.`);
    const {plan: prev = {}, i = -1} = hallada || {};
    const actual = iso(lunes(parse(est.hoy)));
    const o = opciones(input, prev, est, input.semana === actual ? dow(actual, est.hoy) : 0);
    if (o.error) return fallo(est, o.error);
    const futuro = i >= 0 ? {futuro: true, semanaPlan: prev.numero - 1} : {};
    const nuevo = window.PLAN.proponer(est.R, est.perfil, input.semana, o.dias, o.minutos, {...o.extra, ...futuro});
    const plan = i >= 0 ? {...nuevo, numero: prev.numero} : nuevo;
    return conPila(est, conSemana(est, i, plan), `Semana rehecha.\n${resumenSemana(plan, true)}`);
  }

  function rehacerCompleto(input, est) {
    if (!window.PLAN.puedePlanificar(est.R)) return fallo(est, 'Sin historial suficiente no hay plan: hay que importar entrenos.');
    const pc = est.planCompleto || {};
    const o = opciones(input, pc, est);
    if (o.error) return fallo(est, o.error);
    const desde = pc.desde || iso(addDays(lunes(parse(est.hoy)), 7));
    const nuevo = window.PLAN.generarCompleto(est.R, est.perfil, desde, o.dias, o.minutos, o.extra);
    return conPila(est, {...est, planCompleto: nuevo}, `Plan completo rehecho: ${nuevo.semanas.length} semanas.\n${resumenCompleto(nuevo)}`);
  }

  function sesionValida(s) {
    return s && Object.keys(ETIQUETA).includes(s.sport) && typeof s.titulo === 'string' && s.titulo.trim().length > 0 && s.titulo.length <= 80
      && typeof s.detalle === 'string' && s.detalle.length <= 800 && Number.isInteger(s.min) && s.min >= 5 && s.min <= 600
      && (s.km == null || (s.km > 0 && s.km <= 300));
  }

  function editarSesion(input, est) {
    const hallada = buscarSemana(est, input.semana);
    if (!hallada) return fallo(est, `No hay plan para la semana ${input.semana}. Semanas disponibles: ${semanasConocidas(est).join(', ') || 'ninguna'}.`);
    if (!esDia(input.dia)) return fallo(est, 'dia debe ser 0–6.');
    const {plan, i} = hallada;
    const fecha = (d) => iso(addDays(parse(plan.semana), d));
    const enDia = (s, d) => s.dia === fecha(d);
    const mueve = (s, d) => ({...s, dia: fecha(d), nombreDia: NOMBRE_DIA[d]});
    let sesiones;
    if (input.accion === 'quitar') {
      if (!plan.sesiones.some((s) => enDia(s, input.dia))) return fallo(est, `El ${NOMBRE_DIA[input.dia]} no hay sesión.`);
      sesiones = plan.sesiones.filter((s) => !enDia(s, input.dia));
    } else if (input.accion === 'mover') {
      if (!esDia(input.a_dia) || input.a_dia === input.dia) return fallo(est, 'a_dia debe ser 0–6 y distinto de dia.');
      if (!plan.sesiones.some((s) => enDia(s, input.dia))) return fallo(est, `El ${NOMBRE_DIA[input.dia]} no hay sesión que mover.`);
      sesiones = plan.sesiones.map((s) => (enDia(s, input.dia) ? mueve(s, input.a_dia) : enDia(s, input.a_dia) ? mueve(s, input.dia) : s));
    } else if (input.accion === 'poner') {
      if (!sesionValida(input.sesion)) return fallo(est, 'Sesión no válida: sport de la lista, título (≤80), detalle (≤800), min 5–600 y km null o 0–300.');
      const {sport, titulo, detalle, min, km} = input.sesion;
      const nueva = {sport, titulo: titulo.trim(), detalle, min, ...(km ? {km: r1(km)} : {}), dia: fecha(input.dia), nombreDia: NOMBRE_DIA[input.dia], asistente: true};
      sesiones = [...plan.sesiones.filter((s) => !enDia(s, input.dia)), nueva];
    } else return fallo(est, 'accion debe ser quitar, mover o poner.');
    const nuevo = totales({...plan, sesiones: [...sesiones].sort((a, b) => (a.dia < b.dia ? -1 : 1)), editado: true});
    return conPila(est, conSemana(est, i, nuevo), `Hecho.\n${resumenSemana(nuevo, true)}`);
  }

  function ejecutar(nombre, input, est) {
    const x = input || {};
    switch (nombre) {
      case 'rehacer_semana': return rehacerSemana(x, est);
      case 'rehacer_plan_completo': return rehacerCompleto(x, est);
      case 'editar_sesion': return editarSesion(x, est);
      case 'ver_semana': {
        const h = buscarSemana(est, x.semana);
        return h ? {est, ok: true, texto: resumenSemana(h.plan, true)} : fallo(est, `No hay plan para la semana ${x.semana}.`);
      }
      case 'guardar_preferencia': {
        const t = String(x.texto || '').trim().slice(0, 200);
        if (!t) return fallo(est, 'La preferencia está vacía.');
        if (est.preferencias.length >= MAX_PREFS) return fallo(est, `Ya hay ${MAX_PREFS} preferencias: borra alguna antes.`);
        return conPila(est, {...est, preferencias: [...est.preferencias, t]}, `Preferencia guardada (n.º ${est.preferencias.length + 1}).`);
      }
      case 'borrar_preferencia': {
        if (!Number.isInteger(x.indice) || x.indice < 1 || x.indice > est.preferencias.length) return fallo(est, 'No existe esa preferencia.');
        return conPila(est, {...est, preferencias: est.preferencias.filter((_, k) => k !== x.indice - 1)}, 'Preferencia borrada.');
      }
      case 'deshacer': {
        if (!est.pila.length) return fallo(est, 'No hay nada que deshacer.');
        const prev = est.pila[est.pila.length - 1];
        return {ok: true, texto: 'Último cambio deshecho.', est: {...est, ...prev, pila: est.pila.slice(0, -1)}};
      }
      default: return fallo(est, `Herramienta desconocida: ${nombre}.`);
    }
  }

  // ------------------------------------------------------------ estado en texto para Claude
  const semanasConocidas = (est) => [...new Set([...Object.keys(est.planes).filter((s) => s >= iso(addDays(lunes(parse(est.hoy)), -7))),
    ...(est.planCompleto ? est.planCompleto.semanas.map((s) => s.semana) : [])])].sort();

  function resumenSemana(p, detalle) {
    const tags = [p.fase, `${p.sesiones.length} sesiones`, `${p.horas} h`, p.kmCarrera ? `${p.kmCarrera} km de carrera` : '',
      p.descarga ? 'descarga' : '', p.competicion ? `competición: ${p.competicion}` : '', p.recuperacion ? 'recuperación' : ''].filter(Boolean).join(' · ');
    const ses = p.sesiones.map((s) => `- ${s.nombreDia} (${dow(p.semana, s.dia)}): ${s.titulo} · ${s.min} min${s.km ? ` · ${s.km} km` : ''} [${s.sport}]${detalle ? ` — ${s.detalle}` : ''}`);
    const disp = p.disponibles ? `Días disponibles: ${p.disponibles.map((d) => `${NOMBRE_DIA[d]} ${(p.minutosDia || {})[d] || '?'} min`).join(', ')}` : '';
    return [`Semana del ${p.semana}${p.numero ? ` (n.º ${p.numero} del plan completo)` : ''}: ${tags}`, disp, ...ses].filter(Boolean).join('\n');
  }

  const resumenCompleto = (pc) => [`Plan completo del ${pc.desde} al ${pc.hasta}, ${pc.semanas.length} semanas (días ${pc.disponibles.map((d) => NOMBRE_DIA[d]).join(', ')}):`,
    ...pc.semanas.map((s) => `${s.semana} n.º ${s.numero} ${s.faseTipo}${s.descarga ? ' descarga' : ''}${s.competicion ? ' COMPETICIÓN' : ''}: ${s.sesiones.map((x) => `${x.nombreDia.slice(0, 3)} ${x.titulo}${x.km ? ` ${x.km} km` : ` ${x.min}′`}`).join(', ')}`)].join('\n');

  function contexto(est) {
    const cap = (est.R && est.R.capacidad) || {};
    const hoyD = parse(est.hoy);
    const deportes = Object.entries(cap.porDeporte || {}).map(([sp, v]) => `${ETIQUETA[sp] || sp}: ${r1(v.sesiones)} sesiones/semana, ${Math.round(v.min)} min/semana${v.km ? `, ${r1(v.km)} km/semana` : ''}`);
    const objetivos = (est.perfil.objetivos || []).map((o) => `${o.objetivo} (${o.tipo}${o.distancia_km ? `, ${o.distancia_km} km` : ''}${o.dia ? `, el ${o.dia}` : ''})`);
    const actuales = Object.keys(est.planes).filter((s) => s >= iso(lunes(hoyD))).sort();
    return [
      `Hoy: ${NOMBRE_DIA[(hoyD.getUTCDay() + 6) % 7]} ${est.hoy}. Semana que toca planificar: ${est.semanaObjetivo}.`,
      cap.suficiente ? `Nivel ${cap.nivel}/4 (0 = empieza, 4 = muy entrenado) · ${r1(cap.sesionesSemana || 0)} sesiones y ${r1(cap.horasSemana || 0)} h por semana${cap.edad ? ` · ${cap.edad} años` : ''}.` : 'Sin historial suficiente: no se puede generar plan.',
      `Deportes últimas semanas: ${deportes.join('; ') || 'ninguno'}.`,
      `Objetivos: ${objetivos.join('; ') || 'ninguno (el plan mantiene lo que hace)'}.`,
      `Preferencias guardadas: ${est.preferencias.length ? est.preferencias.map((p, k) => `${k + 1}. ${p}`).join(' ') : 'ninguna'}.`,
      ...(actuales.length ? actuales.map((s) => resumenSemana(est.planes[s], true)) : ['Aún no hay plan de la semana.']),
      est.planCompleto ? resumenCompleto(est.planCompleto) : 'No hay plan completo.',
    ].join('\n\n');
  }

  // ------------------------------------------------------------ bucle con la API (navegador)
  let sdk = null;
  async function cargarSdk() {
    if (!sdk) sdk = (await import(SDK_URL)).default;
    return sdk;
  }

  // Envía la conversación y ejecuta las herramientas que pida Claude hasta que responda con texto.
  // historial termina en el mensaje de la persona; alCambiar recibe cada estado nuevo para guardarlo y repintar.
  async function conversar(clave, historial, est, alCambiar) {
    const Anthropic = await cargarSdk();
    const client = new Anthropic({apiKey: clave, dangerouslyAllowBrowser: true});
    let msgs = historial, e = est;
    for (let v = 0; v < MAX_VUELTAS; v++) {
      const r = await client.beta.messages.create({
        model: MODELO, max_tokens: 16000, output_config: {effort: 'medium'},
        betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
        system: [{type: 'text', text: SISTEMA, cache_control: {type: 'ephemeral'}}],
        tools: HERRAMIENTAS, messages: msgs,
      });
      msgs = [...msgs, {role: 'assistant', content: r.content}];
      const texto = r.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      if (r.stop_reason === 'refusal') return {historial: msgs, est: e, texto: 'No puedo ayudarte con eso.'};
      if (r.stop_reason === 'pause_turn') continue;
      const usos = r.content.filter((b) => b.type === 'tool_use');
      if (r.stop_reason !== 'tool_use' || !usos.length) return {historial: msgs, est: e, texto: texto || 'Hecho.'};
      const antes = e;
      const resultados = usos.map((u) => {
        const x = ejecutar(u.name, u.input, e);
        e = x.est;
        return {type: 'tool_result', tool_use_id: u.id, content: x.texto, ...(x.ok ? {} : {is_error: true})};
      });
      msgs = [...msgs, {role: 'user', content: resultados}];
      if (e !== antes) await alCambiar(e);
    }
    return {historial: msgs, est: e, texto: 'He hecho varios cambios seguidos y paro aquí. Revisa el plan y dime si quieres algo más.'};
  }

  function mensajeError(err) {
    const A = sdk;
    if (!A) return 'No he podido cargar el asistente. ¿Tienes conexión?';
    if (err instanceof A.AuthenticationError) return 'La clave de API no es válida. Revísala en «Cambiar clave».';
    if (err instanceof A.PermissionDeniedError) return 'Tu clave no tiene permiso para usar este modelo.';
    if (err instanceof A.RateLimitError) return 'Demasiadas peticiones seguidas. Espera un minuto y vuelve a intentarlo.';
    if (err instanceof A.APIConnectionError) return 'No hay conexión con Claude. Inténtalo cuando tengas internet.';
    if (err instanceof A.InternalServerError) return 'Claude está saturado ahora mismo. Prueba en un rato.';
    if (err instanceof A.APIError) return `Claude ha devuelto un error (${err.status || '?'}): ${err.message}`;
    return `Algo ha fallado: ${err && err.message ? err.message : err}`;
  }

  window.ASIS = {HERRAMIENTAS, SISTEMA, ejecutar, contexto, conversar};

  // ------------------------------------------------------------ ventana flotante
  if (typeof document === 'undefined' || !window.APP) return;
  const APP = window.APP;
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => { const x = document.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; };
  const btn = $('#asis-btn'), panel = $('#asis-panel'), log = $('#asis-log'), form = $('#asis-form'), txt = $('#asis-txt');
  const claveBox = $('#asis-clave'), chat = $('#asis-chat'), claveIn = $('#asis-clave-in');
  let historial = [], pila = [], clave = null, ocupado = false;

  const estado = () => ({R: APP.R, perfil: APP.ST.perfil, hoy: iso(window.AN.hoyUTC()), semanaObjetivo: iso(APP.semanaObjetivo()),
    planes: APP.ST.planes, planCompleto: APP.ST.ajustes.planCompleto || null, preferencias: APP.ST.ajustes.preferencias || [], pila,
    minutosDia: APP.ST.ajustes.minutosDia || {}});

  async function aplicar(e) {
    pila = e.pila;
    APP.ST.planes = e.planes;
    APP.ST.ajustes = {...APP.ST.ajustes, planCompleto: e.planCompleto || undefined, preferencias: e.preferencias};
    await APP.guardar('planes', 'ajustes');
    APP.pintar();
  }

  const burbuja = (cls, texto) => { const b = el('div', `asis-msg ${cls}`, texto); log.append(b); log.scrollTop = log.scrollHeight; return b; };
  const vistaClave = (ver) => { claveBox.hidden = !ver; chat.hidden = ver; (ver ? claveIn : txt).focus(); };
  function abrir(si) {
    panel.hidden = !si; btn.setAttribute('aria-expanded', String(si));
    if (si) vistaClave(!clave); else btn.focus();
  }

  btn.addEventListener('click', () => abrir(panel.hidden));
  $('#asis-cerrar').addEventListener('click', () => abrir(false));
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !panel.hidden) abrir(false); });

  $('#asis-clave-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const k = claveIn.value.trim();
    if (!/^sk-ant-[\w-]{20,}$/.test(k)) { $('#asis-clave-err').hidden = false; return; }
    clave = k; claveIn.value = ''; $('#asis-clave-err').hidden = true;
    await APP.DB.set('claveIA', k);
    vistaClave(false);
  });
  $('#asis-olvidar').addEventListener('click', async () => { clave = null; await APP.DB.set('claveIA', null); vistaClave(true); });
  $('#asis-nueva').addEventListener('click', () => { historial = []; log.replaceChildren(); txt.focus(); });
  $('#asis-deshacer').addEventListener('click', async () => {
    const r = ejecutar('deshacer', {}, estado());
    if (r.ok) await aplicar(r.est);
    burbuja('ia', r.ok ? 'He deshecho el último cambio.' : 'No hay nada que deshacer.');
    // Claude no ha visto el deshacer: lo verá en el próximo <estado_actual>
  });
  document.querySelectorAll('#asis-sug button').forEach((b) => b.addEventListener('click', () => { txt.value = b.textContent; form.requestSubmit(); }));
  txt.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); form.requestSubmit(); } });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const t = txt.value.trim();
    if (!t || ocupado) return;
    if (!clave) { vistaClave(true); return; }
    ocupado = true; form.querySelector('button').disabled = true;
    txt.value = ''; burbuja('yo', t);
    const espera = burbuja('ia espera', 'Pensando…');
    const e0 = estado();
    const usuario = {role: 'user', content: [{type: 'text', text: `<estado_actual>\n${contexto(e0)}\n</estado_actual>`}, {type: 'text', text: t}]};
    try {
      const r = await conversar(clave, [...historial, usuario], e0, aplicar);
      historial = r.historial;
      espera.remove(); burbuja('ia', r.texto);
    } catch (err) {
      // la conversación vuelve a como estaba (sin turnos a medias); los cambios ya aplicados se quedan y Claude los verá en el próximo estado
      espera.remove(); burbuja('ia error', mensajeError(err));
    } finally {
      ocupado = false; form.querySelector('button').disabled = false; txt.focus();
    }
  });

  APP.DB.get('claveIA').then((k) => { clave = k || null; }).catch(() => { clave = null; });
})();

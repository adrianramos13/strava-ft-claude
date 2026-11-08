/* App: almacenamiento local, navegación, formularios y pintado. */
(() => {
  const {analizar, iso, parse, addDays, lunes, hoyUTC, fechaTxt, ritmo, ETIQUETA, ORDEN, deporte} = window.AN;
  const {nf} = window.CH;
  const DIAS = window.PLAN.NOMBRE_DIA;

  // ------------------------------------------------------------ almacenamiento
  const DB = {
    db: null, mem: new Map(),
    open() {
      return new Promise((res) => {
        try {
          const r = indexedDB.open('entreno', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('kv');
          r.onsuccess = () => { this.db = r.result; res(true); };
          r.onerror = () => res(false);
        } catch (e) { res(false); }
      });
    },
    get(k) {
      if (!this.db) return Promise.resolve(this.mem.get(k));
      return new Promise((res) => { const q = this.db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); });
    },
    set(k, v) {
      if (!this.db) { this.mem.set(k, v); return Promise.resolve(); }
      return new Promise((res, rej) => { const t = this.db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
    },
    clear() {
      if (!this.db) { this.mem.clear(); return Promise.resolve(); }
      return new Promise((res) => { const t = this.db.transaction('kv', 'readwrite'); t.objectStore('kv').clear(); t.oncomplete = () => res(); });
    },
  };
  const ST = {perfil: {nombre: '', objetivos: []}, acts: [], planes: {}, ajustes: {}};
  const guardar = (...ks) => Promise.all(ks.map((k) => DB.set(k, ST[k])));
  let R = null;

  // ------------------------------------------------------------ utilidades UI
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const signo = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + nf(Math.abs(v));
  let toastT;
  const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3500); };
  const confirmar = (titulo, texto, ok = 'Aceptar') => new Promise((res) => {
    $('#modal-t').textContent = titulo; $('#modal-p').textContent = texto; $('#modal-ok').textContent = ok;
    $('#modal').hidden = false;
    const fin = (v) => { $('#modal').hidden = true; $('#modal-ok').onclick = $('#modal-no').onclick = null; res(v); };
    $('#modal-ok').onclick = () => fin(true); $('#modal-no').onclick = () => fin(false);
  });
  const hoy = () => hoyUTC();
  const semanaObjetivo = () => { const h = hoy(); return h.getUTCDay() === 0 ? addDays(h, 1) : lunes(h); };  // el domingo se planifica la siguiente
  const nivelObj = (e) => ({'en camino': 'ok', 'conseguido': 'ok', 'alcanzable': 'warn', 'exigente': 'bad'}[e] || 'muted');

  function recalcular() {
    try { R = analizar(ST.acts, ST.perfil); } catch (e) { console.error(e); R = null; toast('No he podido calcular las métricas: ' + e.message); }
    pintar();
  }

  // ------------------------------------------------------------ navegación
  const TABS = ['inicio', 'semana', 'anadir', 'progreso', 'perfil'];
  let tab = 'inicio', seg = 'objetivos';
  function ir(t, anchor) {
    if (!TABS.includes(t)) t = 'inicio';
    tab = t;
    TABS.forEach((x) => { $(`#v-${x}`).hidden = x !== t; });
    $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    $('#bar-title').textContent = $(`#v-${t}`).dataset.title;
    if (anchor && t === 'progreso') seg = anchor;
    if (location.hash.slice(1) !== t) history.replaceState(null, '', '#' + t);
    window.scrollTo(0, 0);
    pintarVista();
  }
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => ir(b.dataset.tab)));
  document.addEventListener('click', (e) => { const g = e.target.closest('[data-goto]'); if (g) ir(g.dataset.goto, g.dataset.anchor); });
  window.addEventListener('hashchange', () => {
    if (location.hash === '#compartido') { ir('inicio'); recogerCompartidos(); } else ir(location.hash.slice(1));
  });
  $$('#v-progreso .seg button').forEach((b) => b.addEventListener('click', () => { seg = b.dataset.seg; pintarProgreso(); }));
  let segSem = 'semana';
  $$('#sem-seg button').forEach((b) => b.addEventListener('click', () => { segSem = b.dataset.sseg; pintarSemana(); }));

  function pintar() {
    const n = ST.perfil.nombre;
    $('#bar-sub').textContent = n ? `Hola, ${n}` : '';
    pintarVista();
  }
  function pintarVista() {
    if (tab === 'inicio') pintarInicio();
    else if (tab === 'semana') pintarSemana();
    else if (tab === 'progreso') pintarProgreso();
    else if (tab === 'perfil') pintarPerfil();
    else if (tab === 'anadir') prepararFormulario();
  }
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (tab === 'progreso') pintarProgreso(); }, 200); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (tab === 'progreso') pintarProgreso(); });

  // ------------------------------------------------------------ inicio
  function escala(box, v) {
    box.replaceChildren();
    if (v == null) return;
    const nombres = ['Poca base', 'Recreativo', 'Entrenado', 'Avanzado', 'Élite'];
    const idx = Math.min(4, Math.max(0, Math.floor(v / 20)));
    const bar = el('div', 'bar'), lbl = el('div', 'lbl');
    nombres.forEach((n, i) => { bar.append(el('span', i === idx ? 'on' : '')); });
    const t = el('span', 'on', `${nombres[idx]} (${idx * 20}${idx === 4 ? '+' : `–${idx * 20 + 20}`})`);
    t.style.gridColumn = idx <= 2 ? `${idx + 1} / span 3` : `${idx - 1} / span 3`;
    t.style.textAlign = idx <= 2 ? 'left' : 'right';
    lbl.append(t);
    const mk = el('i', 'mk'); mk.style.left = `${Math.min(100, Math.max(0, v))}%`; bar.append(mk);
    box.append(bar, lbl);
  }

  function hechoDe(s) {
    const mismos = ST.acts.filter((a) => a.fecha.slice(0, 10) === s.dia);
    return mismos.find((a) => (a.sport || deporte(a)) === s.sport) || (s.sport === 'other' ? mismos[0] : null);
  }

  function listaSesiones(box, plan, compacta) {
    box.replaceChildren();
    const ul = el('ul', 'sessions');
    const hoyIso = iso(hoy());
    plan.sesiones.forEach((s) => {
      const h = hechoDe(s);
      const li = el('li', `ses ${h ? 'done' : s.dia < hoyIso ? 'missed' : ''} ${s.dia === hoyIso ? 'today' : ''}`);
      const ic = el('span', `dot sp-${s.sport}`, h ? '✓' : '');
      const body = el('div', 'ses-body');
      const top = el('div', 'ses-top');
      top.append(el('b', null, s.titulo), el('span', 'ses-meta', `${s.nombreDia.slice(0, 3)} · ${s.min} min${s.km ? ` · ${String(s.km).replace('.', ',')} km` : ''}`));
      body.append(top);
      if (!compacta) body.append(el('p', null, s.detalle));
      if (h) body.append(el('span', 'ses-hecho', `Hecho: ${h.nombre || ETIQUETA[h.sport || deporte(h)]}`));
      li.append(ic, body); ul.append(li);
    });
    box.append(ul);
  }

  function pintarInicio() {
    const hayDatos = R && !R.vacio;
    $('#onboard').hidden = ST.acts.length > 0;
    $('#inicio-datos').hidden = !hayDatos && !(ST.perfil.objetivos || []).length;
    // aviso del domingo (y del lunes si no se planificó)
    const h = hoy(), dow = h.getUTCDay();
    const semObj = iso(semanaObjetivo());
    $('#banner-domingo').hidden = !((dow === 0 || dow === 1) && !ST.planes[semObj]);
    const ult = ST.ajustes.ultimaImportacion;
    const dias = ult ? Math.floor((Date.now() - new Date(ult.fecha)) / 864e5) : null;
    $('#banner-import').hidden = !(ST.acts.length && (dias == null || dias >= 7));
    $('#banner-import-txt').textContent = dias == null ? 'Importa tu export de Strava para que las métricas sean precisas.' : `Tu última importación fue hace ${dias} días.`;
    if (!R) return;

    if (hayDatos) {
      const e = R.estado;
      $('#i-estado').textContent = e.estado;
      $('#i-fres').textContent = signo(e.frescura);
      $('#i-cambio').textContent = e.cambio_pct == null ? '—' : `${signo(e.cambio_pct)} %`;
      $('#i-forma').textContent = nf(e.forma); $('#i-fatiga').textContent = nf(e.fatiga);
      $('#i-fres2').textContent = signo(e.frescura);
      const chip = $('#i-chip'); chip.textContent = e.estado; chip.className = `chip is-${e.nivel}`;
      $('#i-carga').textContent = nf(e.carga4); $('#i-carga-p').textContent = nf(e.carga4_prev);
      $$('[data-escala]').forEach((b) => escala(b, e[b.dataset.escala]));
    }
    $('.lead').hidden = !hayDatos; $('.tiles').hidden = !hayDatos;

    // semana
    const box = $('#i-semana');
    const semActual = iso(lunes(h));
    const plan = ST.planes[semActual] || (dow === 0 ? ST.planes[semObj] : null);
    if (plan) {
      const hechas = plan.sesiones.filter(hechoDe).length;
      listaSesiones(box, plan, true);
      box.prepend(el('p', 'note', `${plan.fase} · ${hechas} de ${plan.sesiones.length} sesiones hechas`));
    } else {
      box.replaceChildren(el('p', 'note', 'Aún no has planificado esta semana.'));
      const b = el('button', 'btn primary', 'Planificar ahora'); b.dataset.goto = 'semana'; box.append(b);
    }

    // todos los objetivos
    const objs = objetivosOrdenados();
    $('#i-objetivo-card').hidden = !objs.length;
    $('#i-objetivo').replaceChildren(...objs.map((o) => tarjetaObjetivo(o, true)));

    // últimos
    const ul = $('#i-ultimos'); ul.replaceChildren();
    (R.recientes || []).slice(0, 5).forEach((a) => ul.append(filaActividad(a)));
  }

  function filaActividad(a, borrar) {
    const li = el('li', 'act');
    li.append(el('span', `dot sp-${a.sport}`));
    const b = el('div', 'act-body');
    const t = el('div', 'act-top'); t.append(el('b', null, a.nombre || a.deporte), el('span', 'act-carga', `${a.carga} pts`));
    const m = el('div', 'act-meta', [a.fecha, a.deporte, a.duracion, a.km ? `${nf(a.km, 1)} km` : null, a.fc ? `${nf(a.fc)} ppm` : null].filter(Boolean).join(' · '));
    b.append(t, m);
    if (a.origen === 'manual' || a.origen === 'archivo') b.append(el('span', 'tag', a.origen === 'archivo' ? 'subida' : 'manual'));
    li.append(b);
    if (borrar && (a.origen === 'manual' || a.origen === 'archivo')) {
      const x = el('button', 'icon-btn', '×'); x.setAttribute('aria-label', 'Borrar entreno');
      x.onclick = async () => { if (await confirmar('Borrar entreno', `¿Borrar «${a.nombre}» del ${a.fecha}?`, 'Borrar')) { ST.acts = ST.acts.filter((y) => y.id !== a.id); await guardar('acts'); recalcular(); toast('Entreno borrado'); } };
      li.append(x);
    }
    return li;
  }

  // activos por fecha (los que no tienen fecha, detrás) y los ya pasados al final
  function objetivosOrdenados() {
    const h = iso(hoy());
    const clave = (o) => (o.dia && o.dia < h ? '2' : o.dia ? '0' + o.dia : '1');
    return (R ? R.objetivos : []).slice().sort((a, b) => (clave(a) < clave(b) ? -1 : 1));
  }

  // registro rápido de peso (objetivos de peso)
  function formPeso(o) {
    const f = el('form', 'peso-form');
    const inp = el('input'); inp.type = 'text'; inp.inputMode = 'decimal'; inp.autocomplete = 'off';
    inp.placeholder = 'Peso de hoy (kg)'; inp.setAttribute('aria-label', 'Peso de hoy en kg'); inp.id = `peso-${o.id}-${Math.random().toString(36).slice(2, 6)}`;
    const b = el('button', 'btn small primary', 'Guardar'); b.type = 'submit';
    f.append(inp, b);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const v = parseFloat(String(inp.value).replace(',', '.'));
      if (!(v >= 30 && v <= 250)) { toast('Escribe tu peso en kg, por ejemplo 78,5'); return; }
      const dia = iso(hoy());
      ST.perfil.pesos = (ST.perfil.pesos || []).filter((p) => p.dia !== dia).concat({dia, kg: v});
      await guardar('perfil'); recalcular(); toast(`Peso guardado: ${nf(v, 1)} kg`);
    };
    return f;
  }

  function tarjetaObjetivo(o, mini) {
    const c = el('article', mini ? 'goal mini' : 'goal card');
    const pasado = o.dia && o.dia < iso(hoy());
    if (pasado) c.classList.add('past');
    const head = el('div', 'goal-head'); head.append(el('b', 'goal-name', o.objetivo), el('span', `chip is-${nivelObj(o.estado)}`, o.estado));
    let cuando = o.fecha_txt;
    if (o.dia) {
      const n = Math.round((parse(o.dia) - hoy()) / 864e5);
      const aprox = !/^\d/.test(o.fecha_txt);
      cuando += ` · ${n > 0 ? `${aprox ? 'unos ' : ''}${nf(n)} días` : n === 0 ? 'hoy' : 'ya pasó'}`;
    }
    c.append(head, el('span', 'tnote', cuando));
    if (o.nums) {
      const nums = el('div', 'goal-nums');
      o.nums.forEach(([k, v]) => { const d = el('div'); d.append(el('span', 'tlabel', k), el('span', 'big', v)); nums.append(d); });
      c.append(nums);
    } else if (o.base) c.append(el('p', 'note', o.base));
    if (o.progreso != null) {
      const bar = el('div', 'progress'); bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuenow', Math.round(o.progreso * 100)); bar.setAttribute('aria-valuemin', 0); bar.setAttribute('aria-valuemax', 100);
      const fill = el('span', `is-${nivelObj(o.estado)}`); fill.style.width = `${Math.round(o.progreso * 100)}%`; bar.append(fill);
      c.append(bar);
    }
    if (o.tipo === 'peso' && !pasado) c.append(formPeso(o));
    if (!mini && o.nums) {
      c.append(el('p', 'note', o.base));
      o.notas.forEach((t) => c.append(el('p', 'note', t)));
      if (o.tipo === 'carrera' && o.ref_km) {
        const det = el('details', 'how');
        det.append(el('summary', null, '¿Cómo se calcula el nivel actual?'));
        const p1 = el('p'); p1.append('Con la ', el('strong', null, 'fórmula de Riegel'), ': tiempo = tiempo de referencia × (distancia ÷ km de referencia)', el('sup', null, '1,06'), '. El 1,06 recoge que en carreras más largas baja el ritmo.');
        const p2 = el('p'); p2.append('Referencia: tu mejor carrera continua reciente, del ', el('b', null, o.ref_fecha), ': ', el('b', null, `${nf(o.ref_km, 1)} km`), ' en ', el('b', null, o.ref_tiempo), ` (${o.ref_ritmo}/km), que proyecta `, el('b', null, o.estimacion), '.');
        det.append(p1, p2, el('p', null, 'Da por hecho que has entrenado la distancia: con poco volumen puede ser optimista.'));
        c.append(det);
      }
    }
    return c;
  }

  // ------------------------------------------------------------ semana
  const MINUTOS = [30, 45, 60, 75, 90, 120, 150, 180];
  let selDias = null, selMin = null, editandoPlan = false;
  // editor de días y minutos reutilizable (semana y plan completo)
  function editorDias(boxDias, boxMin, estado, primero, repintar) {
    boxDias.replaceChildren();
    DIAS.forEach((d, i) => {
      const b = el('button', `day ${estado.dias.has(i) ? 'on' : ''}`, d.slice(0, 2)); b.type = 'button'; b.setAttribute('aria-pressed', estado.dias.has(i)); b.title = d;
      b.disabled = i < primero;
      b.onclick = () => { estado.dias.has(i) ? estado.dias.delete(i) : estado.dias.add(i); repintar(); };
      boxDias.append(b);
    });
    boxMin.replaceChildren();
    [...estado.dias].sort().forEach((i) => {
      const lab = el('label', 'min-row'); lab.append(el('span', null, DIAS[i]));
      const s = el('select');
      MINUTOS.forEach((m) => { const o = el('option', null, m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`); o.value = m; s.append(o); });
      s.value = estado.min[i] || (i >= 5 ? 90 : 60);
      s.onchange = () => { estado.min[i] = +s.value; };
      lab.append(s); boxMin.append(lab);
    });
  }
  const minutosDe = (estado) => { const m = {}; estado.dias.forEach((d) => { m[d] = estado.min[d] || (d >= 5 ? 90 : 60); }); return m; };

  // ---------------------------------------------- plan completo
  let pc = null, editandoPC = false;
  function rango(semIso) { const a = parse(semIso), b = addDays(a, 6); return `${a.getUTCDate()} ${window.AN.MES[a.getUTCMonth()]} – ${b.getUTCDate()} ${window.AN.MES[b.getUTCMonth()]}`; }
  function pintarCompleto() {
    const plan = ST.ajustes.planCompleto;
    if (!pc) pc = {dias: new Set(plan ? plan.disponibles : (selDias ? [...selDias] : [1, 3, 5, 6])), min: {...(plan ? plan.minutosDia : {}), ...(ST.ajustes.minutosDia || {})}};
    const comps = (R ? R.objetivos : []).filter((o) => o.dia && o.dia > iso(hoy())).sort((a, b) => (a.dia < b.dia ? -1 : 1));
    $('#pc-resumen-obj').textContent = comps.length
      ? `Orden de tus objetivos: ${comps.map((o, i) => `${i + 1}) ${o.objetivo} (${fechaTxt(parse(o.dia)).replace(/ \d{4}$/, '')})`).join(' → ')}.`
      : 'No tienes objetivos con fecha: se generarán 12 semanas según tus objetivos personales. Añade fechas en Perfil para un plan hasta tus pruebas.';
    $('#pc-form').hidden = !!plan && !editandoPC;
    $('#pc-cancelar').hidden = !plan;
    editorDias($('#pc-dias'), $('#pc-minutos'), pc, 0, pintarCompleto);
    $('#pc-generar').disabled = !pc.dias.size;
    $('#pc-generar').textContent = !pc.dias.size ? 'Elige al menos un día' : plan ? 'Regenerar plan' : 'Generar plan';

    const vista = $('#pc-vista'); vista.replaceChildren();
    if (!plan) return;
    const actual = iso(lunes(hoy()));
    const kmTot = plan.semanas.reduce((s, x) => s + (x.kmCarrera || 0), 0);
    const head = el('div', 'card');
    const h = el('div', 'card-head'); h.append(el('h2', null, `Tu plan: ${plan.semanas.length} semanas`));
    const b = el('button', 'link', 'Cambiar días'); b.onclick = () => { editandoPC = true; pintarCompleto(); window.scrollTo(0, 0); }; h.append(b);
    head.append(h, el('p', 'note', `Del ${fechaTxt(parse(plan.desde))} al ${fechaTxt(addDays(parse(plan.hasta), 6))} · ${plan.disponibles.length} días por semana · ${nf(kmTot)} km de carrera en total. Generado el ${fechaTxt(new Date(plan.creado))}.`));
    // fases en orden con su número de semanas
    const fasesUl = el('ol', 'pc-fases');
    const grupos = [];
    plan.semanas.forEach((s) => { const g = grupos[grupos.length - 1]; if (g && g.fase === s.fase) g.semanas.push(s); else grupos.push({fase: s.fase, semanas: [s]}); });
    grupos.forEach((g) => { const li = el('li'); li.append(el('b', null, g.fase), el('span', null, ` · ${g.semanas.length} ${g.semanas.length === 1 ? 'semana' : 'semanas'} · desde el ${rango(g.semanas[0].semana).split(' – ')[0]}`)); fasesUl.append(li); });
    head.append(fasesUl);
    head.append(el('p', 'note', 'Cada domingo, en «Esta semana», la app recalcula la semana con tus datos reales. Si cambias tus objetivos, regenera el plan.'));
    vista.append(head);
    const abierta = (plan.semanas.find((x) => x.semana >= actual) || {}).semana;
    grupos.forEach((g) => {
      vista.append(el('h3', 'pc-grupo', g.fase));
      g.semanas.forEach((s) => {
        const d = el('details', `card pc-semana${s.semana === actual ? ' now' : ''}`);
        if (s.semana === abierta) d.open = true;
        const sum = el('summary');
        const t = el('div', 'pc-top'); t.append(el('b', null, `Semana ${s.numero}`), el('span', 'ses-meta', rango(s.semana)));
        const tags = el('div', 'pc-tags');
        if (s.semana === actual) tags.append(el('span', 'chip is-ok', 'esta semana'));
        if (s.competicion) tags.append(el('span', 'chip is-bad', `competición: ${s.competicion}`));
        if (s.recuperacion) tags.append(el('span', 'chip is-muted', 'recuperación'));
        if (s.descarga) tags.append(el('span', 'chip is-warn', 'descarga'));
        const m = el('span', 'ses-meta', `${s.sesiones.length} sesiones · ${nf(s.horas, 1)} h${s.kmCarrera ? ` · ${s.kmCarrera} km de carrera` : ''}`);
        sum.append(t, tags, m);
        d.append(sum);
        s.notas.forEach((n) => d.append(el('p', 'callout', n)));
        const box = el('div'); listaSesiones(box, s, false); d.append(box);
        vista.append(d);
      });
    });
  }
  $('#pc-generar').addEventListener('click', async () => {
    if (!pc.dias.size) return;
    const minutos = minutosDe(pc);
    const desde = iso(addDays(lunes(hoy()), 7));
    ST.ajustes.planCompleto = window.PLAN.generarCompleto(R, ST.perfil, desde, [...pc.dias], minutos);
    ST.ajustes.minutosDia = {...(ST.ajustes.minutosDia || {}), ...minutos};
    editandoPC = false;
    await guardar('ajustes');
    toast(`Plan generado: ${ST.ajustes.planCompleto.semanas.length} semanas`);
    pintarCompleto(); window.scrollTo(0, 0);
  });
  $('#pc-cancelar').addEventListener('click', () => { editandoPC = false; pintarCompleto(); });

  function pintarSemana() {
    $$('#sem-seg button').forEach((b) => { b.classList.toggle('on', b.dataset.sseg === segSem); b.setAttribute('aria-selected', b.dataset.sseg === segSem); });
    // sin historial no hay plan: no sabemos de dónde parte la persona
    const sinHistorial = !window.PLAN.puedePlanificar(R);
    $('#sin-historial').hidden = !sinHistorial;
    $('#ss-semana').hidden = sinHistorial || segSem !== 'semana';
    $('#ss-completo').hidden = sinHistorial || segSem !== 'completo';
    if (sinHistorial) return;
    if (segSem === 'completo') { pintarCompleto(); return; }
    const w = semanaObjetivo(), wIso = iso(w);
    const plan = ST.planes[wIso];
    const prev = ST.planes[iso(addDays(w, -7))] || Object.values(ST.planes).sort((a, b) => (a.semana < b.semana ? 1 : -1))[0];
    if (!selDias) { selDias = new Set(prev ? prev.disponibles : [1, 3, 5, 6]); selMin = {...(prev ? prev.minutosDia : {}), ...(ST.ajustes.minutosDia || {})}; }
    $('#plan-form-card').hidden = !!plan && !editandoPlan;
    const fin = addDays(w, 6);
    // a mitad de semana solo se puede planificar de hoy en adelante
    const primero = Math.max(0, Math.round((hoy() - w) / 864e5));
    [...selDias].forEach((d) => { if (d < primero) selDias.delete(d); });
    $('#plan-form-titulo').textContent = primero ? `¿Qué días te quedan para entrenar hasta el ${fechaTxt(fin)}?` : `¿Cuántos días vas a entrenar del ${w.getUTCDate()} al ${fechaTxt(fin)}?`;
    const dias = $('#plan-dias'); dias.replaceChildren();
    DIAS.forEach((d, i) => {
      const b = el('button', `day ${selDias.has(i) ? 'on' : ''}`, d.slice(0, 2)); b.type = 'button'; b.setAttribute('aria-pressed', selDias.has(i)); b.title = d;
      b.disabled = i < primero;
      b.onclick = () => { selDias.has(i) ? selDias.delete(i) : selDias.add(i); pintarSemana(); };
      dias.append(b);
    });
    const mins = $('#plan-minutos'); mins.replaceChildren();
    [...selDias].sort().forEach((i) => {
      const lab = el('label', 'min-row'); lab.append(el('span', null, DIAS[i]));
      const s = el('select'); s.id = `min-${i}`;
      MINUTOS.forEach((m) => { const o = el('option', null, m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`); o.value = m; s.append(o); });
      s.value = selMin[i] || (i >= 5 ? 90 : 60);
      s.onchange = () => { selMin[i] = +s.value; };
      lab.append(s); mins.append(lab);
    });
    $('#plan-crear').disabled = !selDias.size;
    $('#plan-crear').textContent = selDias.size ? 'Proponer entrenos' : 'Elige al menos un día';

    const vista = $('#plan-vista'); vista.replaceChildren();
    const mostrar = (p, titulo) => {
      const c = el('div', 'card');
      const head = el('div', 'card-head'); head.append(el('h2', null, titulo));
      if (p === plan) { const b = el('button', 'link', 'Cambiar días'); b.onclick = () => { editandoPlan = true; pintarSemana(); window.scrollTo(0, 0); }; head.append(b); }
      c.append(head, el('p', 'note', `${p.fase} · ${p.sesiones.length} sesiones${p.kmCarrera ? ` · ${p.kmCarrera} km de carrera` : ''}`));
      p.notas.forEach((n) => c.append(el('p', 'callout', n)));
      const box = el('div'); listaSesiones(box, p, false); c.append(box);
      vista.append(c);
    };
    if (plan) mostrar(plan, `Semana del ${w.getUTCDate()} ${window.AN.MES[w.getUTCMonth()]}`);
    const actual = iso(lunes(hoy()));
    if (actual !== wIso && ST.planes[actual]) mostrar(ST.planes[actual], 'Esta semana (en curso)');
    if (!plan && !ST.planes[actual]) vista.append(el('p', 'note center', 'Elige tus días y pulsa «Proponer» para ver los entrenos.'));
  }
  $('#plan-crear').addEventListener('click', async () => {
    const wIso = iso(semanaObjetivo());
    $$('#plan-minutos select').forEach((s) => { selMin[+s.id.slice(4)] = +s.value; });
    const minutos = {}; selDias.forEach((d) => { minutos[d] = selMin[d] || (d >= 5 ? 90 : 60); });
    ST.planes[wIso] = window.PLAN.proponer(R, ST.perfil, wIso, [...selDias], minutos);
    ST.ajustes.minutosDia = {...(ST.ajustes.minutosDia || {}), ...minutos};
    editandoPlan = false;
    await guardar('planes', 'ajustes');
    toast('Plan de la semana listo');
    pintarSemana();
  });

  // ------------------------------------------------------------ añadir entreno
  function prepararFormulario() {
    if (!$('#f-fecha').value) $('#f-fecha').value = iso(hoy());
    actualizarCamposDeporte();
  }
  function actualizarCamposDeporte() {
    const sp = $('#f-sport').value;
    $('#f-hevy-wrap').hidden = sp !== 'strength';
    $('#f-km').closest('label').hidden = sp === 'strength' || sp === 'hyrox' || sp === 'other';
  }
  $('#f-sport').addEventListener('change', actualizarCamposDeporte);
  $('#f-rpe').addEventListener('input', () => { $('#f-rpe-v').textContent = $('#f-rpe').value; });
  let archivoExtra = null;  // datos del archivo que el formulario no muestra (FC máx., desnivel)
  // repetida si empieza a la misma hora (±10 min) o si es el mismo día, deporte y duración parecida
  const mismoArchivo = (a, b) => Math.abs(new Date(a.fecha) - new Date(b.fecha)) < 10 * 60000 || mismoEntreno(a, b);
  // guarda directamente una lista de archivos de actividad (varios desde el selector o compartidos desde otra app)
  async function guardarArchivos(files) {
    let ok = 0, rep = 0; const fallos = [];
    for (const f of files) {
      try {
        const t = await window.IMP.leerActividad(f);
        const a = {id: 'f' + Date.now() + '-' + ok, origen: 'archivo', tipo: '', esfuerzo: null, rpe: null, descripcion: null, ...t,
          sport: t.sport || 'other', nombre: t.nombre || NOMBRE_DEF[t.sport || 'other']};
        if (ST.acts.some((b) => mismoArchivo(a, b))) { rep++; continue; }
        ST.acts.push(a); ok++;
      } catch (err) { fallos.push(f.name); }
    }
    await guardar('acts'); recalcular();
    const pl = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
    toast(`${ok ? `Guardada${ok === 1 ? '' : 's'} ${pl(ok, 'actividad', 'actividades')}. Métricas actualizadas` : 'Ninguna actividad nueva'}${rep ? `; ${pl(rep, 'ya estaba', 'ya estaban')}` : ''}${fallos.length ? `; no he podido leer: ${fallos.join(', ')}` : ''}.`);
    return ok;
  }
  $('#f-archivo').addEventListener('change', async (e) => {
    const files = [...e.target.files]; e.target.value = '';
    if (!files.length) return;
    if (files.length > 1) { if (await guardarArchivos(files)) ir('inicio'); return; }
    const f = files[0];
    try {
      const t = await window.IMP.leerActividad(f);
      archivoExtra = {fc_max: t.fc_max, desnivel: t.desnivel || 0, seg_total: t.seg_total, metros: t.metros, origen: 'archivo'};
      if (t.sport) $('#f-sport').value = t.sport;
      $('#f-fecha').value = t.fecha.slice(0, 10); $('#f-hora').value = t.fecha.slice(11, 16);
      const min = Math.round(t.seg_mov / 60); $('#f-h').value = Math.floor(min / 60); $('#f-m').value = min % 60;
      if (t.metros) $('#f-km').value = (t.metros / 1000).toFixed(2);
      if (t.fc) $('#f-fc').value = Math.round(t.fc);
      if (t.nombre) $('#f-nombre').value = t.nombre;
      actualizarCamposDeporte();
      toast('Datos del archivo cargados. Revisa y guarda.');
    } catch (err) { toast('No he podido leer el archivo: ' + err.message); }
  });
  const NOMBRE_DEF = {run: 'Carrera', strength: 'Fuerza', hyrox: 'HYROX / funcional', bike: 'Bici', swim: 'Natación', walk: 'Caminata', other: 'Entreno'};
  $('#f-entreno').addEventListener('submit', async (e) => {
    e.preventDefault();
    const sp = $('#f-sport').value;
    const seg = ((+$('#f-h').value || 0) * 60 + (+$('#f-m').value || 0)) * 60;
    if (seg <= 0) { toast('Pon la duración del entreno.'); return; }
    const hevy = $('#f-hevy').value.trim(), notas = $('#f-notas').value.trim();
    const km = parseFloat(String($('#f-km').value).replace(',', '.'));
    const a = {
      id: 'm' + Date.now(), origen: 'manual', sport: sp, tipo: '', fecha: `${$('#f-fecha').value}T${$('#f-hora').value || '12:00'}:00`,
      nombre: $('#f-nombre').value.trim() || NOMBRE_DEF[sp], seg_mov: seg, seg_total: seg,
      metros: Number.isFinite(km) && !$('#f-km').closest('label').hidden ? km * 1000 : 0,
      fc: +$('#f-fc').value || null, fc_max: null, esfuerzo: null, rpe: +$('#f-rpe').value, desnivel: 0,
      descripcion: [sp === 'strength' ? hevy : '', notas].filter(Boolean).join('\n\n') || null,
    };
    if (archivoExtra) {
      a.origen = 'archivo'; a.fc_max = archivoExtra.fc_max; a.desnivel = archivoExtra.desnivel;
      a.seg_total = Math.max(seg, archivoExtra.seg_total || 0);
    }
    ST.acts.push(a);
    await guardar('acts');
    archivoExtra = null;
    $('#f-entreno').reset(); $('#f-rpe-v').textContent = '6'; $('#f-fecha').value = '';
    recalcular();
    toast('Entreno guardado. Métricas actualizadas.');
    ir('inicio');
  });

  // ------------------------------------------------------------ progreso
  function pintarProgreso() {
    $$('#v-progreso .seg button').forEach((b) => { b.classList.toggle('on', b.dataset.seg === seg); b.setAttribute('aria-selected', b.dataset.seg === seg); });
    $$('.seg-view').forEach((v) => { v.hidden = v.id !== `s-${seg}`; });
    if (!R) return;
    const sinDatos = (box) => box.replaceChildren(el('p', 'note', 'Importa tu Strava o añade entrenos para ver esta gráfica.'));
    if (seg === 'objetivos') {
      const g = $('#goals'); g.replaceChildren();
      if (!R.objetivos.length) { const p = el('p', 'note card', 'Aún no tienes objetivos. Añádelos en Perfil.'); g.append(p); }
      objetivosOrdenados().forEach((o) => g.append(tarjetaObjetivo(o)));
      window.CH.plan($('#g-plan'), R);
      const ol = $('#fases'); ol.replaceChildren();
      const h = iso(hoy());
      R.fases.forEach((f) => {
        const ahora = f.desde <= h && h <= f.hasta;
        const li = el('li', ahora ? 'now' : '');
        const w = el('span', 'what'); w.append(el('strong', null, f.titulo), el('span', null, f.texto));
        if (f.paralelo) w.append(el('em', null, f.paralelo));
        li.append(el('span', 'when', f.cuando + (ahora ? ' · ahora' : '')), w); ol.append(li);
      });
    } else if (seg === 'carga') {
      if (R.vacio) { sinDatos($('#g-pmc')); sinDatos($('#g-semanas')); return; }
      window.CH.pmc($('#g-pmc'), R);
      window.CH.semanas($('#g-semanas'), R);
      const ley = $('#leyenda'); ley.replaceChildren();
      ORDEN.forEach((k, i) => { const li = el('li'); li.append(el('i', `sw${i}`), ETIQUETA[k]); ley.append(li); });
      const tb = $('#t-90 tbody'); tb.replaceChildren();
      R.deportes90.forEach((r) => { const tr = el('tr'); [r.deporte, nf(r.sesiones), nf(r.horas, 1), nf(r.km, 1)].forEach((v, i) => tr.append(el('td', i ? 'num' : '', v))); tb.append(tr); });
    } else if (seg === 'carrera') {
      if (R.vacio) { sinDatos($('#g-ritmo')); sinDatos($('#g-efi')); return; }
      window.CH.scatter($('#g-ritmo'), R, 'ritmo_min_km', true, (v) => ritmo(v));
      window.CH.scatter($('#g-efi'), R, 'm_por_latido', false, (v) => nf(v, 2));
      const tb = $('#t-mejores tbody'); tb.replaceChildren();
      R.mejores.forEach((r) => { const tr = el('tr'); [r.distancia, r.fecha, nf(r.km, 1), `${r.ritmo}/km`].forEach((v, i) => tr.append(el('td', i > 1 ? 'num' : '', v))); tb.append(tr); });
    } else if (seg === 'fuerza') {
      const hay = !R.vacio && window.CH.fuerza($('#g-fuerza'), R);
      if (R.vacio) $('#g-fuerza').replaceChildren();
      $('#fuerza-vacio').hidden = !!hay;
    } else if (seg === 'historial') {
      const ul = $('#historial'); ul.replaceChildren();
      if (R.vacio) { ul.append(el('li', 'note', 'Sin entrenos todavía.')); return; }
      // historial completo, del más reciente al más antiguo
      const lista = R.acts.slice().reverse().slice(0, 150).map((a) => ({
        id: a.id, fecha: fechaTxt(a.d), nombre: a.nombre, sport: a.sport, deporte: ETIQUETA[a.sport],
        duracion: a.min >= 60 ? `${Math.floor(a.min / 60)} h ${String(Math.round(a.min % 60)).padStart(2, '0')} min` : `${Math.round(a.min)} min`,
        km: a.km || null, fc: a.fc, carga: Math.round(a.carga), origen: a.origen}));
      lista.forEach((a) => ul.append(filaActividad(a, true)));
      if (R.acts.length > 150) ul.append(el('li', 'note', `Y ${R.acts.length - 150} entrenos más antiguos.`));
    }
  }

  // ------------------------------------------------------------ perfil
  function pintarPerfil() {
    $('#p-nombre').value = ST.perfil.nombre || '';
    $('#p-fcmax').value = ST.perfil.fc_max || ''; $('#p-fcmax').placeholder = R && R.meta && R.meta.fc_max ? `auto: ${Math.round(R.meta.fc_max)}` : 'auto';
    $('#p-fcrep').value = ST.perfil.fc_reposo || '';
    $('#p-nac').value = ST.perfil.fecha_nacimiento || ''; $('#p-nac').max = iso(hoy());
    $('#p-altura').value = ST.perfil.altura_cm || '';
    const ult = ST.ajustes.ultimaImportacion;
    $('#p-import-estado').textContent = ult
      ? `Última importación: ${fechaTxt(new Date(ult.fecha))} (${nf(ult.n)} actividades). ${Math.floor((Date.now() - new Date(ult.fecha)) / 864e5) >= 7 ? 'Toca actualizar.' : 'Al día.'}`
      : 'Aún no has importado tu Strava.';
    const ul = $('#obj-lista'); ul.replaceChildren();
    const objs = (ST.perfil.objetivos || []).slice().sort((a, b) => ((a.dia || '9') < (b.dia || '9') ? -1 : 1));
    if (!objs.length) ul.append(el('li', 'note', 'Sin objetivos. Añade lo que quieras conseguir (estar en forma, bajar peso, una carrera…) para que el plan se adapte.'));
    const TIPO = {forma: 'Estar en forma', peso: 'Peso', fuerza: 'Fuerza', volumen: 'Volumen', otro: 'Otro', carrera: 'Carrera', hyrox: 'HYROX', triatlon: 'Triatlón',
      trail: 'Trail', ocr: 'Obstáculos', duatlon: 'Duatlón', ciclismo: 'Ciclismo', aguas: 'Aguas abiertas'};
    objs.forEach((o) => {
      const li = el('li', 'obj');
      const b = el('div', 'act-body');
      const meta = o.meta_min ? `meta ${Math.floor(o.meta_min / 60)}:${String(o.meta_min % 60).padStart(2, '0')}`
        : o.tipo === 'peso' ? `de ${nf(o.peso_inicial, 1)} a ${nf(o.peso_objetivo, 1)} kg`
          : o.tipo === 'fuerza' ? `${o.ejercicio}: ${nf(o.rm_objetivo, 1)} kg`
            : o.tipo === 'forma' ? `${o.dias_semana} días/semana` : o.tipo === 'volumen' ? `${nf(o.km_objetivo)} km` : '';
      b.append(el('b', null, o.objetivo), el('div', 'act-meta', [TIPO[o.tipo], o.dia ? fechaTxt(parse(o.dia)) : 'sin fecha', meta].filter(Boolean).join(' · ')));
      const ed = el('button', 'link', 'Editar'); ed.onclick = () => abrirObjetivo(o);
      const x = el('button', 'icon-btn', '×'); x.setAttribute('aria-label', 'Borrar objetivo');
      x.onclick = async () => { if (await confirmar('Borrar objetivo', `¿Borrar «${o.objetivo}»?`, 'Borrar')) { ST.perfil.objetivos = ST.perfil.objetivos.filter((y) => y.id !== o.id); await guardar('perfil'); recalcular(); } };
      li.append(b, ed, x); ul.append(li);
    });
    $('#r-notif').hidden = !('Notification' in window && 'serviceWorker' in navigator);
  }
  $('#f-perfil').addEventListener('submit', async (e) => {
    e.preventDefault();
    ST.perfil.nombre = $('#p-nombre').value.trim();
    ST.perfil.fc_max = +$('#p-fcmax').value || null;
    ST.perfil.fc_reposo = +$('#p-fcrep').value || null;
    const nac = $('#p-nac').value, alt = +$('#p-altura').value;
    ST.perfil.fecha_nacimiento = /^\d{4}-\d{2}-\d{2}$/.test(nac) && nac <= iso(hoy()) ? nac : null;
    ST.perfil.altura_cm = alt >= 100 && alt <= 230 ? alt : null;
    await guardar('perfil'); recalcular(); toast('Perfil guardado');
  });

  const COMP = window.AN.COMPETICION;
  const EJEMPLO = {forma: 'Estar en forma', peso: 'Bajar 10 kg', fuerza: 'Sentadilla a 100 kg', volumen: 'Correr 1.000 km este año', otro: 'Subir el Teide andando',
    carrera: 'Media maratón de Madrid', hyrox: 'HYROX Madrid', triatlon: 'Triatlón de Valencia', trail: 'Trail de Guadarrama',
    ocr: 'Spartan Race Madrid', duatlon: 'Duatlón de Alcobendas', ciclismo: 'Quebrantahuesos', aguas: 'Travesía a nado de 3 km'};
  const DIST_CARRERA = ['5', '10', '15', '21.0975', '30', '42.195'];
  const num = (id) => { const v = parseFloat(String($(id).value).replace(',', '.')); return Number.isFinite(v) ? v : null; };
  function abrirObjetivo(o) {
    const f = $('#f-obj'); f.hidden = false;
    const v = (id, x) => { $(id).value = x == null ? '' : x; };
    v('#o-id', o && o.id); v('#o-tipo', o ? o.tipo : 'forma'); v('#o-nombre', o && o.objetivo);
    const dk = o && o.tipo === 'carrera' && o.distancia_km ? String(o.distancia_km) : '21.0975';
    v('#o-dist', DIST_CARRERA.includes(dk) ? dk : 'otra'); v('#o-dist-otra', DIST_CARRERA.includes(dk) ? null : String(dk).replace('.', ','));
    v('#o-tri', (o && o.tipo === 'triatlon' && o.distancia) || 'olimpico'); v('#o-dua', (o && o.tipo === 'duatlon' && o.distancia) || 'sprint');
    v('#o-km-comp', o && ['trail', 'ocr', 'ciclismo', 'aguas'].includes(o.tipo) ? String(o.distancia_km).replace('.', ',') : null); v('#o-desnivel', o && o.desnivel);
    v('#o-dia', o && o.dia);
    v('#o-h', o && o.meta_min ? Math.floor(o.meta_min / 60) : null); v('#o-m', o && o.meta_min ? o.meta_min % 60 : null);
    const pesos = ST.perfil.pesos || [];
    v('#o-peso-ini', o ? o.peso_inicial : (pesos.length ? pesos[pesos.length - 1].kg : null)); v('#o-peso-obj', o && o.peso_objetivo);
    v('#o-ej', o && o.ejercicio); v('#o-rm', o && o.rm_objetivo);
    v('#o-dias', (o && o.dias_semana) || 4); v('#o-forma', o && o.forma_objetivo);
    v('#o-dep', (o && o.deporte) || 'run'); v('#o-km', o && o.km_objetivo); v('#o-desde', (o && o.desde) || iso(hoy()));
    v('#o-enfoque', (o && o.enfoque) || 'forma'); v('#o-nota', o && o.nota);
    const dl = $('#o-ej-lista'); dl.replaceChildren(...((R && R.ejercicios) || []).map((e) => { const op = el('option'); op.value = e; return op; }));
    tipoObjetivo();
    f.scrollIntoView({behavior: 'smooth', block: 'center'});
  }
  function tipoObjetivo() {
    const t = $('#o-tipo').value;
    $$('#f-obj [data-tipos]').forEach((x) => { x.hidden = !x.dataset.tipos.split(',').includes(t); });
    const comp = COMP.includes(t);
    $('#o-dia').required = comp || t === 'peso' || t === 'volumen';
    $('#o-dia-label').textContent = comp ? 'Fecha de la competición' : $('#o-dia').required ? 'Fecha límite' : 'Fecha límite (opcional)';
    $('#o-nombre').placeholder = `Por ejemplo: ${EJEMPLO[t]}`;
    $('#o-peso-ini').required = $('#o-peso-obj').required = t === 'peso';
    $('#o-ej').required = $('#o-rm').required = t === 'fuerza';
    $('#o-km').required = t === 'volumen';
    $('#o-km-comp').required = ['trail', 'ocr', 'ciclismo', 'aguas'].includes(t);
    $('#o-dist-otra-wrap').hidden = !(t === 'carrera' && $('#o-dist').value === 'otra');
    $('#o-dist-otra').required = !$('#o-dist-otra-wrap').hidden;
  }
  $('#o-tipo').addEventListener('change', tipoObjetivo);
  $('#o-dist').addEventListener('change', tipoObjetivo);
  $('#obj-nuevo').addEventListener('click', () => abrirObjetivo(null));
  $('#o-cancelar').addEventListener('click', () => { $('#f-obj').hidden = true; });
  $('#f-obj').addEventListener('submit', async (e) => {
    e.preventDefault();
    const tipo = $('#o-tipo').value;
    const prev = (ST.perfil.objetivos || []).find((y) => y.id === $('#o-id').value);
    const o = {id: $('#o-id').value || 'o' + Date.now(), tipo, objetivo: $('#o-nombre').value.trim() || EJEMPLO[tipo], dia: $('#o-dia').value || null,
      creado: (prev && prev.creado) || iso(hoy())};
    if (COMP.includes(tipo)) { const m = (+$('#o-h').value || 0) * 60 + (+$('#o-m').value || 0); o.meta_min = m || null; }
    if (tipo === 'carrera') o.distancia_km = $('#o-dist').value === 'otra' ? num('#o-dist-otra') : +$('#o-dist').value;
    if (tipo === 'triatlon') o.distancia = $('#o-tri').value;
    if (tipo === 'duatlon') o.distancia = $('#o-dua').value;
    if (['trail', 'ocr', 'ciclismo', 'aguas'].includes(tipo)) { o.distancia_km = num('#o-km-comp'); if (tipo !== 'aguas') o.desnivel = +$('#o-desnivel').value || 0; }
    if (tipo === 'peso') {
      o.peso_inicial = num('#o-peso-ini'); o.peso_objetivo = num('#o-peso-obj');
      // el peso actual también se apunta en el registro si no hay nada de hoy
      const dia = iso(hoy());
      if (o.peso_inicial && !(ST.perfil.pesos || []).some((p) => p.dia === dia)) ST.perfil.pesos = (ST.perfil.pesos || []).concat({dia, kg: o.peso_inicial});
    }
    if (tipo === 'fuerza') { o.ejercicio = $('#o-ej').value.trim(); o.rm_objetivo = num('#o-rm'); }
    if (tipo === 'forma') { o.dias_semana = +$('#o-dias').value; o.forma_objetivo = num('#o-forma'); }
    if (tipo === 'volumen') { o.deporte = $('#o-dep').value; o.km_objetivo = num('#o-km'); o.desde = $('#o-desde').value || iso(hoy()); }
    if (tipo === 'otro') { o.enfoque = $('#o-enfoque').value; o.nota = $('#o-nota').value.trim(); }
    ST.perfil.objetivos = (ST.perfil.objetivos || []).filter((y) => y.id !== o.id).concat(o);
    await guardar('perfil');
    $('#f-obj').hidden = true;
    recalcular(); toast('Objetivo guardado. El plan se adaptará a él la próxima vez que planifiques.');
  });

  // importación de Strava (inicio y perfil)
  const mismoEntreno = (s, m) => s.fecha.slice(0, 10) === m.fecha.slice(0, 10) && deporte(s) === (m.sport || deporte(m))
    && Math.abs(s.seg_mov - m.seg_mov) <= 0.35 * Math.max(s.seg_mov, m.seg_mov);
  $$('[data-import-strava]').forEach((inp) => inp.addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    toast('Leyendo tu export de Strava…');
    try {
      const {acts, perfil} = await window.IMP.leerStrava(f);
      const manual = ST.acts.filter((a) => a.origen !== 'strava');
      const quedan = manual.filter((m) => !acts.some((s) => mismoEntreno(s, m)));
      ST.acts = acts.concat(quedan);
      if (!ST.perfil.nombre && perfil && perfil.nombre) ST.perfil.nombre = perfil.nombre;
      ST.ajustes.ultimaImportacion = {fecha: new Date().toISOString(), n: acts.length};
      await guardar('acts', 'perfil', 'ajustes');
      recalcular();
      const sust = manual.length - quedan.length;
      toast(`Importadas ${nf(acts.length)} actividades${sust ? `; ${sust === 1 ? '1 añadida a mano se ha sustituido' : `${sust} añadidas a mano se han sustituido`} por su versión de Strava` : ''}.`);
    } catch (err) { console.error(err); toast('No he podido importar: ' + err.message); }
  }));

  // recordatorio del domingo (.ics)
  $('#r-ics').addEventListener('click', () => {
    const [hh, mm] = ($('#r-hora').value || '19:00').split(':');
    const n = new Date(); const dom = new Date(n.getFullYear(), n.getMonth(), n.getDate() + ((7 - n.getDay()) % 7));
    const p = (x) => String(x).padStart(2, '0');
    const inicio = `${dom.getFullYear()}${p(dom.getMonth() + 1)}${p(dom.getDate())}T${hh}${mm}00`;
    const url = location.origin + location.pathname + '#semana';
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Entreno//ES', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      `UID:entreno-domingo-${Date.now()}@entreno`, `DTSTAMP:${stamp}`, `DTSTART:${inicio}`, 'DURATION:PT15M', 'RRULE:FREQ=WEEKLY;BYDAY=SU',
      'SUMMARY:Planifica tu semana de entreno', `DESCRIPTION:Abre la app\\, sube tu export de Strava y dime cuántos días vas a entrenar: ${url}`, `URL:${url}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Planifica tu semana de entreno', 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = el('a'); a.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics); a.download = 'entreno-domingos.ics';
    document.body.append(a); a.click(); a.remove();
    toast('Abre el archivo descargado y añádelo a tu calendario.');
  });
  $('#r-notif').addEventListener('click', async () => {
    const txt = $('#r-notif-txt'); txt.hidden = false;
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { txt.textContent = 'No has dado permiso para notificaciones.'; return; }
      const reg = await navigator.serviceWorker.ready;
      let ok = false;
      if ('periodicSync' in reg) { try { await reg.periodicSync.register('domingo', {minInterval: 6 * 3600 * 1000}); ok = true; } catch (e) { /* no disponible */ } }
      reg.showNotification('Entreno', {body: 'Así te avisaré los domingos para planificar la semana.', icon: 'icon-192.png', tag: 'prueba'});
      txt.textContent = ok ? 'Activado. En Android con la app instalada, el navegador intentará avisarte los domingos aunque no la abras (no siempre es puntual). El recordatorio del calendario es el aviso seguro.'
        : 'Este navegador solo permite avisos con la app abierta. Usa el recordatorio del calendario.';
    } catch (e) { txt.textContent = 'Este navegador no permite notificaciones aquí. Usa el recordatorio del calendario.'; }
  });

  // copia de seguridad
  $('#b-exportar').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({version: 1, exportado: new Date().toISOString(), ...ST})], {type: 'application/json'});
    const a = el('a'); a.href = URL.createObjectURL(blob); a.download = `entreno-copia-${iso(hoy())}.json`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
  $('#b-importar').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d.perfil || !Array.isArray(d.acts)) throw new Error('no es una copia de Entreno');
      if (!(await confirmar('Restaurar copia', `Se sustituirán tus datos actuales por la copia del ${d.exportado ? fechaTxt(new Date(d.exportado)) : 'archivo'}.`, 'Restaurar'))) return;
      ['perfil', 'acts', 'planes', 'ajustes'].forEach((k) => { ST[k] = d[k] || (k === 'acts' ? [] : {}); });
      await guardar('perfil', 'acts', 'planes', 'ajustes'); recalcular(); toast('Copia restaurada');
    } catch (err) { toast('No he podido restaurar: ' + err.message); }
  });
  $('#b-borrar').addEventListener('click', async () => {
    if (!(await confirmar('Borrar todo', 'Se borrarán tu perfil, objetivos, entrenos y planes de este dispositivo. No se puede deshacer.', 'Borrar todo'))) return;
    await DB.clear();
    ST.perfil = {nombre: '', objetivos: []}; ST.acts = []; ST.planes = {}; ST.ajustes = {};
    recalcular(); toast('Datos borrados');
  });

  // ------------------------------------------------------------ compartido desde otra app (Android)
  // El service worker deja los archivos en la caché "compartidos"; aquí se leen, se guardan y se borran.
  async function recogerCompartidos() {
    history.replaceState(null, '', '#inicio');
    if (!('caches' in window)) return;
    const c = await caches.open('compartidos');
    const reqs = await c.keys();
    const files = [];
    let texto = '';
    for (const r of reqs) {
      const res = await c.match(r);
      if (r.url.endsWith('/__texto')) texto = await res.text();
      else files.push(new File([await res.blob()], decodeURIComponent(r.url.split('/').pop()).replace(/^\d+-/, '') || 'actividad'));
      await c.delete(r);
    }
    if (files.length) await guardarArchivos(files);
    else if (texto) toast(/strava/i.test(texto)
      ? 'Strava solo comparte un enlace, no los datos. Comparte el archivo desde la app de tu reloj o expórtalo en strava.com.'
      : 'Lo compartido no contiene ningún archivo de actividad (FIT, GPX o TCX).');
    else toast('No ha llegado ningún archivo. Prueba a compartir de nuevo.');
  }

  // ------------------------------------------------------------ arranque
  (async () => {
    const ok = await DB.open();
    if (!ok) toast('Este navegador no deja guardar datos: se perderán al cerrar.');
    for (const k of ['perfil', 'acts', 'planes', 'ajustes']) { const v = await DB.get(k); if (v) ST[k] = v; }
    ST.perfil.objetivos = ST.perfil.objetivos || [];
    recalcular();
    const compartido = location.hash === '#compartido';
    ir(compartido ? 'inicio' : (location.hash.slice(1) || 'inicio'));
    if (compartido) await recogerCompartidos();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  })();

  window.APP = {ST, DB, get R() { return R; }, recalcular, guardar, ir, pintar, semanaObjetivo};
})();

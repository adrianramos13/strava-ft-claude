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
  const nivelObj = (e) => (e === 'en camino' ? 'ok' : e === 'exigente' ? 'bad' : 'warn');

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
  window.addEventListener('hashchange', () => ir(location.hash.slice(1)));
  $$('.seg button').forEach((b) => b.addEventListener('click', () => { seg = b.dataset.seg; pintarProgreso(); }));

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
      top.append(el('b', null, s.titulo), el('span', 'ses-meta', `${s.nombreDia.slice(0, 3)} · ${s.min} min${s.km ? ` · ${s.km} km` : ''}`));
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

    // próximo objetivo
    const fut = R.objetivos.filter((o) => o.dia >= iso(h)).sort((a, b) => (a.dia < b.dia ? -1 : 1));
    $('#i-objetivo-card').hidden = !fut.length;
    if (fut.length) $('#i-objetivo').replaceChildren(tarjetaObjetivo(fut[0], true));

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
    if (a.origen === 'manual') b.append(el('span', 'tag', 'manual'));
    li.append(b);
    if (borrar && a.origen === 'manual') {
      const x = el('button', 'icon-btn', '×'); x.setAttribute('aria-label', 'Borrar entreno');
      x.onclick = async () => { if (await confirmar('Borrar entreno', `¿Borrar «${a.nombre}» del ${a.fecha}?`, 'Borrar')) { ST.acts = ST.acts.filter((y) => y.id !== a.id); await guardar('acts'); recalcular(); toast('Entreno borrado'); } };
      li.append(x);
    }
    return li;
  }

  function tarjetaObjetivo(o, mini) {
    const c = el('article', mini ? 'goal mini' : 'goal card');
    const head = el('div', 'goal-head'); head.append(el('b', 'goal-name', o.objetivo), el('span', `chip is-${nivelObj(o.estado)}`, o.estado));
    const n = Math.round((parse(o.dia) - hoy()) / 864e5);
    const aprox = !/^\d/.test(o.fecha_txt);
    c.append(head, el('span', 'tnote', `${o.fecha_txt} · ${n > 0 ? `${aprox ? 'unos ' : ''}${nf(n)} días` : n === 0 ? 'hoy' : 'ya pasó'}`));
    const nums = el('div', 'goal-nums');
    const diff = o.diferencia_min == null ? '—' : `${o.diferencia_min > 0 ? '+' : '−'}${nf(Math.abs(o.diferencia_min), 1)} min`;
    [['Meta', o.meta], ['Nivel actual', o.estimacion], ['Diferencia', diff]].forEach(([k, v]) => { const d = el('div'); d.append(el('span', 'tlabel', k), el('span', 'big', v)); nums.append(d); });
    c.append(nums);
    if (!mini) {
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
  function pintarSemana() {
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
    $('#plan-crear').textContent = selDias.size ? `Proponer ${selDias.size} ${selDias.size === 1 ? 'entreno' : 'entrenos'}` : 'Elige al menos un día';

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
  $('#f-archivo').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const t = await window.IMP.leerTrack(f);
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
    ST.acts.push(a);
    await guardar('acts');
    $('#f-entreno').reset(); $('#f-rpe-v').textContent = '6'; $('#f-fecha').value = '';
    recalcular();
    toast('Entreno guardado. Métricas actualizadas.');
    ir('inicio');
  });

  // ------------------------------------------------------------ progreso
  function pintarProgreso() {
    $$('.seg button').forEach((b) => { b.classList.toggle('on', b.dataset.seg === seg); b.setAttribute('aria-selected', b.dataset.seg === seg); });
    $$('.seg-view').forEach((v) => { v.hidden = v.id !== `s-${seg}`; });
    if (!R) return;
    const sinDatos = (box) => box.replaceChildren(el('p', 'note', 'Importa tu Strava o añade entrenos para ver esta gráfica.'));
    if (seg === 'objetivos') {
      const g = $('#goals'); g.replaceChildren();
      if (!R.objetivos.length) { const p = el('p', 'note card', 'Aún no tienes objetivos. Añádelos en Perfil.'); g.append(p); }
      R.objetivos.forEach((o) => g.append(tarjetaObjetivo(o)));
      window.CH.plan($('#g-plan'), R);
      const ol = $('#fases'); ol.replaceChildren();
      const h = iso(hoy());
      R.fases.forEach((f) => {
        const ahora = f.desde <= h && h <= f.hasta;
        const li = el('li', ahora ? 'now' : '');
        const w = el('span', 'what'); w.append(el('strong', null, f.titulo), el('span', null, f.texto));
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
    const ult = ST.ajustes.ultimaImportacion;
    $('#p-import-estado').textContent = ult
      ? `Última importación: ${fechaTxt(new Date(ult.fecha))} (${nf(ult.n)} actividades). ${Math.floor((Date.now() - new Date(ult.fecha)) / 864e5) >= 7 ? 'Toca actualizar.' : 'Al día.'}`
      : 'Aún no has importado tu Strava.';
    const ul = $('#obj-lista'); ul.replaceChildren();
    const objs = (ST.perfil.objetivos || []).slice().sort((a, b) => (a.dia < b.dia ? -1 : 1));
    if (!objs.length) ul.append(el('li', 'note', 'Sin objetivos. Añade tu próxima carrera para que el plan se adapte a ella.'));
    objs.forEach((o) => {
      const li = el('li', 'obj');
      const b = el('div', 'act-body');
      const meta = o.meta_min ? `${Math.floor(o.meta_min / 60)}:${String(o.meta_min % 60).padStart(2, '0')}` : 'sin meta';
      b.append(el('b', null, o.objetivo), el('div', 'act-meta', `${fechaTxt(parse(o.dia))} · meta ${meta}`));
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
    await guardar('perfil'); recalcular(); toast('Perfil guardado');
  });

  function abrirObjetivo(o) {
    const f = $('#f-obj'); f.hidden = false;
    $('#o-id').value = o ? o.id : '';
    $('#o-tipo').value = o ? o.tipo : 'carrera';
    $('#o-nombre').value = o ? o.objetivo : '';
    $('#o-dist').value = o && o.distancia_km ? String(o.distancia_km) : '21.0975';
    $('#o-tri').value = o && o.distancia ? o.distancia : 'olimpico';
    $('#o-dia').value = o ? o.dia : '';
    $('#o-h').value = o && o.meta_min ? Math.floor(o.meta_min / 60) : '';
    $('#o-m').value = o && o.meta_min ? o.meta_min % 60 : '';
    tipoObjetivo();
    f.scrollIntoView({behavior: 'smooth', block: 'center'});
  }
  function tipoObjetivo() { const t = $('#o-tipo').value; $('#o-dist-wrap').hidden = t !== 'carrera'; $('#o-tri-wrap').hidden = t !== 'triatlon'; }
  $('#o-tipo').addEventListener('change', tipoObjetivo);
  $('#obj-nuevo').addEventListener('click', () => abrirObjetivo(null));
  $('#o-cancelar').addEventListener('click', () => { $('#f-obj').hidden = true; });
  $('#f-obj').addEventListener('submit', async (e) => {
    e.preventDefault();
    const tipo = $('#o-tipo').value;
    const meta = (+$('#o-h').value || 0) * 60 + (+$('#o-m').value || 0);
    const o = {id: $('#o-id').value || 'o' + Date.now(), tipo, objetivo: $('#o-nombre').value.trim(), dia: $('#o-dia').value, meta_min: meta || null};
    if (tipo === 'carrera') o.distancia_km = +$('#o-dist').value;
    if (tipo === 'triatlon') o.distancia = $('#o-tri').value;
    ST.perfil.objetivos = (ST.perfil.objetivos || []).filter((y) => y.id !== o.id).concat(o);
    await guardar('perfil');
    $('#f-obj').hidden = true;
    recalcular(); toast('Objetivo guardado. El plan se ha recalculado.');
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
      toast(`Importadas ${nf(acts.length)} actividades${manual.length - quedan.length ? `; ${manual.length - quedan.length} manuales sustituidas por su versión de Strava` : ''}.`);
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

  // ------------------------------------------------------------ arranque
  (async () => {
    const ok = await DB.open();
    if (!ok) toast('Este navegador no deja guardar datos: se perderán al cerrar.');
    for (const k of ['perfil', 'acts', 'planes', 'ajustes']) { const v = await DB.get(k); if (v) ST[k] = v; }
    ST.perfil.objetivos = ST.perfil.objetivos || [];
    recalcular();
    ir(location.hash.slice(1) || 'inicio');
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  })();

  window.APP = {ST, get R() { return R; }, recalcular, guardar, ir};
})();

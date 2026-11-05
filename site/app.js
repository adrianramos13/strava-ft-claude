/* Panel de entreno: descifra data.enc.json con la contraseña y dibuja todo. */
(() => {
  const CLAVE = 'panel-entreno-pw:' + location.pathname;
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
  const K = ['run', 'hyrox', 'strength', 'bike', 'swim', 'walk', 'other'];
  const L = {run: 'Carrera', hyrox: 'HYROX / funcional', strength: 'Fuerza', bike: 'Bici', swim: 'Natación', walk: 'Caminata / senderismo', other: 'Otros'};
  let D = null;

  // ------------------------------------------------------------ utilidades
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const nf = (v, d = 0) => (v == null || Number.isNaN(+v)) ? '—' : (+v).toLocaleString('es-ES', {minimumFractionDigits: d, maximumFractionDigits: d});
  const day = (s) => new Date(String(s).slice(0, 10) + 'T00:00:00Z');
  const fecha = (d) => `${d.getUTCDate()} ${MES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  const corto = (d) => `${d.getUTCDate()} ${MES[d.getUTCMonth()]}`;
  const ritmo = (p) => { let m = Math.floor(p), s = Math.round((p - m) * 60); if (s === 60) { m += 1; s = 0; } return `${m}:${String(s).padStart(2, '0')}`; };
  const signo = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + nf(Math.abs(v));
  const hace = (iso) => {
    const min = Math.round((Date.now() - new Date(iso)) / 60000);
    if (min < 2) return 'ahora mismo';
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `hace ${h} h`;
    return `el ${fecha(new Date(iso))}`;
  };
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const colores = () => K.map((_, i) => css(`--s${i}`));
  const get = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), D);
  const FMT = {n: (v) => nf(v), signo, pct: (v) => (v == null ? '—' : signo(v) + ' %'), hace};

  // ------------------------------------------------------------ descifrado
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  async function descifrar(sobre, pw) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({name: 'PBKDF2', salt: b64(sobre.salt), iterations: sobre.iter, hash: 'SHA-256'},
      base, {name: 'AES-GCM', length: 256}, false, ['decrypt']);
    const plano = await crypto.subtle.decrypt({name: 'AES-GCM', iv: b64(sobre.iv)}, key, b64(sobre.ct));
    return JSON.parse(new TextDecoder().decode(plano));
  }
  async function abrir(pw, recordar) {
    const r = await fetch('data.enc.json', {cache: 'no-store'});
    if (!r.ok) throw new Error('sin datos');
    D = await descifrar(await r.json(), pw);
    try { if (recordar) localStorage.setItem(CLAVE, pw); } catch (e) { /* almacenamiento bloqueado */ }
    $('#login').hidden = true;
    $('#app').hidden = false;
    document.title = `Entreno de ${D.meta.nombre}`;
    pintar();
  }

  $('#login').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const b = $('#entrar'); b.disabled = true; $('#login-err').hidden = true;
    try { await abrir($('#pw').value, $('#recordar').checked); } catch (e) { $('#login-err').hidden = false; }
    b.disabled = false;
  });
  $('#salir').addEventListener('click', () => {
    try { localStorage.removeItem(CLAVE); } catch (e) { /* nada */ }
    D = null; $('#app').hidden = true; $('#login').hidden = false; $('#pw').value = '';
  });
  (async () => {
    let pw = null;
    try { pw = localStorage.getItem(CLAVE); } catch (e) { /* nada */ }
    if (pw) { try { await abrir(pw, true); } catch (e) { try { localStorage.removeItem(CLAVE); } catch (_) { /* nada */ } } }
  })();
  // al volver a la app, recarga los datos por si hubo actualización
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible' || !D) return;
    let pw = null; try { pw = localStorage.getItem(CLAVE); } catch (e) { /* nada */ }
    if (pw) { try { await abrir(pw, true); } catch (e) { /* se queda lo anterior */ } }
  });

  // ------------------------------------------------------------ pintado
  function pintar() {
    if (!D) return;
    document.querySelectorAll('[data-v]').forEach((e) => {
      const v = get(e.dataset.v);
      e.textContent = v == null ? '—' : (FMT[e.dataset.f] ? FMT[e.dataset.f](v) : v);
    });
    const chip = $('#chip-estado');
    chip.textContent = D.estado.estado; chip.className = `tp-chip is-${D.estado.nivel}`;
    document.querySelectorAll('[data-escala]').forEach((e) => escala(e, D.estado[e.dataset.escala]));
    objetivos(); fases(); tablas();
    const S = colores();
    plan(S); pmc(S); semanas(S); fuerza(S);
    scatter($('#g-ritmo'), 'ritmo_min_km', true, (v) => ritmo(v), S);
    scatter($('#g-eficiencia'), 'm_por_latido', false, (v) => nf(v, 2), S);
    const ley = $('#leyenda-deportes'); ley.replaceChildren();
    K.forEach((k, i) => { const li = el('li'); li.append(el('i', `sw${i}`), L[k]); ley.append(li); });
  }
  let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(pintar, 150); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', pintar);

  function escala(box, v) {
    box.replaceChildren();
    if (v == null) return;
    const nombres = ['Poca base', 'Recreativo', 'Entrenado', 'Avanzado', 'Élite'];
    const idx = Math.min(4, Math.max(0, Math.floor(v / 20)));
    const bar = el('div', 'bar'), lbl = el('div', 'lbl');
    nombres.forEach((n, i) => { bar.append(el('span', i === idx ? 'on' : '')); lbl.append(el('span', i === idx ? 'on' : '', n)); });
    const mk = el('i', 'mk'); mk.style.left = `${Math.min(100, Math.max(0, v))}%`; bar.append(mk);
    box.append(bar, lbl);
  }

  function objetivos() {
    const box = $('#goals'); box.replaceChildren();
    const hoy = new Date(); const t0 = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    $('#objetivos').hidden = !D.objetivos.length;
    D.objetivos.forEach((o) => {
      const c = el('article', 'tp-goal');
      const head = el('div', 'tp-ghead');
      const nivel = o.estado === 'en camino' ? 'ok' : o.estado === 'exigente' ? 'bad' : 'warn';
      head.append(el('span', 'tp-gname', o.objetivo), el('span', `tp-chip is-${nivel}`, o.estado));
      const n = Math.round((day(o.dia) - t0) / 864e5);
      const aprox = !/^\d/.test(o.fecha_txt);  // "junio 2027": fecha sin día exacto
      const cuando = n > 0 ? `${aprox ? 'unos ' : ''}${nf(n)} días` : n === 0 ? 'hoy' : 'ya pasó';
      const sub = el('span', 'tp-tnote', `${o.fecha_txt} · ${cuando}`);
      const nums = el('div', 'tp-gnums');
      const diff = o.diferencia_min == null ? '—' : `${o.diferencia_min > 0 ? '+' : o.diferencia_min < 0 ? '−' : ''}${nf(Math.abs(o.diferencia_min), 1)} min`;
      [['Meta', o.meta], ['Nivel actual', o.estimacion], ['Diferencia', diff]].forEach(([k, v]) => {
        const d = el('div'); d.append(el('span', 'tp-tlabel', k), el('span', 'tp-big', v)); nums.append(d);
      });
      c.append(head, sub, nums, el('p', 'tp-note', o.base));
      (o.notas || []).forEach((t) => c.append(el('p', 'tp-note', t)));
      if (o.tipo === 'carrera' && o.ref_km) {
        const det = el('details', 'tp-how');
        det.append(el('summary', null, '¿Cómo se calcula el nivel actual?'));
        const p1 = el('p'); p1.append('Uso la ', el('strong', null, 'fórmula de Riegel'), ', la más habitual para predecir tiempos de carrera a partir de otra distancia:');
        const f = el('p', 'tp-formula'); f.append('tiempo = tiempo de referencia × (distancia ÷ km de referencia)'); const sup = el('sup', null, '1,06'); f.append(sup);
        const p2 = el('p', null, 'El exponente 1,06 recoge que, cuanto más larga es la carrera, más baja tu ritmo.');
        const p3 = el('p'); p3.append('Referencia: tu mejor carrera continua reciente, del ', el('b', null, o.ref_fecha), ': ',
          el('b', null, `${nf(o.ref_km, 1)} km`), ' en ', el('b', null, o.ref_tiempo), ' (', el('b', null, `${o.ref_ritmo}/km`), '), que proyecta ', el('b', null, o.estimacion), '.');
        const p4 = el('p', null, 'La fórmula da por hecho que has entrenado la distancia: con poco volumen puede ser optimista, y mejora en cuanto haces una carrera más rápida o tiradas largas a buen ritmo.');
        det.append(p1, f, p2, p3, p4); c.append(det);
      }
      box.append(c);
    });
  }

  function fases() {
    const ol = $('#fases'); ol.replaceChildren();
    const hoy = new Date().toISOString().slice(0, 10);
    D.fases.forEach((f) => {
      const li = el('li', f.desde <= hoy && hoy <= f.hasta ? 'now' : '');
      const w = el('span', 'what'); w.append(el('strong', null, f.titulo), el('span', null, f.texto));
      li.append(el('span', 'when', f.cuando + (f.desde <= hoy && hoy <= f.hasta ? ' · ahora' : '')), w);
      ol.append(li);
    });
  }

  function tabla(id, rows, cols) {
    const tb = $(`#${id} tbody`); tb.replaceChildren();
    rows.forEach((r) => {
      const tr = el('tr');
      cols.forEach(([c, f]) => { const td = el('td', f ? 'num' : '', r[c] == null || r[c] === '' ? '—' : (f ? f(r[c]) : r[c])); tr.append(td); });
      tb.append(tr);
    });
  }
  function tablas() {
    const n0 = (v) => nf(v), n1 = (v) => nf(v, 1), txt = (v) => v;
    tabla('t-90', D.deportes_90d, [['deporte'], ['sesiones', n0], ['horas', n1], ['km', n1]]);
    tabla('t-mejores', D.mejores, [['distancia'], ['fecha'], ['nombre'], ['km', (v) => nf(v, 2)], ['ritmo', txt], ['fc', n0]]);
    tabla('t-recientes', D.recientes, [['fecha'], ['nombre'], ['deporte'], ['duracion', txt], ['km', n1], ['fc', n0], ['carga', n0]]);
  }

  // ------------------------------------------------------------ gráficas
  const svgIn = (box, W, H) => { box.replaceChildren(); return d3.select(box).append('svg').attr('class', 'tp-svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`); };
  const tickW = (s, labels) => { const t = s.append('text').attr('class', 'tick'); let w = 0; labels.forEach((l) => { t.text(l); w = Math.max(w, t.node().getComputedTextLength()); }); t.remove(); return w; };
  const ejeY = (s, y, x0, x1, n, fmt) => {
    s.append('g').selectAll('line').data(y.ticks(n)).join('line').attr('x1', x0).attr('x2', x1).attr('y1', (v) => y(v)).attr('y2', (v) => y(v)).attr('stroke', css('--grid'));
    s.append('g').selectAll('text').data(y.ticks(n)).join('text').attr('class', 'tick').attr('x', x0 - 6).attr('y', (v) => y(v)).attr('dy', '0.32em').attr('text-anchor', 'end').text(fmt);
  };
  const ejeX = (s, x, yPos, ticks, fmt) => {
    s.append('line').attr('x1', x.range()[0]).attr('x2', x.range()[1]).attr('y1', yPos).attr('y2', yPos).attr('stroke', css('--axis'));
    s.append('g').selectAll('text').data(ticks).join('text').attr('class', 'tick').attr('x', (v) => x(v)).attr('y', yPos + 16).attr('text-anchor', 'middle').text(fmt);
  };
  const meses = (x, W) => d3.utcMonth.every(W < 520 ? 3 : W < 800 ? 2 : 1).range(...x.domain());
  const tip = (box) => {
    const t = el('div', 'tp-tip'); t.hidden = true; box.append(t);
    return {
      show(x, y, title, rows) {
        t.replaceChildren(el('div', 't', title));
        rows.forEach((r) => { const row = el('div', 'r'); if (r.c) { const i = el('i'); i.style.background = r.c; row.append(i); } row.append(el('span', null, r.n), el('b', null, r.v)); t.append(row); });
        t.hidden = false;
        const bw = box.clientWidth, tw = t.offsetWidth, th = t.offsetHeight;
        let left = x + 14; if (left + tw > bw) left = Math.max(0, x - tw - 14);
        t.style.left = left + 'px'; t.style.top = Math.max(0, y - th / 2) + 'px';
      },
      hide() { t.hidden = true; },
    };
  };

  function plan(S) {
    const box = $('#g-plan');
    const rows = D.km_semana.map((r) => ({...r, d: day(r.semana)}));
    if (!rows.length) { box.replaceChildren(); return; }
    const W = Math.max(300, box.clientWidth), H = 240, mb = 26, mt = 22;
    const s = svgIn(box, W, H);
    const y = d3.scaleLinear([0, d3.max(rows, (r) => Math.max(r.km_real || 0, r.km_plan || 0)) || 1], [H - mb, mt]).nice();
    const fmt = (v) => `${nf(v)} km`;
    const ml = tickW(s, y.ticks(4).map(fmt)) + 10;
    const x = d3.scaleBand(rows.map((r) => r.semana), [ml, W - 4]).padding(0.2);
    ejeY(s, y, ml, W - 4, 4, fmt);
    s.append('g').selectAll('rect').data(rows.filter((r) => r.km_plan != null)).join('rect')
      .attr('x', (r) => x(r.semana) + 0.75).attr('width', Math.max(1, x.bandwidth() - 1.5)).attr('y', (r) => y(r.km_plan)).attr('height', (r) => Math.max(0, y(0) - y(r.km_plan)))
      .attr('fill', 'none').attr('stroke', S[1]).attr('stroke-width', 1.5).attr('rx', 2);
    s.append('g').selectAll('rect').data(rows.filter((r) => r.km_real > 0)).join('rect')
      .attr('x', (r) => x(r.semana)).attr('width', x.bandwidth()).attr('y', (r) => y(r.km_real)).attr('height', (r) => Math.max(0, y(0) - y(r.km_real))).attr('fill', S[0]).attr('rx', 2);
    let ultimo = -Infinity;
    D.objetivos.forEach((g) => {
      const gd = day(g.dia); const wk = rows.find((r) => gd >= r.d && gd - r.d < 7 * 864e5);
      if (!wk) return;
      const gx = x(wk.semana) + x.bandwidth() / 2;
      s.append('line').attr('x1', gx).attr('x2', gx).attr('y1', mt - 4).attr('y2', H - mb).attr('stroke', css('--ref')).attr('stroke-dasharray', '4 3');
      const t = s.append('text').attr('class', 'lab').attr('x', gx).attr('y', mt - 8).attr('text-anchor', 'middle').text(g.objetivo.split(' ')[0]);
      const tw = t.node().getComputedTextLength();
      if (gx + tw / 2 > W) t.attr('text-anchor', 'end').attr('x', W - 2);
      if (gx - tw / 2 < ultimo + 4) t.attr('y', mt + 6);
      ultimo = gx + tw / 2;
    });
    const every = W < 520 ? 8 : 4;
    s.append('line').attr('x1', ml).attr('x2', W - 4).attr('y1', H - mb).attr('y2', H - mb).attr('stroke', css('--axis'));
    s.append('g').selectAll('text').data(rows.filter((_, i) => i % every === 0)).join('text').attr('class', 'tick')
      .attr('x', (r) => x(r.semana) + x.bandwidth() / 2).attr('y', H - mb + 16).attr('text-anchor', 'middle').text((r) => corto(r.d));
    const tt = tip(box);
    s.append('g').selectAll('rect').data(rows).join('rect')
      .attr('x', (r) => x(r.semana) - x.step() * x.paddingInner() / 2).attr('width', x.step()).attr('y', mt).attr('height', H - mb - mt).attr('fill', 'transparent')
      .on('pointerenter', (ev, r) => {
        const lines = [];
        if (r.km_real != null) lines.push({c: S[0], n: 'Real', v: `${nf(r.km_real, 1)} km`});
        if (r.km_plan != null) lines.push({c: S[1], n: 'Plan', v: `${nf(r.km_plan)} km`});
        tt.show(x(r.semana) + x.bandwidth() / 2, y(Math.max(r.km_real || 0, r.km_plan || 0)) + 20, `Semana del ${fecha(r.d)}`, lines);
      })
      .on('pointerleave', () => tt.hide());
  }

  function pmc(S) {
    const box = $('#g-pmc');
    const rows = D.carga_diaria.map((r) => ({...r, d: day(r.dia)}));
    if (!rows.length) { box.replaceChildren(); return; }
    const W = Math.max(300, box.clientWidth), hA = 180, gap = 22, hB = 70;
    const s = svgIn(box, W, 10 + hA + gap + hB + 26);
    const yA = d3.scaleLinear([0, d3.max(rows, (r) => Math.max(r.forma, r.fatiga)) * 1.1 || 1], [10 + hA, 10]).nice();
    const ext = d3.max(rows, (r) => Math.abs(r.frescura)) || 1;
    const yB = d3.scaleLinear([-ext, ext], [10 + hA + gap + hB, 10 + hA + gap]);
    const last = rows[rows.length - 1];
    const endF = `Forma ${nf(last.forma)}`, endT = `Fatiga ${nf(last.fatiga)}`;
    const ml = tickW(s, yA.ticks(4).map((v) => nf(v))) + 10, mr = tickW(s, [endF, endT]) + 14;
    const x = d3.scaleUtc(d3.extent(rows, (r) => r.d), [ml, W - mr]);
    ejeY(s, yA, ml, W - mr, 4, (v) => nf(v));
    s.append('line').attr('x1', ml).attr('x2', W - mr).attr('y1', yB(0)).attr('y2', yB(0)).attr('stroke', css('--ref')).attr('stroke-dasharray', '3 3');
    s.append('text').attr('class', 'lab').attr('x', ml).attr('y', 10 + hA + gap - 6).text('Frescura');
    s.append('path').datum(rows).attr('fill', S[2]).attr('fill-opacity', 0.22).attr('d', d3.area().x((r) => x(r.d)).y0(yB(0)).y1((r) => yB(r.frescura)));
    s.append('path').datum(rows).attr('fill', 'none').attr('stroke', S[2]).attr('stroke-width', 1.5).attr('d', d3.line().x((r) => x(r.d)).y((r) => yB(r.frescura)));
    [['fatiga', S[1], 1.5], ['forma', S[0], 2]].forEach(([k, c, w]) => {
      s.append('path').datum(rows).attr('fill', 'none').attr('stroke', c).attr('stroke-width', w).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round').attr('d', d3.line().x((r) => x(r.d)).y((r) => yA(r[k])));
    });
    let yf = yA(last.forma), yt = yA(last.fatiga);
    if (Math.abs(yf - yt) < 14) { const mid = (yf + yt) / 2, up = yf <= yt ? -7 : 7; yf = mid + up; yt = mid - up; }
    s.append('text').attr('class', 'endlab').attr('x', W - mr + 6).attr('y', yf).attr('dy', '0.32em').attr('fill', S[0]).text(endF);
    s.append('text').attr('class', 'endlab').attr('x', W - mr + 6).attr('y', yt).attr('dy', '0.32em').attr('fill', S[1]).text(endT);
    ejeX(s, x, 10 + hA + gap + hB + 4, meses(x, W), (d) => MES[d.getUTCMonth()]);
    const tt = tip(box);
    const rule = s.append('line').attr('y1', 10).attr('y2', 10 + hA + gap + hB).attr('stroke', css('--axis')).attr('opacity', 0);
    const dots = [[S[0], (r) => yA(r.forma)], [S[1], (r) => yA(r.fatiga)], [S[2], (r) => yB(r.frescura)]].map(([c, f]) => ({f, c: s.append('circle').attr('r', 3.5).attr('fill', c).attr('opacity', 0)}));
    const bis = d3.bisector((r) => r.d).center;
    s.append('rect').attr('x', ml).attr('y', 10).attr('width', W - ml - mr).attr('height', hA + gap + hB).attr('fill', 'transparent')
      .on('pointermove', (ev) => {
        const r = rows[bis(rows, x.invert(d3.pointer(ev)[0]))]; const px = x(r.d);
        rule.attr('x1', px).attr('x2', px).attr('opacity', 1);
        dots.forEach((d) => d.c.attr('cx', px).attr('cy', d.f(r)).attr('opacity', 1));
        tt.show(px, yA(r.forma), fecha(r.d), [{c: S[0], n: 'Forma', v: nf(r.forma, 1)}, {c: S[1], n: 'Fatiga', v: nf(r.fatiga, 1)}, {c: S[2], n: 'Frescura', v: nf(r.frescura, 1)}, {n: 'Carga del día', v: nf(r.carga)}]);
      })
      .on('pointerleave', () => { tt.hide(); rule.attr('opacity', 0); dots.forEach((d) => d.c.attr('opacity', 0)); });
  }

  function semanas(S) {
    const box = $('#g-semanas');
    const rows = D.horas_semana.map((r) => { const o = {semana: r.semana, d: day(r.semana)}; K.forEach((k) => { o[k] = +r[k] || 0; }); return o; });
    const W = Math.max(300, box.clientWidth), H = 240, mb = 26;
    const s = svgIn(box, W, H);
    const tot = (r) => K.reduce((a, k) => a + r[k], 0);
    const y = d3.scaleLinear([0, d3.max(rows, tot) || 1], [H - mb, 10]).nice();
    const fmt = (v) => `${nf(v)} h`;
    const ml = tickW(s, y.ticks(4).map(fmt)) + 10;
    const x = d3.scaleBand(rows.map((r) => r.semana), [ml, W - 4]).padding(0.25);
    ejeY(s, y, ml, W - 4, 4, fmt);
    s.append('g').selectAll('g').data(d3.stack().keys(K)(rows)).join('g').attr('fill', (_, i) => S[i])
      .selectAll('rect').data((ser) => ser).join('rect').attr('x', (d) => x(d.data.semana)).attr('width', x.bandwidth()).attr('y', (d) => y(d[1])).attr('height', (d) => Math.max(0, y(d[0]) - y(d[1])));
    const every = W < 520 ? 6 : 4;
    s.append('line').attr('x1', ml).attr('x2', W - 4).attr('y1', H - mb).attr('y2', H - mb).attr('stroke', css('--axis'));
    s.append('g').selectAll('text').data(rows.filter((_, i) => i % every === 0)).join('text').attr('class', 'tick').attr('x', (r) => x(r.semana) + x.bandwidth() / 2).attr('y', H - mb + 16).attr('text-anchor', 'middle').text((r) => corto(r.d));
    const tt = tip(box);
    s.append('g').selectAll('rect').data(rows).join('rect').attr('x', (r) => x(r.semana) - x.step() * x.paddingInner() / 2).attr('width', x.step()).attr('y', 10).attr('height', H - mb - 10).attr('fill', 'transparent')
      .on('pointerenter', (ev, r) => {
        const lines = K.map((k, i) => ({k, i})).filter((o) => r[o.k] > 0).map((o) => ({c: S[o.i], n: L[o.k], v: `${nf(r[o.k], 1)} h`}));
        lines.push({n: 'Total', v: `${nf(tot(r), 1)} h`});
        tt.show(x(r.semana) + x.bandwidth() / 2, y(tot(r)) + 20, `Semana del ${fecha(r.d)}`, lines);
      })
      .on('pointerleave', () => tt.hide());
  }

  function scatter(box, field, invert, fmt, S) {
    const pts = D.carreras.filter((r) => r[field] != null).map((r) => ({...r, d: day(r.dia), v: +r[field]}));
    if (pts.length < 2) { box.replaceChildren(el('p', 'tp-note', 'Todavía no hay suficientes carreras.')); return; }
    const W = Math.max(280, box.clientWidth), H = 220, mb = 26;
    const s = svgIn(box, W, H);
    const [lo, hi] = d3.extent(pts, (p) => p.v), pad = (hi - lo) * 0.08 || 0.1;
    const y = d3.scaleLinear(invert ? [hi + pad, lo - pad] : [lo - pad, hi + pad], [H - mb, 10]);
    const ml = tickW(s, y.ticks(4).map(fmt)) + 10;
    const x = d3.scaleUtc(d3.extent(pts, (p) => p.d), [ml + 8, W - 8]);
    ejeY(s, y, ml, W - 4, 4, fmt);
    ejeX(s, x, H - mb, meses(x, W), (d) => MES[d.getUTCMonth()]);
    const r = d3.scaleSqrt([0, d3.max(pts, (p) => p.km)], [2, 8]);
    s.append('g').selectAll('circle').data(pts).join('circle').attr('cx', (p) => x(p.d)).attr('cy', (p) => y(p.v)).attr('r', (p) => r(p.km))
      .attr('fill', S[0]).attr('fill-opacity', 0.35).attr('stroke', S[0]).attr('stroke-opacity', 0.6);
    const xs = pts.map((p) => +p.d), ys = pts.map((p) => p.v), mx = d3.mean(xs), my = d3.mean(ys);
    const b = d3.sum(xs.map((v, i) => (v - mx) * (ys[i] - my))) / (d3.sum(xs, (v) => (v - mx) ** 2) || 1);
    const [x0, x1] = d3.extent(xs);
    s.append('line').attr('x1', x(new Date(x0))).attr('x2', x(new Date(x1))).attr('y1', y(my + b * (x0 - mx))).attr('y2', y(my + b * (x1 - mx))).attr('stroke', S[1]).attr('stroke-width', 2).attr('stroke-linecap', 'round');
    const tt = tip(box);
    const ring = s.append('circle').attr('fill', 'none').attr('stroke', css('--fg')).attr('stroke-width', 1.5).attr('opacity', 0);
    const dl = d3.Delaunay.from(pts, (p) => x(p.d), (p) => y(p.v));
    s.append('rect').attr('x', ml).attr('width', W - ml).attr('height', H - mb).attr('fill', 'transparent')
      .on('pointermove', (ev) => {
        const [px, py] = d3.pointer(ev); const p = pts[dl.find(px, py)];
        ring.attr('cx', x(p.d)).attr('cy', y(p.v)).attr('r', r(p.km) + 3).attr('opacity', 1);
        tt.show(x(p.d), y(p.v), `${fecha(p.d)} · ${p.nombre}`, [{n: 'Distancia', v: `${nf(p.km, 1)} km`}, {n: 'Ritmo', v: `${p.ritmo} /km`}, {n: 'FC media', v: p.fc == null ? '—' : `${nf(p.fc)} ppm`}, ...(p.m_por_latido ? [{n: 'Metros por latido', v: nf(p.m_por_latido, 2)}] : [])]);
      })
      .on('pointerleave', () => { tt.hide(); ring.attr('opacity', 0); });
  }

  function fuerza(S) {
    const box = $('#g-fuerza'); box.replaceChildren();
    const rows = D.fuerza.map((r) => ({...r, d: day(r.dia), v: +r.rm_estimado}));
    $('#fuerza-vacio').hidden = rows.length > 0;
    if (!rows.length) return;
    const xd = d3.extent(rows, (r) => r.d);
    const yd = [d3.min(rows, (r) => r.v) * 0.85, d3.max(rows, (r) => r.v) * 1.05];
    d3.groups(rows, (r) => r.ejercicio).forEach(([ex, pts]) => {
      pts.sort((a, b) => a.d - b.d);
      const cell = el('div', 'tp-mcell');
      const last = pts[pts.length - 1];
      cell.append(el('div', 'tp-mtitle', ex), el('div', 'tp-mval', `${nf(last.v, 1)} kg`), el('div', 'tp-mtitle', `Última sesión · máximo ${nf(d3.max(pts, (p) => p.v), 1)} kg`));
      box.append(cell);
      const W = Math.max(160, cell.clientWidth), H = 80;
      const s = d3.select(cell).append('svg').attr('class', 'tp-svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
      const x = d3.scaleUtc(xd, [4, W - 4]), y = d3.scaleLinear(yd, [H - 6, 6]);
      s.append('line').attr('x1', 0).attr('x2', W).attr('y1', H - 6).attr('y2', H - 6).attr('stroke', css('--axis'));
      s.append('path').datum(pts).attr('fill', 'none').attr('stroke', S[0]).attr('stroke-width', 2).attr('stroke-linejoin', 'round').attr('d', d3.line().x((p) => x(p.d)).y((p) => y(p.v)));
      s.append('g').selectAll('circle').data(pts).join('circle').attr('cx', (p) => x(p.d)).attr('cy', (p) => y(p.v)).attr('r', 2.5).attr('fill', S[0]);
      const tt = tip(cell);
      const off = () => cell.querySelector('svg').getBoundingClientRect().top - cell.getBoundingClientRect().top;
      const bis = d3.bisector((p) => p.d).center;
      s.append('rect').attr('width', W).attr('height', H).attr('fill', 'transparent')
        .on('pointermove', (ev) => { const p = pts[bis(pts, x.invert(d3.pointer(ev)[0]))]; tt.show(x(p.d), off() + y(p.v), fecha(p.d), [{n: '1RM estimado', v: `${nf(p.v, 1)} kg`}]); })
        .on('pointerleave', () => tt.hide());
    });
  }
})();

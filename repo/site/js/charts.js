/* Gráficas (d3). Cada función recibe la caja y los datos ya analizados. */
(() => {
  const {MES, ETIQUETA, ORDEN} = window.AN;
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const S = () => ORDEN.map((_, i) => css(`--s${i}`));
  const nf = (v, d = 0) => (v == null || Number.isNaN(+v)) ? '—' : (+v).toLocaleString('es-ES', {minimumFractionDigits: d, maximumFractionDigits: d});
  const day = (s) => new Date(String(s).slice(0, 10) + 'T00:00:00Z');
  const fecha = (d) => `${d.getUTCDate()} ${MES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  const corto = (d) => `${d.getUTCDate()} ${MES[d.getUTCMonth()]}`;
  const ritmo = window.AN.ritmo;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  const svgIn = (box, W, H) => { box.replaceChildren(); return d3.select(box).append('svg').attr('class', 'svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`); };
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
    const t = el('div', 'tip'); t.hidden = true; box.append(t);
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
  const vacio = (box, txt) => box.replaceChildren(el('p', 'note', txt));

  // Una sola zona sensible para gráficas de barras: el dedo o el ratón puede deslizarse de una columna a otra.
  function barrido(s, x, rows, key, y0, y1, mostrar, ocultar) {
    const hl = s.append('rect').attr('fill', css('--fg')).attr('fill-opacity', 0.07).attr('rx', 3).attr('opacity', 0).attr('pointer-events', 'none');
    let actual = -1;
    const elegir = (ev) => {
      const [px] = d3.pointer(ev, s.node());
      const i = Math.max(0, Math.min(rows.length - 1, Math.floor((px - x.range()[0]) / x.step())));
      if (i === actual) return;
      actual = i;
      const r = rows[i];
      hl.attr('x', x(r[key]) - 2).attr('width', x.bandwidth() + 4).attr('y', y0).attr('height', y1 - y0).attr('opacity', 1);
      mostrar(r);
    };
    const salir = () => { actual = -1; hl.attr('opacity', 0); ocultar(); };
    s.append('rect').attr('class', 'hit').attr('x', x.range()[0]).attr('width', x.range()[1] - x.range()[0]).attr('y', y0).attr('height', y1 - y0).attr('fill', 'transparent')
      .on('pointerdown pointermove', elegir)
      // con el dedo, al soltar se queda visible la última semana para poder leerla
      .on('pointerleave', (ev) => { if (ev.pointerType !== 'touch') salir(); })
      .on('pointercancel', salir);
    d3.select(s.node().parentNode).on('pointerdown.barrido', (ev) => { if (ev.target.getAttribute('class') !== 'hit') salir(); });
  }

  function plan(box, R) {
    const c = S();
    const rows = R.kmSemana.map((r) => ({...r, d: day(r.semana)}));
    if (!rows.length) return vacio(box, 'Sin datos.');
    const W = Math.max(280, box.clientWidth), H = 230, mb = 26, mt = 22;
    const s = svgIn(box, W, H);
    const y = d3.scaleLinear([0, d3.max(rows, (r) => Math.max(r.km_real || 0, r.km_plan || 0)) || 1], [H - mb, mt]).nice();
    const fmt = (v) => `${nf(v)} km`;
    const ml = tickW(s, y.ticks(4).map(fmt)) + 10;
    const x = d3.scaleBand(rows.map((r) => r.semana), [ml, W - 4]).padding(0.2);
    ejeY(s, y, ml, W - 4, 4, fmt);
    s.append('g').selectAll('rect').data(rows.filter((r) => r.km_plan != null)).join('rect')
      .attr('x', (r) => x(r.semana) + 0.75).attr('width', Math.max(1, x.bandwidth() - 1.5)).attr('y', (r) => y(r.km_plan)).attr('height', (r) => Math.max(0, y(0) - y(r.km_plan)))
      .attr('fill', 'none').attr('stroke', c[1]).attr('stroke-width', 1.5).attr('rx', 2);
    s.append('g').selectAll('rect').data(rows.filter((r) => r.km_real > 0)).join('rect')
      .attr('x', (r) => x(r.semana)).attr('width', x.bandwidth()).attr('y', (r) => y(r.km_real)).attr('height', (r) => Math.max(0, y(0) - y(r.km_real))).attr('fill', c[0]).attr('rx', 2);
    let ultimo = -Infinity;
    R.objetivos.forEach((g) => {
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
    s.append('g').selectAll('text').data(rows.filter((_, i) => i % every === 0)).join('text').attr('class', 'tick').attr('x', (r) => x(r.semana) + x.bandwidth() / 2).attr('y', H - mb + 16).attr('text-anchor', 'middle').text((r) => corto(r.d));
    const tt = tip(box);
    barrido(s, x, rows, 'semana', mt, H - mb, (r) => {
      const lines = [];
      if (r.km_real != null) lines.push({c: c[0], n: 'Real', v: `${nf(r.km_real, 1)} km`});
      if (r.km_plan != null) lines.push({c: c[1], n: 'Plan', v: `${nf(r.km_plan)} km`});
      if (!lines.length) lines.push({n: 'Sin datos', v: ''});
      tt.show(x(r.semana) + x.bandwidth() / 2, y(Math.max(r.km_real || 0, r.km_plan || 0)) + 20, `Semana del ${fecha(r.d)}`, lines);
    }, () => tt.hide());
  }

  function pmc(box, R) {
    const c = S();
    const rows = R.pmc.map((r) => ({...r, d: day(r.dia)}));
    if (rows.length < 2) return vacio(box, 'Sin datos suficientes.');
    const W = Math.max(280, box.clientWidth), hA = 170, gap = 22, hB = 64;
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
    s.append('path').datum(rows).attr('fill', c[2]).attr('fill-opacity', 0.22).attr('d', d3.area().x((r) => x(r.d)).y0(yB(0)).y1((r) => yB(r.frescura)));
    s.append('path').datum(rows).attr('fill', 'none').attr('stroke', c[2]).attr('stroke-width', 1.5).attr('d', d3.line().x((r) => x(r.d)).y((r) => yB(r.frescura)));
    [['fatiga', c[1], 1.5], ['forma', c[0], 2]].forEach(([k, col, w]) => {
      s.append('path').datum(rows).attr('fill', 'none').attr('stroke', col).attr('stroke-width', w).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round').attr('d', d3.line().x((r) => x(r.d)).y((r) => yA(r[k])));
    });
    let yf = yA(last.forma), yt = yA(last.fatiga);
    if (Math.abs(yf - yt) < 14) { const mid = (yf + yt) / 2, up = yf <= yt ? -7 : 7; yf = mid + up; yt = mid - up; }
    s.append('text').attr('class', 'endlab').attr('x', W - mr + 6).attr('y', yf).attr('dy', '0.32em').attr('fill', c[0]).text(endF);
    s.append('text').attr('class', 'endlab').attr('x', W - mr + 6).attr('y', yt).attr('dy', '0.32em').attr('fill', c[1]).text(endT);
    ejeX(s, x, 10 + hA + gap + hB + 4, meses(x, W), (d) => MES[d.getUTCMonth()]);
    const tt = tip(box);
    const rule = s.append('line').attr('y1', 10).attr('y2', 10 + hA + gap + hB).attr('stroke', css('--axis')).attr('opacity', 0);
    const dots = [[c[0], (r) => yA(r.forma)], [c[1], (r) => yA(r.fatiga)], [c[2], (r) => yB(r.frescura)]].map(([col, f]) => ({f, c: s.append('circle').attr('r', 3.5).attr('fill', col).attr('opacity', 0)}));
    const bis = d3.bisector((r) => r.d).center;
    s.append('rect').attr('x', ml).attr('y', 10).attr('width', W - ml - mr).attr('height', hA + gap + hB).attr('fill', 'transparent')
      .on('pointermove', (ev) => {
        const r = rows[bis(rows, x.invert(d3.pointer(ev)[0]))]; const px = x(r.d);
        rule.attr('x1', px).attr('x2', px).attr('opacity', 1);
        dots.forEach((d) => d.c.attr('cx', px).attr('cy', d.f(r)).attr('opacity', 1));
        tt.show(px, yA(r.forma), fecha(r.d), [{c: c[0], n: 'Forma', v: nf(r.forma, 1)}, {c: c[1], n: 'Fatiga', v: nf(r.fatiga, 1)}, {c: c[2], n: 'Frescura', v: nf(r.frescura, 1)}, {n: 'Carga del día', v: nf(r.carga)}]);
      })
      .on('pointerleave', () => { tt.hide(); rule.attr('opacity', 0); dots.forEach((d) => d.c.attr('opacity', 0)); });
  }

  function semanas(box, R) {
    const c = S();
    const rows = R.horasSemana.map((r) => ({...r, d: day(r.semana)}));
    const W = Math.max(280, box.clientWidth), H = 230, mb = 26;
    const s = svgIn(box, W, H);
    const tot = (r) => ORDEN.reduce((a, k) => a + r[k], 0);
    const y = d3.scaleLinear([0, d3.max(rows, tot) || 1], [H - mb, 10]).nice();
    const fmt = (v) => `${nf(v)} h`;
    const ml = tickW(s, y.ticks(4).map(fmt)) + 10;
    const x = d3.scaleBand(rows.map((r) => r.semana), [ml, W - 4]).padding(0.25);
    ejeY(s, y, ml, W - 4, 4, fmt);
    s.append('g').selectAll('g').data(d3.stack().keys(ORDEN)(rows)).join('g').attr('fill', (_, i) => c[i])
      .selectAll('rect').data((ser) => ser).join('rect').attr('x', (d) => x(d.data.semana)).attr('width', x.bandwidth()).attr('y', (d) => y(d[1])).attr('height', (d) => Math.max(0, y(d[0]) - y(d[1])));
    const every = W < 520 ? 6 : 4;
    s.append('line').attr('x1', ml).attr('x2', W - 4).attr('y1', H - mb).attr('y2', H - mb).attr('stroke', css('--axis'));
    s.append('g').selectAll('text').data(rows.filter((_, i) => i % every === 0)).join('text').attr('class', 'tick').attr('x', (r) => x(r.semana) + x.bandwidth() / 2).attr('y', H - mb + 16).attr('text-anchor', 'middle').text((r) => corto(r.d));
    const tt = tip(box);
    barrido(s, x, rows, 'semana', 10, H - mb, (r) => {
      const lines = ORDEN.map((k, i) => ({k, i})).filter((o) => r[o.k] > 0).map((o) => ({c: c[o.i], n: ETIQUETA[o.k], v: `${nf(r[o.k], 1)} h`}));
      lines.push({n: 'Total', v: `${nf(tot(r), 1)} h`});
      tt.show(x(r.semana) + x.bandwidth() / 2, y(tot(r)) + 20, `Semana del ${fecha(r.d)}`, lines);
    }, () => tt.hide());
  }

  function scatter(box, R, field, invert, fmt) {
    const c = S();
    const pts = R.carreras.filter((r) => r[field] != null).map((r) => ({...r, d: day(r.dia), v: +r[field]}));
    if (pts.length < 2) return vacio(box, 'Todavía no hay suficientes carreras.');
    const W = Math.max(280, box.clientWidth), H = 210, mb = 26;
    const s = svgIn(box, W, H);
    const [lo, hi] = d3.extent(pts, (p) => p.v), pad = (hi - lo) * 0.08 || 0.1;
    const y = d3.scaleLinear(invert ? [hi + pad, lo - pad] : [lo - pad, hi + pad], [H - mb, 10]);
    const ml = tickW(s, y.ticks(4).map(fmt)) + 10;
    const x = d3.scaleUtc(d3.extent(pts, (p) => p.d), [ml + 8, W - 8]);
    ejeY(s, y, ml, W - 4, 4, fmt);
    ejeX(s, x, H - mb, meses(x, W), (d) => MES[d.getUTCMonth()]);
    const r = d3.scaleSqrt([0, d3.max(pts, (p) => p.km)], [2, 8]);
    s.append('g').selectAll('circle').data(pts).join('circle').attr('cx', (p) => x(p.d)).attr('cy', (p) => y(p.v)).attr('r', (p) => r(p.km)).attr('fill', c[0]).attr('fill-opacity', 0.35).attr('stroke', c[0]).attr('stroke-opacity', 0.6);
    const xs = pts.map((p) => +p.d), ys = pts.map((p) => p.v), mx = d3.mean(xs), my = d3.mean(ys);
    const b = d3.sum(xs.map((v, i) => (v - mx) * (ys[i] - my))) / (d3.sum(xs, (v) => (v - mx) ** 2) || 1);
    const [x0, x1] = d3.extent(xs);
    s.append('line').attr('x1', x(new Date(x0))).attr('x2', x(new Date(x1))).attr('y1', y(my + b * (x0 - mx))).attr('y2', y(my + b * (x1 - mx))).attr('stroke', c[1]).attr('stroke-width', 2).attr('stroke-linecap', 'round');
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

  function fuerza(box, R) {
    const c = S();
    box.replaceChildren();
    const rows = R.fuerza.map((r) => ({...r, d: day(r.dia), v: +r.rm}));
    if (!rows.length) return false;
    const xd = d3.extent(rows, (r) => r.d);
    const yd = [d3.min(rows, (r) => r.v) * 0.85, d3.max(rows, (r) => r.v) * 1.05];
    d3.groups(rows, (r) => r.ejercicio).forEach(([ex, pts]) => {
      pts.sort((a, b) => a.d - b.d);
      const cell = el('div', 'mcell');
      const last = pts[pts.length - 1];
      cell.append(el('div', 'mtitle', ex), el('div', 'mval', `${nf(last.v, 1)} kg`), el('div', 'mtitle', `Última · máximo ${nf(d3.max(pts, (p) => p.v), 1)} kg`));
      box.append(cell);
      const W = Math.max(150, cell.clientWidth), H = 76;
      const s = d3.select(cell).append('svg').attr('class', 'svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
      const x = d3.scaleUtc(xd, [4, W - 4]), y = d3.scaleLinear(yd, [H - 6, 6]);
      s.append('line').attr('x1', 0).attr('x2', W).attr('y1', H - 6).attr('y2', H - 6).attr('stroke', css('--axis'));
      s.append('path').datum(pts).attr('fill', 'none').attr('stroke', c[0]).attr('stroke-width', 2).attr('stroke-linejoin', 'round').attr('d', d3.line().x((p) => x(p.d)).y((p) => y(p.v)));
      s.append('g').selectAll('circle').data(pts).join('circle').attr('cx', (p) => x(p.d)).attr('cy', (p) => y(p.v)).attr('r', 2.5).attr('fill', c[0]);
      const tt = tip(cell);
      const off = () => cell.querySelector('svg').getBoundingClientRect().top - cell.getBoundingClientRect().top;
      const bis = d3.bisector((p) => p.d).center;
      s.append('rect').attr('width', W).attr('height', H).attr('fill', 'transparent')
        .on('pointermove', (ev) => { const p = pts[bis(pts, x.invert(d3.pointer(ev)[0]))]; tt.show(x(p.d), off() + y(p.v), fecha(p.d), [{n: '1RM estimado', v: `${nf(p.v, 1)} kg`}]); })
        .on('pointerleave', () => tt.hide());
    });
    return true;
  }

  window.CH = {plan, pmc, semanas, scatter, fuerza, nf, ritmo};
})();

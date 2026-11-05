/* Lectura de datos en el móvil: export de Strava (zip o activities.csv) y archivos GPX/TCX sueltos. */
(() => {
  const MESES = {ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, sep: 9, oct: 10, nov: 11, dic: 12, dec: 12};
  const TIPO = {
    'Carrera': 'Run', 'Run': 'Run', 'Carrera por montaña': 'TrailRun', 'Trail Run': 'TrailRun', 'Carrera virtual': 'VirtualRun', 'Virtual Run': 'VirtualRun',
    'Bicicleta': 'Ride', 'Ride': 'Ride', 'Bicicleta virtual': 'VirtualRide', 'Virtual Ride': 'VirtualRide', 'Bicicleta de montaña': 'MountainBikeRide', 'Mountain Bike Ride': 'MountainBikeRide', 'Gravel Ride': 'GravelRide', 'Bicicleta de gravel': 'GravelRide', 'E-Bike Ride': 'EBikeRide',
    'Natación': 'Swim', 'Swim': 'Swim', 'Entrenamiento con pesas': 'WeightTraining', 'Weight Training': 'WeightTraining',
    'Crossfit': 'Crossfit', 'Entrenamiento': 'Workout', 'Workout': 'Workout', 'HIIT': 'HighIntensityIntervalTraining', 'Entrenamiento de intervalos de alta intensidad': 'HighIntensityIntervalTraining',
    'Caminata': 'Walk', 'Walk': 'Walk', 'Senderismo': 'Hike', 'Hike': 'Hike',
  };

  // CSV con comillas y saltos de línea dentro de campos
  function csv(texto) {
    const filas = []; let fila = [], campo = '', q = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (q) {
        if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else q = false; } else campo += c;
      } else if (c === '"') q = true;
      else if (c === ',') { fila.push(campo); campo = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && texto[i + 1] === '\n') i++; fila.push(campo); filas.push(fila); fila = []; campo = ''; }
      else campo += c;
    }
    if (campo || fila.length) { fila.push(campo); filas.push(fila); }
    return filas;
  }

  // "4 nov 2026, 20:15:14" o "Nov 4, 2026, 8:15:14 PM"
  function fechaExport(s) {
    const m = String(s).match(/(\d{1,2})\s+([A-Za-zé.]+)\s+(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})\s*([AP]M)?/i)
      || String(s).match(/([A-Za-z.]+)\s+(\d{1,2}),\s+(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})\s*([AP]M)?/i);
    if (!m) return null;
    let [, a, b, y, h, mi, se, ap] = m;
    const [dia, mes] = /^\d/.test(a) ? [a, b] : [b, a];
    let hh = +h; if (ap) { if (/pm/i.test(ap) && hh < 12) hh += 12; if (/am/i.test(ap) && hh === 12) hh = 0; }
    const mm = MESES[mes.toLowerCase().replace('.', '').slice(0, 3)];
    if (!mm) return null;
    const p = (n) => String(n).padStart(2, '0');
    return `${y}-${p(mm)}-${p(+dia)}T${p(hh)}:${mi}:${se}`;
  }
  const num = (x) => { if (x == null || x === '') return null; const v = parseFloat(String(x).replace(',', '.')); return Number.isFinite(v) ? v : null; };

  function actividadesDesdeCsv(texto) {
    const filas = csv(texto.replace(/^﻿/, ''));
    const out = [];
    filas.slice(1).forEach((r) => {
      if (r.length < 40 || !r[0]) return;
      const fecha = fechaExport(r[1]);
      if (!fecha) return;
      out.push({
        id: 's' + r[0], origen: 'strava', fecha, nombre: r[2], tipo: TIPO[r[3]] || r[3], descripcion: r[4] || null,
        seg_total: num(r[15]) || num(r[5]) || 0, seg_mov: num(r[16]) || num(r[15]) || num(r[5]) || 0, metros: num(r[17]) || 0,
        fc_max: num(r[30]), fc: num(r[31]), esfuerzo: num(r[37]), desnivel: num(r[20]) || 0,
      });
    });
    return out;
  }

  async function leerStrava(file) {
    let texto, perfil = null;
    if (/\.zip$/i.test(file.name) || file.type.includes('zip')) {
      const zip = await JSZip.loadAsync(file);
      const entrada = Object.values(zip.files).find((f) => /(^|\/)activities\.csv$/i.test(f.name));
      if (!entrada) throw new Error('El zip no contiene activities.csv. ¿Es el export completo de Strava?');
      texto = await entrada.async('string');
      const prof = Object.values(zip.files).find((f) => /(^|\/)profile\.csv$/i.test(f.name));
      if (prof) { const p = csv(await prof.async('string')); if (p[1]) perfil = {nombre: (p[1][2] || '').trim()}; }
    } else texto = await file.text();
    const acts = actividadesDesdeCsv(texto);
    if (!acts.length) throw new Error('No he encontrado actividades en el archivo.');
    return {acts, perfil};
  }

  // GPX/TCX de un entreno suelto (Suunto, Xiaomi, etc.)
  async function leerTrack(file) {
    const xml = new DOMParser().parseFromString(await file.text(), 'application/xml');
    const tag = (el, n) => [...el.getElementsByTagNameNS('*', n)];
    const pts = [];
    const tcx = tag(xml, 'Trackpoint');
    if (tcx.length) {
      tcx.forEach((p) => {
        const t = tag(p, 'Time')[0], lat = tag(p, 'LatitudeDegrees')[0], lon = tag(p, 'LongitudeDegrees')[0], hr = tag(p, 'HeartRateBpm')[0], dist = tag(p, 'DistanceMeters')[0];
        pts.push({t: t && new Date(t.textContent), lat: lat && +lat.textContent, lon: lon && +lon.textContent, hr: hr && +tag(hr, 'Value')[0]?.textContent, dist: dist && +dist.textContent});
      });
    } else {
      tag(xml, 'trkpt').forEach((p) => {
        const t = tag(p, 'time')[0], hr = tag(p, 'hr')[0];
        pts.push({t: t && new Date(t.textContent), lat: +p.getAttribute('lat'), lon: +p.getAttribute('lon'), hr: hr && +hr.textContent});
      });
    }
    const conT = pts.filter((p) => p.t && !isNaN(p.t));
    if (conT.length < 2) throw new Error('El archivo no tiene puntos con hora.');
    const R = 6371000, rad = Math.PI / 180;
    let metros = 0, mov = 0;
    for (let i = 1; i < conT.length; i++) {
      const a = conT[i - 1], b = conT[i];
      let d = 0;
      if (a.dist != null && b.dist != null) d = Math.max(0, b.dist - a.dist);
      else if (a.lat != null && b.lat != null) {
        const x = (b.lon - a.lon) * rad * Math.cos((a.lat + b.lat) / 2 * rad), y = (b.lat - a.lat) * rad;
        d = Math.sqrt(x * x + y * y) * R;
      }
      const dt = (b.t - a.t) / 1000;
      metros += d;
      if (dt > 0 && dt < 30 && d / dt > 0.5) mov += dt;  // cuenta como movimiento
    }
    const total = (conT[conT.length - 1].t - conT[0].t) / 1000;
    const hrs = pts.map((p) => p.hr).filter((h) => h > 30);
    const nombre = tag(xml, 'name')[0]?.textContent || '';
    const sportAttr = tag(xml, 'Activity')[0]?.getAttribute('Sport') || tag(xml, 'type')[0]?.textContent || '';
    const sport = /run|carrera/i.test(sportAttr) ? 'run' : /bik|cycl|ride/i.test(sportAttr) ? 'bike' : /swim/i.test(sportAttr) ? 'swim' : /walk|hik/i.test(sportAttr) ? 'walk' : null;
    const local = new Date(conT[0].t.getTime() - conT[0].t.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
    return {fecha: local, nombre, sport, seg_total: total, seg_mov: mov || total, metros,
      fc: hrs.length ? hrs.reduce((s, h) => s + h, 0) / hrs.length : null, fc_max: hrs.length ? Math.max(...hrs) : null};
  }

  window.IMP = {leerStrava, leerTrack, actividadesDesdeCsv, csv, fechaExport};
})();

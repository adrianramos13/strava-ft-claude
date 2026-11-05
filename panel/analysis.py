"""Convierte una lista de actividades normalizadas (ver strava.py) en los datos del panel."""
import re
import math
import collections
import datetime as dt

MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
ETIQUETA = {'run': 'Carrera', 'hyrox': 'HYROX / funcional', 'strength': 'Fuerza', 'bike': 'Bici',
            'swim': 'Natación', 'walk': 'Caminata / senderismo', 'other': 'Otros'}
ORDEN = list(ETIQUETA)
# Carga por minuto cuando no hay pulso (aprox. a la escala del Esfuerzo Relativo)
CARGA_MIN = {'run': 1.4, 'hyrox': 1.3, 'swim': 1.0, 'bike': 0.8, 'strength': 0.5, 'walk': 0.3, 'other': 0.5}
TRI = {'sprint': (0.75, 20, 5, 4), 'olimpico': (1.5, 40, 10, 5)}


# ------------------------------------------------------------------ utilidades
def fecha_txt(d):
    return f'{d.day} {MES[d.month - 1]} {d.year}'


def hm(mins):
    if mins is None:
        return None
    h, m = divmod(round(mins), 60)
    return f'{h}:{m:02d}' if h else f'{m} min'


def ritmo(p):
    if not p:
        return ''
    m = int(p); s = round((p - m) * 60)
    if s == 60:
        m, s = m + 1, 0
    return f'{m}:{s:02d}'


def dec(x, n=1):
    return f'{x:.{n}f}'.replace('.', ',')


def riegel(t, d1, d2):
    return t * (d2 / d1) ** 1.06


def deporte(a):
    n, t = a['nombre'].lower(), a['tipo']
    if 'hyrox' in n:
        return 'hyrox'
    if t in ('Run', 'TrailRun', 'VirtualRun'):
        return 'run'
    if t in ('Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide', 'Velomobile'):
        return 'bike'
    if t == 'Swim':
        return 'swim'
    if t == 'WeightTraining':
        return 'strength'
    if t in ('Crossfit', 'HighIntensityIntervalTraining'):
        return 'hyrox'
    if t == 'Workout':
        return 'bike' if ('ride' in n or 'bici' in n or 'ciclo' in n) else 'hyrox'
    if t in ('Walk', 'Hike'):
        return 'walk'
    return 'other'


def carga(a, fc_max, fc_reposo=60):
    """Esfuerzo Relativo de Strava si existe; si no, TRIMP de Banister con el pulso medio;
    si no hay pulso, minutos x factor del deporte."""
    if a['esfuerzo']:
        return a['esfuerzo'], 'strava'
    mins = a['seg_mov'] / 60
    if a['fc'] and fc_max and a['fc'] > fc_reposo:
        hrr = min(1.0, (a['fc'] - fc_reposo) / (fc_max - fc_reposo))
        return mins * hrr * 0.64 * math.exp(1.92 * hrr), 'pulso'
    return mins * CARGA_MIN[a['sport']], 'estimada'


SERIE = re.compile(r'Serie\s*\d+\s*:\s*([\d.,]+)\s*kg\s*x\s*(\d+)', re.I)


def series_hevy(texto):
    """[(ejercicio, kg, reps)] a partir de la descripción que Hevy publica en Strava."""
    out = []
    for bloque in re.split(r'\n\s*\n', texto or ''):
        lineas = [l.strip() for l in bloque.strip().splitlines() if l.strip()]
        if len(lineas) < 2 or not SERIE.search(lineas[1]):
            continue
        for l in lineas[1:]:
            m = SERIE.search(l)
            if m:
                out.append((lineas[0], float(m.group(1).replace(',', '.')), int(m.group(2))))
    return out


# ------------------------------------------------------------------- análisis
def analizar(actividades, atleta, hoy=None):
    hoy = hoy or dt.date.today()
    acts = []
    for a in actividades:
        a = dict(a)
        a['sport'] = deporte(a)
        a['d'] = dt.date.fromisoformat(a['fecha'][:10])
        if a['d'] > hoy:
            continue
        a['min'] = a['seg_mov'] / 60
        a['km'] = a['metros'] / 1000
        acts.append(a)
    acts.sort(key=lambda a: a['fecha'])
    if not acts:
        raise ValueError('No hay actividades')

    maxs = sorted(a['fc_max'] for a in acts if a['fc_max'])
    fc_max = atleta.get('fc_max') or (maxs[int(len(maxs) * 0.98)] if maxs else None)
    for a in acts:
        a['carga'], a['carga_tipo'] = carga(a, fc_max)

    # --- forma (42 d), fatiga (7 d), frescura
    diaria = collections.defaultdict(float)
    for a in acts:
        diaria[a['d']] += a['carga']
    ctl = atl = 0.0
    pmc, d = [], acts[0]['d']
    while d <= hoy:
        l = diaria.get(d, 0.0)
        ctl += (l - ctl) / 42
        atl += (l - atl) / 7
        if d > hoy - dt.timedelta(days=365):
            pmc.append(dict(dia=d.isoformat(), carga=round(l, 1), forma=round(ctl, 1),
                            fatiga=round(atl, 1), frescura=round(ctl - atl, 1)))
        d += dt.timedelta(days=1)

    lunes = lambda x: x - dt.timedelta(days=x.weekday())
    semanas = [lunes(hoy) - dt.timedelta(weeks=i) for i in range(25, -1, -1)]
    horas = {w: collections.defaultdict(float) for w in semanas}
    carga_sem = {w: 0.0 for w in semanas}
    for a in acts:
        w = lunes(a['d'])
        if w in horas:
            horas[w][a['sport']] += a['min'] / 60
            carga_sem[w] += a['carga']
    horas_semana = [dict(semana=w.isoformat(), carga=round(carga_sem[w]),
                         **{k: round(horas[w].get(k, 0), 2) for k in ORDEN}) for w in semanas]

    # ventana de 28 días: más estable que las semanas naturales a mitad de semana
    c28 = sum(a['carga'] for a in acts if a['d'] > hoy - dt.timedelta(days=28))
    c28p = sum(a['carga'] for a in acts if hoy - dt.timedelta(days=56) < a['d'] <= hoy - dt.timedelta(days=28))
    fres = round(ctl - atl)
    estado = dict(
        forma=round(ctl), fatiga=round(atl), frescura=fres, carga4=round(c28), carga4_prev=round(c28p),
        cambio_pct=round((c28 - c28p) / c28p * 100) if c28p else None,
        estado='fresco' if fres > 5 else 'equilibrado' if fres >= -10 else 'cargando' if fres >= -30 else 'en sobrecarga',
        nivel='ok' if fres >= -10 else 'warn' if fres >= -30 else 'bad')

    def resumen(dias):
        lo = hoy - dt.timedelta(days=dias)
        by = collections.defaultdict(lambda: [0, 0.0, 0.0])
        for a in acts:
            if a['d'] > lo:
                b = by[a['sport']]; b[0] += 1; b[1] += a['min'] / 60; b[2] += a['km']
        return [dict(deporte=ETIQUETA[k], sesiones=v[0], horas=round(v[1], 1), km=round(v[2], 1))
                for k, v in sorted(by.items(), key=lambda kv: -kv[1][1])]

    # --- carrera
    def pace(a):
        return a['seg_mov'] / 60 / a['km'] if a['km'] else None
    runs = [a for a in acts if a['sport'] == 'run' and a['km'] >= 2 and a['seg_mov']]
    carreras = [dict(dia=a['d'].isoformat(), fecha=fecha_txt(a['d']), nombre=a['nombre'], km=round(a['km'], 2),
                     ritmo_min_km=round(pace(a), 3), ritmo=ritmo(pace(a)), fc=a['fc'],
                     m_por_latido=round(a['metros'] / (a['seg_mov'] / 60) / a['fc'], 3) if a['fc'] else None)
                for a in runs if a['d'] > hoy - dt.timedelta(days=365)]
    mejores = []
    for etiqueta, minkm in (('5K', 4.95), ('10K', 9.9), ('Media', 21.0), ('15K+', 14.9)):
        c = [a for a in runs if a['km'] >= minkm]
        if c and not (etiqueta == '15K+' and any(m['distancia'] == 'Media' for m in mejores)):
            b = min(c, key=pace)
            mejores.append(dict(distancia=etiqueta, fecha=fecha_txt(b['d']), nombre=b['nombre'],
                                km=round(b['km'], 2), ritmo=ritmo(pace(b)), fc=b['fc']))

    # --- fuerza (series de Hevy en la descripción)
    sesiones = collections.defaultdict(dict)
    for a in acts:
        if a['sport'] == 'strength' and a['descripcion']:
            for ej, kg, reps in series_hevy(a['descripcion']):
                if kg > 0 and 1 <= reps <= 15:
                    e1 = kg * (1 + reps / 30)
                    k = a['d'].isoformat()
                    sesiones[ej][k] = max(sesiones[ej].get(k, 0), round(e1, 1))
    lo180 = (hoy - dt.timedelta(days=180)).isoformat()
    top = sorted(((ej, sum(1 for k in v if k >= lo180)) for ej, v in sesiones.items()), key=lambda x: -x[1])
    elegidos = [ej for ej, n in top if n >= 3][:6]
    fuerza = [dict(ejercicio=ej, dia=k, rm_estimado=v)
              for ej in elegidos for k, v in sorted(sesiones[ej].items()) if k >= lo180]

    # --- objetivos
    objetivos = [estimar(o, acts, hoy) for o in atleta.get('objetivos', [])]
    plan = plan_km(acts, objetivos, hoy, lunes)
    fases = plan_fases(objetivos, hoy)

    recientes = [dict(id=a['id'], fecha=fecha_txt(a['d']), nombre=a['nombre'], deporte=ETIQUETA[a['sport']],
                      duracion=(f"{int(a['min'] // 60)} h {int(a['min'] % 60):02d} min" if a['min'] >= 60 else f"{round(a['min'])} min"),
                      km=round(a['km'], 2) or None, fc=a['fc'], carga=round(a['carga']), carga_tipo=a['carga_tipo'])
                 for a in acts[-15:]][::-1]

    return dict(
        meta=dict(nombre=atleta['nombre'], generado=dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
                  hoy=hoy.isoformat(), total=len(acts), desde=fecha_txt(acts[0]['d']),
                  cobertura_fc=round(sum(1 for a in acts if a['carga_tipo'] != 'estimada') / len(acts) * 100),
                  fc_max=fc_max),
        estado=estado, carga_diaria=pmc, horas_semana=horas_semana, deportes_90d=resumen(90),
        carreras=carreras, mejores=mejores, fuerza=fuerza, recientes=recientes,
        objetivos=objetivos, km_semana=plan, fases=fases)


# --------------------------------------------------------------- objetivos
def _mejor_ref_carrera(acts, hoy, min_km):
    lo = hoy - dt.timedelta(days=90)
    c = [a for a in acts if a['sport'] == 'run' and a['km'] >= min_km and a['d'] >= lo
         and a['seg_mov'] / 60 / a['km'] < 7.5]
    return c


def estimar(o, acts, hoy):
    o = dict(o)
    tipo = o['tipo']
    o['fecha_txt'] = o.get('fecha_txt') or fecha_txt(dt.date.fromisoformat(o['dia']))
    o['meta'] = hm(o.get('meta_min')) if o.get('meta_min') else 'por definir'
    o['notas'] = []
    est = None
    if tipo == 'carrera':
        dist = o['distancia_km']
        c = _mejor_ref_carrera(acts, hoy, max(5, round(dist * 0.35)))
        if c:
            b = min(c, key=lambda a: riegel(a['seg_mov'] / 60, a['km'], dist))
            est = riegel(b['seg_mov'] / 60, b['km'], dist)
            p = b['seg_mov'] / 60 / b['km']
            o.update(ref_km=round(b['km'], 2), ref_tiempo=f"{int(b['seg_mov'] // 60)}:{int(b['seg_mov'] % 60):02d}",
                     ref_ritmo=ritmo(p), ref_fecha=fecha_txt(b['d']))
            o['base'] = f"Proyección (fórmula de Riegel) desde tus {dec(b['km'])} km del {fecha_txt(b['d'])}."
        else:
            o['base'] = 'Sin una carrera continua reciente de referencia todavía.'
        if o.get('meta_min'):
            o['ritmo_meta'] = ritmo(o['meta_min'] / dist)
            o['notas'].append(f"Ritmo objetivo: {o['ritmo_meta']}/km.")
            if dist > 10:
                t10 = o['meta_min'] * (10 / dist) ** 1.06
                o['notas'].append(f"Equivale a correr un 10K en unos {int(t10)}:{round(t10 % 1 * 60):02d}.")
    elif tipo == 'hyrox':
        h = [a for a in acts if 'hyrox' in a['nombre'].lower() and a['seg_total'] > 60 * 60]
        if h:
            u = max(h, key=lambda a: a['d'])
            est = u['seg_total'] / 60
            o['base'] = f"Tu último HYROX completo registrado ({fecha_txt(u['d'])}), tiempo total del reloj."
        else:
            o['base'] = 'Aún no hay un HYROX completo registrado.'
        c = _mejor_ref_carrera(acts, hoy, 5)
        if c and o.get('meta_min'):
            b = min(c, key=lambda a: riegel(a['seg_mov'] / 60, a['km'], 10))
            p10 = riegel(b['seg_mov'] / 60, b['km'], 10) / 10
            p_hy = p10 + 0.5  # en HYROX se corre ~30 s/km más lento que tu ritmo de 10K
            correr = p_hy * 8
            o['notas'].append(f"Si corres los 8 km a {ritmo(p_hy)}/km ({round(correr)} min), te quedan "
                              f"{round(o['meta_min'] - correr)} min para las 8 estaciones y las transiciones.")
    elif tipo == 'triatlon':
        nado, bici, corre, trans = TRI[o.get('distancia', 'olimpico')]
        sw = [a['seg_mov'] / a['km'] / 10 for a in acts if a['sport'] == 'swim' and a['km'] >= 0.4
              and a['d'] >= hoy - dt.timedelta(days=180)]
        bk = [a['km'] / (a['seg_mov'] / 3600) for a in acts if a['sport'] == 'bike' and a['km'] >= 15
              and a['tipo'] not in ('VirtualRide',) and a['d'] >= hoy - dt.timedelta(days=180)
              and not any(w in a['nombre'].lower() for w in ('clase', 'ciclo', 'group cycle', 'spinning'))]
        c = _mejor_ref_carrera(acts, hoy, 5)
        if sw and bk and c:
            p100 = sorted(sw)[len(sw) // 2]
            kmh = max(bk)
            b = min(c, key=lambda a: riegel(a['seg_mov'] / 60, a['km'], corre))
            t_nado, t_bici = p100 * nado * 10 / 60, bici / kmh * 60
            t_corre = riegel(b['seg_mov'] / 60, b['km'], corre) * 1.06
            est = t_nado + t_bici + t_corre + trans
            o['base'] = (f"Suma aproximada: natación a {int(p100 // 60)}:{round(p100 % 60):02d}/100 m, "
                         f"bici a {dec(kmh)} km/h, {corre} km corriendo tras la bici y transiciones.")
            if o.get('meta_min'):
                resto = o['meta_min'] - t_nado - t_corre - trans
                if resto > 0:
                    o['notas'].append(f"Con tu natación ({hm(t_nado)}) y tu carrera ({hm(t_corre)}) actuales más "
                                      f"{trans} min de transiciones, necesitas la bici a {dec(bici / (resto / 60))} km/h "
                                      f"de media. Ahora vas a {dec(kmh)} km/h en exterior.")
        else:
            o['base'] = 'Faltan datos recientes de natación, bici en exterior o carrera para estimarlo.'
        o['notas'].append(f"Distancia: {'olímpica' if o.get('distancia', 'olimpico') == 'olimpico' else 'sprint'} "
                          f"({dec(nado, 2).rstrip('0').rstrip(',')} km nadando, {bici} km en bici y {corre} km corriendo).")
    o['estimacion_min'] = round(est, 1) if est else None
    o['estimacion'] = hm(est) if est else '—'
    if est and o.get('meta_min'):
        diff = est - o['meta_min']
        o['diferencia_min'] = round(diff, 1)
        pct = diff / o['meta_min'] * 100
        o['estado'] = 'en camino' if pct <= 2 else 'alcanzable' if pct <= 10 else 'exigente'
    else:
        o['diferencia_min'] = None
        o['estado'] = 'fija una meta' if not o.get('meta_min') else 'sin datos'
    return o


def plan_km(acts, objetivos, hoy, lunes):
    """Km de carrera por semana: real de las últimas 26 semanas y propuesta hasta el objetivo de carrera."""
    real = collections.defaultdict(float)
    for a in acts:
        if a['sport'] == 'run':
            real[lunes(a['d'])] += a['km']
    carrera = [o for o in objetivos if o['tipo'] == 'carrera' and dt.date.fromisoformat(o['dia']) > hoy]
    fin = lunes(dt.date.fromisoformat(carrera[0]['dia'])) if carrera else lunes(hoy) + dt.timedelta(weeks=12)
    dist = carrera[0]['distancia_km'] if carrera else 10
    pico = 35 if dist <= 10 else 45 if dist <= 21.1 else 60
    ult4 = sum(real.get(lunes(hoy) - dt.timedelta(weeks=i), 0) for i in range(1, 5)) / 4
    inicio = max(10.0, round(ult4))
    otros = {lunes(dt.date.fromisoformat(o['dia'])) for o in objetivos
             if o['tipo'] != 'carrera' and dt.date.fromisoformat(o['dia']) < fin}
    semanas_plan = max(1, (fin - lunes(hoy)).days // 7)
    construir = max(1, semanas_plan - 2)
    out, w, i = [], lunes(hoy) - dt.timedelta(weeks=25), 0
    while w <= fin:
        p = None
        if w >= lunes(hoy):
            k = (w - lunes(hoy)).days // 7
            if k < construir:
                p = inicio + (pico - inicio) * k / max(1, construir - 1)
                if k % 4 == 3:
                    p *= 0.8
            else:
                p = pico * (0.75 if k == construir else 0.5)
            if w in otros:
                p *= 0.6
        out.append(dict(semana=w.isoformat(), km_real=round(real.get(w, 0), 1) if w <= hoy else None,
                        km_plan=round(p) if p is not None else None))
        w += dt.timedelta(weeks=1)
    return out


TEXTO = {
    'base': ('Base aeróbica', 'Un rodaje suave en Z2, una sesión de series cortas y una tirada larga que crece poco a poco. '
                              'Fuerza dos veces por semana.'),
    'carrera': ('Específico {nombre}', 'Tempo a ritmo objetivo ({ritmo}/km) en bloques cada vez más largos y tirada larga con los '
                                       'últimos km a ritmo. Sube el volumen sin pasar de un 10 % por semana.'),
    'hyrox': ('Específico {nombre}', 'Carrera "comprometida": 1 km fuerte y una estación justo después (sled, wall balls, lunges). '
                                     'Simulación completa cada 3–4 semanas.'),
    'triatlon': ('Específico {nombre}', 'Natación 2–3 veces por semana, bici en exterior 2 veces (una larga) y sesiones '
                                        'combinadas de bici y carrera para practicar la transición.'),
    'afinar': ('Afinar y competir: {nombre}', 'Baja el volumen un 40 %, mantén algo de intensidad y descansa los 2 días previos.'),
}


def plan_fases(objetivos, hoy):
    fases, ini = [], hoy + dt.timedelta(days=(7 - hoy.weekday()) % 7)
    futuros = sorted((o for o in objetivos if dt.date.fromisoformat(o['dia']) > hoy), key=lambda o: o['dia'])
    for n, o in enumerate(futuros):
        dia = dt.date.fromisoformat(o['dia'])
        especifico = dia - dt.timedelta(weeks=10 if n == 0 else 5)
        if n == 0 and (especifico - ini).days >= 21:
            t, x = TEXTO['base']
            fases.append(dict(desde=ini.isoformat(), hasta=(especifico - dt.timedelta(days=1)).isoformat(), titulo=t, texto=x))
            ini = especifico
        afinar = dia - dt.timedelta(days=6)
        if (afinar - ini).days >= 7:
            t, x = TEXTO[o['tipo']]
            fases.append(dict(desde=ini.isoformat(), hasta=(afinar - dt.timedelta(days=1)).isoformat(),
                              titulo=t.format(nombre=o['objetivo']), texto=x.format(ritmo=o.get('ritmo_meta', '—'))))
        t, x = TEXTO['afinar']
        fases.append(dict(desde=max(afinar, ini).isoformat(), hasta=dia.isoformat(), titulo=t.format(nombre=o['objetivo']), texto=x))
        ini = dia + dt.timedelta(days=2)
    for f in fases:
        a, b = dt.date.fromisoformat(f['desde']), dt.date.fromisoformat(f['hasta'])
        f['cuando'] = f"{a.day} {MES[a.month - 1]} – {b.day} {MES[b.month - 1]} {b.year}"
    return fases

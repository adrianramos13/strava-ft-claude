"""Acceso a la API de Strava (cuenta gratuita) y lectura del export en zip.

Ambas fuentes devuelven la misma lista de actividades normalizadas:
    {id, fecha (ISO local), nombre, tipo (sport_type de Strava), seg_mov, seg_total,
     metros, fc, fc_max, esfuerzo, desnivel, vel, descripcion}
"""
import csv
import time
import datetime as dt

import requests

API = 'https://www.strava.com/api/v3'
TOKEN_URL = 'https://www.strava.com/oauth/token'


# --------------------------------------------------------------------------- API
def refresh_access_token(client_id, client_secret, refresh_token):
    """Devuelve (access_token, refresh_token_vigente)."""
    r = requests.post(TOKEN_URL, data={
        'client_id': client_id, 'client_secret': client_secret,
        'grant_type': 'refresh_token', 'refresh_token': refresh_token}, timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f'Strava rechazó el refresh token ({r.status_code}): {r.text[:200]}')
    j = r.json()
    return j['access_token'], j.get('refresh_token', refresh_token)


def _get(token, path, params=None):
    for intento in range(3):
        r = requests.get(f'{API}{path}', headers={'Authorization': f'Bearer {token}'},
                         params=params, timeout=30)
        if r.status_code == 429:  # límite de peticiones: esperar y reintentar
            time.sleep(60 * (intento + 1))
            continue
        r.raise_for_status()
        return r.json()
    raise RuntimeError('Strava: demasiadas peticiones, inténtalo más tarde')


def _from_api(a):
    return dict(
        id=str(a['id']), fecha=a['start_date_local'][:19], nombre=a.get('name', ''),
        tipo=a.get('sport_type') or a.get('type', ''), seg_mov=a.get('moving_time') or 0,
        seg_total=a.get('elapsed_time') or 0, metros=a.get('distance') or 0,
        fc=a.get('average_heartrate'), fc_max=a.get('max_heartrate'),
        esfuerzo=a.get('suffer_score'), desnivel=a.get('total_elevation_gain') or 0,
        vel=a.get('average_speed'), descripcion=a.get('description'))


def fetch_activities(token, detalles_cache, dias_detalle=365):
    """Todas las actividades del atleta. Para las de fuerza pide el detalle (descripción con
    las series de Hevy), usando `detalles_cache` {id: descripcion} para no repetir peticiones."""
    acts, page = [], 1
    while True:
        lote = _get(token, '/athlete/activities', {'per_page': 200, 'page': page})
        if not lote:
            break
        acts.extend(lote)
        page += 1
    limite = (dt.datetime.now() - dt.timedelta(days=dias_detalle)).isoformat()
    out = []
    for a in acts:
        n = _from_api(a)
        if n['tipo'] == 'WeightTraining' and n['fecha'] >= limite:
            if n['id'] not in detalles_cache:
                det = _get(token, f"/activities/{n['id']}")
                detalles_cache[n['id']] = det.get('description') or ''
            n['descripcion'] = detalles_cache[n['id']]
        out.append(n)
    return out


# ----------------------------------------------------------------- export en zip
MESES = {'ene': 1, 'feb': 2, 'mar': 3, 'abr': 4, 'may': 5, 'jun': 6, 'jul': 7,
         'ago': 8, 'sept': 9, 'sep': 9, 'oct': 10, 'nov': 11, 'dic': 12,
         'jan': 1, 'apr': 4, 'aug': 8, 'dec': 12}
TIPO_EXPORT = {'Carrera': 'Run', 'Natación': 'Swim', 'Bicicleta': 'Ride',
               'Entrenamiento con pesas': 'WeightTraining', 'Crossfit': 'Crossfit',
               'Caminata': 'Walk', 'Senderismo': 'Hike', 'Snowboard': 'Snowboard',
               'Entrenamiento': 'Workout', 'Run': 'Run', 'Ride': 'Ride', 'Swim': 'Swim',
               'Weight Training': 'WeightTraining', 'Walk': 'Walk', 'Hike': 'Hike', 'Workout': 'Workout'}


def _f(x):
    try:
        return float(x) if x not in ('', None) else None
    except ValueError:
        return None


def _fecha_export(s):
    d, hora = s.split(', ')
    a, b, year = d.replace('.', '').split()
    day, mon = (a, b) if a.isdigit() else (b, a)
    h, m, sec = hora.split(' ')[0].split(':')
    mes = MESES[mon.lower()[:3]]
    return dt.datetime(int(year), mes, int(day), int(h), int(m), int(sec)).isoformat()


def read_export(carpeta):
    """Lee activities.csv de un export de Strava ya descomprimido (formato en español)."""
    rows = list(csv.reader(open(f'{carpeta}/activities.csv', encoding='utf-8')))[1:]
    out = []
    for r in rows:
        out.append(dict(
            id=r[0], fecha=_fecha_export(r[1]), nombre=r[2], tipo=TIPO_EXPORT.get(r[3], r[3]),
            seg_mov=_f(r[16]) or _f(r[15]) or 0, seg_total=_f(r[15]) or 0, metros=_f(r[17]) or 0,
            fc=_f(r[31]), fc_max=_f(r[30]), esfuerzo=_f(r[37]), desnivel=_f(r[20]) or 0,
            vel=_f(r[19]), descripcion=r[4] or None))
    return out

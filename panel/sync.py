"""Genera los paneles: descarga de Strava, analiza, cifra y monta la web en una carpeta.

En GitHub Actions:   python panel/sync.py --out _site
En local (export):   python panel/sync.py --out _site --atleta adrian --export ruta/export --password prueba

Secretos (en GitHub: Settings > Secrets and variables > Actions), por atleta con id en mayúsculas:
    STRAVA_CLIENT_ID_<ID>, STRAVA_CLIENT_SECRET_<ID>, STRAVA_REFRESH_TOKEN_<ID>, PANEL_PASSWORD_<ID>
"""
import os
import sys
import json
import shutil
import argparse
import datetime as dt
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).parent))
import strava  # noqa: E402
import analysis  # noqa: E402
import cifrado  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent


def secretos():
    s = json.loads(os.environ.get('SECRETS_JSON') or '{}')
    s.update({k: v for k, v in os.environ.items() if k.startswith(('STRAVA_', 'PANEL_'))})
    return s


def leer_cache(ruta, password):
    try:
        return cifrado.descifrar(json.loads(ruta.read_text()), password)
    except Exception:
        return {}


def construir(atleta, actividades, password, out, hoy):
    datos = analysis.analizar(actividades, atleta, hoy)
    destino = out / atleta['id']
    shutil.copytree(RAIZ / 'site', destino, dirs_exist_ok=True)
    (destino / 'data.enc.json').write_text(json.dumps(cifrado.cifrar(datos, password)))
    manifest = json.loads((destino / 'manifest.webmanifest').read_text(encoding='utf-8'))
    manifest['name'] = f"Entreno de {atleta['nombre']}"
    manifest['short_name'] = f"Entreno {atleta['nombre']}"
    (destino / 'manifest.webmanifest').write_text(json.dumps(manifest, ensure_ascii=False), encoding='utf-8')
    print(f"  {atleta['id']}: {datos['meta']['total']} actividades, forma {datos['estado']['forma']}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='_site')
    ap.add_argument('--atleta', help='solo este atleta')
    ap.add_argument('--export', help='carpeta de un export de Strava descomprimido (modo local)')
    ap.add_argument('--password', help='contraseña (modo local)')
    ap.add_argument('--cache', default='cache')
    args = ap.parse_args()

    out, cache = Path(args.out), Path(args.cache)
    out.mkdir(parents=True, exist_ok=True)
    cache.mkdir(parents=True, exist_ok=True)
    atletas = json.loads((RAIZ / 'atletas.json').read_text(encoding='utf-8'))
    try:
        hoy = dt.datetime.now(ZoneInfo('Europe/Madrid')).date()
    except Exception:  # Windows sin base de datos de zonas horarias
        hoy = dt.date.today()
    s = secretos()
    hechos, fallos = [], []

    for atleta in atletas:
        if args.atleta and atleta['id'] != args.atleta:
            continue
        ID = atleta['id'].upper()
        password = args.password or s.get(f'PANEL_PASSWORD_{ID}')
        if not password:
            print(f"  {atleta['id']}: sin PANEL_PASSWORD_{ID}, se omite")
            continue
        try:
            if args.export:
                acts = strava.read_export(args.export)
            else:
                ruta = cache / f"{atleta['id']}.enc.json"
                c = leer_cache(ruta, password)
                refresh = c.get('refresh_token') or s[f'STRAVA_REFRESH_TOKEN_{ID}']
                token, refresh = strava.refresh_access_token(
                    s[f'STRAVA_CLIENT_ID_{ID}'], s[f'STRAVA_CLIENT_SECRET_{ID}'], refresh)
                detalles = c.get('detalles', {})
                acts = strava.fetch_activities(token, detalles)
                ruta.write_text(json.dumps(cifrado.cifrar({'refresh_token': refresh, 'detalles': detalles}, password)))
            construir(atleta, acts, password, out, hoy)
            hechos.append(atleta)
        except KeyError as e:
            fallos.append(f"{atleta['id']}: falta el secreto {e}")
        except Exception as e:  # un atleta con problemas no tumba el panel del otro
            fallos.append(f"{atleta['id']}: {e}")

    # portada con enlaces a cada panel
    enlaces = '\n'.join(f'<li><a href="{a["id"]}/">{a["nombre"]}</a></li>' for a in hechos)
    (out / 'index.html').write_text(
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>Paneles de entreno</title><meta name="robots" content="noindex">'
        '<style>body{font-family:system-ui,sans-serif;max-width:30rem;margin:3rem auto;padding:0 16px}'
        'a{font-size:1.25rem}</style><h1>Paneles de entreno</h1><ul>' + enlaces + '</ul>', encoding='utf-8')
    (out / 'robots.txt').write_text('User-agent: *\nDisallow: /\n')
    for f in fallos:
        print('ERROR', f)
    if fallos and not hechos:
        sys.exit(1)


if __name__ == '__main__':
    main()

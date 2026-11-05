"""Obtiene el refresh token de Strava para un atleta (se hace una sola vez, en tu ordenador).

1. Crea tu app en https://www.strava.com/settings/api
   (Authorization Callback Domain: localhost)
2. Ejecuta:  python setup/autorizar_strava.py
3. Sigue las instrucciones. Al final verás los tres valores que tienes que guardar
   como secretos en GitHub. No los compartas con nadie.
"""
import getpass
import webbrowser
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer

import requests

PUERTO = 8721
codigo = {}


class Recibir(BaseHTTPRequestHandler):
    def do_GET(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        codigo['code'] = (q.get('code') or [None])[0]
        codigo['scope'] = (q.get('scope') or [''])[0]
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write('<h2>Listo. Ya puedes cerrar esta pestaña y volver a la terminal.</h2>'.encode('utf-8'))

    def log_message(self, *a):
        pass


def main():
    print(__doc__)
    atleta = input('Id del atleta (por ejemplo adrian): ').strip().lower()
    client_id = input('Client ID de tu app de Strava: ').strip()
    client_secret = getpass.getpass('Client Secret (no se muestra al escribir): ').strip()
    url = 'https://www.strava.com/oauth/authorize?' + urllib.parse.urlencode({
        'client_id': client_id, 'redirect_uri': f'http://localhost:{PUERTO}/', 'response_type': 'code',
        'approval_prompt': 'force', 'scope': 'read,activity:read_all'})
    print('\nSe abrirá Strava en el navegador. Pulsa "Autorizar" (deja marcada la opción de ver actividades privadas).')
    webbrowser.open(url)
    print(f'Si no se abre, copia esta dirección en el navegador:\n{url}\n')
    srv = HTTPServer(('localhost', PUERTO), Recibir)
    while 'code' not in codigo:
        srv.handle_request()
    if not codigo['code']:
        raise SystemExit('No se recibió autorización. Vuelve a intentarlo.')
    if 'activity:read_all' not in codigo['scope']:
        print('Aviso: no diste permiso para actividades privadas; solo se verán las públicas.')
    r = requests.post('https://www.strava.com/oauth/token', data={
        'client_id': client_id, 'client_secret': client_secret, 'code': codigo['code'],
        'grant_type': 'authorization_code'}, timeout=30)
    r.raise_for_status()
    j = r.json()
    nombre = j.get('athlete', {}).get('firstname', '')
    ID = atleta.upper()
    print(f'\nAutorizado{" " + nombre if nombre else ""}. Crea estos secretos en GitHub '
          '(repositorio > Settings > Secrets and variables > Actions > New repository secret):\n')
    print(f'  STRAVA_CLIENT_ID_{ID}      = {client_id}')
    print(f'  STRAVA_CLIENT_SECRET_{ID}  = (el Client Secret que has escrito)')
    print(f'  STRAVA_REFRESH_TOKEN_{ID}  = {j["refresh_token"]}')
    print(f'  PANEL_PASSWORD_{ID}        = (la contraseña que quieras para abrir tu panel)\n')


if __name__ == '__main__':
    main()

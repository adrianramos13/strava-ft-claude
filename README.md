# Panel de entreno

Paneles personales de entrenamiento que se actualizan solos con tus actividades de Strava (cuenta
gratuita), sin tener ningún ordenador encendido. Cada persona tiene su panel, su contraseña y sus objetivos.

- **GitHub Actions** descarga las actividades de cada atleta desde la API de Strava cada 2 horas
  (de 7:00 a 23:00), calcula forma, fatiga, objetivos y plan, y publica la web en **GitHub Pages**.
- Los datos se publican **cifrados** (AES-256-GCM). Sin la contraseña, la página no muestra nada.
- En el móvil: abre tu enlace, entra con tu contraseña y usa **"Añadir a pantalla de inicio"**.

## Puesta en marcha (una vez)

### 1. Repositorio
1. Crea un repositorio **público** vacío en GitHub (por ejemplo `panel-entreno`). Público porque
   GitHub Pages gratis lo requiere; los datos van cifrados y las claves en secretos.
2. Sube este código (`git push`).
3. En **Settings → Pages → Build and deployment → Source** elige **GitHub Actions**.

### 2. App de Strava (cada atleta, en su cuenta)
1. Entra en <https://www.strava.com/settings/api> y crea una app:
   - *Application Name*: `Panel entreno <tu nombre>`
   - *Category*: `Training`, *Website*: la dirección de tu repositorio
   - *Authorization Callback Domain*: `localhost`
2. En tu ordenador, dentro de esta carpeta:
   ```
   pip install requests cryptography
   python setup/autorizar_strava.py
   ```
   Te pedirá el *Client ID* y el *Client Secret*, abrirá Strava para que pulses **Autorizar** y te
   mostrará los valores a guardar.

### 3. Secretos en GitHub
En **Settings → Secrets and variables → Actions → New repository secret**, crea para cada atleta
(con su id en mayúsculas, por ejemplo `ADRIAN`):

| Secreto | Valor |
|---|---|
| `STRAVA_CLIENT_ID_ADRIAN` | Client ID de su app de Strava |
| `STRAVA_CLIENT_SECRET_ADRIAN` | Client Secret de su app |
| `STRAVA_REFRESH_TOKEN_ADRIAN` | el que muestra `autorizar_strava.py` |
| `PANEL_PASSWORD_ADRIAN` | la contraseña para abrir su panel (larga, mejor una frase) |

### 4. Primera actualización
**Actions → Actualizar paneles → Run workflow**. Al terminar, el panel está en
`https://<tu-usuario>.github.io/<repositorio>/adrian/`.

## Añadir otro atleta
1. Añádelo en [`atletas.json`](atletas.json) con un `id` en minúsculas sin espacios, su `nombre` y sus objetivos.
2. Repite los pasos 2 y 3 con su cuenta de Strava y su id.
3. Su panel estará en `.../<id>/`.

Tipos de objetivo en `atletas.json`:
- `{"tipo": "carrera", "distancia_km": 21.0975, "meta_min": 100, ...}`, para cualquier distancia de carrera.
- `{"tipo": "hyrox", "meta_min": 75, ...}`
- `{"tipo": "triatlon", "distancia": "olimpico" | "sprint", "meta_min": 180, ...}`

Todos llevan `id`, `objetivo` (nombre visible) y `dia` (`AAAA-MM-DD`). Si la fecha no es exacta,
añade `fecha_txt`, por ejemplo `"junio 2027"`.

## Uso diario
- Graba con el reloj o el móvil como siempre. Lo que llega a Strava aparece en la siguiente actualización.
- Sesiones sin reloj: añádelas en la app de Strava ("Añadir actividad manual").
- Fuerza: si usas **Hevy** y publicas en Strava, las series salen en la sección de 1RM.
- **Actualizar ya**: en la app de GitHub, *Actions → Actualizar paneles → Run workflow*.

## Notas
- Si cambias una contraseña, el panel pedirá la nueva en cada dispositivo.
- Si alguien revoca el acceso en Strava (*Ajustes → Mis aplicaciones*), repite el paso 2 para ese atleta.
- GitHub pausa las tareas programadas de repositorios sin actividad durante 60 días. El workflow intenta
  mantenerlas activas; si te llega un aviso, basta con pulsar *Enable workflow* en Actions.
- Probar en local con un export de Strava descomprimido:
  `python panel/sync.py --out _site --atleta adrian --export ruta/al/export --password prueba`

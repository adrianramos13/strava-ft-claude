# Entreno

App web gratuita de entrenamiento para el móvil: forma, fatiga, objetivos, plan por fases y una propuesta
de entrenos cada semana según tus objetivos y los días que tengas.

- **100 % gratis y privada.** Funciona en el navegador y tus datos se guardan **solo en tu móvil**
  (IndexedDB). No hay servidor, cuentas ni suscripciones.
- **Cada persona en su móvil.** Todos usáis el mismo enlace y cada uno tiene su perfil, sus objetivos y sus entrenos.
- **Se instala como una app** con "Añadir a pantalla de inicio" y funciona sin conexión.

## Cómo se usa
1. **Perfil → Subir export de Strava.** En strava.com: *Ajustes → Mi cuenta → Descargar o eliminar tu
   cuenta → Solicitar tu archivo*. Te llega un email con el zip; súbelo tal cual.
2. **Perfil → Objetivos.** Personales (estar en forma, peso, fuerza en un ejercicio, km acumulados u otro)
   o competiciones (carrera a pie, HYROX o triatlón). El plan de cada semana combina todos los que tengas.
3. **Botón +** cada vez que entrenes: a mano (duración, distancia, pulso, esfuerzo) o desde un archivo
   GPX/TCX. Para la fuerza puedes pegar el texto que comparte Hevy y se leen las series.
   - **Android:** con la app instalada, desde la app del reloj (Suunto, Mi Fitness…) usa
     *Compartir → Entreno* y la actividad se guarda sola.
   - **iPhone:** *Compartir → Guardar en Archivos* y súbela con el botón +.
4. **Una vez a la semana** vuelve a subir el export de Strava: sustituye tus entrenos manuales por la
   versión de Strava cuando coinciden, así todo queda exacto.
5. **Cada domingo** di cuántos días vas a entrenar (pestaña Semana) y la app te propone los entrenos.
   En *Perfil → Recordatorio de los domingos* puedes añadir un aviso semanal al calendario del móvil.

## Publicación
Cada `git push` a `main` publica la carpeta [`site/`](site) en GitHub Pages
(*Settings → Pages → Source: GitHub Actions*).

## Probar en local
```
python -m http.server 8765 --directory site
```
y abre <http://localhost:8765>.

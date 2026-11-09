// Puente del asistente de Entreno: la app llama aquí y este Worker llama a Gemini (nivel gratuito) con la clave del dueño.
// La clave vive solo como secreto de Cloudflare (GEMINI_API_KEY) y nunca llega al navegador.
// Para que nadie gaste el cupo gratuito con otra cosa: solo orígenes permitidos, solo el asistente de Entreno con sus herramientas
// y pocas peticiones por minuto e IP.
const API = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const MODELO_POR_DEFECTO = 'gemini-3.8-flash';
const MAX_CUERPO = 400000;  // caracteres: una conversación muy larga se corta y se empieza otra
const HERRAMIENTAS = ['borrar_preferencia', 'deshacer', 'editar_sesion', 'guardar_preferencia', 'rehacer_plan_completo', 'rehacer_semana', 'ver_semana'];
const PREFIJO = 'Eres el asistente de Entreno';

export function validar(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.messages) || body.messages.length < 2) return 'Petición sin mensajes.';
  const sistema = body.messages[0];
  if (!sistema || sistema.role !== 'system' || !String(sistema.content || '').startsWith(PREFIJO)) return 'Solo para el asistente de Entreno.';
  const tools = Array.isArray(body.tools) ? body.tools : [];
  if (tools.some((t) => t.type !== 'function' || !t.function)) return 'Herramientas no permitidas.';
  if (tools.map((t) => t.function.name).sort().join() !== HERRAMIENTAS.join()) return 'Herramientas no permitidas.';
  return null;
}

// solo los campos que usa el asistente; el modelo lo decide el Worker
export const limpiar = (body, modelo) => ({model: modelo || MODELO_POR_DEFECTO, messages: body.messages, tools: body.tools, tool_choice: 'auto'});

export default {
  async fetch(req, env) {
    const origen = req.headers.get('Origin') || '';
    const permitidos = String(env.ORIGENES || '').split(',').map((s) => s.trim()).filter(Boolean);
    const cors = permitidos.includes(origen) ? {'Access-Control-Allow-Origin': origen, Vary: 'Origin'} : null;
    const error = (status, message) => new Response(JSON.stringify({error: {message}}), {status, headers: {...(cors || {}), 'content-type': 'application/json'}});

    if (req.method === 'OPTIONS') {
      if (!cors) return new Response(null, {status: 403});
      return new Response(null, {status: 204, headers: {...cors, 'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': req.headers.get('Access-Control-Request-Headers') || 'content-type', 'Access-Control-Max-Age': '86400'}});
    }
    if (!cors) return error(403, 'Origen no permitido.');
    if (req.method !== 'POST') return error(404, 'No encontrado.');
    if (!env.GEMINI_API_KEY) return error(500, 'Falta configurar la clave en el Worker.');

    if (env.LIMITE) {
      const {success} = await env.LIMITE.limit({key: req.headers.get('CF-Connecting-IP') || 'sin-ip'});
      if (!success) return error(429, 'Demasiados mensajes seguidos. Espera un minuto.');
    }
    const texto = await req.text();
    if (texto.length > MAX_CUERPO) return error(413, 'La conversación es demasiado larga: empieza una nueva.');
    let body;
    try { body = JSON.parse(texto); } catch (e) { return error(400, 'JSON no válido.'); }
    const fallo = validar(body);
    if (fallo) return error(400, fallo);

    const r = await fetch(API, {method: 'POST', body: JSON.stringify(limpiar(body, env.MODELO)),
      headers: {'content-type': 'application/json', Authorization: `Bearer ${env.GEMINI_API_KEY}`}});
    return new Response(r.body, {status: r.status, headers: {...cors, 'content-type': r.headers.get('content-type') || 'application/json'}});
  },
};

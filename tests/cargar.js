// Carga los scripts del navegador (analysis.js, planner.js) en un contexto aislado con un `window` falso.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

module.exports = function cargar() {
  const ctx = vm.createContext({window: {}});
  for (const f of ['analysis.js', 'planner.js', 'asistente.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../site/js', f), 'utf8'), ctx, {filename: f});
  return ctx.window;
};

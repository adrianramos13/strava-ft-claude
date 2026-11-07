# Graph Report - strava-ft-claude  (2026-11-07)

## Corpus Check
- Corpus is ~42,690 words - fits in a single context window. You may not need a graph.

## Summary
- 201 nodes · 363 edges · 16 communities (12 shown, 4 thin omitted)
- Extraction: 78% EXTRACTED · 22% INFERRED · 0% AMBIGUOUS · INFERRED: 79 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- App UI (copia repo/)
- App UI
- Producto y README
- Producto y README (copia)
- Análisis y carga (copia)
- Análisis y carga
- Generador de iconos
- Publicación GitHub Pages
- Gráficas (copia)
- Importación (copia)
- Gráficas
- Importación Strava
- Planificador (copia)
- Planificador
- Service worker (copia)
- Service worker

## God Nodes (most connected - your core abstractions)
1. `Entreno SPA shell (index.html)` - 15 edges
2. `Entreno SPA shell (index.html)` - 15 edges
3. `Entreno (free mobile training web app)` - 9 edges
4. `Entreno (free mobile training web app)` - 9 edges
5. `pintarVista()` - 8 edges
6. `pintarInicio()` - 8 edges
7. `pintarVista()` - 8 edges
8. `pintarInicio()` - 8 edges
9. `analizar()` - 7 edges
10. `pintarCompleto()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Entreno (free mobile training web app)` --semantically_similar_to--> `Entreno (free mobile training web app)`  [INFERRED] [semantically similar]
  repo/README.md → README.md
- `Entreno SPA shell (index.html)` --semantically_similar_to--> `Entreno SPA shell (index.html)`  [INFERRED] [semantically similar]
  repo/site/index.html → site/index.html
- `Workflow 'Publicar app' (job publicar)` --semantically_similar_to--> `Workflow 'Publicar app' (job publicar)`  [INFERRED] [semantically similar]
  repo/.github/workflows/actualizar.yml → .github/workflows/actualizar.yml
- `Publicacion: git push to main publishes site/ on GitHub Pages` --references--> `Entreno SPA shell (index.html)`  [INFERRED]
  README.md → site/index.html
- `Publicacion: git push to main publishes site/ on GitHub Pages` --references--> `Workflow 'Publicar app' (job publicar)`  [INFERRED]
  README.md → .github/workflows/actualizar.yml

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **GitHub Pages publication flow** — readme_publicacion, _github_workflows_actualizar_publicar, _github_workflows_actualizar_cancelar_publicaciones_colgadas, _github_workflows_actualizar_concurrency_pages, site_index_entreno_app_shell [INFERRED 0.85]
- **Entreno client-side script bundle** — site_index_js_analysis, site_index_js_importar, site_index_js_planner, site_index_js_charts, site_index_js_app [EXTRACTED 1.00]

## Communities (16 total, 4 thin omitted)

### Community 0 - "App UI (copia repo/)"
Cohesion: 0.14
Nodes (27): abrirObjetivo(), actualizarCamposDeporte(), clear(), editorDias(), escala(), filaActividad(), formPeso(), get() (+19 more)

### Community 1 - "App UI"
Cohesion: 0.14
Nodes (27): abrirObjetivo(), actualizarCamposDeporte(), clear(), editorDias(), escala(), filaActividad(), formPeso(), get() (+19 more)

### Community 2 - "Producto y README"
Cohesion: 0.14
Nodes (23): Entreno (free mobile training web app), Manual workout entry (GPX/TCX, Hevy text, share target), IndexedDB local-only storage, Objetivos (personal goals and competitions), Weekly plan proposal (Sunday), Local test with python http.server, Sunday calendar reminder, Strava export zip import (+15 more)

### Community 3 - "Producto y README (copia)"
Cohesion: 0.14
Nodes (23): Entreno (free mobile training web app), Manual workout entry (GPX/TCX, Hevy text, share target), IndexedDB local-only storage, Objetivos (personal goals and competitions), Weekly plan proposal (Sunday), Local test with python http.server, Sunday calendar reminder, Strava export zip import (+15 more)

### Community 4 - "Análisis y carga (copia)"
Cohesion: 0.27
Nodes (13): analizar(), carga(), deporte(), estimar(), estimarObjetivo(), mejorPara(), planFases(), planKm() (+5 more)

### Community 5 - "Análisis y carga"
Cohesion: 0.27
Nodes (13): analizar(), carga(), deporte(), estimar(), estimarObjetivo(), mejorPara(), planFases(), planKm() (+5 more)

### Community 6 - "Generador de iconos"
Cohesion: 0.33
Nodes (4): dist_segmento(), png(), dist_segmento(), png()

### Community 7 - "Publicación GitHub Pages"
Cohesion: 0.24
Nodes (8): Step: Cancelar publicaciones colgadas, GitHub Pages deploy of site/ folder, Workflow 'Publicar app' (job publicar), Publicacion: git push to main publishes site/ on GitHub Pages, Step: Cancelar publicaciones colgadas, GitHub Pages deploy of site/ folder, Workflow 'Publicar app' (job publicar), Publicacion: git push to main publishes site/ on GitHub Pages

### Community 8 - "Gráficas (copia)"
Cohesion: 0.56
Nodes (8): barrido(), fuerza(), hide(), plan(), pmc(), scatter(), semanas(), show()

### Community 9 - "Importación (copia)"
Cohesion: 0.39
Nodes (7): actividadesDesdeCsv(), csv(), fechaExport(), leerActividad(), leerFit(), leerStrava(), leerTrack()

### Community 10 - "Gráficas"
Cohesion: 0.56
Nodes (8): barrido(), fuerza(), hide(), plan(), pmc(), scatter(), semanas(), show()

### Community 11 - "Importación Strava"
Cohesion: 0.39
Nodes (7): actividadesDesdeCsv(), csv(), fechaExport(), leerActividad(), leerFit(), leerStrava(), leerTrack()

## Knowledge Gaps
- **10 isolated node(s):** `APP`, `APP`, `GitHub Pages deploy of site/ folder`, `Local test with python http.server`, `PWA manifest and installability` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 20 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Entreno SPA shell (index.html)` connect `Producto y README` to `Producto y README (copia)`, `Publicación GitHub Pages`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Entreno SPA shell (index.html)` (e.g. with `Publicacion: git push to main publishes site/ on GitHub Pages` and `Entreno SPA shell (index.html)`) actually correct?**
  _`Entreno SPA shell (index.html)` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `APP`, `APP`, `GitHub Pages deploy of site/ folder` to the rest of the system?**
  _10 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App UI (copia repo/)` be split into smaller, more focused modules?**
  _Cohesion score 0.1425287356321839 - nodes in this community are weakly interconnected._
- **Why does `Entreno SPA shell (index.html)` connect `Producto y README (copia)` to `Producto y README`, `Publicación GitHub Pages`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Entreno SPA shell (index.html)` (e.g. with `Publicacion: git push to main publishes site/ on GitHub Pages` and `Entreno SPA shell (index.html)`) actually correct?**
  _`Entreno SPA shell (index.html)` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `App UI` be split into smaller, more focused modules?**
  _Cohesion score 0.1425287356321839 - nodes in this community are weakly interconnected._
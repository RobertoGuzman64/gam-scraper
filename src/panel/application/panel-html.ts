import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PanelDashboardPayload } from "./dashboard-data.js";

const safeJson = (value: unknown): string => JSON.stringify(value)
  .replaceAll("<", "\\u003c")
  .replaceAll(">", "\\u003e")
  .replaceAll("&", "\\u0026")
  .replaceAll("\u2028", "\\u2028")
  .replaceAll("\u2029", "\\u2029");

export const renderPanelHtml = async (workspace: string, payload: PanelDashboardPayload): Promise<string> => {
  const [css, js, explorerJs, selectionJs, stageCardsJs, filtersJs] = await Promise.all([
    readFile(join(workspace, "src", "panel", "ui", "dashboard.css"), "utf8"),
    readFile(join(workspace, "dist", "panel", "ui", "dashboard-client.js"), "utf8"),
    readFile(join(workspace, "dist", "panel", "ui", "explorer-client.js"), "utf8"),
    readFile(join(workspace, "dist", "panel", "explorer", "explorer-selection.js"), "utf8"),
    readFile(join(workspace, "dist", "panel", "ui", "explorer-stage-cards.js"), "utf8"),
    readFile(join(workspace, "dist", "panel", "ui", "explorer-filter-controls.js"), "utf8")
  ]);
  const selectionImport = '"../explorer/explorer-selection.js"';
  const cardsImport = '"./explorer-stage-cards.js"';
  const filtersImport = '"./explorer-filter-controls.js"';
  if (!explorerJs.includes(selectionImport) || !explorerJs.includes(cardsImport) ||
    !explorerJs.includes(filtersImport) || !filtersJs.includes(selectionImport) ||
    /(^|\n)\s*import\s/m.test(selectionJs) || /(^|\n)\s*import\s/m.test(stageCardsJs)) {
    throw new Error("No se puede integrar la selección del Explorador en el HTML autónomo");
  }
  const offlineSelectionUrl = `"data:text/javascript;base64,${Buffer.from(selectionJs, "utf8").toString("base64")}"`;
  const offlineFiltersJs = filtersJs.replace(selectionImport, offlineSelectionUrl);
  const offlineExplorerJs = explorerJs.replace(selectionImport, offlineSelectionUrl)
    .replace(filtersImport, `"data:text/javascript;base64,${Buffer.from(offlineFiltersJs, "utf8").toString("base64")}"`)
    .replace(cardsImport, `"data:text/javascript;base64,${Buffer.from(stageCardsJs, "utf8").toString("base64")}"`);
  if (css.includes("</style") || js.includes("</script") || stageCardsJs.includes("</script") || offlineFiltersJs.includes("</script") || offlineExplorerJs.includes("</script")) {
    throw new Error("Recursos UI contienen un cierre HTML no permitido");
  }
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>EQUIPZILLA · Panel de evidencias</title>
<style>${css}</style>
</head>
<body>
<div class="app-shell">
  <aside class="sidebar" aria-label="Navegación del panel">
    <a class="brand" href="#resumen" aria-label="EQUIPZILLA, ir a resumen">
      <span class="brand-mark" aria-hidden="true"><span>E</span><span>Z</span></span>
      <span class="brand-text"><strong>EQUIPZILLA</strong></span>
    </a>
    <nav class="nav-list" aria-label="Secciones">
      <button class="nav-button active" type="button" data-nav="resumen" aria-current="page"><svg class="nav-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg><span>Resumen</span></button>
      <button class="nav-button" type="button" data-nav="flujo"><svg class="nav-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg><span>Transformación</span></button>
      <button class="nav-button" type="button" data-nav="explorador"><svg class="nav-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><span>Fichas reales</span></button>
      <button class="nav-button" type="button" data-nav="calidad"><svg class="nav-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg><span>Calidad y controles</span></button>
    </nav>
    <div class="sidebar-spacer"></div>
    <div class="sidebar-bottom">
      <div class="side-status"><span class="status-dot"></span><span>Solo lectura</span></div>
    </div>
  </aside>

  <main class="main-content" id="main-content">
    <header class="topbar">
      <span class="snapshot-label">CORTE VERIFICADO AL GENERAR</span><span id="header-package">—</span>
    </header>
    <div class="page-inner">
      <div class="page-tools">
        <label class="filter-control"><span>Proveedor</span><select id="provider-filter" aria-label="Filtrar por proveedor"><option value="todos">Todos los proveedores</option></select></label>
      </div>
      <section class="page-view" data-view="resumen" aria-labelledby="overview-title">
        <div class="hero">
          <div class="hero-copy"><span class="eyebrow">01 / RESULTADOS</span><h1 id="overview-title">El catálogo, <em>con evidencia.</em></h1><p>Original, FINISH y salida comercial del mismo corte.</p></div>
          
        </div>
        <div class="section-heading"><div><h2 id="overview-kpis-title">Resultados del catálogo</h2></div><span class="section-aside" id="scope-summary">Todos los proveedores</span></div>
        <div class="kpi-grid" id="overview-kpis"></div>
        <section class="explain-card source-map" aria-labelledby="source-map-title">
          <div class="explain-heading"><div><span class="section-kicker">E1 / MAPA DE PROCEDENCIA</span><h2 id="source-map-title">¿De dónde pueden venir los datos?</h2></div><span class="explain-label">MECANISMO CONCEPTUAL</span></div>
          <p class="explain-lede">Datos originales, documentación y conocimiento contrastable alimentan las fichas. Cada aportación exige una evidencia compatible.</p>
          <div class="source-map-grid" aria-label="Fuentes posibles, comprobación y resultado">
            <div class="source-map-inputs"><span>FUENTES POSIBLES · SEGÚN APLICABILIDAD</span><div>Original del proveedor <small>Unidad y origen</small></div><div>Evidencia documental <small>Unidad concreta</small></div><div>Fabricante y modelo <small>Alcance de modelo</small></div><div>Conocimiento editorial <small>Registro compatible</small></div><div>Intervención <small>Solo si está acreditada</small></div></div>
            <div class="explain-arrow" aria-hidden="true">→</div><div class="source-map-process"><strong>Comprobar y transformar</strong><span>Identidad · evidencia · reglas aplicables</span><small>No toda fuente se aplica a toda ficha</small></div><div class="explain-arrow" aria-hidden="true">→</div><div class="source-map-output"><strong>FINISH</strong><span>Publicación técnica</span><div class="source-map-commercial">↓ Proyección comercial compatible</div></div>
          </div>
          <div class="explain-footer"><p>Fuente disponible no significa aplicación demostrada.</p><button type="button" class="text-action" id="source-example">Ver un caso real →</button></div>
        </section>
        <details class="audit-disclosure"><summary>Comparar volúmenes por proveedor</summary>
          <section class="surface-card coverage-card" aria-labelledby="coverage-title"><div class="card-heading"><div><span class="section-kicker">DESGLOSE ACREDITADO</span><h3 id="coverage-title">Cobertura por proveedor</h3></div></div><div id="provider-chart" class="provider-chart"></div><div class="chart-footer"><span id="chart-scale"></span><button class="text-action" type="button" data-go="flujo">Ver matrices <span aria-hidden="true">↗</span></button></div></section></details>
      </section>

      <section class="page-view" data-view="flujo" aria-labelledby="flow-title" hidden>
        <div class="standard-heading"><span class="eyebrow">02 / ARQUITECTURA OBSERVABLE</span><h1 id="flow-title">Una cadena. <em>Responsabilidades distintas.</em></h1><p>Del original a FINISH: cómo se transforma y valida cada ficha antes de exportarla.</p></div>
        <section class="explain-card normalization-card" aria-labelledby="normalization-title">
          <div class="explain-heading"><div><span class="section-kicker">E2 / NORMALIZACIÓN</span><h2 id="normalization-title">Distintas claves. Un mismo significado.</h2></div><span class="explain-label">EJEMPLOS DE REGLA VIGENTE</span></div>
          <p class="explain-lede">Unifica nombres y unidades. Si un valor no es interpretable, no lo inventa.</p>
          <div class="normalization-diagram" role="group" aria-label="Mecanismo de normalización y posibles resultados">
            <div class="explain-steps"><span>Clave recibida</span><span>Clave canónica</span><span>Tipo y unidad</span><span>Comprobación del valor</span></div>
            <div class="normalization-outcomes"><span>Valor interpretable → campo normalizado</span><span>Conflicto o valor inválido → no se inventa</span></div>
          </div>
          <h3 class="normalization-rule-heading">Ocho correspondencias del diccionario vigente</h3>
          <div class="normalization-table-wrap"><table class="normalization-table"><caption class="sr-only">Ocho ejemplos de alias del contrato vigente</caption><thead><tr><th scope="col">Recibida</th><th scope="col">Normalizada</th><th scope="col">Tipo</th></tr></thead><tbody id="normalization-examples"></tbody></table></div>
          <div class="explain-footer"><p>Correspondencias disponibles en <code>SPEC_KEY_NORMALIZATION</code> y tipos de <code>SPEC_RULES</code>; no acreditan qué regla se aplicó a una ficha concreta.</p><button type="button" class="text-action" id="normalization-example">Ver una diferencia técnica real →</button></div>
          <details class="normalization-dictionary"><summary>Consultar diccionario completo <span id="normalization-dictionary-count"></span></summary><p>Todos los alias y claves canónicas del contrato vigente, ordenados por clave normalizada. El tipo indica el formato esperado, no la comprobación ni la transformación de un valor concreto.</p><div class="normalization-table-wrap"><table class="normalization-table"><caption class="sr-only">Diccionario completo de normalización de claves</caption><thead><tr><th scope="col">Recibida</th><th scope="col">Normalizada</th><th scope="col">Tipo</th></tr></thead><tbody id="normalization-dictionary-rows"></tbody></table></div></details>
        </section>
        <details class="audit-disclosure"><summary>Consultar matrices de recorrido y transformación (A y B)</summary><section class="surface-card matrix-card"><div class="card-heading"><div><span class="matrix-letter">A</span><h3>Pipeline por proveedor</h3></div><span class="card-side-note">Poblaciones por etapa</span></div><div class="scroll-table" id="pipeline-matrix"></div></section>
        <section class="surface-card matrix-card"><div class="card-heading"><div><span class="matrix-letter">B</span><h3>Transformaciones observadas</h3></div><span class="card-side-note">Informe técnico del corte</span></div><div class="scroll-table" id="transform-matrix"></div><p class="minor-note">Las claves técnicas incorporadas no equivalen automáticamente a datos recuperados o contrastados externamente. Una ficha transformada cuenta una vez; las descripciones cuentan por campo.</p></section>
        </details>
      </section>

      <section class="page-view" data-view="explorador" aria-labelledby="explorer-title" hidden>
        <div class="standard-heading explorer-heading"><h1 id="explorer-title">Original, FINISH <em>y Comercial.</em></h1></div>
        <div class="explorer-layout">
          <section class="surface-card explorer-filter-dashboard" aria-label="Filtros del catálogo">
            <div class="explorer-finder">
              <label class="explorer-search-label" for="explorer-search"><span class="sr-only">Buscar referencia o título</span><input id="explorer-search" type="search" placeholder="Buscar referencia o título…" autocomplete="off" aria-label="Buscar referencia o título"></label>
              <div id="explorer-provider-slot" class="explorer-provider-slot"></div>
              <div class="explorer-category-field"><span id="explorer-category-label">Categoría</span><details id="explorer-category-picker" class="explorer-category-picker"><summary id="explorer-category-summary" aria-labelledby="explorer-category-label explorer-category-current"><span id="explorer-category-current">Todas las categorías</span></summary><div class="explorer-category-panel"><label for="explorer-category-search">Buscar categoría<input id="explorer-category-search" type="search" placeholder="Filtrar categorías…" autocomplete="off"></label><div id="explorer-category-options" class="explorer-category-options" aria-label="Categorías disponibles"></div></div></details></div>
              <label class="explorer-stage-field" for="explorer-stage"><span>Estado</span><select id="explorer-stage" title="Etapa alcanzada en este corte, no publicación web"><option value="todos" id="explorer-stage-count-todos">Todas las fichas</option><option value="commercial" id="explorer-stage-count-commercial">Salida comercial</option><option value="commercial-excluded" id="explorer-stage-count-commercial-excluded">Excluidas de comercial</option><option value="editorial-excluded" id="explorer-stage-count-editorial-excluded">Excluidas de FINISH</option></select></label>
            </div>
            <div class="explorer-refinement-grid">
              <fieldset class="explorer-refinements"><legend>Carencias del original</legend><label><input type="checkbox" id="explorer-missing-short"> Descripción corta ausente</label><label><input type="checkbox" id="explorer-missing-general"> Descripción general ausente</label><label><input type="checkbox" id="explorer-without-specs"> Sin especificaciones originales</label></fieldset>
              <fieldset class="explorer-refinements"><legend>Cambios de FINISH</legend><label><input type="checkbox" id="explorer-with-additions"> Especificaciones incorporadas</label><label><input type="checkbox" id="explorer-with-changes"> Valores técnicos modificados</label><label><input type="checkbox" id="explorer-with-title-changes"> Títulos modificados</label><label><input type="checkbox" id="explorer-editorial-changes"> Descripciones cambiadas</label></fieldset>
            </div>
            <div id="explorer-active-filters" class="explorer-active-filters" aria-live="polite"></div>
          </section>
          <section class="surface-card explorer-results" id="explorer-catalog" aria-label="Resultados de búsqueda">
            <div class="explorer-catalog-heading"><div><h2>Catálogo</h2><span id="explorer-counter" class="card-side-note"></span></div><button id="explorer-catalog-toggle" type="button" aria-expanded="false" aria-controls="explorer-catalog-content">Mostrar listado</button></div>
            <div id="explorer-catalog-content" class="explorer-catalog-content">
              <label class="explorer-sort-label" for="explorer-sort">Ordenar<select id="explorer-sort"><option value="reference">Referencia · todas las fichas</option><option value="most-differences">Más diferencias Original → FINISH</option><option value="fewest-original-specs">Menos especificaciones originales</option><option value="most-technical-additions">Más especificaciones incorporadas</option><option value="most-technical-changes">Más valores técnicos modificados</option></select></label>
              <button id="explorer-show-selected" class="explorer-show-selected" type="button">Ver ficha seleccionada ↓</button>
              <div id="explorer-list" class="explorer-list"></div>
              <div class="explorer-pages"><button type="button" id="explorer-page-prev">← Anterior</button><span id="explorer-pages-label"></span><button type="button" id="explorer-page-next">Siguiente →</button></div>
            </div>
          </section>
          <section class="surface-card explorer-detail" id="explorer-detail" aria-label="Comparación de máquina"><div class="explorer-empty">Selecciona una ficha para inspeccionar el original, su publicación y el resultado comercial.</div></section>
        </div>
      </section>

      <section class="page-view" data-view="calidad" aria-labelledby="quality-title" hidden>
        <div class="standard-heading"><span class="eyebrow">04 / VALIDACIÓN Y CONTROL</span><h1 id="quality-title">Calidad <em>demostrable.</em></h1><p>Qué comprobamos, cuándo rechazamos un dato y qué fichas se excluyen.</p></div>
        <section class="explain-card checks-card" aria-labelledby="checks-title">
          <div class="explain-heading"><div><span class="section-kicker">E3 / CORROBORACIÓN DOCUMENTADA</span><h2 id="checks-title">¿Cuándo se permite incorporar una especificación?</h2></div><span class="explain-label">MECANISMO DISPONIBLE</span></div>
          <p class="explain-lede">Cuatro comprobaciones para decidir si una fuente documental puede aportar especificaciones.</p>
          <div class="validation-diagram" role="group" aria-label="Comprobaciones del mecanismo documental y sus dos posibles resultados">
            <ol class="check-sequence"><li><strong>Unidad elegible</strong><span>Proveedor, referencia, specs y condición cuando se exige</span></li><li><strong>Identidad compatible</strong><span>Marca, modelo y categoría del registro</span></li><li><strong>Coincidencia opcional</strong><span>Título y URL solo cuando la fuente los exige</span></li><li><strong>Integridad y no colisión</strong><span>Huella exacta y claves no ocupadas</span></li></ol>
            <div class="validation-junction" aria-hidden="true">↓</div>
            <div class="check-result"><div class="check-result-pass"><span class="outcome-tag">CUMPLE</span><strong>Incorporación permitida</strong><span>Solo por este mecanismo y si supera todas las condiciones exigibles.</span></div><div class="check-result-stop"><span class="outcome-tag">NO CUMPLE</span><strong>No incorporar por esta ruta</strong><span>Un campo descartado no excluye la máquina.</span></div></div>
          </div>
          <details class="mechanism-detail"><summary>Ver comprobaciones y código de referencia</summary><p><code>applyDocumentedTechnicalEvidence</code> valida <code>providerId</code>, <code>reference</code>, <code>record.specs</code>, <code>isEligible</code>, <code>requiredCondition</code> cuando existe, <code>brand</code>, <code>model</code>, <code>categoryKey</code>, <code>exactTitleAndUrl</code> cuando se solicita, <code>fingerprint</code> SHA256 de <code>JSON.stringify(record)</code> y ausencia de claves ya ocupadas. Está definida en <code>src/preparation/shared/technical/evidence/documented-technical-evidence.ts</code>; no emite un evento de aplicación histórica por campo.</p></details>
        </section>
        <section class="explain-card controls-card" aria-labelledby="controls-title">
          <div class="explain-heading"><div><span class="section-kicker">E4 / CONTROL Y EXCLUSIÓN</span><h2 id="controls-title">No todo rechazo significa lo mismo.</h2></div><span class="explain-label">ETAPAS DIFERENTES</span></div>
          <p class="explain-lede">Descartar un dato no es excluir una máquina. La decisión depende de la etapa.</p>
          <div class="control-groups" role="group" aria-label="Diferencia entre controles de datos y exclusiones de fichas">
            <section class="control-group control-fields" aria-label="Controles de campos"><div class="control-group-heading"><span>01 / DATO</span><h3>Se decide sobre un campo</h3></div><div class="control-branches"><div><strong>Sin evidencia aplicable</strong><span>No se atribuye o incorpora por esa ruta</span></div><div><strong>Conflicto al normalizar</strong><span>Campo omitido según el contrato</span></div></div></section>
            <section class="control-group control-records" aria-label="Exclusiones de fichas"><div class="control-group-heading"><span>02 / FICHA</span><h3>Se decide sobre una publicación</h3></div><div class="control-branches"><div><strong><span id="control-exclusion-editorial">—</span> exclusiones editoriales</strong><span>No llega a FINISH</span></div><div><strong><span id="control-exclusion-commercial">—</span> exclusiones comerciales</strong><span>No entra en el paquete comercial</span></div></div></section>
          </div>
          <div class="explain-footer"><button id="excluded-example" type="button" class="text-action">Ver una exclusión real →</button></div>
        </section>
      </section>
    </div>
  </main>
</div>
<dialog class="definition-dialog" id="definition-dialog" aria-labelledby="definition-title"><div class="dialog-head"><span class="section-kicker">DEFINICIÓN Y PROCEDENCIA</span><button id="close-definition" type="button" class="dialog-close" aria-label="Cerrar detalle">×</button></div><h2 id="definition-title"></h2><p id="definition-copy"></p><div id="definition-source"></div><button id="close-definition-secondary" class="dialog-action" type="button">Volver al panel</button></dialog>
<noscript><p class="no-script">Este panel local necesita JavaScript para mostrar los datos del corte y las matrices.</p></noscript>
<script type="application/json" id="panel-data">${safeJson(payload)}</script>
<script type="module">${js}</script>
<script type="module">${offlineExplorerJs}</script>
</body>
</html>`;
};

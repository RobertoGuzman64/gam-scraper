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
  const [css, js, explorerJs, selectionJs, stageCardsJs] = await Promise.all([
    readFile(join(workspace, "src", "panel", "ui", "dashboard.css"), "utf8"),
    readFile(join(workspace, "dist", "panel", "ui", "dashboard-client.js"), "utf8"),
    readFile(join(workspace, "dist", "panel", "ui", "explorer-client.js"), "utf8"),
    readFile(join(workspace, "dist", "panel", "explorer", "explorer-selection.js"), "utf8"),
    readFile(join(workspace, "dist", "panel", "ui", "explorer-stage-cards.js"), "utf8")
  ]);
  const selectionImport = '"../explorer/explorer-selection.js"';
  const cardsImport = '"./explorer-stage-cards.js"';
  if (!explorerJs.includes(selectionImport) || !explorerJs.includes(cardsImport) ||
    /(^|\n)\s*import\s/m.test(selectionJs) || /(^|\n)\s*import\s/m.test(stageCardsJs)) {
    throw new Error("No se puede integrar la selección del Explorador en el HTML autónomo");
  }
  const offlineExplorerJs = explorerJs.replace(selectionImport,
    `"data:text/javascript;base64,${Buffer.from(selectionJs, "utf8").toString("base64")}"`).replace(cardsImport,
    `"data:text/javascript;base64,${Buffer.from(stageCardsJs, "utf8").toString("base64")}"`);
  if (css.includes("</style") || js.includes("</script") || stageCardsJs.includes("</script") || offlineExplorerJs.includes("</script")) {
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
      <span class="brand-text"><strong>EQUIPZILLA</strong><small>INTELLIGENCE PANEL</small></span>
    </a>
    <nav class="nav-list" aria-label="Secciones">
      <button class="nav-button active" type="button" data-nav="resumen" aria-current="page"><span class="nav-icon" aria-hidden="true">◫</span><span>Resumen</span><span class="nav-index">01</span></button>
      <button class="nav-button" type="button" data-nav="flujo"><span class="nav-icon" aria-hidden="true">▤</span><span>Transformación</span><span class="nav-index">02</span></button>
      <button class="nav-button" type="button" data-nav="explorador"><span class="nav-icon" aria-hidden="true">⌕</span><span>Fichas reales</span><span class="nav-index">03</span></button>
      <button class="nav-button" type="button" data-nav="calidad"><span class="nav-icon" aria-hidden="true">◇</span><span>Calidad y controles</span><span class="nav-index">04</span></button>
    </nav>
    <div class="sidebar-spacer"></div>
    <div class="sidebar-bottom">
      <div class="side-status"><span class="status-dot"></span><span>Solo lectura</span></div>
    </div>
  </aside>

  <main class="main-content" id="main-content">
    <header class="topbar">
      <div class="topbar-trail"><span class="signal-mini"></span> EVIDENCIAS <span class="topbar-slash">/</span> <span id="current-view-label">RESUMEN GENERAL</span></div>
      <div class="topbar-meta"><span class="snapshot-label"><span class="live-dot"></span> CORTE VERIFICADO AL GENERAR</span><span id="header-package">—</span></div>
    </header>
    <div class="page-inner">
      <div class="page-tools">
        <div class="cut-label"><span class="cut-label-line"></span><span>FINISH + COMERCIAL <strong>DEVELOP</strong></span></div>
        <label class="filter-control"><span>Proveedor</span><select id="provider-filter" aria-label="Filtrar por proveedor"><option value="todos">Todos los proveedores</option></select></label>
      </div>
      <details class="cut-audit"><summary>Información del corte y acceso a evidencias</summary>
      <section class="evidence-access" aria-labelledby="evidence-access-title">
        <div><strong id="evidence-access-title">Evidencias locales</strong><p>Las cifras, fichas y comparaciones viajan en este archivo. Los JSON, informes y registros originales no se incluyen: sus rutas y SHA se pueden consultar aquí; solo se pueden abrir desde la estructura original del repositorio.</p><span id="evidence-access-status" role="status" aria-live="polite">Enlaces locales desactivados para evitar rutas rotas en una copia aislada.</span></div>
        <button type="button" id="local-evidence-toggle" aria-pressed="false">Activar enlaces del repositorio</button>
      </section>
      <section class="cut-status" aria-labelledby="cut-status-title">
        <div class="cut-status-copy"><span class="section-kicker">VIGENCIA DEL CORTE</span><h2 id="cut-status-title">Técnico y comercial coherentes al generar</h2><p>Las publicaciones FINISH y el paquete comercial correspondían al mismo corte al construir este HTML. Es una instantánea fija: abrirla o recargarla no comprueba las selecciones actuales del repositorio.</p></div>
        <div class="cut-status-meta"><span>PAQUETE COMERCIAL · SHA256</span><code id="cut-package-sha">—</code><button class="text-action" type="button" data-go="calidad">Ver fuentes y huellas <span aria-hidden="true">↗</span></button></div>
      </section>
      </details>
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
            <div class="explain-steps"><span>Clave recibida</span><span>Alias canónico</span><span>Tipo y unidad</span><span>Comprobación del valor</span></div>
            <div class="normalization-outcomes"><span>Valor interpretable → campo normalizado</span><span>Conflicto o valor inválido → no se inventa</span></div>
          </div>
          <div class="normalization-rule-heading">Tres correspondencias del diccionario vigente</div>
          <div class="normalization-examples" id="normalization-examples" aria-label="Correspondencias del diccionario real"></div>
          <div class="explain-footer"><p>Ejemplos del contrato <code>SPEC_KEY_NORMALIZATION</code>, no cambios atribuidos a estas publicaciones.</p><button type="button" class="text-action" id="normalization-example">Ver una diferencia técnica real →</button></div>
          <details class="mechanism-detail"><summary>Ver condiciones y límites del normalizador</summary><p>Se controlan claves desconocidas, valores no interpretables, formatos inválidos, conflictos entre alias y unidades incompatibles. Fuente: <code>src/catalog/normalization/spec-rules.ts</code> y <code>normalize-specs.ts</code>. La lista expone reglas disponibles, no un registro histórico de invocaciones.</p></details>
        </section>
        <details class="audit-disclosure"><summary>Ver las cuatro etapas del circuito</summary><div class="stage-strip" id="stage-strip"></div></details>
        <details class="audit-disclosure"><summary>Consultar matrices técnicas A–D</summary><section class="surface-card matrix-card"><div class="card-heading"><div><span class="matrix-letter">A</span><h3>Pipeline por proveedor</h3></div><span class="card-side-note">Poblaciones por etapa</span></div><div class="scroll-table" id="pipeline-matrix"></div></section>
        <section class="surface-card matrix-card"><div class="card-heading"><div><span class="matrix-letter">B</span><h3>Transformaciones observadas</h3></div><span class="card-side-note">Informe técnico del corte</span></div><div class="scroll-table" id="transform-matrix"></div><p class="minor-note">Las claves técnicas incorporadas no equivalen automáticamente a datos recuperados o contrastados externamente. Una ficha transformada cuenta una vez; las descripciones cuentan por campo.</p></section>
        <section class="surface-card matrix-card"><div class="card-heading"><div><span class="matrix-letter">C</span><h3>Calidad y acreditación</h3></div><span class="card-side-note">Exclusiones y pendientes</span></div><div class="scroll-table" id="quality-matrix"></div></section>
        <section class="surface-card matrix-card"><div class="card-heading"><div><span class="matrix-letter">D</span><h3>Lógica y decisiones documentadas</h3></div><span class="card-side-note">Sin atribuciones causales inventadas</span></div><div class="scroll-table" id="decisions-matrix"></div></section>
        </details>
      </section>

      <section class="page-view" data-view="explorador" aria-labelledby="explorer-title" hidden>
        <div class="standard-heading explorer-heading"><span class="eyebrow">03 / FICHAS REALES</span><h1 id="explorer-title">Original, FINISH <em>y Comercial.</em></h1></div>
        <div class="explorer-controls">
          <label>Buscar máquina<input id="explorer-search" type="search" placeholder="Referencia, modelo o título…" autocomplete="off"></label>
          <label>Categoría<select id="explorer-category"><option value="todos">Todas las categorías</option></select></label>
          <label>Ordenar por<select id="explorer-sort"><option value="most-differences">Más diferencias observadas</option><option value="fewest-original-specs">Menos especificaciones de origen</option><option value="most-technical-additions">Más especificaciones incorporadas</option><option value="most-technical-changes">Más valores técnicos modificados</option><option value="reference">Referencia · incluir excluidas</option></select></label>
        </div>
        <details class="explorer-advanced"><summary>Más filtros<span id="explorer-extra-count"></span></summary><div class="explorer-advanced-content">
          <label>Etapa<select id="explorer-stage"><option value="todos">Todas las etapas</option><option value="commercial">Exportadas comerciales</option><option value="commercial-excluded">Excluidas comerciales</option><option value="editorial-excluded">Excluidas editoriales</option></select></label>
          <fieldset class="explorer-refinements"><legend>Carencias y cambios</legend><label><input type="checkbox" id="explorer-missing-description"> Alguna descripción original ausente</label><label><input type="checkbox" id="explorer-without-specs"> Sin especificaciones de origen</label><label><input type="checkbox" id="explorer-with-additions"> Con especificaciones incorporadas</label><label><input type="checkbox" id="explorer-editorial-changes"> Con descripciones cambiadas</label></fieldset>
        </div></details>
        <div class="explorer-layout"><section class="surface-card explorer-results" aria-label="Resultados de búsqueda"><div class="card-heading"><h3>Máquinas</h3><span id="explorer-counter" class="card-side-note"></span></div><div id="explorer-active-filters" class="explorer-active-filters" aria-live="polite"></div><p id="explorer-order-note" class="explorer-order-note">Ordenaciones por diferencias observadas entre original y FINISH; no son puntuaciones de calidad.</p><div id="explorer-list" class="explorer-list"></div><div class="explorer-pages"><button type="button" id="explorer-page-prev">← Anterior</button><span id="explorer-pages-label"></span><button type="button" id="explorer-page-next">Siguiente →</button></div></section>
          <section class="surface-card explorer-detail" id="explorer-detail" aria-label="Comparación de máquina"><div class="explorer-empty">Selecciona una ficha para inspeccionar el original, su publicación y el resultado comercial.</div></section></div>
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
            <section class="control-group control-fields" aria-label="Controles de campos"><div class="control-group-heading"><span>01 / DATO</span><h3>Se decide sobre un campo</h3></div><div class="control-branches"><div><strong>Sin evidencia aplicable</strong><span>No se atribuye o incorpora por esa ruta</span><small>Control de campo</small></div><div><strong>Conflicto al normalizar</strong><span>Campo omitido según el contrato</span><small>Control técnico</small></div></div></section>
            <section class="control-group control-records" aria-label="Exclusiones de fichas"><div class="control-group-heading"><span>02 / FICHA</span><h3>Se decide sobre una publicación</h3></div><div class="control-branches"><div><strong><span id="control-exclusion-editorial">—</span> exclusiones editoriales</strong><span>No llega a FINISH</span><small>Acreditación editorial</small></div><div><strong><span id="control-exclusion-commercial">—</span> exclusiones comerciales</strong><span>No entra en el paquete comercial</span><small>Proyección comercial</small></div></div></section>
          </div>
          <div class="explain-footer"><button id="excluded-example" type="button" class="text-action">Ver una exclusión real →</button></div>
        </section>
        <details class="audit-disclosure"><summary>Ver indicadores de incidencias del corte</summary><div class="quality-highlights" id="quality-highlights"></div></details>
        <details class="audit-disclosure"><summary>Consultar evidencias, límites e informes del corte</summary><div class="evidence-layout"><section class="surface-card"><div class="card-heading"><div><span class="section-kicker">TRAZABILIDAD</span><h3>Fuentes activas</h3></div></div><div id="evidence-list"></div></section><section class="surface-card limits-panel"><div class="card-heading"><div><span class="section-kicker">SIN INFERENCIAS</span><h3>Límites declarados</h3></div></div><div id="limit-list"></div></section></div>
        <section class="surface-card source-card"><div class="card-heading"><div><span class="section-kicker">ÍNDICES E INFORMES</span><h3>Identidad de este corte</h3></div></div><div id="source-list" class="source-list"></div></section></details>
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

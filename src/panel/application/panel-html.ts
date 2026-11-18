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
  const [css, js, explorerJs] = await Promise.all([
    readFile(join(workspace, "src", "panel", "ui", "dashboard.css"), "utf8"),
    readFile(join(workspace, "dist", "panel", "ui", "dashboard-client.js"), "utf8"),
    readFile(join(workspace, "dist", "panel", "ui", "explorer-client.js"), "utf8")
  ]);
  if (css.includes("</style") || js.includes("</script") || explorerJs.includes("</script")) {
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
    <div class="sidebar-section">VISUALIZACIÓN</div>
    <nav class="nav-list" aria-label="Secciones">
      <button class="nav-button active" type="button" data-nav="resumen" aria-current="page"><span class="nav-icon" aria-hidden="true">◫</span><span>Resumen</span><span class="nav-index">01</span></button>
      <button class="nav-button" type="button" data-nav="flujo"><span class="nav-icon" aria-hidden="true">▤</span><span>Flujo y matrices</span><span class="nav-index">02</span></button>
      <button class="nav-button" type="button" data-nav="explorador"><span class="nav-icon" aria-hidden="true">⌕</span><span>Explorador de fichas</span><span class="nav-index">03</span></button>
      <button class="nav-button" type="button" data-nav="calidad"><span class="nav-icon" aria-hidden="true">◇</span><span>Calidad y evidencias</span><span class="nav-index">04</span></button>
    </nav>
    <div class="sidebar-spacer"></div>
    <div class="sidebar-bottom">
      <div class="side-status"><span class="status-dot"></span><span>Consulta local · Solo lectura</span></div>
      <div class="side-caption">Cada cifra puede rastrearse hasta los manifiestos e informes del corte seleccionado.</div>
      <div class="version-label">EQUIPZILLA / DEVELOP</div>
    </div>
  </aside>

  <main class="main-content" id="main-content">
    <header class="topbar">
      <div class="topbar-trail"><span class="signal-mini"></span> EVIDENCIAS <span class="topbar-slash">/</span> <span id="current-view-label">RESUMEN GENERAL</span></div>
      <div class="topbar-meta"><span class="snapshot-label"><span class="live-dot"></span> CORTE FIJO · VERIFICADO AL GENERAR</span> <span class="meta-divider"></span> <span id="header-package">—</span><button type="button" id="presentation-start" class="presentation-start">▶ Presentación</button></div>
    </header>
    <div class="page-inner">
      <section class="presentation-strip" id="presentation-strip" aria-label="Recorrido guiado" hidden>
        <div class="presentation-copy"><span class="section-kicker" id="presentation-progress">RECORRIDO</span><strong id="presentation-heading"></strong><span id="presentation-description"></span></div>
        <div class="presentation-controls"><button id="presentation-prev" type="button">← Anterior</button><button id="presentation-next" type="button">Siguiente →</button><button id="presentation-exit" type="button" aria-label="Salir del modo presentación">Salir</button></div>
      </section>
      <div class="page-tools">
        <div class="cut-label"><span class="cut-label-line"></span><span>PUBLICACIONES INDIVIDUALES + PROYECCIÓN COMERCIAL <strong>DEVELOP</strong></span></div>
        <label class="filter-control"><span>Proveedor</span><select id="provider-filter" aria-label="Filtrar por proveedor"><option value="todos">Todos los proveedores</option></select></label>
      </div>
      <section class="evidence-access" aria-labelledby="evidence-access-title">
        <div><strong id="evidence-access-title">Presentación offline · evidencias externas al HTML</strong><p>Las cifras, fichas y comparaciones viajan en este archivo. Los JSON, informes y registros originales no se incluyen: sus rutas y SHA se pueden consultar aquí; solo se pueden abrir desde la estructura original del repositorio.</p><span id="evidence-access-status" role="status" aria-live="polite">Enlaces locales desactivados para evitar rutas rotas en una copia aislada.</span></div>
        <button type="button" id="local-evidence-toggle" aria-pressed="false">Activar enlaces del repositorio</button>
      </section>
      <section class="cut-status" aria-labelledby="cut-status-title">
        <div class="cut-status-copy"><span class="section-kicker">VIGENCIA DEL CORTE</span><h2 id="cut-status-title">Técnico y comercial coherentes al generar</h2><p>Las publicaciones FINISH y el paquete comercial correspondían al mismo corte al construir este HTML. Es una instantánea fija: abrirla o recargarla no comprueba las selecciones actuales del repositorio.</p></div>
        <div class="cut-status-meta"><span>PAQUETE COMERCIAL · SHA256</span><code id="cut-package-sha">—</code><button class="text-action" type="button" data-go="calidad">Ver fuentes y huellas <span aria-hidden="true">↗</span></button></div>
      </section>
      <section class="page-view" data-view="resumen" aria-labelledby="overview-title">
        <div class="hero">
          <div class="hero-copy"><span class="eyebrow">01 / VISTA EJECUTIVA</span><h1 id="overview-title">El catálogo, <em>con evidencia.</em></h1><p>De los originales de proveedor a las publicaciones acreditadas y su salida comercial. Un mismo corte, sin estimaciones ni resultados ficticios.</p><div class="hero-tags"><span id="provider-summary">3 PROVEEDORES</span><span class="hero-tag-separator"></span><span id="package-summary">CORTE —</span><span class="hero-tag-separator"></span><span>BD NO VERIFICADA</span></div></div>
          <div class="hero-emblem" aria-hidden="true"><div class="emblem-rings"><span>E</span><span class="emblem-axis axis-a"></span><span class="emblem-axis axis-b"></span></div><div class="emblem-line">SOURCE → EVIDENCE → OUTPUT</div></div>
        </div>
        <div class="section-heading"><div><span class="section-kicker">EL ESTADO DEL CORTE</span><h2 id="overview-kpis-title">Magnitudes principales</h2></div><span class="section-aside">Datos del corte · <span id="scope-summary">Conjunto completo</span></span></div>
        <div class="kpi-grid" id="overview-kpis"></div>
        <section class="explain-card source-map" aria-labelledby="source-map-title">
          <div class="explain-heading"><div><span class="section-kicker">E1 / MAPA DE PROCEDENCIA</span><h2 id="source-map-title">¿De dónde pueden venir los datos?</h2></div><span class="explain-label">MECANISMO CONCEPTUAL</span></div>
          <p class="explain-lede">Partimos del original del proveedor. Según la unidad y el motor aplicable, podemos contrastar información documental, referencias de modelo o conocimiento editorial; una fuente disponible no implica que se haya usado.</p>
          <div class="source-map-grid" aria-label="Fuentes posibles, comprobación y resultado">
            <div class="source-map-inputs"><span>FUENTES POSIBLES · SEGÚN APLICABILIDAD</span><div>Original del proveedor <small>Unidad y origen</small></div><div>Evidencia documental <small>Unidad concreta</small></div><div>Fabricante y modelo <small>Alcance de modelo</small></div><div>Conocimiento editorial <small>Registro compatible</small></div><div>Intervención <small>Solo si está acreditada</small></div></div>
            <div class="explain-arrow" aria-hidden="true">→</div><div class="source-map-process"><strong>Comprobar y transformar</strong><span>Identidad · evidencia · reglas aplicables</span><small>No toda fuente se aplica a toda ficha</small></div><div class="explain-arrow" aria-hidden="true">→</div><div class="source-map-output"><strong>FINISH</strong><span>Publicación técnica</span><div class="source-map-commercial">↓ Proyección comercial compatible</div></div>
          </div>
          <div class="explain-footer"><p>Las diferencias y los SHA acreditan un resultado y su corte; no atribuyen por sí solos una regla histórica.</p><button type="button" class="text-action" id="source-example">Ver un cambio observado →</button></div>
        </section>
        <details class="audit-disclosure"><summary>Explorar desgloses de volumen, proveedores y controles</summary><div class="dashboard-columns">
          <section class="surface-card volume-card" aria-labelledby="volume-title"><div class="card-heading"><div><span class="section-kicker">EVOLUCIÓN DEL VOLUMEN</span><h3 id="volume-title">Del origen al paquete</h3></div><span class="card-side-note">Misma población, etapas distintas</span></div><div id="volume-flow" class="volume-flow"></div><div class="minor-note">Las exclusiones editoriales y comerciales pertenecen a etapas diferentes y no se agregan como un único descarte.</div></section>
          <section class="surface-card coverage-card" aria-labelledby="coverage-title"><div class="card-heading"><div><span class="section-kicker">DESGLOSE ACREDITADO</span><h3 id="coverage-title">Cobertura por proveedor</h3></div><span class="card-side-note">Original / publicado / comercial</span></div><div id="provider-chart" class="provider-chart"></div><div class="chart-footer"><span id="chart-scale"></span><button class="text-action" type="button" data-go="flujo">Abrir matrices <span aria-hidden="true">↗</span></button></div></section>
        </div>
        <section class="insight-row" id="overview-insights" aria-label="Lectura ejecutiva del corte"></section></details>
      </section>

      <section class="page-view" data-view="flujo" aria-labelledby="flow-title" hidden>
        <div class="standard-heading"><span class="eyebrow">02 / ARQUITECTURA OBSERVABLE</span><h1 id="flow-title">Una cadena. <em>Responsabilidades distintas.</em></h1><p>Extraer, preparar, acreditar, publicar y exportar no son sinónimos. Aquí se distinguen los controles y los artefactos que respaldan cada transición.</p></div>
        <div class="section-heading"><div><span class="section-kicker">EL RECORRIDO</span><h2>De fuente a salida</h2></div><span class="section-aside">Sin ejecución ni escritura desde el panel</span></div>
        <div class="stage-strip" id="stage-strip"></div>
        <section class="explain-card normalization-card" aria-labelledby="normalization-title">
          <div class="explain-heading"><div><span class="section-kicker">E2 / NORMALIZACIÓN</span><h2 id="normalization-title">Distintas claves. Un mismo significado.</h2></div><span class="explain-label">EJEMPLOS DE REGLA VIGENTE</span></div>
          <p class="explain-lede">El normalizador unifica nombres y valida tipos y unidades. No inventa un valor cuando es ilegible, ni convierte una normalización en verificación externa de la prestación.</p>
          <div class="explain-steps" aria-label="Esquema del mecanismo de normalización"><span>Clave recibida</span><span>Alias canónico</span><span>Tipo y unidad</span><span>Valor admitido o descartado</span></div>
          <div class="normalization-examples" id="normalization-examples" aria-label="Correspondencias del diccionario real"></div>
          <div class="explain-footer"><p>Ejemplos del contrato <code>SPEC_KEY_NORMALIZATION</code>, no cambios atribuidos a estas publicaciones.</p><button type="button" class="text-action" id="normalization-example">Ver una diferencia técnica real →</button></div>
          <details class="mechanism-detail"><summary>Ver condiciones y límites del normalizador</summary><p>Se controlan claves desconocidas, valores no interpretables, formatos inválidos, conflictos entre alias y unidades incompatibles. Fuente: <code>src/catalog/normalization/spec-rules.ts</code> y <code>normalize-specs.ts</code>. La lista expone reglas disponibles, no un registro histórico de invocaciones.</p></details>
        </section>
        <div class="matrix-intro"><span class="section-kicker">DATOS AUDITABLES</span><h2>Las matrices</h2><p>Selecciona un proveedor arriba para acotar todos los recuentos. La fila total solo aparece cuando se muestra el conjunto completo.</p></div>
        <details class="audit-disclosure"><summary>Consultar matrices A–D e información no disponible</summary><section class="surface-card matrix-card"><div class="card-heading"><div><span class="matrix-letter">A</span><h3>Pipeline por proveedor</h3></div><span class="card-side-note">Poblaciones por etapa</span></div><div class="scroll-table" id="pipeline-matrix"></div></section>
        <section class="surface-card matrix-card"><div class="card-heading"><div><span class="matrix-letter">B</span><h3>Transformaciones observadas</h3></div><span class="card-side-note">Informe técnico del corte</span></div><div class="scroll-table" id="transform-matrix"></div><p class="minor-note">Las claves técnicas incorporadas no equivalen automáticamente a datos recuperados o contrastados externamente. Una ficha transformada cuenta una vez; las descripciones cuentan por campo.</p></section>
        <section class="surface-card matrix-card"><div class="card-heading"><div><span class="matrix-letter">C</span><h3>Calidad y acreditación</h3></div><span class="card-side-note">Exclusiones y pendientes</span></div><div class="scroll-table" id="quality-matrix"></div></section>
        <section class="surface-card matrix-card"><div class="card-heading"><div><span class="matrix-letter">D</span><h3>Lógica y decisiones documentadas</h3></div><span class="card-side-note">Sin atribuciones causales inventadas</span></div><div class="scroll-table" id="decisions-matrix"></div></section>
        <div class="coverage-unavailable"><strong>MATRIZ E / COBERTURA POR FAMILIA</strong><span>No disponible para este corte: los informes versionados no acreditan ese desglose. No se incorporan cifras de auditorías posteriores.</span></div></details>
      </section>

      <section class="page-view" data-view="explorador" aria-labelledby="explorer-title" hidden>
        <div class="standard-heading"><span class="eyebrow">03 / COMPARADOR DE FICHAS</span><h1 id="explorer-title">Cada máquina, <em>con su procedencia.</em></h1><p>Origen acreditado, resultado FINISH y salida comercial. Las diferencias son observaciones de valores, no atribuciones automáticas a reglas.</p></div>
        <div class="explorer-controls">
          <label>Buscar referencia, modelo o título<input id="explorer-search" type="search" placeholder="Buscar una máquina o referencia…" autocomplete="off"></label>
          <label>Etapa<select id="explorer-stage"><option value="todos">Todas las etapas</option><option value="commercial">Exportadas comerciales</option><option value="commercial-excluded">Excluidas comerciales</option><option value="editorial-excluded">Excluidas editoriales</option></select></label>
          <label>Familia / categoría<select id="explorer-category"><option value="todos">Todas las categorías</option></select></label>
        </div>
        <div class="explorer-layout"><section class="surface-card explorer-results" aria-label="Resultados de búsqueda"><div class="card-heading"><h3>Fichas del corte</h3><span id="explorer-counter" class="card-side-note"></span></div><div id="explorer-cases" class="explorer-cases" aria-label="Casos de demostración"></div><div id="explorer-list" class="explorer-list"></div><div class="explorer-pages"><button type="button" id="explorer-page-prev">← Anterior</button><span id="explorer-pages-label"></span><button type="button" id="explorer-page-next">Siguiente →</button></div></section>
          <section class="surface-card explorer-detail" id="explorer-detail" aria-label="Comparación de máquina"><div class="explorer-empty">Selecciona una ficha para inspeccionar el original, su publicación y el resultado comercial.</div></section></div>
      </section>

      <section class="page-view" data-view="calidad" aria-labelledby="quality-title" hidden>
        <div class="standard-heading"><span class="eyebrow">04 / CONFIANZA Y LÍMITES</span><h1 id="quality-title">Lo que sabemos. <em>Y lo que no.</em></h1><p>El panel muestra exclusiones, límites comerciales y procedencia, sin esconder las evidencias que todavía no existen.</p></div>
        <div class="quality-highlights" id="quality-highlights"></div>
        <section class="explain-card checks-card" aria-labelledby="checks-title">
          <div class="explain-heading"><div><span class="section-kicker">E3 / CORROBORACIÓN DOCUMENTADA</span><h2 id="checks-title">¿Cuándo se permite incorporar una especificación?</h2></div><span class="explain-label">MECANISMO DISPONIBLE</span></div>
          <p class="explain-lede">Una ruta técnica documentada contrasta el candidato con el registro y rechaza el añadido si falla una condición requerida. No representa todos los recuperadores ni certifica que esta ruta actuara en cada publicación.</p>
          <ol class="check-sequence"><li><strong>Unidad elegible</strong><span>Proveedor, referencia, specs, condición si se exige</span></li><li><strong>Identidad compatible</strong><span>Marca, modelo y categoría del registro</span></li><li><strong>Coincidencia opcional</strong><span>Título y URL exactos solo cuando la fuente lo exige</span></li><li><strong>Integridad y no colisión</strong><span>Huella del registro completo y ninguna clave ya existente</span></li></ol>
          <div class="check-result"><span>Si supera todas las comprobaciones exigibles → el mecanismo puede incorporar las specs</span><span>Si falla alguna → no se incorporan por esta ruta</span></div>
          <details class="mechanism-detail"><summary>Ver comprobaciones y código de referencia</summary><p><code>applyDocumentedTechnicalEvidence</code> valida <code>providerId</code>, <code>reference</code>, <code>record.specs</code>, <code>isEligible</code>, <code>requiredCondition</code> cuando existe, <code>brand</code>, <code>model</code>, <code>categoryKey</code>, <code>exactTitleAndUrl</code> cuando se solicita, <code>fingerprint</code> SHA256 de <code>JSON.stringify(record)</code> y ausencia de claves ya ocupadas. Está definida en <code>src/preparation/shared/technical/evidence/documented-technical-evidence.ts</code>; no emite un evento de aplicación histórica por campo.</p></details>
        </section>
        <section class="explain-card controls-card" aria-labelledby="controls-title">
          <div class="explain-heading"><div><span class="section-kicker">E4 / CONTROL Y EXCLUSIÓN</span><h2 id="controls-title">No todo rechazo significa lo mismo.</h2></div><span class="explain-label">ETAPAS DIFERENTES</span></div>
          <p class="explain-lede">Una especificación no sustentada puede no incorporarse sin excluir la máquina. Las exclusiones editoriales y comerciales pertenecen a decisiones distintas y tienen sus propios motivos acreditados.</p>
          <div class="control-branches"><div><strong>Sin evidencia aplicable</strong><span>Sin atribución o sin añadido por esa ruta</span><small>Control de campo</small></div><div><strong>Conflicto al normalizar</strong><span>Campo conflictivo omitido según el contrato</span><small>Control técnico</small></div><div><strong><span id="control-exclusion-editorial">—</span> exclusiones editoriales</strong><span>No llega a FINISH</span><small>Acreditación editorial</small></div><div><strong><span id="control-exclusion-commercial">—</span> exclusiones comerciales</strong><span>No entra en el paquete comercial</span><small>Proyección comercial</small></div></div>
          <div class="explain-footer"><p>Los dos primeros controles no son un censo de exclusiones de máquinas. Los recuentos proceden del corte y respetan el proveedor filtrado.</p><button id="excluded-example" type="button" class="text-action">Ver una exclusión real →</button></div>
        </section>
        <div class="section-heading"><div><span class="section-kicker">ESTADO DE LAS PRUEBAS</span><h2 id="quality-evidence-title">Evidencia y alcance</h2></div><span class="section-aside">Datos locales seleccionados por SHA</span></div>
        <details class="audit-disclosure"><summary>Inspeccionar evidencias, límites e informes del corte</summary><div class="evidence-layout"><section class="surface-card"><div class="card-heading"><div><span class="section-kicker">TRAZABILIDAD</span><h3>Fuentes activas</h3></div></div><div id="evidence-list"></div></section><section class="surface-card limits-panel"><div class="card-heading"><div><span class="section-kicker">SIN INFERENCIAS</span><h3>Límites declarados</h3></div></div><div id="limit-list"></div></section></div>
        <section class="surface-card source-card"><div class="card-heading"><div><span class="section-kicker">ÍNDICES E INFORMES</span><h3>Identidad de este corte</h3></div></div><div id="source-list" class="source-list"></div></section></details>
      </section>
      <footer class="main-footer"><span>EQUIPZILLA · PANEL DE EVIDENCIAS</span><span>Lectura local sin acceso de escritura · Integración en BD no verificada</span></footer>
    </div>
  </main>
</div>
<dialog class="definition-dialog" id="definition-dialog" aria-labelledby="definition-title"><div class="dialog-head"><span class="section-kicker">DEFINICIÓN Y PROCEDENCIA</span><button id="close-definition" type="button" class="dialog-close" aria-label="Cerrar detalle">×</button></div><h2 id="definition-title"></h2><p id="definition-copy"></p><div id="definition-source"></div><button id="close-definition-secondary" class="dialog-action" type="button">Volver al panel</button></dialog>
<noscript><p class="no-script">Este panel local necesita JavaScript para mostrar los datos del corte y las matrices.</p></noscript>
<script type="application/json" id="panel-data">${safeJson(payload)}</script>
<script type="module">${js}</script>
<script type="module">${explorerJs}</script>
</body>
</html>`;
};

import assert from "node:assert/strict";
import { test } from "node:test";
import { SPEC_KEY_NORMALIZATION, SPEC_RULES } from "../../../catalog/normalization/spec-rules.js";
import { createDashboardPayload } from "../dashboard-data.js";
import { readPanelRuleExamples } from "../panel-rule-examples.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { renderPanelHtml as renderAutonomousHtml } from "../panel-html.js";
import { readPanelSnapshot } from "../../evidence/read-panel-snapshot.js";
import { readPanelExplorer } from "../../explorer/read-panel-explorer.js";
import { createPanelEvidenceWorkspaceFixture } from "../../../testing/builders/panel-evidence-workspace-fixture.js";

const fixture = createPanelEvidenceWorkspaceFixture();
const renderPanelHtml = async (...args: Parameters<typeof renderAutonomousHtml>): Promise<string> => {
  const html = await renderAutonomousHtml(...args);
  const source = await Promise.all([
    "dashboard-client.js", "explorer-client.js", "explorer-detail.js", "explorer-detail-sections.js",
    "explorer-specifications.js", "explorer-spec-summary.js", "explorer-filter-controls.js", "explorer-stage-cards.js"
  ].map((file) => readFile(join(process.cwd(), "dist", "panel", "ui", file), "utf8")));
  return `${html}\n${source.join("\n")}`;
};

const prepareStaticPanel = async () => {
  const workspace = await fixture.root();
  const snapshot = await readPanelSnapshot(workspace);
  const snapshotBeforeView = JSON.stringify(snapshot);
  const dashboard = createDashboardPayload(snapshot, await readPanelExplorer(workspace, snapshot));
  const html = await renderPanelHtml(process.cwd(), dashboard);
  return { snapshot, dashboard, html, snapshotBeforeView };
};

let staticPanel: ReturnType<typeof prepareStaticPanel> | undefined;
const readStaticPanel = (): ReturnType<typeof prepareStaticPanel> =>
  staticPanel ??= prepareStaticPanel();

test("el panel deriva todos los indicadores del corte y conserva las poblaciones por etapa", async () => {
  const { snapshot, dashboard } = await readStaticPanel();
  assert.equal(dashboard.snapshot, snapshot);
  assert.equal(dashboard.definitions.length, 19);
  assert.ok(!("decisions" in dashboard));
  for (const provider of dashboard.snapshot.providers) {
    assert.equal(provider.metrics.originals, provider.metrics.published + provider.metrics.excludedEditorial);
    assert.equal(provider.metrics.published, provider.metrics.exported + provider.metrics.excludedCommercial);
    assert.equal(provider.metrics.exported, provider.metrics.categorized + provider.metrics.pendingCategory);
  }
  assert.equal(dashboard.snapshot.totals.pendingCategory,
    snapshot.providers.reduce((count, provider) => count + provider.metrics.pendingCategory, 0));
  assert.ok(!("backendIntegration" in dashboard.snapshot));
});

test("el HTML autónomo contiene los contratos acreditados sin valores prefijados de catálogo", async () => {
  const { snapshot, html } = await readStaticPanel();
  assert.match(html, /<html lang="es">/);
  assert.match(html, /data-view="resumen"/);
  assert.match(html, /data-view="flujo"/);
  assert.match(html, /data-view="calidad"/);
  assert.match(html, /data-view="explorador"/);
  assert.ok(html.includes("explorer-search"));
  for (const id of ["explorer-sort", "explorer-missing-short", "explorer-missing-general",
    "explorer-without-specs", "explorer-with-additions", "explorer-with-changes",
    "explorer-with-title-changes", "explorer-editorial-changes", "explorer-active-filters",
    "explorer-provider-slot", "explorer-category-picker", "explorer-category-search",
    "explorer-stage-count-commercial-excluded", "explorer-stage-count-editorial-excluded", "explorer-show-selected",
    "explorer-catalog-toggle", "explorer-stage"]) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.ok(html.includes("Más especificaciones incorporadas"));
  assert.ok(html.includes("Menos especificaciones originales"));
  assert.ok(html.includes("selectExplorerProducts(products, filters.selection(), index)"));
  assert.ok(html.includes("data:text/javascript;base64,"));
  assert.ok(!html.split("</html>")[0]?.includes('from "../explorer/explorer-selection.js"'));
  assert.ok(html.includes("Original → FINISH"));
  assert.ok(html.includes("Buscar referencia o título"));
  assert.ok(html.includes("Carencias del original"));
  assert.ok(html.includes("Cambios de FINISH"));
  assert.ok(!html.includes('<details class="explorer-advanced">'));
  assert.ok(html.includes('id="explorer-active-filters"'));
  assert.ok(html.includes('id="explorer-provider-slot"'));
  assert.ok(!html.includes("panel:enable-local-evidence"));
  assert.ok(!html.includes("panel:local-evidence-updated"));
  assert.ok(html.includes(".explorer-list {max-height:none;overflow:visible}"));
  assert.ok(html.includes("grid-template-columns:repeat(2,minmax(0,1fr))"));
  assert.ok(!html.includes('id="explorer-cases"'));
  assert.ok(!html.includes("renderCommercialSummary(item)"));
  assert.ok(!html.includes("renderChangeSummary(item)"));
  assert.ok(!html.includes("presentation-start"));
  assert.ok(!html.includes("presentation-strip"));
  assert.ok(!html.includes("presentationSteps"));
  assert.ok(html.includes("CORTE VERIFICADO AL GENERAR"));
  assert.ok(!html.includes('class="cut-audit"'));
  assert.ok(!html.includes('id="cut-package-sha"'));
  assert.ok(!html.includes('id="current-view-label"'));
  assert.ok(!html.includes('class="nav-index"'));
  assert.ok(!html.includes('class="evidence-access"'));
  assert.ok(!html.includes('id="evidence-access-status"'));
  assert.ok(html.includes("Publicación individual del corte"));
  assert.ok(!html.includes("Publicación individual vigente"));
  assert.ok(html.includes("Comparar contenido de la ficha"));
  assert.ok(html.includes("Especificaciones alineadas por campo"));
  assert.ok(!html.includes("Ver trazabilidad"));
  assert.ok(!html.includes("spec-provenance-details"));
  assert.ok(html.includes('id="explorer-spec-kind"'));
  assert.ok(html.includes("spec-kind-own"));
  assert.ok(html.includes("spec-kind-reused"));
  assert.ok(!html.includes('value="documented"'));
  assert.ok(html.includes("Excluida de FINISH"));
  assert.ok(html.includes("Comparación de máquina"));
  assert.match(html, /<script type="module">/);
  assert.ok(!html.includes("backendIntegration"));
  assert.ok(html.includes(`"packageDateUtc":"${snapshot.packageDateUtc}"`));
  assert.ok(html.includes(`"sha256":"${snapshot.commercialManifest.sha256}"`));
  assert.ok(html.includes(`"originals":${snapshot.totals.originals}`));
  assert.ok(html.includes(`"pendingCategory":${snapshot.totals.pendingCategory}`));
  assert.ok(!html.includes("Lógica y decisiones documentadas"));
  assert.ok(!html.includes('title: "BACKEND"'));
  assert.ok(!html.includes('Integración en BD no verificada'));
  assert.ok(!html.includes('overview-insights'));
  assert.ok(!html.includes('volume-flow'));
  assert.ok(!html.includes('BD NO VERIFICADA'));
  assert.ok(!html.includes('MATRIZ E / COBERTURA POR FAMILIA'));
  const embeddedCss = html.split("<style>")[1]?.split("</style>")[0];
  assert.ok(embeddedCss);
  assert.ok(!/font-size\s*:\s*(?:[0-9]|1[0-4])px(?=\s*[;}\n])/.test(embeddedCss));
  assert.ok(embeddedCss.includes("--type-secondary:15px"));
  assert.ok(embeddedCss.includes("font-size:var(--type-body)"));
  assert.ok(html.includes("Matriz"));
  assert.ok(!html.includes("https://fonts.googleapis.com"));
  assert.ok(!html.includes("<script type=\"module\" src="));
  assert.ok(html.includes("const metricsFor = (scope) =>"));
  assert.ok(html.includes("const visibleProducts = () =>"));
  assert.ok(html.includes("const placeProvider = (view) =>"));
  assert.ok(html.includes("explorer-filter-dashboard"));
});

test("el HTML neutraliza etiquetas incrustadas en datos de procedencia", async () => {
  const { dashboard: base } = await readStaticPanel();
  const poisoned = {
    ...base,
    names: { ...base.names, gam: "</script><script>alert(1)</script>" }
  };
  const html = await renderPanelHtml(process.cwd(), poisoned);
  assert.ok(html.includes("\\u003c/script\\u003e"));
  assert.ok(!html.includes("</script><script>alert(1)</script>"));
});

test("Calidad y controles conserva exclusivamente las etapas 3 y 4 originales", async () => {
  const { snapshot, html } = await readStaticPanel();
  const quality = html.split('data-view="calidad"')[1]?.split('data-view="explorador"')[0];
  assert.ok(quality);
  assert.equal((quality.match(/<section class="explain-card/g) ?? []).length, 2);
  assert.equal((quality.match(/class="section-kicker"/g) ?? []).length, 2);
  assert.ok(quality.includes("ETAPA 3 / CORROBORACIÓN DOCUMENTADA"));
  assert.ok(quality.includes("ETAPA 4 / CONTROL Y EXCLUSIÓN"));
  assert.ok(quality.indexOf('id="checks-title"') < quality.indexOf('id="controls-title"'));
  for (const id of ["checks-title", "controls-title", "control-exclusion-editorial", "control-exclusion-commercial", "excluded-example"]) {
    assert.ok(quality.includes(`id="${id}"`), id);
  }
  for (const id of ["transformation-stage-title", "commercial-stage-title", "traceability-stage-title", "quality-matrix", "decisions-matrix", "traceability-providers", "traceability-artifacts"]) {
    assert.ok(!quality.includes(`id="${id}"`), id);
  }
  assert.ok(quality.includes('class="validation-diagram"'));
  assert.ok(quality.includes('class="control-groups"'));
  assert.ok(quality.includes('data-rule="exclusion"'));
  assert.ok(html.includes(`"packageDateUtc":"${snapshot.packageDateUtc}"`));
  assert.ok(html.includes(`"sha256":"${snapshot.commercialManifest.sha256}"`));
});

test("los títulos de las métricas son informativos y no abren diálogos de definición", async () => {
  const { html } = await readStaticPanel();
  assert.ok(html.includes('"kpi-metric-label"'));
  assert.ok(html.includes('cell.textContent = column.label'));
  assert.ok(html.includes('cell.scope = "col"'));
  for (const removed of ["definition-dialog", "definition-title", "definition-source", "metric-button", "metric-info",
    "close-definition", "dialog-files-toggle", "sourceArtifacts", "local-proof-link", "openDefinition",
    "Activar enlaces locales", "DEFINICIÓN Y PROCEDENCIA"]) assert.ok(!html.includes(removed), removed);
  assert.ok(html.includes('id="rule-dialog"'));
  assert.ok(html.includes('id="rule-dialog-code"'));
  for (const rule of ["source", "normalization", "exclusion"]) assert.ok(html.includes(`data-rule="${rule}"`));
  assert.ok(html.includes('data-rule="source"'));
});

test("las fuentes y métricas no se alteran al crear la vista", async () => {
  const { snapshot, dashboard, snapshotBeforeView } = await readStaticPanel();
  assert.equal(JSON.stringify(snapshot), snapshotBeforeView);
  assert.deepEqual(dashboard.snapshot.providers.map((provider) => provider.providerId),
    snapshot.providers.map((provider) => provider.providerId));
});


test("F1 deriva ocho ejemplos variados y todo el diccionario directamente de los contratos", async () => {
  const { dashboard: payload } = await readStaticPanel();
  assert.equal(payload.normalizationExamples.length, 8);
  assert.equal(new Set(payload.normalizationExamples.map((entry) => entry.ruleType)).size, 8);
  assert.equal(new Set(payload.normalizationExamples.map((entry) => entry.canonical)).size, 8);
  assert.equal(payload.normalizationDictionary.length, Object.keys(SPEC_KEY_NORMALIZATION).length);
  assert.deepEqual(new Set(payload.normalizationDictionary.map((entry) => entry.input)), new Set(Object.keys(SPEC_KEY_NORMALIZATION)));
  assert.deepEqual(payload.normalizationDictionary, [...payload.normalizationDictionary].sort((a, b) =>
    a.canonical.localeCompare(b.canonical, "es") || a.input.localeCompare(b.input, "es")));
  for (const entry of [...payload.normalizationExamples, ...payload.normalizationDictionary]) {
    assert.equal(entry.canonical, SPEC_KEY_NORMALIZATION[entry.input]);
    assert.equal(entry.ruleType, SPEC_RULES[entry.canonical] ?? null);
  }
  for (const entry of payload.normalizationExamples) {
    assert.ok(payload.normalizationDictionary.some((item) => item.input === entry.input && item.canonical === entry.canonical));
  }
});

test("F1 presenta una tabla compacta y un diccionario completo en el HTML autónomo", async () => {
  const { dashboard: payload, html } = await readStaticPanel();
  assert.ok(html.includes("Ocho correspondencias del diccionario vigente"));
  assert.ok(html.includes('<tbody id="normalization-examples"></tbody>'));
  assert.ok(html.includes('<details class="normalization-dictionary">'));
  assert.ok(html.includes('<tbody id="normalization-dictionary-rows"></tbody>'));
  assert.ok(html.includes('id="normalization-dictionary-count"'));
  assert.ok(html.includes('renderNormalizationRows("normalization-dictionary-rows", payload.normalizationDictionary)'));
  assert.ok(html.includes('renderNormalizationRows("normalization-examples", payload.normalizationExamples)'));
  assert.ok(html.includes(`"normalizationDictionary":${JSON.stringify(payload.normalizationDictionary)}`));
  assert.ok(!html.includes("Ver condiciones y límites del normalizador"));
  assert.ok(!html.includes('class="normalization-pair"'));
  assert.ok(html.includes("Comprobación del valor"));
  assert.ok(html.includes("Conflicto o valor inválido → no se inventa"));
  assert.ok(html.includes("no acreditan qué regla se aplicó a una ficha concreta"));
});

test("las demostraciones conservadas quedan en orden y Fichas reales al final", async () => {
  const { html } = await readStaticPanel();
  assert.equal((html.match(/<section class="page-view" data-view=/g) ?? []).length, 4);
  const labels = ["ETAPA 1 / MAPA DE PROCEDENCIA", "ETAPA 2 / NORMALIZACIÓN", "ETAPA 3 / CORROBORACIÓN DOCUMENTADA", "ETAPA 4 / CONTROL Y EXCLUSIÓN"];
  for (const step of labels) assert.equal(html.split(step).length - 1, 1, step);
  for (let i = 1; i < labels.length; i++) {
    assert.ok(html.indexOf(labels[i - 1]!) < html.indexOf(labels[i]!), labels[i]);
  }
  const views = ["resumen", "flujo", "calidad", "explorador"];
  for (let i = 1; i < views.length; i++) {
    assert.ok(html.indexOf(`data-nav="${views[i - 1]}"`) < html.indexOf(`data-nav="${views[i]}"`));
    assert.ok(html.indexOf(`data-view="${views[i - 1]}"`) < html.indexOf(`data-view="${views[i]}"`));
  }
  assert.ok(html.includes("03 / VALIDACIÓN Y CONTROL"));
  for (const id of ["source-map-title", "source-example", "checks-title"]) assert.ok(html.includes(`id="${id}"`));
  assert.ok(html.includes('id="source-example"'));
  assert.ok(html.includes('id="normalization-examples"'));
  assert.ok(html.includes('id="excluded-example"'));
  assert.ok(html.includes('id="control-exclusion-editorial"'));
  assert.ok(html.includes('id="control-exclusion-commercial"'));
  assert.ok(html.includes('<details class="audit-disclosure"><summary>Consultar matrices de recorrido y transformación (A y B)'));
  assert.ok(!html.includes('id="quality-cut-title"'));
  assert.ok(html.includes("EJEMPLOS DE REGLA VIGENTE"));
  assert.ok(html.includes("Cuatro comprobaciones para decidir"));
  assert.ok(!html.includes("Ver comprobaciones y código de referencia"));
  assert.ok(!html.includes('class="mechanism-detail"'));
  assert.ok(html.includes("No todo rechazo significa lo mismo"));
  assert.ok(html.includes("source-map-grid"));
  assert.ok(html.includes("CORROBORACIÓN DOCUMENTADA"));
  assert.ok(html.includes("panel:request-case"));
  assert.ok(html.includes('"normalizationExamples":['));
  assert.ok(!html.includes("regla aplicada históricamente a esta ficha"));
});


test("el diseño de exposición prioriza diagramas y conserva auditoría, bifurcaciones y límites", async () => {
  const { html } = await readStaticPanel();
  assert.ok(html.indexOf('id="normalization-title"') < html.indexOf('id="pipeline-matrix"'));
  assert.ok(html.indexOf('id="quality-title"') < html.indexOf('id="checks-title"'));
  assert.ok(html.indexOf('id="checks-title"') < html.indexOf('id="controls-title"'));
  assert.ok(html.indexOf('id="quality-title"') < html.indexOf('id="controls-title"'));
  assert.ok(html.indexOf('id="controls-title"') < html.indexOf('id="excluded-example"'));
  assert.ok(!html.includes('id="stage-strip"'));
  assert.ok(!html.includes('id="quality-highlights"'));
  assert.ok(html.includes('class="normalization-diagram"'));
  assert.ok(html.includes('class="validation-diagram"'));
  assert.ok(html.includes('class="check-result-pass"'));
  assert.ok(html.includes('class="check-result-stop"'));
  assert.ok(html.includes('class="control-group control-fields"'));
  assert.ok(html.includes('class="control-group control-records"'));
  assert.ok(html.includes('id="control-exclusion-editorial"'));
  assert.ok(html.includes('id="control-exclusion-commercial"'));
  assert.ok(html.includes("No se atribuye o incorpora por esa ruta"));
  assert.ok(html.includes("No entra en el paquete comercial"));
  assert.ok(html.includes("Comparar contenido de la ficha"));
  assert.ok(html.includes('id="normalization-example"'));
  assert.ok(html.includes('id="excluded-example"'));
  assert.ok(html.includes('class="audit-disclosure"'));
  assert.ok(!html.includes("presentacion-start"));
});

test("el modo portátil conserva enlaces seguros y casos reales sin navegación paralela", async () => {
  const { html } = await readStaticPanel();
  assert.ok(!html.includes('id="local-evidence-toggle"'));
  for (const marker of ["presentation-start", "presentation-prev", "presentation-next", "presentation-exit",
    "presentation-strip", "presentationSteps", "RECORRIDO GUIADO", "presentation-focus"]) {
    assert.ok(!html.includes(marker), marker);
  }
  for (const anchor of ["overview-kpis-title", "normalization-title", "controls-title", "explorer-detail"]) {
    assert.ok(html.includes(`id="${anchor}"`), anchor);
  }
  assert.equal((html.match(/data-nav="(?:resumen|flujo|explorador|calidad)"/g) ?? []).length, 4);
  assert.equal((html.match(/<svg class="nav-icon" aria-hidden="true"/g) ?? []).length, 4);
  assert.ok(!html.includes('<span class="nav-icon" aria-hidden="true">'));
  assert.ok(html.includes('class="nav-button active" type="button" data-nav="resumen" aria-current="page"'));
  assert.ok(html.includes("panel:request-case"));
  assert.ok(html.includes("panel:request-view"));
  assert.ok(html.includes("const chooseCase ="));
  assert.ok(!html.includes("renderCases()"));
  assert.ok(!html.includes('id="explorer-cases"'));
  assert.ok(html.includes("filters.render()"));
  assert.ok(html.includes("renderedId === key"));
  assert.ok(!html.includes("explorer-sort-current"));
  assert.ok(!html.includes('id="quality-cut-files-list"'));
  assert.ok(!html.includes('class="stage-strip"'));
  assert.ok(!html.includes('"stage-value"'));
  assert.ok(!html.includes('<script type="module" src='));
});

test("el Explorador concentra filtros, conserva su selección y deja el detalle técnico a demanda", async () => {
  const { html } = await readStaticPanel();
  assert.ok(html.includes('id="explorer-active-filters"'));
  assert.ok(html.includes('class="surface-card explorer-filter-dashboard"'));
  assert.ok(html.includes('id="explorer-category-picker"'));
  assert.ok(html.includes('id="explorer-stage-count-commercial-excluded"'));
  assert.ok(!html.includes('id="explorer-order-note"'));
  assert.ok(!html.includes("Tres etapas de la ficha"));
  assert.ok(html.includes('<option value="reference">Referencia · todas las fichas</option>'));
  assert.ok(html.includes("filters.resetForCase()"));
  assert.ok(html.includes('class="explorer-layout"'));
  assert.ok(!html.includes('id="explorer-cases"'));
  assert.ok(html.includes("const chooseCase ="));
  assert.ok(html.includes('compareSection("Título"'));
  assert.ok(!html.includes("Ver procedencia de los cambios"));
  assert.ok(!html.includes("Ver decisión acreditada y motivos"));
  assert.ok(html.includes("Comparar contenido de la ficha"));
});

test("F5 compacta el catálogo sin repetir métricas que pertenecen al detalle", async () => {
  const { html } = await readStaticPanel();
  assert.ok(html.includes('if (item.stage !== "commercial")'));
  assert.ok(!html.includes('class="product-impact'));
  assert.ok(html.includes('class="explorer-catalog-content"'));
  assert.ok(!html.includes('Specs ${formatNumber.format(metrics.originalSpecs)}'));
  assert.ok(html.includes('id="explorer-active-filters"'));
  assert.ok(html.includes('id="explorer-sort"'));
});

test("E2 presenta tres etapas compactas, con ampliación individual y sin duplicar las fichas en auditoría", async () => {
  const { html } = await readStaticPanel();
  assert.ok(html.includes("renderStageCards(item, normalizedFields)"));

  assert.ok(html.includes("renderTechnicalContribution(item)"));
  assert.ok(html.includes("explorer-contribution"));
  assert.ok(!html.includes("renderImpactComparison(item)"));
  assert.ok(html.includes("Comparar contenido de la ficha"));
  assert.ok(!html.includes("recordCard(\"01 / ORIGINAL\""));
  assert.ok(html.includes("data:text/javascript;base64,"));
  assert.ok(html.includes(".stage-record-grid {display:grid;grid-template-columns:repeat(3,minmax(0,1fr))"));
  const matches = [...html.matchAll(/data:text\/javascript;base64,([A-Za-z0-9+/=]+)/g)];
  assert.ok(matches.length > 0);
  const cards = await readFile(join(process.cwd(), "dist", "panel", "ui", "explorer-stage-cards.js"), "utf8");
  for (const key of ["original", "published", "commercial"]) assert.ok(cards.includes(key));
  assert.ok(cards.includes("dialog.showModal()"));
  assert.ok(cards.includes("stageSpecAddition(stage, key, value, item.specAdditions, normalizedFields)"));
  assert.ok(cards.includes("Añadida · "));
  for (const className of ["spec-kind-own", "spec-kind-reused", "spec-kind-pending"]) {
    assert.ok(html.includes(`.equipzilla-product-view .equipzilla-spec-item.${className}`));
  }
  assert.ok(cards.includes("dialog.remove()"));
  assert.ok(cards.includes("Etapa no disponible en este expediente"));
  assert.ok(cards.includes("Sin fotografía disponible"));
  assert.ok(cards.includes("Imagen externa no disponible"));
  assert.ok(!cards.includes("window.fetch("));
});

test("E3 replica la estética del frontend solo en la ampliación, con datos de etapa y galería accesible", async () => {
  const { html } = await readStaticPanel();
  const cards = await readFile(join(process.cwd(), "dist", "panel", "ui", "explorer-stage-cards.js"), "utf8");
  for (const label of ["01 · ORIGINAL", "02 · FINISH", "03 · COMERCIAL"]) assert.ok(cards.includes(label));
  assert.ok(cards.includes("item[stage]"));
  assert.ok(cards.includes("imageUrls(record)"));
  assert.ok(cards.includes("equipzilla-gallery-thumbnails"));
  assert.ok(cards.includes("Fotografía anterior"));
  assert.ok(cards.includes("Fotografía siguiente"));
  assert.ok(cards.includes("ArrowLeft"));
  assert.ok(cards.includes("ArrowRight"));
  assert.ok(cards.includes("aria-pressed"));
  assert.ok(cards.includes("stage-viewer-close"));
  assert.ok(cards.includes("trigger.focus({ preventScroll: true })"));
  assert.ok(cards.includes('stage === "commercial"'));
  assert.ok(cards.includes("item.commercial.attributes"));
  assert.ok(!cards.includes("window.fetch("));
  assert.ok(!cards.includes("innerHTML"));
  for (const rule of [
    ".stage-record-viewer.equipzilla-stage-dialog",
    ".equipzilla-product-view .equipzilla-product-top",
    ".equipzilla-product-view .equipzilla-gallery-frame",
    ".equipzilla-product-view .equipzilla-spec-grid",
    ".equipzilla-product-view .equipzilla-gallery-thumbnail"
  ]) assert.ok(html.includes(rule), rule);
  for (const color of ["#f3533d", "#387e7f", "#fff"]) assert.ok(html.toLowerCase().includes(color));
  assert.ok(!html.includes("https://fonts.googleapis.com"));
});

test("organización: cada matriz queda en su vista y no se repiten tarjetas de incidencias ni el circuito", async () => {
  const { html } = await readStaticPanel();
  const flow = html.split('data-view="flujo"')[1]?.split('data-view="calidad"')[0];
  const quality = html.split('data-view="calidad"')[1]?.split('data-view="explorador"')[0];
  assert.ok(flow);
  assert.ok(quality);
  for (const id of ["pipeline-matrix", "transform-matrix"]) assert.ok(flow.includes(`id="${id}"`));
  for (const id of ["controls-title", "control-exclusion-editorial", "control-exclusion-commercial"])
    assert.ok(quality.includes(`id="${id}"`));
  assert.ok(!quality.includes('id="quality-highlights"'));
  assert.ok(!html.includes('id="stage-strip"'));
  assert.ok(!html.includes('renderStages()'));
  assert.ok(!html.includes('renderQualityHighlights('));
  assert.ok(html.includes('renderSpecifications(item, additionKind)'));
  assert.ok(html.includes('renderDescriptions(item, "shortDescription")'));
  assert.ok(html.includes('renderDescriptions(item, "generalDescription")'));
  assert.ok(!html.includes('renderFieldStory(item)'));
  assert.ok(html.includes('renderTechnicalContribution(item)'));
  assert.ok(!html.includes('renderImpactComparison(item)'));
  assert.ok(!html.includes('const technicalKeys = new Set('));
  assert.ok(!html.includes('const editorialDifferences = item.changes.filter('));
});


test("F2 ordena los cinco apartados sin tablas de duplicados ni controles de E5", async () => {
  const { html } = await readStaticPanel();
  const sections = [
    'compareSection("Título"', 'compareSection("Descripción corta"',
    'compareSection("Especificaciones técnicas"', 'compareSection("Descripción general"',
    'compareSection("Categoría y datos comerciales"'
  ];
  for (const [position, section] of sections.entries()) {
    assert.ok(html.includes(section), section);
    if (position) assert.ok(html.indexOf(sections[position - 1] ?? "") < html.indexOf(section));
  }
  for (const removed of ["E5 / LA HISTORIA DEL DATO", "Ver procedencia de los cambios", "Diferencias en otros campos",
    "Ver decisión acreditada y motivos", "Ver artefactos íntegros y huellas SHA256", "RESOLUCIÓN Y AUDITORÍA",
    "renderFieldStory", "explorer-provenance-disclosure", "explorer-decision-detail", "audit-artifacts", "sourceLink("]) {
    assert.ok(!html.includes(removed), removed);
  }
  assert.ok(html.includes('item.decision.reason'));
  assert.ok(html.includes('item.decision.issues'));
  assert.ok(html.includes('item.decision.evidenceUrls'));
  assert.ok(html.includes('item.commercial.categorySellID'));
  assert.ok(html.includes('renderCommercialAttributes(item)'));
  assert.ok(html.includes('!item.original || !item.published'));
  assert.ok(html.includes('row.original === null && row.finish === null && row.commercial === null'));
  assert.ok(html.includes('String(item.commercial.categorySellID)'));
});

test("F2 abre los tres visores completos en lectura lineal sin contenido plegado", async () => {
  const { html } = await readStaticPanel();
  const cards = await readFile(join(process.cwd(), "dist", "panel", "ui", "explorer-stage-cards.js"), "utf8");
  assert.ok(cards.includes('element("h3", "", "Descripción corta")'));
  assert.ok(cards.includes('"equipzilla-general-description"'));
  assert.ok(cards.includes('"equipzilla-general-text"'));
  assert.ok(cards.includes('"equipzilla-commercial-attributes"'));
  assert.ok(cards.includes('"equipzilla-spec-grid equipzilla-attributes-grid"'));
  assert.match(cards, /if \(additional\)\s*content\.append\(additional\)/);
  assert.ok(cards.includes('dialog.showModal()'));
  assert.ok(cards.includes('dialog.scrollTop = 0'));
  assert.match(cards, /if \(trigger\.isConnected\)\s*trigger\.focus\(\{ preventScroll: true \}\)/);
  assert.ok(!cards.includes('element("details"'));
  assert.ok(!cards.includes('equipzilla-read-more'));
  assert.ok(!html.includes('equipzilla-disclosure'));
  assert.ok(html.includes('.equipzilla-product-view .equipzilla-general-text'));
  assert.ok(html.includes('.comparison-group-title'));
});

test("F5 integra listado, filtros y visor sin alterar el corte", async () => {
  const { snapshot, dashboard: payload, html } = await readStaticPanel();
  assert.ok(html.includes("Categorías disponibles"));
  assert.ok(html.includes("Catálogo"));
  assert.ok(html.includes("Descripciones cambiadas"));
  assert.ok(html.includes("Carencias del original"));
  assert.ok(html.includes("Cambios de FINISH"));
  assert.ok(html.includes('<select id="explorer-stage"'));
  assert.ok(html.includes('id="provider-filter"'));
  assert.ok(!html.includes('id="explorer-category"'));
  assert.ok(!html.includes('name="explorer-stage" type="radio"'));
  assert.ok(!html.includes("Otros cambios observables"));
  assert.ok(!html.includes('class="explorer-filter-index"'));
  assert.ok(!html.includes("03 / FICHAS REALES"));
  assert.ok(!html.includes('class="explorer-results-toolbar"'));
  assert.ok(html.indexOf('id="explorer-sort"') > html.indexOf('id="explorer-catalog"'));
  assert.ok(html.indexOf('id="explorer-sort"') < html.indexOf('id="explorer-list"'));
  assert.ok(html.indexOf('id="explorer-active-filters"') < html.indexOf('id="explorer-detail"'));
  assert.ok(html.includes('aria-expanded="false" aria-controls="explorer-catalog-content"'));
  assert.ok(html.includes('catalog.classList.toggle("is-open")'));
  assert.ok(html.includes('catalogToggle.setAttribute("aria-expanded", String(opened))'));
  assert.ok(html.includes('catalogToggle.focus()'));
  assert.ok(!html.includes('id="explorer-extra-count"'));
  assert.ok(html.includes("renderedId === key"));
  assert.ok(html.includes(`"sha256":"${snapshot.commercialManifest.sha256}"`));
  assert.equal(payload.explorer.products.length, snapshot.totals.originals);
});


test("F6 amplía las vistas y pagina el catálogo lateral de 30 en 30 sin modificar el visor", async () => {
  const { html } = await readStaticPanel();
  assert.ok(html.includes("max-width:1900px"));
  assert.ok(html.includes("grid-template-columns:minmax(350px,380px) minmax(0,1fr)"));
  assert.ok(html.includes(".explorer-list {max-height:none;overflow:visible}"));
  assert.ok(html.includes("const pageSize = 30"));
  assert.ok(html.includes("Math.ceil(filtered.length / pageSize) - 1"));
  assert.ok(html.includes("filtered.slice(page * pageSize, (page + 1) * pageSize)"));
  assert.ok(html.includes("Math.floor(visible.findIndex((item) => item.identity === selectedId) / pageSize)"));
  assert.ok(html.includes('catalog.scrollIntoView({ block: "start", behavior: "instant" })'));
  assert.ok(html.includes('id="explorer-page-prev"'));
  assert.ok(html.includes('id="explorer-page-next"'));
});


test("F7 despliega hasta 30 filas sin scroll interno y muestra proveedor, referencia y título", async () => {
  const { html } = await readStaticPanel();
  assert.ok(html.includes('create("span", "product-row-provider", names[item.providerId])'));
  assert.ok(html.includes('create("strong", "product-row-reference", item.reference ?? "Sin referencia")'));
  assert.ok(html.includes('create("span", "product-title", item.published?.title ?? item.original?.title ?? "Sin título")'));
  assert.ok(!html.includes('create("small", "product-context"'));
  assert.ok(html.includes('create("div", "detail-metadata")'));
  assert.ok(html.includes('`Categoría: ${item.category ?? "No consta"}`'));
  assert.ok(html.includes('grid-template-columns:minmax(350px,380px) minmax(0,1fr);grid-template-rows:max-content minmax(0,1fr)'));
  assert.ok(html.includes('.explorer-list {display:grid;gap:5px;max-height:none;overflow:visible;padding-right:0}'));
  assert.ok(html.includes('.explorer-list {max-height:none;overflow:visible}'));
  assert.ok(html.includes('const pageSize = 30'));
  assert.ok(html.includes('catalog.scrollIntoView({ block: "start", behavior: "instant" })'));
  assert.ok(html.includes('showSelectionForDesktop()'));
  assert.ok(html.includes('detail.scrollIntoView({ block: "start", behavior: "instant" })'));
  assert.ok(html.includes('(max-width: 1250px)'));
});


test("muestra reglas vigentes extraídas del código, separadas de los ejemplos observables", async () => {
  const root = process.cwd();
  const examples = await readPanelRuleExamples(root);
  for (const example of Object.values(examples)) {
    const lines = (await readFile(join(root, example.path), "utf8")).split(/\r?\n/u);
    for (const line of example.code.split("\n")) {
      assert.ok(lines.some((source) => source.trim() === line.trim()), `${example.path}: ${line}`);
    }
    assert.ok(example.code.length > 60);
  }
  assert.deepEqual(Object.keys(examples).sort(), ["exclusion", "normalization", "source"]);
  assert.ok(examples.source.code.includes('unit.fingerprint'));
  assert.ok(examples.normalization.code.includes('number >= 0'));
  assert.ok(examples.exclusion.code.includes('decision.requiredIssues.every'));
  const { html } = await readStaticPanel();
  for (const id of ["source", "normalization", "exclusion"]) {
    assert.ok(html.includes(`data-rule="${id}"`));
    assert.ok(html.includes(`"${id}":{`));
  }
  assert.ok(html.includes('id="panel-rule-examples"'));
  assert.ok(html.includes('id="rule-dialog"'));
  assert.ok(html.includes('id="rule-dialog-code"'));
  assert.ok(html.includes('Fragmento de implementación, no prueba de que esta regla causase'));
  assert.ok(!html.includes('Ver comprobaciones y código de referencia'));
  assert.ok(html.indexOf('data-nav="calidad"') < html.indexOf('data-nav="explorador"'));
});


test("la retirada documental no deja controles ocultos en los módulos autónomos", async () => {
  const { html } = await readStaticPanel();
  const pending = [html];
  const scripts: string[] = [];
  const processed = new Set<string>();
  while (pending.length) {
    const source = pending.pop();
    if (!source) continue;
    for (const match of source.matchAll(/data:text\/javascript;base64,([A-Za-z0-9+/=]+)/g)) {
      const encoded = match[1];
      if (!encoded || processed.has(encoded)) continue;
      processed.add(encoded);
      const decoded = Buffer.from(encoded, "base64").toString("utf8");
      scripts.push(decoded);
      pending.push(decoded);
    }
  }
  assert.ok(scripts.length > 0);
  const all = `${html}\n${scripts.join("\n")}`;
  for (const forbidden of ["Ver trazabilidad", "spec-provenance-details", "spec-provenance-artifact",
    "spec-provenance-caution", "renderAdditionProvenance"]) {
    assert.ok(!all.includes(forbidden), forbidden);
  }
  for (const preserved of ['id="explorer-spec-kind"', 'value="own"', 'value="reused"',
    "spec-kind-own", "spec-kind-reused", "renderStageCards(item, normalizedFields)",
    "stageSpecAddition(stage, key, value, item.specAdditions, normalizedFields)",
    '"source":{', '"normalization":{', '"exclusion":{']) {
    assert.ok(all.includes(preserved), preserved);
  }
});

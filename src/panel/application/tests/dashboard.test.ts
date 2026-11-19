import assert from "node:assert/strict";
import { test } from "node:test";
import { SPEC_KEY_NORMALIZATION, SPEC_RULES } from "../../../catalog/normalization/spec-rules.js";
import { createDashboardPayload } from "../dashboard-data.js";
import { renderPanelHtml } from "../panel-html.js";
import { readPanelSnapshot } from "../../evidence/read-panel-snapshot.js";
import { readPanelExplorer } from "../../explorer/read-panel-explorer.js";
import { createPanelEvidenceWorkspaceFixture } from "../../../testing/builders/panel-evidence-workspace-fixture.js";

const fixture = createPanelEvidenceWorkspaceFixture();

test("el panel deriva todos los indicadores del corte y conserva las poblaciones por etapa", async () => {
  const snapshot = await readPanelSnapshot(await fixture.root());
  const dashboard = createDashboardPayload(snapshot, await readPanelExplorer(await fixture.root(), snapshot));
  assert.equal(dashboard.snapshot, snapshot);
  assert.equal(dashboard.definitions.length, 19);
  assert.equal(dashboard.decisions.length, 4);
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
  const snapshot = await readPanelSnapshot(await fixture.root());
  const html = await renderPanelHtml(process.cwd(), createDashboardPayload(snapshot, await readPanelExplorer(await fixture.root(), snapshot)));
  assert.match(html, /<html lang="es">/);
  assert.match(html, /data-view="resumen"/);
  assert.match(html, /data-view="flujo"/);
  assert.match(html, /data-view="calidad"/);
  assert.match(html, /data-view="explorador"/);
  assert.ok(html.includes("explorer-search"));
  for (const id of ["explorer-sort", "explorer-missing-description", "explorer-without-specs",
    "explorer-with-additions", "explorer-editorial-changes", "explorer-order-note", "explorer-active-filters",
    "explorer-extra-count"]) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.ok(html.includes("Más especificaciones incorporadas"));
  assert.ok(html.includes("Menos especificaciones de origen"));
  assert.ok(html.includes("selectExplorerProducts(products, selection)"));
  assert.ok(html.includes("data:text/javascript;base64,"));
  assert.ok(!html.includes('from "../explorer/explorer-selection.js"'));
  assert.ok(html.includes("Antes y después"));
  assert.ok(html.includes('<details class="explorer-advanced">'));
  assert.ok(html.includes("Filtros activos"));
  assert.ok(html.includes("Limpiar"));
  assert.ok(!html.includes('id="explorer-cases"'));
  assert.ok(!html.includes("renderCommercialSummary(item)"));
  assert.ok(!html.includes("renderChangeSummary(item)"));
  assert.ok(!html.includes("presentation-start"));
  assert.ok(!html.includes("presentation-strip"));
  assert.ok(!html.includes("presentationSteps"));
  assert.ok(html.includes('id="cut-status-title"'));
  assert.ok(html.includes("Técnico y comercial coherentes al generar"));
  assert.ok(html.includes("abrirla o recargarla no comprueba las selecciones actuales"));
  assert.ok(html.includes('id="cut-package-sha"'));
  assert.ok(html.includes("CORTE VERIFICADO AL GENERAR"));
  assert.ok(html.includes("Publicación individual del corte"));
  assert.ok(!html.includes("Publicación individual vigente"));
  assert.ok(html.includes("Descripciones, sin recortes"));
  assert.ok(html.includes("Especificaciones alineadas por campo"));
  assert.ok(html.includes("RESULTADO Y TOMA DE DECISIÓN"));
  assert.ok(html.includes("Comparación de máquina"));
  assert.match(html, /<script type="module">/);
  assert.ok(!html.includes("backendIntegration"));
  assert.ok(html.includes(`"packageDateUtc":"${snapshot.packageDateUtc}"`));
  assert.ok(html.includes(`"sha256":"${snapshot.commercialManifest.sha256}"`));
  assert.ok(html.includes(`"originals":${snapshot.totals.originals}`));
  assert.ok(html.includes(`"pendingCategory":${snapshot.totals.pendingCategory}`));
  assert.ok(html.includes("Lógica y decisiones documentadas"));
  assert.ok(!html.includes('title: "BACKEND"'));
  assert.ok(!html.includes('Integración en BD no verificada'));
  assert.ok(!html.includes('overview-insights'));
  assert.ok(!html.includes('volume-flow'));
  assert.ok(!html.includes('BD NO VERIFICADA'));
  assert.ok(!html.includes('MATRIZ E / COBERTURA POR FAMILIA'));
  assert.ok(html.includes('Información del corte y acceso a evidencias'));
  assert.ok(html.includes("Matriz"));
  assert.ok(!html.includes("https://fonts.googleapis.com"));
  assert.ok(!html.includes("<script type=\"module\" src="));
  assert.ok(html.includes("const metricsFor = (scope) =>"));
  assert.ok(html.includes("const visibleProducts = () =>"));
});

test("el HTML neutraliza etiquetas incrustadas en datos de procedencia", async () => {
  const snapshot = await readPanelSnapshot(await fixture.root());
  const base = createDashboardPayload(snapshot, await readPanelExplorer(await fixture.root(), snapshot));
  const poisoned = {
    ...base,
    names: { ...base.names, gam: "</script><script>alert(1)</script>" }
  };
  const html = await renderPanelHtml(process.cwd(), poisoned);
  assert.ok(html.includes("\\u003c/script\\u003e"));
  assert.ok(!html.includes("</script><script>alert(1)</script>"));
});

test("las fuentes y métricas no se alteran al crear la vista", async () => {
  const snapshot = await readPanelSnapshot(await fixture.root());
  const before = JSON.stringify(snapshot);
  const dashboard = createDashboardPayload(snapshot, await readPanelExplorer(await fixture.root(), snapshot));
  await renderPanelHtml(process.cwd(), dashboard);
  assert.equal(JSON.stringify(snapshot), before);
  assert.deepEqual(dashboard.snapshot.providers.map((provider) => provider.providerId), ["gam", "gomariz", "mercaeleva"]);
});


test("los ejemplos de normalización proceden del diccionario y conservan tipo esperado", async () => {
  const snapshot = await readPanelSnapshot(await fixture.root());
  const payload = createDashboardPayload(snapshot, await readPanelExplorer(await fixture.root(), snapshot));
  assert.equal(payload.normalizationExamples.length, 3);
  for (const entry of payload.normalizationExamples) {
    assert.equal(entry.canonical, SPEC_KEY_NORMALIZATION[entry.input]);
    assert.equal(entry.ruleType, SPEC_RULES[entry.canonical]);
  }
});

test("E1–E5 se integran en cuatro vistas y la auditoría queda plegada, sin confundir mecanismos y resultados", async () => {
  const snapshot = await readPanelSnapshot(await fixture.root());
  const html = await renderPanelHtml(process.cwd(), createDashboardPayload(snapshot, await readPanelExplorer(await fixture.root(), snapshot)));
  assert.equal((html.match(/<section class="page-view" data-view=/g) ?? []).length, 4);
  for (const step of ["E1 / MAPA DE PROCEDENCIA", "E2 / NORMALIZACIÓN", "E3 / CORROBORACIÓN DOCUMENTADA",
    "E4 / CONTROL Y EXCLUSIÓN", "E5 / LA HISTORIA DEL DATO"]) assert.ok(html.includes(step), step);
  assert.ok(html.includes('id="source-example"'));
  assert.ok(html.includes('id="normalization-examples"'));
  assert.ok(html.includes('id="excluded-example"'));
  assert.ok(html.includes('id="control-exclusion-editorial"'));
  assert.ok(html.includes('id="control-exclusion-commercial"'));
  assert.ok(html.includes('<details class="audit-disclosure"><summary>Consultar matrices técnicas A–D'));
  assert.ok(html.includes('<details class="audit-disclosure"><summary>Consultar evidencias'));
  assert.ok(html.includes("EJEMPLOS DE REGLA VIGENTE"));
  assert.ok(html.includes("Cuatro comprobaciones para decidir"));
  assert.ok(html.includes("No todo rechazo significa lo mismo"));
  assert.ok(html.includes("panel:request-case"));
  assert.ok(html.includes('"normalizationExamples":['));
  assert.ok(!html.includes("regla aplicada históricamente a esta ficha"));
});


test("el diseño de exposición prioriza diagramas y conserva auditoría, bifurcaciones y límites", async () => {
  const workspace = await fixture.root();
  const snapshot = await readPanelSnapshot(workspace);
  const html = await renderPanelHtml(process.cwd(), createDashboardPayload(snapshot, await readPanelExplorer(workspace, snapshot)));
  assert.ok(html.indexOf('id="normalization-title"') < html.indexOf('id="stage-strip"'));
  assert.ok(html.indexOf('id="checks-title"') < html.indexOf('id="quality-highlights"'));
  assert.ok(html.indexOf('id="controls-title"') < html.indexOf('id="quality-highlights"'));
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
  assert.ok(html.includes("Abrir ficha completa · textos, especificaciones y diferencias"));
  assert.ok(html.includes('id="normalization-example"'));
  assert.ok(html.includes('id="excluded-example"'));
  assert.ok(html.includes('id="local-evidence-toggle"'));
  assert.ok(html.includes('class="audit-disclosure"'));
  assert.ok(!html.includes("presentacion-start"));
});

test("el modo portátil conserva enlaces seguros y casos reales sin navegación paralela", async () => {
  const workspace = await fixture.root();
  const snapshot = await readPanelSnapshot(workspace);
  const html = await renderPanelHtml(process.cwd(), createDashboardPayload(snapshot, await readPanelExplorer(workspace, snapshot)));
  assert.ok(html.includes('id="local-evidence-toggle" aria-pressed="false"'));
  assert.ok(html.includes("Los JSON, informes y registros originales no se incluyen"));
  assert.ok(html.includes("Enlaces locales desactivados para evitar rutas rotas"));
  assert.ok(html.includes("data.localEvidence") || html.includes("dataset.localEvidence"));
  assert.ok(html.includes("local-proof-link"));
  for (const marker of ["presentation-start", "presentation-prev", "presentation-next", "presentation-exit",
    "presentation-strip", "presentationSteps", "RECORRIDO GUIADO", "presentation-focus"]) {
    assert.ok(!html.includes(marker), marker);
  }
  for (const anchor of ["source-map-title", "overview-kpis-title", "normalization-title", "checks-title", "controls-title", "explorer-detail"]) {
    assert.ok(html.includes(`id="${anchor}"`), anchor);
  }
  assert.equal((html.match(/data-nav="(?:resumen|flujo|explorador|calidad)"/g) ?? []).length, 4);
  assert.ok(html.includes("panel:request-case"));
  assert.ok(html.includes("panel:request-view"));
  assert.ok(html.includes("const chooseCase ="));
  assert.ok(!html.includes("renderCases()"));
  assert.ok(!html.includes('id="explorer-cases"'));
  assert.ok(html.includes("renderActiveFilters()"));
  assert.ok(html.includes('id="evidence-list"'));
  assert.ok(html.includes('id="cut-package-sha"'));
  assert.ok(html.includes('class="stage-strip"'));
  assert.ok(!html.includes('"stage-value"'));
  assert.ok(!html.includes('<script type="module" src='));
});

test("el Explorador concentra filtros, conserva su selección y deja el detalle técnico a demanda", async () => {
  const workspace = await fixture.root();
  const snapshot = await readPanelSnapshot(workspace);
  const html = await renderPanelHtml(process.cwd(), createDashboardPayload(snapshot, await readPanelExplorer(workspace, snapshot)));
  assert.ok(html.includes('id="explorer-active-filters"'));
  assert.ok(html.includes('class="explorer-advanced"'));
  assert.ok(html.includes('id="explorer-extra-count"'));
  assert.ok(html.includes("Quitar filtro"));
  assert.ok(html.includes("Limpiar"));
  assert.ok(html.includes("Orden: "));
  assert.ok(html.includes('sort = "reference"'));
  assert.ok(html.includes("option.disabled ="));
  assert.ok(html.includes('class="explorer-layout"'));
  assert.ok(!html.includes('id="explorer-cases"'));
  assert.ok(html.includes("const chooseCase ="));
  assert.ok(html.includes("renderFieldStory(item)"));
  assert.ok(html.includes("Ver decisión acreditada y motivos"));
  assert.ok(html.includes("Abrir ficha completa · textos, especificaciones y diferencias"));
});

test("E2 presenta tres etapas compactas, con ampliación individual y sin duplicar las fichas en auditoría", async () => {
  const workspace = await fixture.root();
  const snapshot = await readPanelSnapshot(workspace);
  const html = await renderPanelHtml(process.cwd(), createDashboardPayload(snapshot, await readPanelExplorer(workspace, snapshot)));
  assert.ok(html.includes("renderStageCards(item)"));
  assert.ok(html.includes("const story = create(\"details\", \"explorer-provenance-disclosure\")"));
  assert.ok(html.includes("Antes y después · datos observados"));
  assert.ok(html.includes("Abrir ficha completa · textos, especificaciones y diferencias"));
  assert.ok(!html.includes("recordCard(\"01 / ORIGINAL\""));
  assert.ok(!html.includes('from "./explorer-stage-cards.js"'));
  assert.ok(html.includes(".stage-record-grid {display:grid;grid-template-columns:repeat(3,minmax(0,1fr))"));
  const matches = [...html.matchAll(/data:text\/javascript;base64,([A-Za-z0-9+/=]+)/g)];
  assert.equal(matches.length, 2);
  const components = matches.map((match) => Buffer.from(match[1] ?? "", "base64").toString("utf8"));
  const cards = components.find((value) => value.includes("renderStageCards"));
  assert.ok(cards);
  for (const key of ["original", "published", "commercial"]) assert.ok(cards.includes(key));
  assert.ok(cards.includes("dialog.showModal()"));
  assert.ok(cards.includes("dialog.remove()"));
  assert.ok(cards.includes("Etapa no disponible en este expediente"));
  assert.ok(cards.includes("Sin fotografía disponible"));
  assert.ok(cards.includes("Imagen externa no disponible"));
  assert.ok(!cards.includes("window.fetch("));
});

test("E3 replica la estética del frontend solo en la ampliación, con datos de etapa y galería accesible", async () => {
  const workspace = await fixture.root();
  const snapshot = await readPanelSnapshot(workspace);
  const html = await renderPanelHtml(process.cwd(), createDashboardPayload(snapshot, await readPanelExplorer(workspace, snapshot)));
  const modules = [...html.matchAll(/data:text\/javascript;base64,([A-Za-z0-9+/=]+)/g)]
    .map((match) => Buffer.from(match[1] ?? "", "base64").toString("utf8"));
  const cards = modules.find((value) => value.includes("renderStageCards"));
  assert.ok(cards);
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

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
  assert.equal(dashboard.snapshot.backendIntegration, "not-verified");
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
  assert.ok(html.includes("presentation-start"));
  assert.ok(html.includes('id="cut-status-title"'));
  assert.ok(html.includes("Técnico y comercial coherentes al generar"));
  assert.ok(html.includes("abrirla o recargarla no comprueba las selecciones actuales"));
  assert.ok(html.includes('id="cut-package-sha"'));
  assert.ok(html.includes("CORTE FIJO · VERIFICADO AL GENERAR"));
  assert.ok(html.includes("Publicación individual del corte"));
  assert.ok(!html.includes("Publicación individual vigente"));
  assert.ok(html.includes("Descripciones, sin recortes"));
  assert.ok(html.includes("Especificaciones alineadas por campo"));
  assert.ok(html.includes("RESULTADO Y TOMA DE DECISIÓN"));
  assert.ok(html.includes("Comparación de máquina"));
  assert.match(html, /<script type="module">/);
  assert.match(html, /"backendIntegration":"not-verified"/);
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
  assert.ok(html.includes('Corte coherente al generar · Evidencias y uso offline'));
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
  assert.ok(html.includes('<details class="audit-disclosure"><summary>Consultar matrices A–D'));
  assert.ok(html.includes('<details class="audit-disclosure"><summary>Inspeccionar evidencias'));
  assert.ok(html.includes("EJEMPLOS DE REGLA VIGENTE"));
  assert.ok(html.includes("Una incorporación documental solo se admite"));
  assert.ok(html.includes("No todo rechazo significa lo mismo"));
  assert.ok(html.includes("panel:request-case"));
  assert.ok(html.includes('"normalizationExamples":['));
  assert.ok(!html.includes("regla aplicada históricamente a esta ficha"));
});


test("el modo portátil evita enlaces locales rotos y el recorrido guiado conserva fuentes y controles", async () => {
  const workspace = await fixture.root();
  const snapshot = await readPanelSnapshot(workspace);
  const html = await renderPanelHtml(process.cwd(), createDashboardPayload(snapshot, await readPanelExplorer(workspace, snapshot)));
  assert.ok(html.includes('id="local-evidence-toggle" aria-pressed="false"'));
  assert.ok(html.includes("Los JSON, informes y registros originales no se incluyen"));
  assert.ok(html.includes("Enlaces locales desactivados para evitar rutas rotas"));
  assert.ok(html.includes("data.localEvidence") || html.includes("dataset.localEvidence"));
  assert.ok(html.includes("local-proof-link"));
  assert.ok(html.includes("RECORRIDO GUIADO"));
  for (const anchor of ["source-map-title", "overview-kpis-title", "normalization-title", "checks-title", "controls-title", "explorer-detail"]) {
    assert.ok(html.includes(`id="${anchor}"`), anchor);
    assert.ok(html.includes(`focusId: "${anchor}"`), anchor);
  }
  assert.ok(html.includes("presentationCases = data.explorer.cases.filter"));
  assert.ok(html.includes("exclusionCase = data.explorer.cases.find"));
  assert.ok(html.includes("La causa histórica individual" ) || html.includes("no presupone una ejecución histórica demostrada"));
  assert.ok(!html.includes('<script type="module" src='));
});

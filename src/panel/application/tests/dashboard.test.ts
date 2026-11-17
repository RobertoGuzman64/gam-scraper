import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import { createDashboardPayload } from "../dashboard-data.js";
import { renderPanelHtml } from "../panel-html.js";
import { readPanelSnapshot } from "../../evidence/read-panel-snapshot.js";
import { readPanelExplorer } from "../../explorer/read-panel-explorer.js";

const root = resolve(process.cwd());

test("el panel deriva todos los indicadores del corte y conserva las poblaciones por etapa", async () => {
  const snapshot = await readPanelSnapshot(root);
  const dashboard = createDashboardPayload(snapshot, await readPanelExplorer(root, snapshot));
  assert.equal(dashboard.snapshot, snapshot);
  assert.equal(dashboard.definitions.length, 19);
  assert.equal(dashboard.decisions.length, 5);
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
  const snapshot = await readPanelSnapshot(root);
  const html = await renderPanelHtml(root, createDashboardPayload(snapshot, await readPanelExplorer(root, snapshot)));
  assert.match(html, /<html lang="es">/);
  assert.match(html, /data-view="resumen"/);
  assert.match(html, /data-view="flujo"/);
  assert.match(html, /data-view="calidad"/);
  assert.match(html, /data-view="explorador"/);
  assert.ok(html.includes("explorer-search"));
  assert.ok(html.includes("presentation-start"));
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
  assert.ok(html.includes("Matriz"));
  assert.ok(!html.includes("https://fonts.googleapis.com"));
  assert.ok(!html.includes("<script type=\"module\" src="));
  assert.ok(html.includes("const metricsFor = (scope) =>"));
  assert.ok(html.includes("const visibleProducts = () =>"));
});

test("el HTML neutraliza etiquetas incrustadas en datos de procedencia", async () => {
  const snapshot = await readPanelSnapshot(root);
  const base = createDashboardPayload(snapshot, await readPanelExplorer(root, snapshot));
  const poisoned = {
    ...base,
    names: { ...base.names, gam: "</script><script>alert(1)</script>" }
  };
  const html = await renderPanelHtml(root, poisoned);
  assert.ok(html.includes("\\u003c/script\\u003e"));
  assert.ok(!html.includes("</script><script>alert(1)</script>"));
});

test("las fuentes y métricas no se alteran al crear la vista", async () => {
  const snapshot = await readPanelSnapshot(root);
  const before = JSON.stringify(snapshot);
  const dashboard = createDashboardPayload(snapshot, await readPanelExplorer(root, snapshot));
  await renderPanelHtml(root, dashboard);
  assert.equal(JSON.stringify(snapshot), before);
  assert.deepEqual(dashboard.snapshot.providers.map((provider) => provider.providerId), ["gam", "gomariz", "mercaeleva"]);
});

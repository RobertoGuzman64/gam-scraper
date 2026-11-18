import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parseTechnicalReport } from "../report-metrics.js";
import { PANEL_METRIC_DEFINITIONS } from "../metric-definitions.js";
import { assertCommercialLineage, readPanelOriginalEvidence, readPanelSnapshot } from "../read-panel-snapshot.js";
import { LEGACY_CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";
import { createPanelEvidenceWorkspaceFixture } from "../../../testing/builders/panel-evidence-workspace-fixture.js";

const workspace = async (task: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "eqz-panel-"));
  try { await task(root); }
  finally { await rm(root, { recursive: true, force: true }); }
};

const fixture = createPanelEvidenceWorkspaceFixture();

const source = { identity: "gam:ref:123", reference: "123", sourceUrl: "https://example.com/123" };
const published = [{ reference: "123", sourceUrl: "https://example.com/123" }];

test("rechaza fuentes comerciales desalineadas y duplicadas", () => {
  assert.doesNotThrow(() => assertCommercialLineage("gam", published, [{ reference: "123" }], [source], []));
  assert.throws(() => assertCommercialLineage("gam", published, [{ reference: "OTRO" }], [source], []), /desalineados/);
  assert.throws(() => assertCommercialLineage("gam", published, [{ reference: "123" }],
    [{ ...source, sourceUrl: "https://example.com/otro" }], []), /no vinculada/);
  assert.throws(() => assertCommercialLineage("gam", published, [{ reference: "123" }], [source], [source]), /no vinculada/);
  assert.throws(() => assertCommercialLineage("gam", published, [], [], []), /sin trazabilidad/);
  assert.throws(() => assertCommercialLineage("gam", published, [{ reference: "123" }], [], []), /desalineadas/);
});

test("original no conservado se declara indisponible, sin inventar comparación", async () => {
  await workspace(async (root) => {
    await mkdir(join(root, "catalogs", "providers", "gam"), { recursive: true });
    const evidence = await readPanelOriginalEvidence(root, "gam", {
      sha256: "a".repeat(64), productCount: 1, prefix: "scrape-gam", scope: null
    });
    assert.deepEqual(evidence, {
      status: "unavailable", expectedSha256: "a".repeat(64),
      reason: "Original acreditado no conservado"
    });
  });
});

test("rechaza informe técnico sin totales coherentes o trazabilidad completa", async () => {
  const root = await fixture.root();
  const current = JSON.parse(await readFile(join(root, "catalogs", "reports", "individual-finish", "active.json"), "utf8"));
  assert.ok(current !== null && typeof current === "object" && "sha256" in current && typeof current.sha256 === "string");
  const report = await readFile(join(root, "catalogs", "reports", "individual-finish", "versions", current.sha256, "INFORME.txt"), "utf8");
  assert.equal(parseTechnicalReport(report).length, LEGACY_CAMPAIGN_PROVIDERS.length);
  assert.throws(() => parseTechnicalReport(report.replace(/(\| TOTAL \| )\d+( \|)/, (_matched, before: string, after: string) => `${before}9999${after}`)), /Total discordante/);
  assert.throws(() => parseTechnicalReport(report.replace(/\| `[a-f0-9]{12}` \|/, "| `desconocido` |")), /Huellas técnicas inválidas/);
});

test("corte vigente enlaza publicaciones, informes y paquete comercial sin escrituras", async () => {
  const snapshot = await readPanelSnapshot(await fixture.root());
  assert.deepEqual(snapshot.providers.map((item) => item.providerId), [...LEGACY_CAMPAIGN_PROVIDERS]);
  assert.equal(snapshot.backendIntegration, "not-verified");
  assert.equal(snapshot.environment, "develop");
  assert.match(snapshot.packageDateUtc, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(snapshot.providers.reduce((sum, item) => sum + item.metrics.originals, 0), snapshot.totals.originals);
  for (const item of snapshot.providers) {
    assert.equal(item.metrics.originals, item.metrics.published + item.metrics.excludedEditorial);
    assert.equal(item.metrics.published, item.metrics.exported + item.metrics.excludedCommercial);
    assert.equal(item.metrics.exported, item.metrics.categorized + item.metrics.pendingCategory);
    if (item.original.status === "verified") {
      assert.equal(item.original.products, item.metrics.originals);
    } else {
      assert.match(item.original.expectedSha256, /^[a-f0-9]{64}$/);
    }
    assert.match(item.publication.sha256, /^[a-f0-9]{64}$/);
    assert.match(item.commercial.sha256, /^[a-f0-9]{64}$/);
    if (item.previousApprovalSha256 !== null) {
      assert.match(item.previousApprovalSha256, /^[a-f0-9]{64}$/);
    }
  }
});

test("versión incompleta, selección inexistente y huella alterada bloquean la consulta", async () => {
  await workspace(async (root) => {
    const reports = join(root, "catalogs", "reports");
    await mkdir(reports, { recursive: true });
    await cp(join(await fixture.root(), "catalogs", "reports", "individual-finish"), join(reports, "individual-finish"), { recursive: true });
    await cp(join(await fixture.root(), "catalogs", "reports", "commercial"), join(reports, "commercial"), { recursive: true });
    await mkdir(join(root, "catalogs", "commercial", "develop", "versions"), { recursive: true });
    await assert.rejects(readPanelSnapshot(root), /entradas no reconocidas/);
    const selected = "b".repeat(64);
    await writeFile(join(root, "catalogs", "commercial", "develop", "active.json"), JSON.stringify({
      version: 1, sha256: selected, previousSha256: null
    }));
    await assert.rejects(readPanelSnapshot(root), /Retención de artefactos incoherente/);
    await mkdir(join(root, "catalogs", "commercial", "develop", "versions", selected));
    await assert.rejects(readPanelSnapshot(root), /Archivos de artefacto incompletos/);
  });
});


test("el glosario cubre cada métrica del snapshot sin duplicados", async () => {
  const snapshot = await readPanelSnapshot(await fixture.root());
  const keys = [...Object.keys(snapshot.totals).filter((key) => key !== "transformations"),
    ...Object.keys(snapshot.totals.transformations)];
  assert.equal(new Set(PANEL_METRIC_DEFINITIONS.map((item) => item.key)).size, keys.length);
  assert.deepEqual(PANEL_METRIC_DEFINITIONS.map((item) => item.key).sort(), keys.sort());
});

test("rechaza un corte técnico distinto del paquete comercial retenido", async () => {
  await fixture.withCopy(async (root) => {
    const provider = join(root, "catalogs", "providers", "gam");
    const retained: unknown = JSON.parse(await readFile(join(provider, "publication-retention.json"), "utf8"));
    assert.ok(retained !== null && typeof retained === "object" && "previousSha256" in retained &&
      typeof retained.previousSha256 === "string");
    await writeFile(join(provider, "publications", "active.json"), JSON.stringify({
      version: 1, providerId: "gam", approvalSha256: retained.previousSha256
    }));
    await writeFile(join(provider, "publication-retention.json"), JSON.stringify({
      version: 1, providerId: "gam", approvalSha256: retained.previousSha256, previousSha256: null
    }));
    await assert.rejects(readPanelSnapshot(root), /Cortes técnico y comercial no coincidentes: gam/);
  });
});

test("si desaparece el original, el corte sigue disponible pero no permite acreditarlo", async () => {
  await fixture.withCopy(async (root) => {
    await rm(join(root, "catalogs", "providers", "gam", "original"), { recursive: true });
    const snapshot = await readPanelSnapshot(root);
    assert.equal(snapshot.providers.find((item) => item.providerId === "gam")?.original.status, "unavailable");
    assert.ok(snapshot.providers.find((item) => item.providerId === "gomariz")?.original);
  });
});

test("un SHA comercial alterado y un original modificado bloquean la lectura", async () => {
  await fixture.withCopy(async (root) => {
    const activePath = join(root, "catalogs", "commercial", "develop", "active.json");
    const active: unknown = JSON.parse(await readFile(activePath, "utf8"));
    assert.ok(active !== null && typeof active === "object" && "sha256" in active && typeof active.sha256 === "string");
    const commercialPath = join(root, "catalogs", "commercial", "develop", "versions", active.sha256, "gam-commercial.json");
    const originalCommercial = await readFile(commercialPath, "utf8");
    await writeFile(commercialPath, `${originalCommercial}\n`);
    await assert.rejects(readPanelSnapshot(root), /Archivo o huella discordante/);
    await writeFile(commercialPath, originalCommercial);
    const originalPath = join(root, "catalogs", "providers", "gam", "original", "scrape-gam-catalog.json");
    await writeFile(originalPath, `${await readFile(originalPath, "utf8")}\n`);
    await assert.rejects(readPanelSnapshot(root), /catálogo y su manifest pertenecen a ejecuciones distintas/);
  });
});

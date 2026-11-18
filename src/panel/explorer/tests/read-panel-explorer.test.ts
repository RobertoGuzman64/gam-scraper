import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { readPanelSnapshot } from "../../evidence/read-panel-snapshot.js";
import { compareOriginalToPublished, compareTechnicalFields, comparePublishedToCommercial } from "../field-differences.js";
import { readPanelExplorer, selectPresentationCases } from "../read-panel-explorer.js";
import type { PanelProductView } from "../types.js";
import { createPanelEvidenceWorkspaceFixture } from "../../../testing/builders/panel-evidence-workspace-fixture.js";

const fixture = createPanelEvidenceWorkspaceFixture();

test("el explorador refleja exactamente las tres poblaciones verificadas por proveedor", async () => {
  const snapshot = await readPanelSnapshot(await fixture.root());
  const explorer = await readPanelExplorer(await fixture.root(), snapshot);
  assert.equal(explorer.products.length, snapshot.totals.originals);
  for (const provider of snapshot.providers) {
    const rows = explorer.products.filter((item) => item.providerId === provider.providerId);
    assert.equal(rows.length, provider.metrics.originals);
    assert.equal(rows.filter((item) => item.stage === "commercial").length, provider.metrics.exported);
    assert.equal(rows.filter((item) => item.stage === "commercial-excluded").length, provider.metrics.excludedCommercial);
    assert.equal(rows.filter((item) => item.stage === "editorial-excluded").length, provider.metrics.excludedEditorial);
    for (const item of rows) {
      assert.ok(item.identity.startsWith(`${provider.providerId}:`));
      assert.ok(item.sourceUrl.startsWith("https://") || item.sourceUrl.startsWith("http://"));
      if (item.stage === "commercial") {
        assert.ok(item.published);
        assert.ok(item.commercial);
        assert.equal(item.commercialTechnicalChanges.length,
          new Set([...Object.keys(item.published.specs), ...Object.keys(item.commercial.specs)]).size);
        assert.ok(item.commercialTechnicalChanges.every((difference) => difference.group === "commercial"));
      }
      if (item.stage === "editorial-excluded") {
        assert.equal(item.published, null);
        assert.equal(item.commercial, null);
        assert.equal(item.decision?.stage, "editorial");
        assert.ok(item.decision?.reason);
      }
    }
  }
  assert.equal(new Set(explorer.products.map((item) => item.identity)).size, explorer.products.length);
});

test("selecciona tres casos reales con cambios y una exclusión aprobada", async () => {
  const explorer = await readPanelExplorer(await fixture.root(), await readPanelSnapshot(await fixture.root()));
  assert.deepEqual(explorer.cases.map((item) => item.focus), ["content", "technical", "commercial", "exclusion"]);
  for (const example of explorer.cases) {
    const item = explorer.products.find((entry) => entry.identity === example.identity);
    assert.ok(item);
    assert.equal(item.providerId, example.providerId);
    if (example.focus === "exclusion") {
      assert.equal(item.stage, "editorial-excluded");
      assert.equal(item.decision?.stage, "editorial");
      assert.ok(item.evidence.accreditation);
    } else {
      assert.ok(item.original);
      assert.ok(item.published);
      assert.ok(item.commercial);
      assert.ok((example.focus === "commercial" ? item.commercialChanges : item.changes)
        .some((change) => change.change === "changed" || change.change === "added"));
    }
  }
});

test("normaliza etiquetas técnicas existentes sin falsear magnitudes o colisiones", () => {
  const diff = compareTechnicalFields({ "Peso": "985 kg", Modelo: "ABC" },
    { "Peso": "985 kg", Modelo: "ABC", "Año de fabricación": "2022" });
  assert.equal(diff.find((item) => item.field === "Modelo")?.change, "unchanged");
  assert.equal(diff.find((item) => item.change === "added")?.change, "added");
  assert.equal(diff.find((item) => item.field.includes("Peso"))?.change, "unchanged");
  const changed = compareTechnicalFields({ Capacidad: "230 kg" }, { Capacidad: "250 kg" });
  assert.equal(changed.find((item) => item.field === "Capacidad")?.change, "changed");
});

test("preserva ausencia de precio, cero y diferencias entre salida técnica y comercial", () => {
  const empty: PanelProductView = {
    title: null, shortDescription: null, generalDescription: null, category: null,
    price: null, image: null, images: [], specs: {}
  };
  assert.equal(compareOriginalToPublished(empty, { ...empty, price: 0 })
    .find((item) => item.field === "Precio declarado")?.change, "added");
  const diff = comparePublishedToCommercial(empty, {
    ...empty, categorySellID: null, attributes: [{ attributeID: 7, value: 0 }], price: 0
  });
  assert.equal(diff.find((item) => item.field === "Precio")?.after, "0");
  assert.equal(diff.find((item) => item.field === "Identificador de categoría comercial")?.after, null);
  assert.equal(diff.find((item) => item.field === "Atributo comercial #7")?.after, "0");
});

test("sin original acreditado impide cualquier comparación editorial pero conserva FINISH", async () => {
  const snapshot = await readPanelSnapshot(await fixture.root());
  const providers = snapshot.providers.map((provider) => provider.providerId === "gam" && provider.original.status === "verified" ? {
    ...provider,
    original: { status: "unavailable" as const, expectedSha256: provider.original.artifact.sha256, reason: "Original no conservado" }
  } : provider);
  const explorer = await readPanelExplorer(await fixture.root(), { ...snapshot, providers });
  const gam = explorer.products.filter((item) => item.providerId === "gam");
  assert.ok(gam.every((item) => item.original === null && item.changes.length === 0));
  assert.ok(gam.some((item) => item.published !== null));
  assert.equal(explorer.originalComparisonsAvailable, false);
});

test("rechaza alteraciones de la acreditación y del paquete tras seleccionar el corte", async () => {
  await fixture.withCopy(async (copy) => {
    const snapshot = await readPanelSnapshot(copy);
    const gam = snapshot.providers.find((item) => item.providerId === "gam");
    assert.ok(gam);
    const accreditation = join(copy, gam.publication.path.replace("gam-publishable.json", "accreditation.json"));
    const raw = await readFile(accreditation, "utf8");
    await writeFile(accreditation, raw + "\n");
    await assert.rejects(readPanelExplorer(copy, snapshot), /acreditación|acreditada|huella|SHA256|archivo/iu);
    await writeFile(accreditation, raw);
    const commercial = join(copy, gam.commercial.path);
    const content = await readFile(commercial, "utf8");
    await writeFile(commercial, content + "\n");
    await assert.rejects(readPanelExplorer(copy, snapshot), /modificado|huella|SHA256|archivo/iu);
  });
});

test("prioriza demostraciones con evidencia compatible frente a fichas con más diferencias", async () => {
  const explorer = await readPanelExplorer(await fixture.root(), await readPanelSnapshot(await fixture.root()));
  const gam = explorer.products.find((item) => item.providerId === "gam" && item.stage === "commercial" &&
    item.changes.some((change) => change.group === "content" && (change.change === "changed" || change.change === "added")));
  assert.ok(gam);
  const field = gam.changes.find((change) => change.group === "content" && (change.change === "changed" || change.change === "added"));
  assert.ok(field);
  assert.ok(gam.evidence.publication);
  assert.ok(gam.evidence.original);
  const sourced = { ...gam, identity: `${gam.identity}:compatible`, provenance: [{
    field: field.field, group: field.group, status: "source-compatible" as const,
    publicationSha256: gam.evidence.publication.sha256,
    originalSha256: gam.evidence.original.sha256, scope: "unit" as const,
    sourceField: "title", sourceValue: field.after, proof: gam.evidence.original,
    sourceDigest: null, mechanism: null, historicalApplication: "not-demonstrated" as const
  }] };
  const noisy = { ...gam, identity: `${gam.identity}:noisy`, provenance: [],
    changes: [...gam.changes, ...gam.changes, ...gam.changes] };
  const selected = selectPresentationCases([...explorer.products, noisy, sourced]);
  assert.equal(selected.find((item) => item.providerId === "gam" && item.focus === "content")?.identity, sourced.identity);
  const outdated = { ...sourced, identity: `${gam.identity}:outdated`, provenance: sourced.provenance.map((entry) => ({
    ...entry, publicationSha256: "f".repeat(64)
  })) };
  const rejected = selectPresentationCases([...explorer.products, noisy, outdated]);
  assert.notEqual(rejected.find((item) => item.providerId === "gam" && item.focus === "content")?.identity, outdated.identity);
});

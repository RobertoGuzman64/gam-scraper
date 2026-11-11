import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { analyzeCommercialAttributes } from "../commercial-attributes.js";
import type { CommercialAttributeAudit } from "../commercial-attributes.js";
import { planCommercialExport } from "../../projection/export-projection.js";
import { selectAccreditedCommercialInputs } from "../../../testing/builders/commercial-publication-selection.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { loadCommercialReference } from "../../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));

const previouslyUnrelated = {
  gam: [
    "2159", "12", "2163", "2164", "2165", "2169", "5", "6", "8", "6653",
    "5254", "5710", "5918", "6217", "6623", "6688", "6689", "6690", "6806", "6358", "6367",
    "1884", "1885", "1886", "1887", "1888", "2134", "2135", "2572", "2573", "2737", "2738",
    "297", "298", "299", "3309", "3425", "3426", "3427", "3428", "3429", "3430", "3431",
    "3432", "3433", "3434", "3435", "3436", "5079", "6814", "6815"
  ],
  gomariz: ["RE454", "1011JFB", "5051BDX", "PV556"],
  mercaeleva: ["M928-9933", "M294-4678"]
} satisfies Readonly<Record<string, readonly string[]>>;

const previouslyUnrelatedWithHyster = {
  ...previouslyUnrelated, gam: [...previouslyUnrelated.gam, "2072", "2073"]
};

test("las 59 referencias auditadas conservan clasificación fiel y límites reales de atributos", async () => {
  const catalog = await loadImportCatalog();
  const { brandLogos } = await loadCommercialReference();
  const providers = await selectAccreditedCommercialInputs(root, catalog, previouslyUnrelatedWithHyster);
  const byProvider = new Map([...providers].map(([providerId, input]) => [
    providerId, analyzeCommercialAttributes(input.entries, catalog)
  ]));
  const allReferences = Object.values(previouslyUnrelated).reduce((total, references) => total + references.length, 0);
  assert.equal(allReferences, 57);
  for (const [provider, references] of Object.entries(previouslyUnrelated)) {
    const report = byProvider.get(provider);
    assert.ok(report, provider);
    const decisionByReference = new Map<string | null, CommercialAttributeAudit["decisions"][number]>(
      report.decisions.map((item) => [item.reference, item])
    );
    const input = providers.get(provider);
    assert.ok(input);
    const exported = planCommercialExport(input.entries, provider, input.publicationSha256, catalog, brandLogos, null, null);
    const byReference = new Map(exported.products.map((item) => [item.reference, item]));
    const originalByReference = new Map(input.entries.map((item) => [item.source.reference, item]));
    for (const reference of references) {
      const item = decisionByReference.get(reference);
      assert.ok(item, `${provider}:${reference}`);
      assert.equal(item.status, "proposed", `${provider}:${reference}`);
      assert.ok(item.categorySellID !== null, `${provider}:${reference}`);
      assert.equal(item.relatedAttributes, 0, `${provider}:${reference}`);
      assert.deepEqual(item.attributes, [], `${provider}:${reference}`);
      assert.deepEqual(item.recovered, [], `${provider}:${reference}`);
      const original = originalByReference.get(reference);
      const product = byReference.get(reference);
      assert.ok(original, `${provider}:${reference}`);
      assert.ok(product, `${provider}:${reference}`);
      assert.equal(product.sourceUrl, original.source.url);
      assert.equal(product.categorySellID, item.categorySellID);
      assert.deepEqual(product.attributes, item.attributes);
      assert.deepEqual(product.spec, original.published.spec);
      assert.deepEqual(product.images, original.published.images);
      assert.equal(product.condition, original.published.condition);
    }
  }
  const gam = byProvider.get("gam");
  assert.ok(gam);
  for (const reference of ["2072", "2073"]) {
    const item: CommercialAttributeAudit["decisions"][number] | undefined =
      gam.decisions.find((decision) => decision.reference === reference);
    assert.ok(item, reference);
    assert.equal(item.status, "proposed");
    assert.equal(item.categorySellID, 16);
    assert.equal(item.attributes.length, 6);
    assert.ok(item.relatedAttributes >= item.attributes.length);
  }
});


test("la selección de publicaciones exige referencias reales sin duplicados", async () => {
  const catalog = await loadImportCatalog();
  await assert.rejects(
    selectAccreditedCommercialInputs(root, catalog, { gam: ["2072", "2072"] }), /Referencias repetidas/
  );
  await assert.rejects(
    selectAccreditedCommercialInputs(root, catalog, { gam: ["REFERENCIA-INEXISTENTE"] }), /incompleta o duplicada/
  );
});

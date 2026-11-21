import assert from "node:assert/strict";
import test from "node:test";
import { isProductTechnicalProvenance } from "../../contracts/technical-provenance.js";
import { originalRecordFingerprint } from "../../catalog/identity-fingerprint.js";
import { normalizeSpecKey } from "../../catalog/normalization/normalize-specs.js";
import { readPanelSnapshot } from "../../panel/evidence/read-panel-snapshot.js";
import { compareOriginalToPublished } from "../../panel/explorer/field-differences.js";
import { resolvePanelFieldProvenance } from "../../panel/explorer/field-provenance.js";
import { classifyPublishedTechnicalAdditions } from "../technical-spec-classification.js";
import type { PanelProductView } from "../../panel/explorer/types.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../prepare-product.js";

const cases = [
  { reference: "M106-1389", scope: "model-document", mechanism: "documented-platform-technical-specs.ts" },
  { reference: "M736-5615", scope: "unit-document", mechanism: "documented-equipment-technical-specs.ts" }
] as const;

const sourceRecord = (reference: string): ProductRecord =>
  accreditedSourceRecord("mercaeleva-original", reference);

test("fase 20: los recuperadores emiten URL documental, modelo y mecanismo sin modificar las specs", () => {
  for (const entry of cases) {
    const original = sourceRecord(entry.reference);
    const before = JSON.stringify(original);
    const result = prepareSourceProduct(original);
    const trace = result.technicalProvenance;
    assert.ok(trace);
    assert.ok(isProductTechnicalProvenance(trace));
    assert.equal(trace.originalRecordSha256, originalRecordFingerprint(original));
    const documents = trace.entries.filter((evidence) => evidence.scope === entry.scope);
    assert.ok(documents.length > 0, entry.reference);
    for (const evidence of documents) {
      assert.ok(evidence.mechanism.endsWith(entry.mechanism));
      assert.equal(evidence.sourceField, null);
      assert.equal(evidence.sourceValue, null);
      assert.ok(evidence.document);
      assert.ok(evidence.document.url.startsWith("https://"));
      assert.equal(evidence.document.brand, original.brand);
      assert.equal(evidence.document.model, original.model);
      assert.equal(Object.entries(result.product.spec).find(([key]) => normalizeSpecKey(key) === evidence.field)?.[1],
        evidence.value);
    }
    assert.equal(JSON.stringify(original), before);
    assert.deepEqual(prepareSourceProduct(original), result);
  }
});

test("fase 20: ninguna referencia documental se atribuye a una unidad o variante no verificada", () => {
  for (const entry of cases) {
    const original = sourceRecord(entry.reference);
    const base = prepareSourceProduct(original);
    const document = base.technicalProvenance?.entries.find((evidence) => evidence.scope === entry.scope);
    assert.ok(document);
    const variants = [
      { ...original, url: "https://example.test/ficha-ajena" },
      { ...original, reference: `${entry.reference}-otro` },
      { ...original, model: "Variante incompatible" },
      { ...original, year: "1999" },
      { ...original, longDescription: "Descripción de otro equipo" },
      { ...original, specs: { ...original.specs, [document.field]: "Dato alternativo" } }
    ];
    for (const variant of variants) {
      const result = prepareSourceProduct(variant);
      assert.ok(!result.technicalProvenance?.entries.some((evidence) => evidence.scope === entry.scope &&
        evidence.field === document.field && evidence.value === document.value));
    }
  }
});

test("fase 20: el contrato acepta trazas antiguas y rechaza documentos alterados o ambiguos", () => {
  const original = sourceRecord("M106-1389");
  const source = prepareSourceProduct(original).technicalProvenance;
  assert.ok(source);
  assert.ok(isProductTechnicalProvenance(source));
  const entry = source.entries.find((evidence) => evidence.scope === "model-document");
  assert.ok(entry);
  assert.ok(entry.document);
  for (const invalid of [
    { ...entry, document: { ...entry.document, url: "javascript:alert(1)" } },
    { ...entry, document: { ...entry.document, brand: "" } },
    { ...entry, document: { ...entry.document, model: "" } },
    { ...entry, document: undefined },
    { ...entry, scope: "unit", sourceField: "year", sourceValue: "2020" },
    { ...entry, scope: "unknown" }
  ]) {
    assert.equal(isProductTechnicalProvenance({ ...source, entries: [invalid] }), false);
  }
  const legacy = { ...source, entries: [{ field: "Año", value: "2021", scope: "unit",
    mechanism: "src/preparation/gomariz/technical/mapping/source-year-spec.ts",
    sourceField: "year", sourceValue: "2021" }] };
  assert.equal(isProductTechnicalProvenance(legacy), true);
});

const originalView = (original: ProductRecord): PanelProductView => ({
  title: original.title, shortDescription: original.shortDescription, generalDescription: original.longDescription,
  category: original.categoryName, price: original.price, image: original.image,
  images: original.images ?? [], specs: original.specs ?? {}
});

test("fase 20: el panel conserva el enlace documental, demuestra la ejecución y no reclasifica sin revisión", async () => {
  const original = sourceRecord("M106-1389");
  const prepared = prepareSourceProduct(original);
  const published: PanelProductView = { ...originalView(original), specs: prepared.product.spec };
  const differences = compareOriginalToPublished(originalView(original), published);
  const snapshot = await readPanelSnapshot(process.cwd());
  const provider = snapshot.providers.find((item) => item.providerId === "mercaeleva");
  assert.ok(provider);
  const provenance = resolvePanelFieldProvenance(original, published, differences, provider, null,
    original.reference, original.url, prepared.technicalProvenance);
  const documented = provenance.filter((item) => item.scope === "model-document");
  assert.ok(documented.length > 0);
  assert.ok(documented.every((entry) => entry.status === "mechanism-compatible" &&
    entry.historicalApplication === "demonstrated" && entry.proof === null &&
    entry.document?.brand === original.brand && entry.document?.model === original.model));
  const additions = classifyPublishedTechnicalAdditions(original, null, "mercaeleva", original.reference,
    original.url, true, differences.filter((difference) => difference.change === "added" &&
    difference.group === "technical").map((difference) =>
    ({ field: difference.field, value: difference.after ?? "" })));
  assert.ok(additions.length > 0);
  assert.ok(additions.every((item) => item.kind === "pending"));
  assert.throws(() => resolvePanelFieldProvenance({ ...original, model: "Modelo ajeno" },
    published, differences, provider, null, original.reference, original.url, prepared.technicalProvenance),
  /no corresponde al original/);
});

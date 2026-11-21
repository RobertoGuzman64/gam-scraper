import assert from "node:assert/strict";
import test from "node:test";
import { isProductTechnicalProvenance } from "../../contracts/technical-provenance.js";
import { normalizeSpecKey } from "../../catalog/normalization/normalize-specs.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../testing/domain-cases/accredited-source-samples.js";
import { documentedTechnicalReference } from "../shared/technical/evidence/documented-technical-evidence.js";
import { prepareSourceProduct } from "../prepare-product.js";

const scenarios = [
  { dataset: "gam-original", reference: "4013", field: "Depósito de recuperación",
    scope: "model-document", mechanism: "documented-warehouse-cleaning-and-lifting-specs.ts" },
  { dataset: "gam-original", reference: "1894", field: "Control de tracción",
    scope: "unit-document", mechanism: "documented-warehouse-cleaning-and-lifting-specs.ts" },
  { dataset: "gam-original", reference: "211", field: "Anchura de caja admitida",
    scope: "model-document", mechanism: "documented-handling-and-industrial-specs.ts" },
  { dataset: "gam-original", reference: "3993", field: "Autonomía anunciada por carga",
    scope: "unit-document", mechanism: "documented-source-performance-specs.ts" },
  { dataset: "mercaeleva-original", reference: "M005-4474", field: "Capacidad de plataforma",
    scope: "model-document", mechanism: "documented-lgmg-and-bt-lift-specs.ts" },
  { dataset: "mercaeleva-original", reference: "M433-5206", field: "Combustible anunciado",
    scope: "unit-document", mechanism: "documented-toyota-forklift-specs.ts" }
] as const;

test("fase 21: cada familia documental emite la fuente usada en el propio recuperador", () => {
  for (const sample of scenarios) {
    const original = accreditedSourceRecord(sample.dataset, sample.reference);
    const unchangedOriginal = JSON.stringify(original);
    const prepared = prepareSourceProduct(original);
    const entries = prepared.technicalProvenance?.entries ?? [];
    const evidence = entries.find((entry) => entry.field === normalizeSpecKey(sample.field));
    assert.ok(evidence, sample.reference);
    assert.equal(evidence.scope, sample.scope, sample.reference);
    assert.ok(evidence.mechanism.endsWith(sample.mechanism));
    assert.ok(evidence.scope === "model-document" || evidence.scope === "unit-document");
    assert.ok(evidence.document.url.startsWith("https://"));
    assert.equal(evidence.document.brand, original.brand);
    assert.equal(evidence.document.model, original.model);
    assert.equal(evidence.value, prepared.product.spec[sample.field]);
    assert.ok(isProductTechnicalProvenance(prepared.technicalProvenance));
    assert.equal(JSON.stringify(original), unchangedOriginal);
    assert.deepEqual(prepareSourceProduct(original), prepared);
  }
});

test("fase 21: identidad, variante y cambios de contenido invalidan la evidencia documental", () => {
  for (const sample of scenarios) {
    const original = accreditedSourceRecord(sample.dataset, sample.reference);
    const mechanism = `src/preparation/${sample.dataset === "gam-original" ? "gam/technical/models" :
      "mercaeleva/technical/evidence"}/${sample.mechanism}`;
    const variants: readonly ProductRecord[] = [
      { ...original, reference: `${original.reference}-ajeno` },
      { ...original, model: "VARIANTE DISTINTA" },
      { ...original, url: "https://example.test/equipo-distinto" },
      { ...original, longDescription: "Información ajena" },
      { ...original, specs: { ...original.specs, [sample.field]: "valor diferente" } }
    ];
    for (const variant of variants) {
      const result = prepareSourceProduct(variant);
      assert.ok(!result.technicalProvenance?.entries.some((entry) =>
        entry.field === normalizeSpecKey(sample.field) && entry.mechanism === mechanism &&
        entry.scope === sample.scope));
    }
  }
});

test("fase 21: un enlace a otra unidad no se presenta como documento de modelo", () => {
  const original = accreditedSourceRecord("gam-original", "1894");
  assert.equal(documentedTechnicalReference(original, "https://online.gamrentals.com/es/otra/9999-modelo"), undefined);
  assert.equal(documentedTechnicalReference(original, "javascript:alert(1)"), undefined);
  assert.equal(documentedTechnicalReference(original, "https://[invalid]"), undefined);
  assert.equal(documentedTechnicalReference({ ...original, brand: null }, original.url)?.scope, "document-reference");
  const unit = documentedTechnicalReference(original, original.url);
  assert.equal(unit?.scope, "unit-document");
  assert.equal(unit.document.url, original.url);
});

test("fase 21: las fuentes múltiples conservan únicamente referencias con alcance limitado", () => {
  const lot = accreditedSourceRecord("gam-original", "6971");
  const trace = prepareSourceProduct(lot).technicalProvenance;
  assert.ok(trace);
  assert.ok(trace.entries.some((entry) => entry.scope === "document-reference"));
  assert.ok(trace.entries.every((entry) => entry.scope !== "model-document" &&
    entry.scope !== "unit-document"));
  const unresolved = prepareSourceProduct(accreditedSourceRecord("gam-original", "6994"));
  assert.ok(unresolved.technicalProvenance?.entries.some((entry) => entry.scope === "unknown"));
  const singleReference = accreditedSourceRecord("gam-original", "6993");
  const singleTrace = prepareSourceProduct(singleReference).technicalProvenance;
  assert.ok(singleTrace?.entries.some((entry) => entry.scope === "document-reference" &&
    entry.document.url === singleReference.url));
});

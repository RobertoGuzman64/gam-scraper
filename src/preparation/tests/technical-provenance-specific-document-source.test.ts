import assert from "node:assert/strict";
import test from "node:test";
import { originalRecordFingerprint } from "../../catalog/identity-fingerprint.js";
import { isProductTechnicalProvenance } from "../../contracts/technical-provenance.js";
import { accreditedSourceRecord } from "../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../prepare-product.js";

const evidence = (dataset: "gam-original" | "mercaeleva-original", reference: string, field: string) => {
  const original = accreditedSourceRecord(dataset, reference);
  const prepared = prepareSourceProduct(original);
  const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
  assert.ok(entry, `${reference}: ${field}`);
  return { original, prepared, entry };
};

test("fase 23: los lotes con modelos individualizados conservan su referencia sin convertirla en documentación compartida", () => {
  const cases = [
    ["6971", "UniCarriers 1Q2L25Q · Capacidad de carga", "/UniCarriers/1Q2L25Q"],
    ["6971", "UniCarriers A1N1L18Q · Altura de elevación", "6738-2016-unicarriers-a1n1l18q"],
    ["6987", "Yale MP20 · Longitud de horquillas", "5827-2017-yale-mp20"],
    ["6987", "Hyster P2.0SD · Altura de elevación", "5937-2021-hyster-p20sd"],
    ["6988", "Hyster P2.0 · Capacidad de carga", "6436-2022-hyster-p20"],
    ["6988", "Still RX 60-35 · Altura de elevación", "6860-2015-still-rx-60-35"],
    ["6989", "Toyota LPE200 · Longitud de horquillas", "5792-2006-toyota-lpe200"],
    ["6989", "Yale ERP35VL · Capacidad de carga", "6835-2019-yale-erp35vl"]
  ] as const;
  for (const [reference, field, fragment] of cases) {
    const { original, prepared, entry } = evidence("gam-original", reference, field);
    assert.equal(entry.scope, "document-reference", `${reference}: ${field}`);
    assert.ok(entry.document.url.includes(fragment));
    const reviewed = reference === "6971" && field.startsWith("UniCarriers 1Q2L25Q")
      ? { brand: "UniCarriers", model: "1Q2L25Q" }
      : reference === "6987" && field.startsWith("Yale MP20")
        ? { brand: "YALE", model: "MP20" } : { brand: null, model: null };
    assert.equal(entry.document.brand, reviewed.brand);
    assert.equal(entry.document.model, reviewed.model);
    assert.equal(entry.mechanism, "src/preparation/gam/technical/models/documented-multi-unit-lot-specs.ts");
    assert.equal(prepared.product.spec[field], entry.value);
    assert.equal(prepared.technicalProvenance?.originalRecordSha256, originalRecordFingerprint(original));
    assert.ok(isProductTechnicalProvenance(prepared.technicalProvenance));
  }
});

test("fase 23: lotes con fuentes ambiguas no reciben una referencia individual ficticia", () => {
  for (const { reference, unknown, reviewed } of [
    { reference: "6994", unknown: 0, reviewed: 2 },
    { reference: "6995", unknown: 0, reviewed: 4 }
  ] as const) {
    const original = accreditedSourceRecord("gam-original", reference);
    const trace = prepareSourceProduct(original).technicalProvenance;
    const entries = trace?.entries.filter((entry) =>
      entry.mechanism.endsWith("documented-multi-unit-lot-specs.ts")) ?? [];
    assert.equal(entries.filter((entry) => entry.scope === "unknown").length, unknown);
    assert.equal(entries.filter((entry) => entry.scope === "unit-document" &&
      entry.document.url === original.url && entry.verification?.kind === "reviewed-unit-listing").length, reviewed);
    const changed = prepareSourceProduct({ ...original, url: "https://online.gamrentals.com/es/lotes/otro-lote" });
    assert.ok(!changed.technicalProvenance?.entries.some((entry) =>
      entry.mechanism.endsWith("documented-multi-unit-lot-specs.ts")));
  }
});

test("fase 23: catálogo técnico JLG conserva la única referencia documental externa de la regla", () => {
  const { original, prepared, entry } = evidence("mercaeleva-original", "M198-7237", "Anchura según catálogo técnico");
  assert.equal(entry.scope, "model-document");
  assert.equal(entry.document.url,
    "https://cdnc.heyzine.com/flip-book/pdf/3bf89898f6e750b3a716118e3b59d30cf09fe308-1.pdf");
  assert.equal(entry.document.model, original.model);
  assert.equal(entry.document.brand, original.brand);
  assert.equal(prepared.product.spec["Anchura según catálogo técnico"], entry.value);
  assert.ok(isProductTechnicalProvenance(prepared.technicalProvenance));
  const altered = prepareSourceProduct({ ...original, model: "otra variante" });
  assert.ok(!altered.technicalProvenance?.entries.some((item) =>
    item.mechanism === entry.mechanism && item.scope === "model-document"));
});

test("fase 23: identidad corregida y unidades de batería apuntan al dato original, no al valor publicado", () => {
  const cases = [
    ["6688", "Marca", "ALFA ROMEO"],
    ["6689", "Marca", "AUDI"],
    ["6690", "Marca", "PEUGEOUT"],
    ["2218", "Voltaje batería (V)", "Ancho promedio"],
    ["2218", "Capacidad de la batería (Ah)", "Ancho promedio"],
    ["2108", "Voltaje batería (V)", "Capacidad de la batería"],
    ["920", "Voltaje batería (V)", "Capacidad de la batería"]
  ] as const;
  for (const [reference, field, sourceField] of cases) {
    const { original, prepared, entry } = evidence("gam-original", reference, field);
    assert.equal(entry.scope, "unit", `${reference}: ${field}`);
    assert.equal(entry.sourceField, sourceField);
    assert.equal(entry.sourceValue, original.specs?.[sourceField]);
    assert.equal(entry.value, prepared.product.spec[field]);
    assert.ok(isProductTechnicalProvenance(prepared.technicalProvenance));
    const altered = prepareSourceProduct({ ...original,
      specs: { ...original.specs, [sourceField]: "valor original no verificable" } });
    assert.ok(!altered.technicalProvenance?.entries.some((item) => item.field === entry.field &&
      item.mechanism === entry.mechanism && item.scope === "unit"));
  }
});

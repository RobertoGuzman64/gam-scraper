import assert from "node:assert/strict";
import test from "node:test";
import { originalRecordFingerprint } from "../../catalog/identity-fingerprint.js";
import { isProductTechnicalProvenance } from "../../contracts/technical-provenance.js";
import { normalizeSpecKey } from "../../catalog/normalization/normalize-specs.js";
import { accreditedSourceRecord } from "../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../prepare-product.js";

const evidenceFor = (reference: string, field: string) => {
  const original = accreditedSourceRecord("gam-original", reference);
  const prepared = prepareSourceProduct(original);
  return { original, prepared, entry: prepared.technicalProvenance?.entries.find((item) =>
    item.field === normalizeSpecKey(field)) };
};

test("fase 22: 78 motorizaciones GAM conservan evidencia explícita de la descripción original", () => {
  for (const reference of ["6077", "6362", "5845", "6545", "6966"]) {
    const { original, prepared, entry } = evidenceFor(reference, "Motorización");
    assert.ok(entry, reference);
    assert.equal(entry.scope, "unit", reference);
    assert.equal(entry.mechanism, "src/preparation/gam/technical/energy/verified-electric-drive-evidence.ts");
    assert.equal(entry.sourceField, "longDescription");
    assert.equal(entry.sourceValue, original.longDescription);
    assert.equal(entry.value, "Eléctrico");
    assert.equal(prepared.technicalProvenance?.originalRecordSha256, originalRecordFingerprint(original));
    assert.ok(isProductTechnicalProvenance(prepared.technicalProvenance));
    assert.deepEqual(prepareSourceProduct(original), prepared);
  }
});

test("fase 22: identidad alterada, negación y alternativa eléctrica no acreditan motorización propia", () => {
  const { original, entry } = evidenceFor("6077", "Motorización");
  assert.ok(entry);
  const variants = [
    { ...original, reference: "otra-referencia" },
    { ...original, model: "MODELO DISTINTO" },
    { ...original, url: "https://example.test/ficha" },
    { ...original, longDescription: "El accionamiento eléctrico es opcional; la unidad funciona con diésel." },
    { ...original, longDescription: "El modelo no es eléctrico." }
  ];
  for (const variant of variants) {
    const changed = prepareSourceProduct(variant);
    assert.ok(!changed.technicalProvenance?.entries.some((item) => item.mechanism === entry.mechanism &&
      item.field === entry.field && item.scope === "unit"));
  }
});

test("fase 22: referencias sin identidad documental revisada no se convierten en documentos de modelo", () => {
  for (const [reference, field] of [
    ["6688", "Altura exterior del modelo"],
    ["6971", "UniCarriers A1N1L18Q · Capacidad de carga"]
  ] as const) {
    const { original, prepared, entry } = evidenceFor(reference, field);
    assert.ok(entry, reference);
    assert.equal(entry.scope, "document-reference", reference);
    assert.ok(entry.document.url.startsWith("https://"));
    assert.equal(entry.document.brand, original.brand);
    assert.equal(entry.document.model, original.model);
    assert.equal(entry.sourceField, null);
    assert.equal(entry.sourceValue, null);
    assert.ok(isProductTechnicalProvenance(prepared.technicalProvenance));
    const variant = prepareSourceProduct({ ...original, model: "VARIANTE AJENA" });
    assert.ok(!variant.technicalProvenance?.entries.some((item) => item.scope === "document-reference" &&
      item.field === entry.field && item.value === entry.value));
  }
  const reviewed = evidenceFor("6805", "Dimensiones exteriores");
  assert.equal(reviewed.original.brand, null);
  assert.equal(reviewed.original.model, null);
  assert.equal(reviewed.entry?.scope, "document-reference");
  assert.equal(reviewed.entry.document?.brand, "LVNENG");
  assert.equal(reviewed.entry.document?.model, "LX05");
  assert.ok(reviewed.entry.verification);
  const multiple = evidenceFor("6971", "UniCarriers A1N1L18Q · Capacidad de carga");
  assert.equal(multiple.entry?.scope, "document-reference");
  assert.equal(multiple.entry.document?.brand, null);
  assert.equal(multiple.entry.document?.model, null);
});

test("fase 22: el contrato acepta identidad documental parcial pero no una acreditación completa falsa", () => {
  const { prepared, entry } = evidenceFor("6688", "Altura exterior del modelo");
  assert.ok(prepared.technicalProvenance);
  assert.ok(entry);
  assert.equal(entry.scope, "document-reference");
  assert.ok(entry.document);
  assert.equal(isProductTechnicalProvenance({ ...prepared.technicalProvenance,
    entries: [{ ...entry, scope: "model-document" }] }), false);
  assert.equal(isProductTechnicalProvenance({ ...prepared.technicalProvenance,
    entries: [{ ...entry, document: { ...entry.document, url: "javascript:invalid" } }] }), false);
  assert.equal(isProductTechnicalProvenance({ ...prepared.technicalProvenance,
    entries: [{ ...entry, document: { ...entry.document, brand: "" } }] }), false);
});

test("fase 22: la reconciliación de identidad y unidades emite el mecanismo exacto sin cambiar valores", () => {
  for (const [reference, field, fragment] of [
    ["6688", "Marca", "used-classic-vehicle-identity.ts"],
    ["6689", "Marca", "used-classic-vehicle-identity.ts"],
    ["6690", "Marca", "used-classic-vehicle-identity.ts"],
    ["2218", "Voltaje batería (V)", "gam-source-technical-units.ts"],
    ["2218", "Capacidad de la batería (Ah)", "gam-source-technical-units.ts"],
    ["2108", "Voltaje batería (V)", "gam-source-technical-units.ts"],
    ["920", "Voltaje batería (V)", "gam-source-technical-units.ts"]
  ] as const) {
    const { original, prepared, entry } = evidenceFor(reference, field);
    assert.ok(entry, `${reference}: ${field}`);
    assert.ok(entry.mechanism.endsWith(fragment), `${reference}: ${field}`);
    assert.equal(entry.scope, "unit");
    assert.equal(entry.sourceValue, original.specs?.[entry.sourceField ?? ""]);
    assert.equal(entry.value, prepared.product.spec[field]);
    assert.equal(prepareSourceProduct(original).product.spec[field], entry.value);
  }
});

test("fase 22: las conversiones Yale señalan la especificación original usada por el mapper", () => {
  for (const [reference, field, rawField] of [
    ["2300", "Altura de elevación (mm)", "Centro de carga"],
    ["2300", "Peso (kg)", "Capacidad de la batería"],
    ["2300", "Batería (V / Ah)", "Radio de giro"],
    ["2241", "Altura de elevación (mm)", "Centro de carga"],
    ["2249", "Batería (V / Ah)", "Altura Plataforma"]
  ] as const) {
    const { original, prepared, entry } = evidenceFor(reference, field);
    assert.ok(entry);
    assert.equal(entry.mechanism, "src/preparation/gam/technical/crossed-specifications.ts");
    assert.equal(entry.scope, "unit");
    assert.equal(entry.sourceField, rawField);
    assert.equal(entry.sourceValue, original.specs?.[rawField]);
    assert.equal(entry.value, Object.entries(prepared.product.spec).find(([key]) =>
      normalizeSpecKey(key) === entry.field)?.[1]);
    const changed = prepareSourceProduct({ ...original, specs: { ...original.specs, [rawField]: "no verificable" } });
    assert.ok(!changed.technicalProvenance?.entries.some((item) => item.field === entry.field &&
      item.mechanism === entry.mechanism && item.scope === "unit"));
  }
});

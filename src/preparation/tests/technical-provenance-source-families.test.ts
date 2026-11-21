import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSpecKey } from "../../catalog/normalization/normalize-specs.js";
import { accreditedSourceRecord } from "../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../prepare-product.js";

const cases = [
  { reference: "6607", field: "Año", mechanism: "source/used-year-spec-evidence.ts" },
  { reference: "6901", field: "Controles proporcionales", mechanism: "safety/source-safety-controls-evidence.ts" },
  { reference: "6389", field: "Nivelación automática", mechanism: "safety/source-stabilization-evidence.ts" },
  { reference: "6901", field: "Motorización", mechanism: "energy/used-diesel-fuel-evidence.ts" },
  { reference: "6682", field: "Motorización", mechanism: "energy/used-forklift-fuel-evidence.ts" },
  { reference: "4748", field: "Potencia (kW)", mechanism: "energy/motor-configuration-evidence.ts" },
  { reference: "4733", field: "Capacidad de la batería (Ah)", mechanism: "energy/battery-electrical-evidence.ts" },
  { reference: "4738", field: "Frenado automático", mechanism: "operations/verified-unit-performance-specs.ts" },
  { reference: "4733", field: "Frenado automático", mechanism: "mobility/verified-drivetrain-brakes-evidence.ts" },
  { reference: "4019", field: "Anchura del cepillo principal (mm)", mechanism: "operations/sweeping-brush-evidence.ts" }
] as const;

test("fase 19: familias de GAM emiten procedencia propia de la descripción original sin cambiar el valor", () => {
  for (const { reference, field, mechanism } of cases) {
    const original = accreditedSourceRecord("gam-original", reference);
    const prepared = prepareSourceProduct(original);
    const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
    assert.ok(entry, `${reference}:${field}`);
    assert.equal(entry.mechanism, `src/preparation/gam/technical/${mechanism}`);
    assert.equal(entry.scope, "unit", `${reference}:${field}`);
    assert.equal(entry.sourceField, "longDescription");
    assert.equal(entry.sourceValue, original.longDescription);
    const published = Object.entries(prepared.product.spec).find(([key]) => normalizeSpecKey(key) === field);
    assert.ok(published, `${reference}:${field}:spec`);
    assert.equal(entry.value, String(published[1]));
    assert.deepEqual(prepareSourceProduct(original).technicalProvenance, prepared.technicalProvenance);
  }
});

test("fase 19: las acreditaciones de ficha no sobreviven a un cambio de descripción o dominio", () => {
  const original = accreditedSourceRecord("gam-original", "6901");
  const prepared = prepareSourceProduct(original);
  const keys = ["Controles proporcionales", "Motorización"];
  for (const field of keys) {
    assert.equal(prepared.technicalProvenance?.entries.find((entry) => entry.field === field)?.scope, "unit");
  }
  const changed = prepareSourceProduct({ ...original, longDescription: "Información técnica no verificable para la unidad." });
  for (const field of keys) {
    assert.notEqual(changed.technicalProvenance?.entries.find((entry) => entry.field === field)?.scope, "unit");
  }
  const foreign = prepareSourceProduct({ ...original, url: "https://example.test/ficha-ajena" });
  for (const field of keys) {
    assert.notEqual(foreign.technicalProvenance?.entries.find((entry) => entry.field === field)?.scope, "unit");
  }
  const variantOriginal = accreditedSourceRecord("gam-original", "4738");
  const variant = prepareSourceProduct({ ...variantOriginal, model: "Variante distinta" });
  assert.notEqual(variant.technicalProvenance?.entries.find((entry) =>
    entry.field === "Frenado automático")?.scope, "unit");
});

test("fase 19: las fichas documentadas no se convierten en propias por compartir modelo o descripción", () => {
  const gam = accreditedSourceRecord("gam-original", "3425");
  const gamEntry = prepareSourceProduct(gam).technicalProvenance?.entries.find((entry) => entry.field === "Anchura de bandeja");
  assert.equal(gamEntry?.scope, "model-document");
  assert.ok(gamEntry.document.url.startsWith("https://"));
  const mercaeleva = accreditedSourceRecord("mercaeleva-original", "M838-0666");
  const mercaelevaEntry = prepareSourceProduct(mercaeleva).technicalProvenance?.entries.find((entry) =>
    entry.field === "Altura de plataforma");
  assert.equal(mercaelevaEntry?.scope, "unknown");
});

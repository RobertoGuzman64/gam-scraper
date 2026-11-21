import assert from "node:assert/strict";
import test from "node:test";
import { accreditedSourceRecord } from "../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { originalRecordFingerprint } from "../../catalog/identity-fingerprint.js";

const mechanism = (entries: ReturnType<typeof prepareSourceProduct>["technicalProvenance"], field: string) =>
  entries?.entries.find((entry) => entry.field === field);

test("fase 18: la recuperación de batería GAM acredita su fuente ejecutada, identidad y valor", () => {
  const original = accreditedSourceRecord("gam-original", "4731");
  const prepared = prepareSourceProduct(original);
  const entry = mechanism(prepared.technicalProvenance, "Voltaje batería (V)");
  assert.ok(entry);
  assert.equal(entry.mechanism, "src/preparation/gam/technical/energy/battery-measures-evidence.ts");
  assert.equal(entry.value, prepared.product.spec["Voltaje batería (V)"]);
  assert.equal(entry.scope, "unit");
  assert.equal(entry.sourceField, "longDescription");
  assert.equal(entry.sourceValue, original.longDescription);
  assert.equal(prepared.technicalProvenance?.originalRecordSha256, originalRecordFingerprint(original));
  assert.deepEqual(prepareSourceProduct(original).technicalProvenance, prepared.technicalProvenance);
  const changed = { ...original, longDescription: "La unidad carece de medidas de batería verificables." };
  const changedTrace = prepareSourceProduct(changed).technicalProvenance;
  assert.notEqual(changedTrace?.originalRecordSha256, prepared.technicalProvenance?.originalRecordSha256);
  assert.notDeepEqual(mechanism(changedTrace, "Voltaje batería (V)"), entry);
});

test("fase 18: el módulo documental GAM emite su mecanismo sin convertir documentación externa en fuente propia", () => {
  const original = accreditedSourceRecord("gam-original", "3425");
  const prepared = prepareSourceProduct(original);
  const entry = mechanism(prepared.technicalProvenance, "Anchura de bandeja");
  assert.ok(entry);
  assert.equal(entry.value, prepared.product.spec["Anchura de bandeja"]);
  assert.equal(entry.mechanism, "src/preparation/gam/technical/models/documented-modula-storage-specs.ts");
  assert.equal(entry.scope, "model-document");
  assert.equal(entry.sourceField, null);
  assert.equal(entry.sourceValue, null);
  assert.ok(entry.document.url.startsWith("https://"));
  const variant = prepareSourceProduct({ ...original, model: "OTRA VARIANTE" });
  assert.notEqual(variant.technicalProvenance?.originalRecordSha256, prepared.technicalProvenance?.originalRecordSha256);
  assert.equal(mechanism(variant.technicalProvenance, "Anchura de bandeja"), undefined);
});

test("fase 18: Mercaeleva distingue la evidencia de ficha de la recuperación documental", () => {
  const fuel = accreditedSourceRecord("mercaeleva-original", "M940-4770");
  const fuelEntry = mechanism(prepareSourceProduct(fuel).technicalProvenance, "Tipo de motor");
  assert.ok(fuelEntry);
  assert.equal(fuelEntry.mechanism, "src/preparation/mercaeleva/technical/evidence/source-fuel-evidence.ts");
  assert.equal(fuelEntry.scope, "unit");
  assert.equal(fuelEntry.sourceField, "longDescription");
  assert.equal(fuelEntry.sourceValue, fuel.longDescription);
  const platform = accreditedSourceRecord("mercaeleva-original", "M838-0666");
  const platformEntry = mechanism(prepareSourceProduct(platform).technicalProvenance, "Altura de plataforma");
  assert.ok(platformEntry);
  assert.equal(platformEntry.mechanism, "src/preparation/mercaeleva/technical/evidence/documented-platform-technical-specs.ts");
  assert.equal(platformEntry.scope, "unknown");
  assert.equal(platformEntry.sourceField, null);
});

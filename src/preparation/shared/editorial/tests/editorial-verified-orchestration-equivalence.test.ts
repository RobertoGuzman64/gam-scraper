import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";
import { resolvePreparedEditorial } from "../mapping/prepared-editorial.js";
import { normalizePreparedEditorialPresentation } from "../mapping/prepared-editorial-presentation.js";
import { captureSourceEditorialEvidence } from "../mapping/source-editorial-evidence.js";
import {
  controlledGamForklift, controlledGomarizPlatform, controlledMercaelevaPlatform
} from "./editorial-contract-records.js";

const sources = [controlledGamForklift, controlledGomarizPlatform, controlledMercaelevaPlatform];

const original = (provider: "gam" | "gomariz" | "mercaeleva", reference: string): ProductRecord =>
  accreditedSourceRecord(`${provider}-original`, reference);

test("RE078 habilita la composición verificada de fuente en unidades nuevas de los tres proveedores", () => {
  for (const create of sources) {
    const source = create();
    const snapshot = JSON.stringify(source);
    const evidence = captureSourceEditorialEvidence(source);
    const composed = resolveReusableEditorial(source);
    const mapped = resolvePreparedEditorial(source, source, evidence);
    const prepared = prepareSourceProduct(source);
    assert.deepEqual(evidence, { identityVerified: true, sourceVerified: true }, source.providerId);
    assert.ok(composed.short, source.providerId);
    assert.ok(composed.general, source.providerId);
    assert.equal(mapped.preparedShort, composed.short, source.providerId);
    assert.ok(mapped.preparedLong?.startsWith(composed.general), source.providerId);
    assert.equal(prepared.status, "ready", source.providerId);
    assert.equal(prepared.product.description, mapped.preparedShort, source.providerId);
    assert.equal(prepared.product.description_general, mapped.preparedLong, source.providerId);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("RE078 no confunde autenticidad de fuente con autorización de enriquecimiento", () => {
  for (const create of sources) {
    const source = create();
    const denied = resolvePreparedEditorial(source, source,
      { identityVerified: false, sourceVerified: false });
    assert.equal(denied.preparedLong, null, source.providerId);
    assert.notEqual(denied.preparedShort, resolveReusableEditorial(source).short, source.providerId);
    for (const changed of [
      { ...source, model: "MODELO11" },
      { ...source, url: "https://example.invalid/unidad" },
      { ...source, providerId: "proveedor-desconocido" }
    ]) {
      const evidence = captureSourceEditorialEvidence(changed);
      const mapped = resolvePreparedEditorial(changed, changed, evidence);
      const prepared = prepareSourceProduct(changed);
      assert.equal(evidence.identityVerified && evidence.sourceVerified, false);
      assert.equal(resolveReusableEditorial(changed).general, null);
      assert.equal(mapped.preparedLong, null);
      assert.equal(prepared.product.description_general, null);
      assert.equal(prepared.status, "review");
      assert.ok(prepared.issues.includes("Cobertura editorial insuficiente: descripción general"));
    }
  }
});

test("RE078 conserva una evidencia histórica firmada sin convertirla en regla para unidades ajenas", () => {
  const source = original("gam", "5996");
  const signed = resolveKnowledgeEditorial(source, source);
  assert.ok(signed.short);
  assert.ok(signed.general);
  const independent = resolvePreparedEditorial(source, source,
    { identityVerified: false, sourceVerified: false });
  assert.equal(independent.preparedShort, signed.short);
  assert.equal(independent.preparedLong, signed.general);
  const another: ProductRecord = { ...source, reference: "5996-OTRA" };
  const unsigned = resolveKnowledgeEditorial(another, another);
  assert.equal(unsigned.short, null);
  assert.equal(unsigned.general, null);
  const withoutVerification = resolvePreparedEditorial(another, another,
    { identityVerified: false, sourceVerified: false });
  assert.notEqual(withoutVerification.preparedShort, signed.short);
  assert.notEqual(withoutVerification.preparedLong, signed.general);
});

test("RE081 aplica la presentación final una sola vez y conserva los campos preparados en originales", () => {
  for (const [provider, reference] of [
    ["gam", "6901"], ["gomariz", "TE1618"], ["mercaeleva", "M840-6795"]
  ] as const) {
    const source = original(provider, reference);
    const snapshot = JSON.stringify(source);
    const prepared = prepareSourceProduct(source);
    const product = prepared.product;
    assert.equal(prepared.status, "ready", `${provider}:${reference}`);
    assert.ok(product.title, `${provider}:${reference}`);
    assert.ok(product.description, `${provider}:${reference}`);
    assert.ok(product.description_general, `${provider}:${reference}`);
    assert.equal(product.description_title, product.title, `${provider}:${reference}`);
    assert.deepEqual(normalizePreparedEditorialPresentation(source, product), product);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("RE081 presenta medidas propias de una unidad nueva y mantiene el contrato de identidad", () => {
  const source: ProductRecord = {
    ...controlledGamForklift(),
    reference: "CONTROL-81",
    url: "https://online.gamrentals.com/es/carretillas/CONTROL-81-carretilla-elevadora",
    title: "Carretilla elevadora MARCA MODELO10 3000 kg",
    specs: { "Capacidad de carga (kg)": "3000 kg", "Altura de elevación (mm)": "6000 mm" }
  };
  const result = prepareSourceProduct(source);
  const prepared = result.product;
  assert.equal(result.status, "ready");
  assert.match(prepared.description ?? "", /3\.000 kg/u);
  assert.match(prepared.description_general ?? "", /6 m/u);
  assert.doesNotMatch(prepared.description_general ?? "", /2\.500 kg|4,5 m/u);
  assert.deepEqual(normalizePreparedEditorialPresentation(source, prepared), prepared);
  assert.throws(() => normalizePreparedEditorialPresentation({ ...source, reference: "CONTROL-OTRA" }, prepared),
    /Identidad editorial discordante/u);
  assert.throws(() => normalizePreparedEditorialPresentation({ ...source, url: `${source.url}?revisado=1` }, prepared),
    /Identidad editorial discordante/u);
  const incompatible = { ...source, title: "Carretilla elevadora MARCA MODELO10 2500 kg" };
  const rejected = prepareSourceProduct(incompatible);
  assert.equal(rejected.product.description_general, null);
  assert.equal(rejected.status, "review");
});

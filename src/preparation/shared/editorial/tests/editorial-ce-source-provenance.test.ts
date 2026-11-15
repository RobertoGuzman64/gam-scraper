import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveVerifiedEditorialUnitContext } from "../domain/editorial-unit-context.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";

const original = (reference: string): ProductRecord => accreditedSourceRecord("mercaeleva-original", reference);
const declaration = /La ficha del proveedor declara certificación CE para esta unidad; el certificado no se ha verificado documentalmente\./u;
const general = "La ficha técnica de la máquina incorpora magnitudes declaradas.";

test("las fichas históricas con certificación CE declarada conservan la fuente sin acreditar el certificado", () => {
  for (const reference of ["M318-0509", "M200-9533"]) {
    const source = original(reference);
    const snapshot = JSON.stringify(source);
    const signed = resolveKnowledgeEditorial(source, source);
    const prepared = prepareSourceProduct(source);
    assert.equal(source.specs?.["Certificación CE"], "Yes");
    assert.ok(signed.fallbackGeneral?.includes("certificación CE") || reference === "M200-9533");
    assert.equal(prepared.status, "ready");
    assert.match(prepared.product.description_general ?? "", declaration);
    assert.doesNotMatch(prepared.product.description_general ?? "", /certificado verificado|certificación acreditada/iu);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("la composición no repite el dato de las firmas históricas que ya lo incluyen", () => {
  const source = original("M855-6850");
  const signed = resolveKnowledgeEditorial(source, source);
  const prepared = prepareSourceProduct(source);
  assert.ok(signed.general);
  assert.equal(prepared.product.description_general, signed.general);
  assert.doesNotMatch(prepared.product.description_general ?? "", declaration);
  const alreadyDeclared = resolveVerifiedEditorialUnitContext(source,
    `${general} El proveedor declara certificación CE.`);
  assert.doesNotMatch(alreadyDeclared ?? "", declaration);
  assert.equal((alreadyDeclared?.match(/certificaci[oó]n CE/giu) ?? []).length, 1);
});

test("una máquina nueva únicamente recupera la declaración CE de sus propios datos", () => {
  const source = original("M318-0509");
  const next: ProductRecord = {
    ...source,
    reference: "M999-0509",
    url: source.url.replace("M318-0509", "M999-0509"),
    year: "2025",
    title: source.title?.replace("2026", "2025") ?? null,
    longDescription: source.longDescription?.replace("2026", "2025") ?? null,
    specs: { ...source.specs, "Año de fabricación": "2025" }
  };
  assert.equal(resolveKnowledgeEditorial(next, next).fallbackGeneral, null);
  const prepared = prepareSourceProduct(next);
  assert.match(prepared.product.description_general ?? "", declaration);
  assert.doesNotMatch(prepared.product.description_general ?? "", /2026/u);
  assert.match(prepared.product.description_general ?? "", /2025/u);
  assert.equal(resolveVerifiedEditorialUnitContext(source, general, next), general);
});

test("ausencia, negación o contradicción de la certificación impiden afirmarla", () => {
  const source = original("M318-0509");
  const withoutCertification = { ...source.specs };
  delete withoutCertification["Certificación CE"];
  for (const changed of [
    { ...source, specs: withoutCertification },
    { ...source, specs: { ...source.specs, "Certificación CE": "No" } },
    { ...source, specs: { ...source.specs, "Certificación CE": "Pending" } },
    { ...source, longDescription: `${source.longDescription ?? ""} Sin certificación CE.` }
  ]) {
    assert.doesNotMatch(resolveVerifiedEditorialUnitContext(changed, general) ?? "", declaration);
  }
  assert.equal(resolveVerifiedEditorialUnitContext(source, general,
    { ...source, specs: { ...source.specs, "Certificación CE": "No" } }), general);
});

test("identidad, proveedor, condición y URL diferentes no transfieren declaraciones CE", () => {
  const source = original("M318-0509");
  for (const prepared of [
    { ...source, providerId: "gam" },
    { ...source, reference: "M999-0509" },
    { ...source, url: `${source.url}?otra=1` },
    { ...source, model: "OTRO-MODELO" },
    { ...source, condition: "Segunda mano" as const }
  ]) {
    assert.equal(resolveVerifiedEditorialUnitContext(source, general, prepared), general);
  }
});

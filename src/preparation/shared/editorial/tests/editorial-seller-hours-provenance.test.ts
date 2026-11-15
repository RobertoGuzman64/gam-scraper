import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveVerifiedEditorialUnitContext } from "../domain/editorial-unit-context.js";

const original = (reference: string): ProductRecord => accreditedSourceRecord("mercaeleva-original", reference);
const base = "La ficha técnica declara altura de trabajo de 10 m.";
const notice = /El anuncio de origen declara «0 horas», sin una lectura de horómetro estructurada para esta unidad/u;

test("los anuncios históricos de cero horas no se convierten en lecturas de horómetro", () => {
  for (const reference of ["M005-4474", "M159-0669"]) {
    const source = original(reference);
    const snapshot = JSON.stringify(source);
    assert.equal(source.horometer, null);
    assert.equal(source.specs?.["Horas laborales"], undefined);
    const prepared = prepareSourceProduct(source);
    assert.match(prepared.product.description_general ?? "", notice);
    assert.doesNotMatch(prepared.product.description_general ?? "", /horómetro (?:de|registrado) 0|0 horas registradas/iu);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("una nueva unidad compatible solo conserva su propio anuncio y no hereda el texto firmado", () => {
  const source = original("M005-4474");
  const next: ProductRecord = {
    ...source,
    reference: "M900-0001",
    url: source.url.replace("M005-4474", "M900-0001"),
    year: "2025",
    longDescription: "Ref. S0808EII PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 10 MT LGMG S0808EII HORAS 0 AÑO DE FABRICACION 2025",
    specs: { ...source.specs, "Año de fabricación": "2025" }
  };
  const prepared = prepareSourceProduct(next);
  assert.match(prepared.product.description_general ?? "", notice);
  assert.match(prepared.product.description_general ?? "", /2025/u);
  assert.doesNotMatch(prepared.product.description_general ?? "", /2026/u);
  assert.equal(resolveVerifiedEditorialUnitContext(source, base, next), base);
});

test("ausencia, negación, contradicción o lectura estructurada impiden recuperar cero horas", () => {
  const source = original("M159-0669");
  for (const altered of [
    { ...source, longDescription: source.longDescription?.replace("HORAS 0", "HORAS 4") ?? null },
    { ...source, longDescription: source.longDescription?.replace("HORAS 0", "HORAS NO DISPONIBLES") ?? null },
    { ...source, longDescription: "La ficha no dispone de HORAS 0 acreditadas." },
    { ...source, horometer: "4" },
    { ...source, specs: { ...source.specs, "Horas laborales": "4 h" } }
  ]) {
    assert.doesNotMatch(resolveVerifiedEditorialUnitContext(altered, base) ?? "", notice);
  }
  const alreadyDeclared = resolveVerifiedEditorialUnitContext(source, `${base} El anuncio indica 0 horas.`);
  assert.doesNotMatch(alreadyDeclared ?? "", notice);
  assert.match(alreadyDeclared ?? "", /El anuncio indica 0 horas/u);
});

test("los cambios de proveedor, URL, referencia, modelo o condición no conservan el contexto antiguo", () => {
  const source = original("M005-4474");
  for (const changed of [
    { ...source, providerId: "gam" },
    { ...source, url: source.url.replace("M005-4474", "M000-0002") },
    { ...source, reference: "M000-0002" },
    { ...source, model: "OTRO" },
    { ...source, condition: "Segunda mano" as const }
  ]) {
    assert.equal(resolveVerifiedEditorialUnitContext(source, base, changed), base);
  }
});

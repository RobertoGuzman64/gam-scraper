import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { structureSourcedLongGeneral } from "../domain/editorial-sourced-long-structure.js";

const original = (reference: string): ProductRecord => accreditedSourceRecord("gam-original", reference);

const references = ["4807", "2336", "2337", "2080", "5", "2081", "2083", "2084", "2085", "2086", "2087", "2073", "2088", "2089", "2074", "2041", "2038", "2039", "3799", "3800", "3802", "3803", "5079", "1888", "1144"] as const;

test("separa en párrafos descripciones extensas sin modificar los hechos del original", () => {
  for (const reference of references) {
    const source = original(reference);
    const before = source.longDescription?.trim() ?? "";
    const result = structureSourcedLongGeneral(source, source, before, true);
    assert.ok(result, reference);
    assert.equal(result.replace("\n\n", " "), before, reference);
    assert.equal(result.split("\n\n").length, 2, reference);
    assert.equal(prepareSourceProduct(source).product.description_general, result, reference);
  }
});

test("no combina fuentes, identidades, variantes ni textos firmados o ya estructurados", () => {
  const source = original("2085");
  const before = source.longDescription?.trim() ?? "";
  const variants: readonly ProductRecord[] = [
    { ...source, providerId: "gomariz" },
    { ...source, reference: "OTRA" },
    { ...source, url: "https://example.org/otra-unidad" },
    { ...source, brand: "YALE" },
    { ...source, model: "H5.0FT" },
    { ...source, condition: "Segunda mano" },
    { ...source, title: "Carretilla elevadora YALE H4.0FT5" }
  ];
  for (const variant of variants) {
    assert.equal(structureSourcedLongGeneral(source, variant, before,
      source.providerId === variant.providerId), null);
  }
  assert.equal(structureSourcedLongGeneral(source, source, before, false), null);
  assert.equal(structureSourcedLongGeneral(source, source, `Acreditado. ${before}`, true), null);
  assert.equal(structureSourcedLongGeneral(source, source, before.replace(". ", ".\n\n"), true), null);
  assert.equal(structureSourcedLongGeneral({ ...source, longDescription: null }, source, before, true), null);
  assert.equal(structureSourcedLongGeneral(source, { ...source, specs: { ...source.specs }, reference: "OTRA" }, before, true), null);
});

test("respeta descripciones técnicas protegidas y textos ya sintetizados", () => {
  for (const reference of ["4031", "6186"] as const) {
    const source = original(reference);
    const current = prepareSourceProduct(source).product.description_general ?? "";
    if (current !== source.longDescription?.trim()) {
      assert.equal(structureSourcedLongGeneral(source, source, current, true), null, reference);
    }
  }
});

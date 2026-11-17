import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveSourcedAmbiguousWidth } from "../domain/editorial-sourced-ambiguous-dimension.js";

const source = (): ProductRecord => accreditedSourceRecord("gomariz-special-original", "DU473");

test("aclara la anchura ambigua del propio original sin asignarla a la unidad", () => {
  const record = source();
  const snapshot = JSON.stringify(record);
  const general = prepareSourceProduct(record).product.description_general ?? "";
  assert.match(general, /dos valores de anchura, 1,75 m y 1,59 m/u);
  assert.match(general, /sin aclarar a qu[eé] configuraci[oó]n corresponde cada uno/u);
  assert.equal(JSON.stringify(record), snapshot);
});

test("rechaza valores reconciliados, unidades diferentes y afirmaciones ya presentes", () => {
  const record = source();
  const general = "El dúmper Ausa D201RS se anuncia para transporte de materiales a granel.";
  const expected = resolveSourcedAmbiguousWidth(record, record, general, true);
  assert.ok(expected);
  assert.equal(resolveSourcedAmbiguousWidth(record, record, expected, true), null);
  const variants: readonly ProductRecord[] = [
    { ...record, reference: "OTRA" },
    { ...record, url: "https://example.invalid/otro-dumper" },
    { ...record, brand: "OTRA" },
    { ...record, model: "OTRO" },
    { ...record, condition: "Nuevo" },
    { ...record, specs: { ...record.specs, Anchura: "1.75 m" } },
    { ...record, title: "Plataforma de tijera eléctrica Ausa D201RS" }
  ];
  for (const variant of variants) {
    assert.equal(resolveSourcedAmbiguousWidth(record, variant, general, true), null);
  }
  assert.equal(resolveSourcedAmbiguousWidth(record, record, general, false), null);
  assert.equal(resolveSourcedAmbiguousWidth(record, { ...record, providerId: "gam" }, general, false), null);
  assert.equal(resolveSourcedAmbiguousWidth({ ...record, specs: { ...record.specs, Anchura: "1,59 m" } }, record, general, true), null);
});

import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { resolveSourcedAmbiguousWidth } from "../domain/editorial-sourced-ambiguous-dimension.js";
import { controlledGomarizPlatform } from "./editorial-contract-records.js";

const source = (): ProductRecord => {
  const record = controlledGomarizPlatform();
  return {
    ...record,
    brand: "Ausa",
    model: "D201RS",
    title: "Dúmper Ausa D201RS",
    specs: { ...record.specs, Anchura: "1,75 m, 1,59 m" }
  };
};

const general = "El dúmper Ausa D201RS se anuncia para transporte de materiales a granel.";

test("identifica las dos anchuras sin asignar ninguna a la unidad", () => {
  const record = source();
  const snapshot = JSON.stringify(record);
  const result = resolveSourcedAmbiguousWidth(record, record, general, true);
  assert.match(result ?? "", /dos valores de anchura, 1,75 m y 1,59 m/u);
  assert.match(result ?? "", /sin aclarar a qu[eé] configuraci[oó]n corresponde cada uno/u);
  assert.equal(JSON.stringify(record), snapshot);
});

test("rechaza reconciliaciones, identidades distintas y textos que ya contienen las medidas", () => {
  const record = source();
  const expected = resolveSourcedAmbiguousWidth(record, record, general, true);
  assert.ok(expected);
  assert.equal(resolveSourcedAmbiguousWidth(record, record, expected, true), null);
  const variants: readonly ProductRecord[] = [
    { ...record, reference: "OTRA" },
    { ...record, url: "https://example.invalid/otro-dumper" },
    { ...record, brand: "OTRA" },
    { ...record, model: "OTRO" },
    { ...record, condition: "Nuevo" },
    { ...record, specs: { ...record.specs, Anchura: "1,75 m" } },
    { ...record, title: "Plataforma de tijera eléctrica Ausa D201RS" }
  ];
  for (const variant of variants) {
    assert.equal(resolveSourcedAmbiguousWidth(record, variant, general, true), null);
  }
  assert.equal(resolveSourcedAmbiguousWidth(record, record, general, false), null);
  assert.equal(resolveSourcedAmbiguousWidth(record, { ...record, providerId: "gam" }, general, false), null);
  assert.equal(resolveSourcedAmbiguousWidth({ ...record, specs: { ...record.specs, Anchura: "1,59 m" } }, record, general, true), null);
});

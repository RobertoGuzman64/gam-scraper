import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { accreditedSourceSamples } from "../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../preparation/prepare-product.js";
import { analyzeEditorialReuse } from "../editorial-reuse.js";
import type { GapInput } from "../content-gaps-types.js";

const gam = accreditedSourceSamples("gam-original");
const gomariz = accreditedSourceSamples("gomariz-original");
const mercaeleva = accreditedSourceSamples("mercaeleva-original");

const get = (records: readonly ProductRecord[], reference: string): ProductRecord => {
  const record = records.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

const entry = (source: ProductRecord): GapInput => ({ source, prepared: prepareSourceProduct(source) });
const without = (input: GapInput, field: "description" | "description_general"): GapInput => ({
  ...input, prepared: { ...input.prepared, product: { ...input.prepared.product, [field]: null } }
});

test("diagnóstico: señala la capacidad disponible bloqueada solo si el campo queda vacío y la ficha está ready", () => {
  const platform = entry(get(gomariz, "BT1102"));
  const missing = without(platform, "description");
  const report = analyzeEditorialReuse([missing]);
  assert.equal(report.totals.capacidad_disponible_sin_aplicar, 1);
  assert.deepEqual(report.cases.filter((item) => item.cause === "capacidad_disponible_sin_aplicar")
    .map((item) => [item.reference, item.field, item.family]),
  [["BT1102", "description", "plataforma-telescopica"]]);
  const review = analyzeEditorialReuse([{ ...missing, prepared: { ...missing.prepared,
    status: "review", issues: ["Dato técnico contradictorio"] } }]);
  assert.equal(review.totals.capacidad_disponible_sin_aplicar, 0);
  assert.equal(review.totals.preparacion_en_revision, 1);
});

test("diagnóstico: rechaza identidades repetidas y salidas de otra unidad", () => {
  const first = entry(get(gomariz, "BT1102"));
  const other = entry(get(gomariz, "BT1139"));
  assert.throws(() => analyzeEditorialReuse([first, first]), /duplicada/u);
  assert.throws(() => analyzeEditorialReuse([{ ...first, prepared: other.prepared }]), /discordante/u);
});


test("RE082 audita la reutilización real y sus precedencias en originales de los tres proveedores", () => {
  const inputs = [
    entry(get(gam, "6901")),
    entry(get(gomariz, "BT1102")),
    entry(get(mercaeleva, "M827-8304"))
  ];
  const original = JSON.stringify(inputs);
  const report = analyzeEditorialReuse(inputs);
  assert.equal(report.analyzed, inputs.length);
  assert.equal(Object.values(report.totals).reduce((sum, value) => sum + value, 0), inputs.length * 2);
  assert.ok(report.totals.aplicada + report.totals.precedencia_de_texto_existente > 0);
  assert.equal(report.totals.capacidad_disponible_sin_aplicar, 0);
  assert.deepEqual(analyzeEditorialReuse([...inputs].reverse()), report);
  assert.equal(JSON.stringify(inputs), original);
});

test("RE082 distingue un nuevo anuncio compatible de una pérdida y de una revisión justificada", () => {
  const historical = get(gomariz, "BT1102");
  const incoming: ProductRecord = {
    ...historical,
    reference: "CONTROL-RE082",
    url: historical.url?.replace(/\/$/u, "-control-re082/") ?? historical.url
  };
  const candidate = entry(incoming);
  const correct = analyzeEditorialReuse([candidate]);
  assert.equal(correct.analyzed, 1);
  assert.equal(correct.totals.capacidad_disponible_sin_aplicar, 0);
  assert.ok(correct.totals.aplicada + correct.totals.precedencia_de_texto_existente > 0);
  const removed = without(candidate, "description");
  const missing = analyzeEditorialReuse([removed]);
  assert.equal(missing.totals.capacidad_disponible_sin_aplicar, 1);
  assert.deepEqual(missing.cases.filter((item) => item.cause === "capacidad_disponible_sin_aplicar")
    .map((item) => [item.providerId, item.reference, item.field]),
  [["gomariz", incoming.reference, "description"]]);
  const review = analyzeEditorialReuse([{ ...removed, prepared: { ...removed.prepared,
    status: "review", issues: ["Dato técnico contradictorio"] } }]);
  assert.equal(review.totals.capacidad_disponible_sin_aplicar, 0);
  assert.equal(review.totals.preparacion_en_revision, 1);
  const unknown: ProductRecord = { ...incoming, url: "https://example.invalid/ficha/control-re082" };
  const invalid = entry(unknown);
  const noSource = analyzeEditorialReuse([without(without(invalid, "description"), "description_general")]);
  assert.equal(noSource.totals.origen_no_validado, 2);
  assert.equal(noSource.totals.capacidad_disponible_sin_aplicar, 0);
});

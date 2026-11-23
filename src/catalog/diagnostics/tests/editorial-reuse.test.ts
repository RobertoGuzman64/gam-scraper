import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../preparation/prepare-product.js";
import {
  controlledGamForklift,
  controlledGomarizPlatform,
  controlledMercaelevaForklift
} from "../../../preparation/shared/editorial/tests/editorial-contract-records.js";
import { analyzeEditorialReuse } from "../editorial-reuse.js";
import type { GapInput } from "../content-gaps-types.js";

const entry = (source: ProductRecord): GapInput => ({ source, prepared: prepareSourceProduct(source) });
const without = (input: GapInput, field: "description" | "description_general"): GapInput => ({
  ...input, prepared: { ...input.prepared, product: { ...input.prepared.product, [field]: null } }
});

test("diagnóstico: distingue capacidad editorial disponible, ausencia de aplicación y revisión", () => {
  const platform = entry(controlledGomarizPlatform());
  const missing = without(platform, "description");
  const report = analyzeEditorialReuse([missing]);
  assert.equal(report.totals.capacidad_disponible_sin_aplicar, 1);
  assert.deepEqual(report.cases.filter((item) => item.cause === "capacidad_disponible_sin_aplicar")
    .map((item) => [item.reference, item.field, item.family]),
  [[platform.source.reference, "description", "plataforma-tijera"]]);
  const review = analyzeEditorialReuse([{ ...missing, prepared: { ...missing.prepared,
    status: "review", issues: ["Dato técnico contradictorio"] } }]);
  assert.equal(review.totals.capacidad_disponible_sin_aplicar, 0);
  assert.equal(review.totals.preparacion_en_revision, 1);
});

test("diagnóstico: rechaza identidades repetidas y preparaciones de otra unidad", () => {
  const first = entry(controlledGomarizPlatform());
  const other = entry({ ...controlledGomarizPlatform(),
    reference: "CONTROL-OTRA", url: "https://www.gomarizrent.com/producto/marca-modelo10-otra/" });
  assert.throws(() => analyzeEditorialReuse([first, first]), /duplicada/u);
  assert.throws(() => analyzeEditorialReuse([{ ...first, prepared: other.prepared }]), /discordante/u);
});

test("audita el contrato compartido de tres proveedores sin depender de un inventario congelado", () => {
  const inputs = [
    entry(controlledGamForklift()),
    entry(controlledGomarizPlatform()),
    entry(controlledMercaelevaForklift())
  ];
  const original = JSON.stringify(inputs);
  const report = analyzeEditorialReuse(inputs);
  assert.equal(report.analyzed, inputs.length);
  assert.equal(Object.values(report.totals).reduce((sum, value) => sum + value, 0), inputs.length * 2);
  assert.deepEqual(analyzeEditorialReuse([...inputs].reverse()), report);
  assert.equal(JSON.stringify(inputs), original);
});

test("un anuncio nuevo no hereda la identidad ajena y permite detectar pérdidas de contenido", () => {
  const original = controlledGomarizPlatform();
  const incoming: ProductRecord = {
    ...original,
    reference: "CONTROL-SEMANTICO-NUEVO",
    url: "https://www.gomarizrent.com/producto/marca-modelo10-nueva/"
  };
  const candidate = entry(incoming);
  const correct = analyzeEditorialReuse([candidate]);
  assert.equal(correct.analyzed, 1);
  assert.equal(correct.totals.capacidad_disponible_sin_aplicar, 0);
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
  const unknown: ProductRecord = { ...incoming, url: "https://example.invalid/ficha/control-nueva" };
  const invalid = entry(unknown);
  const noSource = analyzeEditorialReuse([without(without(invalid, "description"), "description_general")]);
  assert.equal(noSource.totals.origen_no_validado, 2);
  assert.equal(noSource.totals.capacidad_disponible_sin_aplicar, 0);
});

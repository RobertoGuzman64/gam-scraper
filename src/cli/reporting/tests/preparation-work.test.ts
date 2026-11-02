import assert from "node:assert/strict";
import test from "node:test";
import type { PreparationWorkSummary } from "../../../catalog/diagnostics/preparation-work.js";
import { formatPreparationWork } from "../preparation-work.js";

const empty: PreparationWorkSummary = {
  processedProducts: 3, transformedProducts: 0,
  specificationsAdded: 0, specificationsRenamed: 0,
  specificationValuesFormatted: 0, specificationValuesChanged: 0,
  descriptionsGenerated: 0, descriptionsTransformed: 0, titlesTransformed: 0
};

test("el informe de consulta no muestra campos sin cambios", () => {
  assert.deepEqual(formatPreparationWork(empty, true), [
    "EQUIPZILLA | TRABAJO SIMULADO", "  Máquinas procesadas: 3", "  Máquinas transformadas: 0"
  ]);
});

test("los contadores incorporados no se atribuyen a recuperación sin evidencia", () => {
  const lines = formatPreparationWork({ ...empty, specificationsAdded: 2, transformedProducts: 1 }, false);
  assert.ok(lines.includes("  Especificaciones incorporadas: 2"));
  assert.ok(lines.some((line) => line.includes("recuperación de evidencia no acreditada")));
  assert.ok(lines.every((line) => !line.includes("recuperadas:")));
});

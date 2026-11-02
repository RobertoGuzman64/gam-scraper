import assert from "node:assert/strict";
import test from "node:test";
import type { PublicationDifference } from "../active-publication.js";
import { evaluatePublicationDifference } from "../publication-acceptance.js";

const base: PublicationDifference = {
  previous: "a".repeat(64), candidate: "b".repeat(64), previousProducts: 2, candidateProducts: 3,
  added: ["ref:4"], removed: [], modified: ["ref:1"], lostDescriptions: [], removedSpecifications: [],
  addedSpecifications: [], changedSpecifications: [], lostSpecificationValues: [], changedSources: []
};

test("se aceptan altas y transformaciones sin pérdidas estructurales", () => {
  assert.deepEqual(evaluatePublicationDifference(base), { accepted: true, blockers: [] });
});

test("se bloquean bajas de fichas, descripciones y especificaciones sin acreditación", () => {
  const evaluation = evaluatePublicationDifference({
    ...base, removed: ["ref:2"], lostDescriptions: ["ref:1:description_general"],
    removedSpecifications: ["ref:1:Horas laborales"]
  });
  assert.equal(evaluation.accepted, false);
  assert.equal(evaluation.blockers.length, 3);
  assert.match(evaluation.blockers[0] ?? "", /ref:2/);
  assert.match(evaluation.blockers[1] ?? "", /description_general/);
  assert.match(evaluation.blockers[2] ?? "", /Horas laborales/);
});


test("se bloquean los valores técnicos vaciados y los cambios de procedencia", () => {
  const evaluation = evaluatePublicationDifference({
    ...base, lostSpecificationValues: ["ref:1:Altura de trabajo"], changedSources: ["ref:1"]
  });
  assert.equal(evaluation.accepted, false);
  assert.equal(evaluation.blockers.length, 2);
});

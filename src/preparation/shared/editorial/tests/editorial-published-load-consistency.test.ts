import assert from "node:assert/strict";

import test from "node:test";

import { prepareSourceProduct } from "../../../prepare-product.js";

import { hasVerifiedPublishedEditorialLoadConflict } from "../mapping/prepared-editorial-load-consistency.js";

import { controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift } from "./editorial-contract-records.js";

const issue = "Descripción comercial contradictoria: capacidad de carga";

test("medidas coherentes de las tres fuentes no generan un bloqueo editorial", () => {
  for (const source of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const prepared = prepareSourceProduct(source);
    assert.equal(hasVerifiedPublishedEditorialLoadConflict(source, prepared.product), false, source.providerId);
    assert.ok(!prepared.issues.includes(issue), source.providerId);
  }
});

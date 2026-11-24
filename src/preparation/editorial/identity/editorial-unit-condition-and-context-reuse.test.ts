import assert from "node:assert/strict";

import test from "node:test";

import type { ProductRecord } from "../../../contracts/catalog.js";

import { resolveVerifiedEditorialCondition } from "./editorial-condition.js";

import { resolveEditorialIdentitySummary } from "./editorial-identity-summary.js";

import { resolveVerifiedTechnicalBrief } from "../measurements/editorial-technical-brief.js";

import { resolveVerifiedEditorialUnitContext } from "./editorial-unit-context.js";

import { controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift } from "../core/editorial-contract-records.js";

const general = "La ficha técnica describe exclusivamente la unidad indicada por el proveedor.";

const withConditionEvidence = (record: ProductRecord, condition: "Nuevo" | "Segunda mano"): ProductRecord => ({
  ...record,
  condition,
  specs: {
    ...record.specs,
    Estado: condition === "Nuevo" ? "Nuevo" : "Usado",
    Peso: "2400 kg",
    Longitud: "2,8 m"
  }
});

test("reutiliza la condición en nuevas unidades y descarta estados técnicos incompatibles", () => {
  for (const create of [controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift]) {
    const conditions: readonly ("Nuevo" | "Segunda mano")[] = create === controlledGomarizForklift ?
      ["Segunda mano"] : ["Nuevo", "Segunda mano"];
    for (const condition of conditions) {
      const source = withConditionEvidence(create(), condition);
      const pattern = condition === "Nuevo" ? /nueva/u : /de ocasión/u;
      assert.equal(resolveVerifiedEditorialCondition(source), condition, source.providerId);
      assert.match(resolveEditorialIdentitySummary(source, null) ?? "", pattern, source.providerId);
      assert.match(resolveVerifiedTechnicalBrief(source, source) ?? "", pattern, source.providerId);
      const conflicting = {
        ...source,
        specs: { ...source.specs, Estado: condition === "Nuevo" ? "Usado" : "Nuevo" }
      };
      assert.equal(resolveVerifiedEditorialCondition(conflicting), null, source.providerId);
      assert.doesNotMatch(resolveEditorialIdentitySummary(conflicting, null) ?? "", /de ocasión|nueva/u, source.providerId);
      assert.doesNotMatch(resolveVerifiedTechnicalBrief(conflicting, conflicting) ?? "", /de ocasión|unidad nueva/u, source.providerId);
      assert.doesNotMatch(resolveVerifiedTechnicalBrief(source, conflicting) ?? "", /de ocasión|unidad nueva/u, source.providerId);
      assert.equal(resolveVerifiedEditorialCondition({ ...source, condition: null }), null, source.providerId);
    }
  }
});

test("permite unidades compatibles nuevas y bloquea datos propios de otra unidad", () => {
  const factories = [controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift];
  for (const create of factories) {
    const base = create();
    const source: ProductRecord = {
      ...base,
      location: "Madrid",
      serialNumber: "UNIDAD7854",
      specs: { ...base.specs, Ubicación: "Madrid", "Nº de serie": "UNIDAD7854" }
    };
    const next: ProductRecord = {
      ...source,
      reference: "NUEVA-UNIDAD",
      url: base.url.replace(base.reference ?? "", "NUEVA-UNIDAD"),
      location: "Valencia",
      serialNumber: "UNIDAD9632",
      specs: { ...source.specs, Ubicación: "Valencia", "Nº de serie": "UNIDAD9632" }
    };
    const first = resolveVerifiedEditorialUnitContext(source, general, source) ?? "";
    const second = resolveVerifiedEditorialUnitContext(next, general, next) ?? "";
    assert.match(first, /Madrid.*UNIDAD7854/us, source.providerId);
    assert.match(second, /Valencia.*UNIDAD9632/us, source.providerId);
    assert.doesNotMatch(second, /UNIDAD7854|Madrid/u, source.providerId);
    assert.equal(resolveVerifiedEditorialUnitContext(source, general, next), general, source.providerId);
    assert.equal(resolveVerifiedEditorialUnitContext(source, general,
      { ...source, providerId: "proveedor-distinto" }), general, source.providerId);
    assert.equal(resolveVerifiedEditorialUnitContext(source, general,
      { ...source, specs: { ...source.specs, Ubicación: "Valencia", "Nº de serie": "UNIDAD9632" } }),
    general, source.providerId);
    assert.equal(resolveVerifiedEditorialUnitContext(source, general,
      { ...source, condition: "Nuevo" }), general, source.providerId);
  }
});

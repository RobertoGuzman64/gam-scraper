import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveVerifiedEditorialCondition } from "../domain/editorial-condition.js";
import { resolveEditorialIdentitySummary } from "../domain/editorial-identity-summary.js";
import { resolveVerifiedTechnicalBrief } from "../domain/editorial-technical-brief.js";
import { resolveVerifiedEditorialUnitContext } from "../domain/editorial-unit-context.js";
import { normalizeCorroboratedTowingSummary } from "../domain/editorial-towing-summary.js";
import { normalizeEditorialSummary } from "../domain/editorial-normalization.js";
import {
  controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift
} from "./editorial-contract-records.js";

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

test("RE027 conserva la condición acreditada de originales de los tres proveedores", () => {
  const cases = [
    ["gam-original", "6682", "Segunda mano", /de ocasión/u],
    ["gam-original", "2057", "Nuevo", /nueva/u],
    ["gomariz-original", "TE1591", "Segunda mano", /de ocasión/u],
    ["mercaeleva-original", "M208-7097", "Segunda mano", /de ocasión/u],
    ["mercaeleva-original", "M840-6795", "Nuevo", /nueva/u]
  ] as const;
  for (const [dataset, reference, condition, pattern] of cases) {
    const source = accreditedSourceRecord(dataset, reference);
    const before = JSON.stringify(source);
    assert.equal(resolveVerifiedEditorialCondition(source), condition, reference);
    assert.match(resolveEditorialIdentitySummary(source, null) ?? "", pattern, reference);
    assert.ok(prepareSourceProduct(source).product.title, reference);
    assert.equal(JSON.stringify(source), before, reference);
  }
});

test("RE027 reutiliza la condición en nuevas unidades y descarta estados técnicos incompatibles", () => {
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

test("RE027 un resumen comercial de arrastrador no normaliza un Nuevo contradicho por Estado Usado", () => {
  const source = accreditedSourceRecord("gam-original", "2738");
  const prepared = prepareSourceProduct(source).product;
  const raw = normalizeEditorialSummary(source.shortDescription, source.model);
  const conflicting = { ...source, specs: { ...source.specs, Estado: "Usado" } };
  assert.notEqual(normalizeCorroboratedTowingSummary(source, prepared, raw), raw);
  assert.equal(normalizeCorroboratedTowingSummary(conflicting, prepared, raw), raw);
});

test("RE028 recupera ubicación, serie y referencia únicamente de originales corroborados", () => {
  const gam = accreditedSourceRecord("gam-original", "6682");
  const historical = prepareSourceProduct(gam).product.description_general ?? "";
  assert.match(historical, /Ubicación declarada para esta unidad: TARRAGONA/u);
  assert.match(historical, /Número de serie declarado para esta unidad: P177B10585U/u);
  const mercaeleva = accreditedSourceRecord("mercaeleva-original", "M208-7097");
  assert.match(resolveVerifiedEditorialUnitContext(mercaeleva, general, mercaeleva) ?? "",
    /Referencia comercial declarada por el vendedor: MER0939/u);
  assert.equal(resolveVerifiedEditorialUnitContext(mercaeleva, general,
    { ...mercaeleva, specs: { ...mercaeleva.specs, "Artículo No.": "OTRO" } }), general);
});

test("RE028 permite unidades compatibles nuevas y bloquea datos propios de otra unidad", () => {
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

test("RE028 el contexto de una unidad GAM nueva llega a la preparación sin copiar la anterior", () => {
  const original = accreditedSourceRecord("gam-original", "6682");
  const next: ProductRecord = {
    ...original,
    reference: "6682-NUEVA",
    url: original.url.replace("/6682-", "/6682-NUEVA-"),
    location: "Madrid",
    serialNumber: "SERIE98765",
    specs: { ...original.specs, Ubicación: "Madrid", "Nº de serie": "SERIE98765" }
  };
  const general = prepareSourceProduct(next).product.description_general ?? "";
  assert.match(general, /Ubicación declarada para esta unidad: Madrid/u);
  assert.match(general, /Número de serie declarado para esta unidad: SERIE98765/u);
  assert.doesNotMatch(general, /TARRAGONA|P177B10585U/u);
});

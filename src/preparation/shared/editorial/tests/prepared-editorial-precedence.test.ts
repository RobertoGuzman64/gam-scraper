import assert from "node:assert/strict";
import test from "node:test";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolvePreparedEditorial } from "../mapping/prepared-editorial.js";
import { captureSourceEditorialEvidence } from "../mapping/source-editorial-evidence.js";
import { controlledGomarizPlatform } from "./editorial-contract-records.js";

test("la precedencia editorial compone desde hechos y no depende del tamaño del catálogo", () => {
  const source = controlledGomarizPlatform();
  const snapshot = JSON.stringify(source);
  const shared = resolveReusableEditorial(source);
  const mapped = resolvePreparedEditorial(source, source, captureSourceEditorialEvidence(source));
  assert.equal(resolveEditorialFacts(source)?.family, "plataforma-tijera");
  assert.equal(mapped.preparedShort, shared.short);
  assert.ok(mapped.preparedLong?.startsWith(shared.general ?? "SIN GENERAL"));
  assert.match(mapped.preparedShort ?? "", /altura de trabajo de 10 m/u);
  assert.equal(JSON.stringify(source), snapshot);
});

test("una unidad equivalente reutiliza composición sin reutilizar contenido firmado de otra unidad", () => {
  const source = controlledGomarizPlatform();
  const equivalent = { ...source, reference: "CONTROL-OTRA", url: "https://www.gomarizrent.com/producto/otra-marca-modelo10/" };
  const original = resolvePreparedEditorial(source, source, captureSourceEditorialEvidence(source));
  const other = resolvePreparedEditorial(equivalent, equivalent, captureSourceEditorialEvidence(equivalent));
  assert.equal(other.preparedShort, original.preparedShort);
  assert.equal(other.preparedLong, original.preparedLong);
  assert.equal(prepareSourceProduct(equivalent).product.description, prepareSourceProduct(source).product.description);
});

test("los conflictos de identidad, origen, energía y magnitud se rechazan", () => {
  const source = controlledGomarizPlatform();
  const invalid = [
    { ...source, providerId: "gam" },
    { ...source, url: "https://example.invalid/producto/marca-modelo10/" },
    { ...source, model: "MODELO11" },
    { ...source, specs: { ...source.specs, Marca: "DISTINTA" } },
    { ...source, specs: { ...source.specs, "Altura de trabajo": "10 kg" } },
    { ...source, specs: { ...source.specs, Motor: "Diésel" } },
    { ...source, specs: { ...source.specs, Capacidad: "450 litros" } }
  ];
  for (const [index, candidate] of invalid.entries()) {
    assert.equal(resolveEditorialFacts(candidate), null, String(index));
    assert.deepEqual(resolveReusableEditorial(candidate), { short: null, general: null }, String(index));
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveSourceEditorialClaims } from "../domain/editorial-source-claims.js";
import { cleanAuthenticatedSourceEditorial } from "../domain/editorial-text-hygiene.js";
import {
  controlledGamForklift, controlledGomarizPlatform, controlledMercaelevaPlatform
} from "./editorial-contract-records.js";

const general = "La ficha técnica declara características de la máquina anunciada.";

const platform = (record: ProductRecord): ProductRecord => ({
  ...record,
  longDescription: "Las tijeras eléctricas tienen plataforma extensible y ruedas antihuellas. Pueden incorporar estabilizadores según configuración."
});

test("las características de familia son reutilizables entre proveedores sin atribuir equipamiento a una unidad", () => {
  for (const sample of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const record = platform(sample);
    const before = JSON.stringify(record);
    const result = resolveSourceEditorialClaims(record, record, general) ?? "";
    assert.match(result, /plataforma extensible/u);
    assert.match(result, /ruedas antihuellas/u);
    assert.match(result, /su presencia y configuración deben comprobarse para esta unidad/u);
    assert.doesNotMatch(result, /estabilizadores/u);
    assert.equal(JSON.stringify(record), before);
  }
});

test("la procedencia, la familia y las contradicciones impiden extrapolar características", () => {
  const original = platform(controlledGomarizPlatform());
  for (const changed of [
    { ...original, providerId: "gam" },
    { ...original, reference: "OTRA-REFERENCIA" },
    { ...original, url: "https://www.gomarizrent.com/producto/otra-variacion/" },
    { ...original, model: "OTRA-VARIANTE" },
    { ...original, condition: "Nuevo" as const }
  ]) assert.equal(resolveSourceEditorialClaims(original, changed, general), general);

  const ambiguous = { ...original, longDescription: "Se pueden equipar ruedas antihuellas como opción y plataforma extensible según la versión." };
  assert.equal(resolveSourceEditorialClaims(ambiguous, ambiguous, general), general);
  const negated = { ...original, longDescription: "No incluye plataforma extensible ni ruedas antihuellas." };
  assert.equal(resolveSourceEditorialClaims(negated, negated, general), general);
  const conflictingMotor = { ...original, longDescription: "Las tijeras diésel tienen plataforma extensible y ruedas antihuellas." };
  assert.equal(resolveSourceEditorialClaims(conflictingMotor, conflictingMotor, general), general);
});

test("la fuente respalda otras características de limpieza y manutención en el dominio común", () => {
  const forklift: ProductRecord = {
    ...controlledGamForklift(),
    longDescription: "La carretilla incorpora desplazamiento lateral de horquillas."
  };
  assert.match(resolveSourceEditorialClaims(forklift, forklift, general) ?? "", /desplazamiento lateral/u);
  assert.equal(resolveSourceEditorialClaims(forklift, forklift,
    `${general} El desplazamiento lateral está documentado.`),
  `${general} El desplazamiento lateral está documentado.`);

  const sweeper: ProductRecord = {
    ...controlledGamForklift(),
    title: "Barredora MARCA MODELO10",
    categoryName: "Barredoras industriales",
    url: "https://online.gamrentals.com/es/barredoras-industriales/CONTROL-03-barredora",
    longDescription: "La barredora incluye control de polvo y filtro HEPA, con conductor sentado.",
    specs: { Marca: "MARCA", Modelo: "MODELO10", "Anchura limpieza": "1,2 m" }
  };
  const report = resolveSourceEditorialClaims(sweeper, sweeper, general) ?? "";
  assert.match(report, /control de polvo/u);
  assert.match(report, /filtración HEPA/u);
  assert.match(report, /operario sentado/u);
});

test("la preparación reutiliza las características con sus límites sin añadir texto si hay conocimiento firmado", () => {
  const record = platform(controlledGomarizPlatform());
  const result = prepareSourceProduct(record).product.description_general ?? "";
  assert.match(result, /plataforma extensible/u);
  assert.match(result, /deben comprobarse para esta unidad/u);
  const other: ProductRecord = { ...record, reference: "CONTROL-OTRA", model: "MODELO11", title: "Plataforma de tijera eléctrica MARCA MODELO11" };
  assert.doesNotMatch(prepareSourceProduct({ ...other, longDescription: null }).product.description_general ?? "", /ruedas antihuellas/u);
});

test("las introducciones conversacionales son higienizadas con identidad acreditada, sin afectar contenido ajeno", () => {
  const text = `Claro. La plataforma de tijera MARCA MODELO10 declara las prestaciones de la ficha técnica para trabajos de acceso en altura y mantenimiento industrial.`;
  const source = { ...controlledGomarizPlatform(), longDescription: text };
  const cleaned = cleanAuthenticatedSourceEditorial(source, null, text);
  assert.equal(cleaned.general, text.slice("Claro. ".length));
  assert.equal(cleanAuthenticatedSourceEditorial(source, null, "Claro. Información genérica.").general,
    "Claro. Información genérica.");
  assert.equal(cleanAuthenticatedSourceEditorial({ ...source, title: "Equipo distinto" }, null, text).general, text);
});

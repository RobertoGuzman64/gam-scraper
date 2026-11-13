import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { restoreCorroboratedEditorialIdentity } from "../domain/editorial-crossed-identity.js";
import { controlledGamForklift, controlledGomarizForklift } from "./editorial-contract-records.js";

const crossed = (base: ProductRecord): ProductRecord => ({
  ...base,
  title: "Carretilla elevadora ANTIGUA X3000",
  shortDescription: "➨ ANTIGUA X3000 Segunda Mano ➨ Carretilla elevadora de 2500 kg",
  longDescription: "La carretilla elevadora MARCA MODELO10 está identificada en la ficha técnica con capacidad de carga de 2500 kg.",
  specs: { ...base.specs, Marca: "MARCA", Modelo: "MODELO10", "Capacidad de carga (kg)": "2500 kg" }
});

test("la identidad cruzada se recupera desde hechos acreditados, sin depender de la referencia", () => {
  const source = crossed({ ...controlledGamForklift(), url: "https://online.gamrentals.com/es/carretillas/CONTROL-03-marca-modelo10" });
  const fixed = restoreCorroboratedEditorialIdentity(source, source.title, source.shortDescription);
  assert.equal(fixed?.title, "Carretilla elevadora MARCA MODELO10");
  assert.match(fixed?.short ?? "", /MARCA MODELO10/u);
  assert.match(fixed?.short ?? "", /2\.500 kg/u);
  const prepared = prepareSourceProduct(source).product;
  assert.equal(prepared.title, fixed?.title);
  assert.equal(prepared.description, fixed?.short);
  assert.equal(prepared.spec["Capacidad de carga (kg)"], "2500 kg");
  const other = { ...source, reference: "CONTROL-07", url: "https://online.gamrentals.com/es/carretillas/CONTROL-07-carretilla-elevadora-marca-modelo10" };
  assert.equal(restoreCorroboratedEditorialIdentity(other, other.title, other.shortDescription)?.title, fixed?.title);
});

test("el mismo contrato protege otro proveedor y variantes con resumen o título correcto", () => {
  const original = crossed({ ...controlledGomarizForklift(), url: "https://www.gomarizrent.com/producto/marca-modelo10/" });
  const fixed = restoreCorroboratedEditorialIdentity(original, original.title, original.shortDescription);
  assert.equal(fixed?.title, "Carretilla elevadora MARCA MODELO10");
  assert.equal(restoreCorroboratedEditorialIdentity(original, fixed?.title ?? null, original.shortDescription)?.short, fixed?.short);
  assert.equal(restoreCorroboratedEditorialIdentity(original, original.title, "➨ MARCA MODELO10 Segunda Mano ➨ Carretilla elevadora de 2500 kg")?.title, fixed?.title);
});

test("conserva familia, energía y magnitudes al sustituir únicamente el modelo incorrecto", () => {
  const source = crossed({ ...controlledGamForklift(), url: "https://online.gamrentals.com/es/carretillas/CONTROL-03-marca-modelo10" });
  const originalTitle = "Carretilla elevadora diésel 2500 kg MARCA MODELO20";
  const correctSummary = "➨ MARCA MODELO10 Segunda Mano ➨ Carretilla de 2500 kg";
  const fixed = restoreCorroboratedEditorialIdentity(source, originalTitle, correctSummary);
  assert.equal(fixed?.title, "Carretilla elevadora diésel 2500 kg MARCA MODELO10");
  assert.equal(fixed?.short, null);
  assert.equal(restoreCorroboratedEditorialIdentity(source, fixed?.title ?? null, correctSummary), null);
});

test("las contradicciones, variantes, identidad no probada y fuentes ajenas no se corrigen", () => {
  const original = crossed({ ...controlledGamForklift(), url: "https://online.gamrentals.com/es/carretillas/CONTROL-03-marca-modelo10" });
  for (const changed of [
    { ...original, providerId: "otro" },
    { ...original, url: "https://otro.example/es/carretillas/CONTROL-03-marca-modelo10" },
    { ...original, url: original.url + "?variante=2" },
    { ...original, model: "MODELO11" },
    { ...original, specs: { ...original.specs, Modelo: "MODELO11" } },
    { ...original, longDescription: "La carretilla elevadora ANTIGUA X3000 está disponible." },
    { ...original, longDescription: `${original.longDescription} La ANTIGUA X3000 utiliza otra configuración.` },
    { ...original, shortDescription: "➨ OTRA X4000 Segunda Mano ➨ Carretilla elevadora de 2500 kg" },
    { ...original, title: "Plataforma articulada ANTIGUA X3000" },
    { ...original, specs: { ...original.specs, "Capacidad de carga (kg)": "2500 m" } }
  ]) assert.equal(restoreCorroboratedEditorialIdentity(changed, changed.title, changed.shortDescription), null);
});

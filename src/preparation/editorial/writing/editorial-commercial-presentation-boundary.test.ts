import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../prepare-product.js";
import { resolveSourcedScrubberShort } from "./editorial-sourced-concise-short.js";
import { normalizePreparedEditorialPresentation } from "./prepared-editorial-presentation.js";
import { prepareCommercialEditorialInputs } from "../../../commercial/projection/editorial-inputs.js";
import { projectCommercialPresentation } from "../../../commercial/projection/presentation-projection.js";
import {
  controlledGamForklift,
  controlledGomarizPlatform,
  controlledMercaelevaPlatform
} from "../core/editorial-contract-records.js";

const gamCapacitySource = (): ProductRecord => {
  const source = controlledGamForklift();
  return {
    ...source,
    shortDescription: "Carretilla elevadora MARCA MODELO10 con capacidad de carga de 2500 kg.",
    specs: { ...source.specs, Marca: "MARCA", Modelo: "MODELO10" }
  };
};

test("la proyección conserva los textos preparados en los tres proveedores", () => {
  for (const source of [gamCapacitySource(), controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const product = prepareSourceProduct(source).product;
    const projection = projectCommercialPresentation(source, product, null);
    for (const key of ["title", "description_title", "description", "description_general"] as const) {
      assert.equal(projection[key], product[key], `${source.providerId}:${key}`);
    }
    assert.deepEqual(normalizePreparedEditorialPresentation(source, product), product);
  }
});

test("las publicaciones antiguas se normalizan en memoria sin reescribir la entrada", () => {
  const source = gamCapacitySource();
  const mapped = prepareSourceProduct(source);
  const published = {
    ...mapped.product,
    title: "Compra Carretilla elevadora MARCA MODELO10 2500 kg | GAM Online",
    description_title: "Compra Carretilla elevadora MARCA MODELO10 2500 kg | GAM Online"
  };
  const input = { source, published, mapped };
  const snapshot = JSON.stringify(input);
  const editorial = prepareCommercialEditorialInputs([input]);
  assert.equal(editorial.length, 1);
  const projected = projectCommercialPresentation(source, editorial[0]!.published, null);
  assert.equal(projected.title, "Carretilla elevadora MARCA MODELO10 2500 kg");
  assert.equal(projected.description_title, projected.title);
  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(projectCommercialPresentation(source, published, null).title, published.title);
});

test("una capacidad contradictoria se corrige por evidencia y no por referencia", () => {
  const source = gamCapacitySource();
  const published = {
    ...prepareSourceProduct(source).product,
    title: "Carretilla elevadora MARCA MODELO10 3500 kg",
    description_title: "Carretilla elevadora MARCA MODELO10 3500 kg"
  };
  const output = normalizePreparedEditorialPresentation(source, published);
  assert.equal(output.title, "Carretilla elevadora MARCA MODELO10 2500 kg");
  assert.equal(output.description_title, output.title);
  const unsafe = { ...source, shortDescription: "Capacidad de carga de 3500 kg" };
  assert.equal(normalizePreparedEditorialPresentation(unsafe, published).title, published.title);
  assert.throws(() => normalizePreparedEditorialPresentation(
    { ...source, url: `${source.url}?otra=1` }, published
  ), /Identidad editorial discordante/u);
});

test("la descripción corta recupera la configuración de una fregadora cuando la identidad y las medidas se corroboran", () => {
  const source: ProductRecord = { ...controlledGamForklift(), brand: null, model: "MODELO10", condition: "Nuevo",
    categoryKey: "limpieza-fregadoras", categoryName: "Fregadoras industriales nuevas",
    url: "https://online.gamrentals.com/es/fregadoras/CONTROL-03-fregadora-conductor-sentado-marca-modelo10",
    title: "Fregadora MARCA MODELO10", shortDescription: "➨ MARCA MODELO10 Nueva ➨ Venta fregadora conductor sentado",
    longDescription: "La MARCA MODELO10 es una fregadora de operario a bordo.",
    specs: { Modelo: "MODELO10", Longitud: "1800 mm", Peso: "800 KG" } };
  const current = "MARCA MODELO10 Nueva. Venta fregadora conductor sentado";
  const prepared = { ...prepareSourceProduct(source).product, title: source.title, description: current,
    spec: { Modelo: "MODELO10", Longitud: "1800 mm", Peso: "800 kg" } };
  const result = resolveSourcedScrubberShort(source, prepared, current);
  assert.equal(result, "Fregadora MARCA MODELO10 nueva, de conductor sentado, con longitud declarada de 1,8 m y peso de 800 kg.");
  const normalized = normalizePreparedEditorialPresentation(source, prepared);
  assert.equal(normalized.description, result);
  assert.deepEqual(normalizePreparedEditorialPresentation(source, normalized), normalized);
  assert.equal(normalized.description_general, prepared.description_general);
  assert.deepEqual(normalized.spec, prepared.spec);
  for (const candidate of [{ ...source, brand: "OTRA" }, { ...source, model: "OTRO" },
    { ...source, url: "https://example.invalid/fregadora-conductor-sentado-marca-modelo10" },
    { ...source, longDescription: "La MARCA MODELO10 es de operario acompañante." },
    { ...source, specs: { ...source.specs, Longitud: "1900 mm" } }]) {
    assert.equal(resolveSourcedScrubberShort(candidate, prepared, current), null);
  }
  assert.equal(resolveSourcedScrubberShort(source, { ...prepared, reference: "OTRA" }, current), null);
  assert.equal(resolveSourcedScrubberShort(source, { ...prepared, title: "Fregadora MARCA OTRO" }, current), null);
  assert.equal(resolveSourcedScrubberShort(source, prepared, "Texto ya revisado."), null);
});

import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { normalizePreparedEditorialPresentation } from "../mapping/prepared-editorial-presentation.js";
import { prepareCommercialEditorialInputs } from "../../../../commercial/projection/editorial-inputs.js";
import { projectCommercialPresentation } from "../../../../commercial/projection/presentation-projection.js";
import {
  controlledGamForklift,
  controlledGomarizPlatform,
  controlledMercaelevaPlatform
} from "./editorial-contract-records.js";

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

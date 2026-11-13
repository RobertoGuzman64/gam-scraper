import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { normalizePreparedEditorialPresentation } from "../mapping/prepared-editorial-presentation.js";
import { prepareCommercialEditorialInputs } from "../../../../commercial/projection/editorial-inputs.js";
import { projectCommercialPresentation } from "../../../../commercial/projection/presentation-projection.js";

const original = (provider: string, reference: string): ProductRecord => {
  if (provider === "gam") return accreditedSourceRecord("gam-original", reference);
  if (provider === "gomariz") return accreditedSourceRecord("gomariz-original", reference);
  if (provider === "mercaeleva") return accreditedSourceRecord("mercaeleva-original", reference);
  throw new Error(`Proveedor desconocido: ${provider}`);
};

test("la proyección no vuelve a escribir el título, corta ni general del preparador", () => {
  for (const [providerId, reference] of [
    ["gam", "6837"], ["gam", "6909"], ["gam", "6607"],
    ["gomariz", "TE1589"], ["mercaeleva", "M855-6850"]
  ] as const) {
    const source = original(providerId, reference);
    const product = prepareSourceProduct(source).product;
    const projection = projectCommercialPresentation(source, product, null);
    for (const key of ["title", "description_title", "description", "description_general"] as const) {
      assert.equal(projection[key], product[key], `${providerId}:${reference}:${key}`);
    }
    assert.deepEqual(normalizePreparedEditorialPresentation(source, product), product);
  }
});

test("las publicaciones antiguas se normalizan en memoria antes de proyectarse, sin modificar la entrada", () => {
  const source = original("gam", "6607");
  const published = { ...prepareSourceProduct(source).product,
    title: "Compra Plataforma articulada diésel 16M GENIE Z45/25J | GAM Online",
    description_title: "Compra Plataforma articulada diésel 16M GENIE Z45/25J | GAM Online" };
  const input = { source, published, mapped: prepareSourceProduct(source) };
  const snapshot = JSON.stringify(input);
  const editorial = prepareCommercialEditorialInputs([input]);
  assert.equal(editorial.length, 1);
  const projected = projectCommercialPresentation(source, editorial[0]!.published, null);
  assert.equal(projected.title, "Plataforma articulada diésel 16 m GENIE Z45/25J");
  assert.equal(projected.description_title, projected.title);
  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(projectCommercialPresentation(source, published, null).title, published.title);
});

test("la capacidad se valida por magnitud y procedencia, no por referencia histórica", () => {
  const source = original("gam", "6837");
  const newUnit: ProductRecord = { ...source, reference: "ERP25VL-OTRA-UNIDAD",
    url: "https://example.org/carro/erp25vl-otra-unidad" };
  const published = { ...prepareSourceProduct(source).product,
    reference: newUnit.reference, sourceUrl: newUnit.url,
    title: "Carretilla elevadora eléctrica 3500 kg YALE ERP25VL",
    description_title: "Carretilla elevadora eléctrica 3500 kg YALE ERP25VL" };
  const output = normalizePreparedEditorialPresentation(newUnit, published);
  assert.equal(output.title, "Carretilla elevadora eléctrica 2500 kg YALE ERP25VL");
  assert.equal(output.description_title, output.title);
  const unsafe = { ...newUnit, shortDescription: "Capacidad de carga de 3500 kg" };
  assert.equal(normalizePreparedEditorialPresentation(unsafe, published).title,
    "Carretilla elevadora eléctrica 3500 kg YALE ERP25VL");
  assert.throws(() => normalizePreparedEditorialPresentation({ ...newUnit, url: `${newUnit.url}?otro=1` }, published),
    /Identidad editorial discordante/u);
});

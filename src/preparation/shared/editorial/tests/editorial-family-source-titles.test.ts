import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveDocumentedFamilyTitle } from "../domain/editorial-documented-title.js";
import { editorialFamilyOf } from "../domain/editorial-families.js";
import { resolvePreparedEditorialTitle } from "../mapping/prepared-editorial-title.js";
import { controlledGomarizPlatform, controlledMercaelevaForklift } from "./editorial-contract-records.js";

const gomarizFamily = (
  familyPath: string, brand: string, model: string, general: string
): ProductRecord => ({
  ...controlledGomarizPlatform(),
  url: `https://www.gomarizrent.com/venta/${familyPath}/${brand.toLocaleLowerCase("es")}-${model.toLocaleLowerCase("es")}/`,
  title: `${brand} ${model}`,
  brand,
  model,
  longDescription: general,
  specs: { Marca: brand, Modelo: model }
});

const families = [
  {
    path: "elevacion-y-trabajos-en-altura/oruga",
    name: "Plataforma sobre orugas",
    text: "La plataforma sobre orugas MARCA MODELO10 permite acceder a terrenos irregulares."
  },
  {
    path: "energia-electrica-e-iluminacion/generador",
    name: "Grupo electrógeno",
    text: "El grupo electrógeno MARCA MODELO10 abastece de energía a instalaciones aisladas."
  },
  {
    path: "energia-electrica-e-iluminacion/torre-de-luz",
    name: "Torre de iluminación",
    text: "La torre de iluminación MARCA MODELO10 permite iluminar zonas de trabajo."
  }
] as const;

test("las familias documentadas por el proveedor se resuelven en el dominio editorial común", () => {
  for (const family of families) {
    const source = gomarizFamily(family.path, "MARCA", "MODELO10", family.text);
    const expected = `${family.name} MARCA MODELO10`;
    assert.equal(resolveDocumentedFamilyTitle(source), expected);
    assert.equal(resolvePreparedEditorialTitle(source, source), expected);
    assert.equal(prepareSourceProduct(source).product.title, expected);
    if (family.name === "Plataforma sobre orugas") {
      const sourceProse = { ...source, longDescription:
        "La Oruga MARCA MODELO10 es una plataforma elevadora todoterreno para terrenos difíciles gracias a sus orugas." };
      assert.equal(resolveDocumentedFamilyTitle(sourceProse), expected);
    }
    const next = {
      ...source,
      reference: "NUEVA-UNIDAD",
      model: "MODELO11",
      title: "MARCA MODELO11",
      url: source.url.replace("modelo10", "modelo11"),
      longDescription: source.longDescription?.replace("MODELO10", "MODELO11") ?? null,
      specs: { Marca: "MARCA", Modelo: "MODELO11" }
    };
    assert.equal(resolvePreparedEditorialTitle(next, next), `${family.name} MARCA MODELO11`);
  }
});

test("el dominio no inventa familia ante procedencias, identidades o descripciones contradictorias", () => {
  for (const family of families) {
    const source = gomarizFamily(family.path, "MARCA", "MODELO10", family.text);
    for (const changed of [
      { ...source, providerId: "gam" },
      { ...source, url: source.url.replace("gomarizrent.com", "example.invalid") },
      { ...source, title: "MARCA MODELO11" },
      { ...source, model: "MODELO11" },
      { ...source, specs: { ...source.specs, Marca: "OTRA" } },
      { ...source, longDescription: "La carretilla elevadora MARCA MODELO10 sirve para transportar palés." },
      { ...source, longDescription: null }
    ]) {
      assert.equal(resolveDocumentedFamilyTitle(changed), null);
    }
  }
});

test("la mención de orugas no transforma una tijera en otra familia", () => {
  assert.equal(editorialFamilyOf("Plataforma de tijera eléctrica orugas de 8 m"), "plataforma-tijera");
});

test("la descripción compartida de manutención reutiliza hechos acreditados sin un narrador de origen", () => {
  const source = controlledMercaelevaForklift();
  const baseline = prepareSourceProduct(source);
  assert.match(baseline.product.description ?? "", /MARCA MODELO10/u);
  assert.match(baseline.product.description_general ?? "", /MARCA MODELO10/u);
  assert.equal(baseline.product.sourceUrl, source.url);
  const variant = { ...source, reference: "CONTROL-OTRA", url: source.url.replace("CONTROL-04", "CONTROL-OTRA") };
  const prepared = prepareSourceProduct(variant);
  assert.equal(prepared.product.description, baseline.product.description);
  assert.equal(prepared.product.description_general, baseline.product.description_general);
  assert.equal(prepared.product.reference, variant.reference);
});

test("la descripción común rechaza identidad contradictoria y no publica datos no acreditados", () => {
  const source = controlledMercaelevaForklift();
  for (const invalid of [
    { ...source, model: "MODELO11" },
    { ...source, brand: "OTRA" },
    { ...source, url: "https://example.invalid/for-sale/machine/CONTROL-04" },
    { ...source, specs: { ...source.specs, "Capacidad máxima de elevación": "2000 litros" } }
  ]) {
    const result = prepareSourceProduct(invalid);
    assert.ok(result.status === "review" || result.product.description_general === null);
  }
});

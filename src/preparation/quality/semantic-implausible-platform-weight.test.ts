import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../contracts/catalog.js";
import { loadImportCatalog } from "../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { prepareSourceProduct, prepareWithCatalog } from "../prepare-product.js";
import { canOmitImplausiblePlatformWeight, sourceSemanticQualityIssues } from "./semantic-quality.js";
import { resolveAttribute } from "../classification/attribute-mapping.js";
import type { Attribute } from "../classification/attribute-types.js";

test("el motor omite el peso opcional inverosímil sin perder la evidencia ni alterar la fuente", async () => {
  const platform: ProductRecord = {
    providerId: "manain",
    categoryKey: "venta",
    categoryName: "Maquinaria en venta",
    url: "https://manain.com/producto/venta-elevacion-brazo-articulado-equiptest-tx1/",
    title: "TX1",
    shortDescription: null,
    longDescription: null,
    price: null,
    condition: "Segunda mano",
    reference: "PRUEBA-TX1",
    brand: "EQUIPTEST",
    model: "TX1",
    year: "2021",
    location: null,
    country: null,
    horometer: "500",
    serialNumber: null,
    image: "https://manain.com/imagen-tx1.jpg",
    specs: {
      Marca: "EQUIPTEST", Modelo: "TX1", Motor: "Diésel", "Nueva o usada": "usada",
      "Altura trabajo": "15 m", "Capacidad carga": "230 kg", Peso: "10 kg"
    }
  };
  const before = JSON.stringify(platform);
  const rejected = prepareSourceProduct(platform);
  assert.equal(rejected.status, "ready");
  assert.deepEqual(rejected.issues, []);
  assert.ok(sourceSemanticQualityIssues(platform).some((issue) => /Peso técnicamente inverosímil/u.test(issue)));
  assert.match(rejected.product.description_general ?? "", /altura de trabajo de 15 m/u);
  assert.doesNotMatch(rejected.product.description_general ?? "", /peso declarado de 10 kg/u);
  assert.equal(rejected.product.spec.Peso, undefined);
  assert.equal(JSON.stringify(platform), before);
  const catalog = await loadImportCatalog();
  const mapped = prepareWithCatalog(platform, catalog);
  assert.equal(mapped.status, "ready");
  assert.deepEqual(mapped.importIssues?.createMany, []);
  assert.ok(mapped.product.categorySellID !== null);
  const weightDefinition = catalog.attributes.find((entry) => entry.name === "Peso");
  assert.ok(weightDefinition);
  const relation = { categoryID: mapped.product.categorySellID, attributeID: weightDefinition.id };
  const relations = [...catalog.relations.filter((entry) => entry.categoryID !== relation.categoryID ||
    entry.attributeID !== relation.attributeID), relation];
  const withOptionalWeight = { ...catalog, relations, attributes: catalog.attributes.map((entry) =>
    entry.id === weightDefinition.id ? { ...entry, required: false } : entry) };
  const optional = prepareWithCatalog(platform, withOptionalWeight);
  assert.equal(optional.status, "ready");
  assert.ok(!optional.product.attributes.some((entry) => entry.attributeID === weightDefinition.id));
  const required = prepareWithCatalog(platform, { ...withOptionalWeight, attributes: withOptionalWeight.attributes.map((entry) =>
    entry.id === weightDefinition.id ? { ...entry, required: true } : entry) });
  assert.equal(required.status, "review");
  assert.ok(required.importIssues?.createMany.includes("Atributo obligatorio ausente: Peso"));
  for (const unsafe of [
    { ...platform, image: null },
    { ...platform, specs: { ...platform.specs, "Peso operativo": "900 kg" } },
    { ...platform, specs: { ...platform.specs, "Capacidad carga": "230/250 kg" } },
    { ...platform, shortDescription: "Peso declarado de 10 kg" }
  ]) assert.equal(prepareSourceProduct(unsafe).status, "review");
  const safeProduct = rejected.product;
  const editorialSource = { ...platform, specs: { ...platform.specs, "Capacidad de carga": "230 kg" } };
  assert.equal(canOmitImplausiblePlatformWeight(platform, editorialSource, safeProduct, null), true);
  for (const unsafeProduct of [
    { ...safeProduct, spec: { ...safeProduct.spec, "Peso (kg)": "10 kg" } },
    { ...safeProduct, spec: { ...safeProduct.spec, Observaciones: "Peso declarado de 10 kg" } },
    { ...safeProduct, description_general: "Peso declarado de 10 kg" }
  ]) assert.equal(canOmitImplausiblePlatformWeight(platform, editorialSource, unsafeProduct, null), false);
  const supported: ProductRecord = { ...platform, specs: { ...platform.specs, Peso: "1200 kg" } };
  const accepted = prepareSourceProduct(supported);
  assert.deepEqual(sourceSemanticQualityIssues(supported), []);
  assert.equal(accepted.status, "ready");
  assert.equal(accepted.product.spec.Peso, "1200 kg");
  assert.match(accepted.product.description_general ?? "", /peso declarado de 1\.200 kg/u);
  const invalidOrigin: ProductRecord = { ...platform, providerId: "gam" };
  assert.deepEqual(sourceSemanticQualityIssues(invalidOrigin), []);
  const gamSource: ProductRecord = {
    ...platform,
    providerId: "gam",
    categoryKey: "elevacion",
    title: "EQUIPTEST TX1 | Plataforma articulada diésel",
    reference: "1234",
    specs: { ...platform.specs, "Capacidad de carga (kg)": "230 kg", "Altura de trabajo": "15 m" },
    url: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-diesel-segunda-mano/1234-equiptest-tx1"
  };
  assert.ok(sourceSemanticQualityIssues(gamSource).some((issue) => /Peso técnicamente inverosímil/u.test(issue)));
  assert.equal(prepareSourceProduct(gamSource).product.spec.Peso, undefined);
  assert.equal(prepareSourceProduct(gamSource).status, "review");
  const gomarizSource: ProductRecord = {
    ...platform, providerId: "gomariz", title: "EQUIPTEST TX1 Plataforma articulada",
    url: "https://www.gomarizrent.com/elevacion-y-trabajos-en-altura/brazo-articulado/equiptest-tx1/",
    image: "https://www.gomarizrent.com/imagen-tx1.jpg",
    specs: { Marca: "EQUIPTEST", Modelo: "TX1", Motor: "Diésel", "Altura de trabajo": "15 m", Capacidad: "230 kg", Peso: "10 kg" }
  };
  assert.ok(sourceSemanticQualityIssues(gomarizSource).some((issue) => /Peso técnicamente inverosímil/u.test(issue)));
  const gomarizPrepared = prepareSourceProduct(gomarizSource);
  assert.equal(gomarizPrepared.status, "ready");
  assert.equal(gomarizPrepared.product.spec.Peso, undefined);
  assert.equal(prepareSourceProduct({ ...gomarizSource, specs: { ...gomarizSource.specs,
    "Altura plataforma": "16 m" } }).status, "review");
  assert.deepEqual(sourceSemanticQualityIssues({ ...gamSource, specs: { ...gamSource.specs, Peso: "1.200 kg" } }), []);
  const weightAttributes: readonly Attribute[] = [
    { name: "Peso", type: "NUMBER", unit_option: "kg" },
    { name: "Peso operativo", type: "NUMBER", unit_option: "kg" }
  ];
  for (const attribute of weightAttributes) {
    assert.deepEqual(resolveAttribute(platform, attribute), { status: "rejected", value: null });
    assert.deepEqual(resolveAttribute(gamSource, attribute), { status: "rejected", value: null });
    assert.deepEqual(resolveAttribute(supported, attribute), { status: "resolved", value: 1200 });
    assert.deepEqual(resolveAttribute(invalidOrigin, attribute), { status: "resolved", value: 10 });
    assert.deepEqual(resolveAttribute({ ...platform, specs: { ...platform.specs, Peso: "kg" } }, attribute),
      { status: "not_observed", value: null });
  }
  assert.deepEqual(resolveAttribute(platform, { name: "Altura de trabajo", type: "DECIMAL", unit_option: "m" }),
    { status: "resolved", value: 15 });
  assert.equal(JSON.stringify(platform), before);
});

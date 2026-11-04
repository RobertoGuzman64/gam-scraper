import assert from "node:assert/strict";
import test from "node:test";
import { loadImportCatalog } from "../../../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { resolveAttributeValue } from "../../../../mapping/attribute-mapping.js";
import { prepareCached } from "../../../cross-cutting/support/prepare-cached.js";
import { recoverGomarizSourceYearSpec } from "../../../../mapping/providers/gomariz/source-year-spec.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { recoverGomarizDocumentedResidualDensitySpecs } from "../../../../evidence/providers/gomariz/documented-density-residual.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { recoverGomarizDocumentedDensity180Specs } from "../../../../evidence/providers/gomariz/documented-density-180.js";
import type { ProductRecord, SpecsMap } from "../../../../../../contracts/catalog.js";

const catalog = await loadImportCatalog();
const source = (section: string, family: string, specs: SpecsMap): ProductRecord => ({
  providerId: "gomariz", categoryKey: "venta", categoryName: "Maquinaria de ocasión",
  url: `https://www.gomarizrent.com/venta/${section}/${family}/ficha/`,
  title: "Máquina de ocasión", reference: "TEST", shortDescription: null, longDescription: null,
  price: null, brand: null, model: null, year: null, location: null, country: null,
  horometer: null, serialNumber: null, image: null, specs
});
const value = (record: ProductRecord, name: string): string | number | boolean | null => {
  const attribute = catalog.attributes.find((item) => item.name === name);
  assert.ok(attribute);
  return resolveAttributeValue(record, attribute);
};
const energy = "energia-electrica-e-iluminacion";
const lifts = "elevacion-y-trabajos-en-altura";

test("Gomariz: recupera depósito en litros publicado en generadores sin confundir carga", () => {
  const generator = source(energy, "generador", { Capacidad: "350 l", Motor: "Diésel" });
  assert.equal(value(generator, "Capacidad del depósito"), 350);
  assert.equal(value(source(energy, "generador", { Capacidad: "1.200 litros" }), "Capacidad del depósito"), 1200);
  assert.equal(value(source(energy, "generador", { Capacidad: "350 kg" }), "Capacidad del depósito"), null);
  assert.equal(value(source(energy, "generador", { Capacidad: "350 l / 500 l" }), "Capacidad del depósito"), null);
  assert.equal(value(source(energy, "generador", { Capacidad: "0 l" }), "Capacidad del depósito"), null);
  assert.equal(value(source(energy, "generador", { Capacidad: "350 l", "Capacidad del depósito": "350 l" }), "Capacidad del depósito"), 350);
  assert.equal(value(source(energy, "generador", { "Capacidad del depósito": "350 litros" }), "Capacidad del depósito"), 350);
  assert.equal(value(source(energy, "generador", { Capacidad: "350 l", "Capacidad del depósito": "400 l" }), "Capacidad del depósito"), null);
  assert.equal(value(source(energy, "torre-de-luz", { Capacidad: "350 l" }), "Capacidad del depósito"), null);
  assert.equal(value(source("manipulacion-de-materiales", "manipulador-telescopico", { Capacidad: "350 l" }), "Capacidad del depósito"), null);
  assert.equal(value({ ...generator, providerId: "gam" }, "Capacidad del depósito"), null);
  assert.equal(value({ ...generator, url: generator.url.replace("gomarizrent.com", "proveedor.example") }, "Capacidad del depósito"), null);
  assert.equal(value({ ...generator, url: generator.url.replace("energia-electrica-e-iluminacion", "limpieza") }, "Capacidad del depósito"), null);
  assert.equal(value(generator, "Capacidad máxima"), null);
});

test("Gomariz: bloquea altura de plataforma contradictoria en datos ya almacenados", () => {
  const truck = source(lifts, "camion-plataforma", {
    "Altura plataforma": "3.07 m", "Altura de trabajo": "20 m", "Altura almacenaje": "3.07 m"
  });
  assert.equal(value(truck, "Altura de plataforma"), null);
  assert.equal(value(truck, "Altura de trabajo"), 20);
  assert.equal(value(source(lifts, "camion-plataforma", {
    "Altura plataforma": "15.7 m", "Altura de trabajo": "17.7 m", "Altura almacenaje": "2.94 m"
  }), "Altura de plataforma"), 15.7);
  assert.equal(value(source(lifts, "elevador-tijera", {
    "Altura plataforma": "14.30 m", "Altura de trabajo": "6.30 m"
  }), "Altura de plataforma"), null);
  assert.equal(value(source(lifts, "elevador-tijera", {
    "Altura plataforma": "4.30 m", "Altura de trabajo": "6.30 m"
  }), "Altura de plataforma"), 4.3);
  assert.equal(value(source(lifts, "elevador-mastil-vertical", {
    "Altura plataforma": "1.99 m", "Altura de trabajo": "4.50 m", "Altura almacenaje": "1.99 m"
  }), "Altura de plataforma"), 1.99);
  assert.equal(value({ ...truck, providerId: "mercaeleva" }, "Altura de plataforma"), 3.07);
  assert.equal(value(source("manipulacion-de-materiales", "manipulador-telescopico", {
    "Altura de trabajo": "13.8 m", "Alcance lateral": "9.25 m", Capacidad: "4000 kg"
  }), "Altura máxima de elevación"), null);
});

test("Gomariz: conserva y rechaza especificaciones con valores múltiples incompatibles", () => {
  const generator = source(energy, "generador", {
    Motor: ["Diésel", "Eléctrico"], Capacidad: ["350 l", "400 l"]
  });
  assert.equal(value(generator, "Combustible"), null);
  assert.equal(value(generator, "Capacidad del depósito"), null);
  const prepared = prepareCached(generator, catalog);
  assert.ok(prepared.issues.includes("Atributo rechazado por seguridad: Capacidad del depósito"));
  assert.equal(prepared.product.attributes.some((item) => item.value === 350 || item.value === 400), false);
});



test("Gomariz: traslada el año explícito de la ficha a spec sin alterar los originales", async () => {
  const source = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
  const records = source.products.filter((record) => record.year !== null);
  assert.ok(records.length > 0);
  for (const record of records) {
    assert.ok(record.year);
    const before = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec["Año de fabricación"], record.year, record.reference ?? "");
    assert.deepEqual(prepared.product.spec, recoverGomarizDocumentedResidualDensitySpecs(record, recoverGomarizDocumentedDensity180Specs(record, { ...record.specs, "Año de fabricación": record.year })));
    assert.equal(JSON.stringify(record), before);
  }
  for (const record of source.products.filter((item) => item.year === null)) {
    assert.equal(prepareSourceProduct(record).product.spec["Año de fabricación"], undefined);
  }
});

test("Gomariz: conserva años existentes y rechaza proveedores, fuentes y fechas sin acreditar", () => {
  const record: ProductRecord = {
    ...source(energy, "generador", { Potencia: "125 kVA" }),
    title: "PRAMAC GPW125", reference: "GR1356", year: "2022", yearSource: "ficha", condition: "Segunda mano"
  };
  const original = record.specs ?? {};
  assert.deepEqual(recoverGomarizSourceYearSpec(record, original), { ...original, "Año de fabricación": "2022" });
  const invalid: readonly ProductRecord[] = [
    { ...record, providerId: "gam" },
    { ...record, categoryKey: "alquiler" },
    { ...record, reference: null },
    { ...record, title: null },
    { ...record, condition: "Nuevo" },
    { ...record, year: "2022/2023" },
    { ...record, year: "1890" },
    { ...record, year: null },
    { ...record, yearSource: "url" },
    { ...record, yearSource: "descripcion" },
    { ...record, url: record.url.replace("gomarizrent.com", "example.com") },
    { ...record, url: record.url.replace("https:", "http:") },
    { ...record, url: "https://www.gomarizrent.com/venta/ficha" }
  ];
  for (const item of invalid) assert.strictEqual(recoverGomarizSourceYearSpec(item, original), original);
  for (const key of ["Año", "Año de fabricación", "Ano de fabricacion"]) {
    const specs = { ...original, [key]: "2019" };
    assert.strictEqual(recoverGomarizSourceYearSpec(record, specs), specs);
  }
  assert.deepEqual(original, { Potencia: "125 kVA" });
});

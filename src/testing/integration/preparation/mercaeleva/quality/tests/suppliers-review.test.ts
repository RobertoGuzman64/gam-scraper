import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { loadImportCatalog } from "../../../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveAttribute } from "../../../../../../preparation/shared/classification/mapping/attribute-mapping.js";
import { prepareCached } from "../../../../../../preparation/testing/prepare-cached.js";
import { mercaelevaMislabelledCapacity } from "../../../../../../preparation/mercaeleva/technical/evidence/handling-evidence.js";

const catalog = await loadImportCatalog();
const gomariz = (await readCanonicalCatalog(fileURLToPath(new URL(
  "../../../../../../../src/testing/fixtures/gomariz/scrape-gomariz-catalog.json", import.meta.url
)))).products;
const mercaeleva = (await readCanonicalCatalog(fileURLToPath(new URL(
  "../../../../../../../src/testing/fixtures/mercaeleva/scrape-mercaeleva-catalog.json", import.meta.url
)))).products;
const toyota = mercaeleva.find((record) => record.reference === "M433-5206");
if (!toyota) throw new Error("Falta M433-5206");
const capacity = catalog.attributes.find((attribute) => attribute.name === "Capacidad de carga");
if (!capacity) throw new Error("Falta Capacidad de carga");

test("Toyota recupera capacidad respaldada por tres textos y corrige la especificación preparada", () => {
  assert.equal(mercaelevaMislabelledCapacity(toyota), true);
  assert.equal(toyota.specs?.["Capacidad máxima de elevación"], "4700 kg");
  assert.equal(resolveAttribute(toyota, capacity).status, "resolved");
  assert.equal(resolveAttribute(toyota, capacity).value, 1800);
  const prepared = prepareCached(toyota, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.ok(prepared.product.attributes.some((attribute) =>
    attribute.attributeID === capacity.id && attribute.value === 1800));
  assert.equal(prepared.product.spec["Capacidad máxima de elevación"], "1800 kg");
});

test("descarta el reconocimiento ante unidades, capacidades, alturas, identidad o origen incompatibles", () => {
  const source = toyota;
  const changed: readonly ProductRecord[] = [
    { ...source, url: source.url.replace("sales.mercaeleva.com", "proveedor-falso.com") },
    { ...source, providerId: "gomariz" },
    { ...source, title: (source.title ?? "").replace("1800 KG", "2000 KG") },
    { ...source, longDescription: source.longDescription?.replace("1800 KG", "1900 KG") ?? null },
    { ...source, longDescription: source.longDescription?.replace("4.700mm", "4.800mm") ?? null },
    { ...source, longDescription: source.longDescription?.replace("4.700mm", "4.700 m") ?? null },
    { ...source, longDescription: source.longDescription?.replace("1800 KG", "1800 KG o 2000 KG") ?? null },
    { ...source, longDescription: null },
    { ...source, model: "02-7FD20" },
    { ...source, brand: "Otra marca" },
    { ...source, shortDescription: "CARRETILLA 2000 KG" },
    { ...source, specs: { ...source.specs, "Título adicional": "CARRETILLA ELEVADORA DIESEL 2000 KG" } },
    { ...source, specs: { ...source.specs, "Capacidad máxima de elevación": "4800 kg" } },
    { ...source, specs: { ...source.specs, "Capacidad máxima de elevación": ["4700 kg", "1800 kg"] } },
    { ...source, specs: { ...source.specs, "Altura máxima de elevación": "4800 mm" } }
  ];
  for (const record of changed) {
    assert.equal(mercaelevaMislabelledCapacity(record), false, JSON.stringify(record));
  }
});

test("conserva contradicciones técnicas y confirma los tipos documentados", () => {
  for (const product of gomariz) {
    const result = prepareCached(product, catalog);
    assert.deepEqual(result.issues, ["Cobertura editorial insuficiente: descripción corta"]);
    assert.equal(result.status, "review");
  }
  for (const product of mercaeleva) {
    const result = prepareCached(product, catalog);
    if (result.status === "ready") assert.deepEqual(result.issues, []);
    else assert.ok(result.issues.every((issue) => issue === "Descripción comercial contradictoria: altura de trabajo" ||
      issue === "Cobertura editorial insuficiente: descripción general"));
  }
  for (const id of ["5051BDX", "1011JFB", "RE454", "PV556"]) {
    const record = gomariz.find((item) => item.reference === id);
    assert.ok(record);
    const result = prepareCached(record, catalog);
    assert.equal(result.status, "review");
    assert.deepEqual(result.issues, ["Cobertura editorial insuficiente: descripción corta"]);
    assert.ok(!result.issues.includes("Tipo de máquina de origen sin confirmar"));
  }
  const linde = mercaeleva.find((item) => item.reference === "M827-8304");
  assert.ok(linde);
  const preparedLinde = prepareCached(linde, catalog);
  assert.equal(preparedLinde.status, "ready");
  assert.deepEqual(preparedLinde.issues, []);
  assert.equal(preparedLinde.product.spec["Capacidad máxima de elevación"], "4800 kg");
  assert.equal(preparedLinde.product.spec["Tipo de mástil"], "Dúplex/estándar");
  const corroborated = mercaeleva.find((item) => item.reference === "M104-0836");
  assert.ok(corroborated);
  assert.equal(prepareCached(corroborated, catalog).status, "ready");
  for (const id of ["M294-4678", "M958-0132"]) {
    const record = mercaeleva.find((item) => item.reference === id);
    assert.ok(record);
    assert.equal(prepareCached(record, catalog).status, "ready");
    assert.equal(prepareCached(record, catalog).product.condition, "Segunda_Mano");
  }
  const height = mercaeleva.find((record) => record.reference === "M486-0114");
  assert.ok(height);
  const assessedHeight = prepareCached(height, catalog);
  assert.equal(assessedHeight.status, "review");
  assert.ok(assessedHeight.issues.includes("Descripción comercial contradictoria: altura de trabajo"));
});

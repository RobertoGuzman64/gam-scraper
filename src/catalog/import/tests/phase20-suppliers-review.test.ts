import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { prepareCached } from "./prepare-cached.js";
import { mercaelevaMislabelledCapacity } from "../mapping/providers/mercaeleva/handling-evidence.js";

const catalog = await loadImportCatalog();
const loadProducts = async (provider: "gomariz" | "mercaeleva"): Promise<readonly ProductRecord[]> => {
  const url = new URL(`../../../../storage/scraped/${provider}/scrape-${provider}-catalog.json`, import.meta.url);
  const data: unknown = JSON.parse(await readFile(url, "utf8"));
  if (typeof data !== "object" || data === null || !("products" in data) || !Array.isArray(data.products)) {
    throw new Error(`Catálogo no disponible: ${provider}`);
  }
  return data.products;
};
const gomariz = await loadProducts("gomariz");
const mercaeleva = await loadProducts("mercaeleva");
const toyota = mercaeleva.find((record) => record.reference === "M433-5206");
if (!toyota) throw new Error("Falta M433-5206");
const capacity = catalog.attributes.find((attribute) => attribute.name === "Capacidad de carga");
if (!capacity) throw new Error("Falta Capacidad de carga");

test("Fase 20: Toyota recupera capacidad respaldada por tres textos y conserva la especificación original", () => {
  assert.equal(mercaelevaMislabelledCapacity(toyota), true);
  assert.equal(toyota.specs?.["Capacidad máxima de elevación"], "4700 kg");
  assert.equal(resolveAttribute(toyota, capacity).status, "resolved");
  assert.equal(resolveAttribute(toyota, capacity).value, 1800);
  const prepared = prepareCached(toyota, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.ok(prepared.product.attributes.some((attribute) =>
    attribute.attributeID === capacity.id && attribute.value === 1800));
  assert.equal(prepared.product.spec["Capacidad máxima de elevación"], "4700 kg");
});

test("Fase 20: descarta el reconocimiento ante unidades, capacidades, alturas, identidad o origen incompatibles", () => {
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

test("Fase 3: conserva contradicciones técnicas y confirma los tipos documentados", () => {
  assert.equal(gomariz.filter((record) => prepareCached(record, catalog).status === "review").length, 0);
  assert.equal(mercaeleva.filter((record) => prepareCached(record, catalog).status === "review").length, 1);
  for (const id of ["5051BDX", "1011JFB", "RE454", "PV556"]) {
    const record = gomariz.find((item) => item.reference === id);
    assert.ok(record);
    assert.equal(prepareCached(record, catalog).status, "ready");
    assert.ok(!prepareCached(record, catalog).issues.includes("Tipo de máquina de origen sin confirmar"));
  }
  for (const id of ["M827-8304"]) {
    const record = mercaeleva.find((item) => item.reference === id);
    assert.ok(record);
    assert.ok(prepareCached(record, catalog).issues.includes("Atributo contradictorio: Capacidad de carga"));
  }
  const conflicting = mercaeleva.find((item) => item.reference === "M827-8304");
  assert.ok(conflicting);
  assert.ok(prepareCached(conflicting, catalog).issues.includes("Atributo contradictorio: Tipo de mástil"));
  const corroborated = mercaeleva.find((item) => item.reference === "M104-0836");
  assert.ok(corroborated);
  assert.equal(prepareCached(corroborated, catalog).status, "ready");
  for (const id of ["M294-4678", "M958-0132"]) {
    const record = mercaeleva.find((item) => item.reference === id);
    assert.ok(record);
    assert.equal(prepareCached(record, catalog).status, "ready");
    assert.equal(prepareCached(record, catalog).product.condition, null);
  }
  const height = mercaeleva.find((record) => record.reference === "M486-0114");
  assert.ok(height);
  assert.equal(prepareCached(height, catalog).status, "ready");
});

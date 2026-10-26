import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { resolveCategory } from "../mapping/category-mapping.js";
import { resolveAttributeValue } from "../mapping/attribute-mapping.js";
import { prepareCached } from "./prepare-cached.js";

const catalog = await loadImportCatalog();
const gomariz = (await readCanonicalCatalog(fileURLToPath(new URL(
  "../../../../src/testing/fixtures/gomariz/scrape-gomariz-catalog.json", import.meta.url
)))).products;
const mercaeleva = (await readCanonicalCatalog(fileURLToPath(new URL(
  "../../../../src/testing/fixtures/mercaeleva/scrape-mercaeleva-catalog.json", import.meta.url
)))).products;
const gomarizByReference = new Map(gomariz.map((record) => [record.reference, record]));
const mercaelevaByReference = new Map(mercaeleva.map((record) => [record.reference, record]));
const heightAttribute = catalog.attributes.find((item) => item.name === "Altura de plataforma");
if (!heightAttribute) throw new Error("Falta altura de plataforma");

const reference = (map: Map<string | null | undefined, ProductRecord>, id: string): ProductRecord => {
  const result = map.get(id);
  if (!result) throw new Error(`No existe ${id}`);
  return result;
};

test("SOCAGE 20D SPEED recupera 17,6 m acreditados por la ficha técnica de Gomariz", () => {
  for (const id of ["CC1535", "CC1666"]) {
    const record = reference(gomarizByReference, id);
    assert.equal(resolveAttributeValue(record, heightAttribute), 17.6);
    const prepared = prepareCached(record, catalog);
    assert.equal(prepared.status, "ready");
    assert.equal(record.specs?.["Altura plataforma"], "3.07 m");
    assert.equal(record.specs?.["Altura almacenaje"], "3.07 m");
    assert.equal(record.specs?.["Altura de trabajo"], "20 m");
  }
});

test("SOCAGE no extiende altura técnica a otra variante ni modifica una fuente contradictoria", () => {
  const record = reference(gomarizByReference, "CC1535");
  const changed: readonly ProductRecord[] = [
    { ...record, providerId: "mercaeleva" },
    { ...record, model: "FORSTE 24D" },
    { ...record, url: record.url.replace("gomarizrent.com", "falsogomarizrent.com") },
    { ...record, url: record.url.replace("camion-plataforma", "brazo-articulado") },
    { ...record, specs: { ...record.specs, "Altura de trabajo": "18 m" } },
    { ...record, specs: { ...record.specs, Capacidad: "300 kg" } },
    { ...record, specs: { ...record.specs, "Altura almacenaje": "2.90 m" } }
  ];
  for (const item of changed) {
    assert.notEqual(resolveAttributeValue(item, heightAttribute), 17.6, item.url);
  }
});

test("JLG 340AJ usa evidencia diésel del proveedor sin deducir alimentación para otros modelos", () => {
  for (const id of ["BA1522", "BA1358"]) {
    const record = reference(gomarizByReference, id);
    assert.equal(resolveCategory(record, catalog.categories, "Segunda_Mano")?.slug,
      "plataformas-articuladas-diesel-segunda-mano");
    assert.equal(prepareCached(record, catalog).status, "ready");
    assert.equal(record.specs?.Motor, undefined);
    assert.equal(resolveCategory({ ...record, model: "450AJ" }, catalog.categories, "Segunda_Mano"), null);
    assert.equal(resolveCategory({ ...record, longDescription: null }, catalog.categories, "Segunda_Mano"), null);
    assert.equal(resolveCategory({ ...record, specs: { Motor: "Gasolina" } }, catalog.categories, "Segunda_Mano"), null);
    assert.equal(resolveCategory({ ...record, url: record.url.replace("gomarizrent.com", "otro-sitio.com") },
      catalog.categories, "Segunda_Mano"), null);
  }
});

test("Mercaeleva conserva el conflicto de M827 y resuelve el mástil MER0624", () => {
  assert.equal(mercaeleva.filter((record) => prepareCached(record, catalog).status === "review").length, 1);
  for (const id of ["M827-8304"]) {
    assert.ok(prepareCached(reference(mercaelevaByReference, id), catalog).issues.includes("Atributo contradictorio: Capacidad de carga"));
  }
  assert.ok(prepareCached(reference(mercaelevaByReference, "M827-8304"), catalog).issues.includes("Atributo contradictorio: Tipo de mástil"));
  assert.equal(prepareCached(reference(mercaelevaByReference, "M104-0836"), catalog).status, "ready");
  assert.equal(prepareCached(reference(mercaelevaByReference, "M486-0114"), catalog).status, "ready");
  assert.equal(prepareCached(reference(mercaelevaByReference, "M818-7811"), catalog).status, "ready");
  for (const id of ["M294-4678", "M958-0132"]) {
    const prepared = prepareCached(reference(mercaelevaByReference, id), catalog);
    assert.equal(prepared.status, "ready");
    assert.equal(prepared.product.condition, null);
  }
});

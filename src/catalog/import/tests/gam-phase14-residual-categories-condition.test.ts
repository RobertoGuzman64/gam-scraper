import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { prepareCached } from "./prepare-cached.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog(fileURLToPath(new URL(
  "../../../../storage/scraped/gam/scrape-gam-marzo-2026-catalog.json", import.meta.url
)));
const reference = (code: string): ProductRecord => {
  const record = source.products.find((product) => product.reference === code);
  assert.ok(record, code);
  return record;
};
const categorySlug = (record: ProductRecord): string | null => {
  const prepared = prepareCached(record, catalog);
  return catalog.categories.find((category) => category.id === prepared.product.categorySellID)?.slug ?? null;
};

test("GAM: los cuatriciclos no pasan a furgonetas aunque solo consten en la descripción larga", () => {
  for (const code of ["5918", "6806"]) {
    const record = reference(code);
    assert.equal(categorySlug(record), null, code);
    assert.equal(categorySlug({ ...record, shortDescription: "Vehículo eléctrico de ocasión" }), null, code);
    assert.equal(categorySlug({ ...record, shortDescription: null }), null, code);
    const prepared = prepareCached(record, catalog);
    assert.equal(prepared.status, "review", code);
    assert.ok(prepared.issues.includes("Categoría Equipzilla sin correspondencia inequívoca"), code);
  }
});

test("GAM: un título que dice segunda mano contradice una condición nueva sin asignar ocasión", () => {
  for (const code of ["8", "171"]) {
    const record = reference(code);
    assert.equal(record.condition, "Nuevo", code);
    const prepared = prepareCached(record, catalog);
    assert.equal(prepared.product.condition, null, code);
    assert.equal(prepared.status, "review", code);
    assert.ok(prepared.issues.includes("Condición comercial contradictoria entre la ficha y el origen"), code);
    assert.equal(prepareCached({ ...record, title: "Equipo nuevo" }, catalog).product.condition, "Nuevo", code);
  }
});

test("GAM: categorías residuales sin equivalencia siguen en review", () => {
  for (const code of [
    "5918", "6806", "6969", "6970", "6971", "6987", "6988", "6989", "6358", "6367", "6814", "6815",
    "5710", "6623", "5254", "6217", "6688", "6689", "6690", "4019", "4020", "4021", "4022",
    "220", "221", "227", "6653", "171"
  ]) {
    const prepared = prepareCached(reference(code), catalog);
    assert.equal(categorySlug(reference(code)), null, code);
    assert.equal(prepared.status, "review", code);
    assert.ok(prepared.issues.includes("Categoría Equipzilla sin correspondencia inequívoca"), code);
  }
});

test("GAM: las diez condiciones sin confirmación continúan sin asignarse", () => {
  for (const code of ["6358", "6367", "6814", "6815", "6969", "6970", "6971", "6987", "6988", "6989"]) {
    const prepared = prepareCached(reference(code), catalog);
    assert.equal(prepared.product.condition, null, code);
    assert.ok(prepared.issues.includes("Condición comercial no confirmada (Nuevo o Segunda_Mano)"), code);
  }
});

test("GAM: el contraste residual conserva la recuperación de la fase 1", () => {
  const prepared = prepareCached(reference("2172"), catalog);
  assert.equal(categorySlug(reference("2172")), "carretilla-elevadora-diesel");
  assert.equal(prepared.status, "ready");
});

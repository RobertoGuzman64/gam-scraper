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

test("GAM: Logitrans manual acreditada en LogiQ y WSP, no por batería de balanza", () => {
  for (const code of ["238", "239"]) {
    const record = reference(code);
    const prepared = prepareCached(record, catalog);
    assert.equal(categorySlug(record), "transpaleta-manual", code);
    assert.equal(prepared.status, code === "238" ? "ready" : "review", code);
    if (code === "239") {
      assert.ok(prepared.issues.includes("Atributo rechazado por seguridad: Capacidad de carga"));
    }
    assert.equal(categorySlug({ ...record, brand: null }), null, code);
    assert.equal(categorySlug({ ...record, specs: { ...record.specs, Modelo: "Modelo distinto" } }), null, code);
    assert.equal(categorySlug({ ...record, longDescription: "Transpaleta con documentación insuficiente" }), null, code);
    assert.equal(categorySlug({ ...record, specs: { ...record.specs, "Tipo motor": "Eléctrico" } }), null, code);
    assert.equal(categorySlug({ ...record, url: record.url.replace("transpaletas-logitrans", "transpaletas-hyster") }), null, code);
  }
});

test("GAM: Sprint TL eleva un ocupante, exige modelo, marca y ficha coincidentes", () => {
  const record = reference("157");
  assert.equal(categorySlug(record), "plataforma-unipersonal-electrica");
  assert.equal(prepareCached(record, catalog).status, "ready");
  assert.equal(categorySlug({ ...record, brand: "OTRA" }), null);
  assert.equal(categorySlug({ ...record, specs: { ...record.specs, Modelo: "LUI 460" } }), null);
  assert.equal(categorySlug({ ...record, specs: { ...record.specs, "Tipo motor": "Diésel" } }), null);
  assert.equal(categorySlug({ ...record, longDescription: "Plataforma elevadora sin modelo documentado" }), null);
  assert.equal(categorySlug({ ...record, url: record.url.replace("plataformas-elevadoras-neumaticos-bravi", "plataformas-elevadoras-bravi") }), null);
});

test("GAM: Lui 460 y CTE carecen de equivalencia, sin bloquear un tipo acreditado", () => {
  for (const code of ["2159", "6874", "6873", "6953", "6954"]) {
    const record = reference(code);
    assert.equal(categorySlug(record), null, code);
    const prepared = prepareCached(record, catalog);
    assert.equal(prepared.status, "ready", code);
    assert.ok(prepared.importIssues?.createMany.some((issue) => issue.startsWith("Categoría no ")), code);
    assert.ok(!prepared.issues.includes("Tipo de máquina de origen sin confirmar"), code);
  }
});

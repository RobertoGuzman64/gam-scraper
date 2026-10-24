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

test("Bravi Leonardo HD: identifica plataforma unipersonal con evidencia del mismo modelo", () => {
  const record = reference("2155");
  assert.equal(categorySlug(record), "plataforma-unipersonal-electrica");
  assert.equal(prepareCached(record, catalog).status, "ready");
  assert.equal(categorySlug({ ...record, specs: { ...record.specs, Modelo: "Lui 460" } }), null);
  assert.equal(categorySlug({ ...record, longDescription: "Plataforma elevadora para trabajos en altura" }), null);
  assert.equal(categorySlug({ ...record, specs: { ...record.specs, "Tipo motor": "Diésel" } }), null);
  assert.equal(categorySlug({ ...record, title: "Plataforma elevadora Bravi Lui 460" }), null);
  assert.equal(categorySlug({ ...record, categoryKey: "carretillas-nuevas" }), null);
  assert.equal(categorySlug(reference("2159")), null);
  assert.equal(categorySlug(reference("157")), "plataforma-unipersonal-electrica");
});

test("Yale MP20XV: modelo, plataforma y batería deben corresponder a la misma ficha", () => {
  const record = reference("912");
  assert.equal(categorySlug(record), "transpaleta-electrica");
  assert.equal(prepareCached(record, catalog).status, "ready");
  assert.equal(categorySlug({ ...record, specs: { ...record.specs, Modelo: "MP20XD" } }), null);
  assert.equal(categorySlug({ ...record, specs: { ...record.specs, "Capacidad de la batería": "Desconocida" } }), null);
  assert.equal(categorySlug({ ...record, specs: { ...record.specs, Motorización: "Manual" } }), null);
  assert.equal(categorySlug({ ...record, shortDescription: "Transpaleta Yale para almacenes" }), null);
  assert.equal(categorySlug({ ...record, longDescription: "Transpaleta para almacenes" }), null);
  assert.equal(categorySlug({ ...record, condition: "Segunda mano" }), null);
  assert.equal(categorySlug(reference("239")), "transpaleta-manual");
  assert.equal(categorySlug(reference("238")), "transpaleta-manual");
});

test("GAM: condición de ocasión explícita en ficha de barredora, sin fabricar categoría de destino", () => {
  const record = reference("6653");
  const prepared = prepareCached(record, catalog);
  assert.equal(prepared.product.condition, "Segunda_Mano");
  assert.equal(prepared.product.categorySellID, null);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.ok(prepared.importIssues?.createMany.some((issue) => issue.startsWith("Categoría no ")));
  assert.equal(prepareCached({ ...record, shortDescription: "Barredora EUREKA MAGNUM en venta" }, catalog).product.condition, null);
  assert.equal(prepareCached({ ...record, shortDescription: "EUREKA MAGNUM de segunda mano en venta nueva" }, catalog).product.condition, null);
  assert.equal(prepareCached({ ...record, specs: { ...record.specs, Modelo: "Otro modelo" } }, catalog).product.condition, null);
  assert.equal(prepareCached({ ...record, condition: "Nuevo" }, catalog).product.condition, null);
  for (const code of ["6358", "6367", "6814", "6815", "6969", "6970", "6971", "6987", "6988", "6989"]) {
    assert.equal(prepareCached(reference(code), catalog).product.condition, null, code);
  }
});

test("GAM: categorías sin equivalente siguen sin forzarse a otra familia", () => {
  for (const code of ["3425", "3426", "1884", "3309", "6182", "3312", "4778", "6874", "4019", "4020", "4021", "4022", "2134", "2135"]) {
    assert.equal(categorySlug(reference(code)), null, code);
  }
});


test("GAM Hyster H9XDL6: recupera diésel solo con evidencia completa del modelo", () => {
  const record = reference("2172");
  const prepared = prepareCached(record, catalog);
  assert.equal(categorySlug(record), "carretilla-elevadora-diesel");
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.equal(categorySlug({ ...record, specs: { ...record.specs, Modelo: "H9.0FT" } }), null);
  assert.equal(categorySlug({ ...record, specs: { ...record.specs, "Tipo motor": "GLP" } }), null);
  assert.equal(categorySlug({ ...record, specs: { ...record.specs, Motorización: "Eléctrico" } }), null);
  assert.equal(categorySlug({ ...record, longDescription: "La Hyster H9XDL6 está disponible en versiones diésel y GLP" }), null);
  assert.equal(categorySlug({ ...record, longDescription: "Motor diésel Cummins QSB6.7 para Hyster H9.0FT" }), null);
  assert.equal(categorySlug({ ...record, shortDescription: "Carretilla de gran capacidad Hyster" }), null);
  assert.equal(categorySlug({ ...record, title: "Carretilla elevadora Hyster H9.0FT" }), null);
  assert.equal(categorySlug({ ...record, categoryKey: "marcas-nuevas" }), null);
  assert.equal(categorySlug({ ...record, condition: "Segunda mano" }), null);
  assert.equal(categorySlug({ ...record, url: record.url.replace("carretillas-elevadoras-diesel-hyster", "carretillas-elevadoras-electricas-hyster") }), null);
  assert.equal(categorySlug({ ...record, providerId: "gomariz" }), null);
});

test("GAM: familias acreditadas y alternativas de motor contrastadas, demás conflictos bloqueados", () => {
  assert.equal(categorySlug(reference("2314")), "carretilla-elevadora-diesel");
  for (const code of ["2134", "2135", "2373", "2364", "3425", "3436", "3312", "6182", "1884", "3309", "5", "8", "2312", "4778", "6874", "6953"]) {
    const record = reference(code);
    const prepared = prepareCached(record, catalog);
    assert.equal(categorySlug(record), code === "2312" ? "carretilla-elevadora-glp" : null, code);
    if (code === "2312") {
      assert.equal(prepared.status, "ready", code);
      continue;
    }
    if (["2134", "2135", "2373", "2364", "5", "8", "4778", "3425", "3436", "3312", "6182", "1884", "3309", "6874", "6953"].includes(code)) {
      assert.equal(prepared.status, "ready", code);
      assert.ok(prepared.importIssues?.createMany.some((issue) => issue.startsWith("Categoría no ")), code);
    } else {
      assert.ok(prepared.issues.includes("Tipo de máquina de origen sin confirmar") ||
        prepared.issues.some((issue) => issue.startsWith("Atributo ")) ||
        prepared.issues.some((issue) => issue.startsWith("Condición comercial")), code);
    }
  }
});

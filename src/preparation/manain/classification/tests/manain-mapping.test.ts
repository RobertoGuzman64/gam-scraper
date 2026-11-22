import assert from "node:assert/strict";
import test from "node:test";
import type { ManainStocklistProduct } from "../../source/stocklist.js";
import { loadImportCatalog } from "../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { manainStocklistProductRecord } from "../../source/records.js";
import { manainSourceFamily } from "../../technical/evidence/source.js";
import { prepareProduct } from "../../../../commercial/legacy-export/prepare-product.js";
import { manainCategorySlug } from "../mapping/categories.js";

const catalog = await loadImportCatalog();

const examples: readonly { readonly source: ManainStocklistProduct; readonly category: string }[] = [
  { source: {
    referencia: "MA4075", familia: "AD-12 ARTICULADA DIESEL", marca: "HAULOTTE", modelo: "HA 120 PX",
    anio: 2015, horas: 2885, precio_eur: 24500, estado: "Usada", observaciones: null,
    foto: "05/26", url: "https://manain.com/?sku=MA4075", pagina_pdf: 1
  }, category: "plataformas-articuladas-diesel-segunda-mano" },
  { source: {
    referencia: "MAN2378", familia: "AE-11 ARTICULADA ELECTRICA", marca: "LGMG", modelo: "A09JE",
    anio: 2024, horas: 78, precio_eur: 32500, estado: "Usada", observaciones: null,
    foto: "05/26", url: "https://manain.com/?sku=MAN2378", pagina_pdf: 8
  }, category: "plataformas-articuladas-electricas-segunda-mano" },
  { source: {
    referencia: "MA3308", familia: "TD-12 TIJERA DIESEL", marca: "JLG", modelo: "3394RT",
    anio: 2012, horas: 1969, precio_eur: 19950, estado: "Usada", observaciones: null,
    foto: "11/26", url: "https://manain.com/?sku=MA3308", pagina_pdf: 31
  }, category: "plataformas-tijera-diesel-segunda-mano" },
  { source: {
    referencia: "MAN3220", familia: "TE-8 TIJERA ELECTRICA", marca: "SINOBOOM", modelo: "0608ME",
    anio: 2026, horas: 4, precio_eur: null, estado: "Usada", observaciones: null,
    foto: "NO", url: "https://manain.com/?sku=MAN3220", pagina_pdf: 38
  }, category: "plataformas-tijera-electricas-segunda-mano" }
];

const category = (id: number | null): string | null =>
  catalog.categories.find((item) => item.id === id)?.slug ?? null;

test("Manain clasifica referencias reales con familia documental, condición y energía acreditadas", () => {
  for (const entry of examples) {
    const original = manainStocklistProductRecord(entry.source);
    assert.ok(manainSourceFamily(original));
    const result = prepareProduct(original, catalog);
    assert.equal(category(result.product.categorySellID), entry.category, entry.source.referencia);
    assert.equal(result.status, "review");
  }
});

test("Manain no utiliza rutas web retiradas ni atribuye categorías a una identidad discordante", () => {
  const source = manainStocklistProductRecord(examples[0]!.source);
  assert.equal(manainSourceFamily({ ...source, url: "https://manain.com/producto/venta-elevacion-brazo-articulado-prueba/" }), null);
  assert.equal(manainSourceFamily({ ...source, url: "https://manain.com/?sku=OTRA" }), null);
  assert.equal(manainCategorySlug({ ...source, categoryKey: "familia no acreditada" }, "Segunda_Mano"), null);
});

test("Manain no acepta contradicciones técnicas o editoriales contra el documento", () => {
  const source = manainStocklistProductRecord(examples[0]!.source);
  assert.equal(manainCategorySlug({ ...source, specs: { Motor: "Eléctrico" } }, "Segunda_Mano"), null);
  assert.equal(manainCategorySlug({ ...source, shortDescription: "Plataforma de tijera diésel" }, "Segunda_Mano"), null);
});

import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { PreparedProduct } from "../../preparation/contracts.js";
import { decideCommercialCategory } from "../../commercial/category-decision.js";
import { analyzeCommercialCategories } from "../commercial-categories.js";

const source = (url: string, title: string, categoryKey = "maquinaria"): ProductRecord => ({
  providerId: "gam", categoryKey, categoryName: "Maquinaria", url, title,
  shortDescription: "Ficha", longDescription: "Ficha", price: null, reference: url.split("/").at(-1) ?? "",
  brand: null, model: null, year: null, location: null, country: null, condition: "Segunda mano",
  horometer: null, serialNumber: null, image: null, specs: {}
});

const prepared = (record: ProductRecord, categorySellID: number | null): PreparedProduct => ({
  status: "ready", issues: [],
  product: {
    providerId: "gam", sourceUrl: record.url, reference: record.reference, title: record.title,
    categorySellID, category: categorySellID === null ? null : "Plataformas",
    condition: "Segunda_Mano", price: null, description_title: record.title,
    description: record.shortDescription, description_general: record.longDescription,
    image: null, images: [], spec: {}, attributes: []
  }
});

test("solo excluye lotes y herramientas acreditados por rutas o familia, sin tocar el origen", () => {
  const lot = source("https://online.gamrentals.com/es/lotes/6971-lote-11", "Lote 11");
  const tool = source("https://proveedor.example/es/herramientas/llave-12", "Llave 12");
  const machinery = source("https://proveedor.example/es/plataformas/modelo", "Equipo con lote de repuestos");
  assert.deepEqual(decideCommercialCategory(lot, 29), { status: "excluded", reason: "lote", categorySellID: null });
  assert.deepEqual(decideCommercialCategory(tool, 29), { status: "excluded", reason: "herramienta", categorySellID: null });
  assert.deepEqual(decideCommercialCategory(machinery, 29), { status: "proposed", reason: null, categorySellID: 29 });
  assert.equal(decideCommercialCategory(source("https://proveedor.example/es/lotes-equipo/10", "Plataforma"), null).status, "pending");
  assert.equal(decideCommercialCategory(source("https://proveedor.example/es/maquinaria/lote-15", "Lote 15"), null).reason, "lote");
  assert.equal(decideCommercialCategory(source("https://proveedor.example/es/maquinaria/15", "Herramienta auxiliar"), null).status, "pending");
  assert.equal(lot.categoryKey, "maquinaria");
});

test("censo comercial cuenta exclusiones fuera del denominador y ofrece decisiones y muestras estables", () => {
  const records = [
    source("https://proveedor.example/es/lotes/1", "Lote 1"),
    source("https://proveedor.example/es/herramientas/2", "Taladro"),
    source("https://proveedor.example/es/elevacion/3", "Plataforma tres"),
    source("https://proveedor.example/es/elevacion/4", "Plataforma cuatro"),
    source("https://proveedor.example/es/elevacion/5", "Máquina sin familia")
  ];
  const report = analyzeCommercialCategories(records.map((record, index) => ({
    source: record, mapped: prepared(record, index === 2 || index === 3 ? 29 : null)
  })));
  assert.deepEqual([report.eligible, report.proposed, report.pending, report.excludedLots, report.excludedTools],
    [3, 2, 1, 1, 1]);
  assert.equal(report.categories.length, 1);
  assert.equal(report.categories[0]?.categorySellID, 29);
  assert.equal(report.categories[0]?.proposed, 2);
  assert.equal(report.categories[0]?.samples.length, 2);
  assert.equal(report.decisions.length, 5);
  assert.deepEqual(report.decisions.map((item) => item.status), ["proposed", "proposed", "pending", "excluded", "excluded"]);
  assert.deepEqual(report, analyzeCommercialCategories(records.map((record, index) => ({
    source: record, mapped: prepared(record, index === 2 || index === 3 ? 29 : null)
  }))));
});


test("diferencias de motorización original se señalan para revisión sin recategorizar automáticamente", () => {
  const record = source("https://proveedor.example/es/carretillas/2312", "Carretilla elevadora eléctrica");
  const mapped: PreparedProduct = {
    ...prepared(record, 16),
    product: { ...prepared(record, 16).product, category: "Carretillas Elevadoras GLP" }
  };
  const audit = analyzeCommercialCategories([{ source: record, mapped }]);
  assert.equal(audit.proposed, 1);
  assert.deepEqual(audit.precisionSignals, [{ reference: record.reference, sourceUrl: record.url,
    sourceTitle: record.title, mappedCategory: "Carretillas Elevadoras GLP",
    reason: "motorizacion-contradictoria-en-titulo-original" }]);
  assert.deepEqual(analyzeCommercialCategories([{ source: record,
    mapped: { ...mapped, product: { ...mapped.product, category: "Carretillas Elevadoras Eléctricas" } }
  }]).precisionSignals, []);
});

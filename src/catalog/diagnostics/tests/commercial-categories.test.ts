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


test("el título bruto no crea avisos sobre una categoría comercial", () => {
  const record = source("https://proveedor.example/es/carretillas/2312", "Carretilla elevadora eléctrica");
  const mapped: PreparedProduct = {
    ...prepared(record, 16),
    product: { ...prepared(record, 16).product, category: "Carretillas Elevadoras GLP" }
  };
  const audit = analyzeCommercialCategories([{ source: record, mapped }]);
  assert.equal(audit.proposed, 1);
  assert.equal(audit.decisions[0]?.status, "proposed");
});

test("excluye accesorios dependientes acreditados sin eliminar maquinaria por títulos genéricos", () => {
  const kit = {
    ...source("https://online.gamrentals.com/es/plataformas-elevadoras-bravi/2373-kit-sobre-elevacion-small-e-bravi",
      "KIT DE ELEVACIÓN BRAVI SMALL-E", "marcas-nuevas"),
    providerId: "gam", brand: "BRAVI", shortDescription: "Accesorio compatible con la plataforma Leonardo HD",
    longDescription: "Este accesorio se monta en el equipo principal"
  };
  assert.deepEqual(decideCommercialCategory(kit, null), {
    status: "excluded", reason: "accesorio", categorySellID: null
  });
  assert.equal(decideCommercialCategory({ ...kit, shortDescription: "", longDescription: "" }, null).status, "pending");
  assert.equal(decideCommercialCategory({ ...kit, title: "Plataforma eléctrica BRAVI" }, 29).status, "proposed");
  assert.equal(decideCommercialCategory({ ...kit, url: "https://online.gamrentals.com/es/otras-marcas/2373" }, null).status, "pending");
  const report = analyzeCommercialCategories([{ source: kit, mapped: prepared(kit, null) }]);
  assert.equal(report.eligible, 0);
  assert.equal(report.pending, 0);
  assert.equal(report.excludedAccessories, 1);
  assert.equal(report.excludedTools, 0);
  assert.equal(report.decisions[0]?.reason, "accesorio");
  const skyDeck = {
    ...kit, title: "SKY DECK", model: "SKY DECK", specs: { Marca: "BRAVI", Modelo: "SKY DECK" },
    shortDescription: "", longDescription: ""
  };
  assert.equal(decideCommercialCategory(skyDeck, null).reason, "accesorio");
  assert.equal(decideCommercialCategory({ ...skyDeck, specs: {} }, null).status, "pending");
});

test("excluye Solo-Gyps por identidad acreditada sin excluir otras plataformas Bravi", () => {
  const solo: ProductRecord = {
    ...source("https://online.gamrentals.com/es/bravi/2365-solo-gyps", "Bravi SOLO GYPS", "marcas-nuevas"),
    brand: "BRAVI", model: "SOLO GYPS", specs: { Marca: "BRAVI", Modelo: "SOLO GYPS" }
  };
  assert.deepEqual(decideCommercialCategory(solo, null), {
    status: "excluded", reason: "accesorio", categorySellID: null
  });
  assert.equal(decideCommercialCategory({ ...solo, model: "Lui 460" }, null).status, "pending");
  assert.equal(decideCommercialCategory({ ...solo, url: "https://online.gamrentals.com/es/otros/2365" }, null).status, "pending");
  assert.equal(decideCommercialCategory({ ...solo, specs: { Marca: "BRAVI" } }, null).status, "pending");
});

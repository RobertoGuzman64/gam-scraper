import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { prepareProduct } from "../preparation/prepare.js";

const catalog = await loadImportCatalog();

const machine = (
  parent: string, title: string, shortDescription: string, longDescription: string,
  specs: ProductRecord["specs"] = {}, condition: "Nuevo" | "Segunda mano" = "Nuevo",
  categoryKey = "marcas-nuevas"
): ProductRecord => ({
  providerId: "gam", categoryKey, categoryName: "Catálogo GAM",
  url: `https://online.gamrentals.com/es/${parent}/99999-maquina`,
  title, shortDescription, longDescription, specs, condition,
  price: null, reference: "99999", brand: null, model: null, year: null,
  location: null, country: null, horometer: null, serialNumber: null,
  image: null, images: []
});

const slug = (record: ProductRecord): string | null => {
  const result = prepareProduct(record, catalog);
  return catalog.categories.find((category) => category.id === result.product.categorySellID)?.slug ?? null;
};

test("Reach Stacker: requiere manipulación de contenedores expresamente documentada", () => {
  const source = machine("reachstacker-hyster", "Reach Stacker Hyster RS46-41XD/75S",
    "Venta de Reach Stacker Hyster", "Diseñado para el vaciado de contenedores y su manipulación");
  assert.equal(slug(source), "manipulador-de-contenedores");
  assert.equal(slug({ ...source, longDescription: "Equipo para manipulación de acero" }), null);
  assert.equal(slug({ ...source, title: "Carretilla elevadora Hyster" }), null);
  assert.equal(slug({ ...source, condition: null }), null);
});

test("GLP Hyster: cruza título, descripción y ficha sin aceptar contradicciones diésel", () => {
  const source = machine("carretillas-elevadoras-diesel-hyster", "Carretilla elevadora GLP Hyster H1.6A",
    "Venta de carretilla elevadora GLP", "La carretilla elevadora GLP Hyster H1.6A",
    { "Tipo motor": "GLP" }, "Nuevo", "carretillas-nuevas");
  assert.equal(slug(source), "carretilla-elevadora-glp");
  assert.equal(slug({ ...source, specs: { "Tipo motor": "Diésel" } }), null);
  assert.equal(slug({ ...source, shortDescription: "Venta de Carretilla Elevadora Diésel" }), null);
  assert.equal(slug({ ...source, longDescription: "La carretilla elevadora diésel" }), null);
  assert.equal(slug({ ...source, title: "Carretilla elevadora GLP o diésel Hyster" }), "carretilla-elevadora-diesel");
});

test("motorización eléctrica Hyster sin confundir variante ni degradar fichas ya mapeadas", () => {
  const source = machine("carretillas-elevadoras-electricas-hyster",
    "Carretilla elevadora contrapesada Hyster A1.5XNT", "Venta de carretilla eléctrica Hyster A1.5XNT",
    "La carretilla elevadora eléctrica Hyster A1.5XNT", {}, "Nuevo", "carretillas-nuevas");
  assert.equal(slug(source), "carretilla-elevadora-electrica");
  assert.equal(slug({ ...source, shortDescription: "Carretilla elevadora contrapesada" }), null);
  assert.equal(slug({ ...source, specs: { "Tipo motor": "Diésel" } }), null);
  assert.equal(slug({ ...source, title: "Carretilla elevadora eléctrica Hyster J1.6UT" }),
    "carretilla-elevadora-electrica");
});

test("familias específicas: microfregadora, tractor y plataforma unipersonal", () => {
  const cleaner = machine("tennant", "Microfregadora TENNANT FCA CS16",
    "Venta de fregadora industrial", "Máquina compacta de limpieza", {}, "Nuevo", "limpieza-fregadoras");
  assert.equal(slug(cleaner), "fregadora-industrial");
  assert.equal(slug({ ...cleaner, shortDescription: "Venta de barredora fregadora industrial" }), null);

  const tractor = machine("tractor-de-remolcado-conductor-sentado-7000-kg",
    "Tractor de arrastre de conductor a bordo 7000Kg Hyster T7.0HS3", "Tractor de arrastre",
    "Tractor para remolcar cargas", { "Tipo motor": "Eléctrico" });
  assert.equal(slug(tractor), "tractor-electrico");
  assert.equal(slug({ ...tractor, specs: {} }), null);

  const platform = machine("bravi", "Plataforma elevadora BRAVI Residential 170",
    "Venta de plataforma elevadora", "La BRAVI Residential es una plataforma unipersonal eléctrica",
    { "Tipo motor": "Eléctrico" });
  assert.equal(slug(platform), "plataforma-unipersonal-electrica");
  assert.equal(slug({ ...platform, longDescription: "Plataforma elevadora" }), null);
});

test("carretilla usada mal ubicada: exige tres señales eléctricas y evita conflictos", () => {
  const used = machine("carretillas-elevadoras-diesel-segunda-mano",
    "Carretilla elevadora eléctrica 5000Kg BT C4E500V",
    "Venta de carretilla frontal eléctrica de ocasión",
    "La BT C4E500V es una carretilla elevadora eléctrica", {}, "Segunda mano", "manutencion");
  assert.equal(slug(used), "carretillas-elevadoras-electricas-segunda-mano");
  assert.equal(slug({ ...used, shortDescription: "Carretilla de ocasión" }), null);
  assert.equal(slug({ ...used, specs: { "Tipo motor": "Diésel" } }), null);
  assert.equal(slug({ ...used, longDescription: "Carretilla diésel" }), null);
  assert.equal(slug({ ...used, condition: null }), null);
});

test("sin categoría compatible o evidencia suficiente mantiene review", () => {
  const cases = [
    machine("modula", "Almacén automático vertical MODULA", "Almacén vertical", "Solución logística"),
    machine("ormig", "Grúa eléctrica ORMIG", "Grúa eléctrica", "Grúa de gran tonelaje"),
    machine("cte", "Plataforma sobre furgón CTE VJ15", "Plataforma sobre furgón", "Sobre furgón"),
    machine("plataforma-articulada-hibrida-xcmg", "Plataforma articulada híbrida XCMG",
      "Plataforma híbrida", "Plataforma híbrida"),
    machine("fregadoras-industriales-nuevas", "Barredora fregadora TENNANT BF M17",
      "Barredora fregadora", "Barredora fregadora", {}, "Nuevo", "limpieza-barredoras")
  ];
  for (const source of cases) {
    const prepared = prepareProduct(source, catalog);
    assert.equal(prepared.product.categorySellID, null, source.title ?? "");
    assert.ok(prepared.issues.includes("Categoría Equipzilla sin correspondencia inequívoca"), source.title ?? "");
  }
});

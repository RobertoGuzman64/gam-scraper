import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { createCategorySlugResolver } from "./category-slug-resolver.js";
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

const slug = createCategorySlugResolver(catalog);

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
  assert.equal(slug({ ...source, title: "Carretilla elevadora GLP o diésel Hyster" }), null);
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
    if (source.title?.includes("híbrida")) {
      assert.equal(prepared.status, "ready");
      assert.ok(prepared.importIssues?.createMany.some((issue) => issue.startsWith("Categoría no ")));
    } else {
      assert.ok(prepared.issues.includes("Tipo de máquina de origen sin confirmar"), source.title ?? "");
    }
  }
});

test("transpaleta motorizada Yale: exige modelo, descripción y batería atribuibles a la ficha", () => {
  const record = machine("transpaletas-yale", "Transpaleta YALE MPSC12 1200 Kg",
    "Transpaleta motorizada súper compacta", "Las Transpaletas Motorizadas Compactas MPSC12 incluyen batería",
    { Modelo: "MPSC12", "Capacidad de la batería": "24V / 840-1000Ah(V/Ah)" }, "Nuevo", "marcas-nuevas");
  assert.equal(slug(record), "transpaleta-electrica");
  assert.equal(slug({ ...record, specs: { ...record.specs, Modelo: "MPC14" } }), null);
  assert.equal(slug({ ...record, longDescription: "Transpaletas Motorizadas Compactas de Yale" }), null);
  assert.equal(slug({ ...record, specs: { ...record.specs, "Capacidad de la batería": "1000 mm" } }), null);
  assert.equal(slug({ ...record, shortDescription: "Transpaleta diésel" }), null);
  assert.equal(slug({ ...record, title: "Transpaleta manual Yale MPSC12" }), null);
  assert.equal(slug({ ...record, url: "https://online.gamrentals.com/es/transpaletas-logitrans/99999" }), null);
  assert.equal(slug({ ...record, providerId: "gomariz" }), null);
});

test("categoría energética: rechaza motorización de ficha contradictoria sin descartar alternativas de motor", () => {
  const diesel = machine("carretillas-elevadoras-diesel-hyster", "Carretilla elevadora diésel Hyster H4.0FT",
    "Venta de carretilla elevadora diésel", "", { "Tipo motor": "Diésel" }, "Nuevo", "carretillas-nuevas");
  assert.equal(slug(diesel), "carretilla-elevadora-diesel");
  assert.equal(slug({ ...diesel, specs: { "Tipo motor": "Kubota 3.8L LPG" } }), null);
  assert.equal(slug({ ...diesel, specs: { "Tipo motor": "Diésel", "Motorización": "Eléctrico" } }), null);
  assert.equal(slug({ ...diesel, specs: { "Tipo motor": "Diésel o GLP" } }), "carretilla-elevadora-diesel");
  assert.equal(slug({ ...diesel, title: "Carretilla elevadora diésel o GLP Hyster H4.0FT" }), null);
  const electric = machine("carretillas-elevadoras-electricas-hyster", "Carretilla elevadora eléctrica Hyster",
    "Venta de carretilla eléctrica", "", { "Tipo motor": "Eléctrico" }, "Nuevo", "carretillas-nuevas");
  assert.equal(slug(electric), "carretilla-elevadora-electrica");
  assert.equal(slug({ ...electric, specs: { "Tipo motor": "Diésel" } }), null);
});


test("BRAVI: plataformas de recogepedidos con función operativa explícita", () => {
  const spinGo = machine("recogepedidos-bravi", "Plataforma recogepedidos 4,1M BRAVI Spin-GO",
    "Venta de plataforma recoge pedidos de 4,1 metros de altura",
    "La plataforma recogepedidos BRAVI Spin-Go, de tracción manual y elevación eléctrica, nos ayuda en la recogida de pedidos y en la reposición de stocks.",
    { "Tipo motor": "Eléctrico" }, "Nuevo", "carretillas-nuevas");
  const sprint = machine("recogepedidos-bravi", "Plataforma recogepedidos 5,3M BRAVI Sprint",
    "Venta de plataforma recogepedidos de 20 metros de altura",
    "La plataforma Bravi Sprint, de traslación y elevación eléctrica; aumenta la productividad en las labores de reposición de stock y preparación de pedidos.",
    { "Tipo motor": "Eléctrico" }, "Nuevo", "carretillas-nuevas");
  assert.equal(slug(spinGo), "preparapedido");
  assert.equal(slug(sprint), "preparapedido");
  assert.equal(slug({ ...spinGo, longDescription: "Plataforma de elevación de personas" }), null);
  assert.equal(slug({ ...spinGo, shortDescription: "Plataforma elevadora" }), null);
  assert.equal(slug({ ...spinGo, title: "Plataforma elevadora BRAVI Spin-GO" }), null);
  assert.equal(slug({ ...spinGo, longDescription: "Carretilla elevadora de preparación de pedidos" }), null);
  assert.equal(slug({ ...spinGo, url: "https://online.gamrentals.com/es/recogepedidos-hyster/99999-maquina" }), null);
  assert.equal(slug({ ...spinGo, condition: null }), null);
});

test("tractor Hyster T8.0HS4: exige evidencia eléctrica de la propia ficha", () => {
  const tractor = machine("tractor-de-remolcado-conductor-sentado-8000-kg",
    "Tractor de arrastre de conductor a bordo 8000Kg Hyster T8.0HS4",
    "Venta de tractor eléctrico de arrastre 8000kg",
    "Con capacidad para remolcar hasta 7000 kg u 8000 kg, respectivamente, los nuevos Tractores de Arrastre de conductor a bordo de Hyster.",
    { "Capacidad de la batería": "1000mm" }, "Nuevo", "marcas-nuevas");
  assert.equal(slug(tractor), "tractor-electrico");
  assert.equal(slug({ ...tractor, shortDescription: "Venta de tractor de arrastre 8000kg" }), null);
  assert.equal(slug({ ...tractor, longDescription: "Equipo de remolque" }), null);
  assert.equal(slug({ ...tractor, specs: { "Tipo motor": "Diésel" } }), null);
  assert.equal(slug({ ...tractor, shortDescription: "Tractor eléctrico de arrastre diésel" }), null);
  assert.equal(slug({ ...tractor, condition: "Segunda mano" }), null);
  assert.equal(slug({ ...tractor, providerId: "gomariz" }), null);
});

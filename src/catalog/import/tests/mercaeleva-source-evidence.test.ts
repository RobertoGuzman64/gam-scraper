import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { mercaelevaShortDescription } from "../mapping/providers/mercaeleva/descriptions.js";
import { recoverMercaelevaDescriptionSpecs } from "../../../scraping/providers/mercaeleva/technical-description.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();

const record = (reference: string, title: string, description: string, brand: string, model: string,
  article: string | null, condition: ProductRecord["condition"] = "Segunda mano"): ProductRecord => ({
  providerId: "mercaeleva", categoryKey: "venta", categoryName: "Maquinaria en venta",
  url: `https://sales.mercaeleva.com/es/for-sale/machine/${reference}`,
  reference, title, longDescription: description, shortDescription: null,
  brand, model, price: "4950", condition, year: null, location: null, country: null,
  horometer: null, serialNumber: null,
  image: "https://example.com/photo.jpg", images: ["https://example.com/photo.jpg"],
  specs: { ...(article ? { "Artículo No.": article } : {}), "Estado": condition === "Nuevo" ? "Nuevo" : "Usado" }
});

test("Mercaeleva: conserva descripción corta publicada aunque sea breve", () => {
  const source = record("M239-6301", "BT LPE200/8 TRANSPALET ELECTRICO",
    "Ref. MER0825 TRANSPALET ELECTRICO BT LPE200/8 AÑO DE FABRICACION 2012", "BT", "LPE200/8", "MER0825");
  assert.equal(mercaelevaShortDescription(source), "TRANSPALET ELECTRICO BT LPE200/8");
  const prepared = prepareProduct(source, catalog);
  assert.equal(prepared.product.description, "TRANSPALET ELECTRICO BT LPE200/8");
  assert.equal(prepared.product.description_general, source.longDescription);
});

test("Mercaeleva: admite referencia sin espacio y familia publicada en inglés", () => {
  const source = record("M030-7485", "JLG E300AJP PLATAFORMA ARTICULADA ELECTRICA 11 MT",
    "Ref.429 ELECTRIC ARTICULATED BOOM WORKING HEIGHT 11 MT JLG E300AJP HOURS 2412 YEAR OF MANUFACTURE 2006",
    "JLG", "E300AJP", "429");
  assert.equal(mercaelevaShortDescription(source), "ELECTRIC ARTICULATED BOOM WORKING HEIGHT 11 MT JLG E300AJP");
  assert.equal(prepareProduct({ ...source, specs: { ...source.specs, "Altura de trabajo": "11 m", "Tipo de motor": "Eléctrico" } }, catalog).status, "ready");
});

test("Mercaeleva: recupera texto específico de maquinaria nueva solo con estado confirmado", () => {
  const source = record("M318-0509", "LGMG S1012E-2 NUEVA!!! PLATAFORMA TIJERA ELECTRICA 12 MT",
    "NUEVA!! PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 12 MT LGMG S1012E-2 AÑO DE FABRICACION 2026",
    "LGMG", "S1012E-2", null, "Nuevo");
  assert.equal(mercaelevaShortDescription(source), "PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 12 MT LGMG S1012E-2");
  assert.equal(mercaelevaShortDescription({ ...source, condition: null, specs: {} }), null);
  assert.equal(mercaelevaShortDescription({ ...source, condition: "Segunda mano", specs: { Estado: "Usado" } }), null);
});

test("Mercaeleva: no acepta referencia del vendedor asignada a otra máquina", () => {
  const source = record("M011-3720", "BT LPE200/8 TRANSPALET ELECTRICO",
    "Ref. MER0825 TRANSPALET ELECTRICO CAPACIDAD 2000 KG BT LPE200/8",
    "BT", "LPE200/8", "MER0525");
  assert.equal(mercaelevaShortDescription(source), null);
});

test("Mercaeleva: no convierte variantes de modelo en una coincidencia parcial", () => {
  const source = record("M840-6795", "LGMG A14JE NUEVA!! PLATAFORMA ARTICULADA ELECTRICA 16 MT",
    "NUEVA!!! PLATAFORMA ARTICULADA ELECTRICA ALTURA DE TRABAJO 16 MT LGMG A14JE-LI AÑO DE FABRICACION 2026",
    "LGMG", "A14JE", null, "Nuevo");
  assert.equal(mercaelevaShortDescription(source), null);
  assert.equal(mercaelevaShortDescription({ ...source, brand: "JLG" }), null);
});

test("Mercaeleva: respeta incompatibilidades de medidas, subtipo y mástil", () => {
  const source = record("M486-0114", "LGMG AS1413 PLATAFORMA TIJERA ELECTRICA 14 MT",
    "Ref. 1236 PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 16 MT LGMG AS1413 HORAS 181", "LGMG", "AS1413", "1236");
  assert.equal(mercaelevaShortDescription(source), null);
  assert.equal(mercaelevaShortDescription({ ...source, longDescription: source.longDescription?.replace("TIJERA", "ARTICULADA").replace("16 MT", "14 MT") ?? null }), null);
  const forklift = record("M818-7811", "LINDE E25/600-336 CARRETILLA ELEVADORA ELECTRICA 2500 KG",
    "Ref. MER0670 CARRETILLA ELEVADORA ELECTRICA 2500 KG DUPLEX TRIPLEX LINDE E25/600-336 HORAS 3404", "LINDE", "E25/600-336", "MER0670");
  assert.equal(mercaelevaShortDescription(forklift), null);
});

test("Mercaeleva: admite modelos con puntuación y espacios sin aceptar sufijos unidos", () => {
  const source = record("M971-8124", "GENIE S-125 PLATAFORMA TELESCOPICA DIESEL 40 MT",
    "Ref.698 PLATAFORMA TELESCOPICA DIESEL ALTURA DE TRABAJO 40 MT GENIE S.-125 HORAS 4116", "Genie", "S-125", "698");
  assert.equal(mercaelevaShortDescription(source), "PLATAFORMA TELESCOPICA DIESEL ALTURA DE TRABAJO 40 MT GENIE S.-125");
  assert.equal(mercaelevaShortDescription({ ...source, model: "S-126" }), null);
});

test("Mercaeleva: recupera mástil explícito único y rechaza configuraciones alternativas", () => {
  const specs: Record<string, string> = {};
  recoverMercaelevaDescriptionSpecs(specs, "Ref. MER0604 CARRETILLA DIESEL MÁSTIL TRÍPLEX ALTURA DE TRABAJO 5.400 mm", "CARRETILLA DIESEL");
  assert.equal(specs["Tipo de mástil"], "TRÍPLEX");
  const multi: Record<string, string> = {};
  recoverMercaelevaDescriptionSpecs(multi, "CARRETILLA MÁSTIL DÚPLEX O TRÍPLEX", "CARRETILLA ELEVADORA");
  assert.equal(multi["Tipo de mástil"], undefined);
  const existing: Record<string, string> = { "Tipo de mástil": "Dúplex" };
  recoverMercaelevaDescriptionSpecs(existing, "CARRETILLA MÁSTIL TRÍPLEX", "CARRETILLA ELEVADORA");
  assert.equal(existing["Tipo de mástil"], "Dúplex");
});

test("Mercaeleva: acepta capacidad única concordante sin reemplazar datos ni pesos", () => {
  const correct: Record<string, string> = {};
  recoverMercaelevaDescriptionSpecs(correct, "TRANSPALET CAPACIDAD DE CARGA 2.000 KG", "TRANSPALET ELECTRICO 2000 KG");
  assert.equal(correct["Capacidad de carga"], "2.000 kg");
  const conflict: Record<string, string> = {};
  recoverMercaelevaDescriptionSpecs(conflict, "CARRETILLA CAPACIDAD 2500 KG", "CARRETILLA ELEVADORA 3000 KG");
  assert.equal(conflict["Capacidad de carga"], undefined);
  const options: Record<string, string> = {};
  recoverMercaelevaDescriptionSpecs(options, "CARRETILLA CAPACIDAD 2500 KG O 3000 KG", "CARRETILLA ELEVADORA");
  assert.equal(options["Capacidad de carga"], undefined);
  const existing: Record<string, string> = { "Capacidad máxima de elevación": "2500 kg" };
  recoverMercaelevaDescriptionSpecs(existing, "CARRETILLA CAPACIDAD 3000 KG", "CARRETILLA ELEVADORA 3000 KG");
  assert.equal(existing["Capacidad de carga"], undefined);
  assert.equal(existing["Capacidad máxima de elevación"], "2500 kg");
});

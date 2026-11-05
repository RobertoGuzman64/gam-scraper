import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { analyzeTitleQuality } from "../../diagnostics/title-quality.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { refineTechnicalTitle } from "../mapping/technical-title-refinement.js";

const originals = await Promise.all(["gam", "gomariz", "mercaeleva"].map((provider) =>
  readCanonicalCatalog(`catalogs/providers/${provider}/original/scrape-${provider}-catalog.json`)));

const source = (provider: string, reference: string): ProductRecord => {
  const found = originals.find((item) => item.providerId === provider)?.products.find((item) => item.reference === reference);
  assert.ok(found, `${provider}:${reference}`);
  return found;
};

const assertTitle = (provider: string, reference: string, expected: string): void => {
  const record = source(provider, reference);
  const original = JSON.stringify(record);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.title, expected, reference);
  assert.equal(prepared.product.description_title, expected, reference);
  assert.equal(prepared.product.reference, record.reference);
  assert.equal(prepared.product.sourceUrl, record.url);
  assert.equal(JSON.stringify(record), original);
};

test("familias e identidades confirmadas enriquecen únicamente el título técnico", () => {
  const cases: readonly [string, string, string][] = [
    ["gam", "5950", "Bicicleta eléctrica Littium Ibiza Dogma"],
    ["gam", "5949", "Bicicleta eléctrica Littium Ibiza Titanium"],
    ["gam", "2252", "Transpaleta eléctrica YALE MP25HD"],
    ["gam", "4024", "Barredora industrial Tennant BCA S10"],
    ["gam", "4661", "Plataforma sobre camión articulada CTE ZED 21.3 JHV"],
    ["gam", "4662", "Plataforma elevadora sobre camión CTE ZED 25 HV"],
    ["gam", "5710", "Plataforma de 4 ejes NOOTEBOOM MCO"],
    ["gam", "6947", "PLATAFORMA ARTICULADA DIÉSEL 20M HAULOTTE HA20 RTJ"],
    ["gomariz", "CC1535", "Camión cesta SOCAGE IVECO 35S14 FORSTE 20D SPEED NEUTRA"],
    ["gomariz", "CC1665", "Camión cesta SOCAGE IVECO FORSTE 18T SPEED"],
    ["gomariz", "CC1666", "Camión cesta SOCAGE IVECO 35S14 FORSTE 20D SPEED NEUTRA"]
  ];
  for (const [provider, reference, expected] of cases) assertTitle(provider, reference, expected);
});

test("modelo confirmado por descripción breve, larga y ficha técnica reemplaza el modelo erróneo del título", () => {
  assertTitle("gam", "6274", "Carretilla elevadora diésel 14500Kg Hyster H14XD-12");
  assertTitle("gam", "6422", "CARRETILLA ELEVADORA ELÉCTRICA 2500KG HYSTER J2.5UTL");
  assertTitle("gam", "6745", "Preparapedidos 3000kg Yale MO30X");
});

test("ruido del portal, concordancia, espacios y magnitudes repetidas se eliminan sin alterar identidades", () => {
  assertTitle("gam", "6901", "Plataforma articulada diésel 16M SNORKEL A46JRT");
  assertTitle("gam", "6912", "Plataforma articulada diésel 16M SNORKEL A46JRT");
  assertTitle("gam", "4742", "Plataforma elevadora de tijera 12M XCMG XG1212AC con batería de plomo");
  assertTitle("gam", "4802", "Plataforma de tijera eléctrica 15M 4x4 XCMG XG1523ERT");
  assertTitle("gam", "6607", "GENIE Z45/25 | Plataforma Articulada Diésel 16M");
  assertTitle("mercaeleva", "M055-1205", "Oil & Steel SCORPION 1812 CAMION CESTA 18 MT TELESCOPICO ALUMINIO");
});

test("Mercaeleva corrige seis títulos con evidencia de familia, identidad y condición", () => {
  const cases: readonly [string, string][] = [
    ["M239-6301", "Transpaleta eléctrica BT LPE200/8"],
    ["M011-3720", "Transpaleta eléctrica BT LPE200/8"],
    ["M879-4639", "Transpaleta eléctrica Stöcklin EDP-2000"],
    ["M570-8735", "Transpaleta eléctrica Linde T18"],
    ["M840-6795", "Plataforma articulada eléctrica LGMG A14JE de 16 m"],
    ["M318-0509", "Plataforma de tijera eléctrica LGMG S1012E-2 de 12 m"]
  ];
  for (const [reference, expected] of cases) {
    const original = source("mercaeleva", reference);
    assertTitle("mercaeleva", reference, expected);
    assert.equal(prepareSourceProduct(original).status, "ready", reference);
    assert.equal(prepareSourceProduct({ ...original, title: "Equipo sin modelo ni familia" }).product.title,
      "Equipo sin modelo ni familia", reference);
    assert.equal(prepareSourceProduct({ ...original, brand: "MARCA AJENA" }).product.title,
      original.title, reference);
    assert.equal(prepareSourceProduct({ ...original, url: "https://example.org/venta" }).product.title,
      original.title, reference);
    assert.equal(prepareSourceProduct({ ...original, specs: { ...original.specs, Modelo: "MODELO AJENO" } }).product.title,
      original.title, reference);
  }
  for (const reference of ["M239-6301", "M011-3720", "M879-4639", "M570-8735"]) {
    const original = source("mercaeleva", reference);
    assert.equal(prepareSourceProduct({ ...original, condition: "Nuevo" }).product.title, original.title, reference);
    assert.equal(prepareSourceProduct({ ...original, longDescription: "Sin evidencia de transpaleta" }).product.title,
      original.title, reference);
  }
  for (const reference of ["M840-6795", "M318-0509"]) {
    const original = source("mercaeleva", reference);
    assert.equal(prepareSourceProduct({ ...original, condition: "Segunda mano" }).product.title,
      original.title, reference);
    assert.equal(prepareSourceProduct({ ...original, specs: { ...original.specs, "Altura de trabajo": "11 m" } }).product.title,
      original.title, reference);
  }
});

test("metadatos contradictorios y evidencias ambiguas no autorizan cambiar marcas o modelos", () => {
  for (const reference of ["2020", "2118", "6103", "6852", "6689", "6863"]) {
    const record = source("gam", reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.title, record.title, reference);
    const report = analyzeTitleQuality([{
      source: record, published: { ...prepared.product, title: record.title }, prepared,
      origin: "original_canonico"
    }]);
    assert.equal(report.totals.pending, 0, reference);
    assert.equal(report.totals.appeared, 0, reference);
  }
  const bicycle = source("gam", "5950");
  assert.equal(refineTechnicalTitle({ ...bicycle, longDescription: "Texto ajeno a bicicletas" }, bicycle.title), bicycle.title);
  const truck = source("gomariz", "CC1535");
  assert.equal(refineTechnicalTitle({ ...truck, longDescription: "Sin tipo de máquina acreditado" }, truck.title), truck.title);
  const forklift = source("gam", "6274");
  assert.equal(refineTechnicalTitle({ ...forklift, shortDescription: "No se acredita este modelo" }, forklift.title), forklift.title);
  const brand = source("gam", "2252");
  assert.equal(refineTechnicalTitle({ ...brand, specs: { ...brand.specs, Marca: "OTRA" } }, brand.title), brand.title);
});

test("el motor conserva todas las identidades y mantiene título y descripción_title sincronizados", () => {
  let total = 0;
  let changed = 0;
  for (const catalog of originals) {
    for (const record of catalog.products) {
      const prepared = prepareSourceProduct(record);
      total++;
      if (prepared.product.title !== record.title) changed++;
      assert.equal(prepared.product.description_title, prepared.product.title, `${record.providerId}:${record.reference}`);
      assert.equal(prepared.product.providerId, record.providerId);
      assert.equal(prepared.product.sourceUrl, record.url);
      assert.equal(prepared.product.reference, record.reference?.trim() || null);
    }
  }
  assert.equal(total, originals.reduce((sum, catalog) => sum + catalog.products.length, 0));
  assert.ok(changed > 0);
});

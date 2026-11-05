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

test("Mercaeleva normaliza títulos de plataformas con identidad, motor y altura concordantes", () => {
  const cases: readonly [string, string][] = [
    ["M563-8693", "Plataforma de tijera eléctrica LGMG AS1212E de 14 m"],
    ["M057-0589", "Plataforma de tijera diésel LGMG SR1218D de 14 m"],
    ["M998-5889", "Plataforma articulada diésel JLG 450 AJ de 16 m"],
    ["M921-0545", "Plataforma articulada eléctrica Haulotte HA15IP de 15 m"],
    ["M044-4093", "Plataforma articulada diésel JLG 450 AJ SII de 16 m"],
    ["M451-2844", "Plataforma de tijera eléctrica JLG 2630ES de 10 m"],
    ["M749-9513", "Plataforma telescópica diésel JLG 460SJ de 16 m"],
    ["M624-7785", "Plataforma telescópica diésel JLG 1350 SJP de 43 m"]
  ];
  for (const [reference, expected] of cases) {
    assertTitle("mercaeleva", reference, expected);
    const original = source("mercaeleva", reference);
    assert.equal(prepareSourceProduct(original).status, "ready", reference);
    const variants: readonly ProductRecord[] = [
      { ...original, url: "https://example.org/otro-anuncio" },
      { ...original, brand: "MARCA AJENA" },
      { ...original, model: "MODELO AJENO" },
      { ...original, condition: "Nuevo" },
      { ...original, specs: { ...original.specs, Modelo: "MODELO AJENO" } },
      { ...original, specs: { ...original.specs, "Tipo de motor": "Gasolina" } },
      { ...original, specs: { ...original.specs, "Altura de trabajo": "99 m" } },
      { ...original, longDescription: "Sin evidencia acreditable de modelo, familia ni altura" }
    ];
    for (const variant of variants) {
      assert.equal(prepareSourceProduct(variant).product.title, original.title, `${reference}: evidencia alterada`);
    }
  }
  for (const reference of ["M887-9469", "M486-0114", "M030-7485"]) {
    const original = source("mercaeleva", reference);
    assert.equal(prepareSourceProduct(original).product.title, original.title, `${reference}: evidencia insuficiente`);
  }
});

test("Mercaeleva normaliza plataformas nuevas, alturas decimales y variantes de escritura documentadas", () => {
  const cases: readonly [string, string][] = [
    ["M140-0406", "Plataforma de tijera eléctrica Hollandlift HL-220 E12 de 22 m"],
    ["M082-6111", "Plataforma de tijera eléctrica Hollandlift HL-220 E12 de 22 m"],
    ["M971-8124", "Plataforma telescópica diésel Genie S-125 de 40 m"],
    ["M572-8190", "Plataforma articulada diésel Manitou 180ATJ de 18 m"],
    ["M205-2951", "Plataforma articulada diésel Manitou 180ATJ de 18 m"],
    ["M178-6194", "Plataforma articulada diésel Manitou 180ATJ de 18 m"],
    ["M177-1398", "Plataforma de tijera eléctrica SINOBOOM 0608ME de 8 m"],
    ["M005-4474", "Plataforma de tijera eléctrica LGMG S0808EII de 10 m"],
    ["M346-8211", "Plataforma de tijera eléctrica LGMG SS0407ER de 6 m"],
    ["M726-5166", "Plataforma de tijera eléctrica LGMG S1012EII de 12 m"],
    ["M159-0669", "Plataforma de tijera eléctrica LGMG S0808EII de 10 m"],
    ["M606-3993", "Plataforma de tijera eléctrica LGMG SS0407ER de 6 m"],
    ["M239-8327", "Plataforma de tijera eléctrica Hollandlift N-165EL12 de 18,5 m"]
  ];
  for (const [reference, expected] of cases) {
    assertTitle("mercaeleva", reference, expected);
    const original = source("mercaeleva", reference);
    const invalid: readonly ProductRecord[] = [
      { ...original, url: "https://example.org/otra-maquina" },
      { ...original, model: "OTRO MODELO" },
      { ...original, specs: { ...original.specs, Marca: "OTRA MARCA" } },
      { ...original, specs: { ...original.specs, "Altura de trabajo": "99 m" } },
      { ...original, specs: { ...original.specs, "Título adicional": "OTRA FAMILIA" } },
      { ...original, specs: { ...original.specs, "Tipo de motor": "Gasolina" } },
      { ...original, longDescription: "Sin identidad, altura ni familia documentadas" }
    ];
    for (const candidate of invalid) {
      assert.equal(prepareSourceProduct(candidate).product.title, original.title, `${reference}: dato alterado`);
    }
    const otherCondition: ProductRecord = original.condition === "Nuevo"
      ? { ...original, condition: "Segunda mano" }
      : { ...original, condition: "Nuevo" };
    assert.equal(prepareSourceProduct(otherCondition).product.title, original.title, `${reference}: condición alterada`);
  }
  for (const reference of ["M887-9469", "M486-0114", "M030-7485"]) {
    const original = source("mercaeleva", reference);
    assert.equal(prepareSourceProduct(original).product.title, original.title, `${reference}: falta coherencia`);
  }
});

test("Mercaeleva normaliza carretillas eléctricas solo con capacidad y origen concordantes", () => {
  const cases: readonly [string, string][] = [
    ["M940-4770", "Carretilla elevadora eléctrica Linde E20PL de 2000 kg"],
    ["M208-7097", "Carretilla elevadora eléctrica Jungheinrich EFG 318 de 1800 kg"],
    ["M740-4184", "Carretilla elevadora eléctrica Caterpillar EP25K-PAC de 2500 kg"],
    ["M827-8304", "Carretilla elevadora eléctrica Linde E48P de 4800 kg"],
    ["M818-7811", "Carretilla elevadora eléctrica Linde E25/600-336 de 2500 kg"],
    ["M052-5188", "Carretilla elevadora eléctrica Toyota 7FBEF15 de 1500 kg"]
  ];
  for (const [reference, expected] of cases) {
    const original = source("mercaeleva", reference);
    assertTitle("mercaeleva", reference, expected);
    const variants: readonly ProductRecord[] = [
      { ...original, url: "https://example.org/otra-maquina" },
      { ...original, brand: "MARCA AJENA" },
      { ...original, model: "MODELO AJENO" },
      { ...original, condition: "Nuevo" },
      { ...original, specs: { ...original.specs, Modelo: "MODELO AJENO" } },
      { ...original, specs: { ...original.specs, Estado: "Nuevo" } },
      { ...original, specs: { ...original.specs, "Tipo de Batería": "Sin acreditar" } },
      { ...original, specs: { ...original.specs, "Capacidad máxima de elevación": "9000 kg" } },
      { ...original, specs: { ...original.specs, "Título adicional": "CARRETILLA ELEVADORA DIESEL 2500 KG" } },
      { ...original, longDescription: "Sin evidencia de modelo ni capacidad" }
    ];
    for (const candidate of variants) {
      assert.equal(prepareSourceProduct(candidate).product.title, original.title, `${reference}: evidencia alterada`);
    }
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

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { parseCanonicalProductRecords } from "../../../../catalog/canonical-catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveConsistentEditorialFamily } from "../domain/editorial-families.js";
import { resolveEditorialSource } from "../domain/editorial-source.js";
import { withoutContradictoryFamilyGeneral } from "../domain/editorial-source-family-general.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";

const familyEnergyCases: unknown = JSON.parse(readFileSync(
  "src/testing/domain-cases/data/gomariz-family-energy-original.json", "utf8"
));
const familyEnergyRecords = parseCanonicalProductRecords(familyEnergyCases);
const yearSourceCases: unknown = JSON.parse(readFileSync(
  "src/testing/domain-cases/data/editorial-family-year-original.json", "utf8"
));
const yearSourceRecords = parseCanonicalProductRecords(yearSourceCases);
const yearSourceRecord = (reference: string): ProductRecord => {
  const record = yearSourceRecords.find((item) => item.reference === reference);
  assert.ok(record);
  return record;
};

const familyEnergyRecord = (reference: string): ProductRecord => {
  const record = familyEnergyRecords.find((item) => item.reference === reference);
  assert.ok(record);
  return record;
};

const gomarizElectric = accreditedSourceRecord("gomariz-original", "BA1465");
const gomarizDiesel = accreditedSourceRecord("gomariz-original", "BA1253");
const gamArticulated = accreditedSourceRecord("gam-original", "6901");
const mercaElectric = accreditedSourceRecord("mercaeleva-original", "M106-1389");
const mercaDiesel = accreditedSourceRecord("mercaeleva-original", "M940-3556");

const newUnit = (source: ProductRecord, reference: string, specs: NonNullable<ProductRecord["specs"]>): ProductRecord => ({
  ...source,
  reference,
  url: source.providerId === "mercaeleva" ? source.url.replace(source.reference ?? "", reference) :
    source.providerId === "gam" ? source.url.replace(`/${source.reference}-`, `/${reference}-`) :
      `${source.url.replace(/\/$/u, "")}-otra-unidad/`,
  year: null, horometer: null, serialNumber: null, shortDescription: null, image: null, images: [],
  specs: { ...source.specs, ...specs }
});

test("articuladas originales de tres proveedores preservan identidad, magnitudes y fuente", () => {
  for (const [source, energy, working] of [
    [gomarizDiesel, "diésel", 21.38],
    [mercaElectric, "eléctrica", 17],
    [mercaDiesel, "diésel", 43]
  ] as const) {
    const snapshot = JSON.stringify(source);
    const facts = resolveEditorialFacts(source);
    assert.equal(facts?.family, "plataforma-articulada");
    assert.equal(facts.energy, energy);
    assert.equal(facts.workingHeightM, working);
    const output = prepareSourceProduct(source);
    assert.equal(output.status, "ready");
    assert.equal(output.product.sourceUrl, source.url);
    assert.equal(output.product.reference, source.reference);
    assert.match(output.product.title ?? "", /[Aa]rticulada/u);
    assert.equal(JSON.stringify(source), snapshot);
  }
  assert.equal(resolveEditorialFacts(gamArticulated)?.family, "plataforma-articulada");
  assert.equal(resolveEditorialFacts(gamArticulated)?.liftingHeightM, 16);
});

test("plantilla genérica diésel no contradice la motorización eléctrica acreditada", () => {
  const unchanged = JSON.stringify(gomarizElectric);
  assert.match(gomarizElectric.longDescription ?? "", /Articuladas Diésel/u);
  assert.equal(gomarizElectric.specs?.Motor, "Eléctrico");
  assert.equal(withoutContradictoryFamilyGeneral(gomarizElectric).longDescription, null);
  const composed = resolveReusableEditorial(withoutContradictoryFamilyGeneral(gomarizElectric));
  const result = prepareSourceProduct(gomarizElectric);
  assert.equal(result.status, "ready");
  assert.match(result.product.title ?? "", /articulada eléctrica/u);
  assert.match(composed.general ?? "", /altura de trabajo de 15,8 m/u);
  assert.match(result.product.description_general ?? "", /altura de trabajo de 15,8 m/u);
  assert.doesNotMatch(result.product.description_general ?? "", /Articuladas Diésel/u);
  assert.equal(JSON.stringify(gomarizElectric), unchanged);
  assert.equal(withoutContradictoryFamilyGeneral(gomarizDiesel), gomarizDiesel);
});

test("una general diésel genérica no se conserva si la URL no acredita la familia y el motor es eléctrico", () => {
  const source = familyEnergyRecord("BA1291");
  const snapshot = JSON.stringify(source);
  const domainSource = resolveEditorialSource(source);
  assert.ok(domainSource);
  assert.equal(resolveConsistentEditorialFamily(domainSource.familyClues, source.title, null, source.categoryName), null);
  assert.equal(source.specs?.Motor, "Eléctrico");
  assert.match(source.longDescription ?? "", /^Las Articuladas Diésel/u);
  assert.equal(withoutContradictoryFamilyGeneral(source).longDescription, null);
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.equal(prepared.product.spec.Motor, "Eléctrico");
  assert.match(prepared.product.description ?? "", /plataforma articulada eléctrica Snorkel A46JE/iu);
  assert.match(prepared.product.description_general ?? "", /altura de trabajo de 16,1 m/u);
  assert.match(prepared.product.description_general ?? "", /capacidad de 227 kg/u);
  assert.doesNotMatch(prepared.product.description_general ?? "", /Articuladas Diésel|12 m a 43 m/iu);
  assert.equal(JSON.stringify(source), snapshot);
});

test("cortas con texto familiar distinguen unidades de años acreditados en varias familias", () => {
  for (const [firstRef, secondRef, firstYear, secondYear] of [
    ["TE1756", "TE1603", "2021", "2022"],
    ["BA1629", "BA1509", "2014", "2011"],
    ["TD1799", "TD1726", "2022", "2020"]
  ] as const) {
    const first = yearSourceRecord(firstRef);
    const second = yearSourceRecord(secondRef);
    const originals = [JSON.stringify(first), JSON.stringify(second)];
    assert.equal(first.brand, second.brand);
    assert.equal(first.model, second.model);
    assert.equal(first.year, firstYear);
    assert.equal(second.year, secondYear);
    const firstShort = resolveReusableEditorial(first).short ?? "";
    const secondShort = resolveReusableEditorial(second).short ?? "";
    assert.match(firstShort, new RegExp(`año de fabricación ${firstYear}`));
    assert.match(secondShort, new RegExp(`año de fabricación ${secondYear}`));
    assert.doesNotMatch(firstShort, new RegExp(`año de fabricación ${secondYear}`));
    assert.notEqual(firstShort, secondShort);
    for (const [source, year] of [[first, firstYear], [second, secondYear]] as const) {
      const prepared = prepareSourceProduct(source);
      assert.equal(prepared.status, "ready");
      assert.match(prepared.product.description ?? "", new RegExp(`año de fabricación ${year}`));
      assert.equal(prepared.product.spec.Motor, source.specs?.Motor);
    }
    assert.equal(JSON.stringify(first), originals[0]);
    assert.equal(JSON.stringify(second), originals[1]);
  }
});

test("la misma diferenciación se transfiere a otro proveedor sin trasladar especificaciones", () => {
  const source = yearSourceRecord("M572-8190");
  const snapshot = JSON.stringify(source);
  const reusable = resolveReusableEditorial(source);
  const prepared = prepareSourceProduct(source);
  assert.equal(source.providerId, "mercaeleva");
  assert.equal(source.shortDescription, null);
  assert.match(reusable.short ?? "", /año de fabricación 2017/u);
  assert.match(prepared.product.description ?? "", /año de fabricación 2017/u);
  assert.equal(prepared.product.reference, source.reference);
  assert.equal(prepared.product.sourceUrl, source.url);
  assert.equal(prepared.product.spec["Altura de trabajo"], source.specs?.["Altura de trabajo"]);
  assert.equal(JSON.stringify(source), snapshot);
});

test("el año solo se diferencia con evidencia individual y general familiar compatible", () => {
  const source = yearSourceRecord("BA1629");
  const short = resolveReusableEditorial(source).short ?? "";
  assert.match(short, /año de fabricación 2014/u);
  const incompatible: ProductRecord[] = [
    { ...source, year: "2099" },
    { ...source, shortDescription: "Descripción individual acreditada" },
    { ...source, longDescription: `La ${source.brand} ${source.model} se ofrece como equipo de ocasión.` },
    { ...source, longDescription: `${source.longDescription} Referencia de modelo de 2013.` }
  ];
  for (const record of incompatible) {
    assert.doesNotMatch(resolveReusableEditorial(record).short ?? "", /año de fabricación 2014/u);
  }
  assert.doesNotMatch(resolveReusableEditorial(source, null, { ...source, year: "2011" }).short ?? "", /año de fabricación 2014/u);
  assert.doesNotMatch(resolveReusableEditorial(source, null, yearSourceRecord("BA1509")).short ?? "", /año de fabricación 2014/u);
  assert.doesNotMatch(resolveReusableEditorial({ ...source, year: null }).short ?? "", /año de fabricación/u);
  const sameModel = yearSourceRecord("TE1756");
  assert.doesNotMatch(resolveReusableEditorial({ ...sameModel, longDescription: null }).short ?? "", /año de fabricación/u);
  assert.doesNotMatch(resolveReusableEditorial(yearSourceRecord("BA1833")).short ?? "", /año de fabricación/u);
});

test("textos familiares compatibles conservan su fuente y la contradicción ya cubierta sigue protegida", () => {
  for (const [reference, motor] of [["BA1344", "Eléctrico"], ["BA1252", "Diésel"]] as const) {
    const record = familyEnergyRecord(reference);
    const snapshot = JSON.stringify(record);
    assert.equal(record.specs?.Motor, motor);
    assert.equal(withoutContradictoryFamilyGeneral(record), record);
    const result = prepareSourceProduct(record);
    assert.equal(result.status, "ready");
    assert.equal(result.product.spec.Motor, motor);
    assert.equal(JSON.stringify(record), snapshot);
  }
  assert.equal(withoutContradictoryFamilyGeneral(gomarizElectric).longDescription, null);
});

test("no se descarta un texto por procedencia inválida, energía ambigua o mención personalizada", () => {
  const source = familyEnergyRecord("BA1291");
  const cases: ProductRecord[] = [
    { ...source, providerId: "gam" },
    { ...source, url: "https://example.invalid/producto/snorkel-a46je/" },
    { ...source, brand: "OTRA" },
    { ...source, model: "OTRA-VARIANTE" },
    { ...source, specs: { ...source.specs, Motor: "Eléctrico / Diésel" } },
    { ...source, specs: { ...source.specs, "Tipo motor": "Diésel" } },
    { ...source, specs: { ...source.specs, Motor: "Diésel" } },
    { ...source, longDescription: "La articulada diésel Snorkel A46JE tiene motor diésel." },
    { ...source, longDescription: "Las Articuladas Eléctricas destacan por su maniobrabilidad." }
  ];
  for (const record of cases) assert.equal(withoutContradictoryFamilyGeneral(record), record);
});

test("unidades nuevas de articulada consumen exclusivamente su ficha técnica", () => {
  const electric = newUnit(gomarizElectric, "BA2465", {
    "Altura plataforma": "12.8 m", "Altura de trabajo": "14.8 m", "Alcance lateral": "7.4 m", Capacidad: "200 kg"
  });
  const diesel = newUnit(gomarizDiesel, "BA2253", {
    "Altura plataforma": "18 m", "Altura de trabajo": "20 m", "Alcance lateral": "11 m", Capacidad: "215 kg"
  });
  for (const [record, height, reach, capacity, forbidden] of [
    [electric, "14,8 m", "7,4 m", "200 kg", "15,8 m"],
    [diesel, "20 m", "11 m", "215 kg", "21,38 m"]
  ] as const) {
    const snapshot = JSON.stringify(record);
    const cleaned = withoutContradictoryFamilyGeneral(record);
    const facts = resolveEditorialFacts(cleaned);
    assert.equal(facts?.family, "plataforma-articulada");
    assert.equal(resolveKnowledgeEditorial(record).general, null);
    const output = prepareSourceProduct(record);
    assert.equal(output.status, record.reference === "BA2465" ? "review" : "ready");
    assert.ok(output.product.description_general?.includes(`altura de trabajo de ${height}`));
    assert.ok(output.product.description_general?.includes(`alcance lateral de ${reach}`));
    assert.ok(output.product.description_general?.includes(`capacidad de ${capacity}`));
    assert.ok(!output.product.description_general?.includes(forbidden));
    assert.doesNotMatch(output.product.description_general ?? "", /Articuladas Diésel son/u);
    assert.equal(output.product.reference, record.reference);
    assert.equal(output.product.sourceUrl, record.url);
    assert.equal(JSON.stringify(record), snapshot);
  }
});

test("solo se omite la descripción genérica contradictoria; las objeciones de unidad permanecen", () => {
  const personalized = { ...gomarizElectric, longDescription: `La plataforma articulada diésel ${gomarizElectric.brand} ${gomarizElectric.model} tiene motor diésel.` };
  assert.equal(withoutContradictoryFamilyGeneral(personalized), personalized);
  assert.equal(resolveEditorialFacts(personalized), null);
  const consistent = { ...gomarizElectric, specs: { ...gomarizElectric.specs, Motor: "Diésel" } };
  assert.equal(withoutContradictoryFamilyGeneral(consistent), consistent);
  assert.equal(resolveEditorialFacts(consistent)?.energy, "diésel");
  for (const invalid of [
    { ...gomarizElectric, providerId: "gam" },
    { ...gomarizElectric, url: "https://example.invalid/otra" },
    { ...gomarizElectric, brand: "OTRA" },
    { ...gomarizElectric, model: "MODELO-OTRO" },
    { ...gomarizElectric, title: "Plataforma telescópica LGMG A14JE" },
    { ...gomarizElectric, specs: { ...gomarizElectric.specs, Motor: "Eléctrico, Diésel" } }
  ]) {
    assert.equal(withoutContradictoryFamilyGeneral(invalid), invalid);
    assert.equal(resolveEditorialFacts(invalid), null);
  }
  const invalidHeight = { ...gomarizElectric, specs: { ...gomarizElectric.specs, "Altura de trabajo": "15 kg" } };
  assert.equal(withoutContradictoryFamilyGeneral(invalidHeight).longDescription, null);
  assert.equal(resolveEditorialFacts(withoutContradictoryFamilyGeneral(invalidHeight)), null);
});

test("documentación técnica histórica se consume como referencia y no como dato de unidad", () => {
  for (const source of [mercaElectric, mercaDiesel]) {
    const snapshot = JSON.stringify(source);
    const reference = resolveKnowledgeEditorial(source).modelReference ?? "";
    const technical = reference.slice(reference.indexOf("La documentación técnica de referencia"));
    assert.match(technical, /La documentación técnica de referencia del modelo/u);
    assert.match(technical, /no acreditan la configuración ni las prestaciones de esta unidad/u);
    const result = prepareSourceProduct(source);
    assert.equal(result.status, "ready");
    assert.equal(result.product.sourceUrl, source.url);
    if (resolveKnowledgeEditorial(source).general === null) {
      assert.ok(result.product.description_general?.includes(technical));
    }
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("referencia reutilizable con unidad nueva compatible, sin trasladar condiciones particulares", () => {
  const incoming = newUnit(mercaDiesel, "M940-3557", { "Altura de trabajo": "43 m", "Título adicional": "PLATAFORMA ARTICULADA DIESEL 43 MT" });
  const snapshot = JSON.stringify(incoming);
  const knowledge = resolveKnowledgeEditorial(incoming);
  assert.equal(knowledge.general, null);
  assert.match(knowledge.modelReference ?? "", /La documentación técnica de referencia del modelo Genie Z135/u);
  assert.match(knowledge.modelReference ?? "", /no acreditan la configuración ni las prestaciones de esta unidad/u);
  const result = prepareSourceProduct(incoming);
  assert.equal(result.status, "ready");
  assert.match(result.product.description_general ?? "", /La documentación técnica de referencia del modelo Genie Z135/u);
  assert.equal(result.product.sourceUrl, incoming.url);
  assert.doesNotMatch(result.product.description_general ?? "", /4\.341 horas|serie de la unidad original/u);
  assert.equal(JSON.stringify(incoming), snapshot);
});

test("modelo próximo, variante, magnitud, energía y procedencia impiden referencias falsas", () => {
  const source = newUnit(mercaDiesel, "M940-3557", { "Altura de trabajo": "43 m" });
  const invalid: ProductRecord[] = [
    { ...source, brand: "OTRA MARCA" },
    { ...source, model: "Z135-OTRA", title: "Genie Z135-OTRA PLATAFORMA ARTICULADA DIESEL 43 MT" },
    { ...source, providerId: "gomariz" },
    { ...source, url: "https://example.invalid/otra" },
    { ...source, condition: "Nuevo" },
    { ...source, title: "Genie Z135 PLATAFORMA TIJERA DIESEL 43 MT" },
    { ...source, specs: { ...source.specs, "Altura de trabajo": "40 m" } },
    { ...source, specs: { ...source.specs, "Altura de trabajo": "43 kg" } },
    { ...source, specs: { ...source.specs, "Tipo de motor": "Eléctrico" } }
  ];
  for (const record of invalid) {
    assert.doesNotMatch(resolveKnowledgeEditorial(record).modelReference ?? "", /La documentación técnica de referencia/u);
    assert.doesNotMatch(prepareSourceProduct(record).product.description_general ?? "", /La documentación técnica de referencia del modelo Genie Z135/u);
  }
});

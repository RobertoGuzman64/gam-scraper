import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";

const historicalTower = (): ProductRecord => accreditedSourceRecord("gomariz-special-original", "TO1241");
const historicalDumper = (): ProductRecord => accreditedSourceRecord("gomariz-special-original", "DU473");

const newUnit = (record: ProductRecord, slug: string, reference: string): ProductRecord => ({
  ...record,
  reference,
  url: record.url.replace(/\/([^/]+)\/$/u, `/${slug}/`),
  shortDescription: null,
  specs: { ...record.specs }
});

test("recupera altura y luminarias de la torre histórica sin adoptar configuraciones de familia", () => {
  const original = historicalTower();
  const snapshot = JSON.stringify(original);
  const history = resolveKnowledgeEditorial(original, original);
  assert.match(history.fallbackGeneral ?? "", /8,50 m.*4 × 120 W/su);
  const prepared = prepareSourceProduct(original);
  assert.equal(prepared.status, "ready");
  assert.match(prepared.product.title ?? "", /^Torre de iluminación diésel Generac VB9$/u);
  assert.match(prepared.product.description ?? "", /8,5 m.*4 × 120 W/u);
  assert.match(prepared.product.description_general ?? "", /8,5 m.*4 × 120 W/u);
  assert.doesNotMatch(prepared.product.description_general ?? "", /generador integrado|remolcable|baterías y gasoil/iu);
  assert.equal(prepared.product.reference, original.reference);
  assert.equal(prepared.product.sourceUrl, original.url);
  assert.equal(JSON.stringify(original), snapshot);
});

test("acredita otra torre original y una unidad nueva con valores propios", () => {
  const second = accreditedSourceRecord("gomariz-special-original", "TO1242");
  const preparedSecond = prepareSourceProduct(second);
  assert.equal(preparedSecond.status, "ready");
  assert.match(preparedSecond.product.description_general ?? "", /4 × 400 W/u);
  assert.doesNotMatch(preparedSecond.product.description_general ?? "", /8,5 m|diésel|generador integrado/u);
  const next: ProductRecord = {
    ...newUnit(historicalTower(), "generac-vb9-nueva-unidad", "CONTROL-TORRE"),
    year: null,
    specs: {
      ...historicalTower().specs,
      "Altura de trabajo": "9.25 m", Potencia: "6 x 200 W", Peso: "910 kg"
    }
  };
  const result = prepareSourceProduct(next);
  assert.equal(result.status, "ready");
  assert.equal(resolveEditorialFacts(next)?.family, "torre-iluminacion");
  assert.match(result.product.description_general ?? "", /9,25 m.*6 × 200 W.*910 kg/u);
  assert.doesNotMatch(result.product.description_general ?? "", /8,5 m|4 × 120 W|945 kg|2015|generador integrado/u);
  assert.equal(resolveKnowledgeEditorial(next, next).fallbackGeneral, null);
});

test("excluye potencia con unidad distinta, identidad ajena y evidencia cruzada", () => {
  const base = newUnit(historicalTower(), "generac-vb9-otra-unidad", "CONTROL-OTRA-TORRE");
  const invalidW = { ...base, specs: { ...base.specs, Potencia: "4 x 120 kW" } };
  assert.doesNotMatch(resolveReusableEditorial(invalidW).general ?? "", /120 W|120 kW/u);
  const negated = { ...base, longDescription: "Esta unidad no incluye focos ni luminarias." };
  assert.doesNotMatch(resolveReusableEditorial(negated).general ?? "", /4 × 120 W/u);
  const conditional = { ...base, longDescription: "Esta versión podría equiparse con focos según disponibilidad." };
  assert.doesNotMatch(resolveReusableEditorial(conditional).general ?? "", /4 × 120 W/u);
  const differentSource = historicalTower();
  assert.doesNotMatch(resolveReusableEditorial(base, null, differentSource).general ?? "", /4 × 120 W|8,5 m/u);
  for (const invalid of [
    { ...base, providerId: "gam" },
    { ...base, url: "https://example.invalid/venta/torre-de-luz/generac-vb9/" },
    { ...base, model: "OTRO-MODELO" },
    { ...base, specs: { ...base.specs, Marca: "OTRA" } },
    { ...base, title: "Carretilla elevadora Generac VB9" }
  ]) {
    const general = resolveReusableEditorial(invalid).general;
    assert.doesNotMatch(general ?? "", /4 × 120 W|8,5 m/u);
    if (invalid.title === base.title) {
      assert.equal(resolveEditorialFacts(invalid), null);
      assert.equal(general, null);
      assert.equal(prepareSourceProduct(invalid).status, "review");
    }
  }
});

test("conserva capacidad y peso diferentes del dúmper histórico, sin confundirlos", () => {
  const original = historicalDumper();
  const snapshot = JSON.stringify(original);
  assert.match(resolveKnowledgeEditorial(original, original).fallbackGeneral ?? "", /2\.000 kg.*1\.600 kg/su);
  const facts = resolveEditorialFacts(original);
  assert.equal(facts?.family, "dumper");
  assert.equal(facts?.loadCapacityKg, 2000);
  assert.equal(facts?.weightKg, 1600);
  const prepared = prepareSourceProduct(original);
  assert.equal(prepared.status, "ready");
  assert.match(prepared.product.description ?? "", /capacidad de carga de 2\.000 kg/u);
  assert.match(prepared.product.description_general ?? "", /2\.000 kg.*1\.600 kg/u);
  assert.doesNotMatch(prepared.product.description_general ?? "", /volumen de tolva de|caja giratoria/u);
  assert.equal(JSON.stringify(original), snapshot);
});

test("reutiliza capacidad de origen en otra unidad sin copiar peso, año ni prueba firmada", () => {
  const next: ProductRecord = {
    ...newUnit(historicalDumper(), "ausa-d201rs-nueva-unidad", "CONTROL-DUMPER"),
    year: "2018",
    specs: { ...historicalDumper().specs, Capacidad: "2500 kg", Peso: "1800 kg", Longitud: "4.20 m" }
  };
  const facts = resolveEditorialFacts(next);
  assert.equal(facts?.family, "dumper");
  assert.equal(facts?.loadCapacityKg, 2500);
  assert.equal(facts?.weightKg, 1800);
  const prepared = prepareSourceProduct(next);
  assert.equal(prepared.status, "ready");
  assert.match(prepared.product.description_general ?? "", /2\.500 kg.*1\.800 kg.*4,2 m.*2018/u);
  assert.doesNotMatch(prepared.product.description_general ?? "", /2\.000 kg|1\.600 kg|2007/u);
  assert.equal(resolveKnowledgeEditorial(next, next).fallbackGeneral, null);
  assert.equal(prepared.product.sourceUrl, next.url);
});

test("rechaza capacidad en volumen, cifras contradictorias y proveedores o familias ajenos", () => {
  const base = newUnit(historicalDumper(), "ausa-d201rs-control-invalido", "CONTROL-DUMPER-NEG");
  for (const invalid of [
    { ...base, specs: { ...base.specs, Capacidad: "2000 l" } },
    { ...base, specs: { ...base.specs, Capacidad: "2000 m³" } },
    { ...base, providerId: "mercaeleva" },
    { ...base, url: "https://example.invalid/venta/dumper/ausa-d201rs" },
    { ...base, title: "Torre de iluminación Ausa D201RS" },
    { ...base, model: "OTRO-MODELO" }
  ]) {
    assert.equal(resolveEditorialFacts(invalid)?.loadCapacityKg ?? null, null);
    assert.doesNotMatch(resolveReusableEditorial(invalid).general ?? "", /capacidad de carga de 2\.000 kg/u);
  }
  const noCapacity = { ...base, specs: { ...base.specs, Capacidad: "750 litros" } };
  assert.doesNotMatch(prepareSourceProduct(noCapacity).product.description_general ?? "", /capacidad de carga de 750 kg/u);
});

test("protege originales GAM y la evidencia firmada de Mercaeleva", () => {
  const gam = accreditedSourceRecord("gam-original", "6207");
  const preparedGam = prepareSourceProduct(gam);
  assert.equal(resolveEditorialFacts(gam)?.loadCapacityKg, null);
  assert.match(preparedGam.product.description ?? "", /peso declarado de 1\.890 kg/u);
  assert.doesNotMatch(preparedGam.product.description_general ?? "", /capacidad de carga de 2\.000 kg/u);
  for (const ref of ["6559", "6560"]) {
    const source = accreditedSourceRecord("gam-original", ref);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready");
    assert.equal(prepared.product.sourceUrl, source.url);
    assert.match(prepared.product.description_general ?? "", ref === "6559" ? /Briggs&Stratton/u : /RATO/u);
    assert.doesNotMatch(prepared.product.description_general ?? "", ref === "6559" ? /gasolina RATO/u : /Briggs&Stratton/u);
  }
  const mercaeleva = accreditedSourceRecord("mercaeleva-original", "M736-5615");
  const signed = resolveKnowledgeEditorial(mercaeleva, mercaeleva);
  const sourceGeneral = signed.general ?? signed.fallbackGeneral;
  assert.match(sourceGeneral ?? "", /4\.500 kg.*180°/su);
  const preparedMercaeleva = prepareSourceProduct(mercaeleva);
  assert.equal(preparedMercaeleva.status, "ready");
  assert.equal(preparedMercaeleva.product.description_general, sourceGeneral);
  const foreign = { ...mercaeleva, reference: "CONTROL-MERCA-DUMPER",
    url: mercaeleva.url.replace("M736-5615", "CONTROL-MERCA-DUMPER") };
  const next = prepareSourceProduct(foreign);
  assert.doesNotMatch(next.product.description_general ?? "", /tolva con giro de hasta 180°/u);
  assert.equal(resolveKnowledgeEditorial(foreign, foreign).general, null);
});

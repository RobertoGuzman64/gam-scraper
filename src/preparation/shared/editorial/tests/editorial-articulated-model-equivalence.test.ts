import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { withoutContradictoryFamilyGeneral } from "../domain/editorial-source-family-general.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";

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

test("RE030: articuladas originales de tres proveedores preservan identidad, magnitudes y fuente", () => {
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

test("RE030: plantilla genérica diésel no contradice la motorización eléctrica acreditada", () => {
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

test("RE030: unidades nuevas de articulada consumen exclusivamente su ficha técnica", () => {
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

test("RE030: solo se omite la descripción genérica contradictoria; las objeciones de unidad permanecen", () => {
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

test("RE034: documentación técnica histórica se consume como referencia y no como dato de unidad", () => {
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

test("RE034: referencia reutilizable con unidad nueva compatible, sin trasladar condiciones particulares", () => {
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

test("RE034: modelo próximo, variante, magnitud, energía y procedencia impiden referencias falsas", () => {
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

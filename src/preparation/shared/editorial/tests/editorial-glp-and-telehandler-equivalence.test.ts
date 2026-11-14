import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";

const glpGam = accreditedSourceRecord("gam-original", "6682");
const glpVerifiedGam = accreditedSourceRecord("gam-original", "6644");
const manipulatorGam = accreditedSourceRecord("gam-original", "6391");
const manipulatorXcmg = accreditedSourceRecord("gam-original", "4817");
const manipulatorMercaeleva = accreditedSourceRecord("mercaeleva-original", "M200-9533");

const anotherUnit = (
  source: ProductRecord,
  reference: string,
  specs: NonNullable<ProductRecord["specs"]>
): ProductRecord => ({
  ...source,
  reference,
  url: source.providerId === "gam" ? source.url?.replace(`/${source.reference}-`, `/${reference}-`) ?? null :
    source.url?.replace(source.reference ?? "", reference) ?? null,
  shortDescription: null,
  longDescription: null,
  year: null,
  horometer: null,
  serialNumber: null,
  specs: { ...source.specs, ...specs }
});

test("RE020: la variante GLP histórica conserva su texto sin convertir el título en prueba técnica del motor", () => {
  const snapshot = JSON.stringify(glpGam);
  const facts = resolveEditorialFacts(glpGam);
  assert.equal(facts?.family, "carretilla-elevadora");
  assert.equal(facts?.energy, null);
  assert.doesNotMatch(resolveReusableEditorial(glpGam).general ?? "", /de GLP/u);
  const prepared = prepareSourceProduct(glpGam);
  assert.equal(prepared.status, "ready");
  assert.match(prepared.product.description ?? "", /de GLP/u);
  assert.equal(prepared.product.reference, glpGam.reference);
  assert.equal(JSON.stringify(glpGam), snapshot);
});

test("RE020: una unidad nueva con GLP corroborado reutiliza combustible, carga y elevación propios", () => {
  const incoming = anotherUnit(glpGam, "7682", {
    "Tipo motor": "GLP",
    "Altura de elevación (mm)": "3500 mm"
  });
  const snapshot = JSON.stringify(incoming);
  const facts = resolveEditorialFacts(incoming);
  assert.equal(facts?.energy, "GLP");
  assert.equal(facts?.loadCapacityKg, 3500);
  assert.equal(facts?.liftingHeightM, 3.5);
  const shared = resolveReusableEditorial(incoming);
  assert.match(shared.short ?? "", /Carretilla elevadora de GLP HYSTER H3\.5FT/u);
  assert.match(shared.general ?? "", /altura de elevación de 3,5 m/u);
  assert.doesNotMatch(shared.general ?? "", /altura de elevación de 3,11 m/u);
  const prepared = prepareSourceProduct(incoming);
  assert.equal(prepared.status, "ready");
  assert.match(prepared.product.description ?? "", /de GLP/u);
  assert.match(prepared.product.description_general ?? "", /altura de elevación de 3,5 m/u);
  assert.equal(prepared.product.sourceUrl, incoming.url);
  assert.equal(JSON.stringify(incoming), snapshot);
});

test("RE020: GLP ambiguo o discordante no autoriza afirmaciones compartidas", () => {
  const incoming = anotherUnit(glpGam, "7682", { "Tipo motor": "GLP" });
  for (const variant of [
    { ...incoming, specs: { ...incoming.specs, "Tipo motor": "Diésel" } },
    { ...incoming, specs: { ...incoming.specs, "Tipo motor": "Diésel / GLP" } },
    { ...incoming, specs: { ...incoming.specs, "Motorización": "Diésel" } },
    { ...incoming, title: "Carretilla elevadora GLP diésel 3500 Kg HYSTER H3.5FT" },
    { ...incoming, longDescription: "Carretilla elevadora HYSTER H3.5FT con motor diésel." },
    { ...incoming, brand: "OTRA MARCA" },
    { ...incoming, model: "H3.5FT-OTRA" },
    { ...incoming, url: "https://example.invalid/carretilla" }
  ]) {
    assert.equal(resolveEditorialFacts(variant), null);
    assert.deepEqual(resolveReusableEditorial(variant), { short: null, general: null });
  }
  const unverified = anotherUnit(glpGam, "7682", { "Altura de elevación (mm)": "3500 mm" });
  assert.equal(resolveEditorialFacts(unverified)?.energy, null);
  assert.doesNotMatch(resolveReusableEditorial(unverified).general ?? "", /de GLP/u);
  assert.equal(glpVerifiedGam.specs?.["Tipo motor"], "GLP");
});

test("RE042: manipuladores de GAM y Mercaeleva conservan familia y magnitudes de sus originales", () => {
  for (const { source, load, lifting } of [
    { source: manipulatorGam, load: 4000, lifting: 13 },
    { source: manipulatorXcmg, load: 4000, lifting: 14 },
    { source: manipulatorMercaeleva, load: 4000, lifting: 14 }
  ] as const) {
    const snapshot = JSON.stringify(source);
    const facts = resolveEditorialFacts(source);
    assert.equal(facts?.family, "manipulador-telescopico", source.reference ?? "");
    assert.equal(facts?.loadCapacityKg, load);
    assert.equal(facts?.liftingHeightM, lifting);
    assert.equal(facts?.workingHeightM, null);
    const shared = resolveReusableEditorial(source);
    assert.match(shared.short ?? "", /Manipulador telescópico/u);
    assert.match(shared.general ?? "", /capacidad de carga de 4\.000 kg/u);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready");
    assert.match(prepared.product.description_general ?? "", /4\.000 kg/u);
    assert.equal(prepared.product.reference, source.reference);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("RE042: las nuevas referencias reutilizan el motor sin heredar alturas ni horas históricas", () => {
  for (const { source, reference, height, key, expected, previous } of [
    { source: manipulatorGam, reference: "7391", height: "15 metros", key: "Altura de elevación (m)", expected: "15 m", previous: "13 m" },
    { source: manipulatorXcmg, reference: "5817", height: "16 metros", key: "Altura de elevación (m)", expected: "16 m", previous: "14 m" },
    { source: manipulatorMercaeleva, reference: "M800-9533", height: "12 m", key: "Altura máxima de elevación", expected: "12 m", previous: "14 m" }
  ] as const) {
    const base = anotherUnit(source, reference, { [key]: height });
    const incoming = {
      ...base,
      title: source === manipulatorGam ? base.title?.replace("13M", "15M") ?? null :
        source === manipulatorMercaeleva ? base.title?.replace("14 MT", "12 MT") ?? null : base.title
    };
    const snapshot = JSON.stringify(incoming);
    const facts = resolveEditorialFacts(incoming);
    assert.equal(facts?.family, "manipulador-telescopico");
    assert.match(resolveReusableEditorial(incoming).general ?? "", new RegExp(`altura de elevación de ${expected}`));
    assert.doesNotMatch(resolveReusableEditorial(incoming).general ?? "", new RegExp(`altura de elevación de ${previous}`));
    const prepared = prepareSourceProduct(incoming);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.reference, reference);
    assert.equal(prepared.product.sourceUrl, incoming.url);
    assert.match(prepared.product.description_general ?? "", new RegExp(`altura de elevación de ${expected}`));
    assert.equal(JSON.stringify(incoming), snapshot);
  }
});

test("RE042: fuentes, identidades y conceptos incompatibles no generan hechos del manipulador", () => {
  for (const source of [manipulatorGam, manipulatorXcmg, manipulatorMercaeleva]) {
    for (const variant of [
      { ...source, providerId: "desconocido" },
      { ...source, url: "https://example.invalid/manipulador" },
      { ...source, brand: "OTRA MARCA" },
      { ...source, model: "OTRO MODELO" },
      { ...source, specs: { ...source.specs, Modelo: "OTRO MODELO" } },
      { ...source, specs: { ...source.specs, "Título adicional": "Plataforma de tijera eléctrica" } }
    ]) {
      assert.equal(resolveEditorialFacts(variant), null, source.reference ?? "");
      assert.deepEqual(resolveReusableEditorial(variant), { short: null, general: null });
    }
  }
  const invalidHeight = {
    ...manipulatorGam,
    specs: { ...manipulatorGam.specs, "Altura de elevación (m)": "13 kg" }
  };
  assert.equal(resolveEditorialFacts(invalidHeight)?.liftingHeightM, null);
  assert.doesNotMatch(resolveReusableEditorial(invalidHeight).general ?? "", /altura de elevación/u);
  assert.match(resolveReusableEditorial(invalidHeight).general ?? "", /capacidad de carga de 4\.000 kg/u);
  const invalidLoad = {
    ...manipulatorXcmg,
    specs: { ...manipulatorXcmg.specs, "Capacidad de carga (kg)": "4000 m" }
  };
  assert.equal(resolveEditorialFacts(invalidLoad), null);
  assert.deepEqual(resolveReusableEditorial(invalidLoad), { short: null, general: null });
});

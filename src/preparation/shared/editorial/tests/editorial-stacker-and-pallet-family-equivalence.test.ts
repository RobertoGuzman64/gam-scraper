import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { editorialFamilyIsMasculine } from "../domain/editorial-families.js";

const stackerGam = accreditedSourceRecord("gam-original", "6663");
const stackerMercaeleva = accreditedSourceRecord("mercaeleva-original", "M288-9739");
const palletGam = accreditedSourceRecord("gam-original", "6691");
const palletMercaeleva = accreditedSourceRecord("mercaeleva-original", "M168-3277");

const nextUnit = (source: ProductRecord, reference: string, specs: NonNullable<ProductRecord["specs"]>): ProductRecord => ({
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

test("RE038: apiladores GAM y Mercaeleva componen elevación y carga con una familia compartida", () => {
  for (const [source, elevation, capacity, preparedHeight] of [
    [stackerGam, 2.95, 1400, "altura de elevación de 2,95 m"],
    [stackerMercaeleva, 3.6, 1200, "3.600 mm de elevación"]
  ] as const) {
    const snapshot = JSON.stringify(source);
    const facts = resolveEditorialFacts(source);
    assert.equal(facts?.family, "apilador");
    assert.equal(facts.liftingHeightM, elevation);
    assert.equal(facts.loadCapacityKg, capacity);
    const shared = resolveReusableEditorial(source);
    assert.match(shared.short ?? "", /Apilador /u);
    assert.match(shared.general ?? "", /altura de elevación de /u);
    assert.match(shared.general ?? "", /capacidad de carga de /u);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready");
    assert.ok(prepared.product.description_general?.includes(preparedHeight));
    assert.equal(prepared.product.reference, source.reference);
    assert.equal(JSON.stringify(source), snapshot);
  }
  const gamPrepared = prepareSourceProduct(stackerGam).product.description ?? "";
  assert.match(gamPrepared, /Apilador eléctrico /u);
  assert.doesNotMatch(gamPrepared, /Apilador eléctrica /u);
});

test("RE039: transpaletas GAM y Mercaeleva reutilizan su carga sin atribuir elevación de apilador", () => {
  for (const [source, load] of [[palletGam, 1400], [palletMercaeleva, 2000]] as const) {
    const snapshot = JSON.stringify(source);
    const facts = resolveEditorialFacts(source);
    assert.equal(facts?.family, "transpaleta");
    assert.equal(facts.loadCapacityKg, load);
    assert.equal(facts.liftingHeightM, null);
    const shared = resolveReusableEditorial(source);
    assert.match(shared.short ?? "", /Transpaleta /u);
    assert.match(shared.general ?? "", /capacidad de carga de /u);
    assert.doesNotMatch(shared.general ?? "", /altura de elevación/u);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready");
    assert.match(prepared.product.description_general ?? "", /capacidad de carga de /u);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("RE038–RE039: nuevas unidades compatibles reciben solo sus medidas propias", () => {
  const cases = [
    { source: stackerGam, reference: "7663", specs: { "Altura de elevación (mm)": "3550 mm" },
      claim: "altura de elevación de 3,55 m", previous: "altura de elevación de 2,95 m" },
    { source: stackerMercaeleva, reference: "M888-9739", specs: { "Altura máxima de elevación": "4000 mm" },
      claim: "altura de elevación de 4 m", previous: "altura de elevación de 3,6 m" },
    { source: palletGam, reference: "7691", specs: { Longitud: "1700 mm" },
      claim: "longitud de 1,7 m", previous: "longitud de 1,5 m" },
    { source: palletMercaeleva, reference: "M868-3277", specs: { "Voltaje de la batería": "48 V" },
      claim: "voltaje declarado de 48 V", previous: "voltaje declarado de 24 V" }
  ] as const;
  for (const { source, reference, specs, claim, previous } of cases) {
    const incoming = nextUnit(source, reference, specs);
    const snapshot = JSON.stringify(incoming);
    const shared = resolveReusableEditorial(incoming);
    assert.match(shared.general ?? "", new RegExp(claim, "u"), reference);
    assert.doesNotMatch(shared.general ?? "", new RegExp(previous, "u"), reference);
    const prepared = prepareSourceProduct(incoming);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.reference, reference);
    assert.equal(prepared.product.sourceUrl, incoming.url);
    assert.match(prepared.product.description_general ?? "", new RegExp(claim, "u"), reference);
    assert.equal(JSON.stringify(incoming), snapshot);
  }
});

test("RE038–RE039: identidades, fuentes y familias ajenas no reciben hechos compartidos", () => {
  for (const source of [stackerGam, stackerMercaeleva, palletGam, palletMercaeleva]) {
    for (const invalid of [
      { ...source, providerId: "desconocido" },
      { ...source, url: "https://example.invalid/maquina" },
      { ...source, brand: "MARCA-DIFERENTE" },
      { ...source, model: "MODELO-DIFERENTE" },
      { ...source, specs: { ...source.specs, Modelo: "MODELO-DIFERENTE" } },
      { ...source, specs: { ...source.specs, "Título adicional": source.title?.toLocaleLowerCase("es").includes("apilador") ?
        "TRANSPALETA ELÉCTRICA" : "APILADOR ELÉCTRICO" } }
    ]) {
      assert.equal(resolveEditorialFacts(invalid), null, `${source.reference} / ${invalid.providerId}`);
      assert.deepEqual(resolveReusableEditorial(invalid), { short: null, general: null });
    }
  }
});

test("RE038–RE039: medidas incompatibles y ausencia de prestaciones no se convierten en afirmaciones", () => {
  const invalidStacker = { ...stackerGam, specs: { ...stackerGam.specs, "Altura de elevación (mm)": "3550 kg" } };
  assert.equal(resolveEditorialFacts(invalidStacker)?.liftingHeightM ?? null, null);
  assert.doesNotMatch(resolveReusableEditorial(invalidStacker).general ?? "", /altura de elevación/u);
  const invalidPallet = { ...palletGam, specs: { ...palletGam.specs, "Capacidad de carga (kg)": "1400 m" } };
  assert.equal(resolveEditorialFacts(invalidPallet)?.loadCapacityKg ?? null, null);
  assert.doesNotMatch(resolveReusableEditorial(invalidPallet).general ?? "", /capacidad de carga/u);
  const missingVoltage = { ...palletMercaeleva, specs: { ...palletMercaeleva.specs } };
  delete missingVoltage.specs["Voltaje de la batería"];
  assert.equal(resolveEditorialFacts(missingVoltage)?.voltageV ?? null, null);
  assert.doesNotMatch(resolveReusableEditorial(missingVoltage).general ?? "", /voltaje declarado/u);
});

test("la concordancia del motor respeta el género de las familias sin reglas por proveedor", () => {
  for (const family of ["apilador", "recogepedidos", "manipulador-telescopico", "tractor-arrastre"] as const) {
    assert.equal(editorialFamilyIsMasculine(family), true);
  }
  for (const family of ["transpaleta", "carretilla-elevadora", "plataforma-tijera", "fregadora"] as const) {
    assert.equal(editorialFamilyIsMasculine(family), false);
  }
  const prepared = prepareSourceProduct(stackerGam);
  assert.match(prepared.product.description_general ?? "", /apilador eléctrico /u);
  assert.doesNotMatch(prepared.product.description_general ?? "", /apilador eléctrica /u);
});

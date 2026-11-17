import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveSourcedOperationalSpecs } from "../domain/editorial-sourced-operational-specs.js";
import { resolveSourcedShortContext } from "../domain/editorial-source-short-context.js";
import { resolveSourcedShortSummary } from "../domain/editorial-source-short-summary.js";
import { resolveSourcedShortClaimsGeneral } from "../domain/editorial-sourced-short-claims.js";
import { controlledGamForklift } from "./editorial-contract-records.js";

const gamRecord = (reference: string): ProductRecord => accreditedSourceRecord("gam-original", reference);

const batterySource = (): ProductRecord => ({
  ...controlledGamForklift(),
  title: "Apilador eléctrico MARCA MODELO10",
  brand: "MARCA",
  model: "MODELO10",
  specs: {
    Marca: "MARCA", Modelo: "MODELO10",
    "Capacidad de la batería": "24 V / 315-375 Ah | Li-ion 24 V / 300 Ah (V/Ah)"
  }
});

const batteryGeneral = "La ficha técnica del apilador MARCA MODELO10 describe el trabajo en almacenes y la manipulación de cargas paletizadas.";

test("las baterías alternativas proceden de la misma ficha y no se presentan como instaladas", () => {
  const source = batterySource();
  const original = JSON.stringify(source);
  const result = resolveSourcedOperationalSpecs(source, source, batteryGeneral, true) ?? "";
  assert.match(result, /entre 315 y 375 Ah/u);
  assert.match(result, /ion-litio de 300 Ah/u);
  assert.match(result, /batería instalada debe comprobarse/u);
  assert.equal(resolveSourcedOperationalSpecs(source, source, result, true), null);
  assert.equal(JSON.stringify(source), original);
});

test("no atribuye baterías a referencias, versiones, proveedores o especificaciones distintos", () => {
  const source = batterySource();
  const variants: readonly ProductRecord[] = [
    { ...source, providerId: "gomariz" },
    { ...source, reference: "OTRA-UNIDAD" },
    { ...source, url: "https://online.gamrentals.com/es/carretillas/OTRA-UNIDAD" },
    { ...source, model: "MODELO11", title: "Apilador eléctrico MARCA MODELO11" },
    { ...source, condition: "Nuevo" },
    { ...source, specs: { ...source.specs, "Capacidad de la batería": "24 V / 210-250 Ah | Li-ion 24 V / 200 Ah (V/Ah)" } }
  ];
  for (const variant of variants) {
    assert.equal(resolveSourcedOperationalSpecs(source, variant, batteryGeneral, source.providerId === variant.providerId), null);
  }
  assert.equal(resolveSourcedOperationalSpecs(source, source, batteryGeneral, false), null);
  assert.equal(resolveSourcedOperationalSpecs(source, source, `${batteryGeneral} La batería es opcional.`, true), null);
  assert.equal(resolveSourcedOperationalSpecs({ ...source, model: "OTRA" }, source, batteryGeneral, true), null);
});

test("la corta del tren logístico pasa a su descripción general sin mezclar modelos", () => {
  for (const reference of ["297", "298", "299"]) {
    const source = gamRecord(reference);
    const general = "Tecnacar es fabricante de trenes logísticos: soluciones adaptables a usos industriales y logísticos.";
    const result = resolveSourcedShortContext(source, source, general, true) ?? "";
    assert.ok(result.includes(source.shortDescription ?? ""), reference);
    assert.match(result, /esta referencia añade/u);
    assert.equal(resolveSourcedShortContext(source, source, result, true), null);
    for (const variant of [
      { ...source, reference: "OTRA" },
      { ...source, providerId: "gomariz" },
      { ...source, model: "OTRO" },
      { ...source, specs: { ...source.specs, Modelo: "OTRO" } },
      { ...source, url: "https://online.gamrentals.com/es/otra" }
    ]) assert.equal(resolveSourcedShortContext(source, variant, general, source.providerId === variant.providerId), null);
  }
});

test("no incorpora cortas promocionales, opcionales ni procedentes de otra unidad", () => {
  const source = gamRecord("298");
  const general = "Tecnacar fabrica trenes logísticos para uso industrial con diferentes variantes.";
  assert.equal(resolveSourcedShortContext(source, source, general, false), null);
  assert.equal(resolveSourcedShortContext({ ...source, shortDescription: `${source.shortDescription} Descuento especial.` },
    source, general, true), null);
  assert.equal(resolveSourcedShortContext({ ...source, shortDescription: `${source.shortDescription} Bajo pedido https://example.com` },
    source, general, true), null);
  assert.equal(resolveSourcedShortContext(source, source, null, true), null);
});

test("las cifras de las cortas largas se conservan como declaración de su anuncio antes de resumir", () => {
  for (const { reference, expected } of [
    { reference: "4018", expected: /depósito de solución de 303 litros/u },
    { reference: "6805", expected: /60 V y 24 Ah/u },
    { reference: "6811", expected: /7 kW nominales y 9 kW de pico/u }
  ] as const) {
    const source = gamRecord(reference);
    const first = source.shortDescription?.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜÑ0-9])/u)[0] ?? "";
    const general = `${first} La fuente anuncia el modelo y su aplicación.`;
    const result = resolveSourcedShortClaimsGeneral(source, source, general, true) ?? "";
    assert.match(result, expected);
    assert.match(result, /comproba|confirmarse/u);
    assert.equal(resolveSourcedShortClaimsGeneral(source, source, result, true), null);
    assert.equal(resolveSourcedShortClaimsGeneral(source, { ...source, reference: "OTRO" }, general, true), null);
    assert.equal(resolveSourcedShortClaimsGeneral(source, { ...source, providerId: "gomariz" }, general, false), null);
    assert.equal(resolveSourcedShortClaimsGeneral(source, source, general, false), null);
  }
});

test("cifras opcionales y diferencias en la fuente no se convierten en equipamiento declarado", () => {
  const source = gamRecord("4018");
  const general = "La fregadora TENNANT FCS T20 C se destina a tareas de limpieza industrial.";
  const optional = { ...source, shortDescription: `${source.shortDescription} Accesorios opcionales.` };
  assert.equal(resolveSourcedShortClaimsGeneral(optional, optional, general, true), null);
  assert.equal(resolveSourcedShortClaimsGeneral(source, { ...source, url: "https://example.com/otra" }, general, true), null);
  assert.equal(resolveSourcedShortClaimsGeneral(source, { ...source, model: "OTRO" }, general, true), null);
});

test("la corta se resume si los números y la tecnología permanecen en la general", () => {
  for (const reference of ["4018", "6805", "6811", "6190"]) {
    const source = gamRecord(reference);
    const prepared = prepareSourceProduct(source);
    const short = source.shortDescription;
    const general = prepared.product.description_general;
    assert.ok(short && general, reference);
    const result = resolveSourcedShortSummary(source, source, short, general, true);
    assert.ok(result && result.split(/\s+/u).length <= 45, reference);
    assert.ok(result.length < short.length, reference);
    assert.equal(resolveSourcedShortSummary(source, source, result, general, true), null);
    assert.equal(resolveSourcedShortSummary(source, { ...source, reference: "OTRA" }, short, general, true), null);
    assert.equal(resolveSourcedShortSummary(source, { ...source, providerId: "gomariz" }, short, general, false), null);
    assert.equal(resolveSourcedShortSummary(source, source, short, general, false), null);
  }
});

test("rechaza resumir cifras o tecnologías que no retiene el texto general", () => {
  const source = gamRecord("4018");
  const short = source.shortDescription;
  assert.ok(short);
  const general = "Esta fregadora de la misma referencia permite la limpieza de zonas industriales y comerciales.";
  assert.equal(resolveSourcedShortSummary(source, source, short, general, true), null);
  assert.equal(resolveSourcedShortSummary(source, source, `${short} La unidad tiene 9999 kW.`, general, true), null);
  assert.equal(resolveSourcedShortSummary(source, source, short, null, true), null);
  assert.equal(resolveSourcedShortSummary({ ...source, shortDescription: "Anuncio de otro modelo." }, source, short, general, true), null);
});

test("la preparación mantiene intacta la identidad técnica y los estados de las fichas recuperadas", () => {
  for (const reference of ["297", "298", "299", "2251", "4018", "6805", "6811", "6190"]) {
    const source = gamRecord(reference);
    const previous = JSON.stringify(source);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.product.reference, reference);
    assert.equal(prepared.product.sourceUrl, source.url);
    assert.equal(prepared.product.title, prepared.product.description_title);
    assert.equal(JSON.stringify(source), previous);
    assert.ok(prepared.product.description?.trim());
    assert.ok(prepared.product.description_general?.trim());
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { resolveSourceEditorialClaims } from "../domain/editorial-source-claims.js";
import { resolveDocumentedBatteryConfiguration } from "../domain/editorial-battery-claims.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { compressVerifiedSourceShort } from "../domain/editorial-source-brief.js";

const original = (provider: string, reference: string): ProductRecord => {
  if (provider === "gam") return accreditedSourceRecord("gam-original", reference);
  if (provider === "gomariz") return accreditedSourceRecord("gomariz-original", reference);
  if (provider === "mercaeleva") return accreditedSourceRecord("mercaeleva-original", reference);
  throw new Error(`Proveedor desconocido: ${provider}`);
};

test("la tensión afirmada de batería se reutiliza por fuente, no por proveedor ni referencia", () => {
  const examples = [original("gam", "6901"), original("mercaeleva", "M288-9739")];
  for (const record of examples) {
    const source: ProductRecord = {
      ...record,
      longDescription: "La batería incorporada funciona con una tensión de 24 V.",
      specs: { ...record.specs, "Voltaje de la batería": "24 V" }
    };
    const general = "La ficha de esta máquina describe sus características técnicas.";
    assert.match(resolveSourceEditorialClaims(source, source, general) ?? "", /tensión de batería de 24 V/u);
    const optional = { ...source, longDescription: "La batería de 24 V es opcional según la versión." };
    assert.equal(resolveSourceEditorialClaims(optional, optional, general), general);
    const mixed = { ...source, longDescription: "La batería incorporada funciona a 24 V. Otra batería funciona a 48 V." };
    assert.equal(resolveSourceEditorialClaims(mixed, mixed, general), general);
    assert.equal(resolveSourceEditorialClaims(source, source, `${general} Voltaje general de 48 V.`), `${general} Voltaje general de 48 V.`);
    const incompatible = { ...source, specs: { ...source.specs, "Voltaje de la batería": "48 V" } };
    assert.equal(resolveSourceEditorialClaims(source, incompatible, general), general);
    const falsified = { ...source, url: "https://example.invalid/otra-maquina" };
    assert.equal(resolveSourceEditorialClaims(falsified, falsified, general), general);
    assert.equal(resolveSourceEditorialClaims(source, source, `${general} Batería de 24 V.`), `${general} Batería de 24 V.`);
  }
});

test("la compresión compartida conserva los hechos omitidos en la general y rechaza pérdidas", () => {
  const record = original("gam", "6218");
  const first = "La LVNENG LX05 es un ciclomotor eléctrico compacto y eficiente para uso urbano, con un diseño práctico para circular en ciudad.";
  const repeated = "Su diseño compacto facilita los desplazamientos cotidianos, y su propulsión eléctrica favorece una circulación silenciosa en zonas urbanas. ";
  const source = { ...record, shortDescription: `${first} ${repeated.repeat(3).trim()}` };
  const general = "La LVNENG LX05 es un ciclomotor eléctrico de diseño compacto para circulación urbana, con propulsión eléctrica silenciosa y mantenimiento práctico.";
  assert.ok((source.shortDescription ?? "").split(/\s+/u).length > 45);
  assert.equal(compressVerifiedSourceShort(source, source.shortDescription, general), first);
  const lost = { ...source, shortDescription: `${source.shortDescription} También incorpora 9999 unidades adicionales.` };
  assert.equal(compressVerifiedSourceShort(lost, lost.shortDescription, general), null);
  assert.equal(compressVerifiedSourceShort(source, "Resumen independiente del anuncio.", general), null);
  assert.equal(compressVerifiedSourceShort({ ...source, model: "OTRO" }, source.shortDescription, general), null);
  assert.equal(compressVerifiedSourceShort({ ...source, url: "https://example.invalid/6218" }, source.shortDescription, general), null);
});


const relatedBatteryUnit = (source: ProductRecord): ProductRecord => ({
  ...source,
  reference: `${source.reference}-OTRA`,
  url: source.url.replace(source.reference ?? "", `${source.reference}-OTRA`),
  shortDescription: null,
  longDescription: null,
  year: null
});

test("RE021 preserva tecnología, tensión y capacidad de batería en unidades nuevas compatibles", () => {
  for (const [reference, type, voltage, capacity] of [
    ["M288-9739", "ion-litio", 24, 100],
    ["M119-9334", "ion-litio", 48, 30]
  ] as const) {
    const source = original("mercaeleva", reference);
    const snapshot = JSON.stringify(source);
    const historical = prepareSourceProduct(source);
    assert.equal(historical.status, "ready");
    assert.match(historical.product.description_general ?? "", /bater[ií]a/u);
    const compatible = relatedBatteryUnit(source);
    const facts = resolveEditorialFacts(compatible);
    assert.ok(facts);
    assert.equal(facts.voltageV, voltage);
    const battery = `batería de ${type} con capacidad declarada de ${capacity} Ah`;
    assert.ok(resolveReusableEditorial(compatible).general?.includes(`voltaje declarado de ${voltage} V`));
    assert.ok(resolveReusableEditorial(compatible).general?.includes(battery));
    const prepared = prepareSourceProduct(compatible);
    if (reference === "M288-9739") assert.equal(prepared.status, "ready");
    else {
      assert.equal(prepared.status, "review");
      assert.ok(prepared.issues.some((issue) => issue.includes("Capacidad de carga")));
    }
    assert.ok(prepared.product.description_general?.includes(battery));
    assert.equal(prepared.product.reference, compatible.reference);
    assert.equal(prepared.product.sourceUrl, compatible.url);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("RE021 atribuye solo la configuración declarada para la unidad nueva", () => {
  const source = original("mercaeleva", "M288-9739");
  const unit = relatedBatteryUnit(source);
  const changed: ProductRecord = {
    ...unit,
    specs: { ...unit.specs, "Capacidad de la batería": "205 Ah" }
  };
  const general = prepareSourceProduct(changed).product.description_general ?? "";
  assert.match(general, /voltaje declarado de 24 V y batería de ion-litio con capacidad declarada de 205 Ah/u);
  assert.doesNotMatch(general, /100 Ah/u);
  assert.equal(resolveDocumentedBatteryConfiguration(source, changed, "apilador", 24), null);
  assert.equal(resolveDocumentedBatteryConfiguration(source, unit, "apilador", 24), null);
  assert.equal(resolveDocumentedBatteryConfiguration(unit, unit, "apilador", 48), null);
  assert.equal(resolveDocumentedBatteryConfiguration(unit, unit, "plataforma-tijera", 24), null);
  const differentReference: ProductRecord = { ...unit, reference: "M288-9739-AJENA" };
  assert.equal(resolveDocumentedBatteryConfiguration(unit, differentReference, "apilador", 24), null);
  const differentOrigin: ProductRecord = { ...unit, providerId: "gam" };
  assert.equal(resolveDocumentedBatteryConfiguration(unit, differentOrigin, "apilador", 24), null);
  const differentModel: ProductRecord = { ...unit, model: "ESL123" };
  assert.equal(resolveDocumentedBatteryConfiguration(unit, differentModel, "apilador", 24), null);
});

test("RE021 bloquea opciones, ambigüedades y unidades de magnitud incompatibles", () => {
  const source = relatedBatteryUnit(original("mercaeleva", "M288-9739"));
  for (const text of [
    "La batería de 24 V es opcional según la versión.",
    "La batería de 24 V no se incluye en esta unidad.",
    "El equipo puede montar batería de 24 V bajo pedido."
  ]) {
    const conditional: ProductRecord = { ...source, longDescription: text };
    assert.equal(resolveDocumentedBatteryConfiguration(conditional, conditional, "apilador", 24), null);
    assert.doesNotMatch(resolveReusableEditorial(conditional).general ?? "", /batería de ion-litio/u);
  }
  for (const specifications of [
    { "Voltaje de la batería": "24 A" },
    { "Capacidad de la batería": "100 Wh" },
    { "Capacidad de la batería": "100 Ah o 205 Ah" },
    { "Tipo de Batería": "Opcional" }
  ]) {
    const invalid: ProductRecord = { ...source, specs: { ...source.specs, ...specifications } };
    assert.doesNotMatch(resolveReusableEditorial(invalid).general ?? "", /batería de ion-litio/u);
  }
  const specsWithoutBattery = { ...source.specs };
  delete specsWithoutBattery["Tipo de Batería"];
  const withoutBattery: ProductRecord = { ...source, specs: specsWithoutBattery };
  assert.doesNotMatch(resolveReusableEditorial(withoutBattery).general ?? "", /batería de ion-litio/u);
  const charger: ProductRecord = { ...source, specs: { ...source.specs, "Voltaje del cargador": "220 V" } };
  assert.match(resolveReusableEditorial(charger).general ?? "", /batería de ion-litio con capacidad declarada de 100 Ah/u);
  assert.doesNotMatch(resolveReusableEditorial(charger).general ?? "", /voltaje declarado de 220 V/u);
});

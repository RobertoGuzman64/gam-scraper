import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { resolveSourceEditorialClaims } from "../domain/editorial-source-claims.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import {
  controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift,
  controlledGomarizPlatform, controlledMercaelevaPlatform
} from "./editorial-contract-records.js";

const general = "La ficha técnica identifica las prestaciones documentadas del equipo.";

const claim = (record: ProductRecord, longDescription: string): ProductRecord => ({
  ...record, longDescription
});

test("las prestaciones afirmadas se comparten entre proveedores sin convertir opciones en equipamiento confirmado", () => {
  for (const source of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const before = JSON.stringify(source);
    const declared = claim(source, "La carretilla incorpora frenado regenerativo y dirección asistida.");
    const text = resolveSourceEditorialClaims(declared, declared, general) ?? "";
    assert.match(text, /frenado regenerativo/u);
    assert.match(text, /dirección asistida/u);
    for (const ambiguous of [
      "La carretilla incorpora frenado regenerativo, disponible bajo pedido.",
      "La carretilla dispone de frenado regenerativo, no está incluido en la unidad ofertada.",
      "La carretilla tiene frenado regenerativo, aunque se suministra por separado.",
      "La carretilla incluye frenado regenerativo según la versión.",
      "La carretilla declara frenado regenerativo en una variante opcional.",
      "La carretilla puede equipar frenado regenerativo.",
      "La carretilla incorpora frenado regenerativo, pendiente de confirmar.",
      "La carretilla no incluye frenado regenerativo."
    ]) {
      const option = claim(source, ambiguous);
      assert.equal(resolveSourceEditorialClaims(option, option, general), general, ambiguous);
    }
    const durable = claim(source, "El frenado automático regenerativo no sufre desgaste. La dirección asistida permite conducir sin esfuerzo.");
    const durableText = resolveSourceEditorialClaims(durable, durable, general) ?? "";
    assert.match(durableText, /frenado automático/u);
    assert.match(durableText, /dirección asistida/u);
    assert.equal(JSON.stringify(source), before);
  }
});

test("la negación de una prestación no se propaga aunque otra afirmación independiente sea válida", () => {
  for (const source of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const record = claim(source, "La carretilla incorpora dirección asistida. El frenado regenerativo no está incluido.");
    const result = resolveSourceEditorialClaims(record, record, general) ?? "";
    assert.match(result, /declara dirección asistida/u);
    assert.doesNotMatch(result, /declara frenado regenerativo/u);
    const contradictory = claim(source,
      "La carretilla incorpora dirección asistida. La dirección asistida no está incluida en esta configuración.");
    assert.equal(resolveSourceEditorialClaims(contradictory, contradictory, general), general);
    const deniedSpec = { ...record, specs: { ...record.specs, "Dirección asistida": false } };
    assert.equal(resolveSourceEditorialClaims(deniedSpec, deniedSpec, general), general);
  }
});

test("las características de plataformas no se atribuyen a unidades nuevas ni a versiones opcionales", () => {
  for (const original of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const asserted = claim(original, "La plataforma incorpora plataforma extensible y ruedas antihuellas.");
    const result = resolveSourceEditorialClaims(asserted, asserted, general) ?? "";
    assert.match(result, /plataforma extensible/u);
    assert.match(result, /ruedas antihuellas/u);
    assert.match(result, /deben comprobarse para esta unidad/u);
    const conditional = claim(original, "La plataforma extensible está disponible bajo pedido. Las ruedas antihuellas no están incluidas.");
    assert.equal(resolveSourceEditorialClaims(conditional, conditional, general), general);
    assert.equal(resolveSourceEditorialClaims(asserted, { ...asserted, reference: "OTRA-UNIDAD" }, general), general);
    assert.equal(resolveSourceEditorialClaims(asserted, { ...asserted, model: "OTRA-VARIANTE" }, general), general);
  }
});

test("la tensión de batería requiere acuerdo de todos los aliases y una declaración no condicional", () => {
  for (const base of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const source: ProductRecord = {
      ...base,
      specs: { ...base.specs, "Voltaje de la batería": "24 V", "Voltaje batería (V)": "24 V" },
      longDescription: "La batería incorporada funciona a 24 V."
    };
    assert.match(resolveSourceEditorialClaims(source, source, general) ?? "", /tensión de batería de 24 V/u);
    for (const specs of [
      { ...source.specs, "Voltaje batería (V)": "48 V" },
      { ...source.specs, "Voltaje": "80 V" },
      { ...source.specs, "Voltaje de la batería": "24 V", "Voltaje batería (V)": "sin datos" }
    ]) {
      const incompatible = { ...source, specs };
      assert.equal(resolveSourceEditorialClaims(incompatible, incompatible, general), general);
    }
    for (const alternative of [
      "La batería de 24 V se suministra por separado.",
      "La batería de 24 V no está incluida.",
      "La batería de 24 V está disponible bajo pedido.",
      "La batería de 24 V solo se incluye según la versión.",
      "La carretilla se entrega sin batería; la ficha contempla 24 V.",
      "Puede equiparse con batería de 24 V."
    ]) {
      const conditional = claim(source, alternative);
      assert.equal(resolveSourceEditorialClaims(conditional, conditional, general), general);
    }
    const differentUnit = { ...source, reference: `${source.reference}-NUEVA` };
    assert.equal(resolveSourceEditorialClaims(source, differentUnit, general), general);
  }
});

test("la preparación mantiene una única autoridad narrativa y no recupera prestaciones desmentidas", () => {
  const source = claim(controlledGomarizPlatform(),
    "Plataforma de tijera MARCA MODELO10 con plataforma extensible, disponible como opción.");
  const result = prepareSourceProduct(source).product.description_general ?? "";
  assert.doesNotMatch(result, /El proveedor menciona plataforma extensible/u);
  const asserted = claim(source, "Plataforma de tijera MARCA MODELO10 con plataforma extensible incluida.");
  assert.match(prepareSourceProduct(asserted).product.description_general ?? "", /El proveedor menciona plataforma extensible/u);
});

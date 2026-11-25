import assert from "node:assert/strict";
import test from "node:test";
import { resolveSourcedOperationalFeatures } from "./editorial-sourced-operational-features.js";
import { controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift, controlledGomarizPlatform } from "../../core/editorial-contract-records.js";
import { operationalGeneral, operationalDescription } from "./equipment-details-fixture.js";

test("recupera equipamiento operativo declarado sin certificar la configuración de la unidad", () => {
  for (const base of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const source = { ...base, longDescription: operationalDescription("El equipo dispone de freno automático, alarma de inclinación y sistema de diagnóstico.") };
    const result = resolveSourcedOperationalFeatures(source, source, operationalGeneral, true);
    assert.ok(result, base.providerId);
    assert.ok(result.startsWith(operationalGeneral));
    assert.match(result, /freno automático, alarma de inclinación y sistema de diagnóstico/u);
    assert.match(result, /conviene comprobar la disponibilidad y configuración/u);
    assert.doesNotMatch(result, /(?:documentadas en el anuncio|descripción del proveedor menciona)/iu);
    assert.equal(resolveSourcedOperationalFeatures(source, source, result, true), null);
    assert.equal(resolveSourcedOperationalFeatures(source, source, operationalGeneral, false), null);
    assert.equal(resolveSourcedOperationalFeatures(source, { ...source, reference: "OTRA" }, operationalGeneral, true), null);
  }
});

test("no incorpora equipamiento opcional, ausente o ya narrado ni desplaza menciones previas", () => {
  const base = controlledGamForklift();
  for (const claim of ["El freno automático es opcional.", "No dispone de alarma de inclinación.", "Puede incorporar un sistema de diagnóstico."]) {
    const source = { ...base, longDescription: operationalDescription(claim) };
    assert.equal(resolveSourcedOperationalFeatures(source, source, operationalGeneral, true), null, claim);
  }
  const source = { ...base, longDescription: operationalDescription("Dispone de freno automático, alarma de inclinación y sistema de diagnóstico. Incorpora dirección asistida, control proporcional y sistema de baja velocidad.") };
  const result = resolveSourcedOperationalFeatures(source, source, operationalGeneral, true);
  assert.match(result ?? "", /dirección asistida, control proporcional y sistema de baja velocidad/u);
  assert.doesNotMatch(result ?? "", /freno automático|alarma de inclinación|sistema de diagnóstico/u);
  const brake = { ...base, longDescription: operationalDescription("Dispone de freno automático.") };
  assert.equal(resolveSourcedOperationalFeatures(brake, brake, `${operationalGeneral} Dispone de frenado automático.`, true), null);
});

test("recupera protecciones y frenos declarados con identidad y energía corroboradas", () => {
  for (const base of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const source = { ...base, specs: { ...base.specs, "Tipo de motor": "Eléctrico" },
      longDescription: operationalDescription("El equipo dispone de protección contra sobrecarga y frenos en baño de aceite.") };
    const result = resolveSourcedOperationalFeatures(source, source, operationalGeneral, true);
    assert.ok(result?.includes("disponibilidad y configuración de protección contra sobrecarga y frenos en baño de aceite"), base.providerId);
    assert.equal(resolveSourcedOperationalFeatures(source, source, result, true), null);
    assert.equal(resolveSourcedOperationalFeatures(source, { ...source, reference: "OTRA" }, operationalGeneral, true), null);
  }
});

test("no duplica protecciones o frenos ni incorpora equipamiento opcional o con energía discordante", () => {
  const base = controlledGamForklift();
  const brake = { ...base, specs: { ...base.specs, "Tipo de motor": "Eléctrico" }, longDescription: operationalDescription("Dispone de frenos en baño de aceite.") };
  for (const claim of ["No dispone de protección contra sobrecarga.", "Puede incorporar frenos en baño de aceite.", "La protección contra sobrecarga es opcional."]) {
    const source = { ...brake, longDescription: operationalDescription(claim) };
    assert.equal(resolveSourcedOperationalFeatures(source, source, operationalGeneral, true), null, claim);
  }
  assert.equal(resolveSourcedOperationalFeatures(brake, brake, `${operationalGeneral} Dispone de frenos húmedos.`, true), null);
  assert.equal(resolveSourcedOperationalFeatures(brake, { ...brake, specs: { ...base.specs, "Tipo de motor": "Diésel" } }, operationalGeneral, true), null);
  const unknown = { ...brake, specs: { ...base.specs } };
  assert.equal(resolveSourcedOperationalFeatures(unknown, unknown, operationalGeneral, true), null);
  const conflict = { ...brake, longDescription: operationalDescription("Motor diésel. Dispone de frenos en baño de aceite.") };
  assert.equal(resolveSourcedOperationalFeatures(conflict, conflict, operationalGeneral, true), null);
  const overload = { ...base, longDescription: operationalDescription("Dispone de protección contra sobrecarga.") };
  assert.equal(resolveSourcedOperationalFeatures(overload, overload, `${operationalGeneral} Dispone de limitador de carga.`, true), null);
});

test("recupera corriente alterna y controles de desplazamiento declarados en distintos proveedores", () => {
  for (const base of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    for (const motor of ["motor de corriente alterna", "motores de CA", "motor de tracción AC"]) {
      const source = { ...base, specs: { ...base.specs, "Tipo de motor": "Eléctrico" },
        longDescription: operationalDescription(`Dispone de ${motor}, sistema de velocidad reducida en las curvas y sistema de control de tracción.`) };
      const result = resolveSourcedOperationalFeatures(source, source, operationalGeneral, true);
      assert.ok(result?.includes("motorización de corriente alterna, reducción de velocidad en curvas y sistema de control de tracción"), base.providerId);
      assert.equal(resolveSourcedOperationalFeatures(source, source, result, true), null);
      assert.equal(resolveSourcedOperationalFeatures(source, { ...source, reference: "OTRA" }, operationalGeneral, true), null);
      assert.equal(resolveSourcedOperationalFeatures(source, source, operationalGeneral, false), null);
    }
  }
});

test("las prestaciones de desplazamiento respetan energía, variantes, negaciones y menciones previas", () => {
  const base = controlledGamForklift();
  const electric = { ...base, specs: { ...base.specs, "Tipo de motor": "Eléctrico" } };
  const motor = { ...electric, longDescription: operationalDescription("Dispone de motores de corriente alterna.") };
  assert.equal(resolveSourcedOperationalFeatures(motor, { ...motor, specs: { ...base.specs, "Tipo de motor": "Diésel" } }, operationalGeneral, true), null);
  assert.equal(resolveSourcedOperationalFeatures({ ...motor, specs: { ...base.specs } }, { ...motor, specs: { ...base.specs } }, operationalGeneral, true), null);
  for (const claim of ["El motor AC es opcional.", "No dispone de sistema de control de tracción.", "Puede incorporar un sistema de velocidad reducida en las curvas.", "La versión LWB dispone de motor AC.", "La MARCA MODELO20 dispone de motor AC."]) {
    const source = { ...electric, longDescription: operationalDescription(claim) };
    assert.equal(resolveSourcedOperationalFeatures(source, source, operationalGeneral, true), null, claim);
  }
  const brushless = { ...electric, longDescription: operationalDescription("Dispone de motor AC sin escobillas.") };
  const result = resolveSourcedOperationalFeatures(brushless, brushless, operationalGeneral, true);
  assert.match(result ?? "", /motor eléctrico sin escobillas/u);
  assert.doesNotMatch(result ?? "", /motorización de corriente alterna/u);
  const traction = { ...electric, longDescription: operationalDescription("Dispone de sistema de velocidad reducida en las curvas y sistema de control de tracción.") };
  assert.equal(resolveSourcedOperationalFeatures(traction, traction, `${operationalGeneral} Dispone de reducción de velocidad en curvas y control de la tracción.`, true), null);
});

test("recupera el asiento regulable y el cargador integrado con familia, identidad y energía coherentes", () => {
  for (const base of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    for (const charger of ["cargador integrado", "cargador incorporado", "cargador a bordo"]) {
      const source = { ...base, specs: { ...base.specs, "Tipo de motor": "Eléctrico" },
        longDescription: operationalDescription(`Dispone de asiento ajustable y ${charger}.`) };
      const result = resolveSourcedOperationalFeatures(source, source, operationalGeneral, true);
      assert.ok(result?.includes("disponibilidad y configuración de asiento regulable y cargador integrado"), base.providerId);
      assert.equal(resolveSourcedOperationalFeatures(source, source, result, true), null);
      assert.equal(resolveSourcedOperationalFeatures(source, { ...source, reference: "OTRA" }, operationalGeneral, true), null);
      assert.equal(resolveSourcedOperationalFeatures(source, source, operationalGeneral, false), null);
    }
  }
});

test("no atribuye asientos a otras familias ni cargadores opcionales o sin energía corroborada", () => {
  const base = controlledGamForklift();
  const electric = { ...base, specs: { ...base.specs, "Tipo de motor": "Eléctrico" } };
  for (const claim of ["El asiento ajustable es opcional.", "No dispone de cargador integrado.", "Puede incorporar un cargador a bordo.", "La MARCA MODELO20 dispone de asiento regulable."]) {
    const source = { ...electric, longDescription: operationalDescription(claim) };
    assert.equal(resolveSourcedOperationalFeatures(source, source, operationalGeneral, true), null, claim);
  }
  const charger = { ...electric, longDescription: operationalDescription("Dispone de cargador incorporado.") };
  assert.equal(resolveSourcedOperationalFeatures(charger, { ...charger, specs: { ...base.specs, "Tipo de motor": "Diésel" } }, operationalGeneral, true), null);
  const seat = { ...electric, longDescription: operationalDescription("Dispone de asiento ajustable.") };
  assert.equal(resolveSourcedOperationalFeatures(seat, seat, `${operationalGeneral} Cuenta con asiento regulable.`, true), null);
  const platform = { ...controlledGomarizPlatform(), longDescription: operationalDescription("Dispone de asiento regulable.") };
  assert.equal(resolveSourcedOperationalFeatures(platform, platform, operationalGeneral, true), null);
});

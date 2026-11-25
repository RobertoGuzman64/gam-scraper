import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { resolveSourcedOperationalSpecs, resolveSourcedCombinedBatteryGeneral } from "./editorial-sourced-operational-specs.js";
import { controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift, controlledGomarizPlatform, controlledMercaelevaPlatform } from "../../core/editorial-contract-records.js";
import { original, compose } from "./equipment-details-fixture.js";

test("la recuperación de batería conserva el texto existente y exige una declaración concordante de la misma referencia", () => {
  const general = "La ficha técnica de carretilla elevadora eléctrica MARCA MODELO10 indica capacidad nominal de 2.500 kg.";
  for (const base of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const source: ProductRecord = { ...base, title: "Carretilla elevadora eléctrica MARCA MODELO10 2500 kg",
      longDescription: "La carretilla MARCA MODELO10 dispone de batería de 48 V y 420 Ah.",
      specs: { ...base.specs, "Tipo de motor": "Eléctrico", "Capacidad de la batería": "48V / 420Ah(V/Ah)" } };
    const result = resolveSourcedCombinedBatteryGeneral(source, source, general);
    assert.ok(result, base.providerId);
    assert.ok(result.startsWith(general), base.providerId);
    assert.match(result, /48 V y 420 Ah/u);
    assert.match(result, /no una comprobación del estado/u);
    assert.equal(resolveSourcedCombinedBatteryGeneral(source, source, result), null);
    for (const prepared of [{ ...source, reference: "OTRA" }, { ...source, model: "OTRO" },
      { ...source, specs: { ...source.specs, "Capacidad de la batería": "48V / 460Ah(V/Ah)" } },
      { ...source, specs: { ...source.specs, "Voltaje de la batería": "80 V" } }]) {
      assert.equal(resolveSourcedCombinedBatteryGeneral(source, prepared, general), null);
    }
    for (const text of ["La MARCA MODELO10 puede incorporar batería de 48 V y 420 Ah.",
      "La MARCA MODELO10 dispone de batería de 48 V y 420 Ah. Alternativa de 460 Ah.",
      "La MARCA MODELO20 dispone de batería de 48 V y 420 Ah.",
      "La MARCA MODELO10 dispone de batería de 48 V y 460 Ah."]) {
      const variant = { ...source, longDescription: text };
      assert.equal(resolveSourcedCombinedBatteryGeneral(variant, variant, general), null, text);
    }
    assert.equal(resolveSourcedCombinedBatteryGeneral(source, source, `${general} Batería declarada.`), null);
  }
});

test("los intervalos de batería conservan los extremos como datos de catálogo sin atribuir una configuración", () => {
  for (const base of [controlledGamForklift(), controlledMercaelevaForklift()]) {
    const source: ProductRecord = { ...base, condition: "Nuevo", title: "Carretilla elevadora eléctrica MARCA MODELO10",
      shortDescription: null, longDescription: "La carretilla MARCA MODELO10 se utiliza para manipular cargas.",
      specs: { ...base.specs, "Tipo de motor": "Eléctrico", "Capacidad de la batería": "48V / 280-620Ah(V/Ah)" } };
    const prepared: ProductRecord = { ...source, specs: { ...source.specs, "Capacidad de la batería": "48 V / 280-620 Ah" } };
    const general = "La ficha técnica de carretilla elevadora eléctrica MARCA MODELO10 indica capacidad nominal de 2.500 kg.";
    const result = resolveSourcedCombinedBatteryGeneral(source, prepared, general);
    assert.ok(result?.startsWith(general), base.providerId);
    assert.match(result ?? "", /280 a 620 Ah a 48 V/u);
    assert.match(result ?? "", /No identifica cuál de esas capacidades/u);
    assert.equal(resolveSourcedCombinedBatteryGeneral(source, prepared, result), null);
    for (const candidate of [{ ...prepared, reference: "OTRA" }, { ...prepared, model: "OTRO" },
      { ...prepared, specs: { ...prepared.specs, "Capacidad de la batería": "48 V / 280-600 Ah" } },
      { ...prepared, specs: { ...prepared.specs, "Voltaje de la batería": "80 V" } },
      { ...prepared, specs: { ...prepared.specs, "Capacidad de la batería (Ah)": "280 Ah" } },
      { ...prepared, longDescription: "La unidad se entrega sin baterías." },
      { ...prepared, longDescription: "Motor diésel." },
      { ...prepared, longDescription: "Batería de 80 V." }]) {
      assert.equal(resolveSourcedCombinedBatteryGeneral(source, candidate, general), null);
    }
    const unspecified: ProductRecord = { ...source, specs: { ...base.specs, "Capacidad de la batería": "48V / 280-620Ah(V/Ah)" } };
    assert.match(resolveSourcedCombinedBatteryGeneral(unspecified, unspecified, general) ?? "", /280 a 620 Ah a 48 V/u);
    const used: ProductRecord = { ...source, condition: "Segunda mano" };
    assert.equal(resolveSourcedCombinedBatteryGeneral(used, used, general), null);
    for (const raw of ["48V / 620-280Ah(V/Ah)", "48V / 280-620Ah | Li-ion 48V / 200Ah", "48V / 280-280Ah(V/Ah)"]) {
      const candidate: ProductRecord = { ...source, specs: { ...source.specs, "Capacidad de la batería": raw } };
      assert.equal(resolveSourcedCombinedBatteryGeneral(candidate, candidate, general), null);
    }
  }
});

test("una unidad de capacidad incompleta no impide recuperar un voltaje explícito y concordante", () => {
  const general = "La ficha técnica de carretilla elevadora eléctrica MARCA MODELO10 indica capacidad nominal de 2.500 kg.";
  for (const base of [controlledGamForklift(), controlledMercaelevaForklift()]) {
    const source: ProductRecord = { ...base, condition: "Nuevo", title: "Carretilla elevadora eléctrica MARCA MODELO10",
      specs: { ...base.specs, "Tipo de motor": "Eléctrico", "Capacidad de la batería": "48V / 420h(V/Ah)" } };
    const result = resolveSourcedCombinedBatteryGeneral(source, source, general);
    assert.ok(result?.startsWith(general), base.providerId);
    assert.match(result ?? "", /voltaje de batería de 48 V/u);
    assert.match(result ?? "", /no permite confirmar los amperios-hora/u);
    assert.doesNotMatch(result ?? "", /420/u);
    assert.equal(resolveSourcedCombinedBatteryGeneral(source, source, result), null);
    for (const candidate of [{ ...source, reference: "OTRA" }, { ...source, model: "OTRO" },
      { ...source, specs: { ...source.specs, "Capacidad de la batería": "48V / 420Ah(V/Ah)" } },
      { ...source, specs: { ...source.specs, "Voltaje de la batería": "80 V" } },
      { ...source, longDescription: "Batería de 80 V." }, { ...source, longDescription: "Se entrega sin baterías." }]) {
      assert.equal(resolveSourcedCombinedBatteryGeneral(source, candidate, general), null);
    }
    const used: ProductRecord = { ...source, condition: "Segunda mano" };
    assert.equal(resolveSourcedCombinedBatteryGeneral(used, used, general), null);
  }
});

test("reconstruye una general de transpaleta con otro modelo sin transferir sus prestaciones", () => {
  const general = "Transpaleta MARCA MODELO20: La máquina tiene una capacidad de 2500 kg y freno regenerativo.";
  const source: ProductRecord = { ...controlledGamForklift(),
    url: "https://online.gamrentals.com/es/transpaletas/CONTROL-03-transpaleta-marca-modelo10",
    title: "Transpaleta eléctrica MARCA MODELO10 2000 kg", shortDescription: "Transpaleta MARCA MODELO10, capacidad de carga de 2000 kg.",
    longDescription: general, specs: { Marca: "MARCA", Modelo: "MODELO10", "Capacidad de carga (kg)": "2000 kg",
      Peso: "850 kg", "Altura de elevación (m)": "0,15 metros" } };
  const result = compose(source, general);
  assert.match(result ?? "", /transpaleta MARCA MODELO10/u);
  assert.match(result ?? "", /2\.000 kg/u);
  assert.match(result ?? "", /850 kg y altura de elevación de 0,15 m/u);
  assert.match(result ?? "", /otro modelo, MARCA MODELO20/u);
  assert.doesNotMatch(result ?? "", /2500 kg|freno regenerativo/u);
  assert.equal(compose(source, result ?? ""), null);
  assert.equal(resolveSourcedOperationalSpecs(source, source, general, false), null);
  for (const candidate of [ { ...source, reference: "OTRA" }, { ...source, shortDescription: "Transpaleta MARCA MODELO20 2000 kg." },
    { ...source, specs: { ...source.specs, Peso: "900 kg" } }, { ...source, specs: { ...source.specs, "Altura de elevación (m)": "0,3 m" } } ]) {
    assert.equal(compose(source, general, candidate), null);
  }
  const inconsistent = { ...source, shortDescription: "Transpaleta MARCA MODELO10 2500 kg." };
  assert.equal(compose(inconsistent, general), null);
  const wrongUrl = { ...source, url: source.url.replace("modelo10", "modelo20") };
  assert.equal(compose(wrongUrl, general), null);
});

test("las configuraciones de batería de catálogo conservan las alternativas y no acreditan su instalación", () => {
  const general = "La ficha técnica de carretilla elevadora eléctrica MARCA MODELO10 indica capacidad de carga de 2.500 kg.";
  for (const base of [controlledGamForklift(), controlledMercaelevaForklift()]) {
    const source: ProductRecord = { ...base, condition: "Nuevo", title: "Carretilla elevadora eléctrica MARCA MODELO10",
      longDescription: "La carretilla MARCA MODELO10 utiliza accionamiento eléctrico.",
      specs: { ...base.specs, "Tipo de motor": "Eléctrico", "Capacidad de la batería": "48V / 420Ah(V/Ah)" } };
    const prepared = { ...source, specs: { ...source.specs, "Capacidad de la batería": "48 V / 420 Ah" } };
    const result = resolveSourcedCombinedBatteryGeneral(source, prepared, general);
    assert.match(result ?? "", /48 V con 420 Ah\. La configuración suministrada debe confirmarse/u);
    assert.equal(resolveSourcedCombinedBatteryGeneral(source, prepared, result), null);
    const alternatives = { ...source, specs: { ...source.specs, "Capacidad de la batería": "24V / 210-375Ah | Li-ion 24V / 200-300Ah(V/Ah)" } };
    assert.match(resolveSourcedCombinedBatteryGeneral(alternatives, alternatives, general) ?? "", /dos alternativas de batería a 24 V: entre 210 y 375 Ah y entre 200 y 300 Ah en ion-litio/u);
    for (const candidate of [{ ...prepared, reference: "OTRA" }, { ...prepared, model: "OTRO" },
      { ...prepared, specs: { ...prepared.specs, "Capacidad de la batería": "48 V / 450 Ah" } },
      { ...prepared, specs: { ...prepared.specs, "Voltaje batería (V)": "80 V" } },
      { ...prepared, longDescription: "Batería de 80 V." }, { ...prepared, longDescription: "Se entrega sin batería." },
      { ...prepared, longDescription: "Batería opcional." }]) {
      assert.equal(resolveSourcedCombinedBatteryGeneral(source, candidate, general), null);
    }
    for (const raw of ["24V / 375-210Ah | Li-ion 24V / 200Ah(V/Ah)", "24V / 210-375Ah | Li-ion 48V / 200Ah(V/Ah)", "24V / 210-375Ah | 24V / 200Ah(V/Ah)"]) {
      const invalid = { ...source, specs: { ...source.specs, "Capacidad de la batería": raw } };
      assert.equal(resolveSourcedCombinedBatteryGeneral(invalid, invalid, general), null);
    }
    const crossed = { ...source, longDescription: "La carretilla MARCA MODELO20 utiliza accionamiento eléctrico." };
    assert.equal(resolveSourcedCombinedBatteryGeneral(crossed, crossed, general), null);
    const used: ProductRecord = { ...source, condition: "Segunda mano" };
    assert.equal(resolveSourcedCombinedBatteryGeneral(used, used, general), null);
  }
});

test("la descripción de plataformas conserva la química declarada solo si la identidad original es inequívoca", () => {
  const general = "La ficha técnica de plataforma de tijera eléctrica MARCA MODELO10 indica altura de trabajo de 10 m.";
  for (const base of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const source = { ...base, specs: { ...base.specs, "Tipo de batería": "Batería de plomo" } };
    const details = (original: ProductRecord, prepared: ProductRecord = original): string | null =>
      resolveSourcedCombinedBatteryGeneral(original, prepared, general);
    const output = details(source);
    assert.equal(output, `${general} La tabla técnica de esta referencia declara batería de plomo.`);
    assert.equal(resolveSourcedCombinedBatteryGeneral(source, source, output), null);
    const lithium = { ...source, specs: { ...base.specs, "Tipo de batería": "Batería de litio" } };
    assert.match(details(lithium) ?? "", /batería de litio/u);
    assert.equal(details(source, lithium), null);
    assert.equal(details({ ...source, specs: { ...source.specs, "Tipo de Batería": "Li-ion" } }), null);
    for (const text of ["Batería de litio.", "Batería de plomo opcional.", "Equipo sin baterías.", "Batería no incluida."]) {
      assert.equal(details({ ...source, longDescription: text }), null);
    }
    assert.equal(details({ ...source, title: "Plataforma de tijera eléctrica MARCA OTRO10" }, source), null);
    assert.equal(details(source, { ...source, reference: "OTRA" }), null);
    assert.equal(details({ ...source, specs: { ...source.specs, Modelo: "OTRO" } }), null);
  }
});

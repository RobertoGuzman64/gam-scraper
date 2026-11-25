import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { resolveReusableEditorial } from "../../core/editorial-composition.js";
import { resolveHandlingOperationalDetails, resolvePlatformOperationalDetails, resolveTransportOperationalDetails } from "./editorial-sourced-equipment-details.js";
import { controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift, controlledGomarizPlatform, controlledMercaelevaPlatform } from "../../core/editorial-contract-records.js";
import { original } from "./equipment-details-fixture.js";

test("la longitud de transporte conserva su concepto y se reutiliza entre proveedores", () => {
  for (const source of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const unit = { ...source, specs: { ...source.specs, "Longitud sin horquillas": "2400 mm" } };
    const output = resolveReusableEditorial(unit);
    assert.match(output.general ?? "", /longitud sin horquillas declarada de 2,4 m/u);
    assert.equal(output.short, resolveReusableEditorial(source).short);
    assert.deepEqual(resolveTransportOperationalDetails(unit, { ...unit, reference: "OTRA" }, "carretilla-elevadora", false), []);
    for (const specs of [{ "Largo sin horquillas": "2,6 m" }, { Longitud: "2 m" }, { Longitud: "2,4 m" }, { "Longitud al tablero": "2,4 m" }]) {
      const conflicting = { ...unit, specs: { ...unit.specs, ...specs } };
      assert.deepEqual(resolveTransportOperationalDetails(conflicting, conflicting, "carretilla-elevadora", false), []);
    }
    const changed = { ...unit, specs: { ...unit.specs, "Longitud sin horquillas": "2,5 m" } };
    assert.deepEqual(resolveTransportOperationalDetails(unit, changed, "carretilla-elevadora", false), []);
    const described = { ...unit, longDescription: "Longitud sin horquillas de 2,8 m." };
    assert.deepEqual(resolveTransportOperationalDetails(described, described, "carretilla-elevadora", false), []);
  }
});

test("la altura exterior exige magnitud coherente y no sustituye cotas de trabajo", () => {
  const source = original("energia-grupo-electrogeno", { Potencia: "35 kVA", Motor: "Diésel", Alto: "1350 mm" });
  const details = (record: ProductRecord, heightAlreadyIncluded = false): readonly string[] =>
    resolveTransportOperationalDetails(record, record, "grupo-electrogeno", heightAlreadyIncluded);
  assert.deepEqual(details(source), ["altura exterior declarada de 1,35 m"]);
  assert.deepEqual(details(source, true), []);
  for (const specs of [{ Altura: "1,4 m" }, { Alto: "1350" }, { Alto: "13,5 m" }, { "Altura de trabajo": "8 m" }]) {
    assert.deepEqual(details({ ...source, specs: { ...source.specs, ...specs } }), []);
  }
  assert.deepEqual(details({ ...source, longDescription: "Altura exterior de 1,5 m." }), []);
  assert.deepEqual(resolveTransportOperationalDetails(source, source, "plataforma-tijera", false), []);
  const dumper = original("movimiento-tierra-dumper", { Peso: "1800 kg", "Altura total": "2245 mm", "Tracción": "4×4" });
  assert.deepEqual(resolveTransportOperationalDetails(dumper, dumper, "dumper", false), []);
  const compacting = original("pequena-maquinaria-compactacion", { Peso: "92 kg", Alto: "600 mm", "Ancho bandeja": "420 mm", Potencia: "3,6 kW" });
  assert.deepEqual(resolveTransportOperationalDetails(compacting, compacting, "compactadora", false), []);
});

test("la longitud al tablero se atribuye al manipulador telescópico y no a sus horquillas", () => {
  const source = original("manipulacion-manipulador", { "Altura de elevacion max": "14 m", "Alcance maximo": "9 m",
    "Longitud al tablero": "5,5 m", Motor: "Diésel" });
  assert.deepEqual(resolveTransportOperationalDetails(source, source, "manipulador-telescopico", false), ["longitud al tablero declarada de 5,5 m"]);
  const invalid = { ...source, specs: { ...source.specs, "Longitud sin horquillas": "5,5 m" } };
  assert.deepEqual(resolveTransportOperationalDetails(invalid, invalid, "manipulador-telescopico", false), []);
  assert.deepEqual(resolveTransportOperationalDetails(source, source, "carretilla-elevadora", false), []);
});

test("la longitud de transporte diferenciada exige una longitud total mayor y evidencia de la unidad", () => {
  for (const base of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const source = { ...base, title: "Plataforma articulada eléctrica MARCA MODELO10", specs: {
      ...base.specs, "Longitud total": "6 m", "Longitud de transporte": "4500 mm"
    } };
    const details = (record: ProductRecord, prepared: ProductRecord = record): readonly string[] =>
      resolvePlatformOperationalDetails(record, prepared, "plataforma-articulada");
    assert.deepEqual(details(source), ["longitud de transporte declarada de 4,5 m"]);
    assert.match(resolveReusableEditorial(source).general ?? "", /longitud de transporte declarada de 4,5 m/u);
    for (const value of ["6 m", "7 m", "4500", "0,5 m", "4-5 m"]) {
      const invalid = { ...source, specs: { ...source.specs, "Longitud de transporte": value } };
      assert.deepEqual(details(invalid), []);
    }
    assert.deepEqual(details(source, { ...source, reference: "OTRA" }), []);
    assert.deepEqual(details(source, { ...source, specs: { ...source.specs, "Longitud de transporte": "5 m" } }), []);
    assert.deepEqual(details({ ...source, specs: { ...source.specs, "Longitud transporte": "5 m" } }), []);
    assert.deepEqual(details({ ...source, longDescription: "Longitud de transporte de 5 m." }), []);
  }
});

test("el manipulador telescópico distingue la altura total de la elevación y las dimensiones de horquillas", () => {
  const source = original("manipulacion-manipulador", { "Altura de elevacion max": "6 m", "Altura total": "1950 mm", "Alcance maximo": "4 m", "Capacidad carga": "2500 kg", Peso: "4800 kg",
    Horquillas: "1200 x 125 x 45 mm", Motor: "Diésel" });
  const transport = (record: ProductRecord, prepared = record): readonly string[] =>
    resolveTransportOperationalDetails(record, prepared, "manipulador-telescopico", false);
  const handling = (record: ProductRecord, prepared = record): readonly string[] =>
    resolveHandlingOperationalDetails(record, prepared, "manipulador-telescopico");
  assert.deepEqual(transport(source), ["altura total declarada de 1,95 m"]);
  assert.deepEqual(handling(source), ["dimensiones de horquillas declaradas de 1.200 × 125 × 45 mm"]);
  assert.match(resolveReusableEditorial(source).general ?? "", /altura total declarada de 1,95 m/u);
  assert.deepEqual(transport(source, { ...source, reference: "OTRA" }), []);
  assert.deepEqual(handling(source, { ...source, reference: "OTRA" }), []);
  assert.deepEqual(transport(source, { ...source, specs: { ...source.specs, "Altura total": "2 m" } }), []);
  assert.deepEqual(handling(source, { ...source, specs: { ...source.specs, Horquillas: "1300 x 125 x 45 mm" } }), []);
  assert.deepEqual(transport({ ...source, specs: { ...source.specs, Altura: "6 m" } }), []);
  assert.deepEqual(transport({ ...source, longDescription: "Altura total de 2 m." }), []);
  assert.deepEqual(handling({ ...source, longDescription: "Horquillas opcionales." }), []);
  assert.deepEqual(handling({ ...source, specs: { ...source.specs, Horquillas: "125x45x1200 mm" } }), []);
  assert.deepEqual(resolveTransportOperationalDetails(source, source, "manipulador-telescopico", true), []);
});

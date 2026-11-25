import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { resolveReusableEditorial } from "../../core/editorial-composition.js";
import { resolveEquipmentConfigurationDetails } from "./editorial-sourced-equipment-details.js";
import { controlledGomarizPlatform } from "../../core/editorial-contract-records.js";
import { original } from "./equipment-details-fixture.js";

test("la capacidad de depósito conserva el concepto y rechaza unidades o valores contradictorios", () => {
  const source = original("energia-grupo-electrogeno", { Potencia: "35 kVA", Motor: "Diésel", "Capacidad depósito": "125,5 l" });
  const details = (record: ProductRecord, prepared: ProductRecord = record): readonly string[] =>
    resolveEquipmentConfigurationDetails(record, prepared, "grupo-electrogeno");
  assert.deepEqual(details(source), ["capacidad de depósito declarada de 125,5 l"]);
  assert.match(resolveReusableEditorial(source).general ?? "", /capacidad de depósito declarada de 125,5 l/u);
  for (const value of ["125", "125 kg", "0 l", "100-125 l"]) {
    const invalid = { ...source, specs: { ...source.specs, "Capacidad depósito": value } };
    assert.deepEqual(details(invalid), []);
  }
  assert.deepEqual(details(source, { ...source, specs: { ...source.specs, "Capacidad depósito": "150 l" } }), []);
  assert.deepEqual(details({ ...source, specs: { ...source.specs, "Capacidad del depósito": "150 l" } }), []);
  assert.deepEqual(details({ ...source, longDescription: "Depósito opcional de 125 l." }), []);
  assert.deepEqual(resolveEquipmentConfigurationDetails(source, source, "miniexcavadora"), []);
});

test("las medidas de cazos se atribuyen a la tabla de la misma unidad sin inferir compatibilidad ni montaje", () => {
  const source = original("movimiento-tierra-miniexcavadora", { Peso: "2000 kg", Motor: "Diésel", "Cazo 1 limpieza": "1200 mm", "Cazo 2": "500 mm", "Cazo 3": "300 mm" });
  const details = (record: ProductRecord, prepared: ProductRecord = record): readonly string[] =>
    resolveEquipmentConfigurationDetails(record, prepared, "miniexcavadora");
  assert.deepEqual(details(source), ["medidas de cazos declaradas de 300, 500 y 1.200 mm"]);
  assert.match(resolveReusableEditorial(source).general ?? "", /medidas de cazos declaradas de 300, 500 y 1\.200 mm/u);
  assert.deepEqual(details(source, { ...source, reference: "OTRA" }), []);
  assert.deepEqual(details(source, { ...source, specs: { ...source.specs, "Cazo 3": "400 mm" } }), []);
  for (const value of ["300", "300 kg", "0 mm", "300/400 mm"]) {
    const invalid = { ...source, specs: { ...source.specs, "Cazo 3": value } };
    assert.deepEqual(details(invalid), []);
  }
  assert.deepEqual(details({ ...source, longDescription: "Cazos opcionales." }), []);
  assert.deepEqual(resolveEquipmentConfigurationDetails(source, source, "dumper"), []);
});

test("los grupos electrógenos incorporan tensiones y polos declarados sin inferir la configuración de salida", () => {
  const sources: readonly ProductRecord[] = [
    original("energia-grupo-electrogeno", { Potencia: "35 kVA", Motor: "Diésel", Voltios: "400/230 v", Polos: "4" }),
    { ...controlledGomarizPlatform(), title: "Grupo electrógeno diésel MARCA MODELO10",
      specs: { Potencia: "35 kVA", Motor: "Diésel", Voltios: "400/230 V", Polos: "4" } }
  ];
  for (const source of sources) {
    assert.deepEqual(resolveEquipmentConfigurationDetails(source, source, "grupo-electrogeno"), [
      "tensiones eléctricas declaradas de 400/230 V", "4 polos declarados"]);
    const editorial = resolveReusableEditorial(source);
    assert.match(editorial.general ?? "", /tensiones eléctricas declaradas de 400\/230 V y 4 polos declarados/u);
    assert.doesNotMatch(editorial.general ?? "", /trif[aá]sic|monof[aá]sic|\bHz\b|\brpm\b/iu);
    const baseline = { ...source, specs: { ...source.specs } };
    delete baseline.specs.Voltios;
    delete baseline.specs.Polos;
    assert.equal(editorial.short, resolveReusableEditorial(baseline).short);
    const single = { ...source, specs: { ...source.specs, Voltios: "230 V" } };
    assert.deepEqual(resolveEquipmentConfigurationDetails(single, single, "grupo-electrogeno"), [
      "tensión eléctrica declarada de 230 V", "4 polos declarados"]);
  }
});

test("las tensiones y polos requieren concordancia, unidades y familia acreditada", () => {
  const source = original("energia-grupo-electrogeno", { Potencia: "35 kVA", Motor: "Diésel", Voltios: "400/230 V", Polos: "4" });
  const details = (record: ProductRecord, prepared: ProductRecord = record): readonly string[] =>
    resolveEquipmentConfigurationDetails(record, prepared, "grupo-electrogeno");
  for (const value of ["400/230", "400/230v v", "400-230 V", "400/400 V", "12 V", "750 V", "400 W"]) {
    assert.deepEqual(details({ ...source, specs: { ...source.specs, Voltios: value } }), ["4 polos declarados"]);
  }
  for (const value of ["0", "3", "2/4", "4 polos", "4.5"]) {
    assert.deepEqual(details({ ...source, specs: { ...source.specs, Polos: value } }), ["tensiones eléctricas declaradas de 400/230 V"]);
  }
  assert.deepEqual(details(source, { ...source, specs: { ...source.specs, Voltios: "230 V", Polos: "2" } }), []);
  assert.deepEqual(details({ ...source, specs: { ...source.specs, Voltaje: "230 V" } }), ["4 polos declarados"]);
  assert.deepEqual(details({ ...source, specs: { ...source.specs, "Voltaje de la batería": "24 V" } }), ["4 polos declarados"]);
  assert.deepEqual(details({ ...source, longDescription: "Tensión y polos pendientes de comprobación." }), []);
  assert.deepEqual(details(source, { ...source, reference: "OTRA" }), []);
  assert.deepEqual(resolveEquipmentConfigurationDetails(source, source, "carretilla-elevadora"), []);
});

test("la configuración de descarga y autocarga del dúmper procede de la misma unidad", () => {
  const source = original("movimiento-tierra-dumper", {
    Motor: "Diésel", Peso: "2400 kg", Giratorio: "si", Autocargable: "no", "Descarga altura": "si"
  });
  const prepared: ProductRecord = { ...source, specs: { ...source.specs, Giratorio: "Sí", Autocargable: "No", "Descarga altura": "Sí" } };
  assert.deepEqual(resolveEquipmentConfigurationDetails(source, prepared, "dumper"), [
    "tolva giratoria declarada", "descarga en altura declarada"
  ]);
  const general = resolveReusableEditorial(prepared, null, source).general ?? "";
  assert.match(general, /tolva giratoria declarada y descarga en altura declarada/u);
  assert.doesNotMatch(general, /autocargable/u);
  const loader: ProductRecord = { ...source, specs: { ...source.specs, Giratorio: "no", Autocargable: "si", "Descarga altura": "no" } };
  assert.deepEqual(resolveEquipmentConfigurationDetails(loader, loader, "dumper"), ["configuración autocargable declarada"]);
  assert.equal(resolveReusableEditorial(prepared, null, source).short, resolveReusableEditorial({ ...prepared,
    specs: { ...prepared.specs, Giratorio: "No", "Descarga altura": "No" } }, null, source).short);
});

test("la configuración del dúmper rechaza alternativas, ausencias, contradicciones y otras identidades", () => {
  const source = original("movimiento-tierra-dumper", { Motor: "Diésel", Peso: "2400 kg", Giratorio: "Sí" });
  const details = (prepared: ProductRecord) => resolveEquipmentConfigurationDetails(source, prepared, "dumper");
  for (const value of ["No", "opcional", "Sí/No", "", undefined]) {
    const specs = { ...source.specs };
    if (value === undefined) delete specs.Giratorio;
    else specs.Giratorio = value;
    assert.deepEqual(details({ ...source, specs }), []);
  }
  assert.deepEqual(details({ ...source, longDescription: "Tiene tolva fija." }), []);
  assert.deepEqual(details({ ...source, reference: "CONTROL-OTRA" }), []);
  assert.deepEqual(details({ ...source, model: "OTRO" }), []);
  assert.deepEqual(details({ ...source, longDescription: "La tolva giratoria es opcional." }), []);
  assert.deepEqual(resolveEquipmentConfigurationDetails(source, source, "cargadora"), []);
});

test("la recuperación de la configuración del dúmper no depende del proveedor", () => {
  const source: ProductRecord = { ...controlledGomarizPlatform(), title: "Dúmper MARCA MODELO10", specs: {
    Motor: "Diésel", Peso: "2400 kg", Giratorio: "Sí", "Descarga altura": "Sí", Autocargable: "No"
  } };
  assert.deepEqual(resolveEquipmentConfigurationDetails(source, source, "dumper"), [
    "tolva giratoria declarada", "descarga en altura declarada"
  ]);
  const general = resolveReusableEditorial(source).general ?? "";
  assert.match(general, /tolva giratoria declarada y descarga en altura declarada/u);
  assert.deepEqual(resolveEquipmentConfigurationDetails(source, { ...source, longDescription: general }, "dumper"), []);
});

test("aprovecha capacidad, altura total y tracción corroboradas del dúmper únicamente en la descripción general", () => {
  const source = original("movimiento-tierra-dumper", {
    Peso: "1800 kg", Motor: "Diésel", "Capacidad carga": "2500 kg", "Altura total": "2245 mm", "Tracción": "4×4 hidrostatico"
  });
  const expected = ["capacidad de carga declarada de 2.500 kg", "altura total declarada de 2,245 m", "tracción declarada 4×4 hidrostática"];
  assert.deepEqual(resolveEquipmentConfigurationDetails(source, source, "dumper"), expected);
  const output = resolveReusableEditorial(source);
  for (const detail of expected) assert.ok(output.general?.includes(detail));
  assert.doesNotMatch(output.short ?? "", /tracción|altura total/u);
  assert.deepEqual(resolveEquipmentConfigurationDetails(source, { ...source, specs: { ...source.specs,
    "Capacidad carga": "3000 kg", "Altura total": "3 m", "Tracción": "4×2" } }, "dumper"), []);
  assert.deepEqual(resolveEquipmentConfigurationDetails(source, { ...source, reference: "OTRA" }, "dumper"), []);
  const contradictory = { ...source, specs: { ...source.specs, "Capacidad de carga": "3000 kg", Altura: "3 m", "Tracción 4x4": false } };
  assert.deepEqual(resolveEquipmentConfigurationDetails(contradictory, contradictory, "dumper"), []);
  const alreadyMentioned = { ...source, longDescription: "Capacidad de carga 2500 kg. Altura total 2245 mm. Tracción 4×4." };
  assert.deepEqual(resolveEquipmentConfigurationDetails(alreadyMentioned, alreadyMentioned, "dumper"), []);
});

test("los grupos electrógenos conservan las clasificaciones de emisiones explícitas sin acreditar homologación", () => {
  const specs = { Potencia: "35 kVA", Motor: "Diésel", Stage: "v flex" };
  const sources = [original("energia-grupo-electrogeno", specs),
    { ...controlledGomarizPlatform(), title: "Grupo electrógeno diésel MARCA MODELO10", specs }];
  for (const source of sources) {
    const details = (record: ProductRecord, prepared: ProductRecord = record) =>
      resolveEquipmentConfigurationDetails(record, prepared, "grupo-electrogeno");
    assert.deepEqual(details(source), ["clasificación de emisiones declarada Stage V Flex"]);
    const baselineSpecs: Record<string, SpecsMap[string]> = { ...source.specs };
    delete baselineSpecs.Stage;
    const baseline = { ...source, specs: baselineSpecs };
    assert.equal(resolveReusableEditorial(source).short, resolveReusableEditorial(baseline).short);
    assert.match(resolveReusableEditorial(source).general ?? "", /clasificación de emisiones declarada Stage V Flex/u);
    assert.deepEqual(details({ ...source, specs: { ...source.specs, Stage: "iiia" } }), ["clasificación de emisiones declarada Stage IIIA"]);
    for (const value of ["2", "2a", "no emisionado", "IIIA o V", "IIA", "III Flex", "V / IV"]) {
      assert.deepEqual(details({ ...source, specs: { ...source.specs, Stage: value } }), []);
    }
    assert.deepEqual(details({ ...source, specs: { ...source.specs, "Normativa de emisiones": "IV" } }), []);
    assert.deepEqual(details(source, { ...source, specs: { ...source.specs, Stage: "v" } }), []);
    assert.deepEqual(details(source, { ...source, reference: "OTRA" }), []);
    assert.deepEqual(details({ ...source, longDescription: "Homologación pendiente de confirmación." }), []);
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { resolveReusableEditorial } from "../../core/editorial-composition.js";
import { resolvePlatformOperationalDetails } from "./editorial-sourced-equipment-details.js";
import { controlledGomarizPlatform, controlledMercaelevaPlatform } from "../../core/editorial-contract-records.js";
import { original } from "./equipment-details-fixture.js";

test("las prestaciones de plataformas se narran desde la misma tabla técnica en distintos proveedores", () => {
  const manain = original("elevacion-tijera", { "Altura trabajo": "10 m", Motor: "Eléctrico" });
  const sources = [manain, controlledGomarizPlatform(), controlledMercaelevaPlatform()];
  for (const source of sources) {
    const unit: ProductRecord = { ...source, specs: { ...source.specs,
      "Tracción": "4x2", "Altura replegada": "2 m", "Altura barandilla bajada": "1800 mm",
      "Longitud plataforma": "2 m", "Longitud extensión": "0,8 m", Estabilizadores: true } };
    const baseline = resolveReusableEditorial(source);
    const before = JSON.stringify(unit);
    const editorial = resolveReusableEditorial(unit);
    assert.match(editorial.general ?? "", /tracción 4×2 declarada, altura con barandillas bajadas de 1,8 m, extensión de plataforma de 0,8 m y estabilizadores declarados/u, source.providerId);
    assert.doesNotMatch(editorial.short ?? "", /tracción|barandillas|extensión|estabilizadores/u);
    assert.doesNotMatch(baseline.general ?? "", /tracción|barandillas|extensión|estabilizadores/u);
    assert.equal(JSON.stringify(unit), before);
  }
});

test("las prestaciones operativas rechazan variantes, alias discordantes y geometría incompatible", () => {
  const source = original("elevacion-tijera", { "Altura trabajo": "10 m", Motor: "Eléctrico",
    "Tracción": "4×4", "Altura replegada": "2 m", "Altura barandilla bajada": "1,8 m",
    "Longitud plataforma": "2 m", "Longitud extensión": "0,8 m", Estabilizadores: "sí" });
  const details = (prepared: ProductRecord, original: ProductRecord = source): readonly string[] =>
    resolvePlatformOperationalDetails(original, prepared, "plataforma-tijera");
  assert.equal(details(source).length, 4);
  const variants: readonly ProductRecord[] = [{ ...source, reference: "CONTROL-02" }, { ...source, providerId: "gomariz" },
    { ...source, url: "https://manain.com/producto/venta-elevacion-tijera-marca-modelo-2/" },
    { ...source, condition: "Nuevo" }, { ...source, specs: { ...source.specs, Modelo: "OTRO" } }];
  for (const changed of variants) {
    assert.deepEqual(details(changed), []);
  }
  const conflict = (specs: SpecsMap, mention: RegExp): void => {
    const changed = { ...source, specs: { ...source.specs, ...specs } };
    assert.doesNotMatch(details(changed, changed).join(" "), mention);
  };
  conflict({ "Tracción 4x4": false }, /tracción/u);
  conflict({ "Tracción": "4x2/4x4" }, /tracción/u);
  conflict({ "Altura barandilla bajada": "2,5 m" }, /barandillas/u);
  conflict({ "Altura replegada": "12 m" }, /barandillas/u);
  conflict({ "Longitud extensión": "3 m" }, /extensión/u);
  conflict({ "Extensión de plataforma": "0,9 m" }, /extensión/u);
  conflict({ "Longitud extensión": "0,8 kg" }, /extensión/u);
  conflict({ Estabilizadores: "no" }, /estabilizadores/u);
  conflict({ Estabilizadores: "opcional" }, /estabilizadores/u);
  assert.doesNotMatch(details({ ...source, specs: { ...source.specs, "Tracción": "4x2" } }).join(" "), /tracción/u);
  assert.doesNotMatch(details({ ...source, specs: { ...source.specs, "Longitud extensión": "0,7 m" } }).join(" "), /extensión/u);
  const described = { ...source, longDescription: "Tracción 4x2. Sin estabilizadores. Extensión opcional." };
  assert.doesNotMatch(details(described, described).join(" "), /tracción|estabilizadores|extensión/u);
});

test("la articulación y el equipamiento declarado requieren familia compatible y afirmación inequívoca", () => {
  const source = original("elevacion-brazo-articulado", { "Altura trabajo": "15 m", Motor: "Eléctrico",
    "Altura articulacion": "6 m", "Trabajo negativo": "sí", "Barra antiatrapamiento": true });
  const resolve = (record: ProductRecord): readonly string[] => resolvePlatformOperationalDetails(record, record, "plataforma-articulada");
  assert.deepEqual(resolve(source), ["altura de articulación de 6 m", "trabajo en negativo declarado", "barra antiatrapamiento declarada"]);
  assert.deepEqual(resolve({ ...source, specs: { ...source.specs, "Altura articulacion": "16 m",
    "Trabajo en negativo": "no", "Barra antiatrapamiento": "no" } }), []);
  assert.deepEqual(resolve({ ...source, longDescription: "Sin barra antiatrapamiento. Trabajo negativo opcional. Altura de articulación de 7 m." }), []);
  assert.deepEqual(resolvePlatformOperationalDetails(source, source, "plataforma-tijera"), []);
  const forklift = original("manipulacion-carretilla", source.specs ?? {});
  assert.deepEqual(resolvePlatformOperationalDetails(forklift, forklift, "carretilla-elevadora"), []);
});

test("los camiones cesta conservan las cotas de transporte y la superficie de cesta declaradas", () => {
  const specs = { "Altura de trabajo": "18 m", Capacidad: "230 kg", Motor: "Diésel",
    "Altura de transporte": "3200 mm", "Longitud de cesta": "1,1 m", "Anchura de cesta": "700 mm" };
  const sources: readonly ProductRecord[] = [
    original("elevacion-camion-cesta", specs),
    { ...controlledGomarizPlatform(), title: "Camión cesta diésel MARCA MODELO10", specs }
  ];
  for (const source of sources) {
    assert.deepEqual(resolvePlatformOperationalDetails(source, source, "camion-cesta"), [
      "altura de transporte declarada de 3,2 m", "dimensiones de cesta declaradas de 1,1 × 0,7 m"]);
    const output = resolveReusableEditorial(source);
    assert.match(output.general ?? "", /altura de transporte declarada de 3,2 m y dimensiones de cesta declaradas de 1,1 × 0,7 m/u);
    assert.doesNotMatch(output.short ?? "", /transporte declarada|dimensiones de cesta/u);
  }
});

test("las cotas de camión cesta rechazan magnitudes ambiguas, contradictorias o de otra unidad", () => {
  const source = original("elevacion-camion-cesta", { "Altura de trabajo": "18 m", Capacidad: "230 kg", Motor: "Diésel",
    "Altura transporte": "3,2 m", "Longitud cesta": "1,1 m", "Ancho cesta": "0,7 m" });
  const details = (record: ProductRecord, prepared: ProductRecord = record): readonly string[] =>
    resolvePlatformOperationalDetails(record, prepared, "camion-cesta");
  assert.equal(details(source).length, 2);
  for (const value of ["3,2", "3-4 m", "18 m", "3200 kg"]) {
    assert.deepEqual(details({ ...source, specs: { ...source.specs, "Altura transporte": value } }), [
      "dimensiones de cesta declaradas de 1,1 × 0,7 m"]);
  }
  for (const value of ["0,7", "7 m", "0,7 kg"]) {
    assert.deepEqual(details({ ...source, specs: { ...source.specs, "Ancho cesta": value } }), ["altura de transporte declarada de 3,2 m"]);
  }
  assert.deepEqual(details({ ...source, specs: { ...source.specs, "Altura de transporte": "4 m", "Dimensiones Cesta": "2 x 1 m" } }), []);
  assert.deepEqual(details(source, { ...source, specs: { ...source.specs, "Altura transporte": "4 m", "Ancho cesta": "0,9 m" } }), []);
  assert.deepEqual(details({ ...source, longDescription: "Altura de transporte pendiente de comprobar. Medidas de la cesta no confirmadas." }), []);
  assert.deepEqual(details(source, { ...source, reference: "OTRA" }), []);
  assert.deepEqual(resolvePlatformOperationalDetails(source, source, "plataforma-articulada"), []);
});

test("el mástil vertical conserva el alcance horizontal declarado cuando no se confunde con una extensión", () => {
  const specs = { "Altura trabajo": "10 m", "Longitud plataforma": "1 m", "Alcance horizontal": "3,2 m", "Capacidad carga": "200 kg", Motor: "Eléctrico" };
  const sources = [original("elevacion-mastil", specs),
    { ...controlledGomarizPlatform(), title: "Equipo de mástil vertical eléctrico MARCA MODELO10", specs: { ...specs, "Altura de trabajo": "10 m", Capacidad: "200 kg" } }];
  for (const source of sources) {
    const details = (record: ProductRecord, prepared: ProductRecord = record) =>
      resolvePlatformOperationalDetails(record, prepared, "plataforma-mastil");
    assert.deepEqual(details(source), ["alcance horizontal declarado de 3,2 m"]);
    const baselineSpecs: Record<string, SpecsMap[string]> = { ...source.specs };
    delete baselineSpecs["Alcance horizontal"];
    const baseline = { ...source, specs: baselineSpecs };
    assert.equal(resolveReusableEditorial(source).short, resolveReusableEditorial(baseline).short);
    assert.match(resolveReusableEditorial(source).general ?? "", /alcance horizontal declarado de 3,2 m/u);
    for (const value of ["0 m", "0,5 m", "1 m", "11 m", "3,2 kg"]) {
      assert.deepEqual(details({ ...source, specs: { ...source.specs, "Alcance horizontal": value } }), []);
    }
    assert.deepEqual(details({ ...source, specs: { ...source.specs, "Extensión de plataforma": "0,5 m" } }), []);
    assert.deepEqual(details({ ...source, specs: { ...source.specs, "Alcance lateral": "2 m" } }), []);
    assert.deepEqual(details(source, { ...source, specs: { ...source.specs, "Alcance horizontal": "2 m" } }), []);
    assert.deepEqual(details(source, { ...source, reference: "OTRA" }), []);
    assert.deepEqual(details({ ...source, longDescription: "Alcance pendiente de confirmación." }), []);
  }
});

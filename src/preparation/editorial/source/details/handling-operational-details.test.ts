import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { resolveReusableEditorial } from "../../core/editorial-composition.js";
import { resolveHandlingOperationalDetails } from "./editorial-sourced-equipment-details.js";
import { controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift } from "../../core/editorial-contract-records.js";
import { original } from "./equipment-details-fixture.js";

test("la manutención incorpora cotas y equipamiento declarados sin alterar la descripción corta", () => {
  for (const source of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const unit = { ...source, specs: { ...source.specs, "Altura mástil replegado": "2100 mm",
      "Dimensiones Horquillas": "1100 x 120 x 45 mm", "Desplazador lateral": "SI", "Elevación libre": true } };
    const output = resolveReusableEditorial(unit);
    assert.match(output.general ?? "", /altura de mástil replegado declarada de 2.100 mm/u);
    assert.match(output.general ?? "", /dimensiones de horquillas declaradas de 1.100 × 120 × 45 mm/u);
    assert.match(output.general ?? "", /desplazador lateral declarado y elevación libre declarada/u);
    assert.equal(output.short, resolveReusableEditorial(source).short);
  }
});

test("las cotas separadas conservan el concepto de replegado y las dimensiones individuales", () => {
  const source = { ...controlledGamForklift(), specs: { ...controlledGamForklift().specs,
    "Altura max. replegada": "2,1 m", "Largo horquillas": "1200 mm", "Ancho horquillas": "100 mm", "Grosor horquillas": "40 mm" } };
  assert.deepEqual(resolveHandlingOperationalDetails(source, source, "carretilla-elevadora"), [
    "altura máxima replegada declarada de 2.100 mm", "longitud de horquillas declarada de 1.200 mm",
    "anchura de horquillas declarada de 100 mm", "grosor de horquillas declarado de 40 mm"]);
});

test("rechaza opciones, magnitudes ambiguas, conflictos y cambios de unidad en la manutención", () => {
  const source = { ...controlledGamForklift(), specs: { ...controlledGamForklift().specs,
    "Altura mástil replegado": "2100 mm", "Dimensiones Horquillas": "1100 x 120 x 45 mm", "Desplazador lateral": "SI", "Elevación libre": "SI" } };
  const details = (prepared: ProductRecord, original: ProductRecord = source): readonly string[] =>
    resolveHandlingOperationalDetails(original, prepared, "carretilla-elevadora");
  assert.deepEqual(details({ ...source, reference: "OTRA" }), []);
  assert.deepEqual(resolveHandlingOperationalDetails(source, source, "plataforma-tijera"), []);
  const invalid = { ...source, specs: { ...source.specs, "Altura de mástil replegado": "2200 mm",
    "Dimensiones Horquillas": "1100 x 1500 x 45 mm", "Desplazamiento lateral": "No", "Elevación libre": "1600" } };
  assert.deepEqual(details(invalid, invalid), []);
  const mentioned = { ...source, longDescription: "Mástil replegado, horquillas opcionales, sin desplazador lateral ni elevación libre." };
  assert.deepEqual(details(mentioned, mentioned), []);
  const altered = { ...source, specs: { ...source.specs, "Altura mástil replegado": "2300 mm",
    "Dimensiones Horquillas": "1100 x 150 x 45 mm", "Desplazador lateral": "No", "Elevación libre": "No" } };
  assert.deepEqual(details(altered), []);
});

test("la configuración de mandos y ruedas de manutención se reutiliza entre proveedores", () => {
  for (const base of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const source = { ...base, specs: { ...base.specs, "Controles Hidraúlicos": "Minilevers", Ruedas: "Super elásticas" } };
    assert.deepEqual(resolveHandlingOperationalDetails(source, source, "carretilla-elevadora"), [
      "mandos hidráulicos declarados de tipo minipalancas", "ruedas superelásticas declaradas"]);
    const output = resolveReusableEditorial(source);
    assert.match(output.general ?? "", /mandos hidráulicos declarados de tipo minipalancas y ruedas superelásticas declaradas/u);
    assert.equal(output.short, resolveReusableEditorial(base).short);
    const equivalent = { ...source, specs: { ...source.specs, "Mandos hidráulicos": "Mini palancas", "Tipo de ruedas": "Superelásticas" } };
    assert.deepEqual(resolveHandlingOperationalDetails(equivalent, equivalent, "carretilla-elevadora"),
      resolveHandlingOperationalDetails(source, source, "carretilla-elevadora"));
  }
});

test("los mandos y ruedas rechazan alternativas, contradicciones y configuraciones no acreditadas", () => {
  const base = controlledGamForklift();
  const source = { ...base, specs: { ...base.specs, "Controles Hidraúlicos": "Mini palancas", Ruedas: "Macizas" } };
  const details = (record: ProductRecord, prepared: ProductRecord = record): readonly string[] =>
    resolveHandlingOperationalDetails(record, prepared, "carretilla-elevadora");
  assert.deepEqual(details(source), ["mandos hidráulicos declarados de tipo minipalancas", "ruedas macizas declaradas"]);
  const ambiguous = { ...source, specs: { ...source.specs, "Controles Hidraúlicos": "Palancas / Joystick", Ruedas: "Macizas / neumáticas" } };
  assert.deepEqual(details(ambiguous), []);
  const conflicting = { ...source, specs: { ...source.specs, "Mandos hidráulicos": "Joystick", "Tipo de ruedas": "Neumáticas" } };
  assert.deepEqual(details(conflicting), []);
  const mentioned = { ...source, longDescription: "Joystick opcional. Neumáticos no confirmados." };
  assert.deepEqual(details(mentioned), []);
  assert.deepEqual(details(source, { ...source, specs: { ...source.specs, "Controles Hidraúlicos": "Palancas", Ruedas: "Superelásticas" } }), []);
  assert.deepEqual(details(source, { ...source, reference: "OTRA" }), []);
  assert.deepEqual(details(source, { ...source, providerId: "gomariz" }), []);
  const newUnit: ProductRecord = { ...source, condition: "Nuevo" };
  assert.deepEqual(details(newUnit), []);
  assert.deepEqual(resolveHandlingOperationalDetails(source, source, "plataforma-tijera"), []);
});

test("la elevación libre numérica y el radio de giro aprovechan las cotas del contrato en milímetros", () => {
  for (const base of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const source = { ...base, specs: { ...base.specs, "Altura de elevación (mm)": "4500 mm",
      "Altura mástil replegado": "2200 mm", "Elevación libre": "1600", "Radio de giro": "1800" } };
    const result = resolveHandlingOperationalDetails(source, source, "carretilla-elevadora");
    assert.ok(result.includes("elevación libre declarada de 1.600 mm"));
    assert.ok(result.includes("radio de giro declarado de 1.800 mm"));
    assert.equal(resolveReusableEditorial(source).short, resolveReusableEditorial({ ...base, specs: { ...base.specs, "Altura de elevación (mm)": "4500 mm" } }).short);
    for (const specs of [{ "Elevación libre": "2300" }, { "Elevación libre disponible": "No" }, { "Elevación libre (mm)": "1500 mm" }]) {
      const variant = { ...source, specs: { ...source.specs, ...specs } };
      assert.doesNotMatch(resolveHandlingOperationalDetails(variant, variant, "carretilla-elevadora").join(" "), /elevación libre/u);
    }
    const competing = { ...source, specs: { ...source.specs, "Radio de giro exterior": "1900 mm" } };
    assert.doesNotMatch(resolveHandlingOperationalDetails(competing, competing, "carretilla-elevadora").join(" "), /radio de giro/u);
    const described = { ...source, longDescription: "Radio de giro de 2 m. Elevación libre opcional." };
    assert.doesNotMatch(resolveHandlingOperationalDetails(described, described, "carretilla-elevadora").join(" "), /radio de giro|elevación libre/u);
    const altered = { ...source, specs: { ...source.specs, "Radio de giro": "2000", "Elevación libre": "1500" } };
    assert.doesNotMatch(resolveHandlingOperationalDetails(source, altered, "carretilla-elevadora").join(" "), /radio de giro|elevación libre/u);
    assert.deepEqual(resolveHandlingOperationalDetails(source, { ...source, reference: "OTRA" }, "carretilla-elevadora"), []);
  }
});

test("la geometría unidimensional de horquillas utiliza el largo del contrato de normalización", () => {
  for (const base of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const source = { ...base, specs: { ...base.specs, "Dimensiones Horquillas": "1180 mm" } };
    const details = (original: ProductRecord, prepared: ProductRecord = original): readonly string[] =>
      resolveHandlingOperationalDetails(original, prepared, "carretilla-elevadora");
    assert.deepEqual(details(source), ["longitud de horquillas declarada de 1.180 mm"]);
    const output = resolveReusableEditorial(source);
    assert.match(output.general ?? "", /longitud de horquillas declarada de 1.180 mm/u);
    assert.equal(output.short, resolveReusableEditorial(base).short);
    for (const raw of ["1180", "1180 kg", "200 mm", "5000 mm", "1180 / 1200 mm", "1180 x 1500 x 40 mm"]) {
      const invalid = { ...source, specs: { ...source.specs, "Dimensiones Horquillas": raw } };
      assert.deepEqual(details(invalid), []);
    }
    const alias = { ...source, specs: { ...source.specs, "Dimensiones horquillas (mm)": "1200 mm" } };
    assert.deepEqual(details(alias), []);
    const split = { ...source, specs: { ...source.specs, "Largo horquillas": "1200 mm" } };
    assert.deepEqual(details(split), []);
    const described = { ...source, longDescription: "Horquillas opcionales, sin longitud confirmada." };
    assert.deepEqual(details(described), []);
    assert.deepEqual(details(source, { ...source, specs: { ...source.specs, "Dimensiones Horquillas": "1200 mm" } }), []);
    assert.deepEqual(details(source, { ...source, reference: "OTRA" }), []);
  }
});

test("el radio de giro textual concordante recupera la cota de la tabla sin propagar alternativas ni discrepancias", () => {
  for (const base of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const source = { ...base, longDescription: "La carretilla MARCA MODELO10 tiene un radio de giro reducido de 1.800 mm.",
      specs: { ...base.specs, "Radio de giro": "1800" } };
    const details = (record: ProductRecord, prepared: ProductRecord = record) =>
      resolveHandlingOperationalDetails(record, prepared, "carretilla-elevadora");
    assert.ok(details(source).includes("radio de giro declarado de 1.800 mm"));
    for (const longDescription of ["La carretilla MARCA MODELO10 tiene un radio de giro de 1900 mm.",
      "La carretilla MARCA MODELO10 tiene un radio de giro de 1800 mm o 2000 mm.",
      "La carretilla MARCA MODELO10 tiene un radio de giro de 1800 mm opcional.",
      "La carretilla MARCA MODELO10 tiene un radio de giro de 1800 mm. Radio de giro de 2000 mm.",
      "La carretilla MARCA MODELO20 tiene un radio de giro de 1800 mm.",
      "La carretilla MARCA MODELO10 tiene un radio de giro de 1800 mm. Radio de giro sin confirmar."]) {
      assert.doesNotMatch(details({ ...source, longDescription }).join(" "), /radio de giro/u);
    }
    assert.doesNotMatch(details(source, { ...source, specs: { ...source.specs, "Radio de giro": "1900" } }).join(" "), /radio de giro/u);
    assert.doesNotMatch(details(source, { ...source, reference: "OTRA" }).join(" "), /radio de giro/u);
  }
});

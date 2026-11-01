import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { recoverGamVerifiedResidualOperationSpecs } from "../evidence/providers/gam/verified-residual-operation-evidence.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");

const expected = [
  ["5998", "Altura al suelo (mm)", "186 mm"],
  ["6991", "Longitud de horquillas (mm)", "1150 mm"],
  ["6480", "AST (mm)", "2217 / 2290 mm"],
  ["6481", "AST (mm)", "2217 / 2290 mm"],
  ["2332", "Capacidad de arrastre (kg)", "5000 KG"],
  ["6573", "Dimensiones horquillas (mm)", "1150x120x40 mm"],
  ["4844", "Rotación de cesta", "90° a cada lado"],
  ["4845", "Rotación de cesta", "90° a cada lado"],
  ["6547", "Rotación de cesta", "60° + 60°"],
  ["6326", "Velocidad de desplazamiento (km/h)", "15–16 km/h (rango publicado)"],
  ["6327", "Velocidad de desplazamiento (km/h)", "15–16 km/h (rango publicado)"],
  ["5903", "Radio de giro (mm)", "1020 mm"],
  ["2094", "Consumo", "6,2 l/h (ciclo VDI)"],
  ["2024", "Neumáticos", "De bandaje"],
  ["2367", "Neumáticos", "De bandaje"],
  ["6990", "Ruedas", "Poliuretano"],
  ["2076", "Neumáticos", "Superelásticos"],
  ["6272", "Radio de giro exterior", "≈ 4874 mm (según configuración)"],
  ["4021", "Nivel sonoro", "84 dBA"],
  ["6746", "Nivel sonoro", "< 70 dB(A) (puesto de conducción)"]
] as const;

const find = (reference: string): ProductRecord => {
  const result = gam.products.find((candidate) => candidate.reference === reference);
  assert.ok(result, reference);
  return result;
};

test("fase 85: exactamente veinte fichas originales GAM incorporan especificaciones acreditadas", () => {
  assert.equal(new Set(expected.map(([reference]) => reference)).size, 20);
  const changed: string[] = [];
  for (const record of gam.products) {
    const original = structuredClone(record);
    const result = recoverGamVerifiedResidualOperationSpecs(record);
    const added = Object.entries(result).filter(([key]) => !Object.hasOwn(record.specs ?? {}, key));
    const modified = Object.entries(record.specs ?? {}).filter(([key, value]) => result[key] !== value);
    assert.deepEqual(modified, [], String(record.reference));
    assert.deepEqual(record, original, String(record.reference));
    if (added.length > 0) {
      assert.equal(added.length, 1, String(record.reference));
      changed.push(String(record.reference));
    }
  }
  assert.deepEqual(new Set(changed), new Set(expected.map(([reference]) => reference)));
  assert.equal(changed.length, 20);
});

test("fase 85: las veinte especificaciones llegan al preparador y sobreviven al normalizador", () => {
  for (const [reference, key, value] of expected) {
    const record = find(reference);
    assert.equal(Object.hasOwn(record.specs ?? {}, key), false, reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.spec[key], value, reference);
    const normalized = normalizeSpecsObject(prepared.product.spec);
    assert.equal(normalized.unknownKeys.includes(key), false, reference);
    assert.ok(normalized.normalized[key] !== undefined, reference);
    for (const [existingKey, existingValue] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[existingKey], existingValue, `${reference}: ${existingKey}`);
    }
  }
  const fork = normalizeSpecsObject(prepareSourceProduct(find("6573")).product.spec).normalized["Dimensiones horquillas (mm)"];
  assert.deepEqual(fork, { largo: 1150, ancho: 120, grosor: 40 });
  assert.deepEqual(normalizeSpecsObject(prepareSourceProduct(find("6480")).product.spec).normalized["AST (mm)"], [2217, 2290]);
  assert.deepEqual(normalizeSpecsObject(prepareSourceProduct(find("6326")).product.spec).normalized["Velocidad de desplazamiento (km/h)"], [15, 16]);
  assert.equal(normalizeSpecsObject(prepareSourceProduct(find("6991")).product.spec).normalized["Longitud de horquillas (mm)"], 1150);
  assert.equal(normalizeSpecsObject(prepareSourceProduct(find("5998")).product.spec).normalized["Altura al suelo (mm)"], 186);
  assert.equal(normalizeSpecsObject(prepareSourceProduct(find("2332")).product.spec).normalized["Capacidad de arrastre (kg)"], 5000);
});

test("fase 85: no sobrescribe datos anteriores ni cruza proveedores, fuentes, referencias o modelos", () => {
  for (const [reference, key] of expected) {
    const original = find(reference);
    const variants: readonly ProductRecord[] = [
      { ...original, providerId: "gomariz" },
      { ...original, reference: "9999" },
      { ...original, title: "Equipo distinto" },
      { ...original, url: `${original.url}?variante=ajena` },
      { ...original, model: "OTRO-MODELO" },
      { ...original, condition: "Segunda mano" },
      { ...original, categoryKey: "categoria-ajena" },
      { ...original, specs: { ...original.specs, [key]: "valor previo" } }
    ];
    for (const variant of variants) {
      assert.deepEqual(recoverGamVerifiedResidualOperationSpecs(variant), variant.specs ?? {}, `${reference}: variante protegida`);
    }
  }
  for (const record of gomariz.products) {
    assert.deepEqual(recoverGamVerifiedResidualOperationSpecs(record), record.specs ?? {}, String(record.reference));
  }
});

test("fase 85: rechaza valores incompatibles y conserva las condiciones expresas", () => {
  for (const [reference, prior, modified] of [
    ["6326", "hasta 15–16 km/h", "hasta 15–19 km/h"],
    ["6480", "2.217 mm a 2.290 mm", "2.217 mm a 2.390 mm"],
    ["2332", "5,000 kg", "7,000 kg"],
    ["6573", "40 / 120 / 1150 mm", "40 / 120 / 1200 mm"],
    ["4844", "90° a izquierda y derecha", "190° a izquierda y derecha"],
    ["6547", "60° + 60°", "60° + 80°"],
    ["2094", "6,2 l/h", "8,2 l/h"],
    ["4021", "84 dBA", "94 dBA"],
    ["6746", "70 dB(A)", "80 dB(A)"],
    ["6272", "4.874 mm", "5.874 mm"]
  ] as const) {
    const record = find(reference);
    const description = record.longDescription ?? "";
    assert.ok(description.includes(prior), reference);
    const changed = { ...record, longDescription: description.replace(prior, modified) };
    assert.deepEqual(recoverGamVerifiedResidualOperationSpecs(changed), changed.specs ?? {}, reference);
  }
  assert.equal(prepareSourceProduct(find("6272")).product.spec["Radio de giro exterior"], "≈ 4874 mm (según configuración)");
  assert.equal(prepareSourceProduct(find("6746")).product.spec["Nivel sonoro"], "< 70 dB(A) (puesto de conducción)");
  assert.equal(prepareSourceProduct(find("2094")).product.spec["Consumo"], "6,2 l/h (ciclo VDI)");
});

import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { recoverGamSourceSafetyControls } from "../../../../evidence/providers/gam/operations-and-safety/source-safety-controls-evidence.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const sourceOf = (reference: string): ProductRecord => {
  const source = catalog.products.find((record) => record.reference === reference);
  assert.ok(source, reference);
  return source;
};

test("recupera prestaciones operativas afirmadas por anuncios identificados sin modificar el original", () => {
  for (const [reference, key] of [
    ["2079", "Frenado automático"],
    ["6901", "Controles proporcionales"],
    ["5792", "Dirección asistida"]
  ] as const) {
    const record = sourceOf(reference);
    const unchanged = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.spec[key], true, reference);
    for (const [originalKey, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[originalKey], value, `${reference}: ${originalKey}`);
    }
    assert.deepEqual(record, unchanged);
  }
});

test("rechaza afirmaciones negativas, opcionales, otra identidad y prestaciones preexistentes", () => {
  const record = sourceOf("2079");
  const specs = record.specs ?? {};
  const long = record.longDescription ?? "";
  const variants: ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, model: "H2.5FTS" },
    { ...record, brand: record.brand === "YALE" ? "HYSTER" : "YALE" },
    { ...record, reference: "9999" },
    { ...record, url: `${record.url}?variante=otra` },
    { ...record, url: record.url.replace("h20fts", "h25fts") },
    { ...record, specs: { ...specs, Modelo: "H2.5FTS" } },
    { ...record, longDescription: long.replace(/frenado automático/iu, "frenado automático opcional") },
    { ...record, longDescription: long.replace(/frenado automático/iu, "sin frenado automático") },
    { ...record, longDescription: `${long} Sin frenado automático.` },
    { ...record, longDescription: `${long} Puede incluir frenado automático.` },
    { ...record, longDescription: long.replace(/frenado automático/iu, "frenado regenerativo") },
    { ...record, specs: { ...specs, "Frenado automático": false } }
  ];
  for (const variant of variants) {
    assert.deepEqual(recoverGamSourceSafetyControls(variant, variant.specs ?? {}), variant.specs ?? {}, variant.url);
  }
  assert.deepEqual(
    recoverGamSourceSafetyControls(record, { ...specs, "Frenado automático": false }),
    { ...specs, "Frenado automático": false }
  );
});

test("rechaza controles proporcionales y dirección asistida cuando son opcionales o están negados", () => {
  for (const [reference, claim] of [
    ["6901", "controles proporcionales"],
    ["5792", "dirección asistida"]
  ] as const) {
    const record = sourceOf(reference);
    const specs = record.specs ?? {};
    const long = record.longDescription ?? "";
    for (const altered of [
      long.replace(new RegExp(claim, "iu"), `${claim} opcionales`),
      long.replace(new RegExp(claim, "iu"), `sin ${claim}`),
      `${long} Sin ${claim}.`
    ]) {
      assert.deepEqual(
        recoverGamSourceSafetyControls({ ...record, longDescription: altered }, specs),
        specs, reference
      );
    }
  }
});

test("recupera detección de obstáculos y control de estabilidad solo cuando están afirmados por la fuente", () => {
  for (const [reference, key] of [
    ["2227", "Detección de obstáculos"],
    ["2080", "Control de estabilidad"]
  ] as const) {
    const record = sourceOf(reference);
    const original = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready");
    assert.equal(prepared.product.spec[key], true);
    assert.deepEqual(record, original);
    for (const [name, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[name], value);
    }
  }
});

test("no atribuye detección ni estabilidad a variantes, afirmaciones opcionales o negativas", () => {
  for (const [reference, key, claim] of [
    ["2227", "Detección de obstáculos", "detección de obstáculos"],
    ["2080", "Control de estabilidad", "control de estabilidad"]
  ] as const) {
    const record = sourceOf(reference);
    const source = record.specs ?? {};
    const text = record.longDescription ?? "";
    const alteredDescriptions = [
      text.replace(new RegExp(claim, "iu"), `sin ${claim}`),
      text.replace(new RegExp(claim, "iu"), `${claim} opcional`),
      `${text} Sin ${claim}.`,
      `${text} ${claim} como opción.`
    ];
    for (const longDescription of alteredDescriptions) {
      assert.deepEqual(recoverGamSourceSafetyControls({ ...record, longDescription }, source), source);
    }
    for (const variant of [
      { ...record, brand: record.brand === "YALE" ? "HYSTER" : "YALE" },
      { ...record, model: "MODELO INEXISTENTE" },
      { ...record, url: `${record.url}?variante=otra` },
      { ...record, specs: { ...source, Modelo: "MODELO INEXISTENTE" } }
    ]) {
      assert.deepEqual(recoverGamSourceSafetyControls(variant, variant.specs ?? {}), variant.specs ?? {});
    }
    const existing = { ...source, [key]: false };
    assert.deepEqual(recoverGamSourceSafetyControls({ ...record, specs: existing }, existing), existing);
  }
});

test("recupera controles TCS, protección ACS y parada de emergencia acreditados por la misma variante", () => {
  for (const [reference, keys] of [
    ["293", ["Control de tracción TCS", "Sistema antivuelco ACS"]],
    ["4731", ["Parada de emergencia"]]
  ] as const) {
    const record = sourceOf(reference);
    const original = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    for (const key of keys) assert.equal(prepared.product.spec[key], true, `${reference}: ${key}`);
    for (const [name, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[name], value, `${reference}: ${name}`);
    }
    assert.deepEqual(record, original);
  }
});

test("no acredita TCS, ACS o parada de emergencia sin identidad y afirmación inequívocas", () => {
  for (const [reference, key, claim] of [
    ["293", "Control de tracción TCS", "Sistema de Control de Tracción TCS"],
    ["293", "Sistema antivuelco ACS", "sistema antivuelco ACS"],
    ["4731", "Parada de emergencia", "parada de emergencia"]
  ] as const) {
    const record = sourceOf(reference);
    const specs = record.specs ?? {};
    const description = record.longDescription ?? "";
    const claims = [
      description.replace(claim, `sin ${claim}`),
      description.replace(claim, `${claim} opcional`),
      description.replace(claim, `puede incorporar ${claim}`),
      `${description} Sin ${claim}.`,
      `${description} ${claim} como opción.`
    ];
    for (const longDescription of claims) {
      assert.equal(recoverGamSourceSafetyControls({ ...record, longDescription }, specs)[key], undefined);
    }
    for (const variant of [
      { ...record, providerId: "gomariz" },
      { ...record, model: "MODELO DISTINTO" },
      { ...record, brand: "FABRICANTE DISTINTO" },
      { ...record, reference: "99999" },
      { ...record, url: `${record.url}?variante=otra` },
      { ...record, specs: { ...specs, Modelo: "MODELO DISTINTO" } }
    ]) {
      assert.deepEqual(recoverGamSourceSafetyControls(variant, variant.specs ?? {}), variant.specs ?? {});
    }
    const existing = { ...specs, [key]: false };
    assert.equal(recoverGamSourceSafetyControls({ ...record, specs: existing }, existing)[key], false);
  }
});

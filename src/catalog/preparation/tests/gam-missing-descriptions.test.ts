import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { prepareImportBatch } from "../batch-identity.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { gamMissingDescriptions } from "../mapping/providers/gam/missing-descriptions.js";

const source = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const catalog = await loadImportCatalog();
const find = (reference: string): ProductRecord => {
  const record = source.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("GAM: recupera únicamente las dos carretillas HELI con identidad y carga acreditadas", () => {
  for (const [reference, capacity] of [["4683", "2.500"], ["4691", "3.000"]] as const) {
    const record = find(reference);
    const before = JSON.stringify(record);
    const generated = gamMissingDescriptions(record);
    assert.ok(generated.short, reference);
    assert.ok(generated.long, reference);
    assert.match(generated.short, new RegExp(`${record.model}.*${capacity.replace(".", "\\.")} kg`));
    assert.match(generated.long, new RegExp(`${record.model}.*${capacity.replace(".", "\\.")} kg`));
    assert.match(generated.short, /GLP/);
    assert.match(generated.long, /GLP/);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.description, generated.short, reference);
    assert.equal(prepared.product.description_general, generated.long, reference);
    assert.equal(prepared.product.reference, record.reference, reference);
    assert.equal(prepared.product.sourceUrl, record.url, reference);
    assert.deepEqual(prepared.product.spec, record.specs, reference);
    assert.equal(JSON.stringify(record), before, reference);
  }
});

test("GAM: completa SKY DECK con evidencia del accesorio BRAVI sin atribuirle altura de trabajo", () => {
  const record = find("2364");
  const generated = gamMissingDescriptions(record);
  assert.match(generated.short ?? "", /soporte de paneles/i);
  assert.match(generated.long ?? "", /16 kg por soporte/);
  assert.doesNotMatch(generated.long ?? "", /altura de trabajo|motor eléctrico/i);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.description, generated.short);
  assert.equal(prepared.product.description_general, generated.long);
  assert.equal(prepared.product.reference, "2364");
});

test("GAM: rechaza contradicciones de identidad, fuente, combustible y capacidad", () => {
  const record = find("4683");
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, categoryKey: "manutencion" },
    { ...record, condition: "Segunda mano" },
    { ...record, brand: "CLARK" },
    { ...record, model: "CPQYD30-RC1H" },
    { ...record, reference: "4691" },
    { ...record, externalReference: "CPQYD30-RC1H" },
    { ...record, url: record.url.replace("online.gamrentals.com", "otro.example") },
    { ...record, url: record.url.replace("/4683-", "/4691-") },
    { ...record, url: `${record.url}?ref=otro` },
    { ...record, title: record.title?.replace("2500", "3000") ?? null },
    { ...record, title: record.title?.replace("Heli", "CLARK") ?? null },
    { ...record, title: record.title?.replace("GLP", "DIESEL") ?? null },
    { ...record, shortDescription: "Descripción del vendedor" },
    { ...record, longDescription: "Descripción general del vendedor" },
    { ...record, specs: { ...record.specs, Marca: "CLARK" } },
    { ...record, specs: { ...record.specs, Modelo: "CPQYD30-RC1H" } },
    { ...record, specs: { ...record.specs, "Tipo motor": "Diesel" } },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "3000 KG" } },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": ["2500 KG", "3000 KG"] } },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "2.500 / 3.000 KG" } },
    { ...record, specs: { ...record.specs, "Altura de elevación": "5 m" } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.deepEqual(gamMissingDescriptions(variant), { short: null, long: null }, String(index));
  }
});

test("GAM: no altera el resto del catálogo ni los estados en preparación completa", () => {
  const expected = new Set(["4683", "4691", "2364"]);
  let recovered = 0;
  for (const record of source.products) {
    const result = gamMissingDescriptions(record);
    if (expected.has(record.reference ?? "")) {
      assert.ok(result.short && result.long, record.reference ?? "");
      recovered++;
    } else {
      assert.deepEqual(result, { short: null, long: null }, record.reference ?? "sin referencia");
    }
  }
  assert.equal(source.products.length, 983);
  assert.equal(recovered, 3);

  const batch = prepareImportBatch(source.products, catalog);
  assert.equal(batch.products.length, source.products.length);
  assert.deepEqual(batch.products.filter((item) => item.status === "review").map((item) => item.product.reference).sort(), ["6682", "6703"]);
  const generated = batch.products.filter((item) => item.product.description &&
    ["4683", "4691", "2364"].includes(item.product.reference ?? ""));
  assert.equal(generated.length, 3);
  assert.ok(batch.products.find((item) => item.product.reference === "2364")?.product.description);
  assert.ok(batch.products.find((item) => item.product.reference === "2364")?.product.description_general);
});

test("GAM: las derivaciones son deterministas y no interfieren con Gomariz o Mercaeleva", async () => {
  const record = find("4691");
  assert.deepEqual(gamMissingDescriptions(record), gamMissingDescriptions(record));
  assert.deepEqual(gamMissingDescriptions({ ...record, providerId: "mercaeleva" }), { short: null, long: null });
  const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
  for (const item of gomariz.products) assert.deepEqual(gamMissingDescriptions(item), { short: null, long: null });
});

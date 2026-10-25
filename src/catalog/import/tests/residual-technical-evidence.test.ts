import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const gam = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const mercaeleva = await readCanonicalCatalog("storage/scraped/mercaeleva/scrape-mercaeleva-catalog.json");
const source = (reference: string, provider: "gam" | "mercaeleva" = "gam"): ProductRecord => {
  const record = (provider === "gam" ? gam : mercaeleva).products.find((product) => product.reference === reference);
  assert.ok(record, `${provider}:${reference}`);
  return record;
};
const attribute = (name: string) => {
  const found = catalog.attributes.find((item) => item.name === name);
  assert.ok(found, name);
  return found;
};

const cases = [
  { provider: "gam", reference: "6702", name: "Altura de elevación", status: "contradiction", issue: "Atributo contradictorio: Altura de elevación" },
  { provider: "gam", reference: "5275", name: "Altura de elevación", status: "contradiction", issue: "Atributo contradictorio: Altura de elevación" },
  { provider: "gam", reference: "6887", name: "Altura de elevación", status: "contradiction", issue: "Atributo contradictorio: Altura de elevación" },
  { provider: "gam", reference: "5864", name: "Altura de elevación", status: "contradiction", issue: "Atributo contradictorio: Altura de elevación" },
  { provider: "gam", reference: "3134", name: "Altura de elevación", status: "contradiction", issue: "Atributo contradictorio: Altura de elevación" },
  { provider: "gam", reference: "4004", name: "Ancho de trabajo", status: "resolved", issue: "Atributo contradictorio: Ancho de trabajo" },
  { provider: "mercaeleva", reference: "M104-0836", name: "Tipo de mástil", status: "contradiction", issue: "Atributo contradictorio: Tipo de mástil" },
] as const;

test("las contradicciones técnicas pendientes mantienen su bloqueo y su causa", () => {
  assert.equal(cases.length, 7);
  for (const entry of cases) {
    const record = source(entry.reference, entry.provider);
    const resolution = resolveAttribute(record, attribute(entry.name));
    const prepared = prepareProduct(record, catalog);
    assert.equal(resolution.status, entry.status, `${entry.provider}:${entry.reference}`);
    assert.equal(resolution.value, entry.reference === "4004" ? 800 : null, `${entry.provider}:${entry.reference}`);
    const resolvedInPreparation = ["3134", "6702", "5275", "5864", "6887", "4004", "M104-0836"].includes(entry.reference);
    assert.equal(prepared.status, resolvedInPreparation ? "ready" : "review", `${entry.provider}:${entry.reference}`);
    assert.equal(prepared.issues.includes(entry.issue), !resolvedInPreparation, `${entry.provider}:${entry.reference}`);
  }
});

test("la altura comercial restante mantiene separado el valor técnico de la descripción", () => {
  const record = source("M486-0114", "mercaeleva");
  assert.deepEqual(resolveAttribute(record, attribute("Altura de trabajo")), { status: "resolved", value: 16 });
  const prepared = prepareProduct(record, catalog);
  assert.equal(prepared.status, "ready");
  assert.equal(prepared.issues.length, 0);
  assert.match(prepared.product.description ?? "", /altura de trabajo 16 mt/i);
});

test("una pareja de radios Yale no se convierte en medida única", () => {
  const record = source("2285");
  assert.equal(record.specs?.["Radio de giro"], "3580 / 3780");
  assert.equal(resolveAttribute(record, attribute("Radio de giro")).status, "not_observed");
  assert.equal(prepareProduct(record, catalog).status, "ready");
  assert.equal(prepareProduct(record, catalog).product.spec["Radio de giro"], "3580 / 3780");
  const single = { ...record, specs: { ...record.specs, "Radio de giro": "3580" } };
  assert.deepEqual(resolveAttribute(single, attribute("Radio de giro")), { status: "resolved", value: 3580 });
  const typo = source("2288");
  assert.equal(typo.specs?.["Radio de giro"], "389 / 4009");
  assert.equal(resolveAttribute(typo, attribute("Radio de giro")).status, "not_observed");
});

test("un ancho de limpieza discrepante solo es válido al coincidir con la fuente", () => {
  const sweeper = source("4024");
  assert.equal(sweeper.specs?.["Anchura trabajo"], "0,85 metros");
  assert.deepEqual(resolveAttribute(sweeper, attribute("Ancho de trabajo")), { status: "resolved", value: 860 });
  const consistent = { ...sweeper, specs: { ...sweeper.specs, "Anchura trabajo": "0,86 metros" } };
  assert.deepEqual(resolveAttribute(consistent, attribute("Ancho de trabajo")), { status: "resolved", value: 860 });
});

test("las alternativas de mástil no se reinterpretan como configuración confirmada", () => {
  const mixed = source("M818-7811", "mercaeleva");
  assert.equal(resolveAttribute(mixed, attribute("Tipo de mástil")).status, "not_observed");
  const matching = {
    ...mixed,
    longDescription: (mixed.longDescription ?? "").replace("DUPLEX TRIPLEX", "DUPLEX")
  };
  assert.deepEqual(resolveAttribute(matching, attribute("Tipo de mástil")), { status: "resolved", value: "Dúplex" });
  const conflicting = source("M104-0836", "mercaeleva");
  assert.equal(resolveAttribute(conflicting, attribute("Tipo de mástil")).status, "contradiction");
});

test("el identificador incluido en el horómetro no se convierte en horas de uso", () => {
  const record = source("6775");
  assert.equal(record.horometer, "NA V72309090022 horas");
  assert.equal(record.specs?.["Horómetro"], record.horometer);
  assert.deepEqual(resolveAttribute(record, attribute("Horas de uso")), { status: "not_observed", value: null });
  const measured = { ...record, horometer: "181 horas", specs: { ...record.specs, "Horómetro": "181 horas" } };
  assert.deepEqual(resolveAttribute(measured, attribute("Horas de uso")), { status: "resolved", value: 181 });
});

import assert from "node:assert/strict";
import test from "node:test";
import { gamCapacityDisputedReferences, gamCapacityVerifiedReferences } from "./gam-technical-cohorts.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const sourceGam = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const sourceMercaeleva = await readCanonicalCatalog("storage/scraped/mercaeleva/scrape-mercaeleva-catalog.json");
const byReference = (provider: "gam" | "mercaeleva", reference: string): ProductRecord => {
  const source = provider === "gam" ? sourceGam : sourceMercaeleva;
  const record = source.products.find((product) => product.reference === reference);
  assert.ok(record, `${provider}:${reference}`);
  return record;
};
const attr = (name: string) => {
  const attribute = catalog.attributes.find((item) => item.name === name);
  assert.ok(attribute, name);
  return attribute;
};
const load = attr("Capacidad de carga");
const mast = attr("Tipo de mástil");

const incompatibleGam = gamCapacityDisputedReferences;
const differentMercaeleva = ["M827-8304"];
const incompatibleMasts = ["M827-8304", "M818-7811", "M104-0836"];

test("las dieciséis fichas conservan sus fuentes, con once capacidades acreditadas", () => {
  const confirmed = new Set<string>(gamCapacityVerifiedReferences);
  for (const id of incompatibleGam) {
    const record = byReference("gam", id);
    const original = JSON.stringify(record);
    const actual = resolveAttribute(record, load);
    assert.equal(actual.status, confirmed.has(id) ? "resolved" : "contradiction", id);
    assert.equal(actual.value === null, !confirmed.has(id), id);
    const prepared = prepareProduct(record, catalog);
    assert.equal(prepared.status, confirmed.has(id) || ["2237", "2240", "6723", "2211", "6272"].includes(id) ? "ready" : "review", id);
    assert.deepEqual(prepared.product.spec, record.specs ?? {}, id);
    assert.equal(JSON.stringify(record), original, id);
  }
});

test("tres cargas GAM multivariantes son rechazos por selección pendiente, no números corruptos", () => {
  for (const id of ["239", "237", "235"]) {
    const record = byReference("gam", id);
    assert.deepEqual(resolveAttribute(record, load), { status: "not_observed", value: null }, id);
    const prepared = prepareProduct(record, catalog);
    assert.equal(prepared.status, "ready", id);
    assert.ok(!prepared.product.attributes.some((item) => item.attributeID === load.id), id);
    assert.deepEqual(prepared.product.spec, record.specs);
  }
});

test("múltiples valores son distintos de miles, decimales y una única capacidad", () => {
  const source = byReference("gam", "239");
  for (const specification of ["200/300 KG", "1.500 - 2.000 kg", "1600/2500/3000 KG", "1600 a 2500 kg"]) {
    const record = { ...source, specs: { ...source.specs, "Capacidad de carga (kg)": specification } };
    assert.equal(resolveAttribute(record, load).status, specification === "200/300 KG" ? "not_observed" : "rejected", specification);
  }
  for (const specification of ["2.000 kg", "2,5 kg", "2000/2000 kg"]) {
    const record = { ...source, specs: { ...source.specs, "Capacidad de carga (kg)": specification }, shortDescription: null };
    assert.notEqual(resolveAttribute(record, load).status, "rejected", specification);
  }
});

test("la capacidad Mercaeleva pendiente sigue sin corroboración técnica", () => {
  for (const id of differentMercaeleva) {
    const record = byReference("mercaeleva", id);
    const original = JSON.stringify(record);
    assert.deepEqual(resolveAttribute(record, load), { status: "contradiction", value: null }, id);
    assert.ok(prepareProduct(record, catalog).issues.includes("Atributo contradictorio: Capacidad de carga"), id);
    assert.equal(JSON.stringify(record), original, id);
  }
});

test("tres discrepancias de mástil Mercaeleva no se borran por alias equivalentes", () => {
  for (const id of incompatibleMasts) {
    const record = byReference("mercaeleva", id);
    assert.deepEqual(resolveAttribute(record, mast), { status: id === "M818-7811" ? "not_observed" : "contradiction", value: null }, id);
    assert.equal(prepareProduct(record, catalog).status, id === "M827-8304" ? "review" : "ready", id);
  }
  const original = byReference("mercaeleva", "M827-8304");
  const consistent = { ...original, longDescription: original.longDescription?.replace("MASTIL DUPLEX", "MASTIL TRIPLEX") ?? null };
  assert.deepEqual(resolveAttribute(consistent, mast), { status: "resolved", value: "Tríplex" });
  const alternate = { ...original, specs: { ...original.specs, "Tipo de mástil": "Dúplex/estándar" }, longDescription: "Linde E48P MÁSTIL DÚPLEX" };
  assert.deepEqual(resolveAttribute(alternate, mast), { status: "resolved", value: "Dúplex" });
});

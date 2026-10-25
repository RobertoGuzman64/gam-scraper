import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { findSerialNumberCollisions } from "../../identity-conflicts.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { prepareImportBatch } from "../preparation/batch-identity.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog(fileURLToPath(new URL(
  "../../../../storage/scraped/gam/scrape-gam-marzo-2026-catalog.json", import.meta.url
)));
const reference = (code: string) => {
  const found = source.products.find((product) => product.reference === code);
  assert.ok(found, code);
  return found;
};
const attribute = (name: string) => {
  const found = catalog.attributes.find((entry) => entry.name === name);
  assert.ok(found, name);
  return found;
};
const status = (code: string, name: string) => resolveAttribute(reference(code), attribute(name)).status;

test("GAM: identidad de elevación contradictoria bloquea también la cesta y pendiente del modelo", () => {
  const affected = ["6981", "4736", "4737", "4750", "4802", "4751", "4752", "5902", "6308"];
  for (const code of affected) {
    for (const name of ["Altura de trabajo", "Altura de plataforma", "Alcance horizontal", "Altura de elevación"]) {
      assert.equal(status(code, name), "rejected", `${code}: ${name}`);
    }
  }
  assert.equal(status("6981", "Capacidad de la cesta"), "rejected");
  assert.equal(status("6308", "Capacidad de la cesta"), "rejected");
  for (const code of affected.filter((value) => value !== "6308")) {
    assert.equal(status(code, "Dimensiones de la cesta"), "rejected", code);
    assert.equal(status(code, "Pendiente superable"), "rejected", code);
  }
  assert.equal(status("6308", "Dimensiones de la cesta"), "not_observed");
  assert.equal(status("6308", "Pendiente superable"), "not_observed");
});

test("GAM: una ficha con modelo coherente conserva sus dimensiones y pendientes verificables", () => {
  const record = reference("4743");
  assert.equal(resolveAttribute(record, attribute("Dimensiones de la cesta")).status, "resolved");
  assert.equal(resolveAttribute(record, attribute("Pendiente superable")).status, "resolved");
  const conflict = { ...record, model: "XG1012AC-LI" };
  assert.equal(resolveAttribute(conflict, attribute("Dimensiones de la cesta")).status, "rejected");
  assert.equal(resolveAttribute(conflict, attribute("Pendiente superable")).status, "rejected");
  assert.notEqual(resolveAttribute({ ...record, providerId: "gomariz" }, attribute("Dimensiones de la cesta")).status, "rejected");
});

test("GAM: las potencias incompatibles siguen rechazadas y las compatibles se conservan", () => {
  assert.equal(status("6834", "Potencia"), "resolved");
  assert.deepEqual(resolveAttribute(reference("1214"), attribute("Potencia")), { status: "resolved", value: 200 });
  assert.deepEqual(resolveAttribute(reference("1211"), attribute("Potencia")), { status: "resolved", value: 80 });
});

test("GAM: las colisiones de serie no fusionan referencias ni ocultan avisos", () => {
  const references = ["6682", "6703", "6835", "6858", "6807", "6806"];
  const records = references.map(reference);
  assert.deepEqual(findSerialNumberCollisions(records).map((entry) =>
    entry.products.map((product) => product.reference).sort()).sort(), [
    ["6682", "6703"], ["6806", "6807"], ["6835", "6858"]
  ].sort());
  const prepared = prepareImportBatch(records, catalog);
  assert.equal(prepared.products.length, records.length);
  assert.equal(prepared.totals.review, records.length - 4);
  for (const product of prepared.products) {
    assert.equal(product.status, ["6806", "6807", "6835", "6858"].includes(product.product.reference ?? "") ? "ready" : "review");
    if (["6806", "6807", "6835", "6858"].includes(product.product.reference ?? "")) assert.deepEqual(product.issues, []);
    else assert.ok(product.issues.some((issue) => issue.includes("Número de serie") && issue.includes("compartido")));
  }
});

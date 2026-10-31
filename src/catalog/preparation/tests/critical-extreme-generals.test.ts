import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../prepare-product.js";

const original = async (provider: "gam" | "gomariz") => readCanonicalCatalog(fileURLToPath(new URL(
  `../../../../catalogs/providers/${provider}/original/${provider === "gam" ? "scrape-gam-marzo-2026" : "scrape-gomariz"}-catalog.json`, import.meta.url
)));

test("recupera dos generales extremas sin asignar datos técnicos a otras identidades", async () => {
  const [gam, gomariz] = await Promise.all([original("gam"), original("gomariz")]);
  const cases = [
    { source: gam.products.find((item) => item.reference === "6617"), details: ["Genie S-65", "227 kg", "6.043 horas"] },
    { source: gomariz.products.find((item) => item.reference === "BT1461"), details: ["Skyjack SJ45T", "15,60 m", "227 kg"] }
  ];
  for (const { source, details } of cases) {
    assert.ok(source);
    const before = JSON.stringify(source);
    const result = prepareSourceProduct(source);
    const description = result.product.description_general ?? "";
    assert.ok(description.trim().split(/\s+/u).length >= 60);
    for (const detail of details) assert.ok(description.toLocaleLowerCase("es").includes(detail.toLocaleLowerCase("es")));
    assert.deepEqual(result.product.spec, source.specs);
    assert.equal(JSON.stringify(source), before);
    assert.notEqual(prepareSourceProduct({ ...source, reference: "otra" }).product.description_general, description);
    assert.notEqual(prepareSourceProduct({ ...source, specs: { ...source.specs, Capacidad: "999 kg",
      "Capacidad de carga (kg)": "999 KG" } }).product.description_general, description);
  }
});

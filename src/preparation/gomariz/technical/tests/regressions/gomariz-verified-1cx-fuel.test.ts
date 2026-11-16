import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { prepareProduct } from "../../../../../commercial/legacy-export/prepare-product.js";
import { loadImportCatalog } from "../../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { accreditedSourceRecord } from "../../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { reconcileGomarizDocumented1cxFuel } from "../../evidence/verified-1cx-fuel.js";

const catalog = await loadImportCatalog();
const original = (): ProductRecord => accreditedSourceRecord("gomariz-original", "RE454");

test("la retroexcavadora 1CX acreditada conserva identidad y original y publica motorización diésel", () => {
  const source = original();
  const snapshot = JSON.stringify(source);
  const corrected = reconcileGomarizDocumented1cxFuel(source);
  assert.notStrictEqual(corrected, source);
  assert.equal(corrected.specs?.Motor, "Diésel");
  assert.equal(corrected.reference, source.reference);
  assert.equal(corrected.url, source.url);
  assert.equal(corrected.title, source.title);
  assert.equal(corrected.year, source.year);
  assert.strictEqual(reconcileGomarizDocumented1cxFuel(corrected), corrected);
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.match(prepared.product.title ?? "", /diésel/iu);
  assert.match(prepared.product.description ?? "", /diésel/iu);
  assert.equal(prepared.product.spec.Motor, "Diésel");
  const imported = prepareProduct(source, catalog);
  assert.equal(imported.status, "ready");
  assert.deepEqual(imported.issues, []);
  assert.equal(imported.product.spec.Motor, "Diésel");
  assert.equal(source.specs?.Motor, "Eléctrico");
  assert.equal(JSON.stringify(source), snapshot);
});

test("la evidencia de la JCB no se aplica a otro origen, año, identidad, versión o ficha", () => {
  const source = original();
  const variants: readonly ProductRecord[] = [
    { ...source, providerId: "gam" },
    { ...source, reference: "RE454-OTRA" },
    { ...source, url: `${source.url}?version=2` },
    { ...source, categoryKey: "alquiler" },
    { ...source, condition: "Nuevo" },
    { ...source, brand: "OTRA" },
    { ...source, model: "1CX-OTRA" },
    { ...source, title: `${source.title} distinta` },
    { ...source, year: "1999" },
    { ...source, shortDescription: `${source.shortDescription} versión distinta` },
    { ...source, longDescription: `${source.longDescription} versión distinta` },
    { ...source, specs: { ...source.specs, Motor: "Gasolina" } },
    { ...source, specs: { ...source.specs, Peso: "3159 KG" } },
    { ...source, specs: { ...source.specs, Capacidad: "700 kg" } }
  ];
  for (const variant of variants) {
    assert.strictEqual(reconcileGomarizDocumented1cxFuel(variant), variant, variant.url);
  }
});

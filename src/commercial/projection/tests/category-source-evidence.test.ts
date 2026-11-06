import assert from "node:assert/strict";
import test from "node:test";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { loadCommercialPublicationInputs } from "../../export/commercial-inputs.js";
import { isValidCommercialCategory, projectCommercialCategory } from "../category-projection.js";

const catalog = await loadImportCatalog();
const providers = await loadCommercialPublicationInputs(process.cwd(), catalog);
const entries = providers.flatMap((provider) => provider.entries);
const entryFor = (providerId: string, reference: string) => {
  const entry = entries.find((item) => item.source.providerId === providerId && item.source.reference === reference);
  assert.ok(entry, `${providerId}:${reference}`);
  return entry;
};

const unassigned = (mapped: (typeof entries)[number]["mapped"]) => ({
  ...mapped,
  product: { ...mapped.product, categorySellID: null, category: null, attributes: [] }
});

test("matriz real de evidencia por proveedor, categoría y condición", () => {
  const cases: readonly (readonly [string, string, number])[] = [
    ["gam", "2072", 16], ["gam", "2073", 16], ["gam", "8", 10],
    ["gam", "6653", 67], ["gam", "6358", 80], ["gam", "6814", 115],
    ["gam", "220", 22], ["gam", "3311", 91], ["gam", "3427", 85],
    ["gomariz", "1011JFB", 74], ["gomariz", "RE454", 67], ["gomariz", "PV556", 80],
    ["mercaeleva", "M294-4678", 115]
  ];
  for (const [providerId, reference, categoryId] of cases) {
    const entry = entryFor(providerId, reference);
    const condition = entry.mapped.product.condition;
    assert.notEqual(condition, null);
    const result = projectCommercialCategory(entry.source, unassigned(entry.mapped), catalog);
    assert.equal(result.product.categorySellID, categoryId, `${providerId}:${reference}`);
    assert.deepEqual(result.product.attributes, entry.mapped.product.attributes, `${providerId}:${reference}`);
    assert.equal(isValidCommercialCategory(entry.source, categoryId, condition, catalog), true);
    assert.equal(isValidCommercialCategory(entry.source, categoryId, condition === "Nuevo" ? "Segunda_Mano" : "Nuevo", catalog), false);
    assert.equal(isValidCommercialCategory(entry.source, categoryId, null, catalog), false);
  }
});

test("no propaga evidencias de origen a otras fuentes o identidades", () => {
  for (const [providerId, reference] of [
    ["gam", "2072"], ["gam", "3427"], ["gam", "6653"],
    ["gomariz", "1011JFB"], ["gomariz", "PV556"], ["mercaeleva", "M294-4678"]
  ] as const) {
    const entry = entryFor(providerId, reference);
    const empty = unassigned(entry.mapped);
    for (const source of [
      { ...entry.source, providerId: providerId === "gam" ? "gomariz" : "gam" },
      { ...entry.source, url: `https://example.com/${reference}` },
      { ...entry.source, title: "OTRO EQUIPO" }
    ]) {
      assert.equal(projectCommercialCategory(source, empty, catalog).product.categorySellID, null,
        `${providerId}:${reference}:${source.url}`);
    }
  }
});

test("la política comercial no modifica asignaciones previas ni filtra atributos al rechazar evidencia", () => {
  assert.equal(entries.length, 1344);
  for (const entry of entries) {
    const mapped = entry.mapped;
    const projected = projectCommercialCategory(entry.source, mapped, catalog);
    if (mapped.product.categorySellID !== null) assert.equal(projected, mapped);
    const empty = unassigned(mapped);
    const withoutEvidence = projectCommercialCategory({ ...entry.source, url: "https://example.com/sin-origen" }, empty, catalog);
    assert.deepEqual(withoutEvidence.product.attributes, empty.product.attributes);
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { loadCommercialPublicationInputs } from "../../export/commercial-inputs.js";
import { projectCommercialPresentation } from "../presentation-projection.js";
import { isValidCommercialCategory } from "../category-projection.js";

const catalog = await loadImportCatalog();
const publications = await loadCommercialPublicationInputs(process.cwd(), catalog);

const usedFamilies = [
  { providerId: "gam", categoryId: 67, references: ["6653"] },
  { providerId: "gomariz", categoryId: 67, references: ["RE454"] },
  { providerId: "gam", categoryId: 74, references: ["5254", "5710", "5918", "6217", "6623", "6688", "6689", "6690", "6806"] },
  { providerId: "gomariz", categoryId: 74, references: ["1011JFB", "5051BDX"] },
  { providerId: "mercaeleva", categoryId: 74, references: ["M928-9933"] },
  { providerId: "gam", categoryId: 80, references: ["6358", "6367"] },
  { providerId: "gomariz", categoryId: 80, references: ["PV556"] },
  { providerId: "gam", categoryId: 115, references: ["6814", "6815"] },
  { providerId: "mercaeleva", categoryId: 115, references: ["M294-4678"] }
] as const;

const newGam = [
  "1884", "1885", "1886", "1887", "1888", "3309", "5079",
  "2134", "2135", "2572", "2573", "2737", "2738",
  "297", "298", "299", "3425", "3426", "3427", "3428", "3429", "3430",
  "3431", "3432", "3433", "3434", "3435", "3436",
  "12", "2163", "2164", "2165", "2169", "5", "6", "8", "2072", "2073", "2159"
] as const;

const entry = (providerId: string, reference: string) => {
  const publication = publications.find((item) => item.providerId === providerId);
  assert.ok(publication, providerId);
  const found = publication.entries.find((item) => item.source.reference === reference);
  assert.ok(found, `${providerId}:${reference}`);
  return found;
};

test("contrasta las veinte unidades de ocasión sin clasificarlas como equipos nuevos", () => {
  const references = usedFamilies.flatMap(({ providerId, references: ids }) => ids.map((reference) => `${providerId}:${reference}`));
  assert.equal(references.length, 20);
  assert.equal(new Set(references).size, 20);
  for (const { providerId, categoryId, references: ids } of usedFamilies) {
    const category = catalog.categories.find((item) => item.id === categoryId);
    assert.ok(category);
    for (const reference of ids) {
      const { source, mapped } = entry(providerId, reference);
      const product = mapped.product;
      assert.equal(mapped.status, "ready", `${providerId}:${reference}`);
      assert.equal(product.condition, "Segunda_Mano", `${providerId}:${reference}`);
      assert.equal(product.categorySellID, categoryId, `${providerId}:${reference}`);
      assert.equal(product.category, category.name, `${providerId}:${reference}`);
      assert.equal(product.reference, reference, `${providerId}:${reference}`);
      assert.equal(product.providerId, providerId, `${providerId}:${reference}`);
      assert.equal(product.sourceUrl, source.url, `${providerId}:${reference}`);
      assert.deepEqual(product.attributes, [], `${providerId}:${reference}`);
      assert.equal(isValidCommercialCategory(source, categoryId, "Segunda_Mano", catalog), true, reference);
      assert.equal(isValidCommercialCategory(source, categoryId, "Nuevo", catalog), false, reference);
      assert.ok(product.title && product.description && product.description_general, reference);
      assert.ok(product.image && product.images.includes(product.image), reference);
      const presentation = projectCommercialPresentation(source, product, category.name);
      assert.ok(presentation.metadata.tags.includes("segunda-mano"), reference);
      assert.deepEqual(presentation.images, product.images, reference);
      assert.deepEqual(presentation.spec, product.spec, reference);
    }
  }
});

test("las 59 referencias comerciales están presentes y mantienen identidades independientes", () => {
  const used = usedFamilies.flatMap(({ providerId, references }) => references.map((reference) => `${providerId}:${reference}`));
  const all = [...used, ...newGam.map((reference) => `gam:${reference}`)];
  assert.equal(all.length, 59);
  assert.equal(new Set(all).size, 59);
  for (const key of all) {
    const colon = key.indexOf(":");
    const providerId = key.slice(0, colon);
    const reference = key.slice(colon + 1);
    const { source, published, mapped } = entry(providerId, reference);
    assert.equal(source.providerId, providerId, key);
    assert.equal(source.reference, reference, key);
    assert.equal(published.reference, reference, key);
    assert.equal(published.sourceUrl, source.url, key);
    assert.equal(mapped.product.reference, reference, key);
    assert.equal(mapped.product.sourceUrl, source.url, key);
    assert.ok(mapped.product.title && mapped.product.description_general, key);
    assert.ok(mapped.product.images.length > 0, key);
    assert.ok(mapped.product.image && mapped.product.images.includes(mapped.product.image), key);
    assert.equal(mapped.product.condition, used.includes(key) ? "Segunda_Mano" : "Nuevo", key);
    assert.equal(mapped.product.attributes.length, key === "gam:2072" || key === "gam:2073" ? 6 : 0, key);
  }
});

test("no mezcla carritos, semirremolques, vehículos ligeros, elevadores ni módulos sanitarios", () => {
  const first = entry("gam", "6358").mapped.product;
  const second = entry("gam", "6367").mapped.product;
  assert.notEqual(entry("gam", "6358").source.specs?.["Nº de serie"], entry("gam", "6367").source.specs?.["Nº de serie"]);
  assert.equal(first.spec["Carga vertical estática admisible del KRV20"], "100 kg");
  assert.equal(second.spec["Carga vertical estática admisible del KRV20"], "100 kg");
  for (const reference of ["5710", "6623", "5918", "6806"]) {
    assert.equal(entry("gam", reference).mapped.product.categorySellID, 74, reference);
  }
  assert.equal(entry("gomariz", "PV556").mapped.product.categorySellID, 80);
  assert.equal(entry("gam", "6814").mapped.product.categorySellID, 115);
  assert.equal(entry("gam", "6815").mapped.product.categorySellID, 115);
  const caseta = entry("mercaeleva", "M294-4678").mapped.product;
  assert.equal(caseta.spec["Altura exterior anunciada"], undefined);
  assert.deepEqual(caseta.attributes, []);
});

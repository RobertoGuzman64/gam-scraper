import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../../../../preparation/prepare-product.js";
import { excludeGamRelatedProductImages } from "../gallery.js";

const photo = (id: number, name: string): string =>
  `https://online.gamrentals.com/${id}-product_main_2x/${name}.jpg`;

const own = [photo(100, "2012-genie-z45-25-j"), photo(101, "2012-genie-z45-25-j"), photo(102, "2012-genie-z45-25-j")];
const related = [photo(200, "2018-snorkel-a46jrt"), photo(201, "2018-genie-z45-25j"), photo(202, "2014-manitou-160-atj")];

test("GAM: descarta solo recomendaciones separadas tras una galería propia identificable", () => {
  const gallery = [...own, ...related];
  assert.deepEqual(excludeGamRelatedProductImages(gallery), own);
  assert.deepEqual(gallery, [...own, ...related]);
  assert.deepEqual(excludeGamRelatedProductImages([...own, ...related, photo(203, "2013-jlg-450aj")]), own);
});

test("GAM: conserva variantes, fotografías adicionales y galerías sin evidencia suficiente", () => {
  const cases: readonly (readonly string[])[] = [
    [...own.slice(0, 2), ...related],
    [...own, ...related.slice(0, 2)],
    [...own, related[0]!, own[2]!, related[1]!, related[2]!],
    [...own, ...related, photo(204, "2007-jlg-510aj"), photo(205, "2007-jlg-600aj")],
    [...own, ...related.slice(0, 2), "https://example.test/unverified.jpg"],
    ["https://www.gomarizrent.com/image.jpg", ...own, ...related]
  ];
  for (const gallery of cases) {
    assert.deepEqual(excludeGamRelatedProductImages(gallery), gallery);
  }
});

test("GAM: la preparación conserva imágenes propias, identidad, estados y originales", async () => {
  const { products } = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
  const indexed = new Map(products.map((product) => [product.reference, product]));
  let curated = 0;
  for (const source of products) {
    const original = JSON.stringify(source);
    const prepared = prepareSourceProduct(source);
    const selected = excludeGamRelatedProductImages(source.images ?? []);
    if (selected.length !== (source.images ?? []).length && source.image === source.images?.[0]) {
      curated += 1;
      assert.deepEqual(prepared.product.images, selected, source.reference ?? "sin referencia");
      assert.equal(prepared.product.image, source.image, source.reference ?? "sin referencia");
      assert.ok(prepared.product.images.length >= 3, source.reference ?? "sin referencia");
    }
    assert.equal(JSON.stringify(source), original, source.reference ?? "sin referencia");
  }
  assert.ok(curated >= 20);
  for (const reference of ["6607", "5855", "6139", "6846", "6150", "2621"]) {
    const source = indexed.get(reference);
    assert.ok(source, reference);
    const prepared = prepareSourceProduct(source);
    assert.ok(prepared.product.images.length < (source.images?.length ?? 0), reference);
  }
});

test("Gomariz y Mercaeleva: sus galerías continúan intactas", async () => {
  for (const provider of ["gomariz", "mercaeleva"] as const) {
    const { products } = await readCanonicalCatalog(`catalogs/providers/${provider}/original/scrape-${provider}-catalog.json`);
    for (const source of products) {
      assert.deepEqual(prepareSourceProduct(source).product.images, source.images, `${provider}:${source.reference}`);
    }
  }
});

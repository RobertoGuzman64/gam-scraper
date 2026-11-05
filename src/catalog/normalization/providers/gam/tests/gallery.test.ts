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

test("GAM: separa cuatro recomendaciones cuando la máquina tiene una o dos fotos propias", () => {
  const first = own[0]!;
  const recommended = [...related, photo(203, "2013-jlg-450aj")];
  assert.deepEqual(excludeGamRelatedProductImages([first, ...recommended]), [first]);
  assert.deepEqual(excludeGamRelatedProductImages([...own.slice(0, 2), ...recommended]), own.slice(0, 2));
  assert.deepEqual(excludeGamRelatedProductImages([first, ...related]), [first]);
  assert.deepEqual(excludeGamRelatedProductImages([first, ...recommended.slice(0, 2), recommended[0]!, recommended[1]!]),
    [first, ...recommended.slice(0, 2), recommended[0]!, recommended[1]!]);
});

test("GAM: excluye cuatro recomendaciones duplicadas por pares tras una o dos fotos propias", () => {
  const recommended = [
    photo(200, "cte-traccess-135"),
    photo(201, "cte-traccess-135"),
    photo(202, "plataforma-sobre-orugas-cte-traccess-170"),
    photo(203, "plataforma-sobre-orugas-cte-traccess-170")
  ];
  assert.deepEqual(excludeGamRelatedProductImages([own[0]!, ...recommended]), [own[0]!]);
  assert.deepEqual(excludeGamRelatedProductImages([...own.slice(0, 2), ...recommended]), own.slice(0, 2));
  assert.deepEqual(excludeGamRelatedProductImages([own[0]!, ...recommended.slice(0, 3)]),
    [own[0]!, ...recommended.slice(0, 3)]);
  const ambiguous = [recommended[0]!, recommended[0]!, recommended[2]!, recommended[2]!];
  assert.deepEqual(excludeGamRelatedProductImages([own[0]!, ...ambiguous]), [own[0]!, ...ambiguous]);
  assert.deepEqual(excludeGamRelatedProductImages([own[0]!, recommended[0]!, own[1]!, recommended[2]!, recommended[3]!]),
    [own[0]!, recommended[0]!, own[1]!, recommended[2]!, recommended[3]!]);
});

test("GAM: separa tres recomendaciones distintas tras una o dos imágenes propias", () => {
  const first = own[0]!;
  const next = own[1]!;
  const gallery = [first, ...related];
  assert.deepEqual(excludeGamRelatedProductImages(gallery), [first]);
  assert.deepEqual(gallery, [first, ...related]);
  assert.deepEqual(excludeGamRelatedProductImages([first, next, ...related]), [first, next]);
  const duplicatedName = [related[0]!, photo(204, "2018-snorkel-a46jrt"), related[2]!];
  assert.deepEqual(excludeGamRelatedProductImages([first, ...duplicatedName]), [first, ...duplicatedName]);
  assert.deepEqual(excludeGamRelatedProductImages([first, related[0]!, related[0]!, related[2]!]),
    [first, related[0]!, related[0]!, related[2]!]);
  assert.deepEqual(excludeGamRelatedProductImages([first, related[0]!, next, related[2]!]),
    [first, related[0]!, next, related[2]!]);
  assert.deepEqual(excludeGamRelatedProductImages([first, ...related.slice(0, 2)]),
    [first, ...related.slice(0, 2)]);
  assert.deepEqual(excludeGamRelatedProductImages([first, ...related, photo(204, "2007-jlg-510aj"), photo(205, "2007-jlg-600aj")]),
    [first, ...related, photo(204, "2007-jlg-510aj"), photo(205, "2007-jlg-600aj")]);
  assert.deepEqual(excludeGamRelatedProductImages([first, related[0]!, related[1]!, "https://example.test/external.jpg"]),
    [first, related[0]!, related[1]!, "https://example.test/external.jpg"]);
});

test("GAM: conserva variantes, fotografías adicionales y galerías sin evidencia suficiente", () => {
  const cases: readonly (readonly string[])[] = [
    [...own.slice(0, 2), related[0]!, related[1]!, related[0]!],
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
      assert.ok(prepared.product.images.length >= 1, source.reference ?? "sin referencia");
    }
    assert.equal(JSON.stringify(source), original, source.reference ?? "sin referencia");
  }
  assert.ok(curated >= 300);
  for (const [reference, ownCount] of [["4731", 1], ["4730", 1], ["4768", 2], ["4754", 1], ["4782", 1], ["4683", 1]] as const) {
    const source = indexed.get(reference);
    assert.ok(source, reference);
    const prepared = prepareSourceProduct(source);
    assert.deepEqual(prepared.product.images, source.images?.slice(0, ownCount), reference);
    assert.equal(prepared.product.image, source.image, reference);
  }
  for (const reference of ["4657", "6169", "6170", "6171", "6172", "6547", "6874", "6873", "6953", "6954"]) {
    const source = indexed.get(reference);
    assert.ok(source, reference);
    const prepared = prepareSourceProduct(source);
    assert.deepEqual(prepared.product.images, source.images?.slice(0, 1), reference);
    assert.equal(prepared.product.image, source.image, reference);
  }
  for (const reference of ["4661"]) {
    const source = indexed.get(reference);
    assert.ok(source, reference);
    const prepared = prepareSourceProduct(source);
    assert.deepEqual(prepared.product.images, source.images?.slice(0, 2), reference);
  }
  for (const [reference, ownCount] of [["4794", 1], ["4795", 2], ["4807", 1], ["4388", 1], ["1218", 1], ["2259", 1], ["3445", 1], ["295", 1], ["2737", 1]] as const) {
    const source = indexed.get(reference);
    assert.ok(source, reference);
    const prepared = prepareSourceProduct(source);
    assert.deepEqual(prepared.product.images, source.images?.slice(0, ownCount), reference);
    assert.equal(prepared.product.image, source.image, reference);
  }
  for (const [reference, relatedReference] of [["4794", "4795"], ["4807", "4808"], ["4388", "4623"], ["3442", "3443"], ["295", "294"]] as const) {
    const source = indexed.get(reference);
    const relatedProduct = indexed.get(relatedReference);
    assert.ok(source, reference);
    assert.ok(relatedProduct?.image, relatedReference);
    assert.ok(source.images?.includes(relatedProduct.image), reference);
    assert.ok(!prepareSourceProduct(source).product.images.includes(relatedProduct.image), reference);
  }
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

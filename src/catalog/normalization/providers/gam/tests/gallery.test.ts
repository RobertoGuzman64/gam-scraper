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

test("GAM: elimina cuatro recomendaciones distintas aunque una comparta el nombre del modelo", () => {
  const matchingModel = photo(300, "2012-genie-z45-25-j");
  const recommendations = [related[0]!, matchingModel, related[1]!, related[2]!];
  assert.deepEqual(excludeGamRelatedProductImages([...own, ...recommendations]), own);
  assert.deepEqual(excludeGamRelatedProductImages([...own, related[0]!, own[0]!, related[1]!, related[2]!]),
    [...own, related[0]!, own[0]!, related[1]!, related[2]!]);
  assert.deepEqual(excludeGamRelatedProductImages([...own, related[0]!, matchingModel, photo(301, "2012-genie-z45-25-j"), related[1]!]),
    [...own, related[0]!, matchingModel, photo(301, "2012-genie-z45-25-j"), related[1]!]);
  assert.deepEqual(excludeGamRelatedProductImages([...own.slice(0, 2), ...recommendations]),
    [...own.slice(0, 2), ...recommendations]);
  assert.deepEqual(excludeGamRelatedProductImages([...own, ...recommendations, related[2]!]),
    [...own, ...recommendations, related[2]!]);
});


test("GAM: descarta cuatro recomendaciones con dos portadas del mismo modelo solo tras galerías extensas", () => {
  const extensive = Array.from({ length: 8 }, (_, index) => photo(100 + index, "2012-genie-z45-25-j"));
  const sameModel = [photo(300, "2012-genie-z45-25-j"), photo(301, "2012-genie-z45-25-j")];
  const recommendations = [related[0]!, ...sameModel, related[2]!];
  assert.deepEqual(excludeGamRelatedProductImages([...extensive, ...recommendations]), extensive);
  assert.deepEqual(excludeGamRelatedProductImages([...extensive.slice(0, 7), ...recommendations]),
    [...extensive.slice(0, 7), ...recommendations]);
  assert.deepEqual(excludeGamRelatedProductImages([...extensive, related[0]!, extensive[1]!, sameModel[0]!, related[2]!]),
    [...extensive, related[0]!, extensive[1]!, sameModel[0]!, related[2]!]);
  assert.deepEqual(excludeGamRelatedProductImages([...extensive, related[0]!, sameModel[0]!, sameModel[0]!, related[2]!]),
    [...extensive, related[0]!, sameModel[0]!, sameModel[0]!, related[2]!]);
  assert.deepEqual(excludeGamRelatedProductImages([...extensive, related[0]!, sameModel[0]!, sameModel[1]!, related[0]!]),
    [...extensive, related[0]!, sameModel[0]!, sameModel[1]!, related[0]!]);
  assert.deepEqual(excludeGamRelatedProductImages([...extensive, related[0]!, sameModel[0]!, sameModel[1]!, "https://example.test/unverified.jpg"]),
    [...extensive, related[0]!, sameModel[0]!, sameModel[1]!, "https://example.test/unverified.jpg"]);
});

test("GAM: las recomendaciones con dos portadas del modelo principal son ajenas en tres fichas", async () => {
  const { products } = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
  const byReference = new Map(products.map((product) => [product.reference, product]));
  const byCover = new Map<string, Set<string>>();
  for (const product of products) {
    if (!product.image || !product.reference) continue;
    const owners = byCover.get(product.image) ?? new Set<string>();
    owners.add(product.reference);
    byCover.set(product.image, owners);
  }
  for (const reference of ["6077", "6126", "6202"]) {
    const source = byReference.get(reference);
    assert.ok(source, reference);
    const originals = source.images ?? [];
    const foreign = originals.slice(-4);
    assert.ok(originals.length >= 12, reference);
    assert.ok(foreign.every((url) => [...(byCover.get(url) ?? [])].some((owner) => owner !== reference)), reference);
    assert.deepEqual(excludeGamRelatedProductImages(originals), originals.slice(0, -4), reference);
    assert.deepEqual(prepareSourceProduct(source).product.images, originals.slice(0, -4), reference);
    assert.equal(prepareSourceProduct(source).product.image, source.image, reference);
  }
});

test("GAM: separa una recomendación aislada solo tras al menos ocho imágenes propias", () => {
  const extensive = Array.from({ length: 8 }, (_, index) => photo(100 + index, "2012-genie-z45-25-j"));
  const recommendation = photo(200, "2018-haulotte-star-10");
  assert.deepEqual(excludeGamRelatedProductImages([...extensive, recommendation]), extensive);
  assert.deepEqual(excludeGamRelatedProductImages([...extensive.slice(0, 7), recommendation]),
    [...extensive.slice(0, 7), recommendation]);
  assert.deepEqual(excludeGamRelatedProductImages([...extensive, photo(201, "2012-genie-z45-25-j")]),
    [...extensive, photo(201, "2012-genie-z45-25-j")]);
  assert.deepEqual(excludeGamRelatedProductImages([...extensive, "https://example.test/other.jpg"]),
    [...extensive, "https://example.test/other.jpg"]);
  assert.deepEqual(excludeGamRelatedProductImages([...extensive, recommendation, photo(202, "2012-genie-z45-25-j")]),
    [...extensive, recommendation, photo(202, "2012-genie-z45-25-j")]);
});

test("GAM: las cinco portadas finales aisladas pertenecen a otras referencias", async () => {
  const { products } = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
  const byReference = new Map(products.map((product) => [product.reference, product]));
  const byCover = new Map<string, Set<string>>();
  for (const product of products) {
    if (!product.image || !product.reference) continue;
    const owners = byCover.get(product.image) ?? new Set<string>();
    owners.add(product.reference);
    byCover.set(product.image, owners);
  }
  for (const reference of ["6776", "6492", "6815", "6218", "5918"]) {
    const source = byReference.get(reference);
    assert.ok(source, reference);
    const original = source.images ?? [];
    assert.ok(original.length >= 9, reference);
    const last = original.at(-1);
    assert.ok(last, reference);
    assert.ok([...(byCover.get(last) ?? [])].some((owner) => owner !== reference), reference);
    assert.deepEqual(excludeGamRelatedProductImages(original), original.slice(0, -1), reference);
    assert.deepEqual(prepareSourceProduct(source).product.images, original.slice(0, -1), reference);
    assert.equal(prepareSourceProduct(source).product.image, source.image, reference);
  }
});

test("GAM: separa dos recomendaciones distintas tras una galería propia extensa", () => {
  const extensive = Array.from({ length: 8 }, (_, index) => photo(100 + index, "2012-genie-z45-25-j"));
  const next = [photo(200, "2007-jlg-860sj"), photo(201, "2008-jlg-860sj")];
  const gallery = [...extensive, ...next];
  assert.deepEqual(excludeGamRelatedProductImages(gallery), extensive);
  assert.deepEqual(gallery, [...extensive, ...next]);
  assert.deepEqual(excludeGamRelatedProductImages([...extensive.slice(0, 6), ...next]), extensive.slice(0, 6));
  assert.deepEqual(excludeGamRelatedProductImages([...extensive.slice(0, 5), ...next]), [...extensive.slice(0, 5), ...next]);
  assert.deepEqual(excludeGamRelatedProductImages([...extensive, next[0]!, next[0]!]), [...extensive, next[0]!, next[0]!]);
  assert.deepEqual(excludeGamRelatedProductImages([...extensive, next[0]!, photo(202, "2012-genie-z45-25-j")]),
    [...extensive, next[0]!, photo(202, "2012-genie-z45-25-j")]);
  assert.deepEqual(excludeGamRelatedProductImages([...extensive, next[0]!, "https://example.test/other.jpg"]),
    [...extensive, next[0]!, "https://example.test/other.jpg"]);
});

test("GAM: las dos recomendaciones finales de otras marcas no requieren ocho fotografías propias", () => {
  const six = Array.from({ length: 6 }, (_, index) => photo(100 + index, "lvneng-lx08"));
  const recommendations = [photo(700, "silence-s02-2020-hs"), photo(701, "zero-motorcycles-ds-144")];
  assert.deepEqual(excludeGamRelatedProductImages([...six, ...recommendations]), six);
  assert.deepEqual(excludeGamRelatedProductImages([...six.slice(0, 5), ...recommendations]),
    [...six.slice(0, 5), ...recommendations]);
  assert.deepEqual(excludeGamRelatedProductImages([...six, recommendations[0]!, recommendations[0]!]),
    [...six, recommendations[0]!, recommendations[0]!]);
  assert.deepEqual(excludeGamRelatedProductImages([...six, recommendations[0]!, photo(702, "lvneng-lx08")]),
    [...six, recommendations[0]!, photo(702, "lvneng-lx08")]);
  assert.deepEqual(excludeGamRelatedProductImages([...six, recommendations[0]!, "https://example.test/image.jpg"]),
    [...six, recommendations[0]!, "https://example.test/image.jpg"]);
});

test("GAM: las parejas de LX08 pertenecen a otras referencias del catálogo", async () => {
  const { products } = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
  const byReference = new Map(products.map((product) => [product.reference, product]));
  for (const reference of ["6478", "6479", "6813"]) {
    const source = byReference.get(reference);
    assert.ok(source, reference);
    const originals = source.images ?? [];
    assert.equal(originals.length, 8, reference);
    assert.deepEqual(originals.slice(-2), [byReference.get("6811")?.image, byReference.get("6807")?.image], reference);
    assert.deepEqual(excludeGamRelatedProductImages(originals), originals.slice(0, -2), reference);
    assert.deepEqual(prepareSourceProduct(source).product.images, originals.slice(0, -2), reference);
    assert.equal(prepareSourceProduct(source).product.image, source.image, reference);
  }
});

test("GAM: las parejas separadas son portadas ajenas en las doce referencias acreditadas", async () => {
  const { products } = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
  const byReference = new Map(products.map((product) => [product.reference, product]));
  const byCover = new Map<string, Set<string>>();
  for (const product of products) {
    if (!product.image || !product.reference) continue;
    const owners = byCover.get(product.image) ?? new Set<string>();
    owners.add(product.reference);
    byCover.set(product.image, owners);
  }
  const affected = ["6617", "6233", "6626", "6703", "6861", "6643", "6950", "6559", "6560", "6608", "6606", "6775"];
  for (const reference of affected) {
    const source = byReference.get(reference);
    assert.ok(source, reference);
    const images = source.images ?? [];
    const expected = images.slice(0, -2);
    assert.ok(expected.length >= 8, reference);
    assert.deepEqual(excludeGamRelatedProductImages(images), expected, reference);
    assert.ok(images.slice(-2).every((image) =>
      [...(byCover.get(image) ?? [])].some((owner) => owner !== reference)), reference);
    assert.deepEqual(prepareSourceProduct(source).product.images, expected, reference);
    assert.equal(prepareSourceProduct(source).product.image, source.image, reference);
  }
});

test("GAM: contrasta recomendaciones con la imagen principal de otras unidades del catálogo", async () => {
  const { products } = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
  const byReference = new Map(products.map((product) => [product.reference, product]));
  const primaryOwners = new Map<string, Set<string>>();
  for (const product of products) {
    if (!product.image || !product.reference) continue;
    const owners = primaryOwners.get(product.image) ?? new Set<string>();
    owners.add(product.reference);
    primaryOwners.set(product.image, owners);
  }
  const affected = ["6901", "6912", "6911", "6930", "6967", "6980", "5213", "6702", "6588", "6590"];
  for (const reference of affected) {
    const source = byReference.get(reference);
    assert.ok(source, reference);
    const originals = source.images ?? [];
    const selected = excludeGamRelatedProductImages(originals);
    assert.deepEqual(selected, originals.slice(0, -4), reference);
    assert.equal(selected[0], source.image, reference);
    const crossReferences = originals.slice(-4).filter((image) =>
      [...(primaryOwners.get(image) ?? [])].some((owner) => owner !== reference));
    assert.ok(crossReferences.length >= 3, reference);
    assert.deepEqual(prepareSourceProduct(source).product.images, selected, reference);
  }
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

test("GAM: separa cuatro portadas relacionadas tras cuatro imágenes originales consecutivas", () => {
  const ownSequence = Array.from({ length: 4 }, (_, index) => photo(100 + index, "lvneng-lx05"));
  const references = [photo(200, "lvneng-lx05"), photo(300, "lvneng-lx05"), photo(400, "lvneng-lx05"), photo(500, "urban-d2")];
  assert.deepEqual(excludeGamRelatedProductImages([...ownSequence, ...references]), ownSequence);
  assert.deepEqual(excludeGamRelatedProductImages([...ownSequence, ...references.slice(0, 3), photo(600, "lvneng-lx05")]), ownSequence);
  assert.deepEqual(excludeGamRelatedProductImages([...ownSequence, ...references.slice(0, 2), photo(301, "lvneng-lx05"), references[3]!]),
    [...ownSequence, ...references.slice(0, 2), photo(301, "lvneng-lx05"), references[3]!]);
  assert.deepEqual(excludeGamRelatedProductImages([...ownSequence, photo(104, "lvneng-lx05"), ...references.slice(1)]),
    [...ownSequence, photo(104, "lvneng-lx05"), ...references.slice(1)]);
  assert.deepEqual(excludeGamRelatedProductImages([...ownSequence.slice(0, 3), ...references]),
    [...ownSequence.slice(0, 3), ...references]);
  assert.deepEqual(excludeGamRelatedProductImages([...ownSequence, ...references, photo(600, "lvneng-lx05")]),
    [...ownSequence, ...references, photo(600, "lvneng-lx05")]);
  assert.deepEqual(excludeGamRelatedProductImages([...ownSequence, references[0]!, references[1]!, references[2]!, "https://example.test/unverified.jpg"]),
    [...ownSequence, references[0]!, references[1]!, references[2]!, "https://example.test/unverified.jpg"]);
});

test("GAM: acredita tres secuencias separadas de cuatro portadas de otras referencias", async () => {
  const { products } = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
  const byReference = new Map(products.map((product) => [product.reference, product]));
  const byCover = new Map<string, Set<string>>();
  for (const product of products) {
    if (!product.image || !product.reference) continue;
    const owners = byCover.get(product.image) ?? new Set<string>();
    owners.add(product.reference);
    byCover.set(product.image, owners);
  }
  for (const reference of ["6477", "6805", "6802"]) {
    const source = byReference.get(reference);
    assert.ok(source, reference);
    const originals = source.images ?? [];
    assert.equal(originals.length, 8, reference);
    assert.ok(originals.slice(4).every((url) => [...(byCover.get(url) ?? [])].some((owner) => owner !== reference)), reference);
    assert.deepEqual(excludeGamRelatedProductImages(originals), originals.slice(0, 4), reference);
    assert.deepEqual(prepareSourceProduct(source).product.images, originals.slice(0, 4), reference);
    assert.equal(prepareSourceProduct(source).product.image, source.image, reference);
  }
});

test("GAM: separa portadas agrupadas aunque una tenga identificador consecutivo a las fotos propias", () => {
  const originals = Array.from({ length: 4 }, (_, index) => photo(100 + index, "lvneng-lx05"));
  const recommendations = [photo(200, "lvneng-lx05"), photo(300, "lvneng-lx05"),
    photo(104, "lvneng-lx05"), photo(400, "urban-d2")];
  assert.deepEqual(excludeGamRelatedProductImages([...originals, ...recommendations]), originals);
  assert.deepEqual(excludeGamRelatedProductImages([...originals, recommendations[0]!, recommendations[1]!,
    photo(96, "lvneng-lx05"), recommendations[3]!]), originals);
  const ambiguous = [
    [photo(104, "lvneng-lx05"), recommendations[0]!, recommendations[1]!, recommendations[3]!],
    [recommendations[0]!, photo(104, "lvneng-lx05"), recommendations[1]!, recommendations[3]!],
    [recommendations[0]!, recommendations[1]!, photo(102, "lvneng-lx05"), recommendations[3]!],
    [recommendations[0]!, photo(201, "lvneng-lx05"), photo(104, "lvneng-lx05"), recommendations[3]!],
    [recommendations[0]!, recommendations[1]!, photo(104, "lvneng-lx05"), photo(400, "lvneng-lx05")],
    [recommendations[0]!, recommendations[1]!, photo(104, "lvneng-lx05"), "https://example.test/other.jpg"]
  ];
  for (const tail of ambiguous) {
    assert.deepEqual(excludeGamRelatedProductImages([...originals, ...tail]), [...originals, ...tail]);
  }
  assert.deepEqual(excludeGamRelatedProductImages([...originals.slice(0, 3), ...recommendations]),
    [...originals.slice(0, 3), ...recommendations]);
});

test("GAM: las portadas recomendadas de 6635 y 6636 son de otras referencias", async () => {
  const { products } = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
  const byReference = new Map(products.map((product) => [product.reference, product]));
  const byCover = new Map<string, Set<string>>();
  for (const product of products) {
    if (!product.image || !product.reference) continue;
    const owners = byCover.get(product.image) ?? new Set<string>();
    owners.add(product.reference);
    byCover.set(product.image, owners);
  }
  for (const reference of ["6635", "6636"]) {
    const source = byReference.get(reference);
    assert.ok(source, reference);
    const originals = source.images ?? [];
    assert.equal(originals.length, 8, reference);
    assert.ok(originals.slice(4).every((url) =>
      [...(byCover.get(url) ?? [])].some((owner) => owner !== reference)), reference);
    assert.deepEqual(excludeGamRelatedProductImages(originals), originals.slice(0, 4), reference);
    assert.deepEqual(prepareSourceProduct(source).product.images, originals.slice(0, 4), reference);
    assert.equal(prepareSourceProduct(source).product.image, source.image, reference);
  }
  const uncertain = byReference.get("6746");
  const related = byReference.get("2368");
  assert.ok(uncertain?.images && related?.image);
  assert.equal(uncertain.images[1], related.image);
  assert.deepEqual(excludeGamRelatedProductImages(uncertain.images), uncertain.images);
});

test("GAM: separa una portada aislada solo tras cinco fotografías con identificadores consecutivos", () => {
  const originals = Array.from({ length: 5 }, (_, index) => photo(100 + index, "musoshi-pop-up-mini"));
  const recommendation = photo(2000, "paxster-gen-22");
  assert.deepEqual(excludeGamRelatedProductImages([...originals, recommendation]), originals);
  assert.deepEqual(excludeGamRelatedProductImages([...originals.slice(0, 4), recommendation]),
    [...originals.slice(0, 4), recommendation]);
  assert.deepEqual(excludeGamRelatedProductImages([...originals.slice(0, 4), photo(110, "musoshi-pop-up-mini"), recommendation]),
    [...originals.slice(0, 4), photo(110, "musoshi-pop-up-mini"), recommendation]);
  assert.deepEqual(excludeGamRelatedProductImages([...originals, photo(105, "paxster-gen-22")]),
    [...originals, photo(105, "paxster-gen-22")]);
  assert.deepEqual(excludeGamRelatedProductImages([...originals, photo(300, "musoshi-pop-up-mini")]),
    [...originals, photo(300, "musoshi-pop-up-mini")]);
  assert.deepEqual(excludeGamRelatedProductImages([...originals, "https://example.test/other.jpg"]),
    [...originals, "https://example.test/other.jpg"]);
  assert.deepEqual(excludeGamRelatedProductImages([...originals, recommendation, photo(310, "other")]),
    [...originals, recommendation, photo(310, "other")]);
});

test("GAM: la portada final de 6806 pertenece a otra referencia y no altera los casos ambiguos", async () => {
  const { products } = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
  const byReference = new Map(products.map((product) => [product.reference, product]));
  const source = byReference.get("6806");
  const related = byReference.get("5918");
  assert.ok(source?.image && related?.image);
  const originals = source.images ?? [];
  assert.equal(originals.length, 6);
  assert.equal(originals.at(-1), related.image);
  assert.deepEqual(excludeGamRelatedProductImages(originals), originals.slice(0, 5));
  assert.deepEqual(prepareSourceProduct(source).product.images, originals.slice(0, 5));
  assert.equal(prepareSourceProduct(source).product.image, source.image);
  const pending = byReference.get("6746");
  assert.ok(pending);
  assert.deepEqual(excludeGamRelatedProductImages(pending.images ?? []), pending.images ?? []);
});

test("Gomariz y Mercaeleva: sus galerías continúan intactas", async () => {
  for (const provider of ["gomariz", "mercaeleva"] as const) {
    const { products } = await readCanonicalCatalog(`catalogs/providers/${provider}/original/scrape-${provider}-catalog.json`);
    for (const source of products) {
      assert.deepEqual(prepareSourceProduct(source).product.images, source.images, `${provider}:${source.reference}`);
    }
  }
});

test("GAM: las 31 galerías señaladas mantienen su portada sin cruces de fabricantes después de normalizar", async () => {
  const { products } = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
  const byReference = new Map(products.map((product) => [product.reference, product]));
  const brandsByCover = new Map<string, Set<string>>();
  for (const product of products) {
    if (!product.image || !product.brand) continue;
    const brands = brandsByCover.get(product.image) ?? new Set<string>();
    brands.add(product.brand.trim().toLocaleUpperCase("es"));
    brandsByCover.set(product.image, brands);
  }
  const references = [
    "6901", "6912", "6077", "6126", "6202", "6911", "6930", "6967", "6980", "6617", "6233",
    "6626", "6776", "6492", "6861", "6643", "6950", "6588", "6590", "6559", "6560", "6608",
    "6606", "6775", "6218", "6477", "6635", "6636", "6478", "6479", "6813"
  ];
  for (const reference of references) {
    const source = byReference.get(reference);
    assert.ok(source?.image && source.brand, reference);
    const selected = excludeGamRelatedProductImages(source.images ?? []);
    const ownBrand = source.brand.trim().toLocaleUpperCase("es");
    assert.equal(selected[0], source.image, reference);
    assert.deepEqual(selected.filter((image) => [...(brandsByCover.get(image) ?? [])].some((brand) => brand !== ownBrand)), [], reference);
    assert.deepEqual(excludeGamRelatedProductImages(selected), selected, reference);
  }
});

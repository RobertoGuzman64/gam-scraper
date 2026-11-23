import assert from "node:assert/strict";

import test from "node:test";

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

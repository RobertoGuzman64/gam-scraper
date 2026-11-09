import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { createPreparedSourceFixture } from "../../../testing/builders/prepared-source-fixture.js";
import { analyzePresentationConsistency } from "../presentation-consistency.js";

const [gam, gomariz, mercaeleva] = await Promise.all([
  readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json"),
  readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json"),
  readCanonicalCatalog("catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json")
]);

const prepareOriginal = createPreparedSourceFixture();

const gamProduct = (reference: string) => {
  const source = gam.products.find((item) => item.reference === reference);
  assert.ok(source, reference);
  return prepareOriginal(source).product;
};

const codes = (result: ReturnType<typeof analyzePresentationConsistency>): readonly string[] =>
  result.findings.map((item) => `${item.providerId}:${item.reference}:${item.code}`);

test("identifica incidencias aún ambiguas sin publicar correcciones especulativas", () => {
  const originals = [...gam.products, ...gomariz.products, ...mercaeleva.products];
  const snapshot = JSON.stringify(originals);
  const products = originals.map((item) => prepareOriginal(item).product);
  const result = analyzePresentationConsistency(products);
  assert.equal(result.products, 1347);
  assert.equal(result.defects, 21);
  assert.equal(result.reviews, 15);
  assert.equal(result.findings.length, 36);
  const baseline = [
    "gam:4650:modelo-de-variante-contradictorio",
    "gam:5730:imagen-de-otro-modelo",
    "gam:5902:capacidad-no-cualificada-en-campo",
    "gam:6998:imagen-de-otro-modelo"
  ];
  assert.deepEqual(codes(result).filter((code) => baseline.includes(code)).sort(), baseline.sort());
  assert.equal(result.findings.filter((finding) => finding.code === "capacidad-titulo-spec-discordante").length, 5);
  assert.equal(JSON.stringify(originals), snapshot);
});

test("detecta reintroducción de una portada de Yale ajena sin borrar fotografías", () => {
  const yale = gamProduct("2336");
  const otherCover = gamProduct("2368");
  assert.ok(otherCover.image);
  const polluted = { ...yale, images: [...yale.images, otherCover.image] };
  const products = [yale, otherCover, polluted];
  const input = JSON.stringify(products);
  const report = analyzePresentationConsistency(products);
  assert.deepEqual(codes(report), ["gam:2336:imagen-de-otro-modelo"]);
  assert.equal(report.defects, 0);
  assert.equal(JSON.stringify(products), input);
  assert.equal(yale.images.includes(otherCover.image), false);
});

test("detecta unidades técnicas y dimensiones semánticamente mal ubicadas", () => {
  const height = gamProduct("2110");
  const battery = gamProduct("2109");
  const width = gamProduct("2218");
  const malformed = [
    { ...height, spec: { ...height.spec, "Altura Plataforma": "6085mm metros" } },
    { ...battery, spec: { ...battery.spec, "Capacidad de la batería": "24V / 240h(V/Ah)" } },
    { ...width, spec: { ...width.spec, "Ancho promedio": "24V / 735-875Ah(V/Ah)" } }
  ];
  const result = analyzePresentationConsistency(malformed);
  assert.equal(result.defects, 3);
  assert.deepEqual(codes(result), [
    "gam:2110:unidad-tecnica-malformada",
    "gam:2109:unidad-tecnica-malformada",
    "gam:2218:magnitud-en-campo-incompatible"
  ]);
});

test("detecta unidades de resúmenes y conflictos de variante sin inferir modelos", () => {
  const cte = gamProduct("4650");
  const ausaSource = mercaeleva.products.find((item) => item.reference === "M855-6850");
  assert.ok(ausaSource);
  const ausa = prepareOriginal(ausaSource).product;
  const altered = { ...ausa, description: "Altura de elevación 4.30mm" };
  const result = analyzePresentationConsistency([cte, altered]);
  assert.deepEqual(codes(result), [
    "gam:4650:modelo-de-variante-contradictorio",
    "mercaeleva:M855-6850:altura-editorial-malformada"
  ]);
  assert.equal(result.defects, 1);
  assert.equal(result.reviews, 1);
  assert.deepEqual(analyzePresentationConsistency([gamProduct("6171")]).findings, []);
});

test("preserva capacidades condicionadas y fotografías compartidas con evidencia incompleta", () => {
  const conditioned = gamProduct("5902");
  assert.equal(analyzePresentationConsistency([conditioned]).reviews, 1);
  const clarified = {
    ...conditioned,
    spec: { ...conditioned.spec, "Capacidad de carga (kg)": "460 kg con limitación" }
  };
  assert.deepEqual(analyzePresentationConsistency([clarified]).findings, []);
  const model = gamProduct("4650");
  const matched = { ...model, spec: { ...model.spec, Modelo: "B-LIFT 18HD" } };
  assert.deepEqual(analyzePresentationConsistency([matched]).findings, []);
  const unknownVariant = { ...model, title: "Plataforma CTE B-LIFT 18" };
  assert.deepEqual(analyzePresentationConsistency([unknownVariant]).findings, []);
});

test("atribuye al registro GAM origen la discrepancia E300AJ/E300AJP sin culpar a las unidades correctas", () => {
  const source = gamProduct("6934");
  const others = [gamProduct("5730"), gamProduct("6998")];
  assert.deepEqual(codes(analyzePresentationConsistency([source])), ["gam:6934:modelo-titulo-spec-discordante"]);
  assert.deepEqual(codes(analyzePresentationConsistency(others)), []);
  const report = analyzePresentationConsistency([source, ...others]);
  assert.deepEqual([...codes(report)].sort(), [
    "gam:6934:modelo-titulo-spec-discordante",
    "gam:5730:imagen-de-otro-modelo",
    "gam:6998:imagen-de-otro-modelo"
  ].sort());
  assert.equal(report.defects, 0);
  assert.equal(report.reviews, 3);
});

test("distingue portada ajena, prefijos heredados y variante fotográfica en Gomariz", () => {
  const references = ["CC1666", "CC1535", "TE1591", "TE1754", "TE1756", "TE1772"];
  const products = references.map((reference) => {
    const source = gomariz.products.find((item) => item.reference === reference);
    assert.ok(source, reference);
    return prepareOriginal(source).product;
  });
  const snapshot = JSON.stringify(products);
  assert.deepEqual([...codes(analyzePresentationConsistency(products))].sort(), [
    "gomariz:CC1666:portada-referencia-ajena",
    "gomariz:TE1754:portada-prefijo-distinto",
    "gomariz:TE1756:portada-prefijo-distinto",
    "gomariz:TE1772:portada-prefijo-distinto",
    "gomariz:TE1772:modelo-portada-variante-discordante"
  ].sort());
  assert.equal(JSON.stringify(products), snapshot);
});

test("no atribuye variante contradictoria a abreviaturas de archivo o galerías del mismo modelo", () => {
  const unaffected = [gamProduct("5848"), gamProduct("4814"), gamProduct("4817")];
  const source = mercaeleva.products.find((item) => item.reference === "M168-3277");
  assert.ok(source);
  unaffected.push(prepareOriginal(source).product);
  assert.deepEqual(analyzePresentationConsistency(unaffected).findings, []);
  const sameModel = gamProduct("2336");
  const otherUnit = { ...sameModel, reference: "2337", sourceUrl: "https://example.org/2337" };
  assert.deepEqual(analyzePresentationConsistency([
    sameModel, { ...otherUnit, images: [...otherUnit.images, sameModel.image!] }
  ]).findings, []);
});

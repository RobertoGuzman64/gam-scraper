import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../../preparation/prepare-product.js";
import { analyzePresentationConsistency } from "../presentation-consistency.js";

const [gam, gomariz, mercaeleva] = await Promise.all([
  readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json"),
  readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json"),
  readCanonicalCatalog("catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json")
]);

const gamProduct = (reference: string) => {
  const source = gam.products.find((item) => item.reference === reference);
  assert.ok(source, reference);
  return prepareSourceProduct(source).product;
};

const codes = (result: ReturnType<typeof analyzePresentationConsistency>): readonly string[] =>
  result.findings.map((item) => `${item.providerId}:${item.reference}:${item.code}`);

test("identifica incidencias aún ambiguas sin publicar correcciones especulativas", () => {
  const originals = [...gam.products, ...gomariz.products, ...mercaeleva.products];
  const snapshot = JSON.stringify(originals);
  const products = originals.map((item) => prepareSourceProduct(item).product);
  const result = analyzePresentationConsistency(products);
  assert.equal(result.products, 1347);
  assert.equal(result.defects, 0);
  assert.deepEqual([...codes(result)].sort(), [
    "gam:4650:modelo-de-variante-contradictorio",
    "gam:5730:imagen-de-otro-modelo",
    "gam:5902:capacidad-no-cualificada-en-campo",
    "gam:6998:imagen-de-otro-modelo"
  ].sort());
  assert.equal(result.reviews, 4);
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
  const ausa = prepareSourceProduct(ausaSource).product;
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

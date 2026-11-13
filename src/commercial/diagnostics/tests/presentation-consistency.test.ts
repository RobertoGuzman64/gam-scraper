import assert from "node:assert/strict";
import test from "node:test";
import { accreditedSourceSamples } from "../../../testing/domain-cases/accredited-source-samples.js";
import { createPreparedSourceFixture } from "../../../testing/builders/prepared-source-fixture.js";
import { analyzePresentationConsistency } from "../presentation-consistency.js";

const gam = accreditedSourceSamples("gam-original");
const gomariz = accreditedSourceSamples("gomariz-regression");
const mercaeleva = accreditedSourceSamples("mercaeleva-original");

const prepareOriginal = createPreparedSourceFixture();

const gamProduct = (reference: string) => {
  const source = gam.find((item) => item.reference === reference);
  assert.ok(source, reference);
  return prepareOriginal(source).product;
};

const codes = (result: ReturnType<typeof analyzePresentationConsistency>): readonly string[] =>
  result.findings.map((item) => `${item.providerId}:${item.reference}:${item.code}`);

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
  const correctedCte = gamProduct("4650");
  const cte = { ...correctedCte, title: correctedCte.title?.replace("18HV", "18HD") ?? null };
  const ausaSource = mercaeleva.find((item) => item.reference === "M855-6850");
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

test("detecta capacidades restringidas aunque tengan miles y no confunde cotas distintas", () => {
  const base = gamProduct("5902");
  const conditioned = { ...base, spec: { ...base.spec, "Capacidad de carga (kg)": "1.800 KG" },
    description: "Capacidad nominal de 1.500 kg y 1.800 kg con limitación",
    description_general: null };
  assert.deepEqual(codes(analyzePresentationConsistency([conditioned])), [
    "gam:5902:capacidad-no-cualificada-en-campo"
  ]);
  assert.deepEqual(codes(analyzePresentationConsistency([{ ...conditioned,
    spec: { ...conditioned.spec, "Capacidad de carga (kg)": "1,800 kg" } }])), [
    "gam:5902:capacidad-no-cualificada-en-campo"
  ]);
  assert.deepEqual(codes(analyzePresentationConsistency([{ ...conditioned,
    description: "Capacidad de 1.500 kg sin limitación y 1.800 kg restringidos" }])), [
    "gam:5902:capacidad-no-cualificada-en-campo"
  ]);
  assert.deepEqual(codes(analyzePresentationConsistency([{ ...conditioned,
    description: "Capacidad de 1.500 kg con limitación y 1.800 kg sin limitación" }])), []);
  assert.deepEqual(codes(analyzePresentationConsistency([{ ...conditioned,
    spec: { ...conditioned.spec, "Capacidad de carga (kg)": "1.800 kg con limitación" } }])), []);
  assert.deepEqual(codes(analyzePresentationConsistency([{ ...conditioned,
    description: "Capacidad de 1.800 kg sin limitación" }])), []);
  assert.deepEqual(codes(analyzePresentationConsistency([{ ...conditioned,
    spec: { ...conditioned.spec, "Capacidad de carga (kg)": "800 KG" } }])), []);
});

test("distingue portada ajena, prefijos heredados y variante fotográfica en Gomariz", () => {
  const references = ["CC1666", "CC1535", "TE1591", "TE1754", "TE1756", "TE1772"];
  const products = references.map((reference) => {
    const source = gomariz.find((item) => item.reference === reference);
    assert.ok(source, reference);
    return prepareOriginal(source).product;
  });
  const snapshot = JSON.stringify(products);
  assert.deepEqual([...codes(analyzePresentationConsistency(products))].sort(), [
    "gomariz:TE1772:modelo-portada-variante-discordante"
  ].sort());
  assert.equal(JSON.stringify(products), snapshot);
});

test("no atribuye variante contradictoria a abreviaturas de archivo o galerías del mismo modelo", () => {
  const unaffected = [gamProduct("5848"), gamProduct("4814"), gamProduct("4817")];
  const source = mercaeleva.find((item) => item.reference === "M168-3277");
  assert.ok(source);
  unaffected.push(prepareOriginal(source).product);
  assert.deepEqual(analyzePresentationConsistency(unaffected).findings, []);
  const sameModel = gamProduct("2336");
  const otherUnit = { ...sameModel, reference: "2337", sourceUrl: "https://example.org/2337" };
  assert.deepEqual(analyzePresentationConsistency([
    sameModel, { ...otherUnit, images: [...otherUnit.images, sameModel.image!] }
  ]).findings, []);
});


test("reconcilia la portada ajena de CC1666 sin alterar la fuente ni perder su galería propia", () => {
  const source = gomariz.find((item) => item.reference === "CC1666");
  const other = gomariz.find((item) => item.reference === "CC1535");
  assert.ok(source);
  assert.ok(other);
  assert.ok(source.image);
  assert.ok(source.images);
  const sourceSnapshot = JSON.stringify(source);
  const prepared = prepareOriginal(source).product;
  assert.equal(source.image, other.image);
  assert.equal(source.images.length, 11);
  assert.equal(prepared.images.length, 10);
  assert.deepEqual(prepared.images, source.images.slice(1));
  assert.equal(prepared.image, prepared.images[0]);
  assert.deepEqual(codes(analyzePresentationConsistency([prepared])), []);
  assert.deepEqual(codes(analyzePresentationConsistency([{ ...prepared,
    image: source.image, images: source.images }])), ["gomariz:CC1666:portada-referencia-ajena"]);
  assert.equal(JSON.stringify(source), sourceSnapshot);
});

test("reconoce prefijos de lote coherentes y mantiene abierta la variante WE frente a WF", () => {
  const products = ["TE1754", "TE1756", "TE1772"].map((reference) => {
    const source = gomariz.find((item) => item.reference === reference);
    assert.ok(source, reference);
    return prepareOriginal(source).product;
  });
  assert.deepEqual(codes(analyzePresentationConsistency(products)), [
    "gomariz:TE1772:modelo-portada-variante-discordante"
  ]);
  const first = products[0];
  assert.ok(first);
  const owner = { ...first, sourceUrl: `${first.sourceUrl}?other-stock=1`, reference: "TD1754" };
  assert.deepEqual(codes(analyzePresentationConsistency([first, owner])), [
    "gomariz:TE1754:portada-prefijo-distinto"
  ]);
  const mixed = { ...first, images: [...first.images.slice(0, -1),
    "https://www.gomarizrent.com/wp-content/uploads/2026/08/TD1755-LGMG-AS0808E-1.jpg"] };
  assert.deepEqual(codes(analyzePresentationConsistency([mixed])), [
    "gomariz:TE1754:portada-prefijo-distinto"
  ]);
  const solitary = { ...first, images: [first.image!] };
  assert.deepEqual(codes(analyzePresentationConsistency([solitary])), [
    "gomariz:TE1754:portada-prefijo-distinto"
  ]);
});

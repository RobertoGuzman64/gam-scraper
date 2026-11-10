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
  assert.equal(result.defects, 0);
  assert.equal(result.reviews, 2);
  assert.equal(result.findings.length, 2);
  const jlg = gam.products.find((item) => item.reference === "6934");
  const lgmg = gomariz.products.find((item) => item.reference === "TE1772");
  assert.ok(jlg);
  assert.ok(lgmg);
  assert.equal(jlg.model, "E300AJ");
  assert.match(jlg.title ?? "", /E300AJP/u);
  assert.equal(jlg.specs?.["Capacidad de carga (kg)"], "220 KG");
  assert.match(jlg.shortDescription ?? "", /230\s*kg/iu);
  assert.equal(lgmg.model, "AS0607WE");
  assert.match(lgmg.image ?? "", /AS0607WF/u);
  const baseline = [
    "gam:6934:modelo-titulo-spec-discordante",
    "gomariz:TE1772:modelo-portada-variante-discordante"
  ];
  assert.deepEqual(codes(result).filter((code) => baseline.includes(code)).sort(), baseline.sort());
  assert.equal(result.findings.filter((finding) => finding.code === "capacidad-titulo-spec-discordante").length, 0);
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
  const correctedCte = gamProduct("4650");
  const cte = { ...correctedCte, title: correctedCte.title?.replace("18HV", "18HD") ?? null };
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
  assert.equal(analyzePresentationConsistency([conditioned]).reviews, 0);
  const unqualified = { ...conditioned,
    spec: { ...conditioned.spec, "Capacidad de carga (kg)": "460 KG" } };
  assert.equal(analyzePresentationConsistency([unqualified]).reviews, 1);
  const clarified = {
    ...unqualified,
    spec: { ...unqualified.spec, "Capacidad de carga (kg)": "460 kg con limitación" }
  };
  assert.deepEqual(analyzePresentationConsistency([clarified]).findings, []);
  const model = gamProduct("4650");
  assert.deepEqual(analyzePresentationConsistency([model]).findings, []);
  const mismatched = { ...model, title: model.title?.replace("18HV", "18HD") ?? null };
  assert.deepEqual(codes(analyzePresentationConsistency([mismatched])), [
    "gam:4650:modelo-de-variante-contradictorio"
  ]);
  const unknownVariant = { ...model, title: "Plataforma CTE B-LIFT 18" };
  assert.deepEqual(analyzePresentationConsistency([unknownVariant]).findings, []);
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

test("atribuye al registro GAM origen la discrepancia E300AJ/E300AJP sin culpar a las unidades correctas", () => {
  const source = gamProduct("6934");
  const others = [gamProduct("5730"), gamProduct("6998")];
  assert.deepEqual(codes(analyzePresentationConsistency([source])), ["gam:6934:modelo-titulo-spec-discordante"]);
  assert.deepEqual(codes(analyzePresentationConsistency(others)), []);
  const report = analyzePresentationConsistency([source, ...others]);
  assert.deepEqual([...codes(report)].sort(), [
    "gam:6934:modelo-titulo-spec-discordante"
  ].sort());
  assert.equal(report.defects, 0);
  assert.equal(report.reviews, 1);
  const otherVariant = { ...others[0]!, spec: { ...others[0]!.spec, Modelo: "E400AJP" } };
  assert.deepEqual([...codes(analyzePresentationConsistency([source, otherVariant]))].sort(), [
    "gam:6934:modelo-titulo-spec-discordante",
    "gam:5730:imagen-de-otro-modelo"
  ].sort());
  const resolved = { ...source, spec: { ...source.spec, Modelo: "E300AJP" } };
  assert.deepEqual(codes(analyzePresentationConsistency([resolved, ...others])), []);
  const otherCover = { ...source, title: "Plataforma articulada eléctrica JLG E300AJ" };
  assert.deepEqual([...codes(analyzePresentationConsistency([otherCover, ...others]))].sort(), [
    "gam:5730:imagen-de-otro-modelo",
    "gam:6998:imagen-de-otro-modelo"
  ].sort());
});

test("mantiene la discrepancia JLG aunque la portada no identifique la variante", () => {
  const original = gamProduct("6934");
  const withoutNamedCover = { ...original,
    image: "https://online.gamrentals.com/60451-product_main_2x/plataforma.jpg",
    images: ["https://online.gamrentals.com/60451-product_main_2x/plataforma.jpg"] };
  assert.deepEqual(codes(analyzePresentationConsistency([withoutNamedCover])), [
    "gam:6934:modelo-titulo-spec-discordante"
  ]);
  for (const safe of [
    { ...withoutNamedCover, spec: { ...withoutNamedCover.spec, Modelo: "E300AJP" } },
    { ...withoutNamedCover, title: "Plataforma articulada eléctrica JLG E300AJ" },
    { ...withoutNamedCover, providerId: "gomariz" },
    { ...withoutNamedCover, spec: { ...withoutNamedCover.spec, Marca: "GENIE" } },
    { ...withoutNamedCover, spec: { ...withoutNamedCover.spec, Modelo: "E400AJ" } }
  ]) assert.deepEqual(codes(analyzePresentationConsistency([safe])), []);
  assert.deepEqual(codes(analyzePresentationConsistency([
    gamProduct("5730"), gamProduct("6998"), gamProduct("4650")
  ])), []);
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


test("reconcilia la portada ajena de CC1666 sin alterar la fuente ni perder su galería propia", () => {
  const source = gomariz.products.find((item) => item.reference === "CC1666");
  const other = gomariz.products.find((item) => item.reference === "CC1535");
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
    const source = gomariz.products.find((item) => item.reference === reference);
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

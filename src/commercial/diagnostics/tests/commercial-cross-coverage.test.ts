import assert from "node:assert/strict";
import test from "node:test";
import type { ImportCandidate } from "../../legacy-export/contracts.js";
import { analyzeCommercialCrossCoverage } from "../commercial-cross-coverage.js";

const product = (reference: string, model = "GS-2632"): ImportCandidate => ({
  providerId: "gam", reference, externalReference: null,
  sourceUrl: `https://example.org/machines/${reference}`,
  title: `GENIE ${model} plataforma elevadora`, categorySellID: 29,
  category: "Plataformas elevadoras", condition: "Segunda_Mano", price: null,
  description_title: `GENIE ${model} plataforma elevadora`,
  description: "Plataforma de elevación para uso en interiores y exteriores.",
  description_general: `La ficha del modelo ${model} documenta esta unidad. ${Array.from({ length: 67 }, (_, index) => `detalle${index}`).join(" ")}.`,
  image: `https://example.org/images/${reference}.jpg`,
  images: [`https://example.org/images/${reference}.jpg`],
  spec: { Marca: "GENIE", Modelo: model }, attributes: []
});

const summary = (items: ReturnType<typeof analyzeCommercialCrossCoverage>): readonly string[] =>
  items.findings.map(({ reference, area, reason, origin }) => `${reference}:${area}:${reason}:${origin}`);

test("reutiliza diagnósticos editoriales existentes sin modificar datos técnicos ni comerciales", () => {
  const before = [product("11")];
  const after = [{ ...before[0]!, description: "GENIE GS-2632 plataforma elevadora" }];
  const snapshot = JSON.stringify({ before, after });
  assert.deepEqual(summary(analyzeCommercialCrossCoverage(before, after)),
    ["11:editorial:corta_igual_titulo:introducida"]);
  assert.equal(JSON.stringify({ before, after }), snapshot);
  assert.deepEqual(analyzeCommercialCrossCoverage(before, after), analyzeCommercialCrossCoverage(before, after));
  assert.deepEqual(analyzeCommercialCrossCoverage(before, before).findings, []);
});

test("separa patrones editoriales heredados de los introducidos por la proyección", () => {
  const base = product("12");
  const technical = [{ ...base, description: base.title }];
  const commercial = [{ ...technical[0]!, category: "Otra categoría comercial" }];
  assert.deepEqual(summary(analyzeCommercialCrossCoverage(technical, commercial)),
    ["12:editorial:corta_igual_titulo:heredada"]);
});

test("recupera el detector existente de galerías con imágenes de otro modelo", () => {
  const first = product("20", "GS-2632");
  const second = product("21", "GS-3246");
  const commercial = [{ ...first, images: [...first.images, second.image!] }, second];
  assert.deepEqual(summary(analyzeCommercialCrossCoverage([first, second], commercial)),
    ["20:imagenes:imagen-de-otro-modelo:introducida"]);
  const inherited = [{ ...first, images: [...first.images, second.image!] }, second];
  assert.deepEqual(summary(analyzeCommercialCrossCoverage(inherited, inherited)),
    ["20:imagenes:imagen-de-otro-modelo:heredada"]);
});

test("señala referencias visibles similares sin fusionar unidades ni equiparar modelos", () => {
  const first = { ...product("30"), externalReference: "KB 54362" };
  const second = { ...product("31"), externalReference: "KB-54362" };
  const third = { ...product("32"), externalReference: "KB54363" };
  assert.deepEqual(summary(analyzeCommercialCrossCoverage([first, second, third], [first, second, third])), [
    "30:identidad:referencia-visible-formato-ambiguo:heredada",
    "31:identidad:referencia-visible-formato-ambiguo:heredada"
  ]);
  assert.deepEqual(summary(analyzeCommercialCrossCoverage([first, { ...second, providerId: "gomariz" }],
    [first, { ...second, providerId: "gomariz" }])), []);
  assert.deepEqual(summary(analyzeCommercialCrossCoverage([
    { ...first, externalReference: "KB54362" }, { ...second, externalReference: "KB54362" }
  ], [
    { ...first, externalReference: "KB54362" }, { ...second, externalReference: "KB54362" }
  ])), []);
});

test("no confunde cambios de categoría con regresiones editoriales", () => {
  const general = Array.from({ length: 90 }, (_, index) => `detalle${index}`).join(" ");
  const originals = [product("40", "A100"), product("41", "B200"), product("42", "C300")]
    .map((item, index) => ({ ...item, category: `Técnica ${index}`, description_general: general }));
  const commercial = originals.map((item) => ({ ...item, category: "Categoría comercial" }));
  const report = analyzeCommercialCrossCoverage(originals, commercial);
  assert.equal(report.signals.find((signal) => signal.reason === "general_repetida_entre_modelos")?.affected, 3);
  assert.equal(report.signals.find((signal) => signal.reason === "general_repetida_entre_modelos")?.origin,
    "heredada");
});

test("no atribuye a la proyección repeticiones entre modelos causadas por referencias de unidad", () => {
  const published = ["GR1679", "GR1680", "GR1681"].map((reference) => ({
    ...product(reference), providerId: "gomariz", title: "Grupo electrógeno PRAMAC GPW45P",
    description_title: "Grupo electrógeno PRAMAC GPW45P",
    description_general: `Grupo electrógeno PRAMAC GPW45P con potencia estable y construcción industrial. ${Array.from({ length: 70 }, (_, index) => `dato${index}`).join(" ")} KG.`,
    spec: {}
  }));
  const commercial = published.map((item) => ({ ...item,
    title: `${item.title} · Ref. ${item.reference}`,
    description_general: item.description_general?.replace(" KG.", " kg.") ?? null
  }));
  const snapshot = JSON.stringify({ published, commercial });
  const report = analyzeCommercialCrossCoverage(published, commercial);
  assert.equal(report.findings.some((item) => item.reason === "general_repetida_entre_modelos"), false);
  assert.equal(JSON.stringify({ published, commercial }), snapshot);
});

test("requiere correspondencia técnica inequívoca y mantiene límite de muestras", () => {
  const original = product("50");
  assert.throws(() => analyzeCommercialCrossCoverage([original], [{ ...original, reference: "51" }]),
    /sin identidad técnica/);
  assert.throws(() => analyzeCommercialCrossCoverage([original, original], [original]), /Origen técnico duplicado/);
  const originals = Array.from({ length: 7 }, (_, index) => product(String(index + 100)));
  const revised = originals.map((item) => ({ ...item, description: item.title }));
  const report = analyzeCommercialCrossCoverage(originals, revised);
  assert.equal(report.signals[0]?.affected, 7);
  assert.equal(report.signals[0]?.examples.length, 5);
});

test("identifica la ficha causante de una contradicción de modelo y conserva el origen heredado", () => {
  const suspect = { ...product("6934", "E300AJ"), title: "Plataforma JLG E300AJP",
    image: "https://example.org/2007-jlg-e300ajp.jpg",
    images: ["https://example.org/2007-jlg-e300ajp.jpg"] };
  const report = analyzeCommercialCrossCoverage([suspect], [suspect]);
  assert.deepEqual(summary(report), ["6934:identidad:modelo-titulo-spec-discordante:heredada"]);
  const fixedOriginal = { ...suspect, spec: { Marca: "JLG", Modelo: "E300AJP" } };
  assert.deepEqual(summary(analyzeCommercialCrossCoverage([fixedOriginal], [suspect])),
    ["6934:identidad:modelo-titulo-spec-discordante:introducida"]);
});

test("atribuye la herencia JLG al modelo origen sin imputar falsamente las galerías derivadas", () => {
  const owner = { ...product("6934", "E300AJ"),
    title: "Plataforma JLG E300AJP",
    image: "https://example.org/2007-jlg-e300ajp.jpg",
    images: ["https://example.org/2007-jlg-e300ajp.jpg"],
    spec: { Marca: "JLG", Modelo: "E300AJ" }
  };
  const child = { ...product("5730", "E300AJP"),
    image: "https://example.org/5730.jpg",
    images: ["https://example.org/5730.jpg", owner.image],
    spec: { Marca: "JLG", Modelo: "E300AJP" }
  };
  const sources = [owner, child];
  const snapshot = JSON.stringify(sources);
  assert.deepEqual(summary(analyzeCommercialCrossCoverage(sources, sources)), [
    "6934:identidad:modelo-titulo-spec-discordante:heredada"
  ]);
  const unrelated = { ...child, spec: { ...child.spec, Modelo: "E400AJP" } };
  assert.deepEqual([...summary(analyzeCommercialCrossCoverage([owner, unrelated], [owner, unrelated]))
    .filter((entry) => !entry.includes(":editorial:"))].sort(), [
    "5730:imagenes:imagen-de-otro-modelo:heredada",
    "6934:identidad:modelo-titulo-spec-discordante:heredada"
  ].sort());
  assert.equal(JSON.stringify(sources), snapshot);
});

test("clasifica las referencias fotográficas por su naturaleza sin modificar galerías", () => {
  const source = { ...product("CC1666", "FORSTE20D"), providerId: "gomariz",
    image: "https://example.org/CC1535-SOCAGE-IVECO.jpg",
    images: ["https://example.org/CC1535-SOCAGE-IVECO.jpg"] };
  const prefix = { ...product("TE1756", "AS1012E"), providerId: "gomariz",
    image: "https://example.org/TD1756-LGMG-AS1012E-22.jpg",
    images: ["https://example.org/TD1756-LGMG-AS1012E-22.jpg"] };
  const model = { ...product("TE1772", "AS0607WE"), providerId: "gomariz",
    image: "https://example.org/TD1772-LGMG-AS0607WF-22.jpg",
    images: ["https://example.org/TD1772-LGMG-AS0607WF-22.jpg"] };
  const published = [source, prefix, model];
  assert.deepEqual([...summary(analyzeCommercialCrossCoverage(published, published))].sort(), [
    "CC1666:imagenes:portada-referencia-ajena:heredada",
    "TE1756:imagenes:portada-prefijo-distinto:heredada",
    "TE1772:imagenes:portada-prefijo-distinto:heredada",
    "TE1772:imagenes:modelo-portada-variante-discordante:heredada"
  ].sort());
  const original = { ...source, image: "https://example.org/CC1666-SOCAGE-IVECO.jpg",
    images: ["https://example.org/CC1666-SOCAGE-IVECO.jpg"] };
  assert.deepEqual(summary(analyzeCommercialCrossCoverage([original], [source])),
    ["CC1666:imagenes:portada-referencia-ajena:introducida"]);
});

test("GAM conserva las Yale de stock compartido sin señalar como ambigüedad los separadores ya canonizados", () => {
  const older = { ...product("6835", "ERP35VL"), externalReference: "GAM 27262",
    spec: { Marca: "YALE", Modelo: "ERP35VL", Horómetro: "1660 horas", "Nº de serie": "A976B08243T" },
    image: "https://example.org/59171.jpg", images: ["https://example.org/59171.jpg"] };
  const newer = { ...product("6858", "ERP35VL"), externalReference: "GAM-27262",
    spec: { Marca: "YALE", Modelo: "ERP35VL", Horómetro: "1662 horas", "Nº de serie": "A976B08243T" },
    image: "https://example.org/59538.jpg", images: ["https://example.org/59538.jpg"] };
  const before = JSON.stringify([older, newer]);
  assert.deepEqual(summary(analyzeCommercialCrossCoverage([older, newer], [older, newer])), []);
  assert.equal(JSON.stringify([older, newer]), before);
  assert.deepEqual(summary(analyzeCommercialCrossCoverage([older, { ...newer, externalReference: "GAM27262" }],
    [older, { ...newer, externalReference: "GAM27262" }])), [
    "6835:identidad:referencia-visible-formato-ambiguo:heredada",
    "6858:identidad:referencia-visible-formato-ambiguo:heredada"
  ]);
  assert.deepEqual(summary(analyzeCommercialCrossCoverage([
    older, { ...newer, providerId: "gomariz" }
  ], [older, { ...newer, providerId: "gomariz" }])), []);
});

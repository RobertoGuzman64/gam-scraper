import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { PreparedProduct } from "../../preparation/contracts.js";
import { analyzeEditorialQuality, analyzePublishedEditorialQuality, EDITORIAL_CRITERIA } from "../editorial-quality.js";
import type { GapInput } from "../content-gaps-types.js";

const entry = (reference: string, values: {
  title?: string | null; short?: string | null; long?: string | null;
  model?: string; providerId?: string; categoryKey?: string;
} = {}): GapInput => {
  const source: ProductRecord = {
    providerId: values.providerId ?? "gomariz", categoryKey: values.categoryKey ?? "venta",
    categoryName: "Elevación", url: `https://example.com/${reference}`, reference,
    title: values.title ?? "Plataforma LGMG modelo", shortDescription: null, longDescription: null,
    brand: "LGMG", model: values.model ?? "S1", year: null, price: null, location: null,
    country: null, horometer: null, serialNumber: null, image: null
  };
  const prepared: PreparedProduct = {
    status: "ready", issues: [], product: {
      providerId: source.providerId, sourceUrl: source.url, reference,
      title: values.title === undefined ? source.title : values.title, categorySellID: null,
      category: source.categoryName, condition: null, price: null,
      description_title: source.title, description: values.short ?? null,
      description_general: values.long ?? null, image: null, images: [], spec: {}, attributes: []
    }
  };
  return { source, prepared };
};
const words = (quantity: number): string => Array.from({ length: quantity }, (_, index) => `dato${index}`).join(" ");
const codes = (report: ReturnType<typeof analyzeEditorialQuality>, reference: string): readonly string[] =>
  report.cases.find((item) => item.reference === reference)?.issues.map((issue) => issue.code) ?? [];

test("mide palabras y caracteres de textos preparados, incluidos vacíos, y separa corta y general", () => {
  const result = analyzeEditorialQuality([
    entry("1", { title: "Plataforma Z", short: words(EDITORIAL_CRITERIA.maxShortWords + 1), long: words(EDITORIAL_CRITERIA.minLongWords - 1) }),
    entry("2", { short: "Texto de tres palabras", long: words(EDITORIAL_CRITERIA.minLongWords) }),
    entry("3")
  ]);
  assert.deepEqual(result.lengths.description.words, { min: 4, median: 25, p90: 46, max: 46 });
  assert.equal(result.lengths.description.missing, 1);
  assert.equal(result.lengths.description_general.words.median, 59.5);
  assert.equal(result.lengths.description_general.words.p90, 60);
  assert.equal(result.lengths.title.present, 3);
  assert.equal(result.lengths.description.characters.max, words(46).length);
  assert.deepEqual(codes(result, "1"), ["titulo_muy_breve", "corta_demasiado_larga", "general_muy_breve"]);
  assert.ok(codes(result, "2").includes("corta_muy_breve"));
  assert.deepEqual(codes(result, "3"), ["corta_ausente", "general_ausente"]);
  assert.equal(result.providers[0]?.findings.corta_ausente, 1);
  assert.equal(result.providers[0]?.findings.general_ausente, 1);
});

test("detecta equivalencia, general menor que corta y título reutilizado sin afirmar datos inventados", () => {
  const common = "Plataforma LGMG modelo";
  const result = analyzeEditorialQuality([
    entry("1", { short: common, long: ` ${common.toUpperCase()}!` }),
    entry("2", { short: words(22), long: words(11) }),
    entry("3", { title: "  ", short: words(12), long: words(70) })
  ]);
  assert.ok(codes(result, "1").includes("corta_igual_titulo"));
  assert.ok(codes(result, "1").includes("descripciones_iguales"));
  assert.ok(codes(result, "2").includes("general_no_supera_corta"));
  assert.ok(codes(result, "3").includes("titulo_ausente"));
});

test("marca textos generales repetidos solo si cruzan modelos distintos de un mismo origen", () => {
  const shared = words(80);
  const catalog = [
    entry("1", { long: shared, model: "A" }), entry("2", { long: shared, model: "B" }),
    entry("3", { long: shared, model: "C" }), entry("4", { long: shared, model: "C", providerId: "gam" }),
    entry("5", { long: shared, model: "C", categoryKey: "alquiler" }),
    entry("6", { long: "Otro contenido", model: "D" })
  ];
  const result = analyzeEditorialQuality(catalog);
  assert.equal(result.patterns.find((item) => item.code === "general_repetida_entre_modelos")?.affected, 3);
  assert.ok(codes(result, "1").includes("general_repetida_entre_modelos"));
  assert.ok(!codes(result, "4").includes("general_repetida_entre_modelos"));
  assert.ok(!codes(result, "5").includes("general_repetida_entre_modelos"));
  const oneModel = analyzeEditorialQuality([
    entry("7", { long: shared, model: "A" }), entry("8", { long: shared, model: "A" }),
    entry("9", { long: shared, model: "A" })
  ]);
  assert.ok(oneModel.patterns.every((item) => item.code !== "general_repetida_entre_modelos"));
});

test("mantiene orden estable, trazabilidad y no altera originales ni preparaciones", () => {
  const first = entry("2", { short: words(8), long: words(810) });
  const records = [first, entry("1", { short: words(47), long: words(9) })];
  const before = JSON.stringify(records);
  assert.equal(JSON.stringify(analyzeEditorialQuality(records)),
    JSON.stringify(analyzeEditorialQuality([...records].reverse())));
  assert.equal(JSON.stringify(records), before);
  assert.throws(() => analyzeEditorialQuality([first, first]), /duplicada/);
  assert.ok(analyzeEditorialQuality(records).cases.every((item) => item.url.startsWith("https://example.com/")));
});

test("señala descripciones generales genéricas sin el modelo pero admite variantes de separación", () => {
  const catalog = [
    entry("modelo-sin-mention", { model: "SS0507E", long: words(80) }),
    entry("modelo-presente", { model: "GS-2632", long: `${words(80)} El modelo GS 2632 está documentado.` }),
    entry("modelo-sin-identificador", { model: "Serie", long: words(80) })
  ];
  const result = analyzeEditorialQuality(catalog);
  assert.ok(codes(result, "modelo-sin-mention").includes("general_sin_modelo"));
  assert.ok(!codes(result, "modelo-presente").includes("general_sin_modelo"));
  assert.ok(!codes(result, "modelo-sin-identificador").includes("general_sin_modelo"));
});

test("distingue texto telegráfico y repetición interna no solapada de textos descriptivos", () => {
  const uppercase = "Ref. 442 CARRETILLA ELEVADORA ELÉCTRICA 2500 KG MÁSTIL TRÍPLEX MARCA GENIE MODELO GS2632 ALTURA 12 METROS HORAS 235 AÑO 2023";
  const phrase = "La máquina destaca por estabilidad durante los trabajos de movimiento de materiales industriales.";
  const distinct = (prefix: string): string => Array.from({ length: 50 }, (_, index) => `${prefix}${index}`).join(" ");
  const repeated = `${distinct("uno")} ${phrase} ${distinct("dos")} ${phrase} ${distinct("tres")} ${phrase}`;
  const result = analyzeEditorialQuality([
    entry("telegráfico", { long: uppercase }),
    entry("repetido", { long: repeated }),
    entry("natural", { long: `${distinct("natural")} ${phrase} ${distinct("otro")} ${distinct("final")}` }),
    entry("solo-dos", { long: `${distinct("inicio")} ${phrase} ${distinct("medio")} ${phrase} ${distinct("cierre")}` })
  ]);
  assert.ok(codes(result, "telegráfico").includes("general_telegrafica"));
  assert.ok(!codes(result, "natural").includes("general_telegrafica"));
  assert.ok(codes(result, "repetido").includes("general_repeticion_interna"));
  assert.ok(!codes(result, "solo-dos").includes("general_repeticion_interna"));
});

test("ordena las descripciones más largas por palabras, caracteres e identidad, con referencia y URL", () => {
  const result = analyzeEditorialQuality([
    entry("b", { long: words(40) }),
    entry("a", { long: words(40) }),
    entry("max", { long: words(100) }),
    entry("sin-texto")
  ]);
  assert.deepEqual(result.longestGeneral.map((item) => item.reference), ["max", "a", "b"]);
  assert.equal(result.longestGeneral[0]?.words, 100);
  assert.match(result.longestGeneral[0]?.url ?? "", /\/max$/);
  assert.equal(result.longestGeneral[0]?.preview, words(100).slice(0, 180));
});


test("localiza por referencia ambos campos ausentes en publicaciones sin duplicar identidades", () => {
  const products = [
    entry("ambos").prepared.product,
    entry("corta", { long: words(75) }).prepared.product,
    entry("completa", { short: words(20), long: words(75) }).prepared.product
  ];
  const result = analyzePublishedEditorialQuality(products);
  const both = result.cases.find((item) => item.reference === "ambos");
  const onlyShort = result.cases.find((item) => item.reference === "corta");
  assert.equal(both?.identity, "gomariz:ref:ambos");
  assert.equal(both?.url, "https://example.com/ambos");
  assert.deepEqual(both?.issues.map((issue) => issue.code), ["corta_ausente", "general_ausente"]);
  assert.deepEqual(onlyShort?.issues.map((issue) => issue.code), ["corta_ausente"]);
  assert.equal(result.cases.some((item) => item.reference === "completa"), false);
  assert.equal(result.lengths.description.missing, 2);
  assert.equal(result.lengths.description_general.missing, 1);
  assert.equal(result.providers[0]?.findings.corta_ausente, 2);
  assert.equal(result.providers[0]?.findings.general_ausente, 1);
});

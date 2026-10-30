import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { PreparedProduct } from "../../preparation/contracts.js";
import { analyzeEditorialQuality, EDITORIAL_CRITERIA } from "../editorial-quality.js";
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
  assert.equal(codes(result, "3").length, 0);
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

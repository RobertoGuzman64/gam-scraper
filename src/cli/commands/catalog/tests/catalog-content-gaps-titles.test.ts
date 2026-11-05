import assert from "node:assert/strict";
import test from "node:test";
import { readContentGapOptions } from "../catalog-content-gaps-options.js";
import { formatTitleQualityReport } from "../title-quality-report.js";
import { analyzeTitleQuality } from "../../../../catalog/diagnostics/title-quality.js";
import { execute } from "./catalog-content-gaps-fixtures.js";
import type { DescriptionCoverageInput } from "../../../../catalog/diagnostics/description-coverage.js";

const single = (): DescriptionCoverageInput => {
  const product = {
    providerId: "gam", sourceUrl: "https://example.com/5950", reference: "5950",
    title: "Littium Ibiza Dogma", categorySellID: null, category: "Maquinaria de ocasión",
    condition: null, price: null, description_title: null, description: null, description_general: null,
    image: null, images: [], spec: {}, attributes: []
  } as const;
  return {
    source: {
      providerId: "gam", url: product.sourceUrl, reference: product.reference,
      categoryKey: "maquinaria", categoryName: "Maquinaria de ocasión", title: product.title,
      shortDescription: "La Littium Ibiza Dogma es una bicicleta eléctrica plegable.",
      longDescription: null, price: null, brand: "Littium", model: "Ibiza Dogma",
      year: null, location: null, country: null, horometer: null, serialNumber: null, image: null
    },
    published: product,
    prepared: { status: "ready", issues: [], product },
    origin: "original_canonico"
  };
};

test("--titulos es optativo y exige comparación de identidad", () => {
  assert.equal(readContentGapOptions(["--comparar"]).titles, false);
  assert.equal(readContentGapOptions(["--comparar", "--titulos", "--json"]).titles, true);
  assert.throws(() => readContentGapOptions(["--titulos"]), /--titulos requiere --comparar/);
  assert.throws(() => readContentGapOptions(["--comparar", "--titulos", "--specs"]), /diagnósticos alternativos/);
  assert.throws(() => readContentGapOptions(["--finales", "--titulos"]), /--titulos requiere --comparar/);
  assert.throws(() => readContentGapOptions(["--comparar", "--titulos", "--publicacion", "f.json"]), /no se combina/);
});

test("formatea casos reales con título, evidencia y resumen sin truncar el JSON del auditor", () => {
  const report = analyzeTitleQuality([single()]);
  const text = formatTitleQualityReport(report, 1).join("\n");
  assert.match(text, /TÍTULOS \| fichas 1 \| señaladas 1/);
  assert.match(text, /tipo_maquina_no_identificado/);
  assert.match(text, /Littium Ibiza Dogma/);
  assert.match(text, /bicicleta eléctrica/);
  assert.match(text, /https:\/\/example.com\/5950/);
  assert.equal(report.cases.length, 1);
  assert.equal(formatTitleQualityReport(report, 0).some((line) => line.includes("Publicado:")), false);
});


test("huecos --comparar --titulos audita publicaciones acreditadas y presenta solo títulos", async () => {
  const raw = await execute(["--comparar", "--titulos", "--json"]);
  const report: unknown = JSON.parse(raw);
  assert.ok(report !== null && typeof report === "object" && "titles" in report && "provenance" in report);
  const { titles } = report;
  assert.ok(titles !== null && typeof titles === "object" && "totals" in titles && "cases" in titles &&
    "providers" in titles && Array.isArray(titles.cases) && Array.isArray(titles.providers));
  assert.ok(titles.totals !== null && typeof titles.totals === "object" && "products" in titles.totals &&
    typeof titles.totals.products === "number" && titles.totals.products > 0);
  assert.equal(titles.providers.length, 3);
  assert.ok("affected" in titles.totals && typeof titles.totals.affected === "number");
  assert.equal(titles.cases.length, titles.totals.affected);
  assert.equal("editorial" in report, false);
  assert.equal("technicalSpecs" in report, false);
  const text = await execute(["--comparar", "--titulos", "--top", "1"]);
  assert.match(text, new RegExp(`TÍTULOS CASOS \\| TOP ${Math.min(1, titles.cases.length)} de ${titles.cases.length} fichas`));
  assert.doesNotMatch(text, /DESCRIPCIONES GENERALES MÁS LARGAS/);
});

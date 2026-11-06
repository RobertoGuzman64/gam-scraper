import assert from "node:assert/strict";
import test from "node:test";
import { readContentGapOptions } from "../catalog-content-gaps-options.js";
import { formatTitleQualityReport } from "../title-quality-report.js";
import { analyzeTitleQuality, type TitleQuality } from "../../../../catalog/diagnostics/title-quality.js";
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

const isTitleQuality = (value: unknown): value is TitleQuality => {
  if (typeof value !== "object" || value === null || !("note" in value) ||
    typeof value.note !== "string" || !("totals" in value) ||
    typeof value.totals !== "object" || value.totals === null ||
    !("providers" in value) || !Array.isArray(value.providers) ||
    !("cases" in value) || !Array.isArray(value.cases)) return false;
  const totals = value.totals;
  if (!("products" in totals) || typeof totals.products !== "number" ||
    !("affected" in totals) || typeof totals.affected !== "number" ||
    !("pending" in totals) || typeof totals.pending !== "number" ||
    !("resolved" in totals) || typeof totals.resolved !== "number" ||
    !("appeared" in totals) || typeof totals.appeared !== "number") return false;
  return value.providers.every((provider: unknown) =>
    typeof provider === "object" && provider !== null &&
    "providerId" in provider && typeof provider.providerId === "string" &&
    "products" in provider && typeof provider.products === "number" &&
    "affected" in provider && typeof provider.affected === "number" &&
    "pending" in provider && typeof provider.pending === "number" &&
    "resolved" in provider && typeof provider.resolved === "number" &&
    "appeared" in provider && typeof provider.appeared === "number") &&
    value.cases.every((item: unknown) =>
      typeof item === "object" && item !== null &&
      "providerId" in item && typeof item.providerId === "string" &&
      "identity" in item && typeof item.identity === "string" &&
      "reference" in item && (typeof item.reference === "string" || item.reference === null) &&
      "findings" in item && Array.isArray(item.findings) &&
      item.findings.every((finding: unknown) =>
        typeof finding === "object" && finding !== null &&
        "code" in finding && typeof finding.code === "string" &&
        "priority" in finding && typeof finding.priority === "string" &&
        "stage" in finding && typeof finding.stage === "string" &&
        "evidence" in finding && typeof finding.evidence === "string"));
};

test("--titulos es optativo y exige comparación de identidad", () => {
  assert.equal(readContentGapOptions(["--comparar"]).titles, false);
  assert.equal(readContentGapOptions(["--comparar", "--detalle"]).detailed, true);
  assert.equal(readContentGapOptions(["--comparar", "--json"]).detailed, false);
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
  assert.ok(isTitleQuality(titles));
  assert.ok(titles.totals.products > 0);
  assert.equal(titles.providers.length, 3);
  assert.equal(titles.cases.length, titles.totals.affected);
  assert.equal("editorial" in report, false);
  assert.equal("technicalSpecs" in report, false);
  const text = formatTitleQualityReport(titles, 1).join("\n");
  assert.match(text, new RegExp(`TÍTULOS CASOS \\| TOP ${Math.min(1, titles.cases.length)} de ${titles.cases.length} fichas`));
  assert.doesNotMatch(text, /DESCRIPCIONES GENERALES MÁS LARGAS/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { formatRunSummary } from "../progress.js";
import type { Summary } from "../types.js";

const summary: Summary = {
  startedAt: "2026-10-20T12:00:00.000Z",
  endedAt: "2026-10-20T12:01:25.000Z",
  quality: { status: "complete", reasons: [], published: true },
  totals: {
    categories: 3,
    discoveredProductUrls: 50,
    scrapedProductsRaw: 42,
    scrapedProductsByCategorySum: 42,
    scrapedProducts: 30,
    failures: 0,
    dedupe: {
      withinCategories: { kept: 42, removed: 0, byReason: { reference: 0, serialNumber: 0, canonicalUrl: 0 } },
      globalAll: { kept: 30, removed: 12, byReason: { reference: 12, serialNumber: 0, canonicalUrl: 0 } }
    }
  },
  categories: []
};

test("resumen compacto muestra productos únicos y tiempo de ejecución", () => {
  const lines = formatRunSummary("gam", "storage/scraped/gam", "gam-completo", summary, false);
  assert.match(lines.join("\n"), /GAM \| COMPLETA \| 1m 25s/);
  assert.match(lines.join("\n"), /Fichas leídas: 42 \| Productos únicos: 30/);
  assert.match(lines.join("\n"), /gam-completo-all\.csv/);
});

test("errores extensos se resumen sin perder el archivo de diagnóstico", () => {
  const blocked: Summary = {
    ...summary,
    quality: { status: "blocked", published: false, reasons: Array.from({ length: 12 }, (_, index) => `Error ${index}: ${"x".repeat(300)}`) }
  };
  const lines = formatRunSummary("gam", "storage/scraped/gam", "gam-completo", blocked, true);
  assert.equal(lines.filter((line) => line.startsWith("  - ")).length, 4);
  assert.ok(lines.every((line) => line.length < 160));
  assert.match(lines.join("\n"), /9 motivos adicionales/);
  assert.match(lines.join("\n"), /gam-completo-errors\.json/);
  assert.doesNotMatch(lines.join("\n"), /gam-completo-all\.csv/);
});

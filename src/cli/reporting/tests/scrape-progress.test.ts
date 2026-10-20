import assert from "node:assert/strict";
import test from "node:test";
import { formatCategoryProgress, formatRunSummary } from "../scrape-progress.js";
import type { Summary } from "../../../contracts/scraping.js";

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

test("errores extensos se muestran completos junto al diagnóstico", () => {
  const reason = `Paginación fallida: ${"x".repeat(300)} con causa determinante`;
  const blocked: Summary = {
    ...summary,
    quality: { status: "blocked", published: false, reasons: [reason] }
  };
  const lines = formatRunSummary("gam", "storage/scraped/gam", "gam-completo", blocked, true);
  assert.match(lines.join("\n"), /con causa determinante/);
  assert.match(lines.join("\n"), /gam-completo-errors\.json/);
  assert.doesNotMatch(lines.join("\n"), /gam-completo-all\.csv/);
});

test("spinner informa páginas, fichas y tiempo durante el descubrimiento", () => {
  const line = formatCategoryProgress({
    categoryName: "Maquinaria nueva por marcas", position: 15, count: 15, phase: "listing",
    pagesScanned: 28, found: 336, processed: 0, totalProducts: 0, elapsedSeconds: 74, idleSeconds: 2
  }, "/");
  assert.match(line, /\[15\/15\] Maquinaria nueva por marcas \| \/ buscando fichas/);
  assert.match(line, /28 págs\. \| 336 encontradas \| 1m 14s/);
  assert.doesNotMatch(line, /sin novedades/);
});

test("avisa si pasan más de 25 segundos sin novedades", () => {
  const line = formatCategoryProgress({
    categoryName: "Mercaeleva", position: 1, count: 1, phase: "listing",
    pagesScanned: 0, found: 0, processed: 0, totalProducts: 0, elapsedSeconds: 60, idleSeconds: 40
  }, "|");
  assert.match(line, /sin novedades 40s/);
});

test("mantiene contador durante el procesamiento de fichas", () => {
  const line = formatCategoryProgress({
    categoryName: "Elevación", position: 1, count: 15, phase: "products",
    pagesScanned: 10, found: 101, processed: 80, totalProducts: 101, elapsedSeconds: 85, idleSeconds: 0
  }, "-");
  assert.match(line, /80\/101 fichas procesadas \| 1m 25s/);
});


test("el listado muestra la etapa del navegador sin ocultar las páginas encontradas", () => {
  const line = formatCategoryProgress({
    categoryName: "Mercaeleva", position: 1, count: 1, phase: "listing",
    pagesScanned: 2, listingStage: "recorriendo páginas", found: 40,
    processed: 0, totalProducts: 0, elapsedSeconds: 14, idleSeconds: 1
  }, "|");
  assert.match(line, /recorriendo páginas \| 2 págs\. \| 40 encontradas/);
});

import { clearLine, cursorTo } from "node:readline";
import { join } from "node:path";
import type { CategoryConfig, CategoryScrapeResult, Summary } from "./types.js";

const trimText = (value: string, length: number): string => value.length > length ? `${value.slice(0, length - 1)}…` : value;

const elapsed = (startedAt: string, endedAt: string): string => {
  const seconds = Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000));
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
};

export const formatRunSummary = (providerId: string, outDir: string, outPrefix: string, summary: Summary, failed: boolean): readonly string[] => {
  const status = failed ? "ERROR" : summary.quality?.status === "complete" ? "COMPLETA" : "NO COMPLETA";
  const totals = summary.totals;
  const reasons = summary.quality?.reasons ?? [];
  const lines = [
    `\n[FIN] ${providerId.toUpperCase()} | ${status} | ${elapsed(summary.startedAt, summary.endedAt)}`,
    `  Categorías: ${totals.categories} | Fichas leídas: ${totals.scrapedProductsRaw} | Productos únicos: ${totals.scrapedProducts} | Fallos: ${totals.failures}`
  ];

  if (failed) {
    for (const reason of reasons.slice(0, 3)) lines.push(`  - ${trimText(reason, 115)}`);
    if (reasons.length > 3) lines.push(`  - ... y ${reasons.length - 3} motivos adicionales`);
    lines.push("  No se ha confirmado una publicación completa; consultar el resumen.");
  } else {
    lines.push(`  CSV: ${join(outDir, `${outPrefix}-all.csv`)}`);
  }

  lines.push(`  Resumen: ${join(outDir, `${outPrefix}-summary.json`)}`);
  if (failed || totals.failures > 0) lines.push(`  Errores: ${join(outDir, `${outPrefix}-errors.json`)}`);
  return lines;
};

export class ScrapeConsole {
  readonly verbose: boolean;
  private readonly interactive: boolean;
  private readonly providerId: string;
  private readonly outDir: string;
  private readonly outPrefix: string;
  private category: CategoryConfig | null = null;
  private position = 0;
  private count = 0;
  private discovered = 0;
  private lastRenderAt = 0;
  private lastReported = 0;
  private lineOpen = false;

  constructor(providerId: string, outDir: string, outPrefix: string, verbose: boolean) {
    this.providerId = providerId;
    this.outDir = outDir;
    this.outPrefix = outPrefix;
    this.verbose = verbose;
    this.interactive = process.stdout.isTTY === true && !verbose;
  }

  start(total: number): void {
    console.log(`\n[SCRAPER] ${this.providerId.toUpperCase()} | ${total} categorías`);
  }

  beginCategory(category: CategoryConfig, position: number, count: number): void {
    this.category = category;
    this.position = position;
    this.count = count;
    this.discovered = 0;
    this.lastReported = 0;
    this.lastRenderAt = 0;
    this.writeProgress("buscando fichas...");
  }

  listingDone(total: number): void {
    this.discovered = total;
    this.writeProgress(`${total} encontradas | 0/${total} procesadas`);
  }

  productDone(done: number, total: number): void {
    if (this.interactive) {
      if (Date.now() - this.lastRenderAt < 125 && done < total) return;
      this.writeProgress(`${this.discovered} encontradas | ${done}/${total} procesadas`);
    } else if (!this.verbose && done - this.lastReported >= 100 && done < total) {
      this.lastReported = done;
      console.log(`    ${done}/${total} fichas procesadas`);
    }
  }

  endCategory(result: CategoryScrapeResult): void {
    this.clearProgress();
    const prefix = `[${this.position}/${this.count}] ${result.category.name}`;
    console.log(`  ${prefix} | ${result.products.length}/${result.discoveredProductUrls} fichas | ${result.failures.length} fallos`);
    this.category = null;
  }

  finish(summary: Summary | null, startedAt: string, error: unknown, failureDetail: string | null): void {
    this.clearProgress();
    if (summary) {
      const failed = error !== null || summary.quality?.status !== "complete" || summary.quality?.published !== true;
      for (const line of formatRunSummary(this.providerId, this.outDir, this.outPrefix, summary, failed)) console.log(line);
      if (error !== null && failureDetail) console.error(`  Detalle: ${trimText(failureDetail, 150)}`);
      if (error !== null && (summary.quality?.reasons.length ?? 0) === 0 && !failureDetail) {
        console.error(`  Motivo: ${trimText(String(error), 180)}`);
      }
      return;
    }
    const duration = elapsed(startedAt, new Date().toISOString());
    console.error(`\n[FIN] ${this.providerId.toUpperCase()} | ERROR | ${duration}`);
    console.error(`  Motivo: ${trimText(String(error ?? "No se pudo leer el resumen de ejecución"), 180)}`);
    console.error(`  Salida: ${this.outDir}`);
  }

  categoriesSaved(count: number): void {
    this.clearProgress();
    console.log(`[FIN] ${this.providerId.toUpperCase()} | ${count} categorías exportadas`);
    console.log(`  CSV: ${join(this.outDir, `${this.outPrefix}-categories.csv`)}`);
  }

  private writeProgress(message: string): void {
    const category = this.category;
    if (!category) return;
    const line = `  [${this.position}/${this.count}] ${category.name} | ${message}`;
    if (!this.interactive) {
      if (message === "buscando fichas..." && !this.verbose) console.log(line);
      return;
    }
    clearLine(process.stdout, 0);
    cursorTo(process.stdout, 0);
    process.stdout.write(trimText(line, Math.max(30, (process.stdout.columns ?? 100) - 1)));
    this.lineOpen = true;
    this.lastRenderAt = Date.now();
  }

  private clearProgress(): void {
    if (!this.lineOpen) return;
    clearLine(process.stdout, 0);
    cursorTo(process.stdout, 0);
    this.lineOpen = false;
  }
}

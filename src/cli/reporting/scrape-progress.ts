import { join } from "node:path";
import type { CategoryConfig, CategoryScrapeResult, Summary } from "../../contracts/scraping.js";
import type { CategoryProgress, ScrapeEvent, ScrapeMessage } from "../../contracts/progress.js";
import { LiveStatus, formatDuration } from "./live-status.js";
import { errorDetail } from "./errors.js";

const seconds = (startedAt: string, endedAt: string): string =>
  formatDuration(Math.max(0, Date.parse(endedAt) - Date.parse(startedAt)));

export type { CategoryProgress } from "../../contracts/progress.js";

export const formatCategoryProgress = (progress: CategoryProgress, spinner: string): string => {
  const prefix = `[${progress.position}/${progress.count}] ${progress.categoryName}`;
  const activity = progress.phase === "listing"
    ? `${progress.listingStage ?? "buscando fichas"} | ${progress.pagesScanned} págs. | ${progress.found} encontradas`
    : `${progress.processed}/${progress.totalProducts} fichas procesadas`;
  const idle = progress.idleSeconds >= 25 ? ` | sin novedades ${formatDuration(progress.idleSeconds * 1000)}` : "";
  return `  ${prefix} | ${spinner} ${activity} | ${formatDuration(progress.elapsedSeconds * 1000)}${idle}`;
};

export const formatRunSummary = (providerId: string, outDir: string, outPrefix: string, summary: Summary, failed: boolean): readonly string[] => {
  const status = failed ? "ERROR" : summary.quality?.status === "complete" ? "COMPLETA" : "NO COMPLETA";
  const totals = summary.totals;
  const reasons = summary.quality?.reasons ?? [];
  const lines = [
    `\n[FIN] ${providerId.toUpperCase()} | ${status} | ${seconds(summary.startedAt, summary.endedAt)}`,
    `  Categorías: ${totals.categories} | Fichas leídas: ${totals.scrapedProductsRaw} | Productos únicos: ${totals.scrapedProducts} | Fallos: ${totals.failures}`
  ];
  if (failed) {
    for (const reason of reasons) lines.push(`  Motivo: ${reason}`);
    lines.push("  No se ha confirmado una publicación completa.");
  } else {
    lines.push(`  CSV: ${join(outDir, `${outPrefix}-all.csv`)}`);
  }
  lines.push(`  Resumen: ${join(outDir, `${outPrefix}-summary.json`)}`);
  if (failed || totals.failures > 0) lines.push(`  Errores: ${join(outDir, `${outPrefix}-errors.json`)}`);
  return lines;
};

export class ScrapeConsole {
  readonly verbose: boolean;
  private readonly status: LiveStatus;
  private readonly providerId: string;
  private readonly outDir: string;
  private readonly outPrefix: string;
  private category: CategoryConfig | null = null;
  private position = 0;
  private count = 0;
  private phase: "listing" | "products" = "listing";
  private pagesScanned = 0;
  private listingStage = "buscando fichas";
  private found = 0;
  private processed = 0;
  private totalProducts = 0;
  private categoryStartedAt = 0;
  private lastActivityAt = Date.now();
  private lastForwardAt = 0;
  private readonly seenFailures = new Set<string>();
  private reportedFailures = 0;

  constructor(providerId: string, outDir: string, outPrefix: string, verbose: boolean) {
    this.providerId = providerId;
    this.outDir = outDir;
    this.outPrefix = outPrefix;
    this.verbose = verbose;
    this.status = new LiveStatus(verbose);
  }

  private forward(event: ScrapeEvent): void {
    if (process.send) {
      const message: ScrapeMessage = { channel: "equipzilla:scrape", event };
      process.send(message);
    }
  }

  stage(stage: string, resource?: string): void {
    this.status.update(`${this.providerId.toUpperCase()} | ${stage}${resource ? ` | ${resource}` : ""}`);
    this.forward({ type: "stage", stage, ...(resource ? { resource } : {}) });
  }

  start(total: number): void {
    this.status.log(`\n[SCRAPER] ${this.providerId.toUpperCase()} | ${total} categorías`);
  }

  beginCategory(category: CategoryConfig, position: number, count: number): void {
    this.category = category;
    this.position = position;
    this.count = count;
    this.phase = "listing";
    this.pagesScanned = 0;
    this.listingStage = "buscando fichas";
    this.found = 0;
    this.processed = 0;
    this.totalProducts = 0;
    this.categoryStartedAt = Date.now();
    this.lastActivityAt = this.categoryStartedAt;
    this.lastForwardAt = 0;
    this.seenFailures.clear();
    this.publish(true);
  }

  listingProgress(pages: number, total: number, stage?: string): void {
    this.pagesScanned += pages;
    this.found = total;
    if (stage) this.listingStage = stage;
    this.lastActivityAt = Date.now();
    this.publish(true);
  }

  listingDone(total: number): void {
    this.found = total;
    this.phase = "products";
    this.totalProducts = total;
    this.lastActivityAt = Date.now();
    this.publish(true);
  }

  productDone(done: number, total: number): void {
    if (done > this.processed) this.lastActivityAt = Date.now();
    this.processed = done;
    this.totalProducts = total;
    this.publish(false);
  }

  failure(stage: string, resource: string, reason: string): void {
    const key = `${resource}\u0000${reason}`;
    if (this.seenFailures.has(key)) return;
    this.seenFailures.add(key);
    this.reportedFailures += 1;
    this.status.log(`  [ERROR] ${this.providerId} | ${stage} | ${resource}\n  Causa: ${reason}`, true);
    this.forward({ type: "failure", stage, resource, reason });
  }

  endCategory(result: CategoryScrapeResult): void {
    this.publish(true);
    this.status.stop();
    this.status.log(`  [${this.position}/${this.count}] ${result.category.name} | ${result.products.length}/${result.discoveredProductUrls} fichas | ${result.failures.length} fallos | ${formatDuration(Date.now() - this.categoryStartedAt)}`);
    for (const failure of result.failures) this.failure(result.category.name, failure.url, failure.error);
    this.category = null;
  }

  finish(summary: Summary | null, startedAt: string, error: unknown, failureDetail: string | null): void {
    this.status.stop();
    if (summary) {
      const failed = error !== null || summary.quality?.status !== "complete" || summary.quality?.published !== true;
      for (const line of formatRunSummary(this.providerId, this.outDir, this.outPrefix, summary, failed)) console.log(line);
      if (error !== null) console.error(`  Error: ${errorDetail(error)}`);
      if (failureDetail && this.reportedFailures === 0) console.error(`  Causa registrada: ${failureDetail}`);
      if (error !== null) this.forward({ type: "failure", stage: "publicación", resource: this.outDir, reason: errorDetail(error) });
      if (failureDetail && this.reportedFailures === 0) this.forward({ type: "failure", stage: "validación de catálogo", resource: join(this.outDir, `${this.outPrefix}-errors.json`), reason: failureDetail });
      if (failed && this.reportedFailures === 0 && !failureDetail && error === null) {
        for (const reason of summary.quality?.reasons ?? []) this.forward({ type: "failure", stage: "calidad del catálogo", resource: join(this.outDir, `${this.outPrefix}-summary.json`), reason });
      }
      return;
    }
    console.error(`\n[FIN] ${this.providerId.toUpperCase()} | ERROR | ${seconds(startedAt, new Date().toISOString())}`);
    console.error(`  Causa: ${errorDetail(error ?? "No se pudo leer el resumen de ejecución")}`);
    console.error(`  Salida: ${this.outDir}`);
    console.error(`  Resumen: ${join(this.outDir, `${this.outPrefix}-summary.json`)}`);
    this.forward({ type: "failure", stage: "extracción", resource: this.outDir, reason: errorDetail(error ?? "Resumen no disponible") });
  }

  categoriesSaved(count: number): void {
    this.status.stop();
    console.log(`[FIN] ${this.providerId.toUpperCase()} | ${count} categorías exportadas`);
    console.log(`  CSV: ${join(this.outDir, `${this.outPrefix}-categories.csv`)}`);
  }

  abort(error: unknown): void {
    this.status.stop();
    console.error(`  Salida: ${this.outDir}`);
    this.forward({ type: "failure", stage: "extracción", resource: this.outDir, reason: errorDetail(error) });
  }

  private snapshot(now: number): CategoryProgress {
    return {
      categoryName: this.category?.name ?? "", position: this.position, count: this.count,
      phase: this.phase, pagesScanned: this.pagesScanned, listingStage: this.listingStage,
      found: this.found, processed: this.processed, totalProducts: this.totalProducts,
      elapsedSeconds: Math.floor((now - this.categoryStartedAt) / 1000),
      idleSeconds: Math.floor((now - this.lastActivityAt) / 1000)
    };
  }

  private publish(immediate: boolean): void {
    if (!this.category) return;
    const now = Date.now();
    if (!immediate && now - this.lastForwardAt < 250) return;
    this.lastForwardAt = now;
    const progress = this.snapshot(now);
    this.status.update(`${this.providerId.toUpperCase()} | ${formatCategoryProgress(progress, "").trim()}`);
    this.forward({ type: "progress", progress });
  }
}

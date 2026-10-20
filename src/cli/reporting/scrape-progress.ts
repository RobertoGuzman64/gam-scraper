import { clearLine, cursorTo } from "node:readline";
import { join } from "node:path";
import type { CategoryConfig, CategoryScrapeResult, Summary } from "../../contracts/scraping.js";

const trimText = (value: string, length: number): string => value.length > length ? `${value.slice(0, length - 1)}…` : value;
const spinnerFrames = ["|", "/", "-", "\\"] as const;

const elapsedSeconds = (start: number, end: number): number => Math.max(0, Math.floor((end - start) / 1000));

const formatSeconds = (seconds: number): string => seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;

const elapsed = (startedAt: string, endedAt: string): string =>
  formatSeconds(Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000)));

export type CategoryProgress = {
  readonly categoryName: string;
  readonly position: number;
  readonly count: number;
  readonly phase: "listing" | "products";
  readonly pagesScanned: number;
  readonly found: number;
  readonly processed: number;
  readonly totalProducts: number;
  readonly elapsedSeconds: number;
  readonly idleSeconds: number;
};

export const formatCategoryProgress = (progress: CategoryProgress, spinner: string): string => {
  const prefix = `[${progress.position}/${progress.count}] ${progress.categoryName}`;
  const activity = progress.phase === "listing"
    ? `buscando fichas | ${progress.pagesScanned} págs. | ${progress.found} encontradas`
    : `${progress.processed}/${progress.totalProducts} fichas procesadas`;
  const idle = progress.idleSeconds >= 25 ? ` | sin novedades ${formatSeconds(progress.idleSeconds)}` : "";
  return `  ${prefix} | ${spinner} ${activity} | ${formatSeconds(progress.elapsedSeconds)}${idle}`;
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
  private phase: "listing" | "products" = "listing";
  private pagesScanned = 0;
  private found = 0;
  private processed = 0;
  private totalProducts = 0;
  private categoryStartedAt = 0;
  private lastActivityAt = 0;
  private lastHeartbeatAt = 0;
  private lastReported = 0;
  private spinnerFrame = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
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
    this.clearProgress();
    this.category = category;
    this.position = position;
    this.count = count;
    this.phase = "listing";
    this.pagesScanned = 0;
    this.found = 0;
    this.processed = 0;
    this.totalProducts = 0;
    this.lastReported = 0;
    this.spinnerFrame = 0;
    this.categoryStartedAt = Date.now();
    this.lastActivityAt = this.categoryStartedAt;
    this.lastHeartbeatAt = this.categoryStartedAt;

    if (this.verbose) return;
    if (!this.interactive) console.log(`  [${position}/${count}] ${category.name} | buscando fichas...`);
    this.timer = setInterval(() => this.tick(), 160);
    this.timer.unref();
    if (this.interactive) this.render();
  }

  listingProgress(pages: number, total: number): void {
    this.pagesScanned += pages;
    this.found = total;
    this.lastActivityAt = Date.now();
    if (this.interactive) this.render();
  }

  listingDone(total: number): void {
    this.found = total;
    this.phase = "products";
    this.totalProducts = total;
    this.lastActivityAt = Date.now();
    if (this.interactive) this.render();
  }

  productDone(done: number, total: number): void {
    if (done > this.processed) this.lastActivityAt = Date.now();
    this.processed = done;
    this.totalProducts = total;
    if (!this.interactive && !this.verbose && done - this.lastReported >= 100 && done < total) {
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

  private tick(): void {
    if (!this.category) return;
    if (this.interactive) {
      this.render();
      return;
    }
    const now = Date.now();
    if (now - this.lastHeartbeatAt < 30_000) return;
    this.lastHeartbeatAt = now;
    const progress = this.snapshot(now);
    console.log(formatCategoryProgress(progress, "...").trimEnd());
  }

  private snapshot(now: number): CategoryProgress {
    return {
      categoryName: this.category?.name ?? "",
      position: this.position,
      count: this.count,
      phase: this.phase,
      pagesScanned: this.pagesScanned,
      found: this.found,
      processed: this.processed,
      totalProducts: this.totalProducts,
      elapsedSeconds: elapsedSeconds(this.categoryStartedAt, now),
      idleSeconds: elapsedSeconds(this.lastActivityAt, now)
    };
  }

  private render(): void {
    if (!this.interactive || !this.category) return;
    const frame = spinnerFrames[this.spinnerFrame % spinnerFrames.length]!;
    this.spinnerFrame += 1;
    const line = formatCategoryProgress(this.snapshot(Date.now()), frame);
    clearLine(process.stdout, 0);
    cursorTo(process.stdout, 0);
    process.stdout.write(trimText(line, Math.max(30, (process.stdout.columns ?? 100) - 1)));
    this.lineOpen = true;
  }

  private clearProgress(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (!this.lineOpen) return;
    clearLine(process.stdout, 0);
    cursorTo(process.stdout, 0);
    this.lineOpen = false;
  }
}

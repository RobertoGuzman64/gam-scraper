import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readCanonicalCatalog } from "../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { fetchHtml, sleep } from "../../infrastructure/http/fetch-html.js";
import { DEFAULT_OPTIONS } from "../../scraping/providers/gam/config.js";
import { inspectGamBasketDom, pendingGamBasketRecords } from "./basket-dom-evidence.js";

const catalogPath = "storage/scraped/gam/scrape-gam-marzo-2026-catalog.json";

type Inspection = {
  readonly reference: string;
  readonly url: string;
  readonly catalogValue: string;
  readonly htmlFile: string | null;
  readonly dom: ReturnType<typeof inspectGamBasketDom> | null;
  readonly error: string | null;
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !args[0] || args[0].startsWith("-")) {
    throw new Error("Uso: node dist/tools/gam/audit-basket-dom.js <directorio-salida>");
  }
  const destination = resolve(args[0]);
  const catalog = await readCanonicalCatalog(catalogPath);
  if (catalog.providerId !== "gam") throw new Error("El catálogo de origen no es GAM");
  const pending = pendingGamBasketRecords(catalog.products);
  if (pending.length === 0) throw new Error("No se han encontrado cestas pendientes en el catálogo");
  await mkdir(join(destination, "html"), { recursive: true });
  const inspections: Inspection[] = [];
  for (const record of pending) {
    const reference = record.reference;
    const catalogValue = record.specs?.["Dimensiones Cesta"];
    if (!reference || typeof catalogValue !== "string") continue;
    try {
      const html = await fetchHtml(record.url, { timeoutMs: DEFAULT_OPTIONS.timeoutMs, userAgent: DEFAULT_OPTIONS.userAgent });
      const htmlFile = join("html", `${reference}.html`);
      await writeFile(join(destination, htmlFile), html, "utf8");
      inspections.push({ reference, url: record.url, catalogValue, htmlFile, dom: inspectGamBasketDom(html), error: null });
      process.stdout.write(`${reference} | HTML capturado | evidencia DOM registrada\n`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      inspections.push({ reference, url: record.url, catalogValue, htmlFile: null, dom: null, error: message });
      process.stdout.write(`${reference} | SIN CAPTURA | ${message}\n`);
    }
    await sleep(DEFAULT_OPTIONS.delayMs);
  }
  const captured = inspections.filter((inspection) => inspection.htmlFile !== null).length;
  const report = {
    catalogSource: catalogPath,
    catalogStartedAt: catalog.startedAt,
    catalogEndedAt: catalog.endedAt,
    capturedAt: new Date().toISOString(),
    pendingCount: inspections.length,
    capturedCount: captured,
    failedCount: inspections.length - captured,
    sourceRecordsModified: 0,
    recoveriesConfirmed: 0,
    inspections
  };
  await writeFile(join(destination, "EVIDENCIA-DOM-CESTAS.json"), JSON.stringify(report, null, 2), "utf8");
  process.stdout.write(`FIN | ${captured}/${inspections.length} HTML capturados | ${inspections.length - captured} errores | 0 atributos modificados\n`);
  if (captured !== inspections.length) process.exitCode = 2;
};

await main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

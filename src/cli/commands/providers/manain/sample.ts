import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prepareSourceProduct } from "../../../../catalog/preparation/prepare-product.js";
import { scrapeProductPages } from "../../../../scraping/engine/scrape-products.js";
import { manainProvider } from "../../../../scraping/providers/manain/adapter.js";
import { discoverManainSaleCatalog } from "../../../../scraping/providers/manain/browser.js";
import { selectManainDiagnosticSample } from "../../../../scraping/providers/manain/sample.js";

const run = async (): Promise<void> => {
  if (process.argv.length !== 2) throw new Error("La muestra de Manain no admite opciones: se limita a cinco fichas y dos páginas");
  const category = manainProvider.categories[0];
  if (!category) throw new Error("Manain: falta la categoría de venta");
  const options = { ...manainProvider.defaultOptions, maxPages: 2, concurrencyProducts: 1 };
  const listing = await discoverManainSaleCatalog(category.url, options);
  const selection = selectManainDiagnosticSample(listing);
  const read = await scrapeProductPages(
    category, options, manainProvider, selection.urls, 1, undefined,
    (error) => error instanceof Error ? error.message : String(error),
    () => undefined
  );
  const prepared = read.products.map((product) => ({
    reference: product.reference,
    result: prepareSourceProduct(product)
  }));
  const references = read.products.map((product) => product.reference).filter((value): value is string => !!value);
  const duplicatedReferences = [...new Set(references.filter((reference, index) => references.indexOf(reference) !== index))];
  const missingReferences = read.products.filter((product) => !product.reference).map((product) => product.url);
  const output = {
    type: "manain-diagnostic-sample",
    generatedAt: new Date().toISOString(),
    providerId: manainProvider.id,
    category: category.key,
    coverage: selection,
    counts: {
      sampled: selection.urls.length,
      read: read.products.length,
      failures: read.failures.length,
      ready: prepared.filter((entry) => entry.result.status === "ready").length,
      review: prepared.filter((entry) => entry.result.status === "review").length
    },
    duplicatedReferences,
    missingReferences,
    products: read.products,
    prepared,
    failures: read.failures
  };
  const directory = join("storage", "diagnostics", "manain");
  await mkdir(directory, { recursive: true });
  const filename = `muestra-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}.json`;
  const path = join(directory, filename);
  await writeFile(path, JSON.stringify(output, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
  console.log(`MANAIN | DIAGNÓSTICO NO PUBLICABLE | ${read.products.length}/${selection.urls.length} fichas | ${read.failures.length} errores`);
  console.log(`LISTADO | ${selection.discovered} URL distintas en ${selection.pagesVisited} páginas | ${selection.endReason} | cobertura no acreditada`);
  for (const product of read.products) {
    console.log(`FICHA | ${product.reference ?? "SIN REFERENCIA"} | ${product.brand ?? ""} ${product.model ?? ""} | ${product.images?.length ?? 0} fotos | ${Object.keys(product.specs ?? {}).length} atributos`);
  }
  console.log(`DIAGNÓSTICO | ${path}`);
  if (read.products.length !== selection.urls.length || duplicatedReferences.length || missingReferences.length) {
    throw new Error("Manain: muestra incompleta o con referencias repetidas/ausentes; consulta el diagnóstico");
  }
};

run().catch((error: unknown) => {
  console.error(`FAIL | MANAIN DIAGNÓSTICO | ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

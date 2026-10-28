import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { discoverManainSaleCatalog } from "../scraping/providers/manain/browser.js";
import { buildManainCensus } from "../scraping/providers/manain/census.js";
import { manainProvider } from "../scraping/providers/manain/adapter.js";

const run = async (): Promise<void> => {
  if (process.argv.length !== 2) throw new Error("El censo de Manain no admite argumentos");
  const category = manainProvider.categories[0];
  if (!category) throw new Error("Manain: falta la categoría de venta");
  const listing = await discoverManainSaleCatalog(category.url, manainProvider.defaultOptions,
    (pages, found) => console.log(`MANAIN | CENSO | ${pages} páginas | ${found} URL distintas`));
  const census = buildManainCensus(listing);
  const directory = join("storage", "diagnostics", "manain");
  await mkdir(directory, { recursive: true });
  const filename = `censo-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}.json`;
  const path = join(directory, filename);
  await writeFile(path, JSON.stringify(census, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
  console.log(`MANAIN | CENSO NO PUBLICABLE | ${census.urlCount} URL | ${census.pagesVisited} páginas | ${census.endReason}`);
  console.log(`DIAGNÓSTICO | ${path}`);
  if (!census.complete) throw new Error("Manain: cobertura sin acreditar; el censo parcial se conserva para diagnóstico");
};

run().catch((error: unknown) => {
  console.error(`FAIL | MANAIN CENSO | ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

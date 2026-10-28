import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { discoverManainSaleCatalog } from "../../../../scraping/providers/manain/browser.js";
import { buildManainCensus } from "../../../../scraping/providers/manain/census.js";
import { manainProvider } from "../../../../scraping/providers/manain/adapter.js";

const run = async (): Promise<void> => {
  if (process.argv.length !== 2) throw new Error("El censo de Manain no admite argumentos");
  const category = manainProvider.categories[0];
  if (!category) throw new Error("Manain: falta la categoría de venta");
  const interactive = process.stdout.isTTY === true && process.env.CI !== "true" && process.env.TERM !== "dumb";
  const frames = ["|", "/", "-", "\\"];
  let frame = 0;
  let pages = 0;
  let found = 0;
  const clearLine = (): void => {
    if (interactive) process.stdout.write("\r\x1b[2K");
  };
  const render = (): void => {
    if (!interactive) return;
    const status = pages ? `${pages} páginas | ${found} URL distintas` : "Conectando con el catálogo";
    process.stdout.write(`\r\x1b[2KMANAIN | CENSO ${frames[frame % frames.length]} | ${status}`);
    frame += 1;
  };
  if (!interactive) console.log("MANAIN | CENSO | Conectando con el catálogo...");
  else render();
  const timer = interactive ? setInterval(render, 250) : null;
  const listing = await discoverManainSaleCatalog(category.url, manainProvider.defaultOptions, (visited, count) => {
    if (visited === pages && count === found) return;
    pages = visited;
    found = count;
    if (interactive) render();
    else console.log(`MANAIN | CENSO | ${pages} páginas | ${found} URL distintas`);
  }).finally(() => {
    if (timer) clearInterval(timer);
    clearLine();
  });
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

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCanonicalCatalog, parseCanonicalManifest } from "../catalog/canonical-catalog.js";
import { buildReviewCensus } from "../catalog/diagnostics/review-census.js";
import type { ReviewCensusEntry } from "../catalog/diagnostics/review-census.js";
import { printCommandError } from "../cli/reporting/errors.js";
import { atomicWrite } from "../infrastructure/filesystem/atomic-write.js";
import { readOfflinePreparation } from "../infrastructure/filesystem/preparation/offline-preparation.js";

const sha256 = (content: string): string => createHash("sha256").update(content).digest("hex");
const quote = (value: string): string => `"${value.replaceAll('"', '""')}"`;
const csv = (cells: readonly string[]): string => cells.map(quote).join(";");

export const formatReviewCensus = (entries: readonly ReviewCensusEntry[]): string => [
  csv(["proveedor", "referencia", "identidad", "titulo_origen", "clave_categoria_origen", "categoria_origen",
    "condicion_origen", "condicion_preparada", "categoria_receptor", "numero_motivos", "motivos", "codigos",
    "clasificaciones", "senales_fuente", "url_origen"]),
  ...entries.map(({ identity, source, prepared, issues }) => csv([
    source.providerId, prepared.product.reference ?? "", identity, source.title ?? "", source.categoryKey,
    source.categoryName, source.condition ?? "", prepared.product.condition ?? "", prepared.product.category ?? "",
    String(issues.length), issues.map((item) => item.message).join(" | "), issues.map((item) => item.code).join(" | "),
    issues.map((item) => item.classification).join(" | "), issues.map((item) => item.signal).join(" | "), source.url
  ]))
].join("\n") + "\n";

export const runReviewCensus = async (args: readonly string[]): Promise<void> => {
  if (args.length < 3 || args.length % 2 !== 1) {
    throw new Error("Uso: node dist/tools/review-census.js <salida.csv> <catalogo.json> <preparacion.json> [<catalogo.json> <preparacion.json> ...]");
  }
  const entries: ReviewCensusEntry[] = [];
  const providers = new Set<string>();
  let totalProducts = 0;
  for (let index = 1; index < args.length; index += 2) {
    const catalogPath = resolve(args[index] ?? "");
    const preparationPath = resolve(args[index + 1] ?? "");
    const filename = basename(catalogPath);
    if (!filename.endsWith("-catalog.json")) throw new Error("Se requiere un archivo -catalog.json");
    const prefix = filename.slice(0, -"-catalog.json".length);
    const catalogText = await readFile(catalogPath, "utf8");
    const manifestText = await readFile(join(dirname(catalogPath), `${prefix}-catalog.manifest.json`), "utf8");
    const catalogInput: unknown = JSON.parse(catalogText);
    const manifestInput: unknown = JSON.parse(manifestText);
    const catalog = parseCanonicalCatalog(catalogInput);
    const manifest = parseCanonicalManifest(manifestInput);
    const hash = sha256(catalogText);
    if (catalog.prefix !== prefix || manifest.prefix !== prefix || manifest.providerId !== catalog.providerId ||
      manifest.scope !== catalog.scope || manifest.productCount !== catalog.productCount ||
      manifest.startedAt !== catalog.startedAt || manifest.endedAt !== catalog.endedAt || manifest.catalogSha256 !== hash) {
      throw new Error("Censo: manifest de catálogo no corresponde al origen seleccionado");
    }
    if (providers.has(catalog.providerId)) throw new Error(`Censo: proveedor duplicado: ${catalog.providerId}`);
    const preparation = await readOfflinePreparation(preparationPath, catalog.providerId);
    if (preparation.source.catalogSha256 !== hash) {
      throw new Error(`Censo: preparación y catálogo tienen SHA-256 distintos: ${catalog.providerId}`);
    }
    providers.add(catalog.providerId);
    totalProducts += catalog.productCount;
    entries.push(...buildReviewCensus(catalog, preparation));
  }
  await atomicWrite(resolve(args[0] ?? ""), formatReviewCensus(entries));
  console.log(`CENSO | ${totalProducts} máquinas | ${entries.length} review | ${totalProducts - entries.length} ready | ${providers.size} proveedores`);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runReviewCensus(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("review-census", error);
    process.exitCode = 1;
  });
}

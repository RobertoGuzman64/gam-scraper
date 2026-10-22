import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { parseCanonicalCatalog, parseCanonicalManifest } from "../../catalog/canonical-catalog.js";
import type { CanonicalCatalog, CanonicalCatalogManifest } from "../../catalog/canonical-catalog.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import { atomicWrite } from "./atomic-write.js";

type JsonRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const digest = (content: string): string => createHash("sha256").update(content).digest("hex");

const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8"));

const readActiveSummary = async (dir: string, prefix: string): Promise<unknown> => {
  try {
    const active = await readJson(join(dir, ".history", prefix, "active.json"));
    if (!isRecord(active) || active.version !== 1 || !isRecord(active.summary)) {
      throw new Error("Metadatos activos del catálogo inválidos");
    }
    return active.summary;
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return readJson(join(dir, `${prefix}-summary.json`));
    throw error;
  }
};

export const writeCanonicalCatalog = async (
  outDir: string,
  prefix: string,
  scope: string,
  startedAt: string,
  endedAt: string,
  products: readonly ProductRecord[]
): Promise<string> => {
  const providerId = products[0]?.providerId;
  if (!providerId) throw new Error("No se puede publicar un catálogo canónico vacío");
  const catalog = parseCanonicalCatalog({
    version: 1, providerId, prefix, scope, startedAt, endedAt,
    quality: { status: "complete", published: true },
    productCount: products.length, products
  });
  const content = JSON.stringify(catalog, null, 2);
  const catalogSha256 = digest(content);
  const manifest: CanonicalCatalogManifest = {
    version: 1, providerId, prefix, scope, startedAt, endedAt,
    productCount: products.length, catalogSha256
  };
  await atomicWrite(resolve(outDir, `${prefix}-catalog.json`), content);
  await atomicWrite(resolve(outDir, `${prefix}-catalog.manifest.json`), JSON.stringify(manifest, null, 2));
  return catalogSha256;
};

export const readCanonicalCatalog = async (file: string): Promise<CanonicalCatalog> => {
  const path = resolve(file);
  const name = basename(path);
  if (!name.endsWith("-catalog.json") || name.length <= "-catalog.json".length) {
    throw new Error("La fuente debe ser un fichero -catalog.json");
  }
  const prefix = name.slice(0, -"-catalog.json".length);
  const dir = dirname(path);
  const [raw, rawManifest, summary] = await Promise.all([
    readFile(path, "utf8"),
    readJson(join(dir, `${prefix}-catalog.manifest.json`)),
    readActiveSummary(dir, prefix)
  ]);
  const catalog = parseCanonicalCatalog(JSON.parse(raw) as unknown);
  const manifest = parseCanonicalManifest(rawManifest);
  const hash = digest(raw);
  if (catalog.prefix !== prefix || manifest.prefix !== prefix ||
    manifest.providerId !== catalog.providerId || manifest.scope !== catalog.scope ||
    manifest.productCount !== catalog.productCount || manifest.startedAt !== catalog.startedAt ||
    manifest.endedAt !== catalog.endedAt || manifest.catalogSha256 !== hash) {
    throw new Error("El catálogo y su manifest pertenecen a ejecuciones distintas o están dañados");
  }
  if (!isRecord(summary) || !isRecord(summary.quality) || summary.quality.status !== "complete" ||
    summary.quality.published !== true || !isRecord(summary.totals) ||
    summary.totals.scrapedProducts !== catalog.productCount ||
    summary.startedAt !== catalog.startedAt || summary.endedAt !== catalog.endedAt ||
    !isRecord(summary.artifacts) || summary.artifacts.catalogSha256 !== hash) {
    throw new Error("El catálogo no coincide con la publicación completa acreditada");
  }
  return catalog;
};

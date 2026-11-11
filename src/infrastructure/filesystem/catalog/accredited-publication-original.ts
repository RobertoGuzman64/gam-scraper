import { createHash } from "node:crypto";
import type { Dirent } from "node:fs";
import { lstat, readFile, readdir } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { buildProductIdentity } from "../../../catalog/identity.js";
import type { CanonicalCatalog } from "../../../catalog/canonical-catalog.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ImportCandidate } from "../../../commercial/legacy-export/contracts.js";
import { originalSources } from "./original-catalog-sources.js";
import { readCanonicalCatalog } from "./canonical-catalog.js";
import { readPortableCampaign } from "./portable-campaign.js";
import { readPortableOriginalArtifacts } from "./portable-original.js";

const sha256 = (raw: string): string => createHash("sha256").update(raw).digest("hex");
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isMissing = (error: unknown): boolean => error instanceof Error && "code" in error && error.code === "ENOENT";

const regularFile = async (path: string): Promise<string> => {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Original acreditado: archivo no regular (${path})`);
  return readFile(path, "utf8");
};

const matchingCatalog = async (
  path: string, providerId: string, expectedSha: string, prefix: string, scope: string | null, count: number
): Promise<CanonicalCatalog | null> => {
  let raw: string;
  try { raw = await regularFile(path); }
  catch (error) { if (isMissing(error)) return null; throw error; }
  if (sha256(raw) !== expectedSha) return null;
  for (const suffix of ["-catalog.manifest.json", "-summary.json"]) {
    await regularFile(join(dirname(path), `${prefix}${suffix}`));
  }
  const catalog = await readCanonicalCatalog(path);
  if (catalog.providerId !== providerId || catalog.prefix !== prefix || (scope !== null && catalog.scope !== scope) ||
    catalog.productCount !== count) {
    throw new Error(`Original acreditado incoherente para ${providerId}`);
  }
  return catalog;
};

const mapCatalog = (catalog: CanonicalCatalog): Map<string, ProductRecord> => {
  const products = new Map<string, ProductRecord>();
  for (const product of catalog.products) {
    const key = buildProductIdentity(product).key;
    if (products.has(key)) throw new Error(`Identidad duplicada en original acreditado: ${key}`);
    products.set(key, product);
  }
  return products;
};

export const accreditedPublicationOriginalSources = async (
  rootDirectory: string, publicationFile: string, providerId: string
): Promise<Map<string, ProductRecord>> => {
  const root = resolve(rootDirectory);
  const publication = resolve(publicationFile);
  if (basename(publication) === "publishable.json") {
    const runId = basename(dirname(dirname(publication)));
    const manifest = await readPortableCampaign(root, runId);
    const item = Object.keys(manifest.files).find((name) => name.startsWith(`${providerId}/`) && name.endsWith("-catalog.json"));
    if (!item) throw new Error(`Campaña acreditada sin original de ${providerId}`);
    const catalog = await readCanonicalCatalog(join(root, "catalogs", "campaigns", runId, item));
    if (catalog.providerId !== providerId) throw new Error(`Original de campaña incompatible con ${providerId}`);
    return mapCatalog(catalog);
  }
  const manifestPath = join(dirname(publication), "manifest.json");
  const metadata: unknown = JSON.parse(await regularFile(manifestPath));
  if (!isRecord(metadata) || metadata.version !== 1 || metadata.providerId !== providerId ||
    !isRecord(metadata.source) || metadata.source.providerId !== providerId ||
    (metadata.source.prefix !== undefined && (typeof metadata.source.prefix !== "string" ||
      !/^[a-zA-Z0-9_-]+$/.test(metadata.source.prefix))) ||
    (metadata.source.scope !== undefined && (typeof metadata.source.scope !== "string" ||
      !/^[a-f0-9]{16}$/.test(metadata.source.scope))) ||
    typeof metadata.source.catalogSha256 !== "string" || !/^[a-f0-9]{64}$/.test(metadata.source.catalogSha256) ||
    typeof metadata.source.productCount !== "number" || !Number.isSafeInteger(metadata.source.productCount) ||
    metadata.source.productCount < 1) {
    throw new Error(`Publicación comercial sin procedencia canónica válida: ${providerId}`);
  }
  const { catalogSha256, productCount } = metadata.source;
  const currentArtifacts = await readPortableOriginalArtifacts(root, providerId);
  const prefix = metadata.source.prefix ?? currentArtifacts.catalog.prefix;
  const scope = metadata.source.scope ?? null;
  if (prefix !== currentArtifacts.catalog.prefix) {
    throw new Error(`Prefijo canónico de ${providerId} distinto del acreditado`);
  }
  const current = join(root, "catalogs", "providers", providerId, "original", `${prefix}-catalog.json`);
  const active = await matchingCatalog(current, providerId, catalogSha256, prefix, scope, productCount);
  if (active) return mapCatalog(active);
  const archiveRoot = join(root, "storage", "scraped", providerId, ".history", prefix);
  let archives: Dirent[];
  try { archives = await readdir(archiveRoot, { withFileTypes: true }); }
  catch (error) { if (isMissing(error)) archives = []; else throw error; }
  for (const archive of archives) {
    if (!/^archive-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[\da-f-]{36}$/.test(archive.name)) continue;
    if (!archive.isDirectory() || archive.isSymbolicLink()) {
      throw new Error(`Original histórico no regular: ${archive.name}`);
    }
    const candidate = await matchingCatalog(join(archiveRoot, archive.name, `${prefix}-catalog.json`),
      providerId, catalogSha256, prefix, scope, productCount);
    if (candidate) return mapCatalog(candidate);
  }
  throw new Error(`No se conserva el original acreditado de ${providerId} (SHA-256 ${catalogSha256}); no se sustituye por el inventario vigente`);
};

export const publicationOriginalSources = async (
  root: string, publicationFile: string, providerId: string, published: readonly ImportCandidate[]
): Promise<Map<string, ProductRecord>> => {
  const current = await originalSources(root, providerId);
  if (current && published.every((product) => current.has(buildProductIdentity({ providerId: product.providerId,
    reference: product.reference, serialNumber: null, url: product.sourceUrl }).key))) return current;
  return accreditedPublicationOriginalSources(root, publicationFile, providerId);
};

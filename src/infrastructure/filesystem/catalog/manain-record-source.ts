import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { join, resolve } from "node:path";
import { buildProductIdentity } from "../../../catalog/identity.js";
import { parseCanonicalProductRecords } from "../../../catalog/canonical-catalog.js";
import { discardedManainProductUrls } from "../../../preparation/manain/discarded-urls.js";
import { readActiveTechnicalPublication } from "./technical-publication.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { TechnicalSnapshot } from "../../../publication/technical-snapshot.js";

export type VerifiedManainRecordSource = {
  readonly recordFile: string;
  readonly recordSha256: string;
  readonly technicalSha256: string;
  readonly originalProducts: readonly ProductRecord[];
  readonly snapshot: TechnicalSnapshot;
};

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const regularDirectory = async (path: string): Promise<void> => {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Directorio de Manain no regular: ${path}`);
};

export const readVerifiedManainRecordSource = async (workspace: string): Promise<VerifiedManainRecordSource> => {
  const root = resolve(workspace);
  const providerDirectory = join(root, "catalogs", "providers", "manain");
  const recordsDirectory = join(providerDirectory, "records");
  const recordFile = join(recordsDirectory, "manain-record.json");
  for (const path of [root, join(root, "catalogs"), join(root, "catalogs", "providers"), providerDirectory, recordsDirectory]) {
    await regularDirectory(path);
  }
  const info = await lstat(recordFile);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Registro Manain no regular: ${recordFile}`);
  const raw = await readFile(recordFile, "utf8");
  const recordSha256 = createHash("sha256").update(raw).digest("hex");
  const source: unknown = JSON.parse(raw);
  const active = await readActiveTechnicalPublication(root, "manain");
  if (!active || !record(source) || Object.keys(source).length !== 7 || source.providerId !== "manain" ||
    !record(source.quality) || source.quality.status !== "partial" || source.quality.published !== false ||
    typeof source.sourceCsvSha256 !== "string" || !/^[a-f0-9]{64}$/.test(source.sourceCsvSha256) ||
    !Number.isSafeInteger(source.discoveredProductUrls) || !Array.isArray(source.discardedUrls) ||
    !Array.isArray(source.products) || source.products.length === 0 ||
    !record(source.totals) || !Number.isSafeInteger(source.totals.ready) ||
    !Number.isSafeInteger(source.totals.review)) {
    throw new Error("Registro parcial Manain o publicación técnica vigente ausentes o inválidos");
  }
  const snapshot = active.snapshot;
  const provenance = snapshot.source;
  if (snapshot.quality !== "partial" || provenance.kind !== "manain-record" ||
    provenance.recordSha256 !== recordSha256 || provenance.sourceCsvSha256 !== source.sourceCsvSha256 ||
    provenance.discoveredProductUrls !== source.discoveredProductUrls ||
    !isDeepStrictEqual(source.discardedUrls, provenance.discardedUrls) ||
    !isDeepStrictEqual(source.discardedUrls, discardedManainProductUrls) ||
    !isDeepStrictEqual(source.totals, snapshot.totals) ||
    source.discoveredProductUrls !== source.products.length + source.discardedUrls.length ||
    source.products.length !== snapshot.products.length) {
    throw new Error("Procedencia parcial de Manain no coincide con su publicación técnica acreditada");
  }
  if (!source.products.every((entry: unknown) => record(entry) && Object.keys(entry).length === 2 &&
    record(entry.original) && record(entry.prepared))) {
    throw new Error("Registro Manain con pares originales y preparados inválidos");
  }
  const originalProducts = parseCanonicalProductRecords(source.products.map((entry: Record<string, unknown>) => entry.original));
  const identities = originalProducts.map((product) => buildProductIdentity(product).key);
  if (originalProducts.some((product, index) => product.providerId !== "manain" ||
    product.url !== snapshot.products[index]?.product.sourceUrl ||
    product.reference !== snapshot.products[index]?.product.reference) ||
    !isDeepStrictEqual(identities, snapshot.identities) ||
    !isDeepStrictEqual(source.products.map((entry: Record<string, unknown>) => entry.prepared), snapshot.products)) {
    throw new Error("Identidades, originales o preparación del registro Manain no conciliados con el corte técnico");
  }
  return { recordFile, recordSha256, technicalSha256: active.sha256, originalProducts, snapshot };
};

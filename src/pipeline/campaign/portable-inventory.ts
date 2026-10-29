import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { CAMPAIGN_PROVIDERS } from "../../contracts/campaign-providers.js";
import { readCanonicalCatalog } from "../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { readPortableCampaign } from "../../infrastructure/filesystem/catalog/portable-campaign.js";
import { readPortableOriginal } from "../../infrastructure/filesystem/catalog/portable-original.js";
import type { InventoryItem } from "./operations-inventory.js";

export type PortableProviderInventory = {
  readonly providerId: string;
  readonly original: InventoryItem;
  readonly consistency: InventoryItem;
  readonly final: InventoryItem;
};

export type PortableCampaignInventory = {
  readonly runId: string;
  readonly status: InventoryItem;
};

export type PortableInventory = {
  readonly providers: readonly PortableProviderInventory[];
  readonly campaigns: readonly PortableCampaignInventory[];
  readonly accreditedCampaigns: number;
  readonly issues: readonly string[];
};

const ok = (detail: string): InventoryItem => ({ state: "correcto", detail });
const partial = (detail: string): InventoryItem => ({ state: "parcial", detail });
const absent = (detail: string): InventoryItem => ({ state: "ausente", detail });
const invalid = (detail: string): InventoryItem => ({ state: "error", detail });
const describe = (error: unknown): string => error instanceof Error ? error.message : String(error);
const missing = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";
const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

const directoryExists = async (path: string): Promise<boolean> => {
  try {
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Directorio no regular: ${path}`);
    return true;
  } catch (error) {
    if (missing(error)) return false;
    throw error;
  }
};

const directoryNames = async (path: string): Promise<readonly string[]> =>
  await directoryExists(path) ? readdir(path) : [];

const checkKnownEntries = async (path: string, allowed: readonly string[], issues: string[]): Promise<void> => {
  for (const name of await directoryNames(path)) {
    if (!allowed.includes(name)) issues.push(`Entrada no reconocida en ${path}: ${name}`);
    else {
      try { await directoryExists(join(path, name)); }
      catch (error) { issues.push(describe(error)); }
    }
  }
};

const inspectProvider = async (root: string, providerId: string): Promise<InventoryItem> => {
  const base = join(root, "catalogs", "providers", providerId);
  if (!await directoryExists(base)) return absent("Sin original definitivo en catalogs/");
  try {
    const names = await readdir(base);
    if (names.length !== 1 || names[0] !== "original") {
      return invalid("Archivos inesperados o promoción pendiente en original portátil");
    }
    const catalog = await readPortableOriginal(root, providerId);
    return ok(`Original portátil íntegro (${catalog.productCount} fichas)`);
  } catch (error) {
    return invalid(`Original portátil no verificable: ${describe(error)}`);
  }
};

const inspectConsistency = async (
  root: string, providerId: string, original: InventoryItem, localCatalogFile: string
): Promise<InventoryItem> => {
  if (original.state === "error") return invalid("No se puede comparar un original portátil inválido");
  if (original.state === "ausente") {
    try {
      await readCanonicalCatalog(localCatalogFile);
      return partial("Original operativo íntegro, pendiente de consolidación en catalogs/");
    } catch (error) {
      if (missing(error)) return absent("Sin originales comparables");
      return absent("Sin original operativo completo comparable");
    }
  }
  try {
    const local = await readCanonicalCatalog(localCatalogFile);
    const portable = await readPortableOriginal(root, providerId);
    const localContent = await readFile(localCatalogFile, "utf8");
    const portableContent = await readFile(join(root, "catalogs", "providers", providerId, "original",
      `${portable.prefix}-catalog.json`), "utf8");
    if (local.providerId !== providerId || portable.providerId !== providerId) {
      return invalid("Original operativo de otro proveedor");
    }
    if (digest(localContent) === digest(portableContent)) return ok("Original operativo y portátil coinciden");
    const localTime = Date.parse(local.endedAt);
    const portableTime = Date.parse(portable.endedAt);
    if (localTime > portableTime) return partial("Original operativo más reciente, pendiente de consolidación");
    if (localTime < portableTime) return partial("Original operativo anterior al conservado en catalogs/");
    return invalid("Originales diferentes con la misma fecha de extracción");
  } catch (error) {
    if (missing(error)) return ok("Original portátil autónomo; no requiere storage/");
    // An incomplete or partial operational extraction must not invalidate a verified portable original.
    return partial(`No se puede cotejar el original operativo: ${describe(error)}`);
  }
};

/** Read-only inventory. Never repairs a pending promotion or modifies source artifacts. */
export const inspectPortableInventory = async (
  rootDirectory: string, localCatalogPaths: Readonly<Record<string, string>>
): Promise<PortableInventory> => {
  const root = resolve(rootDirectory);
  const issues: string[] = [];
  const catalogRoot = join(root, "catalogs");
  let rootAvailable = false;
  try {
    rootAvailable = await directoryExists(catalogRoot);
    if (rootAvailable) {
      await checkKnownEntries(catalogRoot, ["providers", "campaigns"], issues);
      await checkKnownEntries(join(catalogRoot, "providers"), CAMPAIGN_PROVIDERS, issues);
    }
  } catch (error) {
    issues.push(`Raíz de catalogs/ no verificable: ${describe(error)}`);
  }

  const campaigns: PortableCampaignInventory[] = [];
  const verifiedRunIds: string[] = [];
  const verifiedTotals: { readonly runId: string; readonly counts: Readonly<Record<string, number>> }[] = [];
  let corruptedCampaign = false;
  if (rootAvailable) {
    const campaignDir = join(catalogRoot, "campaigns");
    try {
      for (const runId of [...(await directoryNames(campaignDir))].sort()) {
        try {
          const manifest = await readPortableCampaign(root, runId);
          const counts: Record<string, number> = {};
          for (const providerId of CAMPAIGN_PROVIDERS) {
            const products: unknown = JSON.parse(await readFile(join(campaignDir, runId, providerId, "publishable.json"), "utf8"));
            if (!Array.isArray(products)) throw new Error(`JSON final de ${providerId} no es una lista`);
            counts[providerId] = products.length;
          }
          campaigns.push({ runId, status: ok(`Selección y cuatro JSON finales acreditados (${Object.keys(manifest.files).length} archivos)` ) });
          verifiedRunIds.push(runId);
          verifiedTotals.push({ runId, counts });
        } catch (error) {
          corruptedCampaign = true;
          campaigns.push({ runId, status: invalid(`Campaña portátil no verificable: ${describe(error)}`) });
        }
      }
    } catch (error) {
      corruptedCampaign = true;
      issues.push(`Directorio de campañas portátiles no verificable: ${describe(error)}`);
    }
  }
  const retentionExceeded = campaigns.length > 2;
  if (retentionExceeded) issues.push(`Retención de catalogs/ excedida: ${campaigns.length} campañas (máximo 2)`);

  const providers: PortableProviderInventory[] = [];
  for (const providerId of CAMPAIGN_PROVIDERS) {
    let original: InventoryItem;
    try {
      original = await inspectProvider(root, providerId);
    } catch (error) {
      original = invalid(`No se puede leer original portátil: ${describe(error)}`);
    }
    const consistency = await inspectConsistency(root, providerId, original,
      localCatalogPaths[providerId] ?? join(root, "storage", "scraped", providerId, "sin-catalog.json"));
    const final: InventoryItem = corruptedCampaign || issues.some((issue) => issue.includes("campañas portátiles no verificable"))
      ? invalid("Hay campañas portátiles no verificables; no se acredita el conjunto de JSON finales")
      : retentionExceeded ? invalid("Retención de campañas portátiles excedida")
        : verifiedRunIds.length
          ? ok(`JSON final acreditado: ${verifiedTotals.map((entry) =>
            `${entry.runId} (${entry.counts[providerId] ?? 0} fichas)`).join(", ")}`)
          : absent("Sin JSON final acreditado en catalogs/");
    const reportedOriginal = original.state === "ausente" && verifiedRunIds.length
      ? ok(`Original acreditado en ${verifiedRunIds.length} campaña(s) portátil(es); sin original individual`)
      : original;
    providers.push({ providerId, original: reportedOriginal, consistency, final });
  }
  return { providers, campaigns, accreditedCampaigns: verifiedRunIds.length, issues };
};

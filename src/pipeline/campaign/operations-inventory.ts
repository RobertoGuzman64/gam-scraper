import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { CAMPAIGN_PROVIDERS } from "../../contracts/campaign-providers.js";
import { readCanonicalCatalog } from "../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { readAccreditedPublication, resolveAccreditedPublication } from "../../infrastructure/filesystem/catalog/accredited-publication.js";
import { readOfflinePreparation } from "../../infrastructure/filesystem/preparation/offline-preparation.js";
import { getProvider } from "../../scraping/registry.js";
import { verifyDeliveredCampaign } from "./delivery/verification.js";
import { listCampaignRuns } from "./discovery/search.js";
import type { CampaignOperationsStatus } from "./operations-status.js";
import { inspectPortableInventory } from "./portable-inventory.js";
import type { PortableCampaignInventory } from "./portable-inventory.js";

export type InventoryState = "correcto" | "parcial" | "ausente" | "error";

export type InventoryItem = {
  readonly state: InventoryState;
  readonly detail: string;
};

export type ProviderInventory = {
  readonly providerId: string;
  readonly original: InventoryItem;
  readonly portableOriginal: InventoryItem;
  readonly consistency: InventoryItem;
  readonly preparation: InventoryItem;
  readonly final: InventoryItem;
};

export type CampaignInventory = {
  readonly runId: string;
  readonly status: InventoryItem;
};

export type OperationsInventory = {
  readonly essentials: readonly { readonly path: string; readonly status: InventoryItem }[];
  readonly providers: readonly ProviderInventory[];
  readonly campaigns: readonly CampaignInventory[];
  readonly retainedDeliveries: number;
  readonly portableCampaigns: readonly PortableCampaignInventory[];
  readonly portableDeliveries: number;
  readonly portableIssues: readonly string[];
  readonly campaignIssues: readonly string[];
};

const essentialFiles = [
  "README.md",
  "docs/ARCHITECTURE.md",
  "docs/CAMPAIGNS.md",
  "docs/CAMPAIGN_ACCREDITATION.md",
  "docs/CATALOG_CONTENT_GAPS.md",
  "docs/OPERATIONAL_REFERENCE.md",
  "docs/SCRAPER_DATA_RULES.md",
  "docs/VALIDATION.md",
  "data/category/categorySell-flat.json",
  "data/category/categorySell-tree.json",
  "data/import/attributeCatalog.json",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "scripts/tooling.mjs"
] as const;

const missing = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";

const describe = (error: unknown): string => error instanceof Error ? error.message : String(error);
const ok = (detail: string): InventoryItem => ({ state: "correcto", detail });
const partial = (detail: string): InventoryItem => ({ state: "parcial", detail });
const absent = (detail: string): InventoryItem => ({ state: "ausente", detail });
const invalid = (detail: string): InventoryItem => ({ state: "error", detail });

const regularFile = async (path: string): Promise<boolean> => {
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Ruta no es un archivo regular: ${path}`);
    if (info.size === 0) throw new Error(`Archivo vacío: ${path}`);
    return true;
  } catch (error) {
    if (missing(error)) return false;
    throw error;
  }
};

const inspectEssential = async (root: string, path: string): Promise<{ path: string; status: InventoryItem }> => {
  try {
    if (!await regularFile(join(root, path))) return { path, status: invalid("Falta un archivo esencial") };
    if (path.endsWith(".json")) JSON.parse(await readFile(join(root, path), "utf8"));
    return { path, status: ok("Archivo presente y legible") };
  } catch (error) {
    return { path, status: invalid(describe(error)) };
  }
};

const inspectIndividualFinal = async (root: string, providerId: string): Promise<InventoryItem> => {
  try {
    const path = await resolveAccreditedPublication(root, providerId);
    if (!path) return absent("Sin publicación individual acreditada");
    const publication = await readAccreditedPublication(path);
    return ok(`Publicación vigente: ${publication.products.length} fichas | ${publication.runId} | ${basename(path) === "publishable.json" ? "campaña" : `aprobación ${basename(dirname(path))}`}`);
  } catch (error) {
    return invalid(`Publicación individual no verificable: ${describe(error)}`);
  }
};

const inspectPartialOriginal = async (dir: string, prefix: string): Promise<InventoryItem> => {
  const file = join(dir, `${prefix}-partial-all.csv`);
  if (!await regularFile(file)) {
    return await regularFile(join(dir, `${prefix}-all.csv`))
      ? partial("CSV disponible sin original canónico acreditado")
      : absent("Sin extracción conservada");
  }
  const summaryPath = join(dir, `${prefix}-summary.json`);
  if (!await regularFile(summaryPath)) return partial("CSV parcial sin resumen verificable");
  const summary: unknown = JSON.parse(await readFile(summaryPath, "utf8"));
  if (typeof summary !== "object" || summary === null || !("quality" in summary) ||
    typeof summary.quality !== "object" || summary.quality === null ||
    !("published" in summary.quality) || summary.quality.published !== false ||
    !("artifacts" in summary) || typeof summary.artifacts !== "object" || summary.artifacts === null ||
    !("csvSha256" in summary.artifacts) || typeof summary.artifacts.csvSha256 !== "string") {
    return invalid("Resumen de extracción parcial incoherente");
  }
  const hash = createHash("sha256").update(await readFile(file)).digest("hex");
  return summary.artifacts.csvSha256 === hash
    ? partial("Extracción parcial conservada; CSV coincide con el resumen")
    : invalid("El CSV parcial no coincide con su resumen");
};

const inspectOriginal = async (dir: string, prefix: string, providerId: string): Promise<InventoryItem> => {
  try {
    const path = join(dir, `${prefix}-catalog.json`);
    if (!await regularFile(path)) return await inspectPartialOriginal(dir, prefix);
    const catalog = await readCanonicalCatalog(path);
    if (catalog.providerId !== providerId) return invalid("El original corresponde a otro proveedor");
    const partialFile = join(dir, `${prefix}-partial-all.csv`);
    return await regularFile(partialFile)
      ? partial(`Canónico íntegro (${catalog.productCount} fichas); también existe CSV parcial`)
      : ok(`Canónico íntegro (${catalog.productCount} fichas)`);
  } catch (error) {
    return invalid(describe(error));
  }
};

const inspectPreparation = async (
  root: string, dir: string, prefix: string, providerId: string, original: InventoryItem
): Promise<InventoryItem> => {
  const canonicalPath = join(root, "storage", "prepared", providerId, `${prefix}-preparation.json`);
  try {
    if (await regularFile(canonicalPath)) {
      const preparation = await readOfflinePreparation(canonicalPath, providerId);
      const originalFile = join(dir, `${prefix}-catalog.json`);
      if (!await regularFile(originalFile)) return partial("Preparación acreditada, pero sin original vigente");
      const digest = createHash("sha256").update(await readFile(originalFile)).digest("hex");
      if (preparation.source.catalogSha256 !== digest) return invalid("La preparación no corresponde al original vigente");
      return ok(`Preparación acreditada (${preparation.totals.ready} Ready / ${preparation.totals.review} Review)`);
    }
    const legacy = join(dir, `${prefix}-${original.state === "parcial" ? "partial-" : ""}preparation.json`);
    if (await regularFile(legacy)) return partial("Preparación heredada disponible; no acreditada como preparación offline");
    return absent("Sin preparación conservada");
  } catch (error) {
    return invalid(describe(error));
  }
};

export const inspectOperationsInventory = async (
  rootDirectory: string, status: CampaignOperationsStatus, desktopDirectory?: string
): Promise<OperationsInventory> => {
  const root = resolve(rootDirectory);
  const essentials = await Promise.all(essentialFiles.map((path) => inspectEssential(root, path)));
  const campaigns: CampaignInventory[] = [];
  const campaignIssues: string[] = [];
  const delivered = new Map<string, string>();
  let retainedDeliveries = 0;
  try {
    for (const { report } of await listCampaignRuns(root)) {
      const receipt = join(root, "storage", "campaigns", report.runId, "delivery.json");
      const hasReceipt = await regularFile(receipt);
      const independentBatch = report.providers.length > 0 && report.providers.every((provider) =>
        resolve(root, provider.outputDir) === join(root, "storage", "scraped", provider.providerId));
      if (independentBatch && !hasReceipt) continue;
      if (!hasReceipt) {
        campaigns.push({ runId: report.runId, status: partial(`Lote ${report.status}; sin entrega acreditada`) });
        continue;
      }
      try {
        const verified = await verifyDeliveredCampaign(root, desktopDirectory, report.runId);
        retainedDeliveries += 1;
        for (const providerId of report.requestedProviders) {
          if (!delivered.has(providerId)) delivered.set(providerId, report.runId);
        }
        campaigns.push({ runId: report.runId, status: verified.zipStatus === "verified"
          ? ok("Entrega y ZIP acreditados") : partial("Selección local acreditada; ZIP externo ausente") });
      } catch (error) {
        campaigns.push({ runId: report.runId, status: invalid(`Entrega no verificable: ${describe(error)}`) });
      }
    }
  } catch (error) {
    campaignIssues.push(`Historial de campañas no verificable: ${describe(error)}`);
  }
  if (retainedDeliveries > 2) campaignIssues.push(`Retención excedida: ${retainedDeliveries} entregas acreditadas (máximo 2)`);
  const portable = await inspectPortableInventory(root, Object.fromEntries(CAMPAIGN_PROVIDERS.map((providerId) => {
    const prefix = getProvider(providerId).defaultOptions.outPrefix;
    return [providerId, join(root, "storage", "scraped", providerId, `${prefix}-catalog.json`)];
  })));
  const providers = await Promise.all(CAMPAIGN_PROVIDERS.map(async (providerId): Promise<ProviderInventory> => {
    const prefix = getProvider(providerId).defaultOptions.outPrefix;
    const dir = join(root, "storage", "scraped", providerId);
    const fromCampaign = status.campaign.providers.find((entry) => entry.providerId === providerId);
    const localOriginal = await inspectOriginal(dir, prefix, providerId);
    const original = fromCampaign?.catalog && localOriginal.state === "ausente"
      ? ok("Original acreditado en campaña activa") : localOriginal;
    const localPreparation = await inspectPreparation(root, dir, prefix, providerId, localOriginal);
    const preparation = fromCampaign?.preparation && localPreparation.state === "ausente"
      ? ok("Preparación acreditada en campaña activa") : localPreparation;
    const portableProvider = portable.providers.find((entry) => entry.providerId === providerId);
    if (!portableProvider) throw new Error(`Proveedor no inventariado en catalogs/: ${providerId}`);
    const individualFinal = await inspectIndividualFinal(root, providerId);
    return {
      providerId,
      original,
      portableOriginal: portableProvider.original,
      consistency: portableProvider.consistency,
      preparation,
      final: portableProvider.final.state !== "ausente" ? portableProvider.final : individualFinal.state !== "ausente"
        ? individualFinal : delivered.has(providerId)
          ? partial(`JSON final acreditado solo en storage/ (${delivered.get(providerId)}); falta catalogs/`)
          : absent("Sin JSON final acreditado")
    };
  }));
  for (const runId of new Set(delivered.values())) {
    if (!portable.campaigns.some((campaign) => campaign.runId === runId && campaign.status.state === "correcto")) {
      campaignIssues.push(`Entrega local ${runId} aún no acreditada en catalogs/`);
    }
  }
  return {
    essentials, providers, campaigns, retainedDeliveries, campaignIssues,
    portableCampaigns: portable.campaigns,
    portableDeliveries: portable.accreditedCampaigns,
    portableIssues: portable.issues
  };
};

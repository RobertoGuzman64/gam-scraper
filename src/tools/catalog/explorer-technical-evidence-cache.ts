import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PanelSnapshot, PanelProviderId } from "../../panel/evidence/types.js";
import type { PanelSpecAddition, PanelFieldProvenance } from "../../panel/explorer/types.js";

export type ExplorerTechnicalEvidenceCache = {
  readonly version: 1;
  readonly knowledgeSha256: string | null;
  readonly providers: readonly {
    readonly providerId: PanelProviderId;
    readonly publicationSha256: string;
    readonly originalSha256: string | null;
    readonly products: readonly {
      readonly identity: string;
      readonly additions: readonly PanelSpecAddition[];
      readonly provenance: readonly PanelFieldProvenance[];
    }[];
  }[];
};

export const explorerTechnicalEvidenceCachePath = (root: string): string =>
  join(root, "catalogs", "reports", "explorer-technical-evidence.json");

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isAddition = (value: unknown): value is PanelSpecAddition =>
  record(value) && typeof value.field === "string" && typeof value.value === "string" &&
  (value.kind === "own" || value.kind === "reused" || value.kind === "pending");

const isProvenance = (value: unknown): value is PanelFieldProvenance =>
  record(value) && typeof value.field === "string" &&
  (value.group === "content" || value.group === "technical" || value.group === "commercial") &&
  (value.status === "source-compatible" || value.status === "mechanism-compatible" || value.status === "observed-only") &&
  typeof value.publicationSha256 === "string" && typeof value.originalSha256 !== "undefined" &&
  (value.historicalApplication === "demonstrated" || value.historicalApplication === "not-demonstrated");

export const readExplorerTechnicalEvidence = async (
  root: string, snapshot: PanelSnapshot, knowledgeSha256: string | null
): Promise<ReadonlyMap<PanelProviderId, ReadonlyMap<string, { readonly additions: readonly PanelSpecAddition[]; readonly provenance: readonly PanelFieldProvenance[] }>>> => {
  const source: unknown = JSON.parse(await readFile(explorerTechnicalEvidenceCachePath(root), "utf8"));
  if (!record(source) || source.version !== 1 || !Array.isArray(source.providers) ||
    source.providers.length !== snapshot.providers.length || source.knowledgeSha256 !== knowledgeSha256) {
    throw new Error("Clasificaciones técnicas precalculadas ausentes o incompatibles con el corte");
  }
  const result = new Map<PanelProviderId, ReadonlyMap<string, { readonly additions: readonly PanelSpecAddition[]; readonly provenance: readonly PanelFieldProvenance[] }>>();
  for (const entry of source.providers) {
    if (!record(entry)) throw new Error("Clasificaciones técnicas precalculadas inválidas");
    const provider = snapshot.providers.find((item) => item.providerId === entry.providerId);
    if (!provider || result.has(provider.providerId) || entry.publicationSha256 !== provider.publication.sha256 ||
      (provider.original.status === "verified" ? entry.originalSha256 !== provider.original.artifact.sha256 :
        entry.originalSha256 !== null && entry.originalSha256 !== provider.original.expectedSha256) ||
      !Array.isArray(entry.products)) {
      throw new Error("Clasificaciones técnicas precalculadas no corresponden al corte acreditado");
    }
    const products = new Map<string, { readonly additions: readonly PanelSpecAddition[]; readonly provenance: readonly PanelFieldProvenance[] }>();
    for (const product of entry.products) {
      if (!record(product) || typeof product.identity !== "string" || products.has(product.identity) ||
        !Array.isArray(product.additions) || !product.additions.every(isAddition) ||
        !Array.isArray(product.provenance) || !product.provenance.every(isProvenance) ||
        new Set(product.additions.map((item: PanelSpecAddition) => item.field)).size !== product.additions.length) {
        throw new Error("Clasificaciones técnicas precalculadas contienen productos inválidos o repetidos");
      }
      products.set(product.identity, provider.original.status === "verified" ? {
        additions: product.additions, provenance: product.provenance
      } : { additions: [], provenance: [] });
    }
    result.set(provider.providerId, products);
  }
  return result;
};

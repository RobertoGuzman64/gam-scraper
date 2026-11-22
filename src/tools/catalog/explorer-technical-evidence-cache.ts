import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PanelSnapshot, PanelProviderId } from "../../panel/evidence/types.js";
import type { PanelSpecAddition } from "../../panel/explorer/types.js";

export type ExplorerTechnicalEvidenceCache = {
  readonly version: 2;
  readonly providers: readonly {
    readonly providerId: PanelProviderId;
    readonly publicationSha256: string;
    readonly originalSha256: string | null;
    readonly products: readonly {
      readonly identity: string;
      readonly additions: readonly PanelSpecAddition[];
    }[];
  }[];
};

export const explorerTechnicalEvidenceCachePath = (root: string): string =>
  join(root, "catalogs", "reports", "revision", "explorer-technical-evidence.json");

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const hasExactFields = (value: Record<string, unknown>, fields: readonly string[]): boolean =>
  Object.keys(value).length === fields.length && fields.every((field) => Object.hasOwn(value, field));

const isAddition = (value: unknown): value is PanelSpecAddition =>
  record(value) && typeof value.field === "string" && typeof value.value === "string" &&
  (value.kind === "own" || value.kind === "reused" || value.kind === "pending") &&
  hasExactFields(value, value.kind === "reused" ? ["field", "value", "kind", "linkedMachines"] :
    ["field", "value", "kind"]) &&
  (value.kind === "reused" ? Array.isArray(value.linkedMachines) &&
    value.linkedMachines.length > 0 && value.linkedMachines.every((identity: unknown) =>
      typeof identity === "string" && identity.length > 0) &&
    new Set(value.linkedMachines).size === value.linkedMachines.length : true);

export const readExplorerTechnicalEvidence = async (
  root: string, snapshot: PanelSnapshot
): Promise<ReadonlyMap<PanelProviderId, ReadonlyMap<string, readonly PanelSpecAddition[]>>> => {
  const source: unknown = JSON.parse(await readFile(explorerTechnicalEvidenceCachePath(root), "utf8"));
  if (!record(source) || source.version !== 2 || !Array.isArray(source.providers) ||
    source.providers.length !== snapshot.providers.length ||
    !hasExactFields(source, ["version", "providers"])) {
    throw new Error("Clasificaciones técnicas precalculadas ausentes o incompatibles con el corte");
  }
  const result = new Map<PanelProviderId, ReadonlyMap<string, readonly PanelSpecAddition[]>>();
  for (const entry of source.providers) {
    if (!record(entry) || !hasExactFields(entry,
      ["providerId", "publicationSha256", "originalSha256", "products"])) {
      throw new Error("Clasificaciones técnicas precalculadas inválidas");
    }
    const provider = snapshot.providers.find((item) => item.providerId === entry.providerId);
    if (!provider || result.has(provider.providerId) || entry.publicationSha256 !== provider.publication.sha256 ||
      (provider.original.status === "verified" ? entry.originalSha256 !== provider.original.artifact.sha256 :
        entry.originalSha256 !== null && entry.originalSha256 !== provider.original.expectedSha256) ||
      !Array.isArray(entry.products)) {
      throw new Error("Clasificaciones técnicas precalculadas no corresponden al corte acreditado");
    }
    const products = new Map<string, readonly PanelSpecAddition[]>();
    for (const product of entry.products) {
      if (!record(product) || !hasExactFields(product, ["identity", "additions"]) ||
        typeof product.identity !== "string" || products.has(product.identity) ||
        !Array.isArray(product.additions) || !product.additions.every(isAddition) ||
        new Set(product.additions.map((item: PanelSpecAddition) => item.field)).size !== product.additions.length) {
        throw new Error("Clasificaciones técnicas precalculadas contienen productos inválidos o repetidos");
      }
      products.set(product.identity, provider.original.status === "verified" ? product.additions : []);
    }
    result.set(provider.providerId, products);
  }
  const classified = new Map<string, readonly PanelSpecAddition[]>();
  for (const products of result.values()) {
    for (const [identity, product] of products) {
      if (classified.has(identity)) throw new Error(`Identidad técnica repetida entre proveedores: ${identity}`);
      classified.set(identity, product);
    }
  }
  for (const [identity, additions] of classified) {
    for (const addition of additions) {
      if (addition.kind !== "reused") continue;
      if (addition.linkedMachines?.includes(identity) || !addition.linkedMachines?.every((linked) =>
        classified.get(linked)?.some((peer) => peer.field === addition.field && peer.value === addition.value &&
          peer.kind === "reused" && peer.linkedMachines?.includes(identity)))) {
        throw new Error(`Reutilización técnica sin vínculo editorial recíproco: ${identity}:${addition.field}`);
      }
    }
  }
  return result;
};

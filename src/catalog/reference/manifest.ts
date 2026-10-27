import { isReferenceProviderSet } from "../../contracts/campaign-providers.js";

export type ReferenceCatalogManifest = {
  readonly providerId: string;
  readonly prefix: string;
  readonly scope: string;
  readonly productCount: number;
  readonly sha256: string;
};

export type ReferenceManifest = {
  readonly version: 1;
  readonly runId: string;
  readonly createdAt: string;
  readonly catalogs: readonly ReferenceCatalogManifest[];
  readonly differencesSha256: string;
};

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const sha = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

export const parseReferenceManifest = (value: unknown): ReferenceManifest => {
  if (!record(value) || value.version !== 1 || typeof value.runId !== "string" || !value.runId.trim() ||
    typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt)) ||
    !sha(value.differencesSha256) || !Array.isArray(value.catalogs) ||
    !isReferenceProviderSet(value.catalogs.map((entry: unknown) => record(entry) && typeof entry.providerId === "string" ? entry.providerId : ""))) {
    throw new Error("Manifiesto de referencia inválido");
  }
  const catalogs: ReferenceCatalogManifest[] = [];
  for (const entry of value.catalogs) {
    if (!record(entry) || typeof entry.providerId !== "string" ||
      typeof entry.prefix !== "string" || !/^[a-zA-Z0-9_-]+$/.test(entry.prefix) ||
      typeof entry.scope !== "string" || !/^[a-f0-9]{16}$/.test(entry.scope) ||
      typeof entry.productCount !== "number" || !Number.isSafeInteger(entry.productCount) || entry.productCount < 1 ||
      !sha(entry.sha256)) throw new Error("Manifiesto de referencia con catálogo inválido");
    catalogs.push({ providerId: entry.providerId, prefix: entry.prefix, scope: entry.scope,
      productCount: entry.productCount, sha256: entry.sha256 });
  }
  if (!isReferenceProviderSet(catalogs.map((entry) => entry.providerId))) {
    throw new Error("Manifiesto de referencia con proveedores incompletos o duplicados");
  }
  return { version: 1, runId: value.runId, createdAt: value.createdAt, catalogs, differencesSha256: value.differencesSha256 };
};

import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildProductIdentity } from "../../catalog/identity.js";
import { prepareImportBatch } from "../../catalog/import/preparation/prepare.js";
import { readCanonicalCatalog } from "../../infrastructure/filesystem/canonical-catalog.js";
import { readAppliedIntervention } from "../../infrastructure/filesystem/intervention-derived.js";
import { readOfflinePreparation } from "../../infrastructure/filesystem/offline-preparation.js";
import { loadPreparationInputs } from "../../infrastructure/filesystem/preparation-inputs.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import type { OfflinePreparation } from "../../catalog/import/preparation/offline-document.js";
import type { ImportCatalog } from "../../catalog/import/preparation/contracts.js";

export type CatalogValidation = {
  readonly providerId: string;
  readonly sourceFile: string;
  readonly productCount: number;
  readonly endedAt: string;
  readonly catalogSha256: string;
};

export type OfflineValidation = {
  readonly catalog: CatalogValidation;
  readonly preparationFile: string;
  readonly ready: number;
  readonly review: number;
  readonly importReady: number | null;
  readonly importBlocked: number | null;
  readonly preparation: OfflinePreparation;
  readonly target: ImportCatalog | null;
  readonly sourceProducts: readonly ProductRecord[];
};

const sha = (value: string): string => createHash("sha256").update(value).digest("hex");

export const validateCanonicalSource = async (sourceFile: string, providerId: string): Promise<CatalogValidation> => {
  const path = resolve(sourceFile);
  const catalog = await readCanonicalCatalog(path);
  if (catalog.providerId !== providerId) throw new Error("El catálogo canónico pertenece a otro proveedor");
  return {
    providerId, sourceFile: path, productCount: catalog.productCount,
    endedAt: catalog.endedAt, catalogSha256: sha(await readFile(path, "utf8"))
  };
};

export const validateOfflinePreparation = async (
  providerId: string, preparationFile: string, sourceFile: string, maxAgeHours: number | null = null,
  originalSource?: string
): Promise<OfflineValidation> => {
  const path = resolve(sourceFile);
  const derived = originalSource === undefined ? null : await readAppliedIntervention(path, originalSource);
  const canonical = derived?.catalog ?? await readCanonicalCatalog(path);
  if (canonical.providerId !== providerId) throw new Error("La preparación y el catálogo pertenecen a proveedores distintos");
  const [preparation, inputs] = await Promise.all([
    readOfflinePreparation(resolve(preparationFile), providerId), loadPreparationInputs()
  ]);
  const sourceHash = derived?.catalogSha256 ?? sha(await readFile(path, "utf8"));
  if (!isDeepStrictEqual(preparation.source.intervention, derived?.provenance)) {
    throw new Error("La procedencia de la preparación no coincide con la intervención verificada");
  }
  if (preparation.source.prefix !== canonical.prefix || preparation.source.scope !== canonical.scope ||
    preparation.source.catalogSha256 !== sourceHash || preparation.source.productCount !== canonical.productCount) {
    throw new Error("La preparación offline no corresponde exactamente al catálogo canónico seleccionado");
  }
  if (!isDeepStrictEqual(preparation.fingerprints, inputs.fingerprints)) {
    throw new Error("La preparación está obsoleta: han cambiado las reglas de calidad del scraper; repetir preparar");
  }
  const expected = prepareImportBatch(canonical.products);
  if (!isDeepStrictEqual(preparation.identities, canonical.products.map((product) => buildProductIdentity(product).key)) ||
    !isDeepStrictEqual(preparation.products, expected.products) ||
    !isDeepStrictEqual(preparation.totals, expected.totals)) {
    throw new Error("La preparación no coincide con los productos y reglas de su catálogo de origen");
  }
  if (maxAgeHours !== null) {
    if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) throw new Error("maxAgeHours debe ser positivo");
    const age = Date.now() - Date.parse(canonical.endedAt);
    if (!Number.isFinite(age) || age < -60_000 || age > maxAgeHours * 3_600_000) {
      throw new Error("Fecha de extracción inválida o catálogo demasiado antiguo para exportar");
    }
  }
  return {
    catalog: {
      providerId, sourceFile: path, productCount: canonical.productCount,
      endedAt: canonical.endedAt, catalogSha256: sourceHash
    },
    preparationFile: resolve(preparationFile), ready: preparation.totals.ready,
    review: preparation.totals.review, importReady: null,
    importBlocked: null,
    preparation, target: null, sourceProducts: canonical.products
  };
};

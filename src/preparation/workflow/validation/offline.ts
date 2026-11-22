import { isDeepStrictEqual } from "node:util";
import { basename, resolve } from "node:path";
import { buildProductIdentity } from "../../../catalog/identity.js";
import { prepareImportBatch } from "../../prepare.js";
import { readCanonicalCatalogWithFingerprint } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { readPreparationOriginal, type PreparationOriginal } from "../../../infrastructure/filesystem/preparation/preparation-source.js";
import { readAppliedIntervention } from "../../../infrastructure/filesystem/interventions/intervention-derived.js";
import { readOfflinePreparation } from "../../../infrastructure/filesystem/preparation/offline-preparation.js";
import { loadPreparationInputs } from "../../../infrastructure/filesystem/preparation/preparation-inputs.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { OfflinePreparation } from "../../offline-document.js";
import type { ImportCatalog } from "../../../commercial/legacy-export/contracts.js";

export type CatalogValidation = {
  readonly providerId: string;
  readonly sourceFile: string;
  readonly productCount: number;
  readonly endedAt: string | null;
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

export const validateCanonicalSource = async (sourceFile: string, providerId: string): Promise<CatalogValidation> => {
  const path = resolve(sourceFile);
  const { catalog, catalogSha256 } = await readCanonicalCatalogWithFingerprint(path);
  if (catalog.providerId !== providerId) throw new Error("El catálogo canónico pertenece a otro proveedor");
  return {
    providerId, sourceFile: path, productCount: catalog.productCount,
    endedAt: catalog.endedAt, catalogSha256
  };
};

export const validateOfflinePreparation = async (
  providerId: string, preparationFile: string, sourceFile: string, maxAgeHours: number | null = null,
  originalSource?: string
): Promise<OfflineValidation> => {
  const path = resolve(sourceFile);
  const isDocument = basename(path) === "manain-stocklist.json";
  if (isDocument && originalSource !== undefined) throw new Error("El origen documental no admite intervenciones canónicas");
  const derived = originalSource === undefined ? null : await readAppliedIntervention(path, originalSource);
  const original: PreparationOriginal = derived === null ? await readPreparationOriginal(path) : {
    providerId: derived.catalog.providerId, prefix: derived.catalog.prefix, scope: derived.catalog.scope,
    productCount: derived.catalog.productCount, products: derived.catalog.products, catalogSha256: derived.catalogSha256
  };
  if (original.providerId !== providerId) throw new Error("La preparación y el original pertenecen a proveedores distintos");
  const [preparation, inputs] = await Promise.all([
    readOfflinePreparation(resolve(preparationFile), providerId), loadPreparationInputs()
  ]);
  const sourceHash = original.catalogSha256;
  if (!isDeepStrictEqual(preparation.source.intervention, derived?.provenance)) {
    throw new Error("La procedencia de la preparación no coincide con la intervención verificada");
  }
  if (preparation.source.prefix !== original.prefix || preparation.source.scope !== original.scope ||
    preparation.source.catalogSha256 !== sourceHash || preparation.source.productCount !== original.productCount ||
    !isDeepStrictEqual(preparation.source.document, original.document)) {
    throw new Error("La preparación offline no corresponde exactamente al catálogo canónico seleccionado");
  }
  if (!isDeepStrictEqual(preparation.fingerprints, inputs.fingerprints)) {
    throw new Error("La preparación está obsoleta: han cambiado las reglas de calidad del scraper; repetir preparar");
  }
  const expected = prepareImportBatch(original.products);
  if (!isDeepStrictEqual(preparation.identities, original.products.map((product) => buildProductIdentity(product).key)) ||
    !isDeepStrictEqual(preparation.products, expected.products) ||
    !isDeepStrictEqual(preparation.totals, expected.totals)) {
    throw new Error("La preparación no coincide con los productos y reglas de su catálogo de origen");
  }
  if (maxAgeHours !== null) {
    if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) throw new Error("maxAgeHours debe ser positivo");
    if (isDocument) throw new Error("La edad de un scrapeo no aplica a originales documentales");
    const canonical = await readCanonicalCatalogWithFingerprint(path);
    const age = Date.now() - Date.parse(canonical.catalog.endedAt);
    if (!Number.isFinite(age) || age < -60_000 || age > maxAgeHours * 3_600_000) {
      throw new Error("Fecha de extracción inválida o catálogo demasiado antiguo para exportar");
    }
  }
  return {
    catalog: {
      providerId, sourceFile: path, productCount: original.productCount,
      endedAt: isDocument ? null : (await readCanonicalCatalogWithFingerprint(path)).catalog.endedAt, catalogSha256: sourceHash
    },
    preparationFile: resolve(preparationFile), ready: preparation.totals.ready,
    review: preparation.totals.review, importReady: null,
    importBlocked: null,
    preparation, target: null, sourceProducts: original.products
  };
};

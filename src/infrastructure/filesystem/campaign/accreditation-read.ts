import { readFile, realpath } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { buildProductIdentity } from "../../../catalog/identity.js";
import { readCanonicalCatalog } from "../catalog/canonical-catalog.js";
import { readAppliedIntervention } from "../interventions/intervention-derived.js";
import { validateOfflinePreparation } from "../../../pipeline/validation/offline.js";
import { sha256 } from "../../../catalog/editorial/campaign-accreditation.js";
import type { AccreditedSource } from "../../../catalog/editorial/campaign-accreditation.js";
import type { OfflinePreparation } from "../../../catalog/preparation/offline-document.js";
import type { BatchReport } from "../../../contracts/batch-report.js";
import { isReferenceProviderSet } from "../../../contracts/campaign-providers.js";


export const interventionForPreparation = async (
  file: string,
  originalFile: string,
  preparation: OfflinePreparation, workspaceRoot: string
): Promise<AccreditedSource["intervention"]> => {
  const root = await realpath(resolve(workspaceRoot, "storage", "interventions"));
  const realFile = await realpath(file);
  const inputDir = dirname(realFile);
  const resultDir = dirname(inputDir);
  const inside = relative(root, resultDir);
  if (!inside || inside === ".." || inside.startsWith(`..${sep}`) ||
    basename(inputDir) !== "prepared" || !/^[a-f0-9]{64}$/.test(basename(resultDir)) ||
    basename(dirname(resultDir)) !== "results") {
    throw new Error("Acreditación editorial: preparación intervenida fuera de un resultado permitido");
  }
  const verified = await readAppliedIntervention(join(resultDir, "catalog-derived.json"), originalFile);
  const intervention = preparation.source.intervention;
  if (!intervention || !isDeepStrictEqual(verified.provenance, intervention) ||
    verified.catalogSha256 !== preparation.source.catalogSha256) {
    throw new Error("Acreditación editorial: intervención no acreditada o alterada");
  }
  const changed = new Set(verified.changes.map((item) => item.identity));
  const references = verified.catalog.products
    .filter((product) => changed.has(buildProductIdentity(product).key))
    .map((product) => product.reference);
  if (references.length !== changed.size || references.some((reference) => reference === null)) {
    throw new Error("Acreditación editorial: cambios sin referencia verificable");
  }
  return {
    ...intervention,
    affectedReferences: references.filter((reference): reference is string => reference !== null).sort()
  };
};

import { createHash, randomUUID } from "node:crypto";
import { lstat, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { ImportCandidate } from "../commercial/legacy-export/contracts.js";
import { readActiveCatalogIndex, withActiveCatalogLock, writeActiveCatalogIndex } from "../infrastructure/filesystem/catalog/active-selection.js";
import { readAccreditedPublication, resolveAccreditedPublication } from "../infrastructure/filesystem/catalog/accredited-publication.js";
import { publicationApprovalSha, resolvePublicationDirectory } from "../infrastructure/filesystem/catalog/publication-identity.js";
import { evaluateIndividualPublicationDifference, PublicationAcceptanceError } from "./publication-acceptance.js";
import type { PublicationAcceptance } from "./publication-acceptance.js";

import type { PublicationDifference } from "./publication-contracts.js";
export type { PublicationDifference } from "./publication-contracts.js";

export type PublicationActivation = {
  readonly status: "simulation" | "activated" | "unchanged";
  readonly providerId: string;
  readonly difference: PublicationDifference;
  readonly acceptance: PublicationAcceptance;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const missing = (error: unknown): boolean => isRecord(error) && error.code === "ENOENT";
const fingerprint = (text: string): string => createHash("sha256").update(text).digest("hex");
const isHash = (text: string): boolean => /^[a-f0-9]{64}$/.test(text);

const productIdentity = (product: ImportCandidate): string =>
  product.reference?.trim() ? `ref:${product.reference.trim().toLowerCase()}` : `url:${product.sourceUrl}`;

const emptySpecification = (value: ImportCandidate["spec"][string]): boolean =>
  typeof value === "string" ? value.trim() === "" : Array.isArray(value) && value.length === 0;

const indexProducts = (products: readonly ImportCandidate[]): Map<string, ImportCandidate> => {
  const result = new Map<string, ImportCandidate>();
  for (const product of products) {
    const id = productIdentity(product);
    if (result.has(id)) throw new Error(`Publicación duplicada: ${id}`);
    result.set(id, product);
  }
  return result;
};

export const differenceBetween = (
  previous: string | null, candidate: string,
  oldProducts: readonly ImportCandidate[], newProducts: readonly ImportCandidate[]
): PublicationDifference => {
  const before = indexProducts(oldProducts);
  const after = indexProducts(newProducts);
  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];
  const lostDescriptions: string[] = [];
  const removedSpecifications: string[] = [];
  const addedSpecifications: string[] = [];
  const changedSpecifications: string[] = [];
  const lostSpecificationValues: string[] = [];
  const changedSources: string[] = [];
  for (const [id, product] of before) {
    const next = after.get(id);
    if (!next) { removed.push(id); continue; }
    if (!isDeepStrictEqual(product, next)) modified.push(id);
    if (product.sourceUrl !== next.sourceUrl || product.externalReference !== next.externalReference) {
      changedSources.push(id);
    }
    for (const field of ["description", "description_general"] as const) {
      if (product[field]?.trim() && !next[field]?.trim()) lostDescriptions.push(`${id}:${field}`);
    }
    for (const [key, value] of Object.entries(product.spec)) {
      if (!(key in next.spec)) {
        removedSpecifications.push(`${id}:${key}`);
        continue;
      }
      const updated = next.spec[key];
      if (updated === undefined) continue;
      if (!isDeepStrictEqual(value, updated)) changedSpecifications.push(`${id}:${key}`);
      if (!emptySpecification(value) && emptySpecification(updated)) lostSpecificationValues.push(`${id}:${key}`);
    }
    for (const key of Object.keys(next.spec)) {
      if (!(key in product.spec)) addedSpecifications.push(`${id}:${key}`);
    }
  }
  for (const id of after.keys()) if (!before.has(id)) added.push(id);
  return {
    previous, candidate, previousProducts: oldProducts.length, candidateProducts: newProducts.length,
    added, removed, modified, lostDescriptions, removedSpecifications, addedSpecifications,
    changedSpecifications, lostSpecificationValues, changedSources
  };
};

const validateVersion = async (root: string, providerId: string, sha: string): Promise<{
  readonly path: string; readonly products: readonly ImportCandidate[]
}> => {
  if (!/^[a-z][a-z0-9_-]*$/.test(providerId) || !isHash(sha)) {
    throw new Error("Proveedor o SHA de acreditación inválidos");
  }
  const directory = await resolvePublicationDirectory(join(root, "catalogs", "providers", providerId, "publications"), sha);
  if (!directory) throw new Error("La publicación acreditada no existe");
  for (const name of ["manifest.json", "accreditation.json", `${providerId}-publishable.json`]) {
    const meta = await lstat(join(directory, name));
    if (!meta.isFile() || meta.isSymbolicLink()) throw new Error(`Archivo de publicación no regular: ${name}`);
  }
  if (fingerprint(await readFile(join(directory, "accreditation.json"), "utf8")) !== sha) {
    throw new Error("La huella de la aprobación no coincide con el directorio de la publicación");
  }
  const path = join(directory, `${providerId}-publishable.json`);
  const publication = await readAccreditedPublication(path);
  if (publication.providerId !== providerId) throw new Error("La aprobación corresponde a otro proveedor");
  return { path, products: publication.products };
};

const describe = async (root: string, providerId: string, sha: string): Promise<{
  readonly difference: PublicationDifference;
  readonly acceptance: PublicationAcceptance;
}> => {
  const candidate = await validateVersion(root, providerId, sha);
  const current = await resolveAccreditedPublication(root, providerId, true);
  const previous = current ? basename(current) === "publishable.json" ? basename(dirname(dirname(current))) :
    await publicationApprovalSha(dirname(current)) : null;
  const old = current ? (await readAccreditedPublication(current)).products : [];
  const difference = differenceBetween(previous, sha, old, candidate.products);
  const approval: unknown = JSON.parse(await readFile(join(dirname(candidate.path), "accreditation.json"), "utf8"));
  const acceptance = evaluateIndividualPublicationDifference(providerId, difference, old, candidate.products, approval);
  return { difference, acceptance };
};

const writeAtomicSelection = async (target: string, contents: string): Promise<void> => {
  const stage = join(dirname(target), `.active-${randomUUID()}.tmp`);
  try {
    await writeFile(stage, contents, { flag: "wx" });
    await rename(stage, target);
  } finally {
    await rm(stage, { force: true });
  }
};

const readSelectionSnapshot = async (target: string): Promise<string | null> => {
  try {
    const info = await lstat(target);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error("El índice vigente no es un archivo regular");
    return await readFile(target, "utf8");
  } catch (error) {
    if (missing(error)) return null;
    throw error;
  }
};

const restoreSelection = async (target: string, previous: string | null, written: string): Promise<void> => {
  const current = await readSelectionSnapshot(target);
  if (current !== written) throw new Error("El índice cambió durante la recuperación; se requiere intervención manual");
  if (previous === null) await rm(target);
  else await writeAtomicSelection(target, previous);
};

export const selectActivePublication = async (
  rootDirectory: string, providerId: string, approvalSha256: string, activate = false
): Promise<PublicationActivation> => {
  const root = resolve(rootDirectory);
  const { difference, acceptance } = await describe(root, providerId, approvalSha256);
  if (!activate) return { status: "simulation", providerId, difference, acceptance };
  const folder = join(root, "catalogs", "providers", providerId, "publications");
  const lockPath = join(folder, ".active.lock");
  let lock;
  try { lock = await open(lockPath, "wx"); }
  catch (error) {
    if (isRecord(error) && error.code === "EEXIST") throw new Error("Otra selección de publicación está en curso");
    throw error;
  }
  try {
    return await withActiveCatalogLock(root, async () => {
      const latest = await describe(root, providerId, approvalSha256);
      if (!isDeepStrictEqual(latest.difference, difference) || !isDeepStrictEqual(latest.acceptance, acceptance)) {
        throw new Error("La publicación vigente cambió durante la selección; vuelve a simular");
      }
      const global = await readActiveCatalogIndex(root);
      if (global && Object.values(global.providers).some((source) => source.runId !== undefined)) {
        throw new PublicationAcceptanceError(["Hay una campaña global vigente; no se puede sustituir parcialmente"]);
      }
      const activePath = join(folder, "active.json");
      const current = await resolveAccreditedPublication(root, providerId, true);
      const accepted = latest.acceptance;
      if (!accepted.accepted) throw new PublicationAcceptanceError(accepted.blockers);
      const candidate = await validateVersion(root, providerId, approvalSha256);
      if (current === candidate.path && (global?.providers[providerId]?.approvalSha256 === approvalSha256 ||
        (!global && await readSelectionSnapshot(activePath) !== null))) {
        return { status: "unchanged", providerId, difference: latest.difference, acceptance: accepted };
      }
      const indexPath = global ? join(root, "catalogs", "active.json") : activePath;
      const previous = await readSelectionSnapshot(indexPath);
      const next = global
        ? `${JSON.stringify({ version: 1, providers: { ...global.providers, [providerId]: { approvalSha256 } } }, null, 2)}\n`
        : `${JSON.stringify({ version: 1, providerId, approvalSha256 }, null, 2)}\n`;
      try {
        if (global) {
          await writeActiveCatalogIndex(root, {
            version: 1, providers: { ...global.providers, [providerId]: { approvalSha256 } }
          });
        } else {
          await writeAtomicSelection(indexPath, next);
        }
        const selected = await resolveAccreditedPublication(root, providerId);
        if (selected !== candidate.path) throw new Error("La publicación vigente no corresponde al índice activado");
        return { status: "activated", providerId, difference: latest.difference, acceptance: accepted };
      } catch (error) {
        try {
          const currentSelection = await readSelectionSnapshot(indexPath);
          if (currentSelection === next) await restoreSelection(indexPath, previous, next);
          else if (currentSelection !== previous) {
            throw new Error("El índice cambió durante la activación; se requiere intervención manual");
          }
        } catch (recoveryError) {
          throw new Error(`La selección falló y la recuperación es incompleta: ${String(recoveryError)}`, { cause: error });
        }
        throw error;
      }
    });
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }
};

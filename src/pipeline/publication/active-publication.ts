import { createHash, randomUUID } from "node:crypto";
import { lstat, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { ImportCandidate } from "../../catalog/legacy-export/contracts.js";
import { readActiveCatalogIndex, withActiveCatalogLock, writeActiveCatalogIndex } from "../../infrastructure/filesystem/catalog/active-selection.js";
import { readAccreditedPublication, resolveAccreditedPublication } from "../../infrastructure/filesystem/catalog/accredited-publication.js";

export type PublicationDifference = {
  readonly previous: string | null;
  readonly candidate: string;
  readonly previousProducts: number;
  readonly candidateProducts: number;
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly modified: readonly string[];
  readonly lostDescriptions: readonly string[];
  readonly removedSpecifications: readonly string[];
};

export type PublicationActivation = {
  readonly status: "simulation" | "activated" | "unchanged";
  readonly providerId: string;
  readonly difference: PublicationDifference;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const missing = (error: unknown): boolean => isRecord(error) && error.code === "ENOENT";
const fingerprint = (text: string): string => createHash("sha256").update(text).digest("hex");
const isHash = (text: string): boolean => /^[a-f0-9]{64}$/.test(text);

const productIdentity = (product: ImportCandidate): string =>
  product.reference?.trim() ? `ref:${product.reference.trim().toLowerCase()}` : `url:${product.sourceUrl}`;

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
  for (const [id, product] of before) {
    const next = after.get(id);
    if (!next) { removed.push(id); continue; }
    if (!isDeepStrictEqual(product, next)) modified.push(id);
    for (const field of ["description", "description_general"] as const) {
      if (product[field]?.trim() && !next[field]?.trim()) lostDescriptions.push(`${id}:${field}`);
    }
    for (const key of Object.keys(product.spec)) {
      if (!(key in next.spec)) removedSpecifications.push(`${id}:${key}`);
    }
  }
  for (const id of after.keys()) if (!before.has(id)) added.push(id);
  return {
    previous, candidate, previousProducts: oldProducts.length, candidateProducts: newProducts.length,
    added, removed, modified, lostDescriptions, removedSpecifications
  };
};

const validateVersion = async (root: string, providerId: string, sha: string): Promise<{
  readonly path: string; readonly products: readonly ImportCandidate[]
}> => {
  if (!/^[a-z][a-z0-9_-]*$/.test(providerId) || !isHash(sha)) {
    throw new Error("Proveedor o SHA de acreditación inválidos");
  }
  const directory = join(root, "catalogs", "providers", providerId, "publications", sha);
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("La publicación no es un directorio regular");
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

const describe = async (root: string, providerId: string, sha: string): Promise<PublicationDifference> => {
  const candidate = await validateVersion(root, providerId, sha);
  const current = await resolveAccreditedPublication(root, providerId, true);
  const previous = current ? basename(current) === "publishable.json" ? basename(dirname(dirname(current))) :
    basename(dirname(current)) : null;
  const old = current ? (await readAccreditedPublication(current)).products : [];
  return differenceBetween(previous, sha, old, candidate.products);
};

export const selectActivePublication = async (
  rootDirectory: string, providerId: string, approvalSha256: string, activate = false
): Promise<PublicationActivation> => {
  const root = resolve(rootDirectory);
  const difference = await describe(root, providerId, approvalSha256);
  if (!activate) return { status: "simulation", providerId, difference };
  const folder = join(root, "catalogs", "providers", providerId, "publications");
  const lockPath = join(folder, ".active.lock");
  let lock;
  try { lock = await open(lockPath, "wx"); }
  catch (error) {
    if (isRecord(error) && error.code === "EEXIST") throw new Error("Otra selección de publicación está en curso");
    throw error;
  }
  const stage = join(folder, `.active-${randomUUID()}.tmp`);
  try {
    return await withActiveCatalogLock(root, async () => {
      const latest = await describe(root, providerId, approvalSha256);
      if (!isDeepStrictEqual(latest, difference)) {
        throw new Error("La publicación vigente cambió durante la selección; vuelve a simular");
      }
      const activePath = join(folder, "active.json");
      let hasIndex = false;
      try {
        const meta = await lstat(activePath);
        if (!meta.isFile() || meta.isSymbolicLink()) throw new Error("El índice de publicación vigente no es un archivo regular");
        hasIndex = true;
      } catch (error) { if (!missing(error)) throw error; }
      const global = await readActiveCatalogIndex(root);
      if (global) {
        const selected = global.providers[providerId];
        if (selected?.approvalSha256 === approvalSha256 && selected.runId === undefined) {
          return { status: "unchanged", providerId, difference: latest };
        }
        await writeActiveCatalogIndex(root, {
          version: 1, providers: { ...global.providers, [providerId]: { approvalSha256 } }
        });
      } else {
        if (latest.previous === approvalSha256 && hasIndex) {
          return { status: "unchanged", providerId, difference: latest };
        }
        await writeFile(stage, JSON.stringify({ version: 1, providerId, approvalSha256 }, null, 2) + "\n", { flag: "wx" });
        await rename(stage, activePath);
      }
      const selectedPath = await resolveAccreditedPublication(root, providerId);
      if (selectedPath !== join(folder, approvalSha256, `${providerId}-publishable.json`)) {
        throw new Error("La publicación vigente no corresponde al índice activado");
      }
      return { status: "activated", providerId, difference: latest };
    });
  } finally {
    await rm(stage, { force: true });
    await lock.close();
    await rm(lockPath, { force: true });
  }
};

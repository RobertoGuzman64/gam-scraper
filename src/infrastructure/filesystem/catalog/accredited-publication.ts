import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { candidateValidationIssue, isCandidate } from "../../../catalog/preparation/preparation-document.js";
import type { ImportCandidate } from "../../../catalog/legacy-export/contracts.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const sha256 = (content: string): string => createHash("sha256").update(content).digest("hex");

const publicationError = (path: string, detail: string): Error =>
  new Error(`Publicación ${path}: ${detail}`);

const readPublicationFile = async (path: string): Promise<string> => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    throw publicationError(path, `no se puede leer el archivo: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const parsePublicationJson = (raw: string, path: string): unknown => {
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw publicationError(path, `JSON inválido: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const discoverAccreditedPublications = async (root: string): Promise<readonly string[]> => {
  const providersRoot = join(root, "catalogs", "providers");
  let providers;
  try {
    providers = await readdir(providersRoot, { withFileTypes: true });
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return [];
    throw error;
  }
  const publications: string[] = [];
  for (const provider of providers.filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const folder = join(providersRoot, provider.name, "publications");
    let entries;
    try {
      entries = await readdir(folder, { withFileTypes: true });
    } catch (error) {
      if (isRecord(error) && error.code === "ENOENT") continue;
      throw error;
    }
    const approvedDirs = entries.filter((entry) => entry.isDirectory() && /^[a-f0-9]{64}$/.test(entry.name));
    if (approvedDirs.length > 1) {
      throw new Error(`Varias publicaciones de ${provider.name} en ${folder}; indica --publicacion para elegir una sin ambigüedad`);
    }
    const approved = approvedDirs[0];
    if (approved) publications.push(join(folder, approved.name, `${provider.name}-publishable.json`));
  }
  return publications;
};

export const readAccreditedPublication = async (file: string): Promise<{
  providerId: string; products: readonly ImportCandidate[]; sha256: string; runId: string
}> => {
  const path = resolve(file);
  const directory = dirname(path);
  const manifestPath = join(directory, "manifest.json");
  const accreditationPath = join(directory, "accreditation.json");
  const [raw, rawManifest, rawAccreditation] = await Promise.all([
    readPublicationFile(path), readPublicationFile(manifestPath), readPublicationFile(accreditationPath)
  ]);
  const manifest = parsePublicationJson(rawManifest, manifestPath);
  const accreditation = parsePublicationJson(rawAccreditation, accreditationPath);
  const parsed = parsePublicationJson(raw, path);
  if (!isRecord(manifest) || manifest.version !== 1 || typeof manifest.providerId !== "string" ||
    !/^[a-z][a-z0-9_-]*$/.test(manifest.providerId) || typeof manifest.runId !== "string" ||
    !isRecord(manifest.files) || !isRecord(manifest.totals)) {
    throw publicationError(manifestPath, "estructura del manifiesto inválida");
  }
  if (!isRecord(accreditation) || accreditation.approved !== true || accreditation.runId !== manifest.runId) {
    throw publicationError(accreditationPath, "aprobación ausente, inválida o asociada a otro runId");
  }
  if (basename(path) !== `${manifest.providerId}-publishable.json`) {
    throw publicationError(path, `nombre incompatible con providerId ${manifest.providerId}`);
  }
  if (!Array.isArray(parsed)) throw publicationError(path, "se esperaba una lista de productos");
  if (!Number.isSafeInteger(manifest.totals.publishable) || parsed.length !== manifest.totals.publishable) {
    throw publicationError(path, `total de fichas ${parsed.length} distinto del manifest (${String(manifest.totals.publishable)})`);
  }
  const productHash = sha256(raw);
  if (manifest.files[basename(path)] !== productHash) {
    throw publicationError(path, `SHA256 distinto del manifest: esperado ${String(manifest.files[basename(path)])}, actual ${productHash}`);
  }
  const approvalHash = sha256(rawAccreditation);
  if (manifest.files["accreditation.json"] !== approvalHash || manifest.approvalSha256 !== approvalHash) {
    throw publicationError(accreditationPath, `SHA256 de acreditación distinto del manifest: actual ${approvalHash}`);
  }
  for (const [index, entry] of parsed.entries()) {
    const issue = candidateValidationIssue(entry);
    const reference = isRecord(entry) && typeof entry.reference === "string" ? entry.reference : "sin referencia";
    const identity = `ficha ${index + 1} (${reference})`;
    if (issue) throw publicationError(path, `${identity}: ${issue}`);
    if (!isRecord(entry) || entry.providerId !== manifest.providerId) {
      throw publicationError(path, `${identity}: providerId distinto de ${manifest.providerId}`);
    }
    if (!isRecord(entry.spec)) throw publicationError(path, `${identity}: spec debe ser un objeto`);
    for (const [key, value] of Object.entries(entry.spec)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") continue;
      if (Array.isArray(value) && value.every((part: unknown) =>
        typeof part === "string" || typeof part === "number" || typeof part === "boolean")) continue;
      throw publicationError(path, `${identity}: spec.${key} contiene un valor inválido`);
    }
  }
  return { providerId: manifest.providerId, products: parsed.filter(isCandidate), sha256: productHash, runId: manifest.runId };
};

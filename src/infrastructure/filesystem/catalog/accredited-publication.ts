import { createHash } from "node:crypto";
import type { Dirent } from "node:fs";
import { lstat, readFile, readdir } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";
import { readActiveCatalogIndex } from "./active-selection.js";
import { readPortableCampaign } from "./portable-campaign.js";
import { candidateValidationIssue, isCandidate } from "../../../catalog/preparation/preparation-document.js";
import type { ImportCandidate } from "../../../catalog/legacy-export/contracts.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const sha256 = (content: string): string => createHash("sha256").update(content).digest("hex");

const publicationError = (path: string, detail: string): Error =>
  new Error(`Publicación ${path}: ${detail}`);

const crlfDiagnostic = (raw: string, expected: unknown): string =>
  typeof expected === "string" && raw.includes("\r\n") && sha256(raw.replace(/\r\n/g, "\n")) === expected
    ? " (se detectó conversión de saltos de línea LF a CRLF; restaura los bytes acreditados)"
    : "";

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

const approvalId = (value: string): boolean => /^[a-f0-9]{64}$/.test(value);
const providerName = (value: string): boolean => /^[a-z][a-z0-9_-]*$/.test(value);

const verifiedFile = async (path: string): Promise<string> => {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw publicationError(path, "debe ser un archivo regular, no un enlace");
  return readPublicationFile(path);
};

export const resolveAccreditedPublication = async (root: string, providerId: string, allowAmbiguous = false): Promise<string | null> => {
  if (!providerName(providerId)) throw new Error(`Proveedor inválido: ${providerId}`);
  const global = await readActiveCatalogIndex(root);
  const selectedSource = global?.providers[providerId];
  if (selectedSource?.runId) {
    const path = join(root, "catalogs", "campaigns", selectedSource.runId, providerId, "publishable.json");
    const manifest = await readPortableCampaign(root, selectedSource.runId);
    if (manifest.approvalSha256 !== selectedSource.approvalSha256) {
      throw publicationError(path, "aprobación de campaña distinta del índice vigente");
    }
    await readAccreditedPublication(path);
    return path;
  }
  const folder = join(root, "catalogs", "providers", providerId, "publications");
  let entries;
  try {
    entries = await readdir(folder, { withFileTypes: true });
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT" && !selectedSource) return null;
    if (isRecord(error) && error.code === "ENOENT") throw publicationError(folder, "versión individual vigente ausente");
    throw error;
  }
  const versions = entries.filter((entry) => entry.isDirectory() && approvalId(entry.name));
  const index = join(folder, "active.json");
  const hasIndex = entries.some((entry) => entry.name === "active.json");
  let selected: string | undefined;
  if (selectedSource) {
    selected = selectedSource.approvalSha256;
    if (!versions.some((entry) => entry.name === selected)) {
      throw publicationError(folder, "la versión individual seleccionada no existe");
    }
  } else if (hasIndex) {
    const document = parsePublicationJson(await verifiedFile(index), index);
    if (!isRecord(document) || document.version !== 1 || document.providerId !== providerId ||
      typeof document.approvalSha256 !== "string" || !approvalId(document.approvalSha256) ||
      Object.keys(document).length !== 3) {
      throw publicationError(index, "selección vigente inválida");
    }
    selected = document.approvalSha256;
    if (!versions.some((entry) => entry.name === selected)) {
      throw publicationError(index, "la versión seleccionada no existe o no es un directorio regular");
    }
  } else if (versions.length > 1) {
    if (allowAmbiguous) return null;
    throw new Error(`Varias publicaciones de ${providerId} en ${folder}; utiliza publicacion:vigente para seleccionar una expresamente`);
  } else selected = versions[0]?.name;
  if (!selected) return null;
  const directory = join(folder, selected);
  const dirInfo = await lstat(directory);
  if (!dirInfo.isDirectory() || dirInfo.isSymbolicLink()) throw publicationError(directory, "directorio de versión no regular");
  const accreditationFile = join(directory, "accreditation.json");
  const approvalHash = sha256(await verifiedFile(accreditationFile));
  if (approvalHash !== selected) throw publicationError(directory, "carpeta SHA distinta de la aprobación acreditada");
  const file = join(directory, `${providerId}-publishable.json`);
  for (const name of [`${providerId}-publishable.json`, "manifest.json"]) await verifiedFile(join(directory, name));
  const verified = await readAccreditedPublication(file);
  if (verified.providerId !== providerId) throw publicationError(file, "proveedor acreditado distinto del directorio");
  return file;
};

export const discoverAccreditedPublications = async (root: string): Promise<readonly string[]> => {
  const providersRoot = join(root, "catalogs", "providers");
  let providers: Dirent[];
  try {
    providers = await readdir(providersRoot, { withFileTypes: true });
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") providers = [];
    else throw error;
  }
  const publications: string[] = [];
  const global = await readActiveCatalogIndex(root);
  const names = new Set([...providers.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
    ...Object.keys(global?.providers ?? {})]);
  for (const name of [...names].sort()) {
    if (!CAMPAIGN_PROVIDERS.some((id) => id === name)) throw new Error(`Proveedor de publicación no reconocido: ${name}`);
    const file = await resolveAccreditedPublication(root, name);
    if (file) publications.push(file);
  }
  return publications;
};

export const readAccreditedPublication = async (file: string): Promise<{
  providerId: string; products: readonly ImportCandidate[]; sha256: string; runId: string
}> => {
  const path = resolve(file);
  const directory = dirname(path);
  if (basename(path) === "publishable.json") {
    const providerId = basename(directory);
    const runId = basename(dirname(directory));
    const root = resolve(dirname(dirname(dirname(dirname(directory)))));
    if (!CAMPAIGN_PROVIDERS.some((id) => id === providerId) ||
      path !== join(root, "catalogs", "campaigns", runId, providerId, "publishable.json")) {
      throw publicationError(path, "ruta portátil de campaña inválida");
    }
    const manifest = await readPortableCampaign(root, runId);
    const raw = await verifiedFile(path);
    const expected = manifest.files[`${providerId}/publishable.json`];
    if (sha256(raw) !== expected) throw publicationError(path, "huella portable distinta del manifiesto");
    const parsed = parsePublicationJson(raw, path);
    if (!Array.isArray(parsed) || parsed.some((entry: unknown) => !isCandidate(entry) || entry.providerId !== providerId)) {
      throw publicationError(path, "productos no corresponden a la acreditación portátil");
    }
    return { providerId, products: parsed, sha256: sha256(raw), runId };
  }
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
  const expectedProductHash = manifest.files[basename(path)];
  if (expectedProductHash !== productHash) {
    throw publicationError(path, `SHA256 distinto del manifest: esperado ${String(expectedProductHash)}, actual ${productHash}${crlfDiagnostic(raw, expectedProductHash)}`);
  }
  const approvalHash = sha256(rawAccreditation);
  const expectedApprovalHash = manifest.files["accreditation.json"];
  if (expectedApprovalHash !== approvalHash || manifest.approvalSha256 !== approvalHash) {
    throw publicationError(accreditationPath, `SHA256 de acreditación distinto del manifest: esperados ${String(expectedApprovalHash)} y ${String(manifest.approvalSha256)}, actual ${approvalHash}${crlfDiagnostic(rawAccreditation, expectedApprovalHash)}`);
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

import { buildProductIdentity } from "../../catalog/identity.js";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readZipArchive } from "../../infrastructure/archive/zip.js";
import { loadImportCatalogSnapshot } from "../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { loadCommercialReference } from "../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import { discoverAccreditedPublications, readAccreditedPublication } from "../../infrastructure/filesystem/catalog/accredited-publication.js";
import { buildCommercialExportFiles, type CommercialExportFile } from "./commercial-export.js";
import { validCommercialExceptionAccreditation } from "./commercial-exception-accreditation.js";
import { isCommercialReceiverProduct } from "../validation/commercial-receiver-product.js";
import { inspectCommercialIdentityPresentation } from "../validation/commercial-identity-presentation.js";
import { assessCommercialHeight } from "../validation/height-consistency.js";
import { assessCommercialYear } from "../validation/year-consistency.js";
import { isPresentableSpecifications, hasLoadCapacityDisagreement } from "../validation/technical-specifications.js";
import { inspectCommercialEditorialQuality } from "../validation/editorial-quality.js";

export type CommercialExportVerification = {
  readonly files: number;
  readonly bytes: number;
};

const sha256 = (content: string): string => createHash("sha256").update(content).digest("hex");
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const validHash = (value: unknown): boolean => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const validCount = (value: unknown): boolean => Number.isSafeInteger(value) && typeof value === "number" && value >= 0;
const summaryFields = ["exported", "categorized", "pendingCategory", "excludedLots", "excludedTools",
  "excludedAccessories", "attributes", "withLogo", "withPrice", "withCompany"] as const;
const isWebUrl = (value: unknown): boolean => {
  if (typeof value !== "string" || !value.trim()) return false;
  try { return ["http:", "https:"].includes(new URL(value).protocol); }
  catch { return false; }
};
const validIdentifier = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const publishedIdentity = (providerId: string, item: Record<string, unknown>): string | null => {
  const reference = item.reference;
  const sourceUrl = item.sourceUrl;
  if (typeof sourceUrl !== "string" || !sourceUrl.trim() ||
    (reference !== null && (typeof reference !== "string" || !reference.trim()))) return null;
  try {
    return buildProductIdentity({ providerId, reference, serialNumber: null, url: sourceUrl }).key;
  } catch {
    return null;
  }
};

const inspectProductTotals = (
  products: readonly unknown[], environment: unknown
): { readonly categorized: number; readonly pendingCategory: number; readonly attributes: number;
  readonly withLogo: number; readonly withPrice: number; readonly withCompany: number } | null => {
  let categorized = 0;
  let pendingCategory = 0;
  let attributes = 0;
  let withLogo = 0;
  let withPrice = 0;
  let withCompany = 0;
  for (const product of products) {
    if (!isCommercialReceiverProduct(product,
      environment === "develop" || environment === "production" ? environment : null) ||
      !isRecord(product) || !Array.isArray(product.attributes)) return null;
    if (product.categorySellID === null) pendingCategory += 1;
    else categorized += 1;
    if (product.logoID !== null) withLogo += 1;
    if (product.price !== null) withPrice += 1;
    if (product.companyID !== undefined) withCompany += 1;
    attributes += product.attributes.length;
  }
  return { categorized, pendingCategory, attributes, withLogo, withPrice, withCompany };
};

const inspectExclusionTotals = (
  exclusions: readonly unknown[]
): { readonly excludedLots: number; readonly excludedTools: number; readonly excludedAccessories: number } | null => {
  let excludedLots = 0;
  let excludedTools = 0;
  let excludedAccessories = 0;
  for (const exclusion of exclusions) {
    if (!isRecord(exclusion) || typeof exclusion.reason !== "string") return null;
    if (exclusion.reason === "lote") excludedLots += 1;
    else if (exclusion.reason === "herramienta") excludedTools += 1;
    else if (exclusion.reason === "accesorio") excludedAccessories += 1;
    else return null;
  }
  return { excludedLots, excludedTools, excludedAccessories };
};

const parseJson = (entry: CommercialExportFile): unknown => {
  try {
    return JSON.parse(entry.content) as unknown;
  } catch {
    throw new Error(`Archivo comercial con JSON inválido: ${entry.name}`);
  }
};

const isYearAttribute = (entry: unknown): entry is { readonly attributeID: number; readonly value: string | number | boolean } =>
  isRecord(entry) && typeof entry.attributeID === "number" &&
  (typeof entry.value === "number" || typeof entry.value === "string" || typeof entry.value === "boolean");

export const validateCommercialExportFiles = (expected: readonly CommercialExportFile[]): void => {
  const files = new Map<string, CommercialExportFile>();
  for (const entry of expected) {
    if (!/^(?:commercial-manifest|[a-z][a-z0-9_-]*-commercial)\.json$/u.test(entry.name) || files.has(entry.name)) {
      throw new Error(`Nombre de archivo comercial inválido o duplicado: ${entry.name}`);
    }
    if (entry.bytes !== Buffer.byteLength(entry.content, "utf8") || entry.sha256 !== sha256(entry.content)) {
      throw new Error(`Huella o tamaño comercial inconsistente: ${entry.name}`);
    }
    files.set(entry.name, entry);
  }
  const manifestFile = files.get("commercial-manifest.json");
  if (!manifestFile) throw new Error("Falta el manifiesto comercial");
  const manifest = parseJson(manifestFile);
  if (!isRecord(manifest) || manifest.version !== 2 ||
    (manifest.environment !== null && manifest.environment !== "develop" && manifest.environment !== "production") ||
    !validHash(manifest.taxonomySha256) || !validHash(manifest.attributesSha256) ||
    !validHash(manifest.logosSha256) || !validHash(manifest.companiesSha256) ||
    !Array.isArray(manifest.providers) || manifest.providers.length === 0 ||
    manifest.providers.length !== files.size - 1) {
    throw new Error("Manifiesto comercial incompleto o incoherente");
  }
  const providers = new Set<string>();
  for (const provider of manifest.providers) {
    if (!isRecord(provider) || typeof provider.providerId !== "string" ||
      !/^[a-z][a-z0-9_-]*$/u.test(provider.providerId) || providers.has(provider.providerId) ||
      provider.file !== `${provider.providerId}-commercial.json` || !validHash(provider.publicationSha256) ||
      !validHash(provider.sha256) || !validCount(provider.bytes) || !validCount(provider.originalCount) ||
      !validCount(provider.excluded) || !validCount(provider.exceptions) ||
      summaryFields.some((field) => !validCount(provider[field]))) {
      throw new Error("Proveedor inválido en manifiesto comercial");
    }
    providers.add(provider.providerId);
    const productFile = files.get(provider.file);
    if (!productFile || productFile.sha256 !== provider.sha256 || productFile.bytes !== provider.bytes) {
      throw new Error(`Archivo o huella discordante para el proveedor ${provider.providerId}`);
    }
    const plan = parseJson(productFile);
    if (!isRecord(plan) || plan.version !== 2 || plan.providerId !== provider.providerId ||
      plan.publicationSha256 !== provider.publicationSha256 || plan.environment !== manifest.environment ||
      plan.total !== provider.originalCount || !Array.isArray(plan.products) || !Array.isArray(plan.sources) ||
      plan.sources.length !== plan.products.length || !Array.isArray(plan.excluded) ||
      !Array.isArray(plan.exceptions) || !isRecord(plan.summary) ||
      plan.products.length + plan.excluded.length !== plan.total ||
      plan.products.length !== provider.exported || plan.excluded.length !== provider.excluded ||
      plan.exceptions.length !== provider.exceptions) {
      throw new Error(`Totales o procedencia incoherentes para el proveedor ${provider.providerId}`);
    }
    const verifiedProducts: Record<string, unknown>[] = [];
    for (const [index, candidate] of plan.products.entries()) {
      const origin: unknown = plan.sources[index];
      if (!isRecord(origin) || !isRecord(candidate) ||
        Object.keys(origin).some((key) => !["identity", "reference", "sourceUrl", "externalReference"].includes(key)) ||
        !isWebUrl(origin.sourceUrl) ||
        (origin.reference !== null && (typeof origin.reference !== "string" || !origin.reference.trim())) ||
        (origin.externalReference !== undefined && origin.externalReference !== null &&
          typeof origin.externalReference !== "string") ||
        origin.reference !== candidate.reference ||
        origin.identity !== publishedIdentity(provider.providerId, origin)) {
        throw new Error(`Procedencia comercial inválida para el proveedor ${provider.providerId}`);
      }
      verifiedProducts.push({ ...candidate, providerId: provider.providerId,
        sourceUrl: origin.sourceUrl, externalReference: origin.externalReference });
    }
    const productUrls = new Set<string>();
    const identities = new Set<string>();
    const productsByUrl = new Map<string, Record<string, unknown>>();
    const requiredHeightExceptions = new Map<string, string>();
    const requiredYearExceptions = new Map<string, string>();
    const requiredCapacityExceptions = new Set<string>();
    for (const product of verifiedProducts) {
      if (typeof product.sourceUrl !== "string" || productUrls.has(product.sourceUrl)) {
        throw new Error(`Identidades comerciales duplicadas o inválidas para el proveedor ${provider.providerId}`);
      }
      const identity = publishedIdentity(provider.providerId, product);
      if (!identity || identities.has(identity)) {
        throw new Error(`Referencias técnicas duplicadas o inválidas para el proveedor ${provider.providerId}`);
      }
      identities.add(identity);
      productUrls.add(product.sourceUrl);
      productsByUrl.set(product.sourceUrl, product);
      const editorialIssues = inspectCommercialEditorialQuality({
        title: typeof product.title === "string" ? product.title : null,
        description: typeof product.description === "string" ? product.description : null,
        description_general: typeof product.description_general === "string" ? product.description_general : null
      });
      const blockingEditorial = editorialIssues.find((issue) => issue.severity === "blocking");
      if (blockingEditorial) {
        throw new Error(`Presentación editorial no normalizada para ${provider.providerId}:${product.sourceUrl}: ${blockingEditorial.reason}`);
      }
      if (isPresentableSpecifications(product.spec) && typeof product.title === "string" &&
        hasLoadCapacityDisagreement({ title: product.title, spec: product.spec })) {
        requiredCapacityExceptions.add(product.sourceUrl);
      }
      if (Array.isArray(product.attributes)) {
        const year = assessCommercialYear({
          providerId: provider.providerId,
          sourceUrl: product.sourceUrl,
          reference: typeof product.reference === "string" ? product.reference : null,
          description_general: typeof product.description_general === "string" ? product.description_general : null,
          attributes: product.attributes.filter(isYearAttribute)
        });
        if (year.inconsistentClaims.length > 0) {
          throw new Error(`Año de fabricación contradictorio para ${provider.providerId}:${product.sourceUrl}`);
        }
        if (year.urlAttributeDisagreement) {
          requiredYearExceptions.set(product.sourceUrl, "ano-url-atributo-discordante");
        }
      }
      if (isPresentableSpecifications(product.spec)) {
        const height = assessCommercialHeight({
          title: typeof product.title === "string" ? product.title : null,
          description: typeof product.description === "string" ? product.description : null,
          description_general: typeof product.description_general === "string" ? product.description_general : null,
          spec: product.spec
        });
        if (height.status === "title-normalized" || height.status === "summary-normalized") {
          throw new Error(`Altura comercial sin normalizar para ${provider.providerId}:${product.sourceUrl}`);
        }
        if (height.status === "possible-distinct-heights" || height.status === "unresolved") {
          requiredHeightExceptions.set(product.sourceUrl, height.status === "possible-distinct-heights"
            ? "alturas-concepto-distinto-por-acreditar" : "altura-titulo-resumen-discordante");
        }
      }
    }
    const exclusionUrls = new Set<string>();
    for (const exclusion of plan.excluded) {
      if (!isRecord(exclusion) || typeof exclusion.identity !== "string" || !exclusion.identity.trim() ||
        typeof exclusion.sourceUrl !== "string" || !exclusion.sourceUrl.trim() ||
        (exclusion.reference !== null && typeof exclusion.reference !== "string") ||
        productUrls.has(exclusion.sourceUrl) || exclusionUrls.has(exclusion.sourceUrl)) {
        throw new Error(`Identidades excluidas duplicadas o inválidas para el proveedor ${provider.providerId}`);
      }
      const identity = publishedIdentity(provider.providerId, exclusion);
      if (!identity || exclusion.identity !== identity || identities.has(identity)) {
        throw new Error(`Identidad técnica excluida incoherente para el proveedor ${provider.providerId}`);
      }
      identities.add(identity);
      exclusionUrls.add(exclusion.sourceUrl);
    }
    for (const exception of plan.exceptions) {
      if (!isRecord(exception) || typeof exception.identity !== "string" || !exception.identity.trim() ||
        typeof exception.reason !== "string" || !exception.reason.trim() ||
        typeof exception.sourceUrl !== "string" || !productUrls.has(exception.sourceUrl) ||
        (exception.reference !== null && typeof exception.reference !== "string")) {
        throw new Error(`Excepción comercial sin producto válido para el proveedor ${provider.providerId}`);
      }
      const product = productsByUrl.get(exception.sourceUrl);
      if (!product || exception.reference !== product.reference ||
        exception.identity !== publishedIdentity(provider.providerId, product)) {
        throw new Error(`Excepción comercial con identidad discordante para el proveedor ${provider.providerId}`);
      }
      if (Object.prototype.hasOwnProperty.call(exception, "accreditation")) {
        const sourceIndex = verifiedProducts.findIndex((item) => item.sourceUrl === exception.sourceUrl);
        const receiver: unknown = Array.isArray(plan.products) ? plan.products[sourceIndex] : undefined;
        if (!isRecord(receiver) || !validCommercialExceptionAccreditation(
          provider.providerId, {
            identity: exception.identity, reference: exception.reference,
            sourceUrl: exception.sourceUrl, reason: exception.reason,
            accreditation: exception.accreditation
          }, receiver)) {
          throw new Error(`Acreditación comercial incoherente para ${provider.providerId}:${exception.sourceUrl}`);
        }
      }
    }
    for (const sourceUrl of requiredCapacityExceptions) {
      if (!plan.exceptions.some((exception) => isRecord(exception) && exception.sourceUrl === sourceUrl &&
        exception.reason === "capacidad-titulo-spec-discordante")) {
        throw new Error(`Discrepancia de capacidad no declarada para ${provider.providerId}:${sourceUrl}`);
      }
    }
    for (const exception of plan.exceptions) {
      if (!isRecord(exception) || typeof exception.sourceUrl !== "string" ||
        typeof exception.reason !== "string") continue;
      if (exception.reason === "capacidad-titulo-spec-discordante" &&
        !requiredCapacityExceptions.has(exception.sourceUrl)) {
        throw new Error(`Excepción de capacidad no justificada para ${provider.providerId}:${exception.sourceUrl}`);
      }
      if (!exception.reason.startsWith("spec-")) continue;
      const found = /^spec-(?:unidad-tecnica-malformada|magnitud-en-campo-incompatible|residuo-hoja-calculo|longitud-fisicamente-implausible):(.+)$/u.exec(exception.reason);
      const product = productsByUrl.get(exception.sourceUrl);
      if (!found?.[1] || !isRecord(product) || !isRecord(product.spec) ||
        Object.hasOwn(product.spec, found[1])) {
        throw new Error(`Excepción técnica no justificada para ${provider.providerId}:${exception.sourceUrl}`);
      }
    }
    for (const [sourceUrl, reason] of requiredYearExceptions) {
      if (!plan.exceptions.some((exception) => isRecord(exception) && exception.sourceUrl === sourceUrl &&
        exception.reason === reason)) {
        throw new Error(`Discrepancia de año no declarada para ${provider.providerId}:${sourceUrl}`);
      }
    }
    for (const exception of plan.exceptions) {
      if (isRecord(exception) && typeof exception.sourceUrl === "string" &&
        exception.reason === "ano-url-atributo-discordante" &&
        requiredYearExceptions.get(exception.sourceUrl) !== exception.reason) {
        throw new Error(`Excepción de año no justificada para ${provider.providerId}:${exception.sourceUrl}`);
      }
    }
    for (const [sourceUrl, reason] of requiredHeightExceptions) {
      if (!plan.exceptions.some((exception) => isRecord(exception) && exception.sourceUrl === sourceUrl &&
        exception.reason === reason)) {
        throw new Error(`Discordancia de altura no declarada para ${provider.providerId}:${sourceUrl}`);
      }
    }
    for (const exception of plan.exceptions) {
      if (isRecord(exception) && typeof exception.sourceUrl === "string" &&
        (exception.reason === "alturas-concepto-distinto-por-acreditar" ||
          exception.reason === "altura-titulo-resumen-discordante") &&
        requiredHeightExceptions.get(exception.sourceUrl) !== exception.reason) {
        throw new Error(`Excepción de altura no justificada para ${provider.providerId}:${exception.sourceUrl}`);
      }
    }
    const summary = plan.summary;
    const productTotals = inspectProductTotals(plan.products, plan.environment);
    const exclusionTotals = inspectExclusionTotals(plan.excluded);
    if (!productTotals || !exclusionTotals ||
      summaryFields.some((field) => summary[field] !== provider[field]) ||
      Object.entries({ ...productTotals, ...exclusionTotals }).some(([field, value]) => summary[field] !== value)) {
      throw new Error(`Totales o procedencia incoherentes para el proveedor ${provider.providerId}`);
    }
    const presentationIssues = inspectCommercialIdentityPresentation(verifiedProducts, plan.exceptions, provider.providerId);
    if (Object.values(presentationIssues).some((count) => count > 0)) {
      throw new Error(`Presentación de identidad comercial incoherente para ${provider.providerId}: ${JSON.stringify(presentationIssues)}`);
    }
  }
};

export const verifyCommercialExportSources = async (
  root: string, expected: readonly CommercialExportFile[]
): Promise<void> => {
  validateCommercialExportFiles(expected);
  const manifestFile = expected.find((item) => item.name === "commercial-manifest.json");
  if (!manifestFile) throw new Error("Falta el manifiesto comercial");
  const manifest = parseJson(manifestFile);
  if (!isRecord(manifest) || !Array.isArray(manifest.providers)) {
    throw new Error("Manifiesto comercial incompleto");
  }
  const [snapshot, references, paths] = await Promise.all([
    loadImportCatalogSnapshot(), loadCommercialReference(), discoverAccreditedPublications(root)
  ]);
  if (manifest.taxonomySha256 !== sha256(snapshot.categoryRaw) ||
    manifest.attributesSha256 !== sha256(snapshot.attributeRaw) ||
    manifest.logosSha256 !== sha256(references.logoRaw) ||
    manifest.companiesSha256 !== sha256(references.companyRaw)) {
    throw new Error("Las referencias comerciales cambiaron durante la exportación");
  }
  const publications = new Map<string, string>();
  for (const provider of manifest.providers) {
    if (!isRecord(provider) || typeof provider.providerId !== "string" ||
      typeof provider.publicationSha256 !== "string") {
      throw new Error("Manifiesto comercial con proveedor inválido");
    }
    publications.set(provider.providerId, provider.publicationSha256);
  }
  if (paths.length !== publications.size) {
    throw new Error("El conjunto de publicaciones activas cambió durante la exportación");
  }
  for (const path of paths) {
    const published = await readAccreditedPublication(path);
    if (publications.get(published.providerId) !== published.sha256) {
      throw new Error(`La publicación activa de ${published.providerId} cambió durante la exportación`);
    }
  }
  const currentPaths = await discoverAccreditedPublications(root);
  if (JSON.stringify(currentPaths) !== JSON.stringify(paths)) {
    throw new Error("La selección de publicaciones cambió durante la verificación comercial");
  }
  const environment = manifest.environment;
  if (environment !== null && environment !== "develop" && environment !== "production") {
    throw new Error("Entorno comercial inválido");
  }
  const rebuilt = await buildCommercialExportFiles(root, environment);
  const current = new Map(rebuilt.map((entry) => [entry.name, entry]));
  if (current.size !== expected.length || expected.some((entry) =>
    current.get(entry.name)?.sha256 !== entry.sha256 || current.get(entry.name)?.bytes !== entry.bytes)) {
    throw new Error("Las fuentes originales o la proyección comercial cambiaron durante la exportación");
  }
};

export const verifyCommercialExportDirectory = async (
  directory: string, expected: readonly CommercialExportFile[]
): Promise<CommercialExportVerification> => {
  validateCommercialExportFiles(expected);
  const path = resolve(directory);
  const directoryInfo = await lstat(path);
  if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) {
    throw new Error("La exportación comercial debe ser un directorio real");
  }
  const names = (await readdir(path)).sort();
  const expectedNames = expected.map((item) => item.name).sort();
  if (JSON.stringify(names) !== JSON.stringify(expectedNames)) {
    throw new Error("La exportación comercial contiene archivos ausentes, extraños o duplicados");
  }
  let bytes = 0;
  for (const entry of expected) {
    const destination = join(path, entry.name);
    const info = await lstat(destination);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Archivo comercial no regular: ${entry.name}`);
    const actual = await readFile(destination);
    if (actual.length !== entry.bytes || actual.toString("utf8") !== entry.content ||
      sha256(actual.toString("utf8")) !== entry.sha256) {
      throw new Error(`La exportación comercial no coincide con el corte acreditado: ${entry.name}`);
    }
    bytes += info.size;
  }
  return { files: expected.length, bytes };
};

export const verifyCommercialExportArchive = (
  archive: Buffer, expected: readonly CommercialExportFile[]
): CommercialExportVerification => {
  validateCommercialExportFiles(expected);
  const entries = readZipArchive(archive);
  const files = new Map(expected.map((file) => [file.name, file]));
  if (entries.length !== files.size) throw new Error("ZIP comercial con archivos ausentes o ajenos");
  let bytes = 0;
  for (const entry of entries) {
    const file = files.get(entry.name);
    if (!file || !Buffer.from(file.content, "utf8").equals(entry.data) || entry.data.length !== file.bytes) {
      throw new Error(`ZIP comercial no coincide con el corte acreditado: ${entry.name}`);
    }
    bytes += entry.data.length;
  }
  return { files: entries.length, bytes };
};

export const verifyCommercialExportZip = async (
  path: string, expected: readonly CommercialExportFile[]
): Promise<CommercialExportVerification> => {
  const info = await lstat(resolve(path));
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("ZIP comercial debe ser un archivo regular");
  return verifyCommercialExportArchive(await readFile(resolve(path)), expected);
};

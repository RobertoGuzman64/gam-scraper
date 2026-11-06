import type { CommercialEnvironment } from "../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import type { CommercialExportPlan } from "../projection/export-projection.js";
import { commercialReference } from "../diagnostics/commercial-baseline.js";
import { validateCommercialExportFiles } from "./commercial-export-verification.js";
import type { CommercialExportFile } from "./commercial-export.js";

export type CommercialPackageProvider = {
  readonly providerId: string;
  readonly publicationSha256: string;
  readonly file: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly sourceProducts: number;
  readonly summary: CommercialExportPlan["summary"];
  readonly excluded: number;
  readonly exceptions: number;
  readonly exceptionReasons: readonly { readonly reason: string; readonly count: number }[];
  readonly repeatedReferences: number;
  readonly fields: readonly string[];
};

export type CommercialPackageSnapshot = {
  readonly environment: CommercialEnvironment | null;
  readonly manifestSha256: string;
  readonly providers: readonly CommercialPackageProvider[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const parseRecord = (file: CommercialExportFile): Record<string, unknown> => {
  let value: unknown;
  try { value = JSON.parse(file.content); }
  catch { throw new Error(`JSON comercial inválido: ${file.name}`); }
  if (!isRecord(value)) throw new Error(`Estructura comercial inválida: ${file.name}`);
  return value;
};

const numeric = (source: Record<string, unknown>, field: string): number => {
  const value = source[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Resumen comercial inválido: ${field}`);
  }
  return value;
};

export const inspectCommercialPackage = (files: readonly CommercialExportFile[]): CommercialPackageSnapshot => {
  validateCommercialExportFiles(files);
  const byName = new Map(files.map((file) => [file.name, file]));
  const manifestFile = byName.get("commercial-manifest.json");
  if (!manifestFile) throw new Error("Falta manifiesto comercial");
  const manifest = parseRecord(manifestFile);
  if (!Array.isArray(manifest.providers) ||
    (manifest.environment !== null && manifest.environment !== "develop" && manifest.environment !== "production")) {
    throw new Error("Manifiesto comercial inválido");
  }
  const providers: CommercialPackageProvider[] = [];
  for (const item of manifest.providers) {
    if (!isRecord(item) || typeof item.providerId !== "string" || typeof item.publicationSha256 !== "string" ||
      typeof item.file !== "string" || typeof item.sha256 !== "string") {
      throw new Error("Proveedor comercial inválido");
    }
    const productFile = byName.get(item.file);
    if (!productFile) throw new Error(`Archivo comercial ausente: ${item.file}`);
    const plan = parseRecord(productFile);
    if (!Array.isArray(plan.products) || !Array.isArray(plan.exceptions) || !isRecord(plan.summary)) {
      throw new Error(`Plan comercial inválido: ${item.file}`);
    }
    const counts = new Map<string, number>();
    const references = new Map<string, number>();
    const fields = new Set<string>();
    for (const product of plan.products) {
      if (!isRecord(product)) throw new Error(`Producto comercial inválido: ${item.file}`);
      for (const field of Object.keys(product)) fields.add(field);
      if ((product.reference !== null && typeof product.reference !== "string") ||
        (product.externalReference !== undefined && product.externalReference !== null &&
          typeof product.externalReference !== "string")) {
        throw new Error(`Referencia comercial inválida: ${item.file}`);
      }
      const visibleReference = commercialReference({
        providerId: item.providerId,
        reference: typeof product.reference === "string" ? product.reference : null,
        externalReference: typeof product.externalReference === "string" ? product.externalReference : null
      });
      if (visibleReference) {
        const key = visibleReference.toLocaleUpperCase("es");
        references.set(key, (references.get(key) ?? 0) + 1);
      }
    }
    for (const issue of plan.exceptions) {
      if (!isRecord(issue) || typeof issue.reason !== "string") throw new Error("Excepción comercial inválida");
      counts.set(issue.reason, (counts.get(issue.reason) ?? 0) + 1);
    }
    const summary = plan.summary;
    providers.push({
      providerId: item.providerId,
      publicationSha256: item.publicationSha256,
      file: item.file,
      sha256: item.sha256,
      bytes: numeric(item, "bytes"),
      sourceProducts: numeric(item, "originalCount"),
      summary: {
        exported: numeric(summary, "exported"), categorized: numeric(summary, "categorized"),
        pendingCategory: numeric(summary, "pendingCategory"), excludedLots: numeric(summary, "excludedLots"),
        excludedTools: numeric(summary, "excludedTools"), excludedAccessories: numeric(summary, "excludedAccessories"),
        attributes: numeric(summary, "attributes"), withLogo: numeric(summary, "withLogo"),
        withPrice: numeric(summary, "withPrice"), withCompany: numeric(summary, "withCompany")
      },
      excluded: numeric(item, "excluded"),
      exceptions: numeric(item, "exceptions"),
      exceptionReasons: [...counts].map(([reason, count]) => ({ reason, count })).sort((a, b) => a.reason.localeCompare(b.reason)),
      repeatedReferences: [...references.values()].filter((count) => count > 1).length,
      fields: [...fields].sort()
    });
  }
  return { environment: manifest.environment, manifestSha256: manifestFile.sha256, providers };
};

export const assertCommercialPackageProviders = (snapshot: CommercialPackageSnapshot): void => {
  const expected = ["gam", "gomariz", "mercaeleva"];
  const actual = snapshot.providers.map((provider) => provider.providerId).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`El paquete comercial exige los tres proveedores acreditados: ${expected.join(", ")}`);
  }
};

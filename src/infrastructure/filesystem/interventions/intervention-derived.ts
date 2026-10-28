import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { basename, dirname, join, resolve } from "node:path";
import { parseCanonicalCatalog } from "../../../catalog/canonical-catalog.js";
import type { CanonicalCatalog } from "../../../catalog/canonical-catalog.js";
import type { InterventionProvenance } from "../../../catalog/preparation/offline-document.js";
import { applyInterventionToCatalog } from "../../../catalog/interventions/application.js";
import type { ManualInterventionProposal } from "../../../catalog/interventions/contracts.js";
import { parseAppliedInterventionRecord } from "../../../catalog/interventions/record.js";
import { simulateIntervention } from "../../../catalog/interventions/simulation.js";
import { readInterventionSource } from "./intervention-source.js";

const sha256 = (raw: Buffer): string => createHash("sha256").update(raw).digest("hex");
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export type VerifiedIntervention = {
  readonly catalog: CanonicalCatalog;
  readonly catalogSha256: string;
  readonly provenance: InterventionProvenance;
  readonly changes: readonly ManualInterventionProposal[];
};

export const readAppliedIntervention = async (derivedFile: string, originalFile: string): Promise<VerifiedIntervention> => {
  const file = resolve(derivedFile);
  if (basename(file) !== "catalog-derived.json") throw new Error("Se requiere catalog-derived.json de una intervención aplicada");
  const directory = dirname(file);
  const planDirectory = basename(directory);
  if (!/^[a-f0-9]{64}$/.test(planDirectory) || basename(dirname(directory)) !== "results") {
    throw new Error("Ruta de intervención fuera de la estructura de resultados");
  }
  const campaign = basename(dirname(dirname(directory)));
  const recordFile = join(directory, "intervention-record.json");
  const [raw, rawRecord, original] = await Promise.all([
    readFile(file), readFile(recordFile), readInterventionSource(originalFile)
  ]);
  const parsed: unknown = JSON.parse(raw.toString("utf8"));
  const record = parseAppliedInterventionRecord(JSON.parse(rawRecord.toString("utf8")) as unknown);
  if (!isRecord(parsed) || Object.keys(parsed).length !== 5 ||
    parsed.kind !== "manual-intervention-derived-catalog" || parsed.version !== 1 ||
    !isRecord(parsed.source) || !isRecord(parsed.catalog) ||
    record.campaign !== campaign || record.planSha256 !== planDirectory ||
    record.sourceCatalogSha256 !== original.catalogSha256 ||
    record.derivedCatalogSha256 !== sha256(raw) ||
    record.providerId !== original.catalog.providerId ||
    parsed.planSha256 !== record.planSha256 ||
    !isDeepStrictEqual(parsed.source, {
      providerId: original.catalog.providerId,
      prefix: original.catalog.prefix,
      scope: original.catalog.scope,
      catalogSha256: original.catalogSha256
    })) {
    throw new Error("Procedencia de intervención incoherente o alterada");
  }
  const simulation = simulateIntervention(original.catalog, original.catalogSha256, record.changes);
  if (simulation.planSha256 !== record.planSha256 ||
    simulation.analyzedProducts !== record.analyzedProducts ||
    simulation.affectedProducts !== record.affectedProducts ||
    !isDeepStrictEqual(record.changes, simulation.changes)) {
    throw new Error("El expediente no coincide con el plan de intervención");
  }
  const expected = applyInterventionToCatalog(original.catalog, simulation);
  const catalog = parseCanonicalCatalog(parsed.catalog);
  if (!isDeepStrictEqual(catalog, expected)) {
    throw new Error("El catálogo derivado difiere de los cambios autorizados");
  }
  const [currentRaw, currentRecord] = await Promise.all([readFile(file), readFile(recordFile)]);
  if (!currentRaw.equals(raw) || !currentRecord.equals(rawRecord)) {
    throw new Error("Los archivos de la intervención cambiaron durante la validación");
  }
  const provenance: InterventionProvenance = {
    campaign: record.campaign,
    sourceCatalogSha256: record.sourceCatalogSha256,
    planSha256: record.planSha256,
    derivedCatalogSha256: record.derivedCatalogSha256
  };
  return { catalog, catalogSha256: sha256(raw), provenance, changes: record.changes };
};

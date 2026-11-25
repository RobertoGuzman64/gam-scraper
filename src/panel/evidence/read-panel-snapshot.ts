import { join, resolve } from "node:path";
import { inspectCommercialPackage, assertCommercialPackageProviders } from "../../commercial/export/commercial-package-snapshot.js";
import { CAMPAIGN_PROVIDERS } from "../../contracts/campaign-providers.js";
import { readAccreditedPublication, resolveAccreditedPublication } from "../../infrastructure/filesystem/catalog/publications/accredited-publication.js";
import { parseTechnicalReport, selectTechnicalReportProviders } from "./report-metrics.js";
import type { TechnicalReportProvider } from "./report-metrics.js";
import { artifact, digest, inspectReport, recordFrom, regularText } from "./evidence-files.js";
import { assertCommercialLineage, readCommercialFiles, verifyCommercialReport } from "./commercial-evidence.js";
import { readPanelOriginalEvidence, readPublicationLineage, readRetention } from "./publication-evidence.js";
import type { PublicationLineage } from "./publication-evidence.js";
import type { PanelProviderEvidence, PanelProviderId, PanelProviderMetrics, PanelSnapshot, PanelTransformationMetrics } from "./types.js";

export { assertCommercialLineage } from "./commercial-evidence.js";
export { readPanelOriginalEvidence } from "./publication-evidence.js";

const addTransformations = (
  items: readonly PanelTransformationMetrics[]
): PanelTransformationMetrics => ({
  changedProducts: items.reduce((sum, item) => sum + item.changedProducts, 0),
  changedTitles: items.reduce((sum, item) => sum + item.changedTitles, 0),
  createdDescriptions: items.reduce((sum, item) => sum + item.createdDescriptions, 0),
  modifiedDescriptions: items.reduce((sum, item) => sum + item.modifiedDescriptions, 0),
  addedTechnicalKeys: items.reduce((sum, item) => sum + item.addedTechnicalKeys, 0),
  renamedTechnicalKeys: items.reduce((sum, item) => sum + item.renamedTechnicalKeys, 0),
  formattedTechnicalValues: items.reduce((sum, item) => sum + item.formattedTechnicalValues, 0),
  changedTechnicalValues: items.reduce((sum, item) => sum + item.changedTechnicalValues, 0)
});

const totals = (providers: readonly PanelProviderEvidence[]): PanelProviderMetrics => {
  const metrics = providers.map((item) => item.metrics);
  const sum = (key: Exclude<keyof PanelProviderMetrics, "transformations">): number =>
    metrics.reduce((total, item) => total + item[key], 0);
  return {
    originals: sum("originals"), published: sum("published"), excludedEditorial: sum("excludedEditorial"),
    exported: sum("exported"), excludedCommercial: sum("excludedCommercial"),
    categorized: sum("categorized"), pendingCategory: sum("pendingCategory"), attributes: sum("attributes"),
    withPrice: sum("withPrice"), exceptions: sum("exceptions"), repeatedReferences: sum("repeatedReferences"),
    transformations: addTransformations(metrics.map((item) => item.transformations))
  };
};

const verifyTechnicalReport = (
  providerId: PanelProviderId, row: TechnicalReportProvider, source: PublicationLineage,
  publicationSha256: string, published: number
): void => {
  if (row.originals !== source.source.productCount || row.published !== published ||
    row.excludedEditorial !== source.excludedEditorial ||
    !source.source.sha256.startsWith(row.originalShaPrefix) ||
    !source.approvalSha256.startsWith(row.approvalShaPrefix) ||
    !publicationSha256.startsWith(row.publicationShaPrefix)) {
    throw new Error(`Informe técnico no corresponde al corte activo: ${providerId}`);
  }
};

export const readPanelSnapshot = async (workspace: string): Promise<PanelSnapshot> => {
  const root = resolve(workspace);
  const [stored, technicalReport, commercialReport] = await Promise.all([
    readCommercialFiles(root),
    inspectReport(root, join(root, "catalogs", "reports", "individual-finish")),
    inspectReport(root, join(root, "catalogs", "reports", "commercial", "develop"))
  ]);
  const snapshot = inspectCommercialPackage(stored.files);
  assertCommercialPackageProviders(snapshot);
  if (snapshot.environment !== "develop" || snapshot.manifestSha256 !== stored.selectedSha256) {
    throw new Error("Selección comercial develop incompatible");
  }
  const date = verifyCommercialReport(commercialReport.content, snapshot.manifestSha256, snapshot.providers);
  const scope = CAMPAIGN_PROVIDERS.filter((id) => snapshot.providers.some((provider) => provider.providerId === id));
  let report = selectTechnicalReportProviders(parseTechnicalReport(technicalReport.content), scope);
  let selectedTechnicalReport = technicalReport;
  if (report === null) {
    if (technicalReport.previousSha256 === null) {
      throw new Error("No hay informe técnico compatible con el paquete comercial");
    }
    const previousPath = join(root, "catalogs", "reports", "individual-finish", "versions", technicalReport.previousSha256, "INFORME.txt");
    const previousContent = await regularText(previousPath);
    if (digest(previousContent) !== technicalReport.previousSha256) {
      throw new Error("Informe técnico histórico sin huella válida");
    }
    report = selectTechnicalReportProviders(parseTechnicalReport(previousContent), scope);
    if (report === null) {
      throw new Error("No hay informe técnico compatible con el paquete comercial");
    }
    selectedTechnicalReport = {
      content: previousContent, evidence: artifact(root, previousPath, technicalReport.previousSha256), previousSha256: null
    };
  }
  const providers: PanelProviderEvidence[] = [];
  for (const providerId of scope) {
    const path = await resolveAccreditedPublication(root, providerId);
    if (!path) throw new Error(`Publicación vigente ausente: ${providerId}`);
    const published = await readAccreditedPublication(path);
    const source = await readPublicationLineage(root, path, providerId, published.products.length);
    const previousApprovalSha256 = await readRetention(root, providerId, source.approvalSha256);
    const commercial = snapshot.providers.find((item) => item.providerId === providerId);
    const reportRow = report.find((item) => item.providerId === providerId);
    if (!commercial || !reportRow || commercial.publicationSha256 !== published.sha256 ||
      commercial.sourceProducts !== published.products.length) {
      throw new Error(`Cortes técnico y comercial no coincidentes: ${providerId}`);
    }
    verifyTechnicalReport(providerId, reportRow, source, published.sha256, published.products.length);
    const exported = stored.files.find((file) => file.name === commercial.file);
    if (!exported) throw new Error(`Producto comercial ausente: ${providerId}`);
    const plan = recordFrom(exported.content, exported.name);
    if (!Array.isArray(plan.products) || !Array.isArray(plan.sources) || !Array.isArray(plan.excluded)) {
      throw new Error(`Fichero comercial incompleto: ${providerId}`);
    }
    assertCommercialLineage(providerId, published.products, plan.products, plan.sources, plan.excluded);
    const metrics: PanelProviderMetrics = {
      originals: source.source.productCount,
      published: published.products.length,
      excludedEditorial: source.excludedEditorial,
      exported: commercial.summary.exported,
      excludedCommercial: commercial.excluded,
      categorized: commercial.summary.categorized,
      pendingCategory: commercial.summary.pendingCategory,
      attributes: commercial.summary.attributes,
      withPrice: commercial.summary.withPrice,
      exceptions: commercial.exceptions,
      repeatedReferences: commercial.repeatedReferences,
      transformations: reportRow.transformations
    };
    if (metrics.published !== metrics.exported + metrics.excludedCommercial ||
      metrics.exported !== metrics.categorized + metrics.pendingCategory) {
      throw new Error(`Poblaciones de métricas inconsistentes: ${providerId}`);
    }
    providers.push({
      providerId,
      approvalSha256: source.approvalSha256,
      previousApprovalSha256,
      publication: artifact(root, path, published.sha256),
      publicationManifest: source.manifest,
      original: await readPanelOriginalEvidence(root, providerId, source.source),
      commercial: artifact(root, join(root, "catalogs", "commercial", "develop", "versions", stored.selectedSha256, commercial.file), commercial.sha256),
      metrics,
      commercialSummary: commercial.summary
    });
  }
  return {
    environment: "develop", packageDateUtc: date,
    commercialManifest: artifact(root, join(root, "catalogs", "commercial", "develop", "versions", stored.selectedSha256, "commercial-manifest.json"), stored.selectedSha256),
    technicalReport: selectedTechnicalReport.evidence, commercialReport: commercialReport.evidence,
    retainedPreviousSha256: {
      commercial: stored.previousSha256,
      technicalReport: selectedTechnicalReport.previousSha256,
      commercialReport: commercialReport.previousSha256
    },
    providers, totals: totals(providers)
  };
};

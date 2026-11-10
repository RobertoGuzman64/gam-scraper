import type { AuditedFinding } from "../../catalog/diagnostics/finding-recognitions.js";
import { observeCommercialAccreditationFindings } from "../diagnostics/audited-findings.js";
import { analyzeCommercialBaseline } from "../diagnostics/commercial-baseline.js";
import type { CommercialBaseline } from "../diagnostics/commercial-baseline.js";
import { analyzeCommercialAttributes } from "../diagnostics/commercial-attributes.js";
import { analyzeCommercialPresentation } from "../diagnostics/commercial-presentation.js";
import { analyzeCommercialOutputConsistency } from "../diagnostics/commercial-output-consistency.js";
import { analyzeCommercialCrossCoverage } from "../diagnostics/commercial-cross-coverage.js";
import { prioritizeCommercialInterventions } from "../diagnostics/commercial-intervention-priorities.js";
import type { CommercialInterventionPriorities } from "../diagnostics/commercial-intervention-priorities.js";
import type { CommercialCrossCoverageAudit } from "../diagnostics/commercial-cross-coverage.js";
import type { CommercialOutputConsistencyAudit } from "../diagnostics/commercial-output-consistency.js";
import type { CommercialAttributeAudit } from "../diagnostics/commercial-attributes.js";
import type { CommercialPresentationAudit } from "../diagnostics/commercial-presentation.js";
import { loadImportCatalog } from "../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { loadCommercialReference } from "../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import { planCommercialExport } from "../projection/export-projection.js";
import { accreditCommercialPlan } from "../diagnostics/commercial-accreditation.js";
import type { CommercialAccreditation } from "../diagnostics/commercial-accreditation.js";
import type { CommercialExportPlan } from "../projection/export-projection.js";
import { loadCommercialPublicationInputs } from "./commercial-inputs.js";

export type CommercialAuditProvider = {
  readonly publicationSha256: string;
  readonly originalProducts: number;
  readonly baseline: CommercialBaseline;
  readonly attributeAudit: CommercialAttributeAudit;
  readonly presentationAudit: CommercialPresentationAudit;
  readonly outputConsistencyAudit: CommercialOutputConsistencyAudit;
  readonly crossCoverageAudit: CommercialCrossCoverageAudit;
  readonly interventionPriorities: CommercialInterventionPriorities;
  readonly accreditation: CommercialAccreditation;
  readonly exportAudit: {
    readonly summary: CommercialExportPlan["summary"];
    readonly excluded: number;
    readonly exceptions: number;
    readonly reasons: readonly { readonly reason: string; readonly affected: number }[];
  };
};

export type CommercialAudit = {
  readonly version: 2;
  readonly providers: readonly CommercialAuditProvider[];
};

export type CommercialAuditWithFindings = {
  readonly report: CommercialAudit;
  readonly findings: readonly AuditedFinding[];
};

const buildCommercialAudit = async (rootDirectory: string, collectFindings: boolean): Promise<CommercialAuditWithFindings> => {
  const [catalog, references] = await Promise.all([loadImportCatalog(), loadCommercialReference()]);
  const inputs = await loadCommercialPublicationInputs(rootDirectory, catalog);
  const findings: AuditedFinding[] = [];
  const report: CommercialAudit = { version: 2, providers: inputs.map(({ providerId, publicationSha256, originalProducts, entries }) => {
    const projected = planCommercialExport(entries, providerId, publicationSha256, catalog,
      references.brandLogos, null, null);
    const reasons = new Map<string, number>();
    for (const item of projected.exceptions) reasons.set(item.reason, (reasons.get(item.reason) ?? 0) + 1);
    const baseline = analyzeCommercialBaseline(entries);
    const attributeAudit = analyzeCommercialAttributes(entries, catalog);
    const presentationAudit = analyzeCommercialPresentation(entries);
    const outputConsistencyAudit = analyzeCommercialOutputConsistency(projected.products);
    const crossCoverageAudit = analyzeCommercialCrossCoverage(entries.map(({ published }) => published), projected.products);
    const accreditation = accreditCommercialPlan(entries, projected, catalog, references.brandLogos, null);
    if (collectFindings) findings.push(...observeCommercialAccreditationFindings(entries, projected.products, accreditation));
    return {
      publicationSha256, originalProducts, baseline, attributeAudit, presentationAudit,
      outputConsistencyAudit, crossCoverageAudit, accreditation,
      interventionPriorities: prioritizeCommercialInterventions({ accreditation, attributeAudit, presentationAudit,
        outputConsistencyAudit, crossCoverageAudit }),
      exportAudit: { summary: projected.summary, excluded: projected.excluded.length,
        exceptions: projected.exceptions.length, reasons: [...reasons].map(([reason, affected]) => ({ reason, affected }))
          .sort((a, b) => b.affected - a.affected || a.reason.localeCompare(b.reason, "es")) }
    };
  }) };
  return { report, findings };
};

export const auditCommercialCatalog = async (rootDirectory: string): Promise<CommercialAudit> =>
  (await buildCommercialAudit(rootDirectory, false)).report;

export const auditCommercialCatalogWithFindings = (rootDirectory: string): Promise<CommercialAuditWithFindings> =>
  buildCommercialAudit(rootDirectory, true);

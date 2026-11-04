import { analyzeCommercialBaseline } from "../../catalog/diagnostics/commercial-baseline.js";
import type { CommercialBaseline } from "../../catalog/diagnostics/commercial-baseline.js";
import { analyzeCommercialAttributes } from "../../catalog/diagnostics/commercial-attributes.js";
import { analyzeCommercialPresentation } from "../../catalog/diagnostics/commercial-presentation.js";
import type { CommercialAttributeAudit } from "../../catalog/diagnostics/commercial-attributes.js";
import type { CommercialPresentationAudit } from "../../catalog/diagnostics/commercial-presentation.js";
import { loadImportCatalog } from "../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { loadCommercialReference } from "../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import { planCommercialExport } from "../../catalog/commercial/export-projection.js";
import { accreditCommercialPlan } from "../../catalog/diagnostics/commercial-accreditation.js";
import type { CommercialAccreditation } from "../../catalog/diagnostics/commercial-accreditation.js";
import type { CommercialExportPlan } from "../../catalog/commercial/export-projection.js";
import { loadCommercialPublicationInputs } from "./commercial-inputs.js";

export type CommercialAuditProvider = {
  readonly publicationSha256: string;
  readonly originalProducts: number;
  readonly baseline: CommercialBaseline;
  readonly attributeAudit: CommercialAttributeAudit;
  readonly presentationAudit: CommercialPresentationAudit;
  readonly accreditation: CommercialAccreditation;
  readonly exportAudit: {
    readonly summary: CommercialExportPlan["summary"];
    readonly excluded: number;
    readonly exceptions: number;
    readonly reasons: readonly { readonly reason: string; readonly affected: number }[];
  };
};

export type CommercialAudit = {
  readonly version: 1;
  readonly providers: readonly CommercialAuditProvider[];
};

export const auditCommercialCatalog = async (rootDirectory: string): Promise<CommercialAudit> => {
  const [catalog, references] = await Promise.all([loadImportCatalog(), loadCommercialReference()]);
  const inputs = await loadCommercialPublicationInputs(rootDirectory, catalog);
  return { version: 1, providers: inputs.map(({ providerId, publicationSha256, originalProducts, entries }) => {
    const projected = planCommercialExport(entries, providerId, publicationSha256, catalog,
      references.brandLogos, null, null);
    const reasons = new Map<string, number>();
    for (const item of projected.exceptions) reasons.set(item.reason, (reasons.get(item.reason) ?? 0) + 1);
    return {
      publicationSha256, originalProducts, baseline: analyzeCommercialBaseline(entries),
      attributeAudit: analyzeCommercialAttributes(entries, catalog),
      presentationAudit: analyzeCommercialPresentation(entries),
      accreditation: accreditCommercialPlan(entries, projected, catalog, references.brandLogos, null),
      exportAudit: { summary: projected.summary, excluded: projected.excluded.length,
        exceptions: projected.exceptions.length, reasons: [...reasons].map(([reason, affected]) => ({ reason, affected }))
          .sort((a, b) => b.affected - a.affected || a.reason.localeCompare(b.reason, "es")) }
    };
  }) };
};

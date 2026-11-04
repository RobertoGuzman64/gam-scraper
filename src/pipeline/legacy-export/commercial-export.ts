import { createHash } from "node:crypto";
import { loadImportCatalogSnapshot } from "../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { loadCommercialReference } from "../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import type { CommercialEnvironment } from "../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import { planCommercialExport } from "../../catalog/commercial/export-projection.js";
import { accreditCommercialPlan } from "../../catalog/diagnostics/commercial-accreditation.js";
import { loadCommercialPublicationInputs } from "./commercial-inputs.js";

export type CommercialExportFile = {
  readonly name: string;
  readonly content: string;
  readonly sha256: string;
  readonly bytes: number;
};

const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
const serialized = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const file = (name: string, content: string): CommercialExportFile => ({
  name, content, sha256: hash(content), bytes: Buffer.byteLength(content, "utf8")
});

export const buildCommercialExportFiles = async (
  root: string, environment: CommercialEnvironment | null
): Promise<readonly CommercialExportFile[]> => {
  const [{ catalog, categoryRaw, attributeRaw }, references] = await Promise.all([
    loadImportCatalogSnapshot(), loadCommercialReference()
  ]);
  const inputs = await loadCommercialPublicationInputs(root, catalog);
  const plans = inputs.map((input) => {
    const companyID = environment === null ? null : references.companies[input.providerId]?.[environment];
    if (environment !== null && companyID === undefined) {
      throw new Error(`No existe companyID del proveedor ${input.providerId} para ${environment}`);
    }
    const plan = planCommercialExport(input.entries, input.providerId, input.publicationSha256,
      catalog, references.brandLogos, environment, companyID ?? null);
    const accreditation = accreditCommercialPlan(input.entries, plan, catalog, references.brandLogos, companyID ?? null);
    if (accreditation.summary.blocking > 0) {
      throw new Error(`Exportación comercial ${plan.providerId} con ${accreditation.summary.blocking} infracciones: ${accreditation.blocking.map((item) => item.reason).join(", ")}`);
    }
    return plan;
  });
  const products = plans.map((plan) => file(`${plan.providerId}-commercial.json`, serialized(plan)));
  const manifest = file("commercial-manifest.json", serialized({
    version: 1,
    environment,
    taxonomySha256: hash(categoryRaw),
    attributesSha256: hash(attributeRaw),
    logosSha256: hash(references.logoRaw),
    companiesSha256: hash(references.companyRaw),
    providers: plans.map((plan, index) => {
      const output = products[index];
      if (!output) throw new Error(`Falta la exportación del proveedor ${plan.providerId}`);
      return {
        providerId: plan.providerId,
        publicationSha256: plan.publicationSha256,
        originalCount: plan.total,
        ...plan.summary,
        excluded: plan.excluded.length,
        exceptions: plan.exceptions.length,
        file: output.name,
        sha256: output.sha256,
        bytes: output.bytes
      };
    })
  }));
  return [...products, manifest];
};

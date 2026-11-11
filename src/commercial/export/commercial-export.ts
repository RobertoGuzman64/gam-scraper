import { createHash } from "node:crypto";
import { loadImportCatalogSnapshot } from "../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { loadCommercialReference } from "../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import type { CommercialEnvironment } from "../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import { planCommercialExport } from "../projection/export-projection.js";
import type { CommercialExportPlan, CommercialExportProduct } from "../projection/export-projection.js";
import { buildProductIdentity } from "../../catalog/identity.js";
import { accreditCommercialPlan } from "../diagnostics/commercial-accreditation.js";
import { loadCommercialPublicationInputs, assertCurrentCommercialInventory } from "./commercial-inputs.js";
import { loadFindingRecognitionRegistry } from "../../infrastructure/filesystem/catalog/finding-recognition-store.js";
import { classifyFindingRecognitions } from "../../catalog/diagnostics/finding-recognitions.js";
import { observeCommercialAccreditationFindings } from "../diagnostics/audited-findings.js";
import { controlledCommercialField, createCommercialExceptionAccreditation } from "./commercial-exception-accreditation.js";

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

export type CommercialDeliveryProduct = Omit<CommercialExportProduct, "providerId" | "sourceUrl" | "externalReference">;

export type CommercialDeliverySource = {
  readonly identity: string;
  readonly reference: string | null;
  readonly sourceUrl: string;
  readonly externalReference?: string | null;
};

export type CommercialDeliveryPlan = Omit<CommercialExportPlan, "version" | "products"> & {
  readonly version: 2;
  readonly products: readonly CommercialDeliveryProduct[];
  readonly sources: readonly CommercialDeliverySource[];
};

type ReviewedException = {
  readonly fingerprint: string;
  readonly evidenceSha256: string;
  readonly field: string;
};

const exceptionKey = (reference: string | null, sourceUrl: string, reason: string): string =>
  JSON.stringify([reference, sourceUrl, reason]);

export const buildCommercialDeliveryPlan = (
  plan: CommercialExportPlan, recognitions: ReadonlyMap<string, ReviewedException> = new Map()
): CommercialDeliveryPlan => ({
  ...plan,
  version: 2,
  exceptions: plan.exceptions.map((issue) => {
    const finding = recognitions.get(exceptionKey(issue.reference, issue.sourceUrl, issue.reason));
    const product = plan.products.find((item) => item.sourceUrl === issue.sourceUrl);
    if (!finding || !product) return issue;
    const { providerId: _providerId, sourceUrl: _sourceUrl, externalReference: _externalReference, ...receiver } = product;
    return { ...issue, accreditation: createCommercialExceptionAccreditation(plan.providerId, issue, receiver, finding) };
  }),
  sources: plan.products.map((product) => ({
    identity: buildProductIdentity({ providerId: plan.providerId, reference: product.reference,
      serialNumber: null, url: product.sourceUrl }).key,
    reference: product.reference,
    sourceUrl: product.sourceUrl,
    ...(product.externalReference === undefined ? {} : { externalReference: product.externalReference })
  })),
  products: plan.products.map(({ providerId, sourceUrl, externalReference, ...receiver }) => receiver)
});

export const buildCommercialExportFiles = async (
  root: string, environment: CommercialEnvironment | null
): Promise<readonly CommercialExportFile[]> => {
  const [{ catalog, categoryRaw, attributeRaw }, references] = await Promise.all([
    loadImportCatalogSnapshot(), loadCommercialReference()
  ]);
  const [inputs, registry] = await Promise.all([
    loadCommercialPublicationInputs(root, catalog), loadFindingRecognitionRegistry(root)
  ]);
  await assertCurrentCommercialInventory(root, inputs);
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
    const withoutCompany = plan.products.map(({ companyID: _companyID, ...product }) => product);
    const findings = observeCommercialAccreditationFindings(input.entries, withoutCompany, accreditation);
    const classified = classifyFindingRecognitions(findings, registry);
    const recognitions = new Map<string, ReviewedException>();
    for (const item of classified.findings) {
      if (item.status !== "controlled" || !controlledCommercialField(item.finding.code)) continue;
      recognitions.set(exceptionKey(item.finding.reference, item.finding.sourceUrl, item.finding.code), {
        fingerprint: item.fingerprint, evidenceSha256: item.finding.evidenceSha256, field: item.finding.field
      });
    }
    return { plan, recognitions };
  });
  const products = plans.map(({ plan, recognitions }) => file(`${plan.providerId}-commercial.json`,
    serialized(buildCommercialDeliveryPlan(plan, recognitions))));
  const manifest = file("commercial-manifest.json", serialized({
    version: 2,
    environment,
    taxonomySha256: hash(categoryRaw),
    attributesSha256: hash(attributeRaw),
    logosSha256: hash(references.logoRaw),
    companiesSha256: hash(references.companyRaw),
    providers: plans.map(({ plan }, index) => {
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

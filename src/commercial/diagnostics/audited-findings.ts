import { createHash } from "node:crypto";
import type { ProductRecord } from "../../contracts/catalog.js";
import type { AuditedFinding } from "../../catalog/diagnostics/finding-recognitions.js";
import type { ImportCandidate } from "../legacy-export/contracts.js";
import type { CommercialBaselineInput } from "./commercial-baseline.js";
import type { CommercialAccreditation } from "./commercial-accreditation.js";
import type { PresentationConsistencyAudit } from "./presentation-consistency.js";
import type { CommercialExportProduct } from "../projection/export-projection.js";
import { assessCommercialHeight } from "../validation/height-consistency.js";
import { assessCommercialYear } from "../validation/year-consistency.js";
import { technicalLoadCapacityValue } from "../../catalog/validation/technical-specifications.js";

const signature = (values: readonly unknown[]): string =>
  createHash("sha256").update(JSON.stringify(values)).digest("hex");

const value = (input: unknown): string => JSON.stringify(input ?? null) ?? "null";

const key = (input: { readonly providerId: string; readonly reference: string | null; readonly sourceUrl: string }): string =>
  JSON.stringify([input.providerId, input.reference, input.sourceUrl]);

const commercialFacts = (reason: string, input: CommercialBaselineInput,
  product: CommercialExportProduct): AuditedFinding["facts"] => {
  if (reason === "ano-url-atributo-discordante") {
    const year = assessCommercialYear(product);
    return [{ name: "urlYear", value: value(year.urlYear) },
    { name: "attributeYear", value: value(year.attributeYear) }];
  }
  if (reason === "altura-titulo-resumen-discordante" || reason === "alturas-concepto-distinto-por-acreditar") {
    const height = assessCommercialHeight(product);
    return [{ name: "titleMetres", value: value(height.titleMetres) },
    { name: "summaryMetres", value: value(height.summaryMetres) },
    { name: "technicalMetres", value: value(height.technicalMetres) },
    { name: "assessment", value: height.status },
    { name: "sourceModel", value: value(input.source.model) },
    { name: "sourceTitle", value: value(input.source.title) },
    { name: "sourceShortDescription", value: value(input.source.shortDescription) },
    { name: "sourceTechnicalHeight", value: value(input.source.specs?.["Altura de elevación (m)"]) },
    { name: "sourceLongDescription", value: value(input.source.longDescription) }];
  }
  if (reason === "capacidad-titulo-spec-discordante") {
    return [{ name: "title", value: value(product.title) },
    { name: "technicalCapacity", value: value(technicalLoadCapacityValue(product.spec)) },
    { name: "summary", value: value(product.description) },
    { name: "sourceModel", value: value(input.source.model) },
    { name: "sourceTitle", value: value(input.source.title) },
    { name: "sourceCapacity", value: value(input.source.specs?.["Capacidad máxima de elevación"]) },
    { name: "publishedCapacity", value: value(input.published.spec["Capacidad máxima de elevación"]) }];
  }
  return [{ name: "publishedTitle", value: value(product.title) },
  {
    name: "commercialFields", value: value({
      spec: product.spec, attributes: product.attributes,
      categorySellID: product.categorySellID, description: product.description,
      description_general: product.description_general, image: product.image, images: product.images
    })
  }];
};

export const observeCommercialAccreditationFindings = (
  inputs: readonly CommercialBaselineInput[], products: readonly CommercialExportProduct[],
  accreditation: CommercialAccreditation
): readonly AuditedFinding[] => {
  const bySource = new Map(inputs.map((input) => [key(input.published), input]));
  const byProduct = new Map(products.map((product) => [key(product), product]));
  const observed: AuditedFinding[] = [];
  for (const decision of accreditation.decisions) {
    for (const reason of decision.pending) {
      const identity = key({
        providerId: accreditation.providerId, reference: decision.reference,
        sourceUrl: decision.sourceUrl
      });
      const input = bySource.get(identity);
      const product = byProduct.get(identity);
      if (!input || !product) throw new Error(`Acreditación pendiente sin evidencia individual: ${identity} | ${reason}`);
      observed.push({
        providerId: accreditation.providerId, reference: decision.reference,
        sourceUrl: decision.sourceUrl, field: reason === "ano-url-atributo-discordante" ? "year" :
          reason.includes("altura") ? "height" : reason.includes("capacidad") ? "capacity" : "commercial",
        code: reason, audit: "acreditacion_comercial", severity: "warn",
        evidenceSha256: signature([input.source, input.published, product]), facts: commercialFacts(reason, input, product)
      });
    }
  }
  if (observed.length !== accreditation.summary.pending) {
    throw new Error("Hallazgos individuales distintos de los avisos de acreditación");
  }
  return observed;
};

type CoherenceSource = { readonly source: ProductRecord; readonly product: ImportCandidate };

const preparationFacts = (source: ProductRecord, product: ImportCandidate,
  field: PresentationConsistencyAudit["findings"][number]["field"]): AuditedFinding["facts"] => {
  if (field === "images") return [
    { name: "originalImages", value: value([source.image, source.images]) },
    { name: "preparedImages", value: value([product.image, product.images]) },
    { name: "model", value: value(product.spec.Modelo) }];
  if (field === "title") return [
    { name: "originalTitle", value: value(source.title) },
    { name: "preparedTitle", value: value(product.title) },
    { name: "technicalModel", value: value(product.spec.Modelo) }];
  if (field === "description") return [
    { name: "originalDescriptions", value: value([source.shortDescription, source.longDescription]) },
    { name: "preparedDescriptions", value: value([product.description, product.description_general]) }];
  return [{ name: "originalSpecifications", value: value(source.specs) },
  { name: "preparedSpecifications", value: value(product.spec) },
  { name: "preparedTitle", value: value(product.title) }];
};

export const observePreparationCoherenceFindings = (
  sources: readonly CoherenceSource[], audit: PresentationConsistencyAudit
): readonly AuditedFinding[] => {
  const byIdentity = new Map(sources.map((item) => [key(item.product), item]));
  const observed: AuditedFinding[] = [];
  for (const finding of audit.findings) {
    if (finding.status !== "revisar") continue;
    const evidence = byIdentity.get(key(finding));
    if (!evidence) throw new Error(`Revisión de coherencia sin origen: ${key(finding)}`);
    observed.push({
      providerId: finding.providerId, reference: finding.reference, sourceUrl: finding.sourceUrl,
      field: finding.field, code: finding.code, audit: "coherencia_preparacion", severity: "revisar",
      evidenceSha256: signature([evidence.source, evidence.product]),
      facts: preparationFacts(evidence.source, evidence.product, finding.field)
    });
  }
  if (observed.length !== audit.reviews) throw new Error("Revisiones individuales distintas del diagnóstico de coherencia");
  return observed;
};

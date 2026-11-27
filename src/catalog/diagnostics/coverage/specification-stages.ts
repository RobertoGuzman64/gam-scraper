import { buildProductIdentity } from "../../identity.js";
import type { ImportCandidate } from "../../../commercial/legacy-export/contracts.js";
import type { DescriptionCoverageInput } from "./description-coverage.js";
import { analyzeTechnicalDensity, technicalSpecificationKeys } from "../technical/technical-density.js";
import { analyzePreparedTechnicalQuality } from "../technical/published-technical-quality.js";
import { analyzePreparedSpecificationImprovement, type SpecificationImprovementAudit, type SpecificationImprovementCase } from "./specification-improvement.js";
import { analyzePreparedSpecificationOpportunities } from "./specification-opportunities.js";
import { hasEssentialTechnicalSpec, publishedTechnicalKeys, technicalPriorityFamilyFor } from "./specification-family-priorities.js";

export type PreparedSpecificationInput = Pick<DescriptionCoverageInput, "source" | "prepared" | "origin">;

export const analyzePreparedSpecificationStage = (inputs: readonly PreparedSpecificationInput[], specs: boolean) => {
  const products = inputs.map((input) => input.prepared.product);
  const technicalDensity = analyzeTechnicalDensity(products);
  const improvements = specs ? analyzePreparedSpecificationImprovement(inputs, technicalDensity) : null;
  return {
    stage: "preparacion" as const,
    population: { products: inputs.length, ready: inputs.filter((input) => input.prepared.status === "ready").length,
      review: inputs.filter((input) => input.prepared.status === "review").length },
    technicalDensity,
    ...(improvements ? { technicalSemantics: analyzePreparedTechnicalQuality(products),
      specificationImprovements: improvements,
      technicalOpportunities: analyzePreparedSpecificationOpportunities(inputs, technicalDensity, improvements) } : {})
  };
};

type ComparisonStatus = "persiste" | "resuelto_en_preparacion" | "aparecido_en_preparacion" | "no_comparable";
type ComparisonCase = {
  readonly id: string;
  readonly identity: string;
  readonly origin: DescriptionCoverageInput["origin"];
  readonly status: ComparisonStatus;
  readonly published: SpecificationImprovementCase | null;
  readonly prepared: SpecificationImprovementCase | null;
};

const satisfies = (input: DescriptionCoverageInput, product: ImportCandidate, item: SpecificationImprovementCase,
  minimum: number): boolean => {
  if (item.kind === "cobertura") {
    return technicalSpecificationKeys(product.spec).length >= minimum;
  }
  const family = technicalPriorityFamilyFor(input, product);
  const essential = family?.name === item.family ? family.essential.find((field) => field.label === item.field) : undefined;
  return essential !== undefined && hasEssentialTechnicalSpec(publishedTechnicalKeys(product.spec), essential);
};

export const compareSpecificationStages = (inputs: readonly DescriptionCoverageInput[],
  published: SpecificationImprovementAudit, prepared: SpecificationImprovementAudit) => {
  if (published.totals.products !== inputs.length || prepared.totals.products !== inputs.length ||
    published.criteria.minimumTechnicalSpecs !== prepared.criteria.minimumTechnicalSpecs) {
    throw new Error("Poblaciones o criterios incompatibles en comparación de etapas técnicas");
  }
  const indexed = new Map(inputs.map((input) => [buildProductIdentity(input.source).key, input]));
  if (indexed.size !== inputs.length) throw new Error("Identidades duplicadas en comparación de etapas técnicas");
  const previous = new Map(published.cases.map((item) => [item.id, item]));
  const current = new Map(prepared.cases.map((item) => [item.id, item]));
  const cases: ComparisonCase[] = [];
  const totals: Record<ComparisonStatus, number> = { persiste: 0, resuelto_en_preparacion: 0,
    aparecido_en_preparacion: 0, no_comparable: 0 };
  for (const id of [...new Set([...previous.keys(), ...current.keys()])].sort()) {
    const before = previous.get(id) ?? null;
    const after = current.get(id) ?? null;
    const item = before ?? after;
    if (!item) continue;
    const identity = buildProductIdentity({ providerId: item.providerId, reference: item.reference, serialNumber: null, url: item.url }).key;
    const input = indexed.get(identity);
    if (!input) throw new Error(`Aviso sin identidad conciliada: ${identity}`);
    const minimum = published.criteria.minimumTechnicalSpecs;
    let status: ComparisonStatus = "no_comparable";
    if (before && after) {
      if (before.kind === "cobertura" || before.family === after.family) status = "persiste";
    } else if (before && satisfies(input, input.prepared.product, before, minimum)) {
      status = "resuelto_en_preparacion";
    } else if (after && satisfies(input, input.published, after, minimum)) {
      status = "aparecido_en_preparacion";
    }
    totals[status]++;
    cases.push({ id, identity, origin: input.origin, status, published: before, prepared: after });
  }
  return { note: "Mismas identidades conciliadas; una señal desaparecida sin presencia observable de la prestación no acredita una resolución. Las excepciones publicadas se conservan solo en su etapa.", totals, cases };
};

import { isDeepStrictEqual } from "node:util";
import { buildProductIdentity } from "../../identity.js";
import type { ImportCandidate } from "../../../commercial/legacy-export/contracts.js";
import type { DescriptionCoverageInput } from "./description-coverage.js";
import type { PreparedSpecificationInput } from "./specification-stages.js";
import { CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";
import type { AuditProviderFailure } from "../../../shared/audit-provider-results.js";

export type GapPopulationEntry = {
  readonly providerId: string;
  readonly state: "evaluado" | "parcial" | "reconstruido" | "ausente" | "incompleto" | "error";
  readonly eligible: number | null;
  readonly evaluated: number;
  readonly ready?: number;
  readonly review?: number;
  readonly detail?: string;
};

export const gapPopulationFailure = (providerId: string, failure: AuditProviderFailure, eligible: number | null = null): GapPopulationEntry => ({
  providerId, state: failure.category === "INCOMPLETE_SOURCE" ?
    /^(Falta original portátil:|Falta almacén portátil:|Falta registro parcial de )/u.test(failure.detail) ? "ausente" : "incompleto" : "error",
  eligible, evaluated: 0, detail: failure.detail
});

export const gapPopulation = (entries: readonly GapPopulationEntry[], selection?: readonly string[]) => {
  const expected = [...CAMPAIGN_PROVIDERS];
  const selected = selection ?? expected;
  if (new Set(entries.map((entry) => entry.providerId)).size !== entries.length || entries.some((entry) =>
    !selected.includes(entry.providerId) || entry.evaluated < 0 || (entry.eligible === null ? entry.evaluated !== 0 : entry.eligible < entry.evaluated) ||
    ((entry.ready !== undefined || entry.review !== undefined) && (entry.ready === undefined || entry.review === undefined || entry.ready + entry.review !== entry.evaluated)))) {
    throw new Error("Población diagnóstica incoherente");
  }
  const providers = [...new Set([...expected, ...selected])].map((providerId) => {
    if (!selected.includes(providerId)) return { providerId, state: "no_seleccionado" as const, eligible: null, evaluated: 0 };
    return entries.find((entry) => entry.providerId === providerId) ?? {
      providerId, state: "ausente" as const, eligible: null, evaluated: 0, detail: "No se dispone de fuente para esta etapa"
    };
  });
  const included = providers.filter((provider) => provider.state !== "no_seleccionado");
  const evaluated = included.reduce((sum, provider) => sum + provider.evaluated, 0);
  const knownEligible = included.reduce((sum, provider) => sum + (provider.eligible ?? 0), 0);
  const unknown = included.filter((provider) => provider.eligible === null);
  return { scope: selection === undefined ? "global" as const : "seleccion" as const, expected, selected: [...selected], excluded: providers.filter((provider) => provider.state === "no_seleccionado").map(({ providerId }) => ({ providerId, reason: "fuera_de_seleccion" })),
    discovered: included.filter((provider) => provider.eligible !== null).map((provider) => provider.providerId),
    processed: included.filter((provider) => provider.state === "evaluado" || provider.state === "parcial" || provider.state === "reconstruido").map((provider) => provider.providerId),
    complete: included.length > 0 && included.every((provider) => provider.state === "evaluado" && provider.eligible === provider.evaluated),
    providers, totals: { eligible: unknown.length ? null : knownEligible, knownEligible, evaluated,
      knownNotEvaluated: knownEligible - evaluated, unknownProviders: unknown.map((provider) => provider.providerId),
      errors: included.filter((provider) => provider.state === "error").length } };
};

export type GapPopulation = ReturnType<typeof gapPopulation>;

export const gapCheckCoverage = (population: GapPopulation, evaluated: number, excluded: number = 0, exclusionReason?: string) => {
  if (evaluated + excluded !== population.totals.evaluated) throw new Error("Cobertura de bloque incompatible con su población");
  const knownEligible = population.totals.knownEligible - excluded;
  const knownNotEvaluable = knownEligible - evaluated;
  return { eligible: population.totals.eligible === null || (exclusionReason !== undefined && knownNotEvaluable > 0) ? null : knownEligible,
    evaluated, excluded, ...(exclusionReason === undefined ? {} : { exclusionReason }),
    knownNotEvaluable, unknownProviders: population.totals.unknownProviders,
    errors: population.totals.errors, complete: population.complete };
};

export const gapPublishedIdentity = (product: ImportCandidate): string => buildProductIdentity({ providerId: product.providerId,
  reference: product.reference, serialNumber: null, url: product.sourceUrl }).key;

export const reconcileGapCurrentEntries = (current: readonly PreparedSpecificationInput[], matched: readonly DescriptionCoverageInput[],
  publications: readonly ImportCandidate[], unavailableProviders: readonly string[],
  currentSourceHashes: ReadonlyMap<string, string>, matchedSourceHashes: ReadonlyMap<string, string | null>) => {
  const published = new Map(publications.map((product) => [gapPublishedIdentity(product), product]));
  const accredited = new Map(matched.map((item) => [buildProductIdentity(item.source).key, item]));
  const cases = current.map(({ source, prepared, origin }) => {
    const identity = buildProductIdentity(source).key;
    const publication = published.get(identity);
    const comparison = accredited.get(identity);
    const currentSha = currentSourceHashes.get(source.providerId);
    const matchedSha = matchedSourceHashes.get(source.providerId);
    const sourceVersionMatches = currentSha !== undefined && matchedSha != null ? currentSha === matchedSha : null;
    const sameSource = sourceVersionMatches === true && comparison !== undefined && comparison.origin !== "reconstruccion_publicada" && isDeepStrictEqual(source, comparison.source);
    const state = publication ? sameSource ? "publicada_conciliada" as const : "publicada_no_conciliada" as const :
      unavailableProviders.includes(source.providerId) ? "publicacion_no_evaluable" as const : "sin_publicacion" as const;
    return { identity, providerId: source.providerId, origin, status: prepared.status, state, sourceVersionMatches,
      batchDiffers: sameSource && comparison ? !isDeepStrictEqual(prepared, comparison.prepared) : null };
  });
  const currentByIdentity = new Map(cases.map((item) => [item.identity, item]));
  const publishedCases = publications.map((product) => {
    const identity = gapPublishedIdentity(product);
    const current = currentByIdentity.get(identity);
    return { identity, providerId: product.providerId, state: current?.state === "publicada_conciliada" ? "conciliada" as const :
      current ? "no_conciliada" as const : currentSourceHashes.has(product.providerId) ? "sin_origen_vigente" as const : "origen_no_evaluable" as const };
  });
  return { totals: { products: cases.length, matched: cases.filter((item) => item.state === "publicada_conciliada").length,
    unmatched: cases.filter((item) => item.state === "publicada_no_conciliada").length,
    withoutPublication: cases.filter((item) => item.state === "sin_publicacion").length,
    withoutPublicationReady: cases.filter((item) => item.state === "sin_publicacion" && item.status === "ready").length,
    withoutPublicationReview: cases.filter((item) => item.state === "sin_publicacion" && item.status === "review").length,
    notEvaluable: cases.filter((item) => item.state === "publicacion_no_evaluable").length,
    batchDifferences: cases.filter((item) => item.batchDiffers === true).length }, cases,
    published: { totals: { products: publishedCases.length, matched: publishedCases.filter((item) => item.state === "conciliada").length,
      unmatched: publishedCases.filter((item) => item.state === "no_conciliada").length, withoutCurrentSource: publishedCases.filter((item) => item.state === "sin_origen_vigente").length,
      notEvaluable: publishedCases.filter((item) => item.state === "origen_no_evaluable").length }, cases: publishedCases } };
};

import { relative } from "node:path";
import { CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";
import { attachNormalizationPublications, inspectNormalizationProduct } from "../../../catalog/diagnostics/normalization-audit.js";
import { analyzeNormalizationImpact } from "../../../catalog/diagnostics/normalization-impact.js";
import { resolveAccreditedPublication, readAccreditedPublication } from "../catalog/accredited-publication.js";
import { accreditedPublicationOriginalSources } from "../catalog/accredited-publication-original.js";
import { editorialAuditFingerprints, loadEditorialAuditPopulation } from "./editorial-audit-population.js";
import { auditProviderCoverage, collectAuditProviderResults } from "../../../shared/audit-provider-results.js";

export const buildNormalizationAudit = async (workspace: string) => {
  const fingerprints = await editorialAuditFingerprints();
  const results = await collectAuditProviderResults(CAMPAIGN_PROVIDERS, async (providerId) => {
    const { records, prepared, provenance } = await loadEditorialAuditPopulation(workspace, providerId, fingerprints);
    if (records.length === 0 || records.length !== provenance.source.productCount) {
      throw new Error(`Población original incompleta en normalización: ${providerId}`);
    }
    const path = await resolveAccreditedPublication(workspace, providerId);
    if (!path) throw new Error(`No existe publicación acreditada de ${providerId}`);
    const publication = await readAccreditedPublication(path);
    if (publication.providerId !== providerId || publication.products.length === 0) {
      throw new Error(`Población publicada incompatible en normalización: ${providerId}`);
    }
    const originals = await accreditedPublicationOriginalSources(workspace, path, providerId);
    const observations = records.map((source, index) => {
      const product = prepared[index];
      if (!product) throw new Error(`Preparación incompleta en normalización: ${providerId}`);
      return inspectNormalizationProduct(source, product);
    });
    const attached = attachNormalizationPublications(observations, originals, providerId, publication.products, publication.sha256);
    const source = { providerId, ...provenance, publication: { path: relative(workspace, path),
      sha256: publication.sha256, runId: publication.runId, productCount: publication.products.length } };
    return { providerId, value: { source, observations: attached } };
  }, (providerId) => providerId);
  const sources = results.evaluated.map((item) => item.source);
  const population = { expected: CAMPAIGN_PROVIDERS, selected: CAMPAIGN_PROVIDERS,
    processed: sources.map((source) => source.providerId),
    unavailable: results.failures.filter((failure) => failure.category === "INCOMPLETE_SOURCE").map((failure) => failure.source),
    incomplete: results.failures.filter((failure) => failure.category === "ERROR").map((failure) => failure.source) };
  const report = analyzeNormalizationImpact(results.evaluated.flatMap((item) => item.observations));
  return { version: 1, complete: results.failures.length === 0 && sources.length === CAMPAIGN_PROVIDERS.length,
    provenance: { population, sources, fingerprints, preparation: "Vista recalculada en memoria con las reglas actuales, no preparación histórica" },
    auditCoverage: auditProviderCoverage(results), ...report };
};

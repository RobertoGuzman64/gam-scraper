import { basename } from "node:path";
import { CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";
import { buildProductIdentity } from "../../../catalog/identity.js";
import { gapPopulation, gapPopulationFailure, gapPublishedIdentity, type GapPopulationEntry } from "../../../catalog/diagnostics/coverage/content-gap-population.js";
import type { DescriptionCoverageInput } from "../../../catalog/diagnostics/coverage/description-coverage.js";
import type { PreparedSpecificationInput } from "../../../catalog/diagnostics/coverage/specification-stages.js";
import { reconstructMercaelevaSource } from "../../../catalog/diagnostics/coverage/description-source.js";
import { collectAuditProviderResults } from "../../../shared/audit-provider-results.js";
import type { PreparationFingerprints } from "../../../preparation/documents/offline-document.js";
import { prepareSourceProduct } from "../../../preparation/prepare-product.js";
import { originalSources } from "../catalog/originals/original-catalog-sources.js";
import { readAccreditedPublicationOriginal } from "../catalog/publications/accredited-publication-original.js";
import { discoverPublicationProviderIds, readAccreditedPublication, resolveAccreditedPublication } from "../catalog/publications/accredited-publication.js";
import { loadEditorialAuditPopulation } from "./editorial-audit-population.js";

export const loadGapPublications = async (root: string) => {
  await discoverPublicationProviderIds(root);
  const inspected = await collectAuditProviderResults([...CAMPAIGN_PROVIDERS].sort(), async (providerId) => {
    const path = await resolveAccreditedPublication(root, providerId);
    const publication = path === null ? null : await readAccreditedPublication(path);
    if (publication && publication.providerId !== providerId) throw new Error(`Publicación de proveedor distinto: ${providerId}`);
    return { providerId, value: publication && path ? { path, publication } : null };
  }, (providerId) => providerId);
  const publications = inspected.evaluated.flatMap((item) => item === null ? [] : [item]);
  const population = gapPopulation([...publications.map(({ publication }): GapPopulationEntry => ({
    providerId: publication.providerId, state: "evaluado", eligible: publication.products.length, evaluated: publication.products.length
  })), ...inspected.failures.map((failure) => gapPopulationFailure(failure.source, failure))]);
  return { publications, population, failures: inspected.failures };
};

type Publication = Awaited<ReturnType<typeof loadGapPublications>>["publications"][number];

export const loadGapComparison = async (root: string, publications: readonly Publication[]) => {
  const byProvider = new Map(publications.map((item) => [item.publication.providerId, item]));
  return collectAuditProviderResults([...byProvider.keys()], async (providerId) => {
    const item = byProvider.get(providerId);
    if (!item) throw new Error(`Publicación ausente: ${providerId}`);
    const { path, publication } = item;
    const original = providerId === "mercaeleva" && basename(path) !== "publishable.json" &&
      await originalSources(root, providerId) === null ? null :
      await readAccreditedPublicationOriginal(root, path, providerId);
    const sources = original?.sources ?? null;
    const origin = sources === null ? "reconstruccion_publicada" : providerId === "manain" ? "registro_parcial_verificado" : "original_canonico";
    const inputs: DescriptionCoverageInput[] = [];
    const identities = new Set<string>();
    for (const published of publication.products) {
      const identity = gapPublishedIdentity(published);
      const source = sources === null ? reconstructMercaelevaSource(published) : sources.get(identity);
      if (!source || source.url !== published.sourceUrl || source.providerId !== providerId ||
        buildProductIdentity(source).key !== identity || identities.has(identity)) {
        throw new Error(`Publicación sin origen canónico emparejado: ${identity}`);
      }
      identities.add(identity);
      inputs.push({ published, source, prepared: prepareSourceProduct(source), origin });
    }
    return { providerId, value: { publication, inputs, provenance: { providerId, origin,
      originalProducts: sources?.size ?? null, publishedProducts: publication.products.length,
      publicationSha256: publication.sha256, runId: publication.runId, path,
      originalSha256: original?.sourceSha256 ?? null } } };
  }, (providerId) => providerId);
};

export const loadGapCurrentPopulation = async (root: string, fingerprints: PreparationFingerprints) =>
  collectAuditProviderResults(CAMPAIGN_PROVIDERS, async (providerId) => {
    const population = await loadEditorialAuditPopulation(root, providerId, fingerprints);
    const origin = population.provenance.source.record ? "registro_parcial_verificado" : "original_canonico";
    const entries: PreparedSpecificationInput[] = population.records.map((source, index) => {
      const prepared = population.prepared[index];
      if (!prepared) throw new Error(`Preparación ausente: ${source.url}`);
      return { source, prepared, origin };
    });
    if (entries.length !== population.provenance.source.productCount) throw new Error(`Población de preparación incompleta: ${providerId}`);
    return { providerId, value: { entries, provenance: population.provenance } };
  }, (providerId) => providerId);

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { measurePublishedWork, aggregatePublishedWork } from "../catalog/diagnostics/published-work.js";
import type { PublishedWorkProvider, PublishedWorkReport } from "../catalog/diagnostics/published-work.js";
import { sha256 } from "../catalog/editorial/campaign-accreditation.js";
import { readPortableOriginalArtifacts } from "../infrastructure/filesystem/catalog/portable-original.js";
import { readAccreditedPublication, resolveAccreditedPublication } from "../infrastructure/filesystem/catalog/accredited-publication.js";
import { publicationApprovalSha } from "../infrastructure/filesystem/catalog/publication-identity.js";
import type { IndividualFinishResult } from "./individual-finish.js";
import { LEGACY_CAMPAIGN_PROVIDERS } from "../contracts/campaign-providers.js";

const matchingSourceHash = (files: readonly { readonly name: string; readonly content: string }[]): string => {
  const filesOfCatalog = files.filter(({ name }) => name.endsWith("-catalog.json"));
  if (filesOfCatalog.length !== 1 || !filesOfCatalog[0]) {
    throw new Error("Informe: original canónico no identificable");
  }
  return sha256(filesOfCatalog[0].content);
};

export const collectPublishedWork = async (
  workspace: string, result: IndividualFinishResult
): Promise<PublishedWorkReport> => {
  if (result.mode !== "complete" || result.providers.length === 0) {
    throw new Error("Informe disponible solo para publicaciones individuales activas");
  }
  const root = resolve(workspace);
  const requested = new Map(result.providers.map((item) => [item.providerId, item] as const));
  if (requested.size !== result.providers.length ||
    result.providers.some((item) => !LEGACY_CAMPAIGN_PROVIDERS.includes(item.providerId))) {
    throw new Error("Informe: proveedores solicitados duplicados o fuera de campaña");
  }
  const providers: PublishedWorkProvider[] = [];
  for (const providerId of LEGACY_CAMPAIGN_PROVIDERS) {
    const item = requested.get(providerId);
    const file = await resolveAccreditedPublication(root, providerId);
    if (!file) {
      if (item) throw new Error(`Informe: publicación vigente ausente de ${providerId}`);
      continue;
    }
    const approvalSha256 = await publicationApprovalSha(dirname(file));
    if (item && approvalSha256 !== item.approvalSha256) {
      throw new Error(`Informe: aprobación vigente cambiada para ${providerId}`);
    }
    const [published, original, manifestRaw] = await Promise.all([
      readAccreditedPublication(file),
      readPortableOriginalArtifacts(root, providerId),
      readFile(join(dirname(file), "manifest.json"), "utf8")
    ]);
    const manifest: unknown = JSON.parse(manifestRaw);
    const sourceSha256 = matchingSourceHash(original.files);
    if (!manifest || typeof manifest !== "object" || !("source" in manifest) ||
      !manifest.source || typeof manifest.source !== "object" ||
      !("catalogSha256" in manifest.source) || manifest.source.catalogSha256 !== sourceSha256) {
      throw new Error(`Informe: procedencia canónica distinta en ${providerId}`);
    }
    const work = measurePublishedWork(original.catalog.products, published.products);
    if (published.providerId !== providerId ||
      (item && (work.publishedProducts !== item.publishable || work.excludedProducts !== item.excluded))) {
      throw new Error(`Informe: cifras distintas del FINISH acreditado para ${providerId}`);
    }
    providers.push({ providerId, sourceSha256, approvalSha256,
      publicationSha256: published.sha256, work });
  }
  return aggregatePublishedWork(providers);
};


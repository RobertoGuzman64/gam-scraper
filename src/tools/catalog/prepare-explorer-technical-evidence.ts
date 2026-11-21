import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { originalRecordFingerprint } from "../../catalog/identity-fingerprint.js";
import { readAccreditedPublication } from "../../infrastructure/filesystem/catalog/accredited-publication.js";
import { readPortableOriginal } from "../../infrastructure/filesystem/catalog/portable-original.js";
import { readPanelSnapshot } from "../../panel/evidence/read-panel-snapshot.js";
import { readPanelUnitKnowledge } from "../../panel/evidence/knowledge-evidence.js";
import { resolvePanelFieldProvenance } from "./panel-field-provenance.js";
import { readPublicationTechnicalProvenance } from "../../panel/evidence/read-technical-provenance.js";
import { compareOriginalToPublished } from "../../panel/explorer/field-differences.js";
import { productIdentity } from "../../panel/explorer/explorer-identity.js";
import { fromOriginal, fromPublication } from "../../panel/explorer/explorer-product-view.js";
import { classifyPublishedTechnicalAdditions } from "../../preparation/technical-spec-classification.js";
import { explorerTechnicalEvidenceCachePath } from "./explorer-technical-evidence-cache.js";
import type { ExplorerTechnicalEvidenceCache } from "./explorer-technical-evidence-cache.js";

export const prepareExplorerTechnicalEvidence = async (workspace: string): Promise<string> => {
  const root = resolve(workspace);
  const snapshot = await readPanelSnapshot(root);
  const providers: ExplorerTechnicalEvidenceCache["providers"][number][] = [];
  const knowledge = await readPanelUnitKnowledge(root);
  for (const provider of snapshot.providers) {
    const published = await readAccreditedPublication(resolve(root, provider.publication.path));
    if (published.sha256 !== provider.publication.sha256 || published.providerId !== provider.providerId) {
      throw new Error(`Publicación distinta del corte acreditado: ${provider.providerId}`);
    }
    const originals = provider.original.status === "verified" ?
      await readPortableOriginal(root, provider.providerId) : null;
    if (originals && originals.products.length !== provider.metrics.originals) {
      throw new Error(`Población original incompatible: ${provider.providerId}`);
    }
    const source = new Map(originals?.products.map((item) =>
      [productIdentity(provider.providerId, item.reference, item.url), item] as const) ?? []);
    if (originals && source.size !== originals.products.length) {
      throw new Error(`Identidades originales duplicadas: ${provider.providerId}`);
    }
    const emitted = await readPublicationTechnicalProvenance(
      root, provider.publication.path, provider.providerId, provider.publication.sha256);
    if (emitted && emitted.products.length !== published.products.length) {
      throw new Error("Procedencias técnicas incompletas en publicación");
    }
    const traces = new Map((emitted?.products ?? []).map((item) =>
      [productIdentity(provider.providerId, item.reference, item.sourceUrl), item.technicalProvenance] as const));
    if (emitted && traces.size !== emitted.products.length) throw new Error("Procedencias técnicas duplicadas");
    const found = new Set<string>();
    const products = published.products.map((item) => {
      const identity = productIdentity(provider.providerId, item.reference, item.sourceUrl);
      if (found.has(identity)) throw new Error(`Publicación con identidad duplicada: ${identity}`);
      found.add(identity);
      const original = source.get(identity) ?? null;
      if (originals && (!original || original.reference !== item.reference || original.url !== item.sourceUrl)) {
        throw new Error(`Original sin correspondencia publicada: ${identity}`);
      }
      const trace = traces.get(identity) ?? null;
      if (emitted && !trace) throw new Error(`Publicación sin traza técnica: ${identity}`);
      if (original && trace && originalRecordFingerprint(original) !== trace.originalRecordSha256) {
        throw new Error(`Traza técnica para otra variante: ${identity}`);
      }
      const publishedView = fromPublication(item);
      const changes = original ? compareOriginalToPublished(fromOriginal(original), publishedView) : [];
      const additions = changes.filter((difference) => difference.group === "technical" && difference.change === "added")
        .map((difference) => ({ field: difference.field, value: difference.after ?? "" }));
      if (trace && trace.entries.some((entry) => !additions.some((addition) =>
        addition.field === entry.field && addition.value === entry.value))) {
        throw new Error(`Traza técnica incompatible con publicación: ${identity}`);
      }
      return { identity, additions: classifyPublishedTechnicalAdditions(original, trace, provider.providerId,
        item.reference, item.sourceUrl, provider.original.status === "verified", additions),
        provenance: resolvePanelFieldProvenance(original, publishedView, changes, provider, knowledge,
          item.reference, item.sourceUrl, trace) };
    });
    providers.push({ providerId: provider.providerId, publicationSha256: provider.publication.sha256,
      originalSha256: provider.original.status === "verified" ? provider.original.artifact.sha256 : null, products });
  }
  const content = JSON.stringify({ version: 1, knowledgeSha256: knowledge?.artifact.sha256 ?? null,
    providers } satisfies ExplorerTechnicalEvidenceCache) + "\n";
  const current = await readPanelSnapshot(root);
  const currentKnowledge = await readPanelUnitKnowledge(root);
  if (JSON.stringify(current) !== JSON.stringify(snapshot) ||
    currentKnowledge?.artifact.sha256 !== knowledge?.artifact.sha256) {
    throw new Error("El corte acreditado cambió durante la preparación de clasificaciones");
  }
  const target = explorerTechnicalEvidenceCachePath(root);
  await mkdir(dirname(target), { recursive: true });
  try {
    if (await readFile(target, "utf8") === content) return target;
  } catch (error: unknown) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content, { encoding: "utf8", flag: "wx" });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
  return target;
};

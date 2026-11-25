import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { originalRecordFingerprint } from "../../catalog/identity-fingerprint.js";
import { readAccreditedPublication } from "../../infrastructure/filesystem/catalog/publications/accredited-publication.js";
import { readPanelOriginalProducts } from "./publication-evidence.js";
import { readPanelSnapshot } from "./read-panel-snapshot.js";
import { readPublicationTechnicalProvenance } from "./read-technical-provenance.js";
import { compareOriginalToPublished } from "../explorer/field-differences.js";
import { productIdentity } from "../explorer/explorer-identity.js";
import { fromOriginal, fromPublication } from "../explorer/explorer-product-view.js";
import { buildPublishedTechnicalEditorialCohort, classifyPublishedTechnicalAdditions } from "../../preparation/provenance/technical-spec-classification.js";
import { prepareSourceProduct } from "../../preparation/prepare-product.js";
import { explorerTechnicalEvidenceCachePath } from "./explorer-technical-evidence-cache.js";
import type { ExplorerTechnicalEvidenceCache } from "./explorer-technical-evidence-cache.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import type { ProductTechnicalProvenance } from "../../contracts/technical-provenance.js";

export const prepareExplorerTechnicalEvidence = async (workspace: string): Promise<string> => {
  const root = resolve(workspace);
  const snapshot = await readPanelSnapshot(root);
  type StagedProduct = {
    readonly identity: string;
    readonly original: ProductRecord | null;
    readonly trace: ProductTechnicalProvenance | null;
    readonly reference: string | null;
    readonly sourceUrl: string;
    readonly providerId: string;
    readonly originalVerified: boolean;
    readonly additions: readonly { readonly field: string; readonly value: string }[];
  };
  type StagedProvider = Omit<ExplorerTechnicalEvidenceCache["providers"][number], "products"> & {
    readonly products: readonly StagedProduct[];
  };
  const staged: StagedProvider[] = [];
  for (const provider of snapshot.providers) {
    const published = await readAccreditedPublication(resolve(root, provider.publication.path));
    if (published.sha256 !== provider.publication.sha256 || published.providerId !== provider.providerId) {
      throw new Error(`Publicación distinta del corte acreditado: ${provider.providerId}`);
    }
    const originals = await readPanelOriginalProducts(root, provider);
    const source = new Map(originals?.map((item) =>
      [productIdentity(provider.providerId, item.reference, item.url), item] as const) ?? []);
    if (originals && source.size !== originals.length) {
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
      const publishedTrace = traces.get(identity) ?? null;
      if (emitted && !publishedTrace) throw new Error(`Publicación sin traza técnica: ${identity}`);
      if (original && publishedTrace && originalRecordFingerprint(original) !== publishedTrace.originalRecordSha256) {
        throw new Error(`Traza técnica para otra variante: ${identity}`);
      }
      const changes = original ? compareOriginalToPublished(fromOriginal(original), fromPublication(item)) : [];
      const additions = changes.filter((difference) => difference.group === "technical" && difference.change === "added")
        .map((difference) => ({ field: difference.field, value: difference.after ?? "" }));
      if (original && publishedTrace && publishedTrace.entries.some((entry) => !additions.some((addition) =>
        addition.field === entry.field && addition.value === entry.value))) {
        throw new Error(`Traza técnica incompatible con publicación: ${identity}`);
      }
      const trace = publishedTrace ?? (original && additions.length
        ? prepareSourceProduct(original).technicalProvenance ?? null : null);
      return { identity, original, trace, providerId: provider.providerId,
        reference: item.reference, sourceUrl: item.sourceUrl,
        originalVerified: provider.original.status === "verified", additions };
    });
    staged.push({ providerId: provider.providerId, publicationSha256: provider.publication.sha256,
      originalSha256: provider.original.status === "verified" ? provider.original.artifact.sha256 : null, products });
  }
  const cohort = buildPublishedTechnicalEditorialCohort(staged.flatMap((provider) => provider.products.map((product) => ({
    providerId: product.providerId, reference: product.reference, sourceUrl: product.sourceUrl,
    original: product.original, emitted: product.trace, originalVerified: product.originalVerified,
    additions: product.additions
  }))));
  const providers: ExplorerTechnicalEvidenceCache["providers"][number][] = staged.map((provider) => ({
    providerId: provider.providerId, publicationSha256: provider.publicationSha256,
    originalSha256: provider.originalSha256,
    products: provider.products.map((product) => ({
      identity: product.identity,
      additions: classifyPublishedTechnicalAdditions(product.original, product.trace, product.providerId,
        product.reference, product.sourceUrl, product.originalVerified, product.additions, cohort)
    }))
  }));
  const content = JSON.stringify({ version: 2, providers } satisfies ExplorerTechnicalEvidenceCache) + "\n";
  const current = await readPanelSnapshot(root);
  if (JSON.stringify(current) !== JSON.stringify(snapshot)) {
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

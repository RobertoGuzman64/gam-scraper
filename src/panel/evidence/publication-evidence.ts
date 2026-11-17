import { join, dirname, basename } from "node:path";
import { readAccreditedPublication } from "../../infrastructure/filesystem/catalog/accredited-publication.js";
import { readPortableOriginalArtifacts } from "../../infrastructure/filesystem/catalog/portable-original.js";
import { resolvePublicationDirectory } from "../../infrastructure/filesystem/catalog/publication-identity.js";
import { artifact, digest, isMissing, isRecord, isSha, recordFrom, regularText } from "./evidence-files.js";
import type { PanelArtifact, PanelOriginalEvidence, PanelProviderId } from "./types.js";

export type PublicationSource = {
  readonly sha256: string;
  readonly productCount: number;
  readonly prefix: string;
  readonly scope: string | null;
};

export type PublicationLineage = {
  readonly manifest: PanelArtifact;
  readonly source: PublicationSource;
  readonly approvalSha256: string;
  readonly excludedEditorial: number;
};

export const readPublicationLineage = async (
  root: string, file: string, providerId: PanelProviderId, publicationCount: number
): Promise<PublicationLineage> => {
  if (basename(file) !== `${providerId}-publishable.json`) {
    throw new Error(`La fase visual requiere publicación individual: ${providerId}`);
  }
  const path = join(dirname(file), "manifest.json");
  const raw = await regularText(path);
  const manifest = recordFrom(raw, path);
  const source = manifest.source;
  const totals = manifest.totals;
  if (manifest.version !== 1 || manifest.providerId !== providerId || !isSha(manifest.approvalSha256) ||
    !isRecord(source) || source.providerId !== providerId || !isSha(source.catalogSha256) ||
    typeof source.productCount !== "number" || !Number.isSafeInteger(source.productCount) || source.productCount < 1 ||
    typeof source.prefix !== "string" || !/^[a-zA-Z0-9_-]+$/.test(source.prefix) ||
    (source.scope !== undefined && (typeof source.scope !== "string" || !/^[a-f0-9]{16}$/.test(source.scope))) ||
    !isRecord(totals) || totals.original !== source.productCount || totals.publishable !== publicationCount ||
    typeof totals.excluded !== "number" || !Number.isSafeInteger(totals.excluded) || totals.excluded < 0 ||
    totals.original !== publicationCount + totals.excluded) {
    throw new Error(`Procedencia individual incompleta o inconsistente: ${providerId}`);
  }
  return {
    manifest: artifact(root, path, digest(raw)),
    source: { sha256: source.catalogSha256, productCount: source.productCount,
      prefix: source.prefix, scope: typeof source.scope === "string" ? source.scope : null },
    approvalSha256: manifest.approvalSha256,
    excludedEditorial: totals.excluded
  };
};

export const readPanelOriginalEvidence = async (
  root: string, providerId: PanelProviderId, source: PublicationSource
): Promise<PanelOriginalEvidence> => {
  let portable: Awaited<ReturnType<typeof readPortableOriginalArtifacts>>;
  try { portable = await readPortableOriginalArtifacts(root, providerId); }
  catch (error) {
    if (isMissing(error) || error instanceof Error &&
      /Falta original portátil|Falta almacén portátil/.test(error.message)) {
      return { status: "unavailable", expectedSha256: source.sha256, reason: "Original acreditado no conservado" };
    }
    throw error;
  }
  const raw = portable.files.find((file) => file.name.endsWith("-catalog.json"));
  if (!raw) throw new Error(`Archivo canónico original ausente: ${providerId}`);
  const sha256 = digest(raw.content);
  if (sha256 !== source.sha256 || portable.catalog.productCount !== source.productCount ||
    portable.catalog.prefix !== source.prefix ||
    (source.scope !== null && portable.catalog.scope !== source.scope)) {
    return { status: "unavailable", expectedSha256: source.sha256,
      reason: "El original portátil vigente no corresponde al corte publicado" };
  }
  return { status: "verified", products: portable.catalog.productCount,
    artifact: artifact(root, join(root, "catalogs", "providers", providerId, "original", raw.name), sha256) };
};

export const readRetention = async (root: string, providerId: PanelProviderId, approvalSha256: string): Promise<string | null> => {
  const base = join(root, "catalogs", "providers", providerId);
  const raw = await regularText(join(base, "publication-retention.json"));
  const retention = recordFrom(raw, join(base, "publication-retention.json"));
  if (retention.version !== 1 || retention.providerId !== providerId || retention.approvalSha256 !== approvalSha256 ||
    !(retention.previousSha256 === null || isSha(retention.previousSha256))) {
    throw new Error(`Retención individual incompatible: ${providerId}`);
  }
  const previous = retention.previousSha256;
  if (previous === null) return null;
  if (previous === approvalSha256) throw new Error(`Retención individual duplicada: ${providerId}`);
  const directory = await resolvePublicationDirectory(join(base, "publications"), previous);
  if (!directory) throw new Error(`Versión anterior no conservada: ${providerId}`);
  const verified = await readAccreditedPublication(join(directory, `${providerId}-publishable.json`));
  if (verified.providerId !== providerId) throw new Error(`Versión anterior de otro proveedor: ${providerId}`);
  return previous;
};

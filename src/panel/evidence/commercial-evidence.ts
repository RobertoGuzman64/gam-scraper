import { buildProductIdentity } from "../../catalog/identity.js";
import { join } from "node:path";
import { inspectRepositoryArtifact } from "../../infrastructure/filesystem/catalog/repository-artifact-snapshot.js";
import { LEGACY_CAMPAIGN_PROVIDERS } from "../../contracts/campaign-providers.js";
import type { ImportCandidate } from "../../commercial/legacy-export/contracts.js";
import type { CommercialExportFile } from "../../commercial/export/commercial-export.js";
import type { CommercialPackageProvider } from "../../commercial/export/commercial-package-snapshot.js";
import { digest, isRecord, recordFrom, regularText } from "./evidence-files.js";

const sourceIdentity = (providerId: string, item: Record<string, unknown>): string => {
  if (typeof item.sourceUrl !== "string" ||
    !(typeof item.reference === "string" || item.reference === null)) {
    throw new Error(`Fuente comercial sin URL o referencia: ${providerId}`);
  }
  return buildProductIdentity({ providerId, reference: item.reference, serialNumber: null, url: item.sourceUrl }).key;
};

export const assertCommercialLineage = (
  providerId: string, published: readonly Pick<ImportCandidate, "reference" | "sourceUrl">[],
  products: readonly unknown[], sources: readonly unknown[], excluded: readonly unknown[]
): void => {
  if (products.length !== sources.length) throw new Error(`Fuentes comerciales desalineadas: ${providerId}`);
  const publishedByIdentity = new Map<string, Pick<ImportCandidate, "reference" | "sourceUrl">>();
  for (const item of published) {
    const key = buildProductIdentity({ providerId, reference: item.reference, serialNumber: null, url: item.sourceUrl }).key;
    if (publishedByIdentity.has(key)) throw new Error(`Identidad publicada duplicada: ${providerId}: ${key}`);
    publishedByIdentity.set(key, item);
  }
  const seen = new Set<string>();
  for (const [index, item] of [...sources, ...excluded].entries()) {
    if (!isRecord(item)) throw new Error(`Fuente comercial inválida: ${providerId}: ${index}`);
    const identity = sourceIdentity(providerId, item);
    const original = publishedByIdentity.get(identity);
    if (item.identity !== identity || !original || item.reference !== original.reference ||
      item.sourceUrl !== original.sourceUrl || seen.has(identity)) {
      throw new Error(`Fuente comercial no vinculada a publicación: ${providerId}: ${index}`);
    }
    if (index < sources.length) {
      const product = products[index];
      if (!isRecord(product) || product.reference !== item.reference) {
        throw new Error(`Producto y fuente comercial desalineados: ${providerId}: ${index}`);
      }
    }
    seen.add(identity);
  }
  if (seen.size !== publishedByIdentity.size) {
    throw new Error(`Productos publicados sin trazabilidad comercial: ${providerId}`);
  }
};

export const readCommercialFiles = async (root: string): Promise<{
  readonly selectedSha256: string;
  readonly previousSha256: string | null;
  readonly files: readonly CommercialExportFile[];
}> => {
  const directory = join(root, "catalogs", "commercial", "develop");
  const names = ["commercial-manifest.json", ...LEGACY_CAMPAIGN_PROVIDERS.map((id) => `${id}-commercial.json`)];
  const selection = await inspectRepositoryArtifact(directory, "commercial-manifest.json", names);
  if (!selection) throw new Error("Paquete comercial develop ausente");
  const files: CommercialExportFile[] = [];
  for (const name of names) {
    const content = await regularText(join(directory, "versions", selection.sha256, name));
    files.push({ name, content, sha256: digest(content), bytes: Buffer.byteLength(content, "utf8") });
  }
  return { selectedSha256: selection.sha256, previousSha256: selection.previousSha256, files };
};

const commercialSection = (content: string, title: string): string => {
  const start = content.indexOf(title);
  if (start < 0 || content.indexOf(title, start + title.length) >= 0) {
    throw new Error(`Informe comercial sin sección única: ${title}`);
  }
  const body = content.slice(start + title.length);
  const next = body.search(/\n#{2,3} /);
  return next < 0 ? body : body.slice(0, next);
};

export const verifyCommercialReport = (
  content: string, sha256: string, providers: readonly CommercialPackageProvider[]
): string => {
  if (!content.includes(`- Huella comercial: ${sha256}`) ||
    !content.includes("- Integración en base de datos: NO VERIFICADO EN BD")) {
    throw new Error("Informe comercial no corresponde al paquete o no declara su alcance");
  }
  const match = /^- Fecha del paquete \(UTC\): (\d{4}-\d{2}-\d{2})$/m.exec(content);
  const date = match?.[1];
  if (!date || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))) {
    throw new Error("Informe comercial sin fecha de paquete acreditada");
  }
  for (const provider of providers) {
    const section = commercialSection(content, `### ${provider.providerId.toUpperCase()} — ${provider.file}\n`);
    if (!section.includes(`- Publicación técnica SHA256: ${provider.publicationSha256}`) ||
      !section.includes(`- JSON SHA256: ${provider.sha256}; bytes UTF-8: ${provider.bytes}.`) ||
      !section.includes(`- Técnicas incluidas: ${provider.sourceProducts}; exportadas: ${provider.summary.exported};`)) {
      throw new Error(`Informe comercial de otro corte: ${provider.providerId}`);
    }
  }
  return date;
};

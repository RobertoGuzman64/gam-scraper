import { resolve } from "node:path";
import { buildProductIdentity } from "../../catalog/identity.js";
import type { ImportCatalog } from "../legacy-export/contracts.js";
import type { CommercialBaselineInput } from "../diagnostics/commercial-baseline.js";
import { prepareImportBatch } from "../../preparation/batch-identity.js";
import { projectCommercialCategory } from "../projection/category-projection.js";
import { originalSources } from "../../infrastructure/filesystem/catalog/original-catalog-sources.js";
import { publicationOriginalSources } from "../../infrastructure/filesystem/catalog/accredited-publication-original.js";
import { discoverAccreditedPublications, readAccreditedPublication } from "../../infrastructure/filesystem/catalog/accredited-publication.js";

export type CommercialPublicationInputs = {
  readonly providerId: string;
  readonly publicationSha256: string;
  readonly originalProducts: number;
  readonly entries: readonly CommercialBaselineInput[];
};

export const loadCommercialPublicationInputs = async (
  rootDirectory: string, catalog: ImportCatalog
): Promise<readonly CommercialPublicationInputs[]> => {
  const root = resolve(rootDirectory);
  const paths = await discoverAccreditedPublications(root);
  if (paths.length === 0) throw new Error("No hay publicaciones técnicas acreditadas para preparar");
  const providers: CommercialPublicationInputs[] = [];
  for (const path of paths) {
    const publication = await readAccreditedPublication(path);
    const sources = await publicationOriginalSources(root, path, publication.providerId, publication.products);
    if (!sources) throw new Error(`Falta el original canónico para ${publication.providerId}`);
    const selected = publication.products.map((product) => {
      const identity = buildProductIdentity({ providerId: product.providerId, reference: product.reference,
        serialNumber: null, url: product.sourceUrl }).key;
      const source = sources.get(identity);
      if (!source) throw new Error(`Publicación sin original acreditado: ${identity}`);
      return source;
    });
    const mapped = prepareImportBatch(selected, catalog);
    const entries = publication.products.map((published, index): CommercialBaselineInput => {
      const source = selected[index];
      const proposed = mapped.products[index];
      if (!source || !proposed) throw new Error(`No se pudo preparar la identidad ${published.reference}`);
      return { source, published, mapped: projectCommercialCategory(source, proposed, catalog) };
    });
    providers.push({ providerId: publication.providerId, publicationSha256: publication.sha256,
      originalProducts: sources.size, entries });
  }
  return providers;
};

export const assertCurrentCommercialInventory = async (
  rootDirectory: string, inputs: readonly CommercialPublicationInputs[]
): Promise<void> => {
  const root = resolve(rootDirectory);
  for (const provider of inputs) {
    const current = await originalSources(root, provider.providerId);
    if (!current) throw new Error(`No existe inventario canónico vigente de ${provider.providerId}`);
    const missing = provider.entries.filter(({ published }) => {
      const identity = buildProductIdentity({ providerId: published.providerId, reference: published.reference,
        serialNumber: null, url: published.sourceUrl }).key;
      return !current.has(identity);
    });
    if (missing.length > 0) {
      const examples = missing.slice(0, 12).map(({ published }) => published.reference ?? published.sourceUrl).join(", ");
      throw new Error(`Exportación comercial bloqueada: ${provider.providerId} conserva ${missing.length} referencias ausentes del original vigente (${examples}). Reconciliar las bajas y acreditar una publicación comercial nueva; el origen histórico solo es válido para auditoría`);
    }
  }
};

import { resolve } from "node:path";
import { buildProductIdentity } from "../../catalog/identity.js";
import type { ImportCatalog } from "../../catalog/legacy-export/contracts.js";
import type { CommercialBaselineInput } from "../../catalog/diagnostics/commercial-baseline.js";
import { prepareImportBatch } from "../../catalog/preparation/batch-identity.js";
import { originalSources } from "../../infrastructure/filesystem/catalog/original-catalog-sources.js";
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
    const sources = await originalSources(root, publication.providerId);
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
      return { source, published, mapped: proposed };
    });
    providers.push({ providerId: publication.providerId, publicationSha256: publication.sha256,
      originalProducts: sources.size, entries });
  }
  return providers;
};

import { buildProductIdentity } from "../../catalog/identity.js";
import type { CommercialBaselineInput } from "../../commercial/diagnostics/commercial-baseline.js";
import type { CommercialPublicationInputs } from "../../commercial/export/commercial-inputs.js";
import { projectCommercialCategory } from "../../commercial/projection/category-projection.js";
import type { ImportCatalog } from "../../commercial/legacy-export/contracts.js";
import { originalSources } from "../../infrastructure/filesystem/catalog/original-catalog-sources.js";
import { readAccreditedPublication, resolveAccreditedPublication } from "../../infrastructure/filesystem/catalog/accredited-publication.js";
import { prepareImportBatch } from "../../preparation/batch-identity.js";

export const selectAccreditedCommercialInputs = async (
  root: string, catalog: ImportCatalog, selection: Readonly<Record<string, readonly string[]>>
): Promise<ReadonlyMap<string, CommercialPublicationInputs>> => {
  const result = new Map<string, CommercialPublicationInputs>();
  for (const [providerId, references] of Object.entries(selection)) {
    const selected = new Set(references);
    if (selected.size !== references.length) throw new Error(`Referencias repetidas en selección ${providerId}`);
    const path = await resolveAccreditedPublication(root, providerId);
    if (!path) throw new Error(`No existe publicación vigente de ${providerId}`);
    const [publication, sources] = await Promise.all([
      readAccreditedPublication(path), originalSources(root, providerId)
    ]);
    if (!sources) throw new Error(`No existe original canónico de ${providerId}`);
    const products = publication.products.filter((item) => item.reference !== null && selected.has(item.reference));
    if (products.length !== selected.size) throw new Error(`Selección de ${providerId} incompleta o duplicada`);
    const originals = products.map((item) => {
      const identity = buildProductIdentity({ providerId: item.providerId, reference: item.reference,
        serialNumber: null, url: item.sourceUrl }).key;
      const source = sources.get(identity);
      if (!source) throw new Error(`Publicación sin original acreditado: ${identity}`);
      return source;
    });
    const mapped = prepareImportBatch(originals, catalog);
    const entries = products.map((published, index): CommercialBaselineInput => {
      const source = originals[index];
      const prepared = mapped.products[index];
      if (!source || !prepared) throw new Error(`Selección de ${providerId} incoherente`);
      return { source, published, mapped: projectCommercialCategory(source, prepared, catalog) };
    });
    result.set(providerId, { providerId, publicationSha256: publication.sha256, originalProducts: sources.size, entries });
  }
  return result;
};

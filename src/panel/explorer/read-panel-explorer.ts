import { resolve } from "node:path";
import { readCommercialFiles } from "../evidence/commercial-evidence.js";
import type { PanelSnapshot } from "../evidence/types.js";
import { readProviderExplorerProducts } from "./explorer-provider-reader.js";
import { readExplorerTechnicalEvidence } from "../evidence/explorer-technical-evidence-cache.js";
import { selectPresentationCases } from "./explorer-presentation-cases.js";
import type { PanelExplorerPayload, PanelExplorerProduct } from "./types.js";
export { selectPresentationCases } from "./explorer-presentation-cases.js";

export const readPanelExplorer = async (workspace: string, snapshot: PanelSnapshot): Promise<PanelExplorerPayload> => {
  const root = resolve(workspace);
  const stored = await readCommercialFiles(root);
  if (stored.selectedSha256 !== snapshot.commercialManifest.sha256) {
    throw new Error("Corte comercial cambiado durante la lectura del panel");
  }
  const technicalEvidence = await readExplorerTechnicalEvidence(root, snapshot);
  const products: PanelExplorerProduct[] = [];
  for (const provider of snapshot.providers) {
    const file = stored.files.find((item) => item.name === `${provider.providerId}-commercial.json`);
    if (!file) throw new Error(`Fichero comercial no disponible: ${provider.providerId}`);
    const prepared = technicalEvidence.get(provider.providerId);
    if (!prepared) throw new Error(`Faltan evidencias técnicas precalculadas: ${provider.providerId}`);
    products.push(...await readProviderExplorerProducts(root, provider, file.content, prepared));
  }
  if (products.length !== snapshot.totals.originals) throw new Error("Totales del explorador incoherentes");
  return { products, cases: selectPresentationCases(products),
    originalComparisonsAvailable: snapshot.providers.every((provider) => provider.original.status === "verified") };
};

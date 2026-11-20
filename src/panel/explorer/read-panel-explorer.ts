import { resolve } from "node:path";
import { readCommercialFiles } from "../evidence/commercial-evidence.js";
import { readPanelUnitKnowledge } from "../evidence/knowledge-evidence.js";
import { loadSpecAdditionAudit } from "../evidence/spec-addition-audit.js";
import type { PanelSnapshot } from "../evidence/types.js";
import { readProviderExplorerProducts } from "./explorer-provider-reader.js";
import { selectPresentationCases } from "./explorer-presentation-cases.js";
import type { PanelExplorerPayload, PanelExplorerProduct } from "./types.js";
export { selectPresentationCases } from "./explorer-presentation-cases.js";

export const readPanelExplorer = async (workspace: string, snapshot: PanelSnapshot): Promise<PanelExplorerPayload> => {
  const root = resolve(workspace);
  const stored = await readCommercialFiles(root);
  if (stored.selectedSha256 !== snapshot.commercialManifest.sha256) {
    throw new Error("Corte comercial cambiado durante la lectura del panel");
  }
  const [knowledge, audit] = await Promise.all([readPanelUnitKnowledge(root), loadSpecAdditionAudit(root)]);
  const products: PanelExplorerProduct[] = [];
  for (const provider of snapshot.providers) {
    const file = stored.files.find((item) => item.name === `${provider.providerId}-commercial.json`);
    if (!file) throw new Error(`Fichero comercial no disponible: ${provider.providerId}`);
    products.push(...await readProviderExplorerProducts(root, provider, file.content, knowledge, audit));
  }
  if (products.length !== snapshot.totals.originals) throw new Error("Totales del explorador incoherentes");
  const currentKnowledge = await readPanelUnitKnowledge(root);
  if (currentKnowledge?.artifact.sha256 !== knowledge?.artifact.sha256) {
    throw new Error("El índice de conocimiento cambió durante la lectura del panel");
  }
  return { products, cases: selectPresentationCases(products),
    originalComparisonsAvailable: snapshot.providers.every((provider) => provider.original.status === "verified") };
};

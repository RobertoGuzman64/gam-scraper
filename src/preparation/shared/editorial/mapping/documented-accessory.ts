import type { ProductRecord } from "../../../../contracts/catalog.js";
import { recoverGamDocumentedMobilityAndAccessSpecs } from "../../../gam/technical/models/documented-mobility-and-access-specs.js";
import { sameEditorialUnit } from "../domain/editorial-source-contract.js";

export const resolveDocumentedAccessoryEditorial = (
  source: ProductRecord, prepared: ProductRecord
): { readonly short: string; readonly general: string } | null => {
  if (!sameEditorialUnit(source, prepared) ||
    source.condition !== "Nuevo" ||
    source.title !== "SKY DECK" || source.brand !== "BRAVI" || source.model !== "SKY DECK" ||
    source.shortDescription !== null || source.longDescription !== null || !source.specs || !prepared.specs ||
    source.specs.Marca !== "BRAVI" || source.specs.Modelo !== "SKY DECK") return null;
  const documented = recoverGamDocumentedMobilityAndAccessSpecs(source, source.specs);
  const required = [
    ["Peso neto del portapaneles", "4,2 kg"],
    ["Dimensiones del panel admitido", "1500 x 750 x 120 mm"],
    ["Número máximo de soportes por Leonardo HD", "3"],
    ["Montaje del soporte", "Sin herramientas"]
  ] as const;
  if (documented === source.specs || required.some(([key, value]) =>
    source.specs?.[key] !== undefined || documented[key] !== value || prepared.specs?.[key] !== value)) return null;
  return {
    short: "Portapaneles BRAVI SKY DECK, accesorio documentado para plataforma Leonardo HD.",
    general: "El portapaneles BRAVI SKY DECK es un accesorio para manipular paneles Skydeck sobre la plataforma Leonardo HD. El manual del fabricante indica un peso neto del soporte de 4,2 kg y dimensiones de panel admitido de 1.500 × 750 × 120 mm. Establece un máximo de tres soportes por plataforma Leonardo HD y documenta su montaje sin herramientas. La instalación, los límites de carga y el uso deben ajustarse al manual de seguridad del fabricante; el peso del accesorio no representa su capacidad de carga."
  };
};

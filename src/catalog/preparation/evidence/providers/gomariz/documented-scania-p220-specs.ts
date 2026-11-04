import { applyDocumentedTechnicalEvidence } from "../../documented-technical-evidence.js";
import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";

type DocumentedUnit = {
  readonly fingerprint: string;
  readonly brand: string | null;
  readonly model: string | null;
  readonly categoryKey: string;
  readonly source: string;
  readonly specifications: Readonly<SpecsMap>;
};

const documentedUnits: Readonly<Record<string, DocumentedUnit>> = {
  "5051BDX": {
    "fingerprint": "0af56dea786172d4425105e42548ef1dc2b80c019a1fefae4bb7f67ecdaf1639",
    "brand": "Scania",
    "model": "P220",
    "categoryKey": "venta",
    "source": "https://www.gomarizrent.com/venta/camion/camion-porta-maquinaria/scania-p220-camion-truck-porta-maquinaria/",
    "specifications": {
      "Potencia aproximada del motor": "220 CV"
    }
  }
};

export const recoverGomarizDocumentedScaniaP220Specs = (record: ProductRecord, specs: SpecsMap): SpecsMap =>
  applyDocumentedTechnicalEvidence(record, specs, documentedUnits, { providerId: "gomariz", isEligible: (value) => value.url.startsWith("https://www.gomarizrent.com/") });

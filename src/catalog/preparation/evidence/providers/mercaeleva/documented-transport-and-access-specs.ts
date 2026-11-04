import { applyDocumentedTechnicalEvidence } from "../../documented-technical-evidence.js";
import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { validMercaelevaTechnicalSource } from "../../../mapping/providers/mercaeleva/technical.js";

type DocumentedUnit = {
  readonly fingerprint: string;
  readonly brand: string | null;
  readonly model: string | null;
  readonly categoryKey: string;
  readonly source: string;
  readonly specifications: Readonly<SpecsMap>;
};

const documentedUnits: Readonly<Record<string, DocumentedUnit>> = {
  "M294-4678": {
    "fingerprint": "8d9ba69d8f5b42cdff133fb922ae2801b5b726b80f484991d011b4a07321c29d",
    "brand": null,
    "model": null,
    "categoryKey": "venta",
    "source": "https://sales.mercaeleva.com/es/for-sale/machine/M294-4678",
    "specifications": {
      "Longitud exterior anunciada": "6 m",
      "Anchura exterior anunciada": "2,35 m",
      "Climatización instalada según anuncio": "Aire acondicionado",
      "Ubicación de la puerta": "Lado corto"
    }
  },
  "M928-9933": {
    "fingerprint": "8cd7bf6ed8b48af98327bfa4edfc2f3c1a00374ecdc48400aba41e371235ba0b",
    "brand": "Iveco",
    "model": "ML120E22/P",
    "categoryKey": "venta",
    "source": "https://sales.mercaeleva.com/es/for-sale/machine/Iveco-ML120E22-P-M928-9933",
    "specifications": {
      "Configuración de ejes declarada": "4x2",
      "Masa máxima autorizada declarada": "12.000 kg",
      "Arquitectura del motor declarada": "6 cilindros en línea"
    }
  },
  "M028-8481": {
    "fingerprint": "eff4043597ea573f6eb62e5e0b17da7812720fcb92d0802a7339015dd17e543c",
    "brand": "Genie",
    "model": "GR-15",
    "categoryKey": "venta",
    "source": "https://www.genielift.com/warehouse/en/aerial-work-platforms-vertical-mast-lifts/vertical-mast-lifts/gr-15",
    "specifications": {
      "Capacidad nominal de la plataforma estándar": "227 kg",
      "Anchura de la máquina": "0,75 m"
    }
  },
  "M582-1882": {
    "fingerprint": "a7cde310db01f73bf5a7ae815c73dda5afcd5a7bee186b245987b9bcb282beb7",
    "brand": "UniCarriers",
    "model": "E2D2A30",
    "categoryKey": "venta",
    "source": "https://sales.mercaeleva.com/es/for-sale/machine/UniCarriers-E2D2A30-M582-1882",
    "specifications": {
      "Combustible del motor": "Diésel"
    }
  }
};

export const recoverMercaelevaDocumentedTransportAndAccessSpecs = (record: ProductRecord, specs: SpecsMap): SpecsMap =>
  applyDocumentedTechnicalEvidence(record, specs, documentedUnits, { providerId: "mercaeleva", isEligible: (value) => validMercaelevaTechnicalSource(value) });

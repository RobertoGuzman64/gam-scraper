import { applyDocumentedTechnicalEvidence } from "../../../shared/technical/evidence/documented-technical-evidence.js";
import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { validMercaelevaTechnicalSource } from "../mapping/technical.js";

type DocumentedUnit = {
  readonly fingerprint: string;
  readonly brand: string | null;
  readonly model: string | null;
  readonly categoryKey: string;
  readonly source: string;
  readonly specifications: Readonly<SpecsMap>;
};

const documentedUnits: Readonly<Record<string, DocumentedUnit>> = {
  "M547-2372": {
    fingerprint: "7251dc0800fce6beaf33866201a788bea58a1cd22b8ff3bfd26a79260d6709f9",
    brand: "Toyota",
    model: "6FBRE14",
    categoryKey: "venta",
    source: "https://www.toyotamaterialhandling.com.au/media/20096/6fbre12_20.341.pdf",
    specifications: {
      "Capacidad nominal según texto comercial": "1.350 kg",
      "Propulsión": "Eléctrica",
      "Centro de carga nominal del modelo": "600 mm",
      "Anchura exterior del modelo": "1250 mm",
      "Radio de giro exterior del modelo": "1570 mm"
    }
  },
  "M433-5206": {
    "fingerprint": "6683c5f04e3f5c22fc7bde275ce199b74268f7b1bb936cdd3d46fa330150caf3",
    "brand": "Toyota",
    "model": "02-7FD18",
    "categoryKey": "venta",
    "source": "https://sales.mercaeleva.com/es/for-sale/machine/Toyota-02-7FD18-M433-5206",
    "specifications": {
      "Capacidad nominal según texto comercial": "1.800 kg",
      "Altura de elevación según texto comercial": "4.700 mm",
      "Combustible anunciado": "Diésel"
    }
  }
};

export const recoverMercaelevaDocumentedToyotaForkliftSpecs = (record: ProductRecord, specs: SpecsMap): SpecsMap =>
  applyDocumentedTechnicalEvidence(record, specs, documentedUnits, { providerId: "mercaeleva", isEligible: (value) => validMercaelevaTechnicalSource(value) });

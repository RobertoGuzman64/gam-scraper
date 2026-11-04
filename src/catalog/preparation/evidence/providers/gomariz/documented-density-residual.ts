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
  "1011JFB": {
    "fingerprint": "d08eeb52c428e56d38b50fb6ec4aa837563a08f9554a52da84806e15e91fdcce",
    "brand": "Renault",
    "model": "PREMIUM 320.26",
    "categoryKey": "venta",
    "source": "https://www.tr.used-renault-trucks.com/api/pdf/template?nodeId=380784&templateType=1",
    "specifications": {
      "Potencia nominal del modelo": "320 CV",
      "Familia de motor del modelo": "Renault dCi 11"
    }
  }
};

export const recoverGomarizDocumentedResidualDensitySpecs = (record: ProductRecord, specs: SpecsMap): SpecsMap =>
  applyDocumentedTechnicalEvidence(record, specs, documentedUnits, { providerId: "gomariz", isEligible: (value) => value.url.startsWith("https://www.gomarizrent.com/") });

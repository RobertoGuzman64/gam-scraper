import { createHash } from "node:crypto";
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

export const recoverGomarizDocumentedResidualDensitySpecs = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  if (record.providerId !== "gomariz" ||
    !record.reference || !record.specs || !record.url.startsWith("https://www.gomarizrent.com/")) return specs;
  const unit = documentedUnits[record.reference];
  if (!unit || record.brand !== unit.brand || record.model !== unit.model ||
    record.categoryKey !== unit.categoryKey ||
    createHash("sha256").update(JSON.stringify(record)).digest("hex") !== unit.fingerprint ||
    Object.keys(unit.specifications).some((key) => key in specs)) return specs;
  return { ...specs, ...unit.specifications };
};

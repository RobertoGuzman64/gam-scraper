import { createHash } from "node:crypto";
import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { validMercaelevaTechnicalSource } from "../../../mapping/providers/mercaeleva/technical.js";

type DocumentedUnit = {
  readonly fingerprint: string;
  readonly brand: string | null;
  readonly model: string | null;
  readonly title: string;
  readonly url: string;
  readonly categoryKey: string;
  readonly sources: readonly string[];
  readonly specifications: Readonly<SpecsMap>;
};

const documentedUnits: Readonly<Record<string, DocumentedUnit>> = {
  "M198-7237": {
    "sources": [
      "https://sales.mercaeleva.com/es/for-sale/machine/JLG-SL203-204-M198-7237",
      "https://cdnc.heyzine.com/flip-book/pdf/3bf89898f6e750b3a716118e3b59d30cf09fe308-1.pdf"
    ],
    "specifications": {
      "Altura de plataforma según catálogo técnico": "20,30 m",
      "Capacidad de carga de plataforma según catálogo técnico": "750 kg",
      "Longitud según catálogo técnico": "4,80 m",
      "Anchura según catálogo técnico": "2,40 m",
      "Dimensiones de plataforma según catálogo técnico": "4,35 x 2,30 m"
    },
    "fingerprint": "d9163255e1956382058572598767994569632f379a67801f0e91aef64e682210",
    "brand": "JLG",
    "model": "SL203-204",
    "categoryKey": "venta",
    "title": "JLG SL203-204 PLATAFORMA TIJERA DIESEL 22 MT",
    "url": "https://sales.mercaeleva.com/es/for-sale/machine/JLG-SL203-204-M198-7237"
  }
};

export const recoverMercaelevaDocumentedDensity183Specs = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  if (record.providerId !== "mercaeleva" || !record.reference || !record.specs || !validMercaelevaTechnicalSource(record)) return specs;
  const unit = documentedUnits[record.reference];
  if (!unit || record.brand !== unit.brand || record.model !== unit.model ||
    record.title !== unit.title || record.url !== unit.url ||
    record.categoryKey !== unit.categoryKey ||
    createHash("sha256").update(JSON.stringify(record)).digest("hex") !== unit.fingerprint ||
    Object.keys(unit.specifications).some((key) => key in specs)) return specs;
  return { ...specs, ...unit.specifications };
};

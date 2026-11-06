import { createHash } from "node:crypto";
import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { validMercaelevaTechnicalSource } from "../mapping/technical.js";

type Evidence = Readonly<{
  source: Readonly<Pick<ProductRecord, "url" | "title" | "brand" | "model" | "year" | "condition" | "horometer" | "shortDescription" | "longDescription">>;
  specsHash: string;
  correctedSpecs: SpecsMap;
  correctedYear: string | null;
  removedSpecs?: readonly string[];
}>;

const evidence = {
  "M547-1056": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Genie-S85-M547-1056",
      "title": "Genie S85 PLATAFORMA TELESCOPICA DIESEL 28 MT",
      "brand": "Genie",
      "model": "S85",
      "year": null,
      "condition": "Segunda mano",
      "horometer": "6650",
      "shortDescription": null,
      "longDescription": "Ref.353 PLATAFORMA TELESCOPICA DIESEL ALTURA DE TRABAJO 28 MT GENIE S85 HORAS 6650 AÑO DE FABRICACION 2008"
    },
    "specsHash": "870586d75e406ef9c8cfa987cf322ebeb55b50657679e105eba4cd72a249421b",
    "correctedSpecs": {
      "Año de fabricación": "2008",
      "Altura de trabajo": "28 m"
    },
    "correctedYear": "2008"
  },
  "M777-6495": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Genie-S-65-M777-6495",
      "title": "Genie S-65 PLATAFORMA TELESCOPICA DIESEL 22 MT",
      "brand": "Genie",
      "model": "S-65",
      "year": "2008",
      "condition": "Segunda mano",
      "horometer": "7373",
      "shortDescription": null,
      "longDescription": "Ref. 227 PLATAFORMA TELESCOPICA DIESEL ALTURA DE TRABAJO 22 MT GENIE S-65 HORAS 7373 AÑO DE FABRICACION 2008"
    },
    "specsHash": "84e7ddc2247976d20ad8b29ba5ff900e87fe02e98f73997fb45fb34e33798ed9",
    "correctedSpecs": {
      "Altura de trabajo": "22 m"
    },
    "correctedYear": null
  },
  "M028-8481": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Genie-GR-15-M028-8481",
      "title": "Genie GR-15 PLATAFORMA VERTICAL AUTOPROPULSADA 6 MT",
      "brand": "Genie",
      "model": "GR-15",
      "year": "2017",
      "condition": "Segunda mano",
      "horometer": "404",
      "shortDescription": null,
      "longDescription": "Ref. 836 PLATAFORMA VERTICAL AUTOPROPULSADA ALTURA DE TRABAJO 6 MT GENIE GR-15 HORAS 404 AÑO DE FABRICACION 2017"
    },
    "specsHash": "04bd790b03cc74292dadedb0cda74b522e5f655075361a1c5ba1314476ecdefa",
    "correctedSpecs": {
      "Altura de trabajo": "6 m"
    },
    "correctedYear": null
  },
  "M958-0132": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/BT-SWE-160-M958-0132",
      "title": "BT SWE 160 APILADOR ELECTRICO 1600 KG",
      "brand": "BT",
      "model": "SWE 160",
      "year": null,
      "condition": null,
      "horometer": null,
      "shortDescription": null,
      "longDescription": "Ref. MER0603 APILADOR ELECTRICO 1600 KG ALTURA DE TRABAJO 3.200 mm BT SWE 160 AÑO DE FABRICACION 2004"
    },
    "specsHash": "c8ba6c884bc31760b3a9049be382f209baac70dfb1380daaba02452bff64513f",
    "correctedSpecs": {
      "Año de fabricación": "2004"
    },
    "correctedYear": "2004"
  },
  "M329-6156": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Oil-Steel-SNAKE-2010-PLUS-M329-6156",
      "title": "Oil & Steel SNAKE 2010 PLUS CAMION CESTA ARTICULADO ALUMINIO 20 MT",
      "brand": "Oil & Steel",
      "model": "SNAKE 2010 PLUS",
      "year": "2017",
      "condition": "Segunda mano",
      "horometer": "73 883",
      "shortDescription": null,
      "longDescription": "Ref.475 CAMION CESTA ARTICULADO ALUMINIO ALTURA DE TRABAJO 20 MT OIL&STEEL SNAKE 2010 PLUS KM 73883 AÑO DE FABRICACION 2017"
    },
    "specsHash": "cd241e9af9f3e843c47bac5e135ea5b6113e88cb6084a305690dfccf5ab8ab5d",
    "correctedSpecs": {
      "Kilometraje": "73 883 km"
    },
    "correctedYear": null,
    "removedSpecs": [
      "Horas laborales"
    ]
  },
  "M502-4867": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Oil-Steel-SNAKE-189-M502-4867",
      "title": "Oil & Steel SNAKE 189 CAMION CESTA ARTICULADO ALUMINIO 18 MT",
      "brand": "Oil & Steel",
      "model": "SNAKE 189",
      "year": "2017",
      "condition": "Segunda mano",
      "horometer": "42 922",
      "shortDescription": null,
      "longDescription": "Ref.690 CAMION CESTA ARTICULADO ALUMINIO ALTURA DE TRABAJO 18 MT OIL&STEEL SNAKE 189 KM 42922 AÑO DE FABRICACION 2017"
    },
    "specsHash": "b4372277c88b85b972bae0b30ca39a44eea4b087f34fdb81e96934d9f43df4b2",
    "correctedSpecs": {
      "Kilometraje": "42 922 km"
    },
    "correctedYear": null,
    "removedSpecs": [
      "Horas laborales"
    ]
  },
} as const satisfies Readonly<Record<string, Evidence>>;

export const reconcileMercaelevaVerifiedPlatformSourceSpecs = (record: ProductRecord): ProductRecord => {
  if (!validMercaelevaTechnicalSource(record) || record.categoryKey !== "venta" || !record.reference || !record.specs) return record;
  const entries: Readonly<Record<string, Evidence>> = evidence;
  const entry = entries[record.reference];
  if (!entry) return record;
  const source = entry.source;
  if (record.url !== source.url || record.title !== source.title || record.brand !== source.brand ||
    record.model !== source.model || record.year !== source.year || record.condition !== source.condition ||
    record.horometer !== source.horometer || record.shortDescription !== source.shortDescription ||
    record.longDescription !== source.longDescription ||
    createHash("sha256").update(JSON.stringify(record.specs)).digest("hex") !== entry.specsHash) return record;
  return {
    ...record,
    ...(entry.correctedYear === null ? {} : { year: entry.correctedYear }),
    specs: Object.fromEntries(Object.entries({ ...record.specs, ...entry.correctedSpecs })
      .filter(([key]) => !entry.removedSpecs?.includes(key)))
  };
};

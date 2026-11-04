import { createHash } from "node:crypto";
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
  "M177-1398": {
    "fingerprint": "fa754c7173558047002d3e2af81fd927e8f96e06d2c4c0d97a1a67fcaba1738f",
    "brand": "SINOBOOM",
    "model": "0608ME",
    "categoryKey": "venta",
    "source": "https://sinoboom.com/content/details_103_125.html",
    "specifications": {
      "Capacidad de plataforma": "230 kg",
      "Extensión máxima de plataforma": "0,9 m",
      "Longitud de plataforma": "1,64 m",
      "Anchura de plataforma": "0,76 m"
    }
  },
  "M840-6795": {
    "fingerprint": "8595f856187fdead2e2a3ef7ebdb244658aa6419136c2dc7c9f0f88fc02b020e",
    "brand": "LGMG",
    "model": "A14JE",
    "categoryKey": "venta",
    "source": "https://www.lgmglifts.com/product/pro-detail-616.htm",
    "specifications": {
      "Capacidad de plataforma": "230 kg",
      "Alcance horizontal máximo": "7,81 m"
    }
  },
  "M940-3556": {
    "fingerprint": "2563740c9640aaa6085039488663bbfbb4cdbedbcc6b9fc7345f87f75aced5d5",
    "brand": "Genie",
    "model": "Z135",
    "categoryKey": "venta",
    "source": "https://manuals.genielift.com/operators/english/226486.pdf",
    "specifications": {
      "Alcance horizontal máximo": "21,3 m",
      "Capacidad máxima de plataforma": "272 kg",
      "Altura máxima de plataforma": "41,1 m"
    }
  },
  "M547-1056": {
    "fingerprint": "b2fd281d93316af8e69b4746db031328379a71ecffe122fb07b6353daf6d1a76",
    "brand": "Genie",
    "model": "S85",
    "categoryKey": "venta",
    "source": "https://manuals.genielift.com/operators/english/43650.pdf",
    "specifications": {
      "Alcance horizontal máximo": "23,4 m",
      "Capacidad máxima de plataforma": "227 kg",
      "Anchura de máquina": "2,43 m"
    }
  },
  "M570-8735": {
    "fingerprint": "2d46962c5db1894c6dc5abfdfcefa0edeae537d0da5b57f063008e85deadee1c",
    "brand": "Linde",
    "model": "T18",
    "categoryKey": "venta",
    "source": "https://www.linde-mh.es/es/Productos/Transpaletas/T14-T20/",
    "specifications": {
      "Capacidad nominal de carga": "1800 kg",
      "Centro de carga": "600 mm",
      "Elevación de horquillas": "125 mm"
    }
  },
  "M879-4639": {
    "fingerprint": "4da447bc17866b2efd1df8189680b701c6f48f21d11bbdeeabedcc4d67a3fa8c",
    "brand": "Stöcklin",
    "model": "EDP-2000",
    "categoryKey": "venta",
    "source": "https://ibz-handelswelt.de/gebrauchtmaschinen/stoecklin-niederhubwagen-edp/",
    "specifications": {
      "Capacidad nominal de carga": "2000 kg",
      "Tensión del sistema de batería": "24 V",
      "Centro de carga": "600 mm"
    }
  },
  "M777-6495": {
    "fingerprint": "56fb79e90a4318482e27b3933313be09ebdc8085986242ee250144893b53e407",
    "brand": "Genie",
    "model": "S-65",
    "categoryKey": "venta",
    "source": "https://www.colle.eu/media/3955/genie-s65-en.pdf",
    "specifications": {
      "Alcance horizontal máximo": "17,1 m",
      "Capacidad máxima de plataforma": "227 kg",
      "Altura máxima de plataforma": "19,8 m"
    }
  }
};

export const recoverMercaelevaDocumentedDensity180Specs = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  if (record.providerId !== "mercaeleva" ||
    !record.reference || !record.specs || !validMercaelevaTechnicalSource(record)) return specs;
  const unit = documentedUnits[record.reference];
  if (!unit || record.brand !== unit.brand || record.model !== unit.model ||
    record.categoryKey !== unit.categoryKey ||
    createHash("sha256").update(JSON.stringify(record)).digest("hex") !== unit.fingerprint ||
    Object.keys(unit.specifications).some((key) => key in specs)) return specs;
  return { ...specs, ...unit.specifications };
};

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
  "M005-4474": {
    "fingerprint": "f4682e307a22e83bc811f4b325728765ad49cde7e820fb1935cf0d1bf7c1a781",
    "brand": "LGMG",
    "model": "S0808EII",
    "categoryKey": "venta",
    "source": "https://www.lgmglifts.com/product/pro-detail-2026.htm",
    "specifications": {
      "Capacidad de plataforma": "230 kg",
      "Longitud de plataforma": "2,26 m",
      "Anchura de plataforma": "0,79 m",
      "Extensión de plataforma": "0,9 m"
    }
  },
  "M159-0669": {
    "fingerprint": "fcff168e7e42d454a8f6f9e845544a8c3a180e55dd7371aa667dc9625d3d90c0",
    "brand": "LGMG",
    "model": "S0808EII",
    "categoryKey": "venta",
    "source": "https://www.lgmglifts.com/product/pro-detail-2026.htm",
    "specifications": {
      "Capacidad de plataforma": "230 kg",
      "Longitud de plataforma": "2,26 m",
      "Anchura de plataforma": "0,79 m",
      "Extensión de plataforma": "0,9 m"
    }
  },
  "M346-8211": {
    "fingerprint": "a64bb0557d5fd619cab5d99093b5cf461d0baadc9ab3b4118ef3840923a7aecb",
    "brand": "LGMG",
    "model": "SS0407ER",
    "categoryKey": "venta",
    "source": "https://www.lgmglifts.com/product/pro-detail-1030.htm",
    "specifications": {
      "Capacidad de plataforma": "240 kg",
      "Longitud de plataforma": "1,27 m",
      "Anchura de plataforma": "0,70 m",
      "Extensión de plataforma": "0,6 m"
    }
  },
  "M606-3993": {
    "fingerprint": "328a217f9f1fdc5be9c47d72b8e7fea13cab67522fd03e4f149edb9a70d52f52",
    "brand": "LGMG",
    "model": "SS0407ER",
    "categoryKey": "venta",
    "source": "https://www.lgmglifts.com/product/pro-detail-1030.htm",
    "specifications": {
      "Capacidad de plataforma": "240 kg",
      "Longitud de plataforma": "1,27 m",
      "Anchura de plataforma": "0,70 m",
      "Extensión de plataforma": "0,6 m"
    }
  },
  "M318-0509": {
    "fingerprint": "018d85dfa8202656b853388aa4c71fb3fc81e6879a416940ac09d223d25618fa",
    "brand": "LGMG",
    "model": "S1012E-2",
    "categoryKey": "venta",
    "source": "https://www.lgmglifts.com/upload/file/2025/04/lgmg-scissorlift-en-S1012E-2.pdf",
    "specifications": {
      "Capacidad de plataforma": "320 kg",
      "Longitud de plataforma": "2,26 m",
      "Anchura de plataforma": "1,12 m",
      "Extensión de plataforma": "0,9 m"
    }
  },
  "M726-5166": {
    "fingerprint": "44c890681012cbfa966fe1401ff79659d2f34a3e91a43ad0b31fef270c1e34fd",
    "brand": "LGMG",
    "model": "S1012EII",
    "categoryKey": "venta",
    "source": "https://www.lgmglifts.com/product/pro-detail-2028.htm",
    "specifications": {
      "Capacidad de plataforma": "320 kg",
      "Longitud de plataforma": "2,26 m",
      "Anchura de plataforma": "1,12 m",
      "Extensión de plataforma": "0,9 m"
    }
  },
  "M486-0114": {
    "fingerprint": "08ddac4fda869826e6e6fee9c05cb168c4c1712ccd20a62d7ba5b4874b669cbb",
    "brand": "LGMG",
    "model": "AS1413",
    "categoryKey": "venta",
    "source": "https://www.mercaeleva.com/pdf/fichas/2022/merca-eleva-tijera-electrica-lgmg-as1413.pdf",
    "specifications": {
      "Capacidad de plataforma": "320 kg",
      "Longitud de plataforma": "2,64 m",
      "Anchura de plataforma": "1,12 m",
      "Extensión de plataforma": "0,9 m"
    }
  },
  "M958-0132": {
    "fingerprint": "710c2982e257b50206817f5eb1d1a6dfaf096bfe36b6bf1c2ddc2cee5bd1344f",
    "brand": "BT",
    "model": "SWE 160",
    "categoryKey": "venta",
    "source": "https://toyota-material-handling.co.th/products/275",
    "specifications": {
      "Capacidad nominal de carga": "1600 kg",
      "Centro de carga": "600 mm",
      "Anchura total": "790 mm",
      "Radio de giro": "1504 mm"
    }
  }
};

export const recoverMercaelevaDocumentedResidualLiftSpecs = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  if (record.providerId !== "mercaeleva" || record.categoryKey !== "venta" ||
    !record.reference || !record.specs ||
    !validMercaelevaTechnicalSource(record)) return specs;
  const unit = documentedUnits[record.reference];
  if (!unit || record.brand !== unit.brand || record.model !== unit.model ||
    record.categoryKey !== unit.categoryKey ||
    createHash("sha256").update(JSON.stringify(record)).digest("hex") !== unit.fingerprint ||
    Object.keys(unit.specifications).some((key) => key in specs)) return specs;
  return { ...specs, ...unit.specifications };
};

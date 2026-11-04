import { createHash } from "node:crypto";
import type { ProductRecord, SpecsMap } from "../../../../../../contracts/catalog.js";

type DocumentedUnit = {
  readonly fingerprint: string;
  readonly brand: string | null;
  readonly model: string | null;
  readonly categoryKey: string;
  readonly source: string;
  readonly specifications: Readonly<SpecsMap>;
};

const documentedUnits: Readonly<Record<string, DocumentedUnit>> = {
  "6806": {
    "fingerprint": "7c79787664bc2ce62bbd7c3eab7efa2364e00af10496742d461edf4f7718355b",
    "brand": null,
    "model": "P1.6",
    "categoryKey": "maquinaria",
    "source": "https://stock.soyinquieto.com/en/used-electric-vans/3260-musoshi-pop-up-mini",
    "specifications": {
      "Potencia de motor publicada para la unidad": "15,6 kW",
      "Velocidad máxima anunciada": "45 km/h",
      "Tipo de motor anunciado": "Eléctrico sin escobillas",
      "Batería anunciada": "Litio extraíble",
      "Sistema de frenos anunciado": "Disco delantero y tambor trasero"
    }
  },
  "6193": {
    "fingerprint": "12ff3d08b27322e8b4eadb2c75e4e3909b64d1c50c6db7bac218b86a13ead7aa",
    "brand": null,
    "model": null,
    "categoryKey": "elevacion-nueva",
    "source": "https://online.gamrentals.com/es/cte/6193-plataforma-sobre-camion-articulado-cte-zed-25-hv-fib",
    "specifications": {
      "Alcance lateral máximo declarado": "12 m",
      "Rotación de torreta": "±320°",
      "Dimensiones de cesta de fibra": "1400 x 700 x 1100 mm",
      "Rotación hidráulica de cesta": "90° a cada lado",
      "Número de estabilizadores hidráulicos": "4",
      "Toma eléctrica de cesta": "230 V"
    }
  }
};

export const recoverGamDocumentedPendingDensitySpecs = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  if (record.providerId !== "gam" ||
    !record.reference || !record.specs || !record.url.startsWith("https://online.gamrentals.com/")) return specs;
  const unit = documentedUnits[record.reference];
  if (!unit || record.brand !== unit.brand || record.model !== unit.model ||
    record.categoryKey !== unit.categoryKey ||
    createHash("sha256").update(JSON.stringify(record)).digest("hex") !== unit.fingerprint ||
    Object.keys(unit.specifications).some((key) => key in specs)) return specs;
  return { ...specs, ...unit.specifications };
};

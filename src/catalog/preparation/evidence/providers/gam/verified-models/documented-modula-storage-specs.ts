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
  "3425": {
    "fingerprint": "63551b35dafad027c1527be2988a42565807319fe4aab2163505b75e29081dc1",
    "brand": "MODULA",
    "model": "MC25D",
    "categoryKey": "marcas-nuevas",
    "source": "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf",
    "specifications": {
      "Anchura de bandeja": "2500 mm",
      "Profundidad de bandeja": "857 mm",
      "Carga neta por bandeja": "250 kg",
      "Anchura exterior del almacén": "2917 mm"
    }
  },
  "3426": {
    "fingerprint": "80c6b6ce1325160111b70eb2c676640869b0c069816371c4cb1a5920870147e7",
    "brand": "MODULA",
    "model": "MC50D",
    "categoryKey": "marcas-nuevas",
    "source": "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf",
    "specifications": {
      "Anchura de bandeja": "2500 mm",
      "Profundidad de bandeja": "857 mm",
      "Carga neta por bandeja": "500 kg",
      "Anchura exterior del almacén": "2917 mm"
    }
  },
  "3427": {
    "fingerprint": "f5e99928923881d01044b13e2d147224e316c887b6f559c9a21fd150029e3ed5",
    "brand": "MODULA",
    "model": "MC75D",
    "categoryKey": "marcas-nuevas",
    "source": "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf",
    "specifications": {
      "Anchura de bandeja": "2500 mm",
      "Profundidad de bandeja": "857 mm",
      "Carga neta por bandeja": "750 kg",
      "Anchura exterior del almacén": "2917 mm"
    }
  },
  "3428": {
    "fingerprint": "b158f82e784a06f4a9f62818e84d13d64c18e02ec7b1e06dc0038332d74ad975",
    "brand": "MODULA",
    "model": "MX25D",
    "categoryKey": "marcas-nuevas",
    "source": "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf",
    "specifications": {
      "Anchura de bandeja": "3100 mm",
      "Profundidad de bandeja": "857 mm",
      "Carga neta por bandeja": "250 kg",
      "Anchura exterior del almacén": "3517 mm"
    }
  },
  "3429": {
    "fingerprint": "638f7ce7d62939ad1b232fa898f3a57543c15c1e5c075de5ac51ff9e27da8448",
    "brand": "MODULA",
    "model": "MX50D",
    "categoryKey": "marcas-nuevas",
    "source": "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf",
    "specifications": {
      "Anchura de bandeja": "3100 mm",
      "Profundidad de bandeja": "857 mm",
      "Carga neta por bandeja": "500 kg",
      "Anchura exterior del almacén": "3517 mm"
    }
  },
  "3430": {
    "fingerprint": "7191a651269eb549eef224353c0ad351c310401c91d10a954a1ee36dac324462",
    "brand": "MODULA",
    "model": "MX75D",
    "categoryKey": "marcas-nuevas",
    "source": "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf",
    "specifications": {
      "Anchura de bandeja": "3100 mm",
      "Profundidad de bandeja": "857 mm",
      "Carga neta por bandeja": "750 kg",
      "Anchura exterior del almacén": "3517 mm"
    }
  },
  "3431": {
    "fingerprint": "6302c3b5c767626e08b457712a84fe1fb47bd28295e1420f7415c269035928d4",
    "brand": "MODULA",
    "model": "ML25D",
    "categoryKey": "marcas-nuevas",
    "source": "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf",
    "specifications": {
      "Anchura de bandeja": "4100 mm",
      "Profundidad de bandeja": "857 mm",
      "Carga neta por bandeja": "250 kg",
      "Anchura exterior del almacén": "4517 mm"
    }
  },
  "3432": {
    "fingerprint": "5bb63c382ed1040e9f95916e36caf29e215a5131c61cea8f338f9fabadeeeedd",
    "brand": "MODULA",
    "model": "ML50D",
    "categoryKey": "marcas-nuevas",
    "source": "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf",
    "specifications": {
      "Anchura de bandeja": "4100 mm",
      "Profundidad de bandeja": "857 mm",
      "Carga neta por bandeja": "500 kg",
      "Anchura exterior del almacén": "4517 mm"
    }
  },
  "3433": {
    "fingerprint": "d33ebf3899b3db651ed9aae9792db958eab74f804233efc94d8622b73a61b49e",
    "brand": "MODULA",
    "model": "ML75D",
    "categoryKey": "marcas-nuevas",
    "source": "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf",
    "specifications": {
      "Anchura de bandeja": "4100 mm",
      "Profundidad de bandeja": "857 mm",
      "Carga neta por bandeja": "750 kg",
      "Anchura exterior del almacén": "4517 mm"
    }
  },
  "3434": {
    "fingerprint": "c4fc853f7c121bc91d826815d2c8ebc4f40b1ff0246904391afde47041317f77",
    "brand": "MODULA",
    "model": "MSL13",
    "categoryKey": "marcas-nuevas",
    "source": "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Slim-ENG.pdf",
    "specifications": {
      "Anchura de bandeja": "1300 mm",
      "Profundidad de bandeja": "425 mm",
      "Carga neta por bandeja": "350 kg",
      "Anchura exterior del almacén": "1685 mm"
    }
  },
  "3435": {
    "fingerprint": "a70accf4e65029a546edaac646e58253b34ef6c500ad19be1a4c493d823ca314",
    "brand": "MODULA",
    "model": "MSL19",
    "categoryKey": "marcas-nuevas",
    "source": "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Slim-ENG.pdf",
    "specifications": {
      "Anchura de bandeja": "1900 mm",
      "Profundidad de bandeja": "425 mm",
      "Carga neta por bandeja": "350 kg",
      "Anchura exterior del almacén": "2285 mm"
    }
  },
  "3436": {
    "fingerprint": "f2938a80e71912bf36ef21857ab0445b9eb9664dddd2ea943a400302be91c17c",
    "brand": "MODULA",
    "model": "MSL25",
    "categoryKey": "marcas-nuevas",
    "source": "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Slim-ENG.pdf",
    "specifications": {
      "Anchura de bandeja": "2500 mm",
      "Profundidad de bandeja": "425 mm",
      "Carga neta por bandeja": "350 kg",
      "Anchura exterior del almacén": "2885 mm"
    }
  }
};

export const recoverGamDocumentedModulaStorageSpecs = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  if (record.providerId !== "gam" || record.categoryKey !== "marcas-nuevas" ||
    !record.reference || !record.specs ||
    !record.url.startsWith("https://online.gamrentals.com/")) return specs;
  const unit = documentedUnits[record.reference];
  if (!unit || record.brand !== unit.brand || record.model !== unit.model ||
    record.categoryKey !== unit.categoryKey ||
    createHash("sha256").update(JSON.stringify(record)).digest("hex") !== unit.fingerprint ||
    Object.keys(unit.specifications).some((key) => key in specs)) return specs;
  return { ...specs, ...unit.specifications };
};

import { createHash } from "node:crypto";
import type { ProductRecord, SpecsMap } from "../../../../../../contracts/catalog.js";

type DocumentedLogitransUnit = {
  readonly fingerprint: string;
  readonly brand: string;
  readonly model: string;
  readonly categoryKey: string;
  readonly source: string;
  readonly specifications: Readonly<SpecsMap>;
};

const documentedUnits: Readonly<Record<string, DocumentedLogitransUnit>> = {
  "220": {
    "fingerprint": "4576fcc1e91dc5301b0bd261bd13ef3884adde88dd8e10abe765d4c7f53a7bc5",
    "brand": "LOGITRANS",
    "model": "Logiflex SE",
    "categoryKey": "apiladores-nuevos",
    "source": "https://logitrans.com/electric-logiflex-stacker-elf/",
    "specifications": {
      "Propulsión": "Manual",
      "Dirección": "Asistida en ambas ruedas"
    }
  },
  "221": {
    "fingerprint": "0b74a37842c2796079797effe51da0a87187f8668d623f6ef7ff39444644370f",
    "brand": "LOGITRANS",
    "model": "Logiflex SE-ARTICULADAS",
    "categoryKey": "apiladores-nuevos",
    "source": "https://logitrans.com/electric-logiflex-stacker-with-straddle-legs-elfs/",
    "specifications": {
      "Propulsión": "Manual",
      "Dirección": "Asistida en ambas ruedas"
    }
  },
  "222": {
    "fingerprint": "75cff4300aab35a801cf11c401af6df9c1a76112b4f10cf3b4d1223b48e74dc2",
    "brand": "LOGITRANS",
    "model": "Self Maxi",
    "categoryKey": "apiladores-nuevos",
    "source": "https://logitrans.com/fully-powered-logiflex-stacker-self-maxi/",
    "specifications": {
      "Controlador de tracción": "Curtis (CA)",
      "Conducción con timón vertical": "Permitida"
    }
  },
  "223": {
    "fingerprint": "f7668841225a6064808a3f86d6b600a095c7ba8c013261c31b39649015958180",
    "brand": "LOGITRANS",
    "model": "Self Maxi S",
    "categoryKey": "apiladores-nuevos",
    "source": "https://logitrans.com/fully-powered-logiflex-stacker-with-straddle-legs-selfs-maxi/",
    "specifications": {
      "Controlador de tracción": "Curtis (CA)",
      "Conducción con timón vertical": "Permitida"
    }
  },
  "224": {
    "fingerprint": "00acedeaa9328c8f2254c2133d99b5ce94a042df2d5d4d00ade04cf713bfe34e",
    "brand": "LOGITRANS",
    "model": "Self Mini",
    "categoryKey": "apiladores-nuevos",
    "source": "https://logitrans.com/fully-powered-logiflex-stacker-mini-self-mini/",
    "specifications": {
      "Controlador de tracción": "Curtis (CA)",
      "Conducción con timón vertical": "Permitida"
    }
  },
  "225": {
    "fingerprint": "f9ce10116ec305ef1d376325bb9e1906e99c6d82ba0f68095ec3fe0ab14c6ebf",
    "brand": "LOGITRANS",
    "model": "Self Mini S",
    "categoryKey": "apiladores-nuevos",
    "source": "https://logitrans.com/fully-powered-logiflex-stacker-mini-self-mini/",
    "specifications": {
      "Controlador de tracción": "Curtis (CA)",
      "Conducción con timón vertical": "Permitida"
    }
  },
  "226": {
    "fingerprint": "f849042aa15e1d4bab49e6d857df3aabf9801b0dae54ce5a27ba12c26729954b",
    "brand": "LOGITRANS",
    "model": "HSI HSSI",
    "categoryKey": "apiladores-nuevos",
    "source": "https://logitrans.com/manual-logiflex-stacker-inox-hsi-and-manual-logiflex-stacker-with-straddle-legs-inox-hssi/",
    "specifications": {
      "Material del chasis de horquillas": "Acero inoxidable AISI 316L",
      "Configuración de horquillas": "Cerradas",
      "Accionamiento de elevación": "Manual"
    }
  },
  "227": {
    "fingerprint": "bb01cd50fdbd22f4760cba264b7d1e59314f7b426ca85e815bfd6ae2e4c736f0",
    "brand": "LOGITRANS",
    "model": "EHSI",
    "categoryKey": "apiladores-nuevos",
    "source": "https://logitrans.com/electric-logiflex-stacker-inox-ehsi/",
    "specifications": {
      "Material del chasis de horquillas": "Acero inoxidable AISI 316L",
      "Configuración de horquillas": "Cerradas",
      "Accionamiento de elevación": "Eléctrico"
    }
  },
  "228": {
    "fingerprint": "aa2e96d5eddb6717a32f8e8de939195794dc4664c1177b8db3fcc3c2b4ae44aa",
    "brand": "LOGITRANS",
    "model": "EHSS",
    "categoryKey": "apiladores-nuevos",
    "source": "https://logitrans.com/electric-logiflex-stacker-with-straddle-legs-inox-ehssi/",
    "specifications": {
      "Material del chasis de horquillas": "Acero inoxidable AISI 316L",
      "Configuración de horquillas": "Cerradas",
      "Accionamiento de elevación": "Eléctrico"
    }
  },
  "229": {
    "fingerprint": "e6cff00ae5afee4f14e6acf92212877f1623c2708412206992526daa105402e2",
    "brand": "LOGITRANS",
    "model": "HL",
    "categoryKey": "marcas-nuevas",
    "source": "https://logitrans.com/electric-highlifter-ehl/",
    "specifications": {
      "Altura máxima de elevación": "800 mm",
      "Capacidad de carga a más de 470 mm": "1000 kg",
      "Configuración de ruedas de carga": "Tándem"
    }
  },
  "230": {
    "fingerprint": "504690685890e5b756184fe8f9c74f3ff070abbb594a5ac2bb321d6efcc0577c",
    "brand": "LOGITRANS",
    "model": "EHL",
    "categoryKey": "marcas-nuevas",
    "source": "https://logitrans.com/electric-highlifter-ehl/",
    "specifications": {
      "Altura máxima de elevación": "800 mm",
      "Capacidad de carga a más de 470 mm": "1000 kg"
    }
  },
  "231": {
    "fingerprint": "600213e6aeead70cbffe7bf9633985b5694759b93f1618c31fa1cb110d0db81c",
    "brand": "LOGITRANS",
    "model": "Logitilt LT",
    "categoryKey": "marcas-nuevas",
    "source": "https://logitrans.com/electric-logitilt/",
    "specifications": {
      "Recorrido de elevación": "275 mm",
      "Altura de trabajo con caja inclinada": "750–950 mm"
    }
  },
  "232": {
    "fingerprint": "d3115431daa7f6318e037fef8ec34c7e2146990aaf741d5ea45fe7eea00f5cf0",
    "brand": "LOGITRANS",
    "model": "Logitilt LTS",
    "categoryKey": "marcas-nuevas",
    "source": "https://logitrans.com/electric-logitilt-with-straddle-legs/",
    "specifications": {
      "Recorrido de elevación": "275 mm",
      "Altura de trabajo con caja inclinada": "750–950 mm"
    }
  },
  "233": {
    "fingerprint": "c11439addcf34066a7f29010ff319df39d32c6b715893f69769602032db73547",
    "brand": "LOGITRANS",
    "model": "Panther Maxi",
    "categoryKey": "marcas-nuevas",
    "source": "https://logitrans.com/solutions/pallet-tansportation/panther-maxi-fully-powered-pallet-truck/",
    "specifications": {
      "Controlador de tracción": "Curtis ACF2C",
      "Conducción con timón vertical": "Permitida"
    }
  },
  "234": {
    "fingerprint": "fd117daafee5d86d419668f13a61da2f36e0e293251296f49d9cb1b803db9016",
    "brand": "LOGITRANS",
    "model": "Mover",
    "categoryKey": "marcas-nuevas",
    "source": "https://logitrans.com/media/3839/lm1500_us_72_v2.pdf",
    "specifications": {
      "Acceso del operador": "Mediante código PIN",
      "Panel de control": "Pantalla LCD con estado de batería"
    }
  },
  "236": {
    "fingerprint": "0fc9eb5fea1523366d7da8394f9462c01bc99c6236ccfe0106711a8a0eec8810",
    "brand": "LOGITRANS",
    "model": "Panther Silent",
    "categoryKey": "marcas-nuevas",
    "source": "https://logitrans.com/US/panther-silent-manual-pallet-truck/",
    "specifications": {
      "Nivel sonoro de desplazamiento": "Inferior a 60 dB(A)",
      "Material de ruedas": "Caucho blando",
      "Sistema de elevación": "Elevación rápida permanente"
    }
  },
  "238": {
    "fingerprint": "36529e79eaf0bc343c99c3dc2bf2421dcc6032272775f4953134be93ec3f9bce",
    "brand": "LOGITRANS",
    "model": "WSP 2200",
    "categoryKey": "marcas-nuevas",
    "source": "https://logitrans.com/US/weighing-scale-pallet-truck-wsp-2200/",
    "specifications": {
      "Precisión del sistema de pesaje": "99,95 %",
      "Células de pesaje": "4",
      "Protección de las células de carga": "IP68"
    }
  },
  "240": {
    "fingerprint": "dbce9f73a817f7345e0741b85d21e175e56bb7ae46598f5b11969f7acd7a2d48",
    "brand": "LOGITRANS",
    "model": "Logitilt LTI",
    "categoryKey": "marcas-nuevas",
    "source": "https://logitrans.com/electric-logitilt-inox-lti/",
    "specifications": {
      "Recorrido de elevación": "275 mm",
      "Altura de trabajo con caja inclinada": "750–950 mm"
    }
  },
  "245": {
    "fingerprint": "3ec38ac8bfcb6119f35cdd9f2c8dad97e7bd3c3cbb1a52729a3e5ac354306df3",
    "brand": "LOGITRANS",
    "model": "EHLI",
    "categoryKey": "marcas-nuevas",
    "source": "https://logitrans.com/media/6026/transpalette-haute-levee-inox-specs-et-key-sketches-umbraco.pdf",
    "specifications": {
      "Altura máxima de elevación": "800 mm",
      "Capacidad de carga a más de 470 mm": "1000 kg"
    }
  },
  "246": {
    "fingerprint": "3e77ce50643a8da7c74e95bc34da5552736844225876d9d6955b9052615b3c2e",
    "brand": "LOGITRANS",
    "model": "EHLI Plus",
    "categoryKey": "marcas-nuevas",
    "source": "https://logitrans.com/media/6026/transpalette-haute-levee-inox-specs-et-key-sketches-umbraco.pdf",
    "specifications": {
      "Altura máxima de elevación": "800 mm",
      "Capacidad de carga a más de 470 mm": "1000 kg"
    }
  }
};

export const recoverGamDocumentedLogitransHandlingSpecs = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" || !record.reference ||
    !record.url.startsWith("https://online.gamrentals.com/es/") || !record.specs) return specs;
  const unit = documentedUnits[record.reference];
  if (!unit || record.categoryKey !== unit.categoryKey || record.brand !== unit.brand ||
    record.model !== unit.model || createHash("sha256").update(JSON.stringify(record)).digest("hex") !== unit.fingerprint ||
    Object.keys(unit.specifications).some((key) => key in specs)) return specs;
  return { ...specs, ...unit.specifications };
};

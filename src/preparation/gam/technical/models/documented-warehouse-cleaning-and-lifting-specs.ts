import { createHash } from "node:crypto";
import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";

type DocumentedGamUnit = {
  readonly fingerprint: string;
  readonly brand: string | null;
  readonly model: string | null;
  readonly categoryKey: string;
  readonly source: string;
  readonly specifications: Readonly<SpecsMap>;
};

const documentedUnits: Readonly<Record<string, DocumentedGamUnit>> = {
  "1894": {
    "fingerprint": "3d08881089a8525480da5d6e2ec988c2adda4893661814346613246b8fc9f13e",
    "brand": "TECNA",
    "model": "VTA 450",
    "categoryKey": "otros-nuevos",
    "source": "https://online.gamrentals.com/es/tractores-electricos-de-arrastre-tecnacar/1894-tractor-electrico-de-arrastre-tecnacar-vta-450",
    "specifications": {
      "Control de tracción": "TCS",
      "Sistema antivuelco": "ACS"
    }
  },
  "2185": {
    "fingerprint": "93cbdea6ee04c019281b9211da4f83e129e861a76d967771eb3efa09ec6a3258",
    "brand": "HYSTER",
    "model": "LO1.2C",
    "categoryKey": "carretillas-nuevas",
    "source": "https://online.gamrentals.com/ma/preparateurs-de-commandes/2185-preparateur-de-commandes-a-contrepoids-lo12c",
    "specifications": {
      "Velocidad máxima de desplazamiento": "9,6 km/h",
      "Dirección": "Eléctrica"
    }
  },
  "2266": {
    "fingerprint": "f07d041db9a58ba557163b802586ad5475f27bea85d72d526deee8c668452281",
    "brand": "YALE",
    "model": "MTC15",
    "categoryKey": "carretillas-nuevas",
    "source": "https://online.gamrentals.com/en/trilateral-forklifts/2266-yale-mtc15-trilateral-forklift",
    "specifications": {
      "Rotación del cabezal trilateral": "180°"
    }
  },
  "2738": {
    "fingerprint": "a4563b246b3ded80270bf75bf3d4ef91207774bfbe684fd5b017041f17a8d3af",
    "brand": null,
    "model": "TT30K",
    "categoryKey": "marcas-nuevas",
    "source": "https://online.gamrentals.com/es/bts/2738-trailercaddy-terminal-tractor",
    "specifications": {
      "Alimentación": "Batería"
    }
  },
  "4013": {
    "fingerprint": "aec5f616a4b7d0ac6958b6d3c9d79c26c128b0a4259f60614bf7c34016cd95b9",
    "brand": "Tennant",
    "model": "FCS T16 D",
    "categoryKey": "limpieza-fregadoras",
    "source": "https://www.tennantco.com/en_eu/1/machines/scrubbers/product.m-t16.html",
    "specifications": {
      "Depósito de recuperación": "225 l",
      "Alimentación": "Batería"
    }
  },
  "4014": {
    "fingerprint": "af793ce15ba48515040a1133465b4baf14d3a932b630c286da65b6b443139be9",
    "brand": "Tennant",
    "model": "FCS T16 C",
    "categoryKey": "limpieza-fregadoras",
    "source": "https://www.tennantco.com/en_eu/1/machines/scrubbers/product.m-t16.html",
    "specifications": {
      "Depósito de recuperación": "225 l",
      "Alimentación": "Batería"
    }
  },
  "4018": {
    "fingerprint": "fd49b8f70cf0d20a7addc56c8ea504dd9c5b8dd83df155ba1d40ee8443ee368a",
    "brand": "Tennant",
    "model": "T20",
    "categoryKey": "limpieza-fregadoras",
    "source": "https://www.tennantco.com/en_us/1/machines/scrubbers/product.t20.industrial-ride-on-floor-scrubber.2000072.html",
    "specifications": {
      "Depósito de solución": "303 l"
    }
  },
  "4028": {
    "fingerprint": "a5d1fca9d3edb839d8dce84854b352dee4560c1861c40036df98199df5b928a0",
    "brand": "Tennant",
    "model": "BCS 6100",
    "categoryKey": "limpieza-fregadoras",
    "source": "https://www.tennantco.com/en_us/1/machines/sweepers/product.6100.sweeper-rider-6100.2000076.html",
    "specifications": {
      "Capacidad volumétrica de tolva": "85 l",
      "Longitud del cepillo principal": "560 mm"
    }
  },
  "4657": {
    "fingerprint": "573711671af7bdf70dfc1376c1ba59a834573a54a7ac144d09734eca7ae22bff",
    "brand": "CTE",
    "model": "TRACCESS 170E",
    "categoryKey": "elevacion-nueva",
    "source": "https://cpslift.com/access-platforms/cte-traccess-platforms/traccess-170-e/",
    "specifications": {
      "Alcance horizontal": "7,5 m",
      "Rotación de torreta": "330°"
    }
  },
  "4659": {
    "fingerprint": "f719c232d4ca9bf5b5c235153f125c213ec92c4c35feb2d2b3c38d0fbef059e7",
    "brand": "CTE",
    "model": "TRACCESS 230",
    "categoryKey": "elevacion-nueva",
    "source": "https://cpslift.com/access-platforms/cte-traccess-platforms/traccess-230/",
    "specifications": {
      "Alcance horizontal": "12 m",
      "Anchura en transporte": "780 mm"
    }
  },
  "4661": {
    "fingerprint": "c26bae8357aec38326e0cdd25582aa2e9fde3d501f328465d5e50b48ed243505",
    "brand": "CTE",
    "model": "ZED 21.3 JHV",
    "categoryKey": "elevacion-nueva",
    "source": "https://www.afi-rentals.co.uk/news/wilson-access-continues-fleet-investment-with-four-new-cte-zed-213-jhv-truck-mounts",
    "specifications": {
      "Alcance horizontal": "10 m"
    }
  },
  "4845": {
    "fingerprint": "1eda224b1c9a6dac8b602bf1645510e3df6efb020f9cbccb362e855130fdba24",
    "brand": "CTE",
    "model": "B-LIFT 18 HD FIB AIS",
    "categoryKey": "elevacion-nueva",
    "source": "https://online.gamrentals.com/es/cte/4845-b-lift-18-hd-fib-ais",
    "specifications": {
      "Alcance horizontal": "12,5 m",
      "Aislamiento eléctrico del brazo": "Hasta 1000 V"
    }
  },
  "6189": {
    "fingerprint": "723d19f71ae2fe092fff6e6332d9d93a0ed93dd71f3bccc8a9f84f9d731d8f4f",
    "brand": null,
    "model": null,
    "categoryKey": "elevacion-nueva",
    "source": "https://www.ctelift.com/en/2021/06/14/cte-presenta-mp-24-c-e-tornata-multipurpose-piu-compatta/",
    "specifications": {
      "Altura sobre obstáculos": "10,5 m"
    }
  },
  "6190": {
    "fingerprint": "4bc3edf9754ce4ce94c8ac0cf5d8b4d2a1183830f5ec42e00258c7c087affbee",
    "brand": null,
    "model": null,
    "categoryKey": "elevacion-nueva",
    "source": "https://hoogwerkers.net/ctelift-brochure/B-LIFT-27.2-WORKING-AREA.pdf",
    "specifications": {
      "Altura de plataforma": "25 m"
    }
  },
  "6423": {
    "fingerprint": "b083cc43e05bf485f8c124979be8bf3b063f88c950c3258c7c24bb7f96b405b4",
    "brand": null,
    "model": "J3.0UTL",
    "categoryKey": "carretillas-nuevas",
    "source": "https://online.gamrentals.com/es/marcas/6423-carretilla-elevadora-electrica-hyster-j30utl",
    "specifications": {
      "Tecnología de batería": "Iones de litio"
    }
  },
  "6953": {
    "fingerprint": "96f1bf37a6c56e250fd862eb85b93636d7b54ecc0a45b3ccb537c790260df06e",
    "brand": "CTE",
    "model": "VJ12",
    "categoryKey": "elevacion-nueva",
    "source": "https://online.gamrentals.com/es/cte/6953-plataforma-sobre-furgon-cte-vj12",
    "specifications": {
      "Masa máxima autorizada del vehículo": "3500 kg"
    }
  },
  "6954": {
    "fingerprint": "f9c3dea6257da9e2a06270c1f21dd6b81ff524d565dc096335ac799b2fd12fb9",
    "brand": "CTE",
    "model": "VJ12 FIB",
    "categoryKey": "elevacion-nueva",
    "source": "https://online.gamrentals.com/es/cte/6954-plataforma-sobre-furgon-cte-vj12-fib",
    "specifications": {
      "Masa máxima autorizada del vehículo": "3500 kg",
      "Material de cesta": "Fibra"
    }
  },
  "72": {
    "fingerprint": "64c91d0dc6234b1196c06ee3f11ee19ec40e4bddf649e6e17b9b234150d5995e",
    "brand": "HYSTER",
    "model": "T7.0 HS3",
    "categoryKey": "marcas-nuevas",
    "source": "https://www.hyster.com/globalassets/coms/hyster/emea/documents/trucks-literature/tow-tractors/t7.0-8.0hs/t7.0-8.0-hs-a489-ss-02-2018-rev00-es.pdf",
    "specifications": {
      "Configuración de ruedas": "3 ruedas",
      "Tensión nominal de batería": "48 V"
    }
  },
  "73": {
    "fingerprint": "d9a8b608bfaabfa722ec3f39d08f5c88a4aeda96ab7295f25474f9241447d176",
    "brand": "HYSTER",
    "model": "T8.0HS4",
    "categoryKey": "marcas-nuevas",
    "source": "https://www.hyster.com/globalassets/coms/hyster/emea/documents/trucks-literature/tow-tractors/t7.0-8.0hs/t7.0-8.0-hs-a489-ss-02-2018-rev00-es.pdf",
    "specifications": {
      "Configuración de ruedas": "4 ruedas",
      "Tensión nominal de batería": "48 V"
    }
  },
  "214": {
    "fingerprint": "ff4aa8e5be6bacf805780d11d8b4edfb41ab3ca9f5ae1cf0b5b2ab85898993d4",
    "brand": "LOGITRANS",
    "model": "RR",
    "categoryKey": "otros-nuevos",
    "source": "https://logitrans.com/manual-reel-rotator/",
    "specifications": {
      "Diámetro admitido de bobina": "120–1270 mm",
      "Apertura máxima de brazos": "1300 mm",
      "Superficie de agarre": "Goma"
    }
  },
  "215": {
    "fingerprint": "241be568d741d877cdc3a6d0c6141d006d3dddb49a7b5313f39afbe4cc24d1ef",
    "brand": "LOGITRANS",
    "model": "RR S",
    "categoryKey": "otros-nuevos",
    "source": "https://logitrans.com/manual-reel-rotator/",
    "specifications": {
      "Diámetro admitido de bobina": "120–1270 mm",
      "Apertura máxima de brazos": "1300 mm",
      "Superficie de agarre": "Goma"
    }
  },
  "216": {
    "fingerprint": "35ff6d6e1cc70b477412e64f99cc0f3e0ed7301fa5ae35588d486fd24c307ba7",
    "brand": "LOGITRANS",
    "model": "RL 500",
    "categoryKey": "otros-nuevos",
    "source": "https://www.howardhandling.co.uk/logitrans-reel-loader-manual-reel-lifter-and-positioner-500kg-48",
    "specifications": {
      "Diámetro máximo de bobina": "1270 mm",
      "Anchura máxima de bobina": "520 mm",
      "Recorrido de elevación": "800 mm"
    }
  },
  "217": {
    "fingerprint": "3614e12bf4b90ec5f92bdfff82333d852d5e42a1fbd0ab489fe76b9b3106bc1c",
    "brand": "LOGITRANS",
    "model": "MDT",
    "categoryKey": "otros-nuevos",
    "source": "https://logitrans.com/multi-drum-turner/",
    "specifications": {
      "Rotación de bidón": "360°",
      "Diámetro admitido de bidón": "300–600 mm",
      "Material de bidón admitido": "Acero y plástico"
    }
  },
};

export const recoverGamDocumentedWarehouseCleaningAndLiftingSpecs = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" || !record.reference ||
    !record.url.startsWith("https://online.gamrentals.com/es/") || !record.specs) return specs;
  const unit = documentedUnits[record.reference];
  if (!unit || record.categoryKey !== unit.categoryKey || record.brand !== unit.brand ||
    record.model !== unit.model || createHash("sha256").update(JSON.stringify(record)).digest("hex") !== unit.fingerprint ||
    Object.keys(unit.specifications).some((key) => key in specs)) return specs;
  return { ...specs, ...unit.specifications };
};

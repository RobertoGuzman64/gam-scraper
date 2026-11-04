import { applyDocumentedTechnicalEvidence } from "../../../documented-technical-evidence.js";
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
  "2364": {
    "fingerprint": "7851a178917ab7a2caad58e229a07dc66c8470cc8e01c87c1eed88e077ef1b78",
    "brand": "BRAVI",
    "model": "SKY DECK",
    "categoryKey": "marcas-nuevas",
    "source": "https://www.bravi-platforms.com/wp-content/uploads/2022/08/PERI-SKYDECK_EN.pdf",
    "specifications": {
      "Peso neto del portapaneles": "4,2 kg",
      "Dimensiones del panel admitido": "1500 x 750 x 120 mm",
      "Número máximo de soportes por Leonardo HD": "3",
      "Montaje del soporte": "Sin herramientas"
    }
  },
  "5949": {
    "fingerprint": "1bed7fb60e9d4c0a4b4de632aedf1bae6404419dbb78d22e90d3f9f98b340d10",
    "brand": "LITTIUM",
    "model": "Ibiza Titanium",
    "categoryKey": "maquinaria",
    "source": "https://www.manualslib.com/manual/2197948/Littium-Ibiza-Titanium.html?page=20",
    "specifications": {
      "Potencia del motor": "250 W",
      "Velocidad máxima de asistencia": "25 km/h",
      "Carga máxima admitida": "120 kg",
      "Peso con batería": "20,5 kg",
      "Tensión nominal del motor": "36 V"
    }
  },
  "6623": {
    "fingerprint": "ce5d5f42ec3229d547f5e3ed65651c6095c090819ca18ece7548484e5ede0bff",
    "brand": "NOOTEBOOM",
    "model": "MC0-4803",
    "categoryKey": "otros",
    "source": "https://online.gamrentals.com/es/resto-maquinaria-segunda-mano/6623-2007-nooteboom-mc0-4803",
    "specifications": {
      "Número de ejes": "3",
      "Ejes direccionales": "Los dos traseros",
      "Primer eje elevable": "Sí",
      "Piso móvil": "Sí"
    }
  },
  "6807": {
    "fingerprint": "e3f3e3167c4922310cc3ca1f68c9ef5ae2dcfcd3d46153ec68c5bef9733942d8",
    "brand": "ZERO",
    "model": "DS 14",
    "categoryKey": "maquinaria",
    "source": "https://www.zeromotorcycle.eu/en/motorcycle/ds/",
    "specifications": {
      "Par motor máximo del modelo": "109 Nm",
      "Velocidad máxima del modelo": "139 km/h",
      "Peso en orden de marcha del modelo": "187 kg",
      "Altura del asiento": "843 mm",
      "Capacidad nominal de batería": "14,4 kWh"
    }
  },
  "6358": {
    "fingerprint": "d378b17b3a8d1d76d2fc3cae6a67d1838ccde6e6917e96f543ade491192ebcea",
    "brand": "KNOTT",
    "model": "KRV20",
    "categoryKey": "otros",
    "source": "https://www.knott-trailer.co.uk/overrun_device_41.html",
    "specifications": {
      "Carga vertical estática admisible del KRV20": "100 kg",
      "Sistema de frenado del KRV20": "Por inercia",
      "Freno de estacionamiento del KRV20": "Accionamiento manual"
    }
  },
  "6367": {
    "fingerprint": "9e517d22804bdd2d802268a49440a9c222541323124dfbc069fcfa33e546f8d1",
    "brand": "KNOTT",
    "model": "KRV20",
    "categoryKey": "otros",
    "source": "https://www.knott-trailer.co.uk/overrun_device_41.html",
    "specifications": {
      "Carga vertical estática admisible del KRV20": "100 kg",
      "Sistema de frenado del KRV20": "Por inercia",
      "Freno de estacionamiento del KRV20": "Accionamiento manual"
    }
  },
  "6688": {
    "fingerprint": "9cb17123489cd9f7cef0250e6102f0187fa9ac2e616f1a91bc543effab32df49",
    "brand": null,
    "model": "SPIDE JUNIOR",
    "categoryKey": "movilidad",
    "source": "https://www.automobile-catalog.com/make/alfa_romeo/spider_alfa_romeo/spider_serie_2/1973.html",
    "specifications": {
      "Tipo de tracción": "Trasera",
      "Transmisión del modelo": "Manual de 5 velocidades",
      "Distancia entre ejes del modelo": "2250 mm"
    }
  },
  "6689": {
    "fingerprint": "c42da846c3aa5b34218af6f2de199b5b005905835d6bca99078d522d3538beb1",
    "brand": null,
    "model": "6 CABRIO 80 2",
    "categoryKey": "movilidad",
    "source": "https://www.auto-data.net/es/audi-cabriolet-b3-8g-2.6-v6-150hp-4251",
    "specifications": {
      "Cilindrada del motor": "2598 cm³",
      "Potencia máxima del motor": "150 CV",
      "Par motor máximo": "225 Nm",
      "Tipo de tracción": "Delantera"
    }
  },
  "6690": {
    "fingerprint": "1a1a14cb5b3f2a19f9ad0ef4b888263cfe14ae3845752ce51730ccc3d59d6ecb",
    "brand": null,
    "model": "304 S CABRIOLET",
    "categoryKey": "movilidad",
    "source": "https://www.carandclassic.com/car/C1956678",
    "specifications": {
      "Cilindrada del motor": "1288 cm³",
      "Potencia máxima DIN": "74,5 CV",
      "Caja de cambios": "Manual de 4 velocidades",
      "Tipo de tracción": "Delantera"
    }
  },
  "4650": {
    "fingerprint": "ed3d7e3a7f5409ec1b70aa2c7bf5ae34f8d0f40faf991c92012216c842dad722",
    "brand": "CTE",
    "model": "B-LIFT 18HV",
    "categoryKey": "elevacion-nueva",
    "source": "https://online.gamrentals.com/es/cte/4650-cte-b-lift-18hv",
    "specifications": {
      "Alcance lateral indicado para B-LIFT 18": "12,5 m",
      "Rotación de torreta": "±320°",
      "Dimensiones de cesta": "1400 x 700 x 1100 mm"
    }
  },
  "4847": {
    "fingerprint": "4bb29488562aea07eb233bd21f9bd79c209a7349b7d1a02bb4f7d73ea713b0f7",
    "brand": "CTE",
    "model": "ZED 20.4 HN IVE FIB AIS",
    "categoryKey": "elevacion-nueva",
    "source": "https://online.gamrentals.com/es/cte/4847-zed-204-hn-ive-fib-ais",
    "specifications": {
      "Alcance lateral del modelo": "8,2 m",
      "Rotación de torreta": "±310°",
      "Aislamiento eléctrico declarado del brazo": "Hasta 1000 V"
    }
  },
  "5918": {
    "fingerprint": "2a76d69593e54d85889e18fa467a4f2c8cb1f89e44c2eeebcb109b81d8262b4a",
    "brand": "Paxster",
    "model": "Gen 2.2",
    "categoryKey": "maquinaria",
    "source": "https://online.gamrentals.com/en/used-electric-vans/5918-paxster-gen-22",
    "specifications": {
      "Capacidad de carga anunciada, conductor incluido": "Hasta 240 kg",
      "Volumen de carga anunciado": "Hasta 1200 L",
      "Número de plazas del modelo": "1"
    }
  },
  "2145": {
    "fingerprint": "9eb8145e2e019809cb32cd4b23b1afb042f460aa74e2a7b1fa56b537343af8fb",
    "brand": "HYSTER",
    "model": "P2.0UTS",
    "categoryKey": "marcas-nuevas",
    "source": "https://www.hyster.com/globalassets/coms/hyster/emea/documents/trucks-literature/pallet-trucks/p2.0uts/p2.0ut-s-a3b1-tg-10-2019-mea-rev01-lrzmag-en.pdf",
    "specifications": {
      "Centro de carga del modelo": "600 mm"
    }
  },
  "4846": {
    "fingerprint": "43c4b841f0402f81ebf724ff0c6e5fa180bb79c2bb8b84f6276022cb215d942c",
    "brand": "CTE",
    "model": "ZED 20.4 HN IVE FIB",
    "categoryKey": "elevacion-nueva",
    "source": "https://online.gamrentals.com/es/cte/4846-zed-204-hn-ive-fib",
    "specifications": {
      "Alcance lateral máximo del modelo": "8,2 m"
    }
  },
  "5254": {
    "fingerprint": "0115132aa28480abc9b0781fbf62ac5148888a43531436ba085b2533d538e763",
    "brand": "LAND ROVER",
    "model": "SANTANA",
    "categoryKey": "movilidad",
    "source": "https://www.automobile-catalog.com/make/santana/series_iii_land/series_iii_109_wagon/1980.html",
    "specifications": {
      "Tipo de tracción": "4x4 conectable",
      "Caja de cambios del modelo": "Manual de 4 velocidades",
      "Distancia entre ejes del modelo": "2769 mm"
    }
  }
};

export const recoverGamDocumentedMobilityAndAccessSpecs = (record: ProductRecord, specs: SpecsMap): SpecsMap =>
  applyDocumentedTechnicalEvidence(record, specs, documentedUnits, { providerId: "gam", isEligible: (value) => value.url.startsWith("https://online.gamrentals.com/") });

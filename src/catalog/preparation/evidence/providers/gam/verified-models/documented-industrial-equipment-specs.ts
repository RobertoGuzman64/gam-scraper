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
  "4029": {
    "fingerprint": "286527207f66b9e61e5e5ce865cd14d3b6c24f201117c9084df69edf3d382e64",
    "brand": "Tennant",
    "model": "BCS S16H Descarga alto",
    "categoryKey": "limpieza-barredoras",
    "source": "https://www.tennantco.com/content/dam/tennant/tennantco/products/machines/sweeper%20riders/s16/s16-specifications-en-emea.pdf",
    "specifications": {
      "Anchura del cepillo principal": "810 mm",
      "Anchura del cepillo lateral": "510 mm",
      "Capacidad de la tolva": "150 L",
      "Altura máxima de descarga de la tolva": "1570 mm"
    }
  },
  "3034": {
    "fingerprint": "00c396477a25ce104b130f15a4483bd16d65d9bc93ff33e05ee01b507a0f226a",
    "brand": "YALE",
    "model": "PLHP25",
    "categoryKey": "marcas-nuevas",
    "source": "https://www.briggsstore.co.uk/uploads/Yale_EN_PLHP25_standard_spec-sheet.pdf",
    "specifications": {
      "Centro de carga": "600 mm",
      "Elevación de las horquillas": "195 mm",
      "Peso de servicio": "60 kg"
    }
  },
  "171": {
    "fingerprint": "46d7af40b8aac37b4822fa9b956f0cd7b7cbadc076a04041d52e4023301dd902",
    "brand": null,
    "model": "T16",
    "categoryKey": "limpieza-fregadoras",
    "source": "https://www.tennantco.com/en_eu/1/machines/scrubbers/product.t16.battery-ride-on-floor-scrubber.m-t16.html",
    "specifications": {
      "Depósito de agua limpia estándar": "190 L",
      "Depósito de recuperación": "225 L",
      "Anchura de la boquilla de aspiración": "1065 mm"
    }
  },
  "4683": {
    "fingerprint": "a522ec6b5bc4a4e5c508ca62c955e7f7d40da17f8f53024a68f76b0470aba9cd",
    "brand": "HELI",
    "model": "CPQYD25-RC1H",
    "categoryKey": "carretillas-nuevas",
    "source": "https://www.dlxforklift.com/wp-content/uploads/2025/12/DLX-Catalog-2024-Version-Gas-Forklift.pdf",
    "specifications": {
      "Centro de carga": "500 mm",
      "Distancia entre ejes": "1650 mm",
      "Anchura total del chasis": "1150 mm"
    }
  },
  "4691": {
    "fingerprint": "0ce0f8fb917f006982789ba45795f163eddee02708bd84bf8123675f9f194bc5",
    "brand": "HELI",
    "model": "CPQYD30-RC1H",
    "categoryKey": "carretillas-nuevas",
    "source": "https://www.dlxforklift.com/wp-content/uploads/2025/12/DLX-Catalog-2024-Version-Gas-Forklift.pdf",
    "specifications": {
      "Centro de carga": "500 mm",
      "Distancia entre ejes": "1700 mm",
      "Anchura total del chasis": "1225 mm"
    }
  },
  "6186": {
    "fingerprint": "baa69c66efadb62f48d9ee5fd428deb55833966c8cd974f9460167f6a7ea8307",
    "brand": null,
    "model": null,
    "categoryKey": "elevacion-nueva",
    "source": "https://ctelift.com/es/plataforma-montada-sobre-camion-dz24/",
    "specifications": {
      "Alcance lateral máximo": "12,70 m",
      "Altura máxima de cesta": "21,60 m",
      "Dimensiones de cesta": "1400 x 700 x 1100 mm"
    }
  },
  "6187": {
    "fingerprint": "e947e7f6b63176b2540ed597015f8c21fba6a27e59d7a81951aaf2c1d678880e",
    "brand": null,
    "model": null,
    "categoryKey": "elevacion-nueva",
    "source": "https://ctelift.com/es/plataforma-montada-sobre-camion-b-lift18/",
    "specifications": {
      "Alcance lateral máximo": "10,50 m",
      "Altura máxima de cesta": "15,70 m",
      "Dimensiones de cesta": "1400 x 700 x 1100 mm"
    }
  },
  "6191": {
    "fingerprint": "23a9a4d8bb6257c94b3d50495da21238ccd6a04bb640da992075eecce7af59c2",
    "brand": null,
    "model": null,
    "categoryKey": "elevacion-nueva",
    "source": "https://ctelift.com/en/zed/",
    "specifications": {
      "Alcance lateral máximo": "10 m",
      "Altura aproximada de cesta": "19 m",
      "Dimensiones de cesta": "1400 x 700 x 1100 mm"
    }
  },
  "6192": {
    "fingerprint": "657a9c0c6749eb7a0f4ef8471fc184fd2c6bccc1e1e45111d0cf46be86d57707",
    "brand": null,
    "model": null,
    "categoryKey": "elevacion-nueva",
    "source": "https://ctelift.com/en/zed/",
    "specifications": {
      "Alcance lateral máximo": "10 m",
      "Altura aproximada de cesta": "21 m",
      "Dimensiones de cesta": "1400 x 700 x 1100 mm"
    }
  },
  "6746": {
    "fingerprint": "9223ce4ddafa536c4cf3d72fcd4a9d52dbb4868853c6d679f45a0229c06f3786",
    "brand": null,
    "model": null,
    "categoryKey": "carretillas-nuevas",
    "source": "https://www.yale.com/es-es/emea/recogedoras-de-pedidos/mo10e-mo10-mo10s/",
    "specifications": {
      "Centro de carga": "600 mm",
      "Altura máxima de preparación": "4,8 m",
      "Accionamiento de traslación": "Eléctrico"
    }
  },
  "2365": {
    "fingerprint": "35d34f6a5e07cb6f848b2696b6edc9c92b5f7b998a9d01849ac74499d163d908",
    "brand": "BRAVI",
    "model": "SOLO GYPS",
    "categoryKey": "marcas-nuevas",
    "source": "https://www.manualslib.com/manual/2589077/Bravi-Platforms-Solo-Gyps.html",
    "specifications": {
      "Capacidad del elevador de paneles": "40 kg",
      "Tamaño máximo del panel": "3,65 x 1,20 m"
    }
  },
  "6805": {
    "fingerprint": "0df9502c6f53dec19d1054a85587b8d81d78ae87c03687bb6908e86649c0c318",
    "brand": null,
    "model": null,
    "categoryKey": "maquinaria",
    "source": "https://www.lvnengebike.com/LX05.html",
    "specifications": {
      "Velocidad máxima": "45 km/h",
      "Tensión nominal de batería": "60 V",
      "Tipo de frenos": "Disco delantero y trasero",
      "Dimensiones exteriores": "1890 x 720 x 1110 mm"
    }
  }
};

export const recoverGamDocumentedIndustrialEquipmentSpecs = (record: ProductRecord, specs: SpecsMap): SpecsMap =>
  applyDocumentedTechnicalEvidence(record, specs, documentedUnits, { providerId: "gam", isEligible: (value) => value.url.startsWith("https://online.gamrentals.com/") });

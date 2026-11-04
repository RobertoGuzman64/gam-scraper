import { createHash } from "node:crypto";
import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { validMercaelevaTechnicalSource } from "../../../mapping/providers/mercaeleva/technical.js";

type DocumentedUnit = {
  readonly fingerprint: string;
  readonly brand: string;
  readonly model: string;
  readonly title: string;
  readonly source: string;
  readonly specifications: Readonly<SpecsMap>;
};

const documentedUnits: Readonly<Record<string, DocumentedUnit>> = {
  "M736-5615": {
    fingerprint: "1fdedbab230b2139197af590648cf2ad0536fd1efcfc3e7bb27b2981eba50bb6",
    brand: "Ausa",
    model: "D450AHG",
    title: "DUMPER GIRATORIO 4500 KG",
    source: "https://www.ausa.com/es-es/dumpers/d450ahg",
    specifications: {
      "Capacidad de carga": "4500 kg",
      "Capacidad de tolva colmada": "2670 l",
      "Tracción": "4x4",
      "Transmisión": "Hidrostática",
    }
  },
  "M432-1479": {
    fingerprint: "c4e527025bf135472eb9b48d2de0678db75198a66ca6790b1e8d8ffdf3b20e41",
    brand: "Kubota",
    model: "U10.3",
    title: "MINIEXCAVADORA ORUGA 1000 KG",
    source: "https://kbm.kubota-eu.com/constructionmachinery/en/products/u10-3u10-3-sl/",
    specifications: {
      "Profundidad máxima de excavación": "1800 mm",
      "Anchura mínima del chasis": "750 mm",
      "Altura máxima de descarga": "2215 mm",
    }
  },
  "M913-0641": {
    fingerprint: "20496af04afc2ae49544eff5fa4edf135106313debf2691a8684727eba69fb53",
    brand: "Kubota",
    model: "U27.4",
    title: "MINIEXCAVADORA ORUGA 2700 KG",
    source: "https://kuk.kubota-eu.com/constructionmachinery/products/u27-4/",
    specifications: {
      "Profundidad máxima de excavación": "2820 mm",
      "Anchura total": "1500 mm",
      "Fuerza máxima de excavación en cuchara": "21 kN",
    }
  },
  "M044-4093": {
    fingerprint: "567c6a5d403e4ed64c14a0988486517be9cd5b90675c74f4237e15194d5ddf05",
    brand: "JLG",
    model: "450 AJ SII",
    title: "PLATAFORMA ARTICULADA DIESEL 16 MT",
    source: "https://jlg.manymanuals.it/special-machinery/450aaj-series-ii-service-manual/user-manual-38276/17",
    specifications: {
      "Altura de plataforma": "13,72 m",
      "Alcance horizontal": "7,47 m",
    }
  },
  "M238-0251": {
    fingerprint: "d1a38757002ebc7563562ed508a7627506cf888e5f8d9a5c1f1b5da57c6ededa",
    brand: "Manitou",
    model: "150AETJC",
    title: "PLATAFORMA ARTICULADA ELECTRICA 15 MT",
    source: "https://www.lectura-specs.es/es/modelo/plataformas-elevadoras/plataformas-elevadoras-articuladas-plataformas-articuladas-de-ruedas-manitou/150-aetj-c-1036275",
    specifications: {
      "Alcance horizontal": "7,6 m",
      "Capacidad máxima de plataforma": "200 kg",
    }
  },
  "M239-8327": {
    fingerprint: "1bc1363e8fa69509c7279c0cc498e95b49992dbae8c87a716babc4f5ef6e7e8c",
    brand: "Hollandlift",
    model: "N-165EL12",
    title: "PLATAFORMA TIJERA ELECTRICA 18.5 MT",
    source: "https://www.colle.eu/en/rent/working-at-heights/aerial-lifts/scissor-lifts/holland-lift-n165el12/",
    specifications: {
      "Altura de plataforma": "16,5 m",
      "Capacidad máxima de plataforma": "500 kg",
    }
  },
  "M315-5925": {
    fingerprint: "1c4ca374cec354fb0219a343de07f405a9e47dc78cd9ba167df156048c01b481",
    brand: "JLG",
    model: "153-12",
    title: "PLATAFORMA TIJERA ELECTRICA 17 MT",
    source: "https://www.manualslib.mx/manual/359967/Jlg-Liftlux-153-12.html?page=64",
    specifications: {
      "Altura de plataforma": "15,3 m",
      "Capacidad máxima de plataforma": "500 kg",
    }
  },
  "M401-4335": {
    fingerprint: "661f7fb97467965fcccd27350f7e8f7907ac8af723201e8c384366d9add87ba5",
    brand: "Niftylift",
    model: "HR12NDE",
    title: "PLATAFORMA ARTICULADA ELECTRICA 12 MT",
    source: "https://www.dragon-access.co.uk/niftylift-hr12/",
    specifications: {
      "Alcance horizontal": "6,1 m",
      "Capacidad máxima de plataforma": "200 kg",
    }
  },
  "M484-4055": {
    fingerprint: "23e3042003aa11f4fbcc7b5fd87fdae15c0d834edb1e0d5e7e6156ff82dca2f8",
    brand: "Niftylift",
    model: "HR21D 4X4",
    title: "PLATAFORMA ARTICULADA DIESEL 21 MT",
    source: "https://www.nationwideplatforms.co.uk/NationwidePlatforms/media/NWPAssets/Resources/Literature/NWP-2021-Product-Guide-Digital.pdf",
    specifications: {
      "Altura de plataforma": "18,8 m",
      "Capacidad máxima de plataforma": "225 kg",
    }
  },
  "M569-9029": {
    fingerprint: "0ab433a9a60d62c1a3505965c9989265d40d92c933a0425696d9646084e35346",
    brand: "LGMG",
    model: "SR1018D",
    title: "PLATAFORMA TIJERA DIESEL 12 MT",
    source: "https://www.lgmglifts.com/product/pro-detail-1027.htm",
    specifications: {
      "Altura de plataforma": "9,7 m",
      "Capacidad máxima de plataforma": "454 kg",
    }
  },
  "M649-6453": {
    fingerprint: "697bdd2bef45dc636ae8dc82078feb86c30ae9900a7fd9e905ca6776389d5653",
    brand: "Skyjack",
    model: "SJ9250",
    title: "PLATAFORMA TIJERA DIESEL 18 MT",
    source: "https://www.skyjack.com/sites/default/files/specifications/ENEU-SJ9241-50RT_0.pdf",
    specifications: {
      "Altura de plataforma": "15,24 m",
      "Anchura total": "2,34 m",
    }
  },
  "M690-5522": {
    fingerprint: "dab68708c74b48db23de8b3ec2dce81cb014a6ac21e29105643446e819b26b9f",
    brand: "Genie",
    model: "Z-34/22",
    title: "PLATAFORMA ARTICULADA DIESEL 12 MT",
    source: "https://www.genielift.com/en/aerial-lifts/articulated-boom-lifts/z3422ic",
    specifications: {
      "Alcance horizontal": "6,78 m",
      "Capacidad máxima de plataforma": "227 kg",
    }
  },
  "M055-1205": {
    fingerprint: "180449477586d5f53cdf2e0626dd81227aa52effc27ba1c96fbbcd4b797b4746",
    brand: "Oil & Steel",
    model: "SCORPION 1812",
    title: "CAMION CESTA 18 MT TELESCOPICO ALUMINIO 18 MT",
    source: "https://www.tvicranes.com/es/paginas/alquiler",
    specifications: {
      "Alcance horizontal": "12 m",
      "Anchura de plataforma": "0,7 m",
    }
  },
  "M502-4867": {
    fingerprint: "d2bfc75f961cc8731bba85988998a217436de6adf80045a8b713828a8256f7ce",
    brand: "Oil & Steel",
    model: "SNAKE 189",
    title: "CAMION CESTA ARTICULADO ALUMINIO 18 MT",
    source: "https://www.lectura-specs.com/en/model/aerial-work-platform/articulating-boom-lifts-trailer-mounted-articulating-boom-lifts-oil-steel/snake-189-11697682",
    specifications: {
      "Alcance horizontal": "9,2 m",
      "Capacidad máxima de plataforma": "225 kg",
    }
  },
  "M329-6156": {
    fingerprint: "939917ef445d36a2bf940b54d10cd5f50a405396028910f2ae9252393c6d0939",
    brand: "Oil & Steel",
    model: "SNAKE 2010 PLUS",
    title: "CAMION CESTA ARTICULADO ALUMINIO 20 MT",
    source: "https://www.equipostrex.com/chi/producto/plataforma-elevadora-snake-2010-plus/",
    specifications: {
      "Longitud de plataforma": "1,4 m",
      "Anchura de plataforma": "0,7 m",
    }
  },
  "M011-3720": {
    fingerprint: "16e5f1bbc33f05b44e7b07ce837bbf4a6b77b933a5ecbccebc4785297c351b80",
    brand: "BT",
    model: "LPE200/8",
    title: "TRANSPALET ELECTRICO",
    source: "https://toyota-forklifts-info.de/t_pdfsearch/Dokumente/Bedienungsanleitung_BT_LPE200_6079911-6103753.pdf",
    specifications: {
      "Propulsión": "Eléctrica",
      "Altura de elevación": "205 mm",
      "Altura de plataforma recogida": "150 mm",
    }
  },
  "M239-6301": {
    fingerprint: "6ef671c7bc7897540ab637aa35bd6ed9d0fe0068a6e3d51dfa10f5c2b71e71ee",
    brand: "BT",
    model: "LPE200/8",
    title: "TRANSPALET ELECTRICO",
    source: "https://toyota-forklifts-info.de/t_pdfsearch/Dokumente/Bedienungsanleitung_BT_LPE200_6079911-6103753.pdf",
    specifications: {
      "Propulsión": "Eléctrica",
      "Altura de elevación": "205 mm",
      "Altura de plataforma recogida": "150 mm",
      "Capacidad nominal": "2000 kg",
    }
  },
  "M005-5167": {
    fingerprint: "c03291d1a48b7ed746db03e25e59005ea15a33c797f6555edf009d50c3eaeaa6",
    brand: "Manitou",
    model: "MT1440 SLT",
    title: "MANIPULADOR TELESCOPICO 14 MT",
    source: "https://www.mascus.se/entreprenadmaskiner/teleskoplastare/manitou-mt-1440-slt-s3-e2/oasbkcw8.html",
    specifications: {
      "Tracción": "4x4",
    }
  },
  "M200-9533": {
    fingerprint: "519e3e6a0453e010f49cdb18c5c6cdd17f02858f6252197ed8678c828dfc1c7e",
    brand: "JLG",
    model: "4014PS",
    title: "MANIPULADOR TELESCOPICO 14 MT",
    source: "https://www.lectura-specs.com/en/model/forklifts/telehandlers-jlg/4014-ps-1152518",
    specifications: {
      "Alcance horizontal": "9,2 m",
    }
  },
  "M640-1938": {
    fingerprint: "62e7845a380a1b0afe00d592c6345bde7ad3324cf09c1902bfd56a210c7ca5bb",
    brand: "Ausa",
    model: "C250HX4",
    title: "CARRETILLA 4x4 2500KG",
    source: "https://www.lectura-specs.es/es/modelo/carretillas-elevadoras/carretillas-elevadoras-todo-terreno-ausa/c-250-h-x-4-1035132",
    specifications: {
      "Velocidad máxima de desplazamiento": "20 km/h",
    }
  },
  "M855-6850": {
    fingerprint: "d8d9ad4d9a93662cb061f3502135d6c53b05a16cd364b80c76c891790882f352",
    brand: "Ausa",
    model: "C250HX4",
    title: "CARRETILLA 4x4 2500KG",
    source: "https://www.lectura-specs.es/es/modelo/carretillas-elevadoras/carretillas-elevadoras-todo-terreno-ausa/c-250-h-x-4-1035132",
    specifications: {
      "Velocidad máxima de desplazamiento": "20 km/h",
    }
  },
};

const sourceFingerprint = (record: ProductRecord): string => createHash("sha256").update(JSON.stringify({
  reference: record.reference,
  url: record.url,
  title: record.title,
  brand: record.brand,
  model: record.model,
  year: record.year,
  condition: record.condition,
  horometer: record.horometer,
  longDescription: record.longDescription,
  specs: record.specs,
})).digest("hex");

export const recoverMercaelevaDocumentedEquipmentTechnicalSpecs = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  if (!validMercaelevaTechnicalSource(record) || record.categoryKey !== "venta" ||
    record.condition !== "Segunda mano" || !record.reference || !record.specs ||
    !record.year || !record.url.endsWith(`-${record.reference}`) ||
    record.specs["Año de fabricación"] !== record.year ||
    record.specs["Marca"] !== record.brand || record.specs["Modelo"] !== record.model) return specs;

  const unit = documentedUnits[record.reference];
  if (!unit || unit.fingerprint !== sourceFingerprint(record) ||
    record.brand !== unit.brand || record.model !== unit.model ||
    record.specs["Título adicional"] !== unit.title ||
    Object.keys(unit.specifications).some((key) => key in specs)) return specs;

  return { ...specs, ...unit.specifications };
};

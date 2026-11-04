import { applyDocumentedTechnicalEvidence } from "../../../documented-technical-evidence.js";
import type { ProductRecord, SpecsMap } from "../../../../../../contracts/catalog.js";

type DocumentedGamUnit = {
  readonly fingerprint: string;
  readonly brand: string | null;
  readonly model: string | null;
  readonly categoryKey: string;
  readonly source: string;
  readonly specifications: Readonly<SpecsMap>;
};

const documentedUnits: Readonly<Record<string, DocumentedGamUnit>> = {
  "211": {
    "fingerprint": "bae1ad7f23d736489f4b61e312a8d1afc09097bc8744ae9bc0dd275307ea11c5",
    "brand": "LOGITRANS",
    "model": "ELFRA/SELFRA",
    "categoryKey": "otros-nuevos",
    "source": "https://logitrans.com/rotator-with-adjustable-box-holders/",
    "specifications": {
      "Anchura de caja admitida": "800–1200 mm",
      "Inclinación de cajas": "Hasta 180°",
      "Velocidad de volteo": "Regulable"
    }
  },
  "212": {
    "fingerprint": "55c825f7c9d73a3141b5c3924ada4cb71272d05639898a2727ed9de26258e0c4",
    "brand": "LOGITRANS",
    "model": "ELFR/SELFR",
    "categoryKey": "otros-nuevos",
    "source": "https://logitrans.com/rotator-with-non-adjustable-box-holders/",
    "specifications": {
      "Inclinación de cajas": "Hasta 180°",
      "Soportes de caja": "Fijos, sin regulación de anchura",
      "Soportes necesarios para más de 500 kg": "Dos"
    }
  },
  "213": {
    "fingerprint": "8120fe449e4e42e1a39016672b247a59879116cf798174995a1dbdbbabf69981",
    "brand": "LOGITRANS",
    "model": "ELFR",
    "categoryKey": "otros-nuevos",
    "source": "https://online.gamrentals.com/es/volteadores-logitrans/213-volteador-multifuncion-logitrans-elfr",
    "specifications": {
      "Grado de inclinación": "Regulable",
      "Velocidad de volteo": "Regulable",
      "Control de aceleración y deceleración": "Progresivo",
      "Parada de inclinación": "Automática en posición neutra"
    }
  },
  "218": {
    "fingerprint": "b0a0d0bd844945f861d56d063aec07bbe6697ce245e9fa30069739fbb38d29d0",
    "brand": "LOGITRANS",
    "model": "Logiflex M",
    "categoryKey": "apiladores-nuevos",
    "source": "https://logitrans.com/manual-logiflex-stacker-lf/",
    "specifications": {
      "Propulsión": "Manual",
      "Accionamiento de elevación": "Hidráulico manual",
      "Freno de estacionamiento": "Incorporado"
    }
  },
  "219": {
    "fingerprint": "938ace9090c7d4b587e7a1dabb72c45e922901fe73c18aa68ff4a448938fe3ab",
    "brand": "LOGITRANS",
    "model": "Logiflex MS",
    "categoryKey": "apiladores-nuevos",
    "source": "https://logitrans.com/US/manual-logiflex-stacker-with-straddle-legs-lfs/",
    "specifications": {
      "Propulsión": "Manual",
      "Accionamiento de elevación": "Hidráulico manual",
      "Patas envolventes": "Para palés cerrados"
    }
  },
  "235": {
    "fingerprint": "f5f612fe626c665fce38eaa0481fecdc5e6469848207dccb8a3b834cec72c11e",
    "brand": "LOGITRANS",
    "model": "Panther",
    "categoryKey": "marcas-nuevas",
    "source": "https://logitrans.com/panther-manual-pallet-truck/",
    "specifications": {
      "Propulsión": "Manual",
      "Descenso de carga": "Controlado",
      "Ensayo de durabilidad": "Hasta 46.000 elevaciones"
    }
  },
  "237": {
    "fingerprint": "39da611d0a7f5a59f4805338e3c1c5b293c11200d1f87ef38721118955365d1b",
    "brand": "LOGITRANS",
    "model": "Panther Flex",
    "categoryKey": "marcas-nuevas",
    "source": "https://online.gamrentals.com/en/pallet-trucks/237-logitrans-panther-flex-manual-pallet-jack",
    "specifications": {
      "Propulsión": "Manual",
      "Elevación": "Hidráulica manual",
      "Descenso de carga": "Controlado"
    }
  },
  "239": {
    "fingerprint": "2a57c02242c6d919cb0d127d95794000d7874a3452ae648e7c5232bae894e656",
    "brand": "LOGITRANS",
    "model": "LogiQ 200/300",
    "categoryKey": "marcas-nuevas",
    "source": "https://logitrans.com/logiq-200-quarter-pallet-lifter/",
    "specifications": {
      "Longitud de horquillas": "600 mm",
      "Altura mínima de horquillas": "85 mm",
      "Propulsión": "Manual"
    }
  },
  "241": {
    "fingerprint": "7faf8231b080dc20dab2f877f2f05997519e7b596f1794732f64638dbfcb5ca1",
    "brand": "LOGITRANS",
    "model": "Panther Inox",
    "categoryKey": "marcas-nuevas",
    "source": "https://online.gamrentals.com/es/transpaletas-logitrans/241-transpaleta-manual-2000-kg-logitrans-panther-inoxidable-parcial",
    "specifications": {
      "Chasis": "Resistente a ácidos",
      "Timón y grupo de elevación": "Acero inoxidable",
      "Acabado de bomba": "Cromado"
    }
  },
  "242": {
    "fingerprint": "8594271eabdbf2f5df0d77b45006513f2a6b038faca79491d89eea6a9d521759",
    "brand": "LOGITRANS",
    "model": "Panther Inox Plus",
    "categoryKey": "marcas-nuevas",
    "source": "https://logitrans.com/panther-manual-pallet-truck-inox-plus-pip/",
    "specifications": {
      "Chasis": "Resistente a ácidos",
      "Timón y componentes de elevación": "Acero inoxidable",
      "Construcción de horquillas": "Cerradas"
    }
  },
  "243": {
    "fingerprint": "c5a1366f2f790b83b050b2c0467d122f5f225e53f10e8bdd67df8d250b612288",
    "brand": "LOGITRANS",
    "model": "HLI",
    "categoryKey": "marcas-nuevas",
    "source": "https://logitrans.com/stainless-steel-highlifters/",
    "specifications": {
      "Accionamiento de elevación": "Manual",
      "Timón y bomba de pistones": "Acero inoxidable",
      "Ruedas de carga": "Tándem"
    }
  },
  "244": {
    "fingerprint": "065c2dde0afc02407e2c76d0f647bf5a66f39b0064077e364cde7db67c335ca1",
    "brand": "LOGITRANS",
    "model": "HLI Plus",
    "categoryKey": "marcas-nuevas",
    "source": "https://logitrans.com/manual-highlifter-inox-plus-hlip/",
    "specifications": {
      "Accionamiento de elevación": "Manual",
      "Timón y bomba de pistones": "Acero inoxidable",
      "Restantes componentes exteriores": "Recubrimiento cromado"
    }
  },
  "297": {
    "fingerprint": "f90ecc189cd7144673888a2252d4ef3cb76cb48727af6dd16dadd91e99e7a23f",
    "brand": "TECNA",
    "model": "E-Frame Simple",
    "categoryKey": "marcas-nuevas",
    "source": "https://www.tecnacar.com/soluciones-logisticas",
    "specifications": {
      "Configuración de remolque": "Madre-hija",
      "Número de plataformas de carga": "1",
      "Transporte del carro": "Sin contacto con el suelo"
    }
  },
  "298": {
    "fingerprint": "e65904c7c176c731f06180a7fc2e693a6ea8539afcdbaf91e874b0e05775ab19",
    "brand": "TECNA",
    "model": "E-Frame Doble",
    "categoryKey": "marcas-nuevas",
    "source": "https://www.tecnacar.com/soluciones-logisticas",
    "specifications": {
      "Configuración de remolque": "Madre-hija",
      "Plataformas de elevación": "2, hidráulicas",
      "Transporte de los carros": "Sin contacto con el suelo"
    }
  },
  "299": {
    "fingerprint": "056753b979bc407bb70bbb21d2478563abec3347d174c314323c890da00cd56b",
    "brand": "TECNA",
    "model": "R-Portal",
    "categoryKey": "marcas-nuevas",
    "source": "https://www.tecnacar.com/soluciones-logisticas",
    "specifications": {
      "Carga y descarga": "Por ambos laterales",
      "Bloqueo del carro": "Integrado",
      "Transporte de plataforma rodante": "Sobre sus propias ruedas"
    }
  },
  "4814": {
    "fingerprint": "e61100a9b22678dba4d6fd06589b3890434035bab58d215f3cc8269b83d1c8c3",
    "brand": "XCMG",
    "model": "XT3207KH",
    "categoryKey": "otros-nuevos",
    "source": "https://xcmguk.com/product/xt3207kh/",
    "specifications": {
      "Tracción": "4×4",
      "Tipo de motor": "Diésel"
    }
  },
  "4817": {
    "fingerprint": "7ce19a79ae5990924b2336fd365173d11be6ffa7cb2af1927780729fa8ba4571",
    "brand": "XCMG",
    "model": "XT4014KH",
    "categoryKey": "otros-nuevos",
    "source": "https://xcmgfiles.com/equipment/models/xt4014kh/",
    "specifications": {
      "Tracción": "4×4",
      "Potencia nominal del motor": "74 kW"
    }
  },
  "4819": {
    "fingerprint": "6bc72ac2114c6e3625d2992845eb940889745399ed0f8031a4f8acd74cd1d10f",
    "brand": "XCMG",
    "model": "XT4018KH",
    "categoryKey": "otros-nuevos",
    "source": "https://targoncatrade.hu/uploads/products/xt4018kh-1738823693.pdf",
    "specifications": {
      "Tracción": "4×4",
      "Capacidad a máxima altura de elevación": "2500 kg"
    }
  },
  "4031": {
    "fingerprint": "b60c7933534224da0212754ec79f2c0cc72d053e112653b4817ae8612c0b9b6e",
    "brand": "Tennant",
    "model": "BCS S20 Batería",
    "categoryKey": "limpieza-barredoras",
    "source": "https://www.tennantco.com/content/dam/tennant/tennantco/products/machines/sweeper%20riders/S20/s20-specifications-battery-en-noam.pdf",
    "specifications": {
      "Capacidad de tolva": "310 l",
      "Longitud del cepillo principal": "910 mm"
    }
  },
  "4040": {
    "fingerprint": "7fcf133cc83c16fcc8fc39680a60e2c86cf7ec2aaf2c44298c54534eef9e3ac9",
    "brand": "Tennant",
    "model": "APL V-WD-72",
    "categoryKey": "marcas-nuevas",
    "source": "https://www.tennantco.com/es_es/1/machines/vacuums/product.v-wd-72.aspirador-h%C3%BAmedo-seco.1244340.html",
    "specifications": {
      "Capacidad del depósito": "72 l",
      "Longitud de cable de alimentación": "8,5 m",
      "Motores de aspiración": "3 independientes"
    }
  }
};

export const recoverGamDocumentedHandlingAndIndustrialSpecs = (record: ProductRecord, specs: SpecsMap): SpecsMap =>
  applyDocumentedTechnicalEvidence(record, specs, documentedUnits, { providerId: "gam", isEligible: (value) => value.url.startsWith("https://online.gamrentals.com/"), requiredCondition: "Nuevo" });

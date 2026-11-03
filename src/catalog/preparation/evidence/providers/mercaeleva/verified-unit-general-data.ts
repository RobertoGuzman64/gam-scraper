import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";

export type VerifiedUnitGeneralEvidence = Readonly<{
  source: Readonly<Pick<ProductRecord,
    "url" | "title" | "brand" | "model" | "year" | "horometer" | "condition" | "shortDescription" | "longDescription">> &
    { readonly specs: SpecsMap };
  general: string;
}>;

export const verifiedMercaelevaUnitEvidence = {
  "M208-7097": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Jungheinrich-EFG-318-M208-7097",
      "title": "Jungheinrich EFG 318 CARRETILLA ELEVADORA ELECTRICA 1800 KG",
      "brand": "Jungheinrich",
      "model": "EFG 318",
      "year": "2015",
      "horometer": "13 858",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. MER0939 CARRETILLA ELEVADORA ELECTRICA 1800 KG TRIPLEX TRIPLEX JUNGHEINRICH EFG 318 ALTURA DE TRABAJO 5.500mm HORAS 13858 AÑO DE FABRICACION 2015",
      "specs": {
        "Marca": "Jungheinrich",
        "Modelo": "EFG 318",
        "Título adicional": "CARRETILLA ELEVADORA ELECTRICA 1800 KG",
        "Año de fabricación": "2015",
        "Artículo No.": "MER0939",
        "Horas laborales": "13 858 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de Batería": "Plomo-ácido",
        "Capacidad máxima de elevación": "1800 kg",
        "Tipo de mástil": "Triple",
        "Altura máxima de elevación": "5500 mm",
        "Tipo de cabina": "Guardia superior",
        "Número de ruedas": "4.0"
      }
    },
    "general": "La Jungheinrich EFG 318 es una carretilla elevadora eléctrica de segunda mano, fabricada en 2015. Según la ficha del proveedor, esta unidad admite una capacidad máxima de elevación de 1.800 kg, con mástil tríplex y altura máxima de elevación de 5.500 mm. Constan batería de plomo-ácido, 4 ruedas y protección superior de cabina. El vendedor registra 13.858 horas de uso y la identifica con la referencia MER0939."
  },
  "M740-4184": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Caterpillar-EP25K-PAC-M740-4184",
      "title": "Caterpillar EP25K-PAC CARRETILLA ELEVADORA ELECTRICA 2500 KG",
      "brand": "Caterpillar",
      "model": "EP25K-PAC",
      "year": "2008",
      "horometer": "5455",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. MER0812 CARRETILLA ELEVADORA ELECTRICA 2500 KG MASTIL TRIPLEX CATERPILLAR EP25K-PAC ALTURA DE TRABAJO 4.500mm HORAS 5455 AÑO DE FABRICACION 2008",
      "specs": {
        "Marca": "Caterpillar",
        "Modelo": "EP25K-PAC",
        "Título adicional": "CARRETILLA ELEVADORA ELECTRICA 2500 KG",
        "Año de fabricación": "2008",
        "Artículo No.": "MER0812",
        "Horas laborales": "5455 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de Batería": "Plomo-ácido",
        "Capacidad máxima de elevación": "2500 kg",
        "Tipo de mástil": "Triple",
        "Altura máxima de elevación": "4500 mm",
        "Tipo de cabina": "Guardia superior",
        "Número de ruedas": "4.0"
      }
    },
    "general": "La Caterpillar EP25K-PAC es una carretilla elevadora eléctrica de segunda mano, fabricada en 2008. Según la ficha del proveedor, esta unidad admite una capacidad máxima de elevación de 2.500 kg, con mástil tríplex y altura máxima de elevación de 4.500 mm. Constan batería de plomo-ácido, 4 ruedas y protección superior de cabina. El vendedor registra 5.455 horas de uso y la identifica con la referencia MER0812."
  },
  "M061-2792": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Linde-E16P-02-M061-2792",
      "title": "Linde E16P-02 CARRETILLA ELEVADORA ELECTRICA 1600 KG",
      "brand": "Linde",
      "model": "E16P-02",
      "year": "2003",
      "horometer": "2091",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. MER0689 CARRETILLA ELEVADORA ELECTRICA 1600 KG TRIPLEX TRIPLEX LINDE E16P-02 ALTURA DE TRABAJO 5.200mm HORAS 2091 AÑO DE FABRICACION 2003",
      "specs": {
        "Marca": "Linde",
        "Modelo": "E16P-02",
        "Título adicional": "CARRETILLA ELEVADORA ELECTRICA 1600 KG",
        "Año de fabricación": "2003",
        "Artículo No.": "MER0689",
        "Horas laborales": "2091 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de Batería": "Plomo-ácido",
        "Capacidad máxima de elevación": "1600 kg",
        "Tipo de mástil": "Triple",
        "Altura máxima de elevación": "5200 mm",
        "Tipo de cabina": "Guardia superior",
        "Número de ruedas": "4.0"
      }
    },
    "general": "La Linde E16P-02 es una carretilla elevadora eléctrica de segunda mano, fabricada en 2003. Según la ficha del proveedor, esta unidad admite una capacidad máxima de elevación de 1.600 kg, con mástil tríplex y altura máxima de elevación de 5.200 mm. Constan batería de plomo-ácido, 4 ruedas y protección superior de cabina. El vendedor registra 2.091 horas de uso y la identifica con la referencia MER0689."
  },
  "M644-0759": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Jungheinrich-EFG-430-M644-0759",
      "title": "Jungheinrich EFG 430 CARRETILLA ELEVADORA ELECTRICA 3000 KG",
      "brand": "Jungheinrich",
      "model": "EFG 430",
      "year": "2017",
      "horometer": "6880",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. MER1000 CARRETILLA ELEVADORA ELECTRICA 3.000 KG MASTIL TRIPLEX JUNGHEINRICH EFG 430 ALTURA DE TRABAJO 4.400mm HORAS 6880 AÑO DE FABRICACION 2017",
      "specs": {
        "Marca": "Jungheinrich",
        "Modelo": "EFG 430",
        "Título adicional": "CARRETILLA ELEVADORA ELECTRICA 3000 KG",
        "Año de fabricación": "2017",
        "Artículo No.": "MER1000",
        "Horas laborales": "6880 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de Batería": "Plomo-ácido",
        "Capacidad máxima de elevación": "3000 kg",
        "Tipo de mástil": "Triple",
        "Altura máxima de elevación": "4400 mm",
        "Tipo de cabina": "Guardia superior",
        "Número de ruedas": "4.0"
      }
    },
    "general": "La Jungheinrich EFG 430 es una carretilla elevadora eléctrica de segunda mano, fabricada en 2017. Según la ficha del proveedor, esta unidad admite una capacidad máxima de elevación de 3.000 kg, con mástil tríplex y altura máxima de elevación de 4.400 mm. Constan batería de plomo-ácido, 4 ruedas y protección superior de cabina. El vendedor registra 6.880 horas de uso y la identifica con la referencia MER1000."
  },
  "M520-1851": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Nissan-GQ02L30CU-M520-1851",
      "title": "Nissan GQ02L30CU CARRETILLA ELEVADORA ELECTRICA 3000 KG",
      "brand": "Nissan",
      "model": "GQ02L30CU",
      "year": "2007",
      "horometer": "13 767",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. MER0551 CARRETILLA ELEVADORA ELECTRICA 3.000 KG TRIPLEX TRIPLEX NISSAN GQ02L30CU ALTURA DE TRABAJO 6.000mm HORAS 13767 AÑO DE FABRICACION 2007",
      "specs": {
        "Marca": "Nissan",
        "Modelo": "GQ02L30CU",
        "Título adicional": "CARRETILLA ELEVADORA ELECTRICA 3000 KG",
        "Año de fabricación": "2007",
        "Artículo No.": "MER0551",
        "Horas laborales": "13 767 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de Batería": "Plomo-ácido",
        "Capacidad máxima de elevación": "3000 kg",
        "Tipo de mástil": "Triple",
        "Altura máxima de elevación": "6000 mm",
        "Tipo de cabina": "Guardia superior",
        "Número de ruedas": "4.0"
      }
    },
    "general": "La Nissan GQ02L30CU es una carretilla elevadora eléctrica de segunda mano, fabricada en 2007. Según la ficha del proveedor, esta unidad admite una capacidad máxima de elevación de 3.000 kg, con mástil tríplex y altura máxima de elevación de 6.000 mm. Constan batería de plomo-ácido, 4 ruedas y protección superior de cabina. El vendedor registra 13.767 horas de uso y la identifica con la referencia MER0551."
  },
  "M493-1006": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Nissan-GQ02L30CU-M493-1006",
      "title": "Nissan GQ02L30CU CARRETILLA ELEVADORA ELECTRICA 3000 KG",
      "brand": "Nissan",
      "model": "GQ02L30CU",
      "year": "2007",
      "horometer": "9715",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. MER0714 CARRETILLA ELEVADORA ELECTRICA 3.000 KG TRIPLEX TRIPLEX NISSAN GQ02L30CU ALTURA DE TRABAJO 6.000mm HORAS 9715 AÑO DE FABRICACION 2007",
      "specs": {
        "Marca": "Nissan",
        "Modelo": "GQ02L30CU",
        "Título adicional": "CARRETILLA ELEVADORA ELECTRICA 3000 KG",
        "Año de fabricación": "2007",
        "Artículo No.": "MER0714",
        "Horas laborales": "9715 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de Batería": "Plomo-ácido",
        "Capacidad máxima de elevación": "3000 kg",
        "Tipo de mástil": "Triple",
        "Altura máxima de elevación": "6000 mm",
        "Tipo de cabina": "Guardia superior",
        "Número de ruedas": "4.0"
      }
    },
    "general": "La Nissan GQ02L30CU es una carretilla elevadora eléctrica de segunda mano, fabricada en 2007. Según la ficha del proveedor, esta unidad admite una capacidad máxima de elevación de 3.000 kg, con mástil tríplex y altura máxima de elevación de 6.000 mm. Constan batería de plomo-ácido, 4 ruedas y protección superior de cabina. El vendedor registra 9.715 horas de uso y la identifica con la referencia MER0714."
  },
  "M701-5459": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Clark-EPX25-M701-5459",
      "title": "Clark EPX25 CARRETILLA ELEVADORA ELECTRICA 2500 KG",
      "brand": "Clark",
      "model": "EPX25",
      "year": "2011",
      "horometer": "801",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. MER1122 CARRETILLA ELEVADORA ELECTRICA 2500 KG MASTIL DUPLEX CLARK EPX 25 ALTURA DE TRABAJO 3.700mm HORAS 801 AÑO DE FABRICACION 2011",
      "specs": {
        "Marca": "Clark",
        "Modelo": "EPX25",
        "Título adicional": "CARRETILLA ELEVADORA ELECTRICA 2500 KG",
        "Año de fabricación": "2011",
        "Artículo No.": "MER1122",
        "Horas laborales": "801 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de Batería": "Plomo-ácido",
        "Capacidad máxima de elevación": "2500 kg",
        "Tipo de mástil": "Dúplex/estándar",
        "Altura máxima de elevación": "3700 mm",
        "Tipo de cabina": "Guardia superior",
        "Número de ruedas": "4.0"
      }
    },
    "general": "La Clark EPX25 es una carretilla elevadora eléctrica de segunda mano, fabricada en 2011. Según la ficha del proveedor, esta unidad admite una capacidad máxima de elevación de 2.500 kg, con mástil dúplex y altura máxima de elevación de 3.700 mm. Constan batería de plomo-ácido, 4 ruedas y protección superior de cabina. El vendedor registra 801 horas de uso y la identifica con la referencia MER1122."
  },
  "M050-0294": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Nissan-Q02L25CU-M050-0294",
      "title": "Nissan Q02L25CU CARRETILLA ELEVADORA ELECTRICA 2500 KG",
      "brand": "Nissan",
      "model": "Q02L25CU",
      "year": "2010",
      "horometer": "543",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. MER0392 CARRETILLA ELEVADORA ELECTRICA 2500 KG TRIPLEX TRIPLEX NISSAN Q02L25CU ALTURA DE TRABAJO 6.000mm HORAS 543 AÑO DE FABRICACION 2010",
      "specs": {
        "Marca": "Nissan",
        "Modelo": "Q02L25CU",
        "Título adicional": "CARRETILLA ELEVADORA ELECTRICA 2500 KG",
        "Año de fabricación": "2010",
        "Artículo No.": "MER0392",
        "Horas laborales": "543 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de Batería": "Plomo-ácido",
        "Capacidad máxima de elevación": "2500 kg",
        "Tipo de mástil": "Triple",
        "Altura máxima de elevación": "6000 mm",
        "Tipo de cabina": "Guardia superior",
        "Número de ruedas": "4.0"
      }
    },
    "general": "La Nissan Q02L25CU es una carretilla elevadora eléctrica de segunda mano, fabricada en 2010. Según la ficha del proveedor, esta unidad admite una capacidad máxima de elevación de 2.500 kg, con mástil tríplex y altura máxima de elevación de 6.000 mm. Constan batería de plomo-ácido, 4 ruedas y protección superior de cabina. El vendedor registra 543 horas de uso y la identifica con la referencia MER0392."
  },
  "M547-0541": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Nissan-Q02L20CU-M547-0541",
      "title": "Nissan Q02L20CU CARRETILLA ELEVADORA ELECTRICA 2000 KG",
      "brand": "Nissan",
      "model": "Q02L20CU",
      "year": "2007",
      "horometer": "16 169",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. MER0552 CARRETILLA ELEVADORA ELECTRICA 2000 KG TRIPLEX TRIPLEX NISSAN Q02L20CU ALTURA DE TRABAJO 6.000mm HORAS 16169 AÑO DE FABRICACION 2007",
      "specs": {
        "Marca": "Nissan",
        "Modelo": "Q02L20CU",
        "Título adicional": "CARRETILLA ELEVADORA ELECTRICA 2000 KG",
        "Año de fabricación": "2007",
        "Artículo No.": "MER0552",
        "Horas laborales": "16 169 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de Batería": "Plomo-ácido",
        "Capacidad máxima de elevación": "2000 kg",
        "Tipo de mástil": "Triple",
        "Altura máxima de elevación": "6000 mm",
        "Tipo de cabina": "Guardia superior",
        "Número de ruedas": "4.0"
      }
    },
    "general": "La Nissan Q02L20CU es una carretilla elevadora eléctrica de segunda mano, fabricada en 2007. Según la ficha del proveedor, esta unidad admite una capacidad máxima de elevación de 2.000 kg, con mástil tríplex y altura máxima de elevación de 6.000 mm. Constan batería de plomo-ácido, 4 ruedas y protección superior de cabina. El vendedor registra 16.169 horas de uso y la identifica con la referencia MER0552."
  },
  "M976-0333": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Nissan-JAG1N1L18Q-M976-0333",
      "title": "Nissan JAG1N1L18Q CARRETILLA ELEVADORA ELECTRICA 1800 KG",
      "brand": "Nissan",
      "model": "JAG1N1L18Q",
      "year": "2013",
      "horometer": "22 028",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. MER0838 CARRETILLA ELEVADORA ELECTRICA 1800 KG TRIPLEX TRIPLEX NISSAN JAG1N1L18Q ALTURA DE TRABAJO 4.700mm HORAS 22028 AÑO DE FABRICACION 2013",
      "specs": {
        "Marca": "Nissan",
        "Modelo": "JAG1N1L18Q",
        "Título adicional": "CARRETILLA ELEVADORA ELECTRICA 1800 KG",
        "Año de fabricación": "2013",
        "Artículo No.": "MER0838",
        "Horas laborales": "22 028 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de Batería": "Plomo-ácido",
        "Capacidad máxima de elevación": "1800 kg",
        "Tipo de mástil": "Triple",
        "Altura máxima de elevación": "4700 mm",
        "Tipo de cabina": "Guardia superior",
        "Número de ruedas": "4.0"
      }
    },
    "general": "La Nissan JAG1N1L18Q es una carretilla elevadora eléctrica de segunda mano, fabricada en 2013. Según la ficha del proveedor, esta unidad admite una capacidad máxima de elevación de 1.800 kg, con mástil tríplex y altura máxima de elevación de 4.700 mm. Constan batería de plomo-ácido, 4 ruedas y protección superior de cabina. El vendedor registra 22.028 horas de uso y la identifica con la referencia MER0838."
  },
  "M941-0638": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Linde-E16H-01-M941-0638",
      "title": "Linde E16H-01 CARRETILLA ELEVADORA ELECTRICA 1600 KG",
      "brand": "Linde",
      "model": "E16H-01",
      "year": "2008",
      "horometer": "16 730",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. MER0789 CARRETILLA ELEVADORA ELECTRICA 1600 KG TRIPLEX TRIPLEX LINDE E16H-01 ALTURA DE TRABAJO 4.700mm HORAS 16730 AÑO DE FABRICACION 2008",
      "specs": {
        "Marca": "Linde",
        "Modelo": "E16H-01",
        "Título adicional": "CARRETILLA ELEVADORA ELECTRICA 1600 KG",
        "Año de fabricación": "2008",
        "Artículo No.": "MER0789",
        "Horas laborales": "16 730 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de Batería": "Plomo-ácido",
        "Capacidad máxima de elevación": "1600 kg",
        "Tipo de mástil": "Triple",
        "Altura máxima de elevación": "4700 mm",
        "Tipo de cabina": "Guardia superior",
        "Número de ruedas": "3.0"
      }
    },
    "general": "La Linde E16H-01 es una carretilla elevadora eléctrica de segunda mano, fabricada en 2008. Según la ficha del proveedor, esta unidad admite una capacidad máxima de elevación de 1.600 kg, con mástil tríplex y altura máxima de elevación de 4.700 mm. Constan batería de plomo-ácido, 3 ruedas y protección superior de cabina. El vendedor registra 16.730 horas de uso y la identifica con la referencia MER0789."
  },
  "M838-9580": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Nissan-JAG1N1L16Q-M838-9580",
      "title": "Nissan JAG1N1L16Q CARRETILLA ELEVADORA ELECTRICA 1600 KG",
      "brand": "Nissan",
      "model": "JAG1N1L16Q",
      "year": "2013",
      "horometer": "28 956",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. MER0504 CARRETILLA ELEVADORA ELECTRICA 1600 KG TRIPLEX TRIPLEX NISSAN JAG1N1L16Q ALTURA DE TRABAJO 4.700mm HORAS 28956 AÑO DE FABRICACION 2013",
      "specs": {
        "Marca": "Nissan",
        "Modelo": "JAG1N1L16Q",
        "Título adicional": "CARRETILLA ELEVADORA ELECTRICA 1600 KG",
        "Año de fabricación": "2013",
        "Artículo No.": "MER0504",
        "Horas laborales": "28 956 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de Batería": "Plomo-ácido",
        "Capacidad máxima de elevación": "1600 kg",
        "Tipo de mástil": "Triple",
        "Altura máxima de elevación": "4700 mm",
        "Tipo de cabina": "Guardia superior",
        "Número de ruedas": "4.0"
      }
    },
    "general": "La Nissan JAG1N1L16Q es una carretilla elevadora eléctrica de segunda mano, fabricada en 2013. Según la ficha del proveedor, esta unidad admite una capacidad máxima de elevación de 1.600 kg, con mástil tríplex y altura máxima de elevación de 4.700 mm. Constan batería de plomo-ácido, 4 ruedas y protección superior de cabina. El vendedor registra 28.956 horas de uso y la identifica con la referencia MER0504."
  },
  "M270-9140": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Toyota-7FBEF15-M270-9140",
      "title": "Toyota 7FBEF15 CARRETILLA ELEVADORA ELECTRICA 1500 KG",
      "brand": "Toyota",
      "model": "7FBEF15",
      "year": "2012",
      "horometer": "9282",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. MER0788 CARRETILLA ELEVADORA ELECTRICA 1500 KG MÁSTIL TRIPLEX TOYOTA 7FBEF15 ALTURA DE TRABAJO 4.500mm HORAS 9282 AÑO DE FABRICACION 2012",
      "specs": {
        "Marca": "Toyota",
        "Modelo": "7FBEF15",
        "Título adicional": "CARRETILLA ELEVADORA ELECTRICA 1500 KG",
        "Año de fabricación": "2012",
        "Artículo No.": "MER0788",
        "Horas laborales": "9282 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de Batería": "Plomo-ácido",
        "Capacidad máxima de elevación": "1500 kg",
        "Tipo de mástil": "Triple",
        "Altura máxima de elevación": "4500 mm",
        "Tipo de cabina": "Guardia superior",
        "Número de ruedas": "3.0"
      }
    },
    "general": "La Toyota 7FBEF15 es una carretilla elevadora eléctrica de segunda mano, fabricada en 2012. Según la ficha del proveedor, esta unidad admite una capacidad máxima de elevación de 1.500 kg, con mástil tríplex y altura máxima de elevación de 4.500 mm. Constan batería de plomo-ácido, 3 ruedas y protección superior de cabina. El vendedor registra 9.282 horas de uso y la identifica con la referencia MER0788."
  },
  "M052-5188": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Toyota-7FBEF15-M052-5188",
      "title": "Toyota 7FBEF15 CARRETILLA ELEVADORA ELECTRICA 1500 KG",
      "brand": "Toyota",
      "model": "7FBEF15",
      "year": "2006",
      "horometer": "19 769",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. MER0657 CARRETILLA ELEVADORA ELECTRICA 1500 KG MÁSTIL TRIPLEX TOYOTA 7FBEF15 ALTURA ELEVACION 4.700MM HORAS 19769 AÑO DE FABRICACION 2006",
      "specs": {
        "Marca": "Toyota",
        "Modelo": "7FBEF15",
        "Título adicional": "CARRETILLA ELEVADORA ELECTRICA 1500 KG",
        "Año de fabricación": "2006",
        "Artículo No.": "MER0657",
        "Horas laborales": "19 769 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de Batería": "Plomo-ácido",
        "Capacidad máxima de elevación": "1500 kg",
        "Tipo de mástil": "Triple",
        "Altura máxima de elevación": "4700 mm",
        "Tipo de cabina": "Guardia superior",
        "Número de ruedas": "3.0"
      }
    },
    "general": "La Toyota 7FBEF15 es una carretilla elevadora eléctrica de segunda mano, fabricada en 2006. Según la ficha del proveedor, esta unidad admite una capacidad máxima de elevación de 1.500 kg, con mástil tríplex y altura máxima de elevación de 4.700 mm. Constan batería de plomo-ácido, 3 ruedas y protección superior de cabina. El vendedor registra 19.769 horas de uso y la identifica con la referencia MER0657."
  },
  "M264-2806": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Oil-Steel-SCORPION-1490-M264-2806",
      "title": "Oil & Steel SCORPION 1490 CAMION CESTA TELESCOPICO ALUMINIO 15 MT",
      "brand": "Oil & Steel",
      "model": "SCORPION 1490",
      "year": "2017",
      "horometer": "4003",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref.491 CAMION CESTA TELESCOPICO ALUMINIO ALTURA DE TRABAJO 15 MT OIL&STEEL SCORPION 1490 HORAS 4003 AÑO DE FABRICACION 2017",
      "specs": {
        "Marca": "Oil & Steel",
        "Modelo": "SCORPION 1490",
        "Título adicional": "CAMION CESTA TELESCOPICO ALUMINIO 15 MT",
        "Año de fabricación": "2017",
        "Artículo No.": "491",
        "Certificación CE": "Yes",
        "Horas laborales": "4003 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de motor": "Diesel",
        "Altura de trabajo": "15 m"
      }
    },
    "general": "El camión cesta telescópico Oil & Steel SCORPION 1490 se anuncia como unidad de segunda mano del año 2017. Su ficha declara una altura de trabajo de 15 m, motorización diésel y certificación CE. El proveedor indica 4.003 horas de uso para esta máquina con cesta de aluminio. La referencia comercial 491 permite diferenciarla de las otras unidades anunciadas del mismo modelo."
  },
  "M082-5310": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Oil-Steel-SCORPION-1490-M082-5310",
      "title": "Oil & Steel SCORPION 1490 CAMION CESTA TELESCOPICO ALUMINIO 15 MT",
      "brand": "Oil & Steel",
      "model": "SCORPION 1490",
      "year": "2017",
      "horometer": "4118",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref.494 CAMION CESTA TELESCOPICO ALUMINIO ALTURA DE TRABAJO 15 MT OIL&STEEL SCORPION 1490 HORAS 4118 AÑO DE FABRICACION 2017",
      "specs": {
        "Marca": "Oil & Steel",
        "Modelo": "SCORPION 1490",
        "Título adicional": "CAMION CESTA TELESCOPICO ALUMINIO 15 MT",
        "Año de fabricación": "2017",
        "Artículo No.": "494",
        "Certificación CE": "Yes",
        "Horas laborales": "4118 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de motor": "Diesel",
        "Altura de trabajo": "15 m"
      }
    },
    "general": "El camión cesta telescópico Oil & Steel SCORPION 1490 se anuncia como unidad de segunda mano del año 2017. Su ficha declara una altura de trabajo de 15 m, motorización diésel y certificación CE. El proveedor indica 4.118 horas de uso para esta máquina con cesta de aluminio. La referencia comercial 494 permite diferenciarla de las otras unidades anunciadas del mismo modelo."
  },
  "M055-1205": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Oil-Steel-SCORPION-1812-M055-1205",
      "title": "Oil & Steel SCORPION 1812 CAMION CESTA 18 MT TELESCOPICO ALUMINIO 18 MT",
      "brand": "Oil & Steel",
      "model": "SCORPION 1812",
      "year": "2016",
      "horometer": "4582",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref.414 CAMION CESTA 18 MT TELESCOPICO ALUMINIO ALTURA DE TRABAJO 18 MT OIL&STEEL SCORPION 1812 HORAS 4582 AÑO DE FABRICACION 2016",
      "specs": {
        "Marca": "Oil & Steel",
        "Modelo": "SCORPION 1812",
        "Título adicional": "CAMION CESTA 18 MT TELESCOPICO ALUMINIO 18 MT",
        "Año de fabricación": "2016",
        "Artículo No.": "414",
        "Certificación CE": "Yes",
        "Horas laborales": "4582 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de motor": "Diesel",
        "Altura de trabajo": "18 m"
      }
    },
    "general": "El camión cesta telescópico Oil & Steel SCORPION 1812 se anuncia como unidad de segunda mano del año 2016. Su ficha declara una altura de trabajo de 18 m, motorización diésel y certificación CE. El proveedor indica 4.582 horas de uso para esta máquina con cesta de aluminio. La referencia comercial 414 permite diferenciarla de las otras unidades anunciadas del mismo modelo."
  },
  "M692-8041": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Haulotte-HA32PX-M692-8041",
      "title": "Haulotte HA32PX PLATAFORMA ARTICULADA DIESEL 32 MT",
      "brand": "Haulotte",
      "model": "HA32PX",
      "year": "2009",
      "horometer": "7282",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref.270 PLATAFORMA ARTICULADA DIESEL ALTURA DE TRABAJO 32 MT HAULOTTE HA32PX HORAS 7282 AÑO DE FABRICACION 2009 SECOND LIFE",
      "specs": {
        "Marca": "Haulotte",
        "Modelo": "HA32PX",
        "Título adicional": "PLATAFORMA ARTICULADA DIESEL 32 MT",
        "Año de fabricación": "2009",
        "Artículo No.": "270",
        "Horas laborales": "7282 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de motor": "Diesel",
        "Altura de trabajo": "32 m"
      }
    },
    "general": "La Haulotte HA32PX es una plataforma articulada diésel de segunda mano. La ficha de esta unidad declara 32 m de altura de trabajo y año de fabricación 2009. El anuncio original la identifica mediante la referencia comercial 270, con 7.282 horas registradas. Estos datos corresponden a la unidad publicada y no a otras plataformas de la misma serie."
  },
  "M281-3486": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Haulotte-Optimum-8-M281-3486",
      "title": "Haulotte Optimum 8 PLATAFORMA TIJERA ELECTRICA 8 MT",
      "brand": "Haulotte",
      "model": "Optimum 8",
      "year": "2018",
      "horometer": "484",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. 617 PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 8 MT HAULOTTE OPTIMUM 8 AC HORAS 484 AÑO DE FABRICACION 2018",
      "specs": {
        "Marca": "Haulotte",
        "Modelo": "Optimum 8",
        "Título adicional": "PLATAFORMA TIJERA ELECTRICA 8 MT",
        "Año de fabricación": "2018",
        "Artículo No.": "617",
        "Horas laborales": "484 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de motor": "Eléctrico",
        "Altura de trabajo": "8 m"
      }
    },
    "general": "La Haulotte Optimum 8 es una plataforma de tijera eléctrica anunciada de segunda mano, fabricada en 2018. El vendedor declara 8 m de altura de trabajo y especifica la denominación Optimum 8 AC en el texto original. Esta unidad registra 484 horas de uso y tiene la referencia comercial 617, diferente de las demás unidades del mismo modelo."
  },
  "M229-0241": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Haulotte-Optimum-8-M229-0241",
      "title": "Haulotte Optimum 8 PLATAFORMA TIJERA ELECTRICA 8 MT",
      "brand": "Haulotte",
      "model": "Optimum 8",
      "year": "2018",
      "horometer": "475",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. 616 PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 8 MT HAULOTTE OPTIMUM 8 AC HORAS 475 AÑO DE FABRICACION 2018",
      "specs": {
        "Marca": "Haulotte",
        "Modelo": "Optimum 8",
        "Título adicional": "PLATAFORMA TIJERA ELECTRICA 8 MT",
        "Año de fabricación": "2018",
        "Artículo No.": "616",
        "Horas laborales": "475 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de motor": "Eléctrico",
        "Altura de trabajo": "8 m"
      }
    },
    "general": "La Haulotte Optimum 8 es una plataforma de tijera eléctrica anunciada de segunda mano, fabricada en 2018. El vendedor declara 8 m de altura de trabajo y especifica la denominación Optimum 8 AC en el texto original. Esta unidad registra 475 horas de uso y tiene la referencia comercial 616, diferente de las demás unidades del mismo modelo."
  },
  "M539-6438": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Haulotte-Optimum-8-M539-6438",
      "title": "Haulotte Optimum 8 PLATAFORMA TIJERA ELECTRICA 8 MT",
      "brand": "Haulotte",
      "model": "Optimum 8",
      "year": "2018",
      "horometer": "367",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. 578 PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 8 MT HAULOTTE OPTIMUM 8 AC HORAS 367 AÑO DE FABRICACION 2018",
      "specs": {
        "Marca": "Haulotte",
        "Modelo": "Optimum 8",
        "Título adicional": "PLATAFORMA TIJERA ELECTRICA 8 MT",
        "Año de fabricación": "2018",
        "Artículo No.": "578",
        "Horas laborales": "367 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de motor": "Eléctrico",
        "Altura de trabajo": "8 m"
      }
    },
    "general": "La Haulotte Optimum 8 es una plataforma de tijera eléctrica anunciada de segunda mano, fabricada en 2018. El vendedor declara 8 m de altura de trabajo y especifica la denominación Optimum 8 AC en el texto original. Esta unidad registra 367 horas de uso y tiene la referencia comercial 578, diferente de las demás unidades del mismo modelo."
  },
  "M995-8408": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/JLG-1930ES-M995-8408",
      "title": "JLG 1930ES PLATAFORMA DE TIJERA ELECTRICA",
      "brand": "JLG",
      "model": "1930ES",
      "year": "2007",
      "horometer": "543",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. 183 PLATAFORMA TIJERA ELÉCTRICA ALTURA DE TRABAJO 8 MT JLG 1930ES HORAS 543 AÑO DE FABRICACION 2007",
      "specs": {
        "Marca": "JLG",
        "Modelo": "1930ES",
        "Título adicional": "PLATAFORMA DE TIJERA ELECTRICA",
        "Año de fabricación": "2007",
        "Artículo No.": "183",
        "Horas laborales": "543 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de motor": "Eléctrico",
        "Altura de trabajo": "8 m"
      }
    },
    "general": "La JLG 1930ES es una plataforma de tijera eléctrica de segunda mano, con 8 m de altura de trabajo según el proveedor. La ficha de origen señala el año de fabricación 2007 y 543 horas registradas. El anuncio utiliza la referencia 183 para identificar esta unidad concreta."
  },
  "M035-8084": {
      "source": {
          "url": "https://sales.mercaeleva.com/es/for-sale/machine/MB-F4-M035-8084",
          "title": "MB F4 Transpaleta Eléctrica 1.500 kg",
          "brand": "MB",
          "model": "F4",
          "year": "2025",
          "horometer": "1",
          "condition": "Nuevo",
          "shortDescription": null,
          "longDescription": null,
          "specs": {
              "Marca": "MB",
              "Modelo": "F4",
              "Título adicional": "Transpaleta Eléctrica 1.500 kg",
              "Año de fabricación": "2025",
              "Horas laborales": "1 h",
              "Estado": "Nuevo",
              "Tipo de Batería": "Gel",
              "Marca de la batería": "MB",
              "Voltaje de la batería": "24 V",
              "Capacidad de la batería": "20 Ah",
              "Año de fabricación de la batería": "2025",
              "Marca del cargador": "MB",
              "Voltaje del cargador": "24 V",
              "Corriente del cargador": "4 A",
              "Posición del conductor": "Peatonal",
              "Capacidad máxima de elevación": "1500 kg",
              "Distancia del centro de gravedad": "560 mm",
              "Longitud de tenedor": "1150 mm"
          }
      },
      "general": "La MB F4 es una transpaleta eléctrica nueva de 1.500 kg con batería de gel de 24 V y 20 Ah. La ficha individual especifica conducción peatonal, horquillas de 1.150 mm y centro de carga de 560 mm. Incorpora cargador MB de 24 V y 4 A; la unidad y su batería figuran fabricadas en 2025."
  },
  "M141-6536": {
      "source": {
          "url": "https://sales.mercaeleva.com/es/for-sale/machine/MB-EPL154-M141-6536",
          "title": "MB EPL154 Transpaleta Eléctrica batería de Litio de 1.500kg",
          "brand": "MB",
          "model": "EPL154",
          "year": "2025",
          "horometer": "1",
          "condition": "Nuevo",
          "shortDescription": null,
          "longDescription": null,
          "specs": {
              "Marca": "MB",
              "Modelo": "EPL154",
              "Título adicional": "Transpaleta Eléctrica batería de Litio de 1.500kg",
              "Año de fabricación": "2025",
              "Horas laborales": "1 h",
              "Estado": "Nuevo",
              "Tipo de Batería": "Li-ion",
              "Marca de la batería": "MB",
              "Voltaje de la batería": "24 V",
              "Capacidad de la batería": "30 Ah",
              "Marca del cargador": "MB",
              "Voltaje del cargador": "220 V",
              "Corriente del cargador": "10 A",
              "Posición del conductor": "Peatonal",
              "Capacidad máxima de elevación": "1500 kg",
              "Distancia del centro de gravedad": "540 mm",
              "Longitud de tenedor": "1150 mm"
          }
      },
      "general": "La MB EPL154 es una transpaleta eléctrica nueva de 1.500 kg, equipada con batería de litio de 24 V y 30 Ah. Esta unidad tiene conducción peatonal, horquillas de 1.150 mm y centro de carga de 540 mm. Su ficha indica un cargador MB de 220 V y 10 A, y año de fabricación 2025."
  },
  "M402-2703": {
      "source": {
          "url": "https://sales.mercaeleva.com/es/for-sale/machine/MB-EFL253-M402-2703",
          "title": "MB EFL253 Carretilla eléctrica de 2.500kg con batería de Litio",
          "brand": "MB",
          "model": "EFL253",
          "year": "2025",
          "horometer": "1",
          "condition": "Nuevo",
          "shortDescription": null,
          "longDescription": null,
          "specs": {
              "Marca": "MB",
              "Modelo": "EFL253",
              "Título adicional": "Carretilla eléctrica de 2.500kg con batería de Litio",
              "Año de fabricación": "2025",
              "Horas laborales": "1 h",
              "Estado": "Nuevo",
              "Tipo de Batería": "Li-ion",
              "Marca de la batería": "MB",
              "Voltaje de la batería": "80 V",
              "Capacidad de la batería": "205 Ah",
              "Año de fabricación de la batería": "2025",
              "Marca del cargador": "MB",
              "Voltaje del cargador": "80 V",
              "Corriente del cargador": "60 A",
              "Capacidad máxima de elevación": "2500 kg",
              "Tipo de mástil": "Triple",
              "Altura máxima de elevación": "4800 mm",
              "Longitud de tenedor": "1220 mm",
              "Accesorio de mástil de elevación": "Yes",
              "Número de ruedas": "4.0"
          }
      },
      "general": "La carretilla eléctrica nueva MB EFL253 tiene capacidad máxima de 2.500 kg, mástil tríplex y elevación de 4.800 mm. Equipa batería de litio de 80 V y 205 Ah y cargador MB de 80 V y 60 A. El proveedor indica horquillas de 1.220 mm, cuatro ruedas y fabricación en 2025."
  },
  "M288-9739": {
      "source": {
          "url": "https://sales.mercaeleva.com/es/for-sale/machine/MB-ESL122-M288-9739",
          "title": "MB ESL122 Apilador Eléctrico de 1.200kg con batería de Litio",
          "brand": "MB",
          "model": "ESL122",
          "year": "2026",
          "horometer": "1",
          "condition": "Nuevo",
          "shortDescription": null,
          "longDescription": null,
          "specs": {
              "Marca": "MB",
              "Modelo": "ESL122",
              "Título adicional": "Apilador Eléctrico de 1.200kg con batería de Litio",
              "Año de fabricación": "2026",
              "Horas laborales": "1 h",
              "Estado": "Nuevo",
              "Tipo de Batería": "Li-ion",
              "Marca de la batería": "MB",
              "Voltaje de la batería": "24 V",
              "Capacidad de la batería": "100 Ah",
              "Año de fabricación de la batería": "2025",
              "Marca del cargador": "MB",
              "Voltaje del cargador": "24 V",
              "Corriente del cargador": "30 A",
              "Posición del conductor": "Plataforma",
              "Capacidad máxima de elevación": "1200 kg",
              "Tipo de mástil": "Dúplex/estándar",
              "Altura máxima de elevación": "3600 mm",
              "Longitud de tenedor": "1150 mm"
          }
      },
      "general": "El apilador eléctrico nuevo MB ESL122 admite 1.200 kg y una elevación máxima de 3.600 mm con mástil dúplex. Tiene batería de litio de 24 V y 100 Ah, plataforma para el conductor y horquillas de 1.150 mm. Su cargador MB figura con 24 V y 30 A. Año de fabricación de la unidad: 2026."
  },
  "M346-8712": {
      "source": {
          "url": "https://sales.mercaeleva.com/es/for-sale/machine/MB-WSI161L-M346-8712",
          "title": "MB WSI161L Apilador de Elevación Inicial con mástil tríplex de 1.600kg",
          "brand": "MB",
          "model": "WSI161L",
          "year": "2026",
          "horometer": "1",
          "condition": "Nuevo",
          "shortDescription": null,
          "longDescription": null,
          "specs": {
              "Marca": "MB",
              "Modelo": "WSI161L",
              "Título adicional": "Apilador de Elevación Inicial con mástil tríplex de 1.600kg",
              "Año de fabricación": "2026",
              "Horas laborales": "1 h",
              "Estado": "Nuevo",
              "Tipo de Batería": "Li-ion",
              "Marca de la batería": "MB",
              "Voltaje de la batería": "24 V",
              "Capacidad de la batería": "205 Ah",
              "Año de fabricación de la batería": "2025",
              "Marca del cargador": "MB",
              "Voltaje del cargador": "24 V",
              "Corriente del cargador": "100 A",
              "Posición del conductor": "Peatonal",
              "Capacidad máxima de elevación": "1600 kg",
              "Tipo de mástil": "Triple",
              "Altura máxima de elevación": "4800 mm",
              "Longitud de tenedor": "1151 mm"
          }
      },
      "general": "El apilador eléctrico de elevación inicial MB WSI161L es una unidad nueva de 1.600 kg, mástil tríplex y elevación máxima de 4.800 mm. La ficha declara batería de litio de 24 V y 205 Ah, conducción peatonal y horquillas de 1.151 mm. Incluye cargador MB de 24 V y 100 A; el equipo figura fabricado en 2026."
  },
  "M373-1421": {
      "source": {
          "url": "https://sales.mercaeleva.com/es/for-sale/machine/MB-RSL161-M373-1421",
          "title": "MB RSL161 Apilador de Elevación Inicial con mástil tríplex de 1.600kg",
          "brand": "MB",
          "model": "RSL161",
          "year": "2026",
          "horometer": "1",
          "condition": "Nuevo",
          "shortDescription": null,
          "longDescription": null,
          "specs": {
              "Marca": "MB",
              "Modelo": "RSL161",
              "Título adicional": "Apilador de Elevación Inicial con mástil tríplex de 1.600kg",
              "Año de fabricación": "2026",
              "Horas laborales": "1 h",
              "Estado": "Nuevo",
              "Tipo de Batería": "Li-ion",
              "Marca de la batería": "MB",
              "Voltaje de la batería": "24 V",
              "Capacidad de la batería": "205 Ah",
              "Año de fabricación de la batería": "2025",
              "Marca del cargador": "MB",
              "Voltaje del cargador": "24 V",
              "Corriente del cargador": "100 A",
              "Posición del conductor": "Plataforma",
              "Capacidad máxima de elevación": "1600 kg",
              "Tipo de mástil": "Triple",
              "Altura máxima de elevación": "4800 mm",
              "Longitud de tenedor": "1149 mm"
          }
      },
      "general": "El apilador eléctrico de elevación inicial MB RSL161 es una unidad nueva de 1.600 kg, mástil tríplex y elevación máxima de 4.800 mm. Su batería de litio es de 24 V y 205 Ah. Esta unidad dispone de plataforma para el conductor y horquillas de 1.149 mm; el cargador MB es de 24 V y 100 A. Año de fabricación: 2026."
  },
  "M816-3394": {
      "source": {
          "url": "https://sales.mercaeleva.com/es/for-sale/machine/Caterpillar-EP25CN-M816-3394",
          "title": "Caterpillar EP25CN CARRETILLA ELEVADORA ELECTRICA 2500 KG",
          "brand": "Caterpillar",
          "model": "EP25CN",
          "year": "2015",
          "horometer": null,
          "condition": "Segunda mano",
          "shortDescription": null,
          "longDescription": "Ref. MER0861 CARRETILLA ELEVADORA ELECTRICA 2500 KG MASTIL TRIPLEX CATERPILLAR EP25CN ALTURA DE TRABAJO 4.750mm HORAS 4653 AÑO DE FABRICACION 2015",
          "specs": {
              "Marca": "Caterpillar",
              "Modelo": "EP25CN",
              "Título adicional": "CARRETILLA ELEVADORA ELECTRICA 2500 KG",
              "Año de fabricación": "2015",
              "Artículo No.": "MER0861",
              "Estado": "Usado",
              "Condición general": "Bueno",
              "Tipo de Batería": "Plomo-ácido",
              "Capacidad máxima de elevación": "2500 kg",
              "Tipo de mástil": "Triple",
              "Altura máxima de elevación": "4750 mm",
              "Tipo de cabina": "Guardia superior",
              "Número de ruedas": "4.0"
          }
      },
      "general": "La Caterpillar EP25CN es una carretilla elevadora eléctrica de segunda mano, fabricada en 2015, con capacidad máxima de 2.500 kg. La ficha técnica indica mástil tríplex, altura máxima de elevación de 4.750 mm y batería de plomo-ácido. Consta también protección superior de cabina y configuración de cuatro ruedas. Referencia comercial: MER0861."
  },
  "M722-8895": {
      "source": {
          "url": "https://sales.mercaeleva.com/es/for-sale/machine/OM-PIMESPO-XD40-M722-8895",
          "title": "OM PIMESPO - XD40 CARRETILLA ELEVADORA DIESEL 4000 KG",
          "brand": "OM",
          "model": "PIMESPO - XD40",
          "year": "2007",
          "horometer": null,
          "condition": "Segunda mano",
          "shortDescription": null,
          "longDescription": "Ref. MER0604 CARRETILLA ELEVADORA DIESEL 4000 KG OM PIMESPO XD40 Mástil TRÍPLEX ALTURA DE TRABAJO 5.400 mm AÑO DE FABRICACION 2007",
          "specs": {
              "Marca": "OM",
              "Modelo": "PIMESPO - XD40",
              "Título adicional": "CARRETILLA ELEVADORA DIESEL 4000 KG",
              "Año de fabricación": "2007",
              "Artículo No.": "MER0604",
              "Estado": "Usado",
              "Condición general": "Bueno",
              "Capacidad máxima de elevación": "4000 kg",
              "Altura máxima de elevación": "5400 mm",
              "Tipo de cabina": "Guardia superior",
              "Tipo de mástil": "TRÍPLEX"
          }
      },
      "general": "La OM Pimespo XD40 es una carretilla elevadora diésel de segunda mano, fabricada en 2007, con capacidad máxima de 4.000 kg. La ficha técnica especifica mástil tríplex, altura máxima de elevación de 5.400 mm y protección superior de cabina. El proveedor identifica esta unidad con la referencia MER0604."
  },
  "M017-2019": {
      "source": {
          "url": "https://sales.mercaeleva.com/es/for-sale/machine/Linde-E16P-02-M017-2019",
          "title": "Linde E16P-02 CARRETILLA ELEVADORA ELECTRICA 1600 KG",
          "brand": "Linde",
          "model": "E16P-02",
          "year": "2006",
          "horometer": "16 939",
          "condition": "Segunda mano",
          "shortDescription": null,
          "longDescription": "Ref. MER0685 CARRETILLA ELEVADORA ELECTRICA 1600 KG LINDE E16P-02 HORAS 16939 AÑO DE FABRICACION 2006",
          "specs": {
              "Marca": "Linde",
              "Modelo": "E16P-02",
              "Título adicional": "CARRETILLA ELEVADORA ELECTRICA 1600 KG",
              "Año de fabricación": "2006",
              "Artículo No.": "MER0685",
              "Horas laborales": "16 939 h",
              "Estado": "Usado",
              "Condición general": "Bueno",
              "Tipo de Batería": "Plomo-ácido",
              "Capacidad máxima de elevación": "1600 kg",
              "Tipo de cabina": "Guardia superior",
              "Número de ruedas": "4.0"
          }
      },
      "general": "La Linde E16P-02 es una carretilla elevadora eléctrica de segunda mano, fabricada en 2006, con capacidad máxima de 1.600 kg. La ficha individual identifica una batería de plomo-ácido, cuatro ruedas y cabina con protección superior. El vendedor registra 16.939 horas y la referencia MER0685."
  },
  "M940-4770": {
      "source": {
          "url": "https://sales.mercaeleva.com/es/for-sale/machine/Linde-E20PL-M940-4770",
          "title": "Linde E20PL CARRETILLA ELEVADORA ELECTRICA 2000 KG",
          "brand": "Linde",
          "model": "E20PL",
          "year": "2012",
          "horometer": "19 617",
          "condition": "Segunda mano",
          "shortDescription": null,
          "longDescription": "Ref. MER0676 CARRETILLA ELEVADORA ELECTRICA 2000 KG LINDE E20PL HORAS 19617 AÑO DE FABRICACION 2012",
          "specs": {
              "Marca": "Linde",
              "Modelo": "E20PL",
              "Título adicional": "CARRETILLA ELEVADORA ELECTRICA 2000 KG",
              "Año de fabricación": "2012",
              "Artículo No.": "MER0676",
              "Horas laborales": "19 617 h",
              "Estado": "Usado",
              "Condición general": "Bueno",
              "Tipo de Batería": "Plomo-ácido",
              "Capacidad máxima de elevación": "2000 kg",
              "Tipo de cabina": "Guardia superior",
              "Número de ruedas": "4.0"
          }
      },
      "general": "La Linde E20PL es una carretilla elevadora eléctrica de segunda mano, fabricada en 2012, con capacidad máxima de 2.000 kg. Según la ficha de esta unidad, utiliza batería de plomo-ácido y dispone de cuatro ruedas y protección superior de cabina. El proveedor registra 19.617 horas de uso y la referencia MER0676."
  },
  "M818-7811": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Linde-E25-600-336-M818-7811",
      "title": "Linde E25/600-336 CARRETILLA ELEVADORA ELECTRICA 2500 KG",
      "brand": "Linde",
      "model": "E25/600-336",
      "year": "2008",
      "horometer": "3404",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. MER0670 CARRETILLA ELEVADORA ELECTRICA 2500 KG DUPLEX TRIPLEX LINDE E25/600-336 ALTURA DE TRABAJO 4.300mm HORAS 3404 AÑO DE FABRICACION 2008",
      "specs": {
        "Marca": "Linde",
        "Modelo": "E25/600-336",
        "Título adicional": "CARRETILLA ELEVADORA ELECTRICA 2500 KG",
        "Año de fabricación": "2008",
        "Artículo No.": "MER0670",
        "Horas laborales": "3404 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de Batería": "Plomo-ácido",
        "Capacidad máxima de elevación": "2500 kg",
        "Tipo de mástil": "Dúplex/estándar",
        "Altura máxima de elevación": "4300 mm",
        "Tipo de cabina": "Guardia superior",
        "Número de ruedas": "4.0"
      }
    },
    "general": "La Linde E25/600-336 es una carretilla elevadora eléctrica de ocasión de 2.500 kg, fabricada en 2008, con elevación declarada de 4.300 mm. Su ficha individual registra batería de plomo-ácido, cuatro ruedas y protección superior de cabina. En el mástil existe una discordancia: el campo técnico indica dúplex y el texto comercial menciona dúplex y tríplex, por lo que no se confirma una versión más allá de la ficha estructurada. Registra 3.404 horas y referencia MER0670."
  },
  "M640-1938": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Ausa-C250HX4-M640-1938",
      "title": "Ausa C250HX4 CARRETILLA 4x4 2500KG",
      "brand": "Ausa",
      "model": "C250HX4",
      "year": "2017",
      "horometer": "5406",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. 501 CARRETILLA 4x4 2500KG AUSA C250HX4 MASTIL TRIPLEX ALTURA DE TRABAJO 4.30mm HORAS 5406 AÑO DE FABRICACION 2017",
      "specs": {
        "Marca": "Ausa",
        "Modelo": "C250HX4",
        "Título adicional": "CARRETILLA 4x4 2500KG",
        "Año de fabricación": "2017",
        "Artículo No.": "501",
        "Certificación CE": "Yes",
        "Horas laborales": "5406 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Capacidad máxima de elevación": "2500 kg",
        "Tipo de mástil": "Triple",
        "Altura máxima de elevación": "4300 mm"
      }
    },
    "general": "La Ausa C250HX4 es una carretilla todoterreno 4×4 usada de 2.500 kg, fabricada en 2017. Su ficha técnica individual indica mástil tríplex y altura máxima de elevación de 4.300 mm; el texto comercial abrevia esa altura de forma imprecisa como «4.30mm». El proveedor declara certificación CE y 5.406 horas de funcionamiento para la unidad identificada con la referencia 501."
  },
  "M855-6850": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Ausa-C250HX4-M855-6850",
      "title": "Ausa C250HX4 CARRETILLA 4x4 2500KG",
      "brand": "Ausa",
      "model": "C250HX4",
      "year": "2017",
      "horometer": "4257",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. 504 CARRETILLA 4x4 2500KG AUSA C250HX4 MASTIL TRIPLEX ALTURA DE TRABAJO 4.30mm HORAS 4257 AÑO DE FABRICACION 2017",
      "specs": {
        "Marca": "Ausa",
        "Modelo": "C250HX4",
        "Título adicional": "CARRETILLA 4x4 2500KG",
        "Año de fabricación": "2017",
        "Artículo No.": "504",
        "Certificación CE": "Yes",
        "Horas laborales": "4257 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Capacidad máxima de elevación": "2500 kg",
        "Tipo de mástil": "Triple",
        "Altura máxima de elevación": "4300 mm"
      }
    },
    "general": "La carretilla todoterreno 4×4 Ausa C250HX4 de ocasión tiene 2.500 kg de capacidad y año de fabricación 2017. La ficha técnica publica mástil tríplex y altura máxima de elevación de 4.300 mm, aclarando la mención abreviada «4.30mm» del anuncio. El proveedor señala certificación CE y 4.257 horas de uso para esta unidad, identificada mediante la referencia 504."
  },
  "M011-3720": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/BT-LPE200-8-M011-3720",
      "title": "BT LPE200/8 TRANSPALET ELECTRICO",
      "brand": "BT",
      "model": "LPE200/8",
      "year": "2012",
      "horometer": "2261",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. MER0825 TRANSPALET ELECTRICO CAPACIDAD 2000 KG BT LPE200/8",
      "specs": {
        "Marca": "BT",
        "Modelo": "LPE200/8",
        "Título adicional": "TRANSPALET ELECTRICO",
        "Año de fabricación": "2012",
        "Artículo No.": "MER0525",
        "Horas laborales": "2261 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Capacidad de carga": "2000 kg"
      }
    },
    "general": "La BT LPE200/8 es una transpaleta eléctrica de segunda mano con capacidad declarada de 2.000 kg, año 2012 y 2.261 horas según la ficha estructurada. La referencia MER0825 aparece en el texto comercial, mientras el campo técnico «Artículo No.» indica MER0525; no se acredita que ambas referencias pertenezcan a la misma máquina."
  },
  "M018-7013": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/JLG-1250AJP-M018-7013",
      "title": "JLG 1250AJP PLATAFORMA ARTICULADA DIESEL 40 MT",
      "brand": "JLG",
      "model": "1250AJP",
      "year": "2008",
      "horometer": "7368",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref.2111 PLATAFORMA ARTICULADA DIESEL ALTURA DE TRABAJO 40 MT JLG 1250AJP HORAS 7386 AÑO DE FABRICACION 2008",
      "specs": {
        "Marca": "JLG",
        "Modelo": "1250AJP",
        "Título adicional": "PLATAFORMA ARTICULADA DIESEL 40 MT",
        "Año de fabricación": "2008",
        "Artículo No.": "2111",
        "Horas laborales": "7368 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de motor": "Diesel",
        "Altura de trabajo": "40 m"
      }
    },
    "general": "La JLG 1250AJP es una plataforma articulada diésel de ocasión, con 40 m de altura de trabajo y año declarado 2008. El anuncio indica 7.386 horas, pero la ficha estructurada registra 7.368 h. Ambas lecturas corresponden a fuentes discordantes de esta misma ficha y no se presenta una como confirmada. Referencia del vendedor: 2111."
  },
  "M106-1389": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Manitou-170AETJL-M106-1389",
      "title": "Manitou 170AETJL PLATAFORMA ARTICULADA ELECTRICA 17 MT",
      "brand": "Manitou",
      "model": "170AETJL",
      "year": "2015",
      "horometer": "294",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. 686 PLATAFORMA ARTICULADA ELECTRICA ALTURA DE TRABAJO 17 MT MANITOU 170AETJL HORAS 294 AÑO DE FABRICACION 2015",
      "specs": {
        "Marca": "Manitou",
        "Modelo": "170AETJL",
        "Título adicional": "PLATAFORMA ARTICULADA ELECTRICA 17 MT",
        "Año de fabricación": "2015",
        "Artículo No.": "689",
        "Horas laborales": "294 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de motor": "Eléctrico",
        "Altura de trabajo": "17 m"
      }
    },
    "general": "La Manitou 170AETJL es una plataforma articulada eléctrica de ocasión, fabricada en 2015, con altura de trabajo de 17 m y 294 horas registradas. El anuncio la identifica como «Ref. 686», mientras que el campo técnico «Artículo No.» consigna 689; la referencia comercial queda pendiente de contraste."
  },
  "M342-3553": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Skyjack-SJ6832RT-M342-3553",
      "title": "Skyjack SJ6832RT PLATAFORMA TIJERA DIESEL 12 MT",
      "brand": "Skyjack",
      "model": "SJ6832RT",
      "year": "2014",
      "horometer": "2276",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. 694 PLATAFORMA TIJERA DIESEL ALTURA DE TRABAJO 12 MT SKYJACK SJ6832RT HORAS 2278 AÑO DE FABRICACION 2014",
      "specs": {
        "Marca": "Skyjack",
        "Modelo": "SJ6832RT",
        "Título adicional": "PLATAFORMA TIJERA DIESEL 12 MT",
        "Año de fabricación": "2014",
        "Artículo No.": "694",
        "Horas laborales": "2276 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de motor": "Diesel",
        "Altura de trabajo": "12 m"
      }
    },
    "general": "La Skyjack SJ6832RT es una plataforma de tijera diésel usada de 12 m, fabricada en 2014. El texto del vendedor declara 2.278 horas, frente a 2.276 h en el campo técnico «Horas laborales». Las dos lecturas son contradictorias, por lo que ninguna se declara definitiva. Referencia: 694."
  },
  "M567-8260": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Genie-GS2646-M567-8260",
      "title": "Genie GS2646 PLATAFORMA TIJERA ELECTRICA 10 MT",
      "brand": "Genie",
      "model": "GS2646",
      "year": "2011",
      "horometer": "747",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. 216 PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 10 MT GENIE GS2646 HORAS 722 AÑO DE FABRICACION 2011",
      "specs": {
        "Marca": "Genie",
        "Modelo": "GS2646",
        "Título adicional": "PLATAFORMA TIJERA ELECTRICA 10 MT",
        "Año de fabricación": "2011",
        "Artículo No.": "216",
        "Horas laborales": "747 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de motor": "Eléctrico",
        "Altura de trabajo": "10 m"
      }
    },
    "general": "La Genie GS2646 es una plataforma de tijera eléctrica usada con altura de trabajo declarada de 10 m y año 2011. El anuncio publica 722 horas, mientras la ficha estructurada consigna 747 h. La discrepancia impide acreditar una única lectura del horómetro. Referencia: 216."
  },
  "M620-2142": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Haulotte-HA16RTJ-M620-2142",
      "title": "Haulotte HA16RTJ PLATAFORMA ARTICULADA DIESEL 16 MT",
      "brand": "Haulotte",
      "model": "HA16RTJ",
      "year": "2018",
      "horometer": "3190",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. 608 PLATAFORMA ARTICULADA DIESEL ALTURA DE TRABAJO 16 MT HAULOTTE HA16RTJ HORAS: 3185 AÑO DE FABRICACION 2018",
      "specs": {
        "Marca": "Haulotte",
        "Modelo": "HA16RTJ",
        "Título adicional": "PLATAFORMA ARTICULADA DIESEL 16 MT",
        "Año de fabricación": "2018",
        "Artículo No.": "608",
        "Horas laborales": "3190 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de motor": "Diesel",
        "Altura de trabajo": "16 m"
      }
    },
    "general": "La Haulotte HA16RTJ es una plataforma articulada diésel de segunda mano de 16 m de altura de trabajo, fabricada en 2018. El texto comercial indica 3.185 horas y la ficha técnica 3.190 h, una diferencia que debe contrastarse antes de fijar el horómetro. Referencia: 608."
  },
  "M725-7107": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/JLG-460SJ-M725-7107",
      "title": "JLG 460SJ PLATAFORMA TELESCOPICA DIESEL 16 MT",
      "brand": "JLG",
      "model": "460SJ",
      "year": "2007",
      "horometer": "2007",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. 243 PLATAFORMA TELESCOPICA DIESEL ALTURA DE TRABAJO 16 MT JLG 460SJ HORAS 5007 AÑO DE FABRICACION 2007",
      "specs": {
        "Marca": "JLG",
        "Modelo": "460SJ",
        "Título adicional": "PLATAFORMA TELESCOPICA DIESEL 16 MT",
        "Año de fabricación": "2007",
        "Artículo No.": "243",
        "Horas laborales": "2007 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de motor": "Diesel",
        "Altura de trabajo": "16 m"
      }
    },
    "general": "La JLG 460SJ es una plataforma telescópica diésel de ocasión, con altura de trabajo publicada de 16 m y año 2007. El anuncio registra 5.007 horas, pero el campo «Horas laborales» indica 2.007 h: las lecturas no concuerdan y no se confirma ninguna como definitiva. Referencia: 243."
  },
  "M840-8278": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/JLG-1930ES-M840-8278",
      "title": "JLG 1930ES PLATAFORMA DE TIJERA ELECTRICA",
      "brand": "JLG",
      "model": "1930ES",
      "year": "2006",
      "horometer": "627",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. 263 PLATAFORMA TIJERA ELÉCTRICA ALTURA DE TRABAJO 8 MT JLG 1930ES HORAS 623 AÑO DE FABRICACION 2006",
      "specs": {
        "Marca": "JLG",
        "Modelo": "1930ES",
        "Título adicional": "PLATAFORMA DE TIJERA ELECTRICA",
        "Año de fabricación": "2006",
        "Artículo No.": "263",
        "Horas laborales": "627 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de motor": "Eléctrico",
        "Altura de trabajo": "8 m"
      }
    },
    "general": "La JLG 1930ES es una plataforma de tijera eléctrica usada, año 2006 y altura de trabajo indicada de 8 m. El texto del vendedor señala 623 horas, mientras la ficha estructurada declara 627 h. Se mantiene explícita esa discordancia sin atribuir una lectura verificada. Referencia: 263."
  },
  "M121-6486": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Nissan-Q02L20CU-M121-6486",
      "title": "Nissan Q02L20CU CARRETILLA ELEVADORA ELECTRICA 2000 KG",
      "brand": "Nissan",
      "model": "Q02L20CU",
      "year": "2006",
      "horometer": "16 169",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. MER0561 CARRETILLA ELEVADORA ELECTRICA 2000 KG TRIPLEX TRIPLEX NISSAN Q02L20CU ALTURA DE TRABAJO 6.000mm HORAS 13760 AÑO DE FABRICACION 2006",
      "specs": {
        "Marca": "Nissan",
        "Modelo": "Q02L20CU",
        "Título adicional": "CARRETILLA ELEVADORA ELECTRICA 2000 KG",
        "Año de fabricación": "2006",
        "Artículo No.": "MER0561",
        "Horas laborales": "16 169 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de Batería": "Plomo-ácido",
        "Capacidad máxima de elevación": "2000 kg",
        "Tipo de mástil": "Triple",
        "Altura máxima de elevación": "6000 mm",
        "Tipo de cabina": "Guardia superior",
        "Número de ruedas": "4.0"
      }
    },
    "general": "La Nissan Q02L20CU es una carretilla elevadora eléctrica usada de 2.000 kg con mástil tríplex y altura de elevación publicada de 6.000 mm. El anuncio consigna 13.760 horas, pero el campo técnico «Horas laborales» registra 16.169 h. La lectura del horómetro requiere contraste documental; ninguna se presenta como confirmada. Año 2006, batería de plomo-ácido y referencia MER0561."
  },
  "M988-6161": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Haulotte-HA12IP-M988-6161",
      "title": "Haulotte HA12IP PLATAFORMA ARTICULADA ELECTRICA 12 MT",
      "brand": "Haulotte",
      "model": "HA12IP",
      "year": "2018",
      "horometer": "416",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. 605 PLATAFORMA ARTICULADA ELECTRICA ALTURA DE TRABAJO 12 MT HAULOTTE HA12IP HORAS 415 AÑO DE FABRICACION 2018",
      "specs": {
        "Marca": "Haulotte",
        "Modelo": "HA12IP",
        "Título adicional": "PLATAFORMA ARTICULADA ELECTRICA 12 MT",
        "Año de fabricación": "2018",
        "Artículo No.": "605",
        "Horas laborales": "416 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de motor": "Eléctrico",
        "Altura de trabajo": "12 m"
      }
    },
    "general": "La Haulotte HA12IP es una plataforma articulada eléctrica usada de 12 m de altura de trabajo, fabricada en 2018. La descripción comercial consigna 415 horas y el campo técnico «Horas laborales», 416 h. Existe discrepancia de horómetro no resuelta. Referencia del vendedor: 605."
  },
  "M209-3306": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/JLG-660SJ-M209-3306",
      "title": "JLG 660SJ PLATAFORMA TELESCOPICA DIESEL 22 MT",
      "brand": "JLG",
      "model": "660SJ",
      "year": "2015",
      "horometer": "3457",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. 1838 PLATAFORMA TELESCOPICA DIESEL ALTURA DE TRABAJO 22 MT JLG 660SJ HORAS 875 AÑO DE DABRICACION 2015 PINTADA + RUEDAS NUEVAS !!",
      "specs": {
        "Marca": "JLG",
        "Modelo": "660SJ",
        "Título adicional": "PLATAFORMA TELESCOPICA DIESEL 22 MT",
        "Año de fabricación": "2015",
        "Artículo No.": "1838",
        "Horas laborales": "3457 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de motor": "Diesel",
        "Altura de trabajo": "22 m"
      }
    },
    "general": "La JLG 660SJ es una plataforma telescópica diésel de ocasión con 22 m de altura de trabajo y año 2015. El texto del vendedor indica 875 horas, frente a 3.457 h en el campo técnico: las lecturas son incompatibles y ninguna se considera verificada. El anuncio indica repintado y ruedas nuevas. Referencia: 1838."
  },
  "M005-5167": {
    "source": {
      "url": "https://sales.mercaeleva.com/es/for-sale/machine/Manitou-MT1440-SLT-M005-5167",
      "title": "Manitou MT1440 SLT MANIPULADOR TELESCOPICO 14 MT",
      "brand": "Manitou",
      "model": "MT1440 SLT",
      "year": "2012",
      "horometer": "6813",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Ref. 468 MANIPULADOR TELESCOPICO ALTURA DE TRABAJO 14 MT MANITOU MT 1440 SLT 3E2 HORAS 6964 AÑO DE FABRICACION 2012",
      "specs": {
        "Marca": "Manitou",
        "Modelo": "MT1440 SLT",
        "Título adicional": "MANIPULADOR TELESCOPICO 14 MT",
        "Año de fabricación": "2012",
        "Artículo No.": "468",
        "Horas laborales": "6813 h",
        "Estado": "Usado",
        "Condición general": "Bueno",
        "Tipo de motor": "Diesel",
        "Capacidad máxima de elevación": "4000 kg",
        "Altura máxima de elevación": "14 m"
      }
    },
    "general": "El Manitou MT1440 SLT es un manipulador telescópico diésel de ocasión, fabricado en 2012, con capacidad declarada de 4.000 kg y altura máxima de elevación de 14 m. El anuncio registra 6.964 horas y la ficha estructurada, 6.813 h. No se fija una lectura definitiva por esa contradicción. Referencia del vendedor: 468."
  },
} as const satisfies Readonly<Record<string, VerifiedUnitGeneralEvidence>>;

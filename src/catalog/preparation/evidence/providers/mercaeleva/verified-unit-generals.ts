import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { validMercaelevaTechnicalSource } from "../../../mapping/providers/mercaeleva/technical.js";

type Evidence = Readonly<{
  source: Readonly<Pick<ProductRecord,
    "url" | "title" | "brand" | "model" | "year" | "horometer" | "condition" | "shortDescription" | "longDescription">> &
    { readonly specs: SpecsMap };
  general: string;
}>;

const evidence = {
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
  }
} as const satisfies Readonly<Record<string, Evidence>>;

const entries: ReadonlyMap<string, Evidence> = new Map(Object.entries(evidence));

const sameSpecs = (actual: SpecsMap | undefined, expected: SpecsMap): boolean => {
  if (!actual) return false;
  const names = Object.keys(expected);
  return Object.keys(actual).length === names.length && names.every((name) => actual[name] === expected[name]);
};

export const verifiedMercaelevaUnitGeneral = (record: ProductRecord): string | null => {
  if (!validMercaelevaTechnicalSource(record) || record.categoryKey !== "venta" ||
    record.condition !== "Segunda mano" || !record.reference) return null;
  const entry = entries.get(record.reference);
  if (!entry) return null;
  const source = entry.source;
  if (record.url !== source.url || record.title !== source.title ||
    record.brand !== source.brand || record.model !== source.model ||
    record.year !== source.year || record.horometer !== source.horometer ||
    record.condition !== source.condition ||
    record.shortDescription !== source.shortDescription ||
    record.longDescription !== source.longDescription ||
    !sameSpecs(record.specs, source.specs)) return null;
  return entry.general;
};

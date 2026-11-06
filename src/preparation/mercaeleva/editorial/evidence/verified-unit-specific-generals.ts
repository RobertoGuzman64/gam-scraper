import type { ProductRecord } from "../../../../contracts/catalog.js";
import { validMercaelevaTechnicalSource } from "../../technical/mapping/technical.js";

const evidence = {
  "M318-0509": {
    "url": "https://sales.mercaeleva.com/es/for-sale/machine/LGMG-S1012E-2-M318-0509",
    "title": "LGMG S1012E-2 NUEVA!!! PLATAFORMA TIJERA ELECTRICA 12 MT",
    "brand": "LGMG",
    "model": "S1012E-2",
    "year": "2026",
    "horometer": null,
    "condition": "Nuevo",
    "longDescription": "NUEVA!! PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 12 MT LGMG S1012E-2 AÑO DE FABRICACION 2026",
    "shortDescription": null,
    "specs": {
      "Marca": "LGMG",
      "Modelo": "S1012E-2",
      "Año de fabricación": "2026",
      "Certificación CE": "Yes",
      "Estado": "Nuevo",
      "Tipo de motor": "Eléctrico",
      "Altura de trabajo": "12 m"
    },
    "description": "La LGMG S1012E-2 es una plataforma de tijera eléctrica anunciada como nueva. La ficha indica una altura de trabajo de 12 m y año de fabricación 2026. La motorización publicada es eléctrica y el anuncio incluye certificación CE."
  },
  "M294-4678": {
    "url": "https://sales.mercaeleva.com/es/for-sale/machine/M294-4678",
    "title": "MODULO CASETA DIAFANA CON AIRE 6m x 2,35m",
    "brand": null,
    "model": null,
    "year": null,
    "horometer": null,
    "condition": null,
    "longDescription": "MODULO CASETA DIAFANA CON AIRE 6m x 2,35m PUERTA EN LATERAL (LADO CORTO) CBOX - CASETA6",
    "shortDescription": null,
    "specs": {
      "Título adicional": "MODULO CASETA DIAFANA CON AIRE 6m x 2,35m"
    },
    "description": "Módulo de caseta diáfana con aire acondicionado, de 6 × 2,35 m según el anuncio. El vendedor indica que la puerta de acceso está situada en un lateral corto del módulo. La denominación de origen es CBOX - CASETA6."
  },
  "M315-5925": {
    "url": "https://sales.mercaeleva.com/es/for-sale/machine/JLG-153-12-M315-5925",
    "title": "JLG 153-12 PLATAFORMA TIJERA ELECTRICA 17 MT",
    "brand": "JLG",
    "model": "153-12",
    "year": "2006",
    "horometer": "1347",
    "condition": "Segunda mano",
    "longDescription": "Ref. 228 PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 17 MT JLG 153-12 AÑO DE FABRICACION 2006",
    "shortDescription": null,
    "specs": {
      "Marca": "JLG",
      "Modelo": "153-12",
      "Título adicional": "PLATAFORMA TIJERA ELECTRICA 17 MT",
      "Año de fabricación": "2006",
      "Artículo No.": "228",
      "Horas laborales": "1347 h",
      "Estado": "Usado",
      "Condición general": "Bueno",
      "Tipo de motor": "Eléctrico",
      "Altura de trabajo": "17 m"
    },
    "description": "La JLG 153-12 es una plataforma elevadora de tijera eléctrica de segunda mano. La ficha declara 17 m de altura de trabajo, año de fabricación 2006 y 1.347 horas registradas. El vendedor identifica esta unidad con la referencia 228."
  },
  "M310-8756": {
    "url": "https://sales.mercaeleva.com/es/for-sale/machine/Manitou-170AETJL-M310-8756",
    "title": "Manitou 170AETJL PLATAFORMA ARTICULADA ELECTRICA 17 MT",
    "brand": "Manitou",
    "model": "170AETJL",
    "year": "2016",
    "horometer": null,
    "condition": "Segunda mano",
    "longDescription": "Ref. 1795 PLATAFORMA ARTICULADA ELECTRICA ALTURA DE TRABAJO 17 MT MANITOU 170AETJL AÑO DE FABRICACION 2016 PINTADA",
    "shortDescription": null,
    "specs": {
      "Marca": "Manitou",
      "Modelo": "170AETJL",
      "Título adicional": "PLATAFORMA ARTICULADA ELECTRICA 17 MT",
      "Año de fabricación": "2016",
      "Artículo No.": "1795",
      "Estado": "Usado",
      "Condición general": "Bueno",
      "Tipo de motor": "Eléctrico",
      "Altura de trabajo": "17 m"
    },
    "description": "La Manitou 170AETJL es una plataforma articulada eléctrica de segunda mano. El anuncio indica 17 m de altura de trabajo y año de fabricación 2016. El vendedor identifica la unidad mediante la referencia 1795 y declara que está pintada."
  },
  "M159-0669": {
    "url": "https://sales.mercaeleva.com/es/for-sale/machine/LGMG-S0808EII-M159-0669",
    "title": "LGMG S0808EII PLATAFORMA TIJERA ELECTRICA 10 MT",
    "brand": "LGMG",
    "model": "S0808EII",
    "year": "2024",
    "horometer": null,
    "condition": "Nuevo",
    "longDescription": "Ref. S0808EII PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 10 MT LGMG S0808EII HORAS 0 AÑO DE FABRICACION 2024",
    "shortDescription": null,
    "specs": {
      "Marca": "LGMG",
      "Modelo": "S0808EII",
      "Título adicional": "PLATAFORMA TIJERA ELECTRICA 10 MT",
      "Año de fabricación": "2024",
      "Artículo No.": "S0808EII",
      "Estado": "Nuevo",
      "Tipo de motor": "Eléctrico",
      "Altura de trabajo": "10 m"
    },
    "description": "La LGMG S0808EII es una plataforma de tijera eléctrica anunciada como nueva, con altura de trabajo de 10 m y año de fabricación 2024. La referencia comercial publicada por el vendedor es S0808EII. El texto original también anuncia cero horas, sin indicar un horómetro estructurado."
  },
  "M476-1722": {
    "url": "https://sales.mercaeleva.com/es/for-sale/machine/Caterpillar-EP16NT-M476-1722",
    "title": "Caterpillar EP16NT CARRETILLA ELEVADORA ELECTRICA 1600 KG",
    "brand": "Caterpillar",
    "model": "EP16NT",
    "year": "2007",
    "horometer": null,
    "condition": "Segunda mano",
    "longDescription": "Ref. MER0742 CARRETILLA ELEVADORA ELECTRICA 1600 KG TRIPLEX TRIPLEX CATERPILLAR EP16NT ALTURA DE TRABAJO 4.750mm AÑO DE FABRICACION 2007",
    "shortDescription": null,
    "specs": {
      "Marca": "Caterpillar",
      "Modelo": "EP16NT",
      "Título adicional": "CARRETILLA ELEVADORA ELECTRICA 1600 KG",
      "Año de fabricación": "2007",
      "Artículo No.": "MER0742",
      "Estado": "Usado",
      "Condición general": "Bueno",
      "Tipo de Batería": "Plomo-ácido",
      "Capacidad máxima de elevación": "1600 kg",
      "Tipo de mástil": "Triple",
      "Altura máxima de elevación": "4750 mm",
      "Tipo de cabina": "Guardia superior",
      "Número de ruedas": "3.0"
    },
    "description": "La Caterpillar EP16NT es una carretilla elevadora eléctrica de segunda mano con capacidad declarada de 1.600 kg y mástil tríplex. La ficha técnica indica 4.750 mm de altura máxima de elevación, batería de plomo-ácido y año de fabricación 2007. La referencia del vendedor es MER0742."
  },
  "M805-9451": {
    "url": "https://sales.mercaeleva.com/es/for-sale/machine/Genie-S-65-M805-9451",
    "title": "Genie S-65 PLATAFORMA TELESCOPICA DIESEL 22 MT",
    "brand": "Genie",
    "model": "S-65",
    "year": "2011",
    "horometer": "421",
    "condition": "Segunda mano",
    "longDescription": "Ref. 534 PLATAFORMA TELESCOPICA DIESEL ALTURA DE TRABAJO 22 MT GENIE S-65 HORAS 421 AÑO DE DABRICACION 2011",
    "shortDescription": null,
    "specs": {
      "Marca": "Genie",
      "Modelo": "S-65",
      "Título adicional": "PLATAFORMA TELESCOPICA DIESEL 22 MT",
      "Año de fabricación": "2011",
      "Artículo No.": "534",
      "Horas laborales": "421 h",
      "Estado": "Usado",
      "Condición general": "Bueno",
      "Tipo de motor": "Diesel",
      "Altura de trabajo": "22 m"
    },
    "description": "La Genie S-65 es una plataforma telescópica diésel de segunda mano. La ficha indica 22 m de altura de trabajo, año de fabricación 2011 y 421 horas registradas. El anuncio identifica esta unidad mediante la referencia comercial 534."
  },
  "M131-5855": {
    "url": "https://sales.mercaeleva.com/es/for-sale/machine/Haulotte-Optimum-8-M131-5855",
    "title": "Haulotte Optimum 8 PLATAFORMA TIJERA ELECTRICA 8 MT",
    "brand": "Haulotte",
    "model": "Optimum 8",
    "year": "2018",
    "horometer": "464",
    "condition": "Segunda mano",
    "longDescription": "Ref. 623 PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 8 MT HAULOTTE OPTIMUM 8 AC HORAS 464 AÑO DE FABRICACION 2018",
    "shortDescription": null,
    "specs": {
      "Marca": "Haulotte",
      "Modelo": "Optimum 8",
      "Título adicional": "PLATAFORMA TIJERA ELECTRICA 8 MT",
      "Año de fabricación": "2018",
      "Artículo No.": "623",
      "Horas laborales": "464 h",
      "Estado": "Usado",
      "Condición general": "Bueno",
      "Tipo de motor": "Eléctrico",
      "Altura de trabajo": "8 m"
    },
    "description": "La Haulotte Optimum 8 es una plataforma de tijera eléctrica de segunda mano. Según el anuncio, dispone de 8 m de altura de trabajo y corresponde al año 2018. La unidad registra 464 horas y tiene la referencia comercial 623. El texto de origen identifica la variante Optimum 8 AC."
  }
} as const;

export const verifiedMercaelevaUnitSpecificGeneral = (record: ProductRecord): string | null => {
  if (!validMercaelevaTechnicalSource(record) || record.categoryKey !== "venta" || !record.reference) return null;
  const item = Object.entries(evidence).find(([reference]) => reference === record.reference)?.[1];
  if (!item || record.url !== item.url || record.title !== item.title ||
    record.brand !== item.brand || record.model !== item.model ||
    record.year !== item.year || record.horometer !== item.horometer ||
    record.condition !== item.condition || record.shortDescription !== item.shortDescription ||
    record.longDescription !== item.longDescription ||
    Object.keys(record.specs ?? {}).length !== Object.keys(item.specs).length) return null;
  for (const [key, value] of Object.entries(item.specs)) {
    if (record.specs?.[key] !== value) return null;
  }
  return item.description;
};

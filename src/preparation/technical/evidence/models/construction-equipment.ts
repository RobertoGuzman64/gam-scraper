import type { ReviewedModelDocument } from "./types.js";

export const constructionEquipmentDocuments: readonly ReviewedModelDocument[] = [
  {
    url: "https://www.grupomaenar.com/imagenes/pdf/564976673-Manual%20Pison%20Husqvarna.pdf", brand: "HUSQVARNA", model: "LT 6005", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "compactadora", firstYear: 2021, lastYear: 2021, verifiedStructuredIdentity: true,
      sourceAnchors: { Marca: "HUSQVARNA", Modelo: "LT 6005", "Ancho bandeja": "230 mm", Motor: "Gasolina" },
      conflictingEvidence: /\b(?:frecuencia|amplitud|modificad[oa]|sustituid[oa]|convertid[oa])\b/u },
      fields: ["Frecuencia de vibración del modelo", "Amplitud nominal de vibración"] }, facts: [
      { field: "Frecuencia de vibración del modelo", value: "11,9 Hz", support: "Manual Husqvarna LT 5005 / LT 6005, 957-002, 14/10/2019, p. 17, Technical data: LT 6005, 230 mm, 11,9 Hz; corroborado por manual con declaración CE 18/08/2021 (https://manuals.plus/m/5cd75efc04f842b82e1c7847b28df6409e883b8144e3eea357c0e857f76f33d8), Technical Data. Parámetro nominal, no exposición del operario." },
      { field: "Amplitud nominal de vibración", value: "67,7 mm", support: "Mismas tablas LT 6005, amplitud 67,7 mm en ambas anchuras de pisón. No se modifica potencia ni peso declarados." }
    ]
  },
  {
    url: "https://beavervalleysupply.com/wp-content/uploads/2022/09/Epiroc-SB-Rock-Concrete-Breaker-Brochure.pdf", brand: "EPIROC", model: "SB 202", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "martillo-miniexcavadora", firstYear: 2022, lastYear: 2022, verifiedStructuredIdentity: true,
      sourceAnchors: { Marca: "EPIROC", Modelo: "SB 202", Peso: "200 kg" },
      conflictingEvidence: /\b(?:presion|diametro|caudal|modificad[oa]|sustituid[oa]|convertid[oa])\b/u },
      fields: ["Presión de aceite de trabajo del modelo", "Diámetro nominal de herramienta compatible", "Caudal de aceite del modelo"] }, facts: [
      { field: "Presión de aceite de trabajo del modelo", value: "100–150 bar", support: "Epiroc SB range, tabla de especificaciones SB 202, Operating pressure: 100–150 bar; valor de diseño del implemento, no presión medida de la unidad." },
      { field: "Diámetro nominal de herramienta compatible", value: "65 mm", support: "Misma tabla SB 202, Tool diameter 65 mm; no acredita herramienta instalada." },
      { field: "Caudal de aceite del modelo", value: "35–65 l/min", support: "Misma tabla SB 202, Oil flow rate 35–65 l/min; requisito nominal del implemento, no caudal medido de la portadora." }
    ]
  },
  {
    url: "https://www.ubaristi.com/media/documents/product/pdf/kubota-km-breakers-es_1.pdf", brand: "KUBOTA", model: "KM 55", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "martillo-miniexcavadora", firstYear: 2016, lastYear: 2021, verifiedStructuredIdentity: true,
      sourceAnchors: { Marca: "KUBOTA", Modelo: "KM 55" },
      conflictingEvidence: /\b(?:presion|diametro|modificad[oa]|sustituid[oa]|convertid[oa])\b/u },
      fields: ["Presión de aceite de trabajo del modelo", "Diámetro nominal de herramienta compatible"] },
    facts: [
      { field: "Presión de aceite de trabajo del modelo", value: "100–150 bar", support: "Kubota Hydraulic breaker ES 2024-07-11, p. 7, Datos técnicos, KM 55, presión de aceite; coincide con el catálogo general Kubota de 2017, p. 5 (https://loewener.dk/wp-content/uploads/2017/02/Kubota-2017-01-05-Doc-Generale-2017-pages-A4.pdf) y la ficha KM de 2015 (https://sab-daruvar.squarespace.com/s/KM-hidraulic-breakers-2015.pdf). Rango de diseño, no presión medida de unidad ni de portadora." },
      { field: "Diámetro nominal de herramienta compatible", value: "40 mm", support: "Mismas tablas KM 55, diámetro de herramienta; coincide con la gama KM de Kubota (https://kuk.kubota-eu.com/constructionmachinery/products/km-series/). No acredita herramienta instalada, peso de servicio ni caudal." }
    ]
  },
  {
    url: "https://www.ubaristi.com/media/documents/product/pdf/kubota-km-breakers-es_1.pdf", brand: "KUBOTA", model: "KM 105", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "martillo-miniexcavadora", firstYear: 2016, lastYear: 2021, verifiedStructuredIdentity: true,
      sourceAnchors: { Marca: "KUBOTA", Modelo: "KM 105" },
      conflictingEvidence: /\b(?:presion|diametro|modificad[oa]|sustituid[oa]|convertid[oa])\b/u },
      fields: ["Presión de aceite de trabajo del modelo", "Diámetro nominal de herramienta compatible"] },
    facts: [
      { field: "Presión de aceite de trabajo del modelo", value: "100–150 bar", support: "Kubota Hydraulic breaker ES 2024-07-11, p. 7, Datos técnicos, KM 105, presión de aceite; coincide con el catálogo general Kubota de 2017, p. 5 (https://loewener.dk/wp-content/uploads/2017/02/Kubota-2017-01-05-Doc-Generale-2017-pages-A4.pdf) y la ficha KM de 2015 (https://sab-daruvar.squarespace.com/s/KM-hidraulic-breakers-2015.pdf). Rango de diseño, no presión medida de unidad ni de portadora." },
      { field: "Diámetro nominal de herramienta compatible", value: "45 mm", support: "Mismas tablas KM 105, diámetro de herramienta; coincide con la gama KM de Kubota (https://kuk.kubota-eu.com/constructionmachinery/products/km-series/). No acredita herramienta instalada, peso de servicio ni caudal." }
    ]
  },
  {
    url: "https://www.ubaristi.com/media/documents/product/pdf/kubota-km-breakers-es_1.pdf", brand: "KUBOTA", model: "KM 155", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "martillo-miniexcavadora", firstYear: 2016, lastYear: 2021, verifiedStructuredIdentity: true,
      sourceAnchors: { Marca: "KUBOTA", Modelo: "KM 155" },
      conflictingEvidence: /\b(?:presion|diametro|modificad[oa]|sustituid[oa]|convertid[oa])\b/u },
      fields: ["Presión de aceite de trabajo del modelo", "Diámetro nominal de herramienta compatible"] },
    facts: [
      { field: "Presión de aceite de trabajo del modelo", value: "100–150 bar", support: "Kubota Hydraulic breaker ES 2024-07-11, p. 7, Datos técnicos, KM 155, presión de aceite; coincide con el catálogo general Kubota de 2017, p. 5 (https://loewener.dk/wp-content/uploads/2017/02/Kubota-2017-01-05-Doc-Generale-2017-pages-A4.pdf) y la ficha KM de 2015 (https://sab-daruvar.squarespace.com/s/KM-hidraulic-breakers-2015.pdf). Rango de diseño, no presión medida de unidad ni de portadora." },
      { field: "Diámetro nominal de herramienta compatible", value: "50 mm", support: "Mismas tablas KM 155, diámetro de herramienta; coincide con la gama KM de Kubota (https://kuk.kubota-eu.com/constructionmachinery/products/km-series/). No acredita herramienta instalada, peso de servicio ni caudal." }
    ]
  },
  {
    url: "https://www.ubaristi.com/media/documents/product/pdf/kubota-km-breakers-es_1.pdf", brand: "KUBOTA", model: "KM 205", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "martillo-miniexcavadora", firstYear: 2016, lastYear: 2021, verifiedStructuredIdentity: true,
      sourceAnchors: { Marca: "KUBOTA", Modelo: "KM 205" },
      conflictingEvidence: /\b(?:presion|diametro|modificad[oa]|sustituid[oa]|convertid[oa])\b/u },
      fields: ["Presión de aceite de trabajo del modelo", "Diámetro nominal de herramienta compatible"] },
    facts: [
      { field: "Presión de aceite de trabajo del modelo", value: "100–150 bar", support: "Kubota Hydraulic breaker ES 2024-07-11, p. 7, Datos técnicos, KM 205, presión de aceite; coincide con el catálogo general Kubota de 2017, p. 5 (https://loewener.dk/wp-content/uploads/2017/02/Kubota-2017-01-05-Doc-Generale-2017-pages-A4.pdf) y la ficha KM de 2015 (https://sab-daruvar.squarespace.com/s/KM-hidraulic-breakers-2015.pdf). Rango de diseño, no presión medida de unidad ni de portadora." },
      { field: "Diámetro nominal de herramienta compatible", value: "65 mm", support: "Mismas tablas KM 205, diámetro de herramienta; coincide con la gama KM de Kubota (https://kuk.kubota-eu.com/constructionmachinery/products/km-series/). No acredita herramienta instalada, peso de servicio ni caudal." }
    ]
  },
  {
    url: "https://dynadocweb.dynapac.com/idc/groups/product_doc/documents/product_documentation/ilp6500en.pdf", brand: "Dynapac", model: "LP6500", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "compactadora", firstYear: 2003, lastYear: 2003,
      sourceAnchors: {"Altura almacenaje": "1.04 m", "Longitud": "2.52 m", "Anchura": "0.72 m", "Peso": "696 kg", "Motor": "Diésel"},
      conflictingEvidence: /\b(?:frecuencia|fuerza centrifuga|amplitud)\b|\b(?:modificad[oa]|sustituid[oa]|convertid[oa])\b/u },
      fields: ["Frecuencia de vibración", "Fuerza centrífuga", "Amplitud de vibración"] },
    facts: [
      { field: "Frecuencia de vibración", value: "61 Hz", support: "Dynapac LP6500 ILP6500EN3, p. 11, Compaction data; ambas variantes de arranque. No se atribuye variante de arranque por discrepancia entre peso y texto." },
      { field: "Fuerza centrífuga", value: "20 kN", support: "Misma tabla de ambas variantes." },
      { field: "Amplitud de vibración", value: "0,45 mm", support: "Misma tabla de ambas variantes." }
    ]
  },
  {
    url: "https://kbm.kubota-eu.com/constructionmachinery/en/products/u10-3u10-3-sl/", brand: "Kubota", model: "U10.3",
    reviewedOn: "2026-11-21", facts: [
      { field: "Anchura máxima del chasis extendido", value: "990 mm", support: "Overall width | 750-990 mm" },
      { field: "Anchura mínima del chasis", value: "750 mm", support: "Overall width | 750-990 mm" },
      { field: "Longitud de transporte", value: "2980 mm", support: "Shipping length | 2980 mm" },
      { field: "Profundidad máxima de excavación", value: "1800 mm", support: "Digging depth | 1800 mm" }
    ]
  },
  {
    url: "https://kuk.kubota-eu.com/constructionmachinery/products/u27-4/", brand: "Kubota", model: "U27.4",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance máximo de excavación", value: "4740 mm", support: "Max Reach (mm) | 4740" },
      { field: "Anchura (mm)", value: "1500 mm", support: "Overall width (mm) | 1500" },
      { field: "Fuerza máxima de excavación en cuchara", value: "21 kN", support: "Max Digging Force Arm/Bucket (kN) | 12.3/21.0" },
      { field: "Profundidad máxima de excavación", value: "2820 mm", support: "Max Dig Depth (mm) | 2820" }
    ]
  },
  {
    url: "https://www.ausa.com/es-es/dumpers/d450ahg", brand: "Ausa", model: "D450AHG",
    reviewedOn: "2026-11-21", facts: [
      { field: "Capacidad de tolva colmada", value: "2670 l", support: "Capacidad tolva colmada | 2670 l" },
      { field: "Capacidad de tolva rasa", value: "2055 l", support: "Capacidad tolva rasa | 2055 l" },
      { field: "Radio de giro exterior", value: "4830 mm", support: "Radio de giro exterior | 4830 mm" },
      { field: "Tracción", value: "4x4", support: "Tracción | 4x4" },
      { field: "Transmisión", value: "Hidrostática", support: "Transmisión | Hidrostática" }
    ]
  },
  {
    url: "https://kubota.com.au/product/excavator-u27-4/", brand: "Kubota", model: "U27.4",
    reviewedOn: "2026-11-21", facts: [
      { field: "Altura máxima de descarga", value: "3100 mm", support: "Kubota U27-4, Working Range: Max. Dumping Height | 3,100 mm" }
    ]
  },
  {
    url: "https://www.kubota.com/products/machinery/singapore/pdf/1117_U10-3_200dpi.pdf",
    brand: "Kubota", model: "U10.3", reviewedOn: "2026-11-21", facts: [
      { field: "Altura máxima de descarga", value: "2215 mm", support: "Kubota U10-3, Specifications, Working range: Max. dumping height | 2215 mm" }
    ]
  }
];

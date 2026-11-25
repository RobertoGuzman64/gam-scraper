import type { ReviewedModelDocument } from "./types.js";

export const handlingEquipmentDocuments: readonly ReviewedModelDocument[] = [
  {
    url: "https://www.helichina.net/product/1-5-3-8t-h4-series-four-wheel-electric-forklift/", brand: "HELI", model: "CPD18", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 1800,
      marketCountry: "España", invariantUsedLoadCenter: true, firstYear: 2023, lastYear: 2023 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "HELI H4, tabla Parameter, CPD18 1800 kg y 500 mm; ficha H4 de abril 2023 (https://www.heliheftruck.nl/wp-content/uploads/2023/04/H4-series-1.5-3.8t-electric-forklift.pdf), filas 1.04 y 1.05, configuraciones M y S. Coincide con H4 LI-ION (https://www.helichina.net/product/1-5-3-8t-h4-series-four-wheel-li-ion-forklift/) y G2 LI-ION (https://www.helichina.net/product/1-5-3-8t-g2-series-four-wheel-li-ion-forklift/). Solo centro nominal de las variantes de 1800 kg, no capacidad residual ni tipo de batería, tensión, mástil o geometría." }
    ]
  },
  {
    url: "https://grosa.es/wp-content/uploads/2015/11/catalogo_tecnico_DCE.pdf", brand: "KALMAR", model: "DCE120-6", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "diésel", loadCapacityKg: 12000,
      marketCountry: "España", firstYear: 2011, lastYear: 2011 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "600 mm", support: "Kalmar DCE 9-18 t, catálogo técnico en español, p. 2, tabla Dimensiones: DCE120-6, 12000 kg a 600 mm; la designación distingue el centro de carga en decímetros. No aplicable a DCE120-12. Valor nominal, no capacidad residual." }
    ]
  },
  {
    url: "https://cdn.forkliftcenter.com/media/productattachments/files/Kalmar_DCD200-500_technical_information.pdf", brand: "KALMAR", model: "DCD200-12LB", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "diésel", loadCapacityKg: 20000,
      marketCountry: "España", firstYear: 2008, lastYear: 2008, widthM: 3.05 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "1200 mm", support: "Kalmar DCD200-500, Technical Information, pp. 2-3, columna DCD200-12LB: 20000 kg a 1200 mm, anchura 3050 mm. Designación LB de chasis bajo. No aplicable a variantes de centro de carga diferente ni como capacidad residual." }
    ]
  },
  {
    url: "https://xn----8sbhqfaif6agbcp7adg3e.xn--p1ai/pdf/Toyota%208FD25_8FDF25.pdf", brand: "TOYOTA", model: "02 – 8FGF25", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "GLP", loadCapacityKg: 2500,
      marketCountry: "España", firstYear: 2019, lastYear: 2019 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Toyota Tonero 8FGF/FDF25, abril 2019, p. 344, columna 02-8FGF25, filas 1.3, 1.5 y 1.6: GLP, 2500 kg a 500 mm. Valor nominal, no capacidad residual." }
    ]
  },
  {
    url: "https://www.manualslib.es/manual/389622/Unicarriers-1Q2-Serie.html?page=88", brand: "UNICARRIERS", model: "G1Q2L30Q", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 3000,
      marketCountry: "España", firstYear: 2018, lastYear: 2018 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "UniCarriers 1Q2, manual de instrucciones OM15ES-01Q2Q0, página 88 del visor, especificaciones, columna G1Q2L30Q: 3000 kg y centro de carga 500 mm. Valor nominal, no capacidad residual." }
    ]
  },
  {
    url: "https://media.prod.shop.jungheinrichcloud.com/PCMSS/en/b0665b4430e512b561a265204b572fbe4f58c3d0.pdf", brand: "JUNGHEINRICH", model: "DFG320S", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "diésel", loadCapacityKg: 2000,
      marketCountry: "España", firstYear: 2013, lastYear: 2020 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Jungheinrich DFG 316s-320s, Technical data VDI 2198, filas 1.5 y 1.6: DFG 320s 2000 kg a 500 mm. Corroborado en ficha del fabricante 09/2013 DFG/TFG 316s/320s, diagrama p. 2 y tabla de datos. Valor nominal, no capacidad residual." }
    ]
  },
  {
    url: "https://www.toyotamaterialhandling.com.au/media/20096/6fbre12_20.341.pdf", brand: "Toyota", model: "6FBRE14",
    reviewedOn: "2026-11-21", facts: [
      { field: "Anchura exterior del modelo", value: "1250 mm", support: "6FBRE14 | Overall Width | 1250 mm" },
      { field: "Centro de carga nominal del modelo", value: "600 mm", support: "6FBRE14 | Load Center | 600 mm" },
      { field: "Propulsión", value: "Eléctrica", support: "Toyota Electric Reach Truck 6FBRE/6FBR Series" },
      { field: "Radio de giro exterior del modelo", value: "1570 mm", support: "6FBRE14 | Turning Radius (Outside) | 1570 mm" }
    ]
  },
  {
    url: "https://toyota-material-handling.co.th/products/275", brand: "BT", model: "SWE 160",
    reviewedOn: "2026-11-21", facts: [
      { field: "Anchura (mm)", value: "790 mm", support: "SWE160 | Overall Width (mm) | 790" },
      { field: "Centro de carga (mm)", value: "600 mm", support: "SWE160 | Load center (mm) | 600" },
      { field: "Radio de giro (mm)", value: "1504 mm", support: "SWE160 | Turning Radius (mm) | 1,504" }
    ]
  },
  {
    url: "https://www.linde-mh.es/es/Productos/Transpaletas/T14-T20/", brand: "Linde", model: "T18",
    reviewedOn: "2026-11-21", facts: [
      { field: "Capacidad nominal de carga", value: "1800 kg", support: "T18 | Capacidad de carga nominal | 1,8 t" },
      { field: "Elevación de horquillas", value: "125 mm", support: "T14–T20 | Elevación de horquillas | 125 mm" }
    ]
  },
  {
    url: "https://targoncatrade.hu/uploads/products/xt4018kh-1738823693.pdf", brand: "XCMG", model: "XT4018KH",
    reviewedOn: "2026-11-21", facts: [
      { field: "Tracción", value: "4×4", support: "XT4018KH | Transmission System | Drive mode | 4×4; catálogo XCMG, página 2" }
    ]
  },
  {
    url: "https://ibz-handelswelt.de/gebrauchtmaschinen/stoecklin-niederhubwagen-edp/", brand: "Stöcklin", model: "EDP-2000",
    reviewedOn: "2026-11-21", facts: [
      { field: "Capacidad nominal de carga", value: "2000 kg", support: "Stöcklin | Typ: EDP 2000 | Tragkraft: 2000 kg" },
      { field: "Tensión del sistema de batería", value: "24 V", support: "Stöcklin | Typ: EDP 2000 | Batterie: 24 V" }
    ]
  },
  {
    url: "https://www.djproducts.com/product/power-trailer-mover-6k-36v/", brand: null, model: "6K 36V BR",
    reviewedOn: "2026-11-21", facts: [
      { field: "Cargador a bordo del modelo", value: "Sí", support: "Onboard Charger" },
      { field: "Frenado en posición neutra del modelo", value: "Sí", support: "Neutral Throttle Braking" },
      { field: "Reducción de transmisión del modelo", value: "2:1 por cadena", support: "2:1 Gear Reduction with Chain to Drive Tires" },
      { field: "Velocidad de avance y retroceso del modelo", value: "0-2 mph", support: "0-2 mph Forward/ Reverse" }
    ]
  },
  {
    url: "https://www.linde-mh.es/es/Productos/Transpaletas/T14-T20/",
    brand: "Linde", model: "T18", reviewedOn: "2026-11-21", facts: [
      { field: "Centro de carga (mm)", value: "600 mm", support: "Linde T18 | Load centre distance c (mm) | 600 | https://www.linde-mh.co.uk/media/Datasheets/EN_ds_t14_t20_1155_en_c_0624_view.pdf" }
    ]
  },
  {
    url: "https://xcmguk.com/product/xt4014kh15/", brand: "XCMG", model: "XT4014KH",
    reviewedOn: "2026-11-21", facts: [
      { field: "Tracción", value: "4×4", support: "El fabricante describe literalmente XT4014KH: Its four-wheel drive and four-wheel steering. No se acredita potencia ni variantes" }
    ]
  },
  {
    url: "https://vertikal.net/en/pdf/78085/1beac504/ca_2025_8_p24-39.pdf",
    brand: "XCMG", model: "XT3207KH", reviewedOn: "2026-11-21", facts: [
      { field: "Tipo de motor", value: "Diésel", support: "Anuncio técnico de XCMG UK, Cranes & Access 2025/8, pág. 24: XT3207KH | Engine model: Deutz TCD 3.6. DEUTZ confirma que TCD 3.6 L4 es motor diésel: https://www.deutz.com/americas/en/products/power-packs/tcd-36-l4/" }
    ]
  },
  {
    url: "https://machineryline.es/-/venta/carretillas-electricas/UniCarriers/1Q2L25Q--25090213332743096600",
    brand: "UniCarriers", model: "1Q2L25Q", reviewedOn: "2026-11-21", facts: [
      { field: "UniCarriers 1Q2L25Q · Altura de elevación", value: "4.750 mm",
        support: "Ficha del vendedor GAM: unidad GAM-01397, UniCarriers 1Q2L25Q (2016), altura de elevación 4,75 m; catálogo GAM-01397 coincide con la referencia externa del lote 11" },
      { field: "UniCarriers 1Q2L25Q · Capacidad de carga", value: "2.500 kg",
        support: "Ficha del vendedor GAM: unidad GAM-01397, UniCarriers 1Q2L25Q (2016), capacidad 2500 kg; catálogo GAM-01397 coincide con la referencia externa del lote 11" }
    ]
  },
  {
    url: "https://www.automecaniccorbella.com/resource/B300II_ficha_t%C3%A9cnica.pdf",
    brand: "CESAB", model: "B318LII", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 1800,
      marketCountry: "España", firstYear: 2022 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "CESAB Material Handling Europe, SPEC_B300_ES_202202 / Ucan V02, p. 2, columna B318L-II, filas 1.5 y 1.6: 1,8 t y 500 mm; especificación nominal en condiciones estándar, no capacidad residual de la unidad." }
    ]
  }
];

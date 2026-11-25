import type { ReviewedModelDocument } from "./types.js";

export const yaleDocuments: readonly ReviewedModelDocument[] = [
  {
    url: "https://www.yale.com/es-es/emea/apiladores-de-pales/msc12/", brand: "YALE", model: "MSC12", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "apilador", firstYear: null, lastYear: null, anchoredCatalogOffer: true,
      sourceAnchors: { Marca: "YALE", Modelo: "MSC12", Longitud: "1800 mm", Anchura: "2270 mm", Altura: "3500 mm", Peso: "600 KG", "Capacidad de carga (kg)": "1200 KG" },
      conflictingEvidence: /\b(?:elevacion proporcional|control proporcional|convertid[oa]|modificad[oa])\b/u }, fields: ["Elevación proporcional"] }, facts: [
      { field: "Elevación proporcional", value: "Sí", support: "Ficha MSC12, apartado de características: control proporcional de elevación. No se acreditan dimensiones ni opciones de mástil." }
    ]
  },
  {
    url: "https://www.yale.com/globalassets/coms/yale/emea/documents/very-narrow-aisle-trucks/mtc-series-spec-sheet-rev04-en.pdf", brand: "YALE", model: "MTC10", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 1000,
      catalogOffer: true, invariantLoadCenter: true, marketCountry: "España", lengthM: 3.538, voltageV: 48 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "600 mm", support: "Yale MTC, VDI 2198 rev. 04, p. 2, filas 1.5 y 1.6: MTC10, 1000 kg a 600 mm; longitud 3538 mm, 48 V. Valor nominal, no capacidad residual ni configuración de mástil o batería instalada." }
    ]
  },
  {
    url: "https://www.yale.com/globalassets/coms/yale/emea/documents/very-narrow-aisle-trucks/mtc-series-spec-sheet-rev04-en.pdf", brand: "YALE", model: "MTC13-48V", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 1300,
      catalogOffer: true, invariantLoadCenter: true, marketCountry: "España", lengthM: 3.698, voltageV: 48 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "600 mm", support: "Yale MTC, VDI 2198 rev. 04, p. 2, filas 1.5 y 1.6: MTC13, 1300 kg a 600 mm; longitud 3698 mm, 48 V. Valor nominal, no capacidad residual ni configuración de mástil o batería instalada." }
    ]
  },
  {
    url: "https://www.yale.com/globalassets/coms/yale/emea/documents/very-narrow-aisle-trucks/mtc-series-spec-sheet-rev04-en.pdf", brand: "YALE", model: "MTC13-80V", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 1300,
      catalogOffer: true, invariantLoadCenter: true, marketCountry: "España", voltageV: 80 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "600 mm", support: "Yale MTC, VDI 2198 rev. 04, p. 2, filas 1.5 y 1.6: MTC13 80, 1300 kg a 600 mm, 80 V. Valor nominal, no capacidad residual ni configuración de mástil o batería instalada." }
    ]
  },
  {
    url: "https://www.yale.com/globalassets/coms/yale/emea/documents/very-narrow-aisle-trucks/mtc-series-spec-sheet-rev04-en.pdf", brand: "YALE", model: "MTC15", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 1500,
      catalogOffer: true, invariantLoadCenter: true, marketCountry: "España" }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "600 mm", support: "Yale MTC, VDI 2198 rev. 04, p. 3, filas 1.5 y 1.6: MTC15 SWB, MWB y LWB, todas 1500 kg a 600 mm. Valor nominal, no capacidad residual ni configuración de mástil o batería instalada." }
    ]
  },
  {
    url: "https://www.yale.com/globalassets/coms/yale/emea/documents/very-narrow-aisle-trucks/mtc-series-spec-sheet-rev04-en.pdf", brand: "YALE", model: "MTC15L", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 1500,
      catalogOffer: true, invariantLoadCenter: true, marketCountry: "España", voltageV: 80 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "600 mm", support: "Yale MTC, VDI 2198 rev. 04, p. 3, filas 1.5 y 1.6: MTC15 LWB, 1500 kg a 600 mm; 80 V entre configuraciones de batería; denominación MTC15 L en tabla EMEA vigente. Valor nominal, no capacidad residual ni configuración de mástil o batería instalada." }
    ]
  },
  {
    url: "https://www.yale.com/globalassets/coms/yale/emea/documents/high-capacity-internal-combustion-trucks/gdp80-160dfef/220991386-gdp80-160df-ef-series-spec-sheet-eu-rev02-en-lowres-.pdf", brand: "YALE", model: "GDP80DF", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "diésel", loadCapacityKg: 8500,
      catalogOffer: true, marketCountry: "España", lengthM: 5.524, widthsM: [2.49] }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "600 mm", support: "Yale DF/EF 220991386 rev. 02, p. 2, columna GDP80DF, filas 1.5 y 1.6: 8500 kg a 600 mm; 4.19 y 4.21: 5524 y 2490 mm. Valor nominal, no capacidad residual ni capacidad a la altura anunciada." }
    ]
  },
  {
    url: "https://www.yale.com/globalassets/coms/yale/emea/documents/high-capacity-internal-combustion-trucks/gdp80-160dfef/220991386-gdp80-160df-ef-series-spec-sheet-eu-rev02-en-lowres-.pdf", brand: "YALE", model: "GDP100DF", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "diésel", loadCapacityKg: 10500,
      catalogOffer: true, marketCountry: "España", lengthM: 5.724, widthsM: [2.49] }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "600 mm", support: "Yale DF/EF 220991386 rev. 02, p. 3, columna GDP100DF, filas 1.5 y 1.6: 10500 kg a 600 mm; 4.19 y 4.21: 5724 y 2490 mm. Valor nominal, no capacidad residual ni capacidad a la altura anunciada." }
    ]
  },
  {
    url: "https://www.yale.com/globalassets/coms/yale/emea/documents/high-capacity-internal-combustion-trucks/gdp80-160dfef/220991386-gdp80-160df-ef-series-spec-sheet-eu-rev02-en-lowres-.pdf", brand: "YALE", model: "GDP120DF", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "diésel", loadCapacityKg: 12500,
      catalogOffer: true, marketCountry: "España", lengthM: 5.724, widthsM: [2.49] }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "600 mm", support: "Yale DF/EF 220991386 rev. 02, p. 3, columna GDP120DF, filas 1.5 y 1.6: 12500 kg a 600 mm; 4.19 y 4.21: 5724 y 2490 mm. Valor nominal, no capacidad residual ni capacidad a la altura anunciada." }
    ]
  },
  {
    url: "https://yaletargonca.hu/wp-content/uploads/2021/02/ERP15-20VT-spec-sheet.pdf", brand: "YALE", model: "ERP16VT MWB", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 1600,
      marketCountry: "España", firstYear: 2017, lastYear: 2017 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Yale VT, VDI 2198, p. 2, columna ERP16VT (MWB), filas 1.5 y 1.6: 1600 kg a 500 mm. Corroborado en ficha Yale rev. 10. Valor nominal independiente de la configuración de mástil." }
    ]
  },
  {
    url: "https://yaletargonca.hu/wp-content/uploads/2021/02/ERP15-20VT-spec-sheet.pdf", brand: "YALE", model: "ERP18VTMWB", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 1800,
      marketCountry: "España", firstYear: 2018, lastYear: 2018 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Yale VT, VDI 2198, p. 3, columna ERP18VT (MWB), filas 1.5 y 1.6: 1800 kg a 500 mm. Corroborado en ficha Yale rev. 10. Valor nominal independiente de la configuración de mástil." }
    ]
  },
  {
    url: "https://www.yale.com/globalassets/coms/yale/emea/documents/internal-combustion-trucks-pneumatic-tyre/gp20-35ux/220991932-yale-gp20-35ux-a7s1-sps-rev01-en-online", brand: "YALE", model: "GP20UX", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "diésel", loadCapacityKg: 2000,
      catalogOffer: true, marketCountry: "España", lengthM: 3.63, widthsM: [1.15] }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Yale GP20-35UX 220991932 rev. 01, p. 4, columna GDP20UX, filas 1.5 y 1.6: 2000 kg a 500 mm en Stage IIIA y V; 4.19 y 4.21: 3630 y 1150 mm. Denominación GP de gama contrastada con motor diésel y cotas GDP. Valor nominal, no capacidad residual." }
    ]
  },
  {
    url: "https://www.yale.com/globalassets/coms/yale/emea/documents/internal-combustion-trucks-pneumatic-tyre/gp20-35ux/220991932-yale-gp20-35ux-a7s1-sps-rev01-en-online", brand: "YALE", model: "GP25UX", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "diésel", loadCapacityKg: 2500,
      catalogOffer: true, marketCountry: "España", lengthM: 3.69, widthsM: [1.15] }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Yale GP20-35UX 220991932 rev. 01, p. 4, columna GDP25UX, filas 1.5 y 1.6: 2500 kg a 500 mm en Stage IIIA y V; 4.19 y 4.21: 3690 y 1150 mm. Denominación GP de gama contrastada con motor diésel y cotas GDP. Valor nominal, no capacidad residual." }
    ]
  },
  {
    url: "https://www.yale.com/globalassets/coms/yale/emea/documents/internal-combustion-trucks-pneumatic-tyre/gp20-35ux/220991932-yale-gp20-35ux-a7s1-sps-rev01-en-online", brand: "YALE", model: "GP30UX", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "diésel", loadCapacityKg: 3000,
      catalogOffer: true, marketCountry: "España", lengthM: 3.765, widthsM: [1.21] }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Yale GP20-35UX 220991932 rev. 01, p. 5, columna GDP30UX, filas 1.5 y 1.6: 3000 kg a 500 mm en Stage IIIA y V; 4.19 y 4.21: 3765 y 1210 mm. Denominación GP de gama contrastada con motor diésel y cotas GDP. Valor nominal, no capacidad residual." }
    ]
  },
  {
    url: "https://www.yale.com/globalassets/coms/yale/emea/documents/internal-combustion-trucks-pneumatic-tyre/gp20-35ux/220991932-yale-gp20-35ux-a7s1-sps-rev01-en-online", brand: "YALE", model: "GP35UX", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "diésel", loadCapacityKg: 3500,
      catalogOffer: true, marketCountry: "España", lengthM: 3.85, widthsM: [1.21] }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Yale GP20-35UX 220991932 rev. 01, p. 6, columna GDP35UX, filas 1.5 y 1.6: 3500 kg a 500 mm en Stage IIIA y V; 4.19 y 4.21: 3850 y 1210 mm. Denominación GP de gama contrastada con motor diésel y cotas GDP. Valor nominal, no capacidad residual." }
    ]
  },
  {
    url: "https://www.yale.com/globalassets/coms/yale/emea/documents/3-wheel-electric-forklift-trucks/erp15-20vt/220991848-erp15-20vt-g807-sps-rev01-es-online-1.pdf", brand: "YALE", model: "ERP16VT", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 1600,
      catalogOffer: true, marketCountry: "España", lengthM: 2.903, widthsM: [1.05, 1.116] }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Yale serie VT 220991848 rev. 01, p. 3, filas 1-5 y 1-6: 1600 kg a 500 mm en SWB, MWB y LWB; 4-19: 2903 mm en MWB, 4-21: 1050 mm (1116 con neumáticos alternativos). Valor nominal del modelo, no capacidad residual de una unidad." }
    ]
  },
  {
    url: "https://www.yale.com/globalassets/coms/yale/emea/documents/3-wheel-electric-forklift-trucks/erp15-20vt/220991848-erp15-20vt-g807-sps-rev01-es-online-1.pdf", brand: "YALE", model: "ERP18VT", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 1800,
      catalogOffer: true, marketCountry: "España", lengthM: 2.898, widthsM: [1.116] }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Yale serie VT 220991848 rev. 01, p. 4, filas 1-5 y 1-6: 1800 kg a 500 mm en MWB y LWB; 4-19 y 4-21: 2898 y 1116 mm en MWB. Valor nominal del modelo, no capacidad residual de una unidad." }
    ]
  },
  {
    url: "https://www.yale.com/globalassets/coms/yale/emea/documents/3-wheel-electric-forklift-trucks/erp15-20vt/220991848-erp15-20vt-g807-sps-rev01-es-online-1.pdf", brand: "YALE", model: "ERP20VT", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 2000,
      catalogOffer: true, marketCountry: "España", lengthM: 2.898, widthsM: [1.116] }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Yale serie VT 220991848 rev. 01, p. 4, filas 1-5 y 1-6: 2000 kg a 500 mm en MWB y LWB; 4-19 y 4-21: 2898 y 1116 mm en MWB. Valor nominal del modelo, no capacidad residual de una unidad." }
    ]
  },
  {
    url: "https://www.yale.com/globalassets/coms/yale/emea/documents/4-wheel-electric-forklift-trucks/erp22-35vl/220990062-vl-series-spec-sheet-rev07-es-lowres-zmag.pdf", brand: "YALE", model: "ERP22VL", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 2200,
      catalogOffer: true, marketCountry: "España", lengthM: 3.336, widthsM: [1.173, 1.289] }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Yale serie VL 220990062 rev. 07, p. 2, filas 1.5 y 1.6: 2200 kg a 500 mm en Value y Productivity MWB; 4.19 y 4.21: 3336 y 1173/1289 mm. Valor nominal del modelo, no capacidad residual de una unidad." }
    ]
  },
  {
    url: "https://www.yale.com/globalassets/coms/yale/emea/documents/4-wheel-electric-forklift-trucks/erp22-35vl/220990062-vl-series-spec-sheet-rev07-es-lowres-zmag.pdf", brand: "YALE", model: "ERP25VL", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 2500,
      catalogOffer: true, marketCountry: "España", lengthM: 3.48, widthsM: [1.173, 1.289] }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Yale serie VL 220990062 rev. 07, pp. 2-3, filas 1.5 y 1.6: 2500 kg a 500 mm en Value y Productivity, MWB y LWB; 4.19 y 4.21: 3480 y 1173/1289 mm en LWB. Valor nominal del modelo, no capacidad residual de una unidad." }
    ]
  },
  {
    url: "https://www.yale.com/globalassets/coms/yale/emea/documents/4-wheel-electric-forklift-trucks/erp22-35vl/220990062-vl-series-spec-sheet-rev07-es-lowres-zmag.pdf", brand: "YALE", model: "ERP30VL", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 3000,
      catalogOffer: true, marketCountry: "España", lengthM: 3.492, widthsM: [1.173, 1.289] }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Yale serie VL 220990062 rev. 07, p. 3, filas 1.5 y 1.6: 3000 kg a 500 mm en Value y Productivity LWB; 4.19 y 4.21: 3492 y 1173/1289 mm. Valor nominal del modelo, no capacidad residual de una unidad." }
    ]
  },
  {
    url: "https://www.briggsstore.co.uk/uploads/Yale_EN_PLHP25_standard_spec-sheet.pdf", brand: "YALE", model: "PLHP25",
    reviewedOn: "2026-11-21", facts: [
      { field: "Centro de carga (mm)", value: "600 mm", support: "1.6 Load centre distance c (mm) | 600" },
      { field: "Elevación de las horquillas", value: "195 mm", support: "4.4 Lift h3 (mm) | 195" },
      { field: "Peso de servicio", value: "60 kg", support: "2.1 Service weight kg | 60" }
    ]
  },
  {
    url: "https://www.yale.com/es-es/emea/carretillas-para-pasillos-muy-estrechos-vna/mtc10-15/",
    brand: "YALE", model: "MTC15", reviewedOn: "2026-11-21", facts: [
      { field: "Rotación del cabezal trilateral", value: "180°", support: "Yale MTC10-15: El cabezal trilateral gira 180 grados" }
    ]
  },
  {
    url: "https://online.gamrentals.com/en/electric-pallets/5827-2017-yale-mp20",
    brand: "YALE", model: "MP20", reviewedOn: "2026-11-21", facts: [
      { field: "Yale MP20 · Capacidad de carga", value: "2.000 kg",
        support: "GAM artículo 5827: YALE MP20 (2017), referencia GAM-19513, serie A428T05299R; capacidad declarada 2000 kg; la referencia externa del lote 12 es GAM-19513" },
      { field: "Yale MP20 · Longitud de horquillas", value: "1.156 mm",
        support: "GAM artículo 5827: YALE MP20 (2017), referencia GAM-19513, serie A428T05299R; horquillas 1156 mm; la referencia externa del lote 12 es GAM-19513" }
    ]
  },
  {
    url: "https://online.gamrentals.com/fichas-tecnicas/es/MP18.pdf",
    brand: "Yale", model: "MP16", reviewedOn: "2026-11-21", facts: [
      { field: "Yale MP16 · Accionamiento", value: "Eléctrico",
        support: "Ficha técnica GAM de Yale serie MP, tabla VDI 2198, columna MP16, sección 1.3 Propulsión = Eléctrica (batería); el catálogo GAM del lote 17 incluye expresamente 2021 YALE MP16; no acredita anchura de horquillas" }
    ]
  },
  {
    url: "https://www.yale.com/globalassets/coms/yale/emea/documents/4-wheel-electric-forklift-trucks/erp22-35vl/220990057-vl-series-spec-sheet-rev07-en-lowres-zmag.pdf",
    brand: "YALE", model: "ERP35VL", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 3500,
      marketCountry: "España", firstYear: 2019, lastYear: 2021 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Yale Europe 220990057 rev. 07 (02/2021), p. 3, filas 1.5 y 1.6: ERP 35 VL LWB, 3500 kg nominales a 500 mm en Value y Productivity. Corroborado en edición alemana 220990059 rev. 07 (07/2019), p. 3. Valores nominales de configuración estándar, no capacidad residual con mástil o accesorios instalados." }
    ]
  }
];

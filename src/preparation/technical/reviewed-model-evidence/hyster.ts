import type { ReviewedModelDocument } from "./types.js";

export const hysterDocuments: readonly ReviewedModelDocument[] = [
  {
    url: "https://www.hyster.com/es-es/emea/transpaletas-y-apiladores-con-conductor-a-bordo-y-acompanante/p1.6-2.2/", brand: "HYSTER", model: "P2.0", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "transpaleta", firstYear: null, lastYear: null, anchoredCatalogOffer: true,
      sourceAnchors: {"Marca": "HYSTER", "Modelo": "P2.0", "Peso": "632 KG", "Altura de elevación (m)": "0,13 metros", "Capacidad de carga (kg)": "2000 KG", "Capacidad de la batería": "24V / 150-375Ah | Li-ion 24V / 50-100Ah(V/Ah)"},
      corroboratingText: /\bhyster p2[.]0(?![a-z0-9.-])/u,
      conflictingEvidence: /\b(?:motor de traccion|posicion de conduccion)\b|\b(?:modificad[oa]|sustituid[oa]|convertid[oa])\b/u },
      fields: ["Tipo de motor de tracción", "Posición de conducción"] },
    facts: [
      { field: "Tipo de motor de tracción", value: "Corriente alterna (CA)", support: "Hyster P1.6-2.2, mantenimiento: motor de tracción CA cerrado de montaje vertical; tabla P2.0 coincide en 2000 kg, 130 mm, 632 kg y alternativas 24 V 150–375 Ah / 50–100 Ah." },
      { field: "Posición de conducción", value: "Operador a pie", support: "Misma página, familia de operario a pie." }
    ]
  },
  {
    url: "https://www.interempresas.net/FeriaVirtual/Catalogos_y_documentos/332358/C1.0-1.5.pdf", brand: "HYSTER", model: "C1.3 48V", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 1300,
      catalogOffer: true, invariantLoadCenter: true, marketCountry: "España", identityWeightKg: 6701, voltageV: 48 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "600 mm", support: "Hyster C1.0-1.5, ficha técnica española, p. 2, filas 1.5 y 1.6: C1.3, 600 mm, 48 V; peso 6701 kg. Capacidad 1300 kg corroborada en tabla EMEA del fabricante (errata de capacidad en ficha española). Valor nominal, no capacidad residual ni configuración de mástil o batería instalada." }
    ]
  },
  {
    url: "https://www.interempresas.net/FeriaVirtual/Catalogos_y_documentos/332358/C1.0-1.5.pdf", brand: "HYSTER", model: "C1.3 80V", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 1300,
      catalogOffer: true, invariantLoadCenter: true, marketCountry: "España", identityWeightKg: 6702, voltageV: 80 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "600 mm", support: "Hyster C1.0-1.5, ficha técnica española, p. 2, filas 1.5 y 1.6: C1.3 80, 1300 kg a 600 mm, 80 V; peso 6702 kg en la tabla EMEA vigente. Valor nominal, no capacidad residual ni configuración de mástil o batería instalada." }
    ]
  },
  {
    url: "https://www.interempresas.net/FeriaVirtual/Catalogos_y_documentos/332358/C1.0-1.5.pdf", brand: "HYSTER", model: "C1.5", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 1500,
      catalogOffer: true, invariantLoadCenter: true, marketCountry: "España", voltageV: 80 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "600 mm", support: "Hyster C1.0-1.5, ficha técnica española, p. 3, filas 1.5 y 1.6: C1.5 S, M y L, todas 1500 kg a 600 mm. Valor nominal, no capacidad residual ni configuración de mástil o batería instalada." }
    ]
  },
  {
    url: "https://www.hyster.com/globalassets/coms/hyster/emea/documents/trucks-literature/internal-combustion-trucks-pneumatic-tyre/h2.0-3.5ft/h2.0-3.5ft-p177-td-06-2019-lpg-eu-rev04-es.pdf", brand: "HYSTER", model: "H2.0FT", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "GLP", loadCapacityKg: 2000,
      marketCountry: "España", firstYear: 2019, lastYear: 2021 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Hyster P177 GLP EU rev. 04 (06/2019), p. 4, filas 1-5 y 1-6: 2000 kg a 500 mm en las cuatro configuraciones Fortens, incluidos motores Fase V; valor nominal, no capacidad residual." }
    ]
  },
  {
    url: "https://www.hyster.com/globalassets/coms/hyster/emea/documents/trucks-literature/internal-combustion-trucks-pneumatic-tyre/h2.0-3.5ft/h2.0-3.5ft-p177-td-06-2019-lpg-eu-rev04-es.pdf", brand: "HYSTER", model: "H3.0FT", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "GLP", loadCapacityKg: 3000,
      marketCountry: "España", firstYear: 2019, lastYear: 2021 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Hyster P177 GLP EU rev. 04 (06/2019), p. 6, filas 1-5 y 1-6: 3000 kg a 500 mm en las cuatro configuraciones Fortens, incluidos motores Fase V; valor nominal, no capacidad residual." }
    ]
  },
  {
    url: "https://www.hyster.com/globalassets/coms/hyster/emea/documents/trucks-literature/internal-combustion-trucks-pneumatic-tyre/h4.0-5.5ft/h4.0-5.5ft-u005-lpg-tg-01-2019-eu-rev02-es.pdf", brand: "HYSTER", model: "H5.5FT", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "GLP", loadCapacityKg: 5500,
      marketCountry: "España", firstYear: 2019, lastYear: 2021 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "600 mm", support: "Hyster U005 GLP EU rev. 02 (01/2019), p. 8, filas 1-5 y 1-6: H5.5FT 5,5 t a 600 mm en ambas transmisiones; corroborado en tabla EMEA H4.0-5.5FT vigente del fabricante. Valor nominal, no capacidad residual." }
    ]
  },
  {
    url: "https://www.hyster.com/globalassets/coms/hyster/emea/documents/trucks-literature/3-wheel-electric-forklift-trucks/j1.6-2.0utt/3991623-j1.6-2.0utt-a3c5-tg-rev01-es-online.pdf", brand: "HYSTER", model: "J1.6UTTL", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 1600,
      catalogOffer: true, marketCountry: "España", lengthM: 2.894, widthsM: [1.084] }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Hyster 3991623 rev. 01, p. 4, filas 1-5 y 1-6: J1.6UTT(L) 1600 kg a 500 mm; 4-19 y 4-21: 2894 y 1084 mm. Valor nominal del modelo, no capacidad residual de una unidad." }
    ]
  },
  {
    url: "https://www.hyster.com/globalassets/coms/hyster/emea/documents/trucks-literature/3-wheel-electric-forklift-trucks/j1.6-2.0utt/3991623-j1.6-2.0utt-a3c5-tg-rev01-es-online.pdf", brand: "HYSTER", model: "J1.8UTTL", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 1800,
      catalogOffer: true, marketCountry: "España", lengthM: 2.894, widthsM: [1.084] }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Hyster 3991623 rev. 01, p. 4, filas 1-5 y 1-6: J1.8UTT(L) 1800 kg a 500 mm; 4-19 y 4-21: 2894 y 1084 mm. Valor nominal del modelo, no capacidad residual de una unidad." }
    ]
  },
  {
    url: "https://www.hyster.com/globalassets/coms/hyster/emea/documents/trucks-literature/3-wheel-electric-forklift-trucks/j1.6-2.0utt/3991623-j1.6-2.0utt-a3c5-tg-rev01-es-online.pdf", brand: "HYSTER", model: "J2.0UTTL", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 2000,
      catalogOffer: true, marketCountry: "España", lengthM: 3.153, widthsM: [1.14] }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Hyster 3991623 rev. 01, p. 4, filas 1-5 y 1-6: J2.0UTT(L) 2000 kg a 500 mm; 4-19 y 4-21: 3153 y 1140 mm. Valor nominal del modelo, no capacidad residual de una unidad." }
    ]
  },
  {
    url: "https://www.hyster.com/globalassets/coms/hyster/emea/documents/trucks-literature/3-wheel-electric-forklift-trucks/a1.3-1.5xnt/a1.3-1.5xnt-d203-ss-03-2014-emea-rev03-es.pdf", brand: "HYSTER", model: "A1.3XNT", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 1300,
      catalogOffer: true, marketCountry: "España", lengthM: 2.724, widthsM: [0.996, 1.056] }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Hyster D203 rev. 03 (03/2014), p. 2, filas 1.5 y 1.6: A1.3XNT 1300 kg a 500 mm; 4.19 y 4.21: 2724 y 996/1056 mm según eje. Valor nominal del modelo, no capacidad residual de una unidad." }
    ]
  },
  {
    url: "https://online.gamrentals.com/ma/preparateurs-de-commandes/2185-preparateur-de-commandes-a-contrepoids-lo12c",
    brand: "HYSTER", model: "LO1.2C", reviewedOn: "2026-11-21", facts: [
      { field: "Dirección", value: "Eléctrica", support: "Ficha GAM en francés del mismo artículo 2185, marca HYSTER, modelo LO1.2C: système de direction électrique" },
      { field: "Velocidad máxima de desplazamiento", value: "9,6 km/h", support: "Ficha GAM en francés del mismo artículo 2185, HYSTER LO1.2C: vitesse maximale de 9,6 km/h" }
    ]
  },
  {
    url: "https://www.hyster.com/globalassets/coms/hyster/emea/documents/trucks-literature/internal-combustion-trucks-pneumatic-tyre/h2.0-3.5ft/h2.0-3.5ft-p177-td-06-2019-lpg-eu-rev04-es.pdf",
    brand: "HYSTER", model: "H2.5FT", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "GLP", loadCapacityKg: 2500,
      marketCountry: "España", firstYear: 2015, lastYear: 2021 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Hyster H2.5FT GLP EU, rev. 04 (06/2019), p. 5, filas 1-5 y 1-6: 2,5 t nominales a 500 mm en las cuatro configuraciones; p. 3 distingue las capacidades por mástil, neumáticos y accesorios. Coincide con Hyster Europe 901891/01 (10/2015), pp. 2 y 4." }
    ]
  },
  {
    url: "https://www.hyster.com/globalassets/coms/hyster/emea/documents/trucks-literature/internal-combustion-trucks-pneumatic-tyre/h2.0-3.5ft/h2.0-3.5ft-p177-td-06-2019-lpg-eu-rev04-es.pdf",
    brand: "HYSTER", model: "H3.5FT", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "GLP", loadCapacityKg: 3500,
      marketCountry: "España", firstYear: 2019, lastYear: 2021 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Hyster Europe, P177 rev. 04 (06/2019), p. 7, H3.5FT GLP, filas 1-5 y 1-6: 3,5 t a 500 mm en Fortens, Advance y Advance Plus; p. 3 distingue capacidades por mástil, ruedas y accesorios." }
    ]
  },
  {
    url: "https://www.hyster.com/globalassets/coms/hyster/cismea/documents/trucks-literature/3-wheel-electric-forklift-trucks/j1.5-2.0xnt/j1.5-2.0xnt-k160-ss-05-2016-emea-rev08-en.pdf",
    brand: "HYSTER", model: "J1.5XNT SWB", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 1500,
      marketCountry: "España", firstYear: 2016, lastYear: 2023 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Hyster Europe K160 rev. 08 (05/2016), p. 2, filas 1.5 y 1.6: J1.5XNT SWB, 1500 kg nominales a 500 mm; corroborado en rev. 09 (11/2023), pieza 3990029, p. 3. Capacidad nominal con mástil vertical estándar; no capacidad residual." }
    ]
  },
  {
    url: "https://www.hyster.com/globalassets/coms/hyster/cismea/documents/trucks-literature/3-wheel-electric-forklift-trucks/j1.5-2.0xnt/j1.5-2.0xnt-k160-ss-05-2016-emea-rev08-en.pdf",
    brand: "HYSTER", model: "J1.8XNT MWB", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 1800,
      marketCountry: "España", firstYear: 2016, lastYear: 2023 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Hyster Europe K160 rev. 08 (05/2016), p. 3, filas 1.5 y 1.6: J1.8XNT MWB, 1800 kg nominales a 500 mm; corroborado en rev. 09 (11/2023), pieza 3990029, p. 4. Capacidad nominal con mástil vertical estándar; no capacidad residual." }
    ]
  },
  {
    url: "https://www.hyster.com/globalassets/coms/hyster/cismea/documents/trucks-literature/3-wheel-electric-forklift-trucks/j1.5-2.0xnt/j1.5-2.0xnt-k160-ss-05-2016-emea-rev08-en.pdf",
    brand: "HYSTER", model: "J2.0XNT MWB", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 2000,
      marketCountry: "España", firstYear: 2016, lastYear: 2023 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Hyster Europe K160 rev. 08 (05/2016), p. 3, filas 1.5 y 1.6: J2.0XNT MWB, 2000 kg nominales a 500 mm; corroborado en rev. 09 (11/2023), pieza 3990029, p. 4. Capacidad nominal con mástil vertical estándar; no capacidad residual." }
    ]
  }
];

import type { ReviewedModelDocument } from "./types.js";

export const cleaningEquipmentDocuments: readonly ReviewedModelDocument[] = [
  {
    url: "https://www.tennantco.com/es_es/1/machines/scrubbers/product.t7%2B.fregadora-de-suelo-de-conductor-sentado.m-t7.html", brand: "Tennant", model: "FCS T7+ D65", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "fregadora", firstYear: null, lastYear: null, anchoredCatalogOffer: true, verifiedStructuredIdentity: true,
      sourceAnchors: { Marca: "Tennant", Modelo: "FCS T7+ D65", Peso: "471 KG", "RPM cepillo": "260" },
      corroboratingText: /^(?=[\s\S]*\bdeposito de recuperacion de 110 litros\b)(?=[\s\S]*\b67 dba\b)la fregadora\b/u,
      conflictingEvidence: /\b(?:deposito de solucion|capacidad de solucion|tanque de solucion)|\b(?:modificad[oa]|convertid[oa])\b/u }, fields: ["Capacidad del depósito de solución"] }, facts: [
      { field: "Capacidad del depósito de solución", value: "110 L", support: "Tennant T7+, especificaciones oficiales para trayectorias de 650 y 800 mm: depósito de solución 110 l y recuperación 110 l. Capacidad común; no se atribuye batería, velocidad ni peso de otra edición." }
    ]
  },
  {
    url: "https://www.tennantco.com/es_es/1/machines/scrubbers/product.t7%2B.fregadora-de-suelo-de-conductor-sentado.m-t7.html", brand: "Tennant", model: "FCS T7+ D80", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "fregadora", firstYear: null, lastYear: null, anchoredCatalogOffer: true, verifiedStructuredIdentity: true,
      sourceAnchors: { Marca: "Tennant", Modelo: "FCS T7+ D80", Peso: "471 KG", "RPM cepillo": "260" },
      corroboratingText: /^(?=[\s\S]*\bdeposito de recuperacion de 110 litros\b)(?=[\s\S]*\b67 dba\b)la fregadora\b/u,
      conflictingEvidence: /\b(?:deposito de solucion|capacidad de solucion|tanque de solucion)|\b(?:modificad[oa]|convertid[oa])\b/u }, fields: ["Capacidad del depósito de solución"] }, facts: [
      { field: "Capacidad del depósito de solución", value: "110 L", support: "Tennant T7+, especificaciones oficiales para trayectorias de 650 y 800 mm: depósito de solución 110 l y recuperación 110 l. Capacidad común; no se atribuye batería, velocidad ni peso de otra edición." }
    ]
  },
  {
    url: "https://www.tennantco.com/es_es/1/machines/scrubbers/product.m-t17.html", brand: "Tennant", model: "FCS T17 C", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "fregadora", firstYear: null, lastYear: null, anchoredCatalogOffer: true, verifiedStructuredIdentity: true,
      sourceAnchors: { Marca: "Tennant", Modelo: "FCS T17 C", "Anchura trabajo": "1,1 metros", "RPM cepillo": "500" },
      corroboratingText: /^(?=[\s\S]*\b500 rpm\b)(?=[\s\S]*\b250 kg\b)la fregadora\b/u,
      conflictingEvidence: /\b(?:deposito de recuperacion|tanque de recuperacion|modificad[oa]|convertid[oa])\b/u }, fields: ["Capacidad del depósito de recuperación"] }, facts: [
      { field: "Capacidad del depósito de recuperación", value: "346 L", support: "Tennant T17, especificaciones oficiales: depósito de recuperación 346 l, cabezal cilíndrico hasta 500 rpm. No se asigna depósito de solución, variable con ES." }
    ]
  },
  {
    url: "https://www.tennantco.com/content/dam/tennant/tennantco/products/machines/vacuums/Shared/vacuum-family-brochure-es-es.pdf", brand: "Tennant", model: "AP V-CAN-10", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "maquina-limpieza", firstYear: null, lastYear: null, anchoredCatalogOffer: true, verifiedStructuredIdentity: true,
      sourceAnchors: { Marca: "Tennant", Modelo: "AP V-CAN-10" },
      corroboratingText: /^(?=[\s\S]*\b4,1\s*kg\b)(?=[\s\S]*\b68\s*dba\b)\b(?:la )?aspiradora\b/u,
      conflictingEvidence: /\b(?:caudal de aire|flujo de aire|potencia electrica maxima|potencia maxima (?:del motor|de aspiracion)|potencia de succion|convertid[oa]|modificad[oa]|capacidad (?:del|de) deposito|deposito de \d+)\b/u }, fields: ["Caudal de aire de aspiración", "Potencia eléctrica máxima del equipo", "Capacidad del depósito"] }, facts: [
      { field: "Caudal de aire de aspiración", value: "29 l/s", support: "Folleto Tennant Familia de Aspiradores, p. 7, columna V-CAN-10, velocidad de flujo de aire 29 l/s." },
      { field: "Potencia eléctrica máxima del equipo", value: "900 W", support: "Misma tabla, potencia máxima del conjunto de motores 900 W; no es potencia de succión." },
      { field: "Capacidad del depósito", value: "10 l", support: "Misma tabla, capacidad del depósito 10 l." }
    ]
  },
  {
    url: "https://www.tennantco.com/content/dam/tennant/tennantco/products/machines/vacuums/Shared/vacuum-family-brochure-es-es.pdf", brand: "Tennant", model: "AP V-CAN-12", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "maquina-limpieza", firstYear: null, lastYear: null, anchoredCatalogOffer: true, verifiedStructuredIdentity: true,
      sourceAnchors: { Marca: "Tennant", Modelo: "AP V-CAN-12" },
      corroboratingText: /^(?=[\s\S]*\b6,1\s*kg\b)(?=[\s\S]*\b63\s*dba\b)\b(?:la )?aspiradora\b/u,
      conflictingEvidence: /\b(?:caudal de aire|flujo de aire|potencia electrica maxima|potencia maxima (?:del motor|de aspiracion)|potencia de succion|convertid[oa]|modificad[oa]|capacidad (?:del|de) deposito|deposito de \d+)\b/u }, fields: ["Caudal de aire de aspiración", "Potencia eléctrica máxima del equipo", "Capacidad del depósito"] }, facts: [
      { field: "Caudal de aire de aspiración", value: "44 l/s", support: "Folleto Tennant Familia de Aspiradores, p. 7, columna V-CAN-12, velocidad de flujo de aire 44 l/s." },
      { field: "Potencia eléctrica máxima del equipo", value: "900 W", support: "Misma tabla, potencia máxima del conjunto de motores 900 W; no es potencia de succión." },
      { field: "Capacidad del depósito", value: "12 l", support: "Misma tabla, capacidad del depósito 12 l." }
    ]
  },
  {
    url: "https://www.tennantco.com/content/dam/tennant/tennantco/products/machines/vacuums/Shared/vacuum-family-brochure-es-es.pdf", brand: "Tennant", model: "APL V-WD-27", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "maquina-limpieza", firstYear: null, lastYear: null, anchoredCatalogOffer: true, verifiedStructuredIdentity: true,
      sourceAnchors: { Marca: "Tennant", Modelo: "APL V-WD-27" },
      corroboratingText: /^(?=[\s\S]*\b7,8\s*kg\b)(?=[\s\S]*\b70\s*dba\b)\b(?:la )?aspiradora\b/u,
      conflictingEvidence: /\b(?:caudal de aire|flujo de aire|potencia electrica maxima|potencia maxima (?:del motor|de aspiracion)|potencia de succion|convertid[oa]|modificad[oa]|capacidad (?:del|de) deposito|deposito de \d+)\b/u }, fields: ["Caudal de aire de aspiración", "Potencia eléctrica máxima del equipo", "Capacidad del depósito"] }, facts: [
      { field: "Caudal de aire de aspiración", value: "55,6 l/s", support: "Folleto Tennant Familia de Aspiradores, p. 7, columna V-WD-27, velocidad de flujo de aire 55,6 l/s." },
      { field: "Potencia eléctrica máxima del equipo", value: "1300 W", support: "Misma tabla, potencia máxima del conjunto de motores 1300 W; no es potencia de succión." },
      { field: "Capacidad del depósito", value: "27 l", support: "Misma tabla, capacidad del depósito 27 l." }
    ]
  },
  {
    url: "https://www.tennantco.com/content/dam/tennant/tennantco/products/machines/vacuums/Shared/vacuum-family-brochure-es-es.pdf", brand: "Tennant", model: "APL V-WD-62", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "maquina-limpieza", firstYear: null, lastYear: null, anchoredCatalogOffer: true, verifiedStructuredIdentity: true,
      sourceAnchors: { Marca: "Tennant", Modelo: "APL V-WD-62" },
      corroboratingText: /^(?=[\s\S]*\b18,5\s*kg\b)(?=[\s\S]*\b74\s*dba\b)\b(?:la )?aspiradora\b/u,
      conflictingEvidence: /\b(?:caudal de aire|flujo de aire|potencia electrica maxima|potencia maxima (?:del motor|de aspiracion)|potencia de succion|convertid[oa]|modificad[oa]|capacidad (?:del|de) deposito|deposito de \d+)\b/u }, fields: ["Caudal de aire de aspiración", "Potencia eléctrica máxima del equipo", "Capacidad del depósito"] }, facts: [
      { field: "Caudal de aire de aspiración", value: "111,1 l/s", support: "Folleto Tennant Familia de Aspiradores, p. 7, columna V-WD-62, velocidad de flujo de aire 111,1 l/s." },
      { field: "Potencia eléctrica máxima del equipo", value: "2600 W", support: "Misma tabla, potencia máxima del conjunto de motores 2600 W; no es potencia de succión." },
      { field: "Capacidad del depósito", value: "62 l", support: "Misma tabla, capacidad del depósito 62 l." }
    ]
  },
  {
    url: "https://www.tennantco.com/content/dam/tennant/tennantco/products/machines/vacuums/Shared/vacuum-family-brochure-es-es.pdf", brand: "Tennant", model: "APL V-WD-72", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "maquina-limpieza", firstYear: null, lastYear: null, anchoredCatalogOffer: true, verifiedStructuredIdentity: true,
      sourceAnchors: { Marca: "Tennant", Modelo: "APL V-WD-72" },
      corroboratingText: /^(?=[\s\S]*\b23,4\s*kg\b)(?=[\s\S]*\b76\s*dba\b)\b(?:la )?aspiradora\b/u,
      conflictingEvidence: /\b(?:caudal de aire|flujo de aire|potencia electrica maxima|potencia maxima (?:del motor|de aspiracion)|potencia de succion|convertid[oa]|modificad[oa])\b/u }, fields: ["Caudal de aire de aspiración", "Potencia eléctrica máxima del equipo"] }, facts: [
      { field: "Caudal de aire de aspiración", value: "166,7 l/s", support: "Folleto Tennant Familia de Aspiradores, p. 7, columna V-WD-72, velocidad de flujo de aire 166,7 l/s." },
      { field: "Potencia eléctrica máxima del equipo", value: "3600 W", support: "Misma tabla, potencia máxima del conjunto de motores 3600 W; no es potencia de succión." }
    ]
  },
  {
    url: "https://www.nilfisk.com/media/jldbb1zr/nilfisk-grey-line-catalogue-2020-uki.pdf", brand: "Nilfisk", model: "BR850-S", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "fregadora", firstYear: null, lastYear: null, familyFromSourcePath: true,
      sourceAnchors: {"Altura": "1.35 m", "Longitud": "1.55 m", "Anchura": "0.88 m", "Peso": "705 kg", "Motor": "Eléctrico", "Anchura limpieza": "0.81 m"},
      conflictingEvidence: /\b(?:deposito|tanque|tension|voltaje)\b|\b(?:modificad[oa]|sustituid[oa]|convertid[oa])\b/u },
      fields: ["Capacidad del depósito de solución", "Capacidad del depósito de recuperación", "Tensión nominal"] },
    facts: [
      { field: "Capacidad del depósito de solución", value: "157 L", support: "Nilfisk Grey Line Catalogue 2020, p. 63, BR850S, Solution/recovery tank 157/157 l; ancho 810 mm, dimensiones 1550 × 880 × 1350 mm, peso bruto 705 kg. Sin atribuir Ecoflex ni accesorios." },
      { field: "Capacidad del depósito de recuperación", value: "157 L", support: "Misma tabla, recuperación, distinta del depósito de solución." },
      { field: "Tensión nominal", value: "36 V", support: "Misma tabla, Voltage; sin atribuir tipo ni capacidad de batería." }
    ]
  },
  {
    url: "https://www.srsclean.co.uk/wp-content/uploads/2017/02/501bd27cdaf6f5.93582338.pdf", brand: "Eureka", model: "Compact 1150", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "barredora", firstYear: 2005, lastYear: 2005, familyFromSourcePath: true,
      sourceAnchors: {"Altura almacenaje": "1.25 m", "Longitud": "1.54 m", "Anchura": "1.15 m", "Peso": "396 kg", "Motor": "Eléctrico", "Anchura limpieza": "1.15 m"},
      conflictingEvidence: /\b(?:tolva|contenedor|cepillo principal|deposito)\b|\b(?:modificad[oa]|sustituid[oa]|convertid[oa])\b/u },
      fields: ["Anchura de barrido con cepillo principal", "Capacidad de la tolva"] },
    facts: [
      { field: "Anchura de barrido con cepillo principal", value: "700 mm", support: "Eureka s.r.l., folleto Compact 1150, Technical specifications, COMPACT EB y SH: sweeping path only main brush 700 mm. EB eléctrico coincide con peso 396 kg, 1150 × 1545 × 1250 mm y barrido 1150 mm." },
      { field: "Capacidad de la tolva", value: "72 L", support: "Misma tabla, capacity of dirt container, ambas variantes." }
    ]
  },
  {
    url: "https://www.friggeraker.se/se/userfiles/files/teknisk-specifikation/CN201-150602.pdf", brand: "Johnston", model: "CN201", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "barredora", firstYear: 2015, lastYear: 2015, familyFromSourcePath: true,
      sourceAnchors: {"Altura almacenaje": "1.98 m", "Longitud": "4.27 m", "Anchura": "1.31 m", "Peso": "2700 kg", "Motor": "Diésel", "Anchura limpieza": "2.30 m"},
      conflictingEvidence: /\b(?:diametro de cepillo|velocidad de barrido)\b|\b(?:modificad[oa]|sustituid[oa]|convertid[oa])\b/u },
      fields: ["Diámetro de cepillos", "Velocidad de barrido"] },
    facts: [
      { field: "Diámetro de cepillos", value: "850 mm", support: "Johnston CN201, Specification Sheet 02/06/2015, Sweeping Equipment, Brush diameter 850 mm; común a variantes de motor." },
      { field: "Velocidad de barrido", value: "0–16 km/h", support: "Misma ficha, Performance, Sweeping speed; no velocidad de transporte." }
    ]
  },
  {
    url: "https://www.tennantco.com/en_us/1/machines/sweepers/product.6100.sweeper-rider-6100.2000076.html", brand: "Tennant", model: "BCS 6100",
    reviewedOn: "2026-11-21", facts: [
      { field: "Capacidad volumétrica de tolva", value: "85 l", support: "Hopper Capacity: 3 ft³ / 85 L" },
      { field: "Longitud del cepillo principal", value: "560 mm", support: "Main Brush Dimensions: 22 in / 560 mm" }
    ]
  },
  {
    url: "https://www.tennantco.com/es_es/1/machines/vacuums/product.v-wd-72.aspirador-h%C3%BAmedo-seco.1244340.html", brand: "Tennant", model: "APL V-WD-72",
    reviewedOn: "2026-11-21", facts: [
      { field: "Capacidad del depósito", value: "72 l", support: "Depósito grande de 72 l de capacidad" },
      { field: "Longitud de cable de alimentación", value: "8,5 m", support: "Longitud del cable de alimentación | 8,5 m" },
      { field: "Motores de aspiración", value: "3 independientes", support: "Tres motores independientes para un rendimiento fiable" }
    ]
  },
  {
    url: "https://www.tennantco.com/content/dam/tennant/tennantco/products/machines/sweeper%20riders/s16/s16-specifications-en-emea.pdf", brand: "Tennant", model: "BCS S16H Descarga alto",
    reviewedOn: "2026-11-21", facts: [
      { field: "Altura máxima de descarga de la tolva", value: "1570 mm", support: "S16 High Dump | Maximum hopper dump height | 1,570 mm" }
    ]
  },
  {
    url: "https://www.tennantco.com/content/dam/tennant/tennantco/products/machines/sweeper%20riders/S20/s20-specifications-battery-en-noam.pdf", brand: "Tennant", model: "BCS S20 Batería",
    reviewedOn: "2026-11-21", facts: [
      { field: "Longitud del cepillo principal", value: "910 mm", support: "S20 battery | Main brush length (tubular) | 36 in / 910 mm" }
    ]
  },
  {
    url: "https://www.tennantco.com/en_eu/1/machines/scrubbers/product.m-t16.html", brand: null, model: "T16",
    reviewedOn: "2026-11-21", facts: [
      { field: "Anchura de la boquilla de aspiración", value: "1065 mm", support: "Squeegee Width: 42 in / 1065 mm" },
      { field: "Depósito de agua limpia estándar", value: "190 L", support: "Solution Tank Capacity: 50 gal / 190 L (standard)" },
      { field: "Depósito de recuperación", value: "225 L", support: "Recovery Tank Capacity: 60 gal / 225 L" }
    ]
  }
];

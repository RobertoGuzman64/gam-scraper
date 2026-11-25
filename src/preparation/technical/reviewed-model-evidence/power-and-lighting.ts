import type { ReviewedModelDocument } from "./types.js";

export const powerAndLightingDocuments: readonly ReviewedModelDocument[] = [
  {
    url: "https://pramac.com/file/96662", brand: "Pramac", model: "P18000 (STAGE V)", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "grupo-electrogeno", firstYear: 2023, lastYear: 2023,
      sourceAnchors: {"Altura": "1.03 metros", "Longitud": "1.50 m", "Anchura": "0.75 m", "Peso": "475 kg", "Motor": "Diésel", "Potencia": "18 kva"},
      conflictingEvidence: /\b(?:deposito|frecuencia|regimen nominal|velocidad nominal)\b|\b(?:modificad[oa]|sustituid[oa]|convertid[oa])\b/u },
      fields: ["Capacidad del depósito de combustible", "Frecuencia nominal", "Régimen nominal del motor"] },
    facts: [
      { field: "Capacidad del depósito de combustible", value: "51 L", support: "Pramac catálogo Serie P, tabla Datos técnicos diésel 50 Hz, p. 3, P18000: depósito 51 l para ambas versiones; dimensiones 1500 × 754 × 1032 mm y peso 475 kg de la trifásica. No se modifica la potencia anunciada." },
      { field: "Frecuencia nominal", value: "50 Hz", support: "Misma tabla, ambas versiones, corroborada en https://www.pramac.com/es_ES/product?folder=291&product=208063." },
      { field: "Régimen nominal del motor", value: "3000 rpm", support: "Misma tabla, velocidad nominal de funcionamiento, P18000 Stage V." }
    ]
  },
  {
    url: "https://pramac.com/es_ES/product?folder=264&product=11366", brand: "Pramac", model: "GPW45P", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "grupo-electrogeno", firstYear: 2023, lastYear: 2025,
      sourceAnchors: {"Altura": "1.31 metros", "Longitud": "2.20 m", "Anchura": "1.02 m", "Peso": "1017 KG", "Motor": "Diésel", "Potencia": "45 kva"},
      conflictingEvidence: /\b(?:frecuencia|factor de potencia|potencia (?:de emergencia|continua|activa))\b|\b(?:modificad[oa]|sustituid[oa]|convertid[oa])\b/u },
      fields: ["Potencia de emergencia ESP", "Factor de potencia nominal", "Frecuencia nominal"] },
    facts: [
      { field: "Potencia de emergencia ESP", value: "49,5 kVA", support: "Pramac GPW45P/FNE, principales características, ESP 49,5 kVA y PRP 45 kVA; cotejada ficha GPW45P en https://es.scribd.com/document/1026285494/PRAMAC-Generador-GPW45P y dimensiones 2200 × 1020 × 1313 mm y peso 1017 kg en https://www.macfarlanegenerators.com.au/products/49-5kva-pramac-perkins-generator-set-gpw45p-fne." },
      { field: "Factor de potencia nominal", value: "0,8", support: "Mismas tablas GPW45P, factor nominal." },
      { field: "Frecuencia nominal", value: "50 Hz", support: "Mismas tablas GPW45P, frecuencia; no se atribuye tensión." }
    ]
  },
  {
    url: "https://breezemount.net/wp-content/uploads/2019/06/TL-90-Metal-Halide-Lighting-Tower-Spec-sheet.pdf", brand: "Smc", model: "TL90", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "torre-iluminacion", firstYear: 2012, lastYear: 2012,
      sourceAnchors: { "Altura almacenaje": "2.10 m", Longitud: "2.50 m", Anchura: "1.32 m", Peso: "1050 kg", Potencia: "4x1000 W" },
      conflictingEvidence: /\b(?:deposito|frecuencia|potencia (?:continua|del generador)|alternador|modificad[oa]|sustituid[oa]|convertid[oa])\b/u },
      fields: ["Capacidad del depósito de combustible", "Potencia continua del generador", "Frecuencia nominal"] },
    facts: [
      { field: "Capacidad del depósito de combustible", value: "130 L", support: "Morris Site Machinery SMC TL-90, ficha Metal Halide, p. 2, Fuel tank capacity; coincide con el manual Telelight TL90, §3.5 (https://www.manualslib.com/manual/3019074/Smc-Networks-Telelight-Tl90.html?page=12). Versión 4 x 1000 W, transporte 2500 x 1320 x 2100 mm y peso con combustible 1050 kg." },
      { field: "Potencia continua del generador", value: "5 kW", support: "Misma ficha TL-90 Metal Halide, p. 2, Continuous power, corroborada en manual Telelight TL90 §3.5. Potencia del generador, no potencia de lámparas ni potencia de emergencia." },
      { field: "Frecuencia nominal", value: "50 Hz", support: "Misma ficha TL-90 Metal Halide, p. 2, Alternator, 50 Hz; corroborada en manual Telelight TL90 §3.5. No se atribuyen altura opcional de mástil ni autonomía." }
    ]
  },
  {
    url: "https://pramac.com/es_ES/product?folder=264&product=17958", brand: "Pramac", model: "GPW100I_FS2", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "grupo-electrogeno", firstYear: 2023, lastYear: 2023,
      sourceAnchors: { Altura: "1.85 metros", Longitud: "2.76 m", Anchura: "1.12 m", Peso: "1489 kg", Motor: "Diésel", Potencia: "100 kva" },
      conflictingEvidence: /\b(?:frecuencia|factor de potencia|potencia (?:de emergencia|continua|activa)|modificad[oa]|sustituid[oa]|convertid[oa])\b/u },
      fields: ["Potencia de emergencia ESP", "Factor de potencia nominal", "Frecuencia nominal"] },
    facts: [
      { field: "Potencia de emergencia ESP", value: "110 kVA", support: "Pramac GPW100I/FS2, Principales características, ESP 110 kVA y PRP 100 kVA; coincide en la versión 400/230 V (https://www.pramac.com/product?folder=264&product=17959). No se añade una segunda potencia PRP equivalente a la declarada." },
      { field: "Factor de potencia nominal", value: "0,8", support: "Pramac GPW100I/FS2, Principales características, cos φ 0,8 en las versiones 230 V y 400/230 V." },
      { field: "Frecuencia nominal", value: "50 Hz", support: "Pramac GPW100I/FS2, Principales características, frecuencia 50 Hz en las versiones 230 V y 400/230 V. No se atribuye tensión ni opciones de configuración." }
    ]
  }
];

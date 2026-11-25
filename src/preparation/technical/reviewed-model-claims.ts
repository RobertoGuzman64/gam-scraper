import { technicalDocumentClaimSha256 } from "../../contracts/technical-provenance.js";
import type { TechnicalDocumentReference, TechnicalDocumentVerification } from "../../contracts/technical-provenance.js";

import type { EditorialFacts } from "../editorial/core/editorial-facts.js";

type ReviewedModelCompatibility = (Pick<EditorialFacts, "energy" | "workingHeightM" | "lengthM" | "widthM" | "loadCapacityKg"> & {
  readonly family: "plataforma-tijera" | "plataforma-articulada";
  readonly firstYear?: number;
  readonly lastYear?: number;
  readonly advertisedHeightClassM?: number;
}) | (Pick<EditorialFacts, "energy" | "workingHeightM"> & {
  readonly family: "plataforma-articulada";
  readonly invariantGeometry: true;
  readonly firstYear: number;
  readonly lastYear: number;
}) | (Pick<EditorialFacts, "energy" | "loadCapacityKg"> & {
  readonly family: "carretilla-elevadora";
  readonly marketCountry: string;
  readonly invariantUsedLoadCenter?: true;
  readonly firstYear: number;
  readonly lastYear?: number;
  readonly lengthM?: number;
  readonly widthM?: number;
}) | (Pick<EditorialFacts, "energy" | "loadCapacityKg" | "lengthM"> & {
  readonly family: "carretilla-elevadora";
  readonly catalogOffer: true;
  readonly marketCountry: string;
  readonly widthsM: readonly number[];
}) | (Pick<EditorialFacts, "energy" | "loadCapacityKg"> & {
  readonly family: "carretilla-elevadora";
  readonly catalogOffer: true;
  readonly invariantLoadCenter: true;
  readonly marketCountry: string;
  readonly identityWeightKg?: number;
  readonly lengthM?: number;
  readonly voltageV?: number;
}) | {
  readonly family: "grupo-electrogeno" | "torre-iluminacion" | "fregadora" | "barredora" | "compactadora" | "transpaleta" | "plataforma-articulada";
  readonly firstYear: number | null;
  readonly lastYear: number | null;
  readonly anchoredCatalogOffer?: true;
  readonly familyFromSourcePath?: true;
  readonly corroboratingText?: RegExp;
  readonly sourceAnchors: Readonly<Record<string, string>>;
  readonly conflictingEvidence: RegExp;
};

type ReviewedModelReuse = {
  readonly compatibility: ReviewedModelCompatibility;
  readonly fields: readonly string[];
};

type ReviewedModelFact = {
  readonly field: string;
  readonly value: string;
  readonly support: string;
};

type ReviewedModelDocument = {
  readonly url: string;
  readonly brand: string | null;
  readonly model: string;
  readonly reviewedOn: string;
  readonly facts: readonly ReviewedModelFact[];
  readonly reuse?: ReviewedModelReuse;
};

const documents: readonly ReviewedModelDocument[] = [
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
    reuse: { compatibility: { family: "grupo-electrogeno", firstYear: 2023, lastYear: 2023,
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
    url: "https://ctelift.com/es/plataforma-aerea-pick-up-az14/", brand: "CTE", model: "AZ14 PICKUP", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-articulada", firstYear: null, lastYear: null, anchoredCatalogOffer: true,
      sourceAnchors: {"Marca": "CTE", "Modelo": "AZ14 PICKUP", "Longitud": "5900 mm", "Altura": "2700 mm", "Altura de elevación (m)": "13,5 metros", "Capacidad de carga (kg)": "230 KG"},
      corroboratingText: /(?=.*\balcance lateral (?:de )?7[,.]1\s*(?:m\b|metros\b))(?=.*\bhidraulico h\+h\b)/u,
      conflictingEvidence: /^(?:alcance(?: horizontal| lateral)?(?: \(m\))?|sistema de estabilizacion)$|\balcance (?:horizontal|lateral)(?: maximo)?(?: de|:)?\s+(?!7[,.]10?\s*(?:m\b|metros\b))\d+(?:[,.]\d+)?\s*(?:m\b|metros\b)|\b(?:sin estabilizadores|estabilizacion opcional|modificad[oa]|sustituid[oa]|convertid[oa])\b/u },
      fields: ["Alcance horizontal (m)", "Sistema de estabilización"] },
    facts: [
      { field: "Alcance horizontal (m)", value: "7,1 m", support: "CTE AZ14 PICK-UP, tabla Alcance máx. 7,10 m, altura máx. 13,50 m y capacidad 230 kg. Anuncio identifica AZ14 en tabla, título y URL, pero menciona ZED 14 en descripción; solo se recupera el alcance explícito coincidente." },
      { field: "Sistema de estabilización", value: "H+H", support: "Misma ficha AZ14 PICK-UP, estabilizadores H+H, corroborados en descripción del anuncio. No se traslada otra prestación de ZED 14." }
    ]
  },
  {
    url: "https://www.helichina.net/product/1-5-3-8t-h4-series-four-wheel-electric-forklift/", brand: "HELI", model: "CPD18", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 1800,
      marketCountry: "España", invariantUsedLoadCenter: true, firstYear: 2023, lastYear: 2023 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "HELI H4, tabla Parameter, CPD18 1800 kg y 500 mm; ficha H4 de abril 2023 (https://www.heliheftruck.nl/wp-content/uploads/2023/04/H4-series-1.5-3.8t-electric-forklift.pdf), filas 1.04 y 1.05, configuraciones M y S. Coincide con H4 LI-ION (https://www.helichina.net/product/1-5-3-8t-h4-series-four-wheel-li-ion-forklift/) y G2 LI-ION (https://www.helichina.net/product/1-5-3-8t-g2-series-four-wheel-li-ion-forklift/). Solo centro nominal de las variantes de 1800 kg, no capacidad residual ni tipo de batería, tensión, mástil o geometría." }
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
  },
  {
    url: "https://snorkellifts.com/german-debut-for-new-snorkel-electric-scissor-lifts-at-platformers-days/", brand: "SNORKEL", model: "S3219E", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 7.79, advertisedHeightClassM: 8,
      lengthM: 1.78, widthM: 0.81, loadCapacityKg: 250, firstYear: 2016, lastYear: 2018 }, fields: ["Altura de plataforma"] },
    facts: [
      { field: "Altura de plataforma", value: "5,79 m", support: "Snorkel, presentación europea del 2015: S3219E, altura de plataforma 5,79 m, chasis 0,81 m y carga 250 kg. Presentación APEX Asia 2017 confirma longitud 1,78 m, anchura 0,81 m y altura de trabajo 7,79 m (clase comercial 8 m). Ficha CE del fabricante S3219E confirma la misma altura de plataforma. No atribuye dimensiones de cesta ni peso de la unidad." }
    ]
  },
  {
    url: "https://documentacionqr.com/sat/objects/2793/HAULOTTE_COMPACT12_MANUAL_OPERARIO_ES.pdf", brand: "HAULOTTE", model: "COMPACT 12", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 12, advertisedHeightClassM: 12,
      lengthM: 2.48, widthM: 1.2, loadCapacityKg: 300, firstYear: 2013, lastYear: 2013 }, fields: ["Altura de plataforma", "Extensión de plataforma"] },
    facts: [
      { field: "Altura de plataforma", value: "10 m", support: "Haulotte, manual de conducción y mantenimiento COMPACT, p. 16, §2.5.3: altura de piso 10 m, altura de trabajo 12 m, largo con peldaños 2,48 m, ancho 1,20 m y carga nominal 300 kg. Corroborado por el manual de reparación posterior a mayo de 2005, §2.1.3. Excluye la configuración de 320 kg y 9,75 m de altura de plataforma." },
      { field: "Extensión de plataforma", value: "0,92 m", support: "Haulotte, manual de conducción y mantenimiento COMPACT, p. 16, §2.5.3: longitud de extensión 0,92 m; corroborada por el manual de reparación posterior a mayo de 2005, §2.1.3. No atribuye capacidad ni dimensiones de cesta distintas de las declaradas por el vendedor." }
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
    url: "https://www.manitou.com/en-SI/our-machines/forklift-trucks/mi-50-d-st5", brand: "MANITOU", model: "MI50D", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "diésel", loadCapacityKg: 5000,
      marketCountry: "España", firstYear: 2026, lastYear: 2026, lengthM: 3.25, widthM: 1.49 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Manitou MI 50 D ST5, Technical characteristics: 5000 kg y centro de gravedad 500 mm; Dimensions: longitud hasta cara de horquillas 3250 mm, anchura 1490 mm. Identidad MI50D corroborada por ambas cotas, diferenciada de MI 50 LD ST5 (3499 x 1990 mm y 600 mm). Valor nominal del modelo, no capacidad residual ni presencia de horquillas." }
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
    url: "https://www.manualslib.es/manual/389622/Unicarriers-1Q2-Serie.html?page=88", brand: "UNICARRIERS", model: "G1Q2L30Q", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 3000,
      marketCountry: "España", firstYear: 2018, lastYear: 2018 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "UniCarriers 1Q2, manual de instrucciones OM15ES-01Q2Q0, página 88 del visor, especificaciones, columna G1Q2L30Q: 3000 kg y centro de carga 500 mm. Valor nominal, no capacidad residual." }
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
    url: "https://media.prod.shop.jungheinrichcloud.com/PCMSS/en/b0665b4430e512b561a265204b572fbe4f58c3d0.pdf", brand: "JUNGHEINRICH", model: "DFG320S", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "diésel", loadCapacityKg: 2000,
      marketCountry: "España", firstYear: 2013, lastYear: 2020 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Jungheinrich DFG 316s-320s, Technical data VDI 2198, filas 1.5 y 1.6: DFG 320s 2000 kg a 500 mm. Corroborado en ficha del fabricante 09/2013 DFG/TFG 316s/320s, diagrama p. 2 y tabla de datos. Valor nominal, no capacidad residual." }
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
    url: "https://www.geeritsverhuur.be/sites/default/files/2025-09/1_FICHE_JLG_450AJ.pdf", brand: "Jlg", model: "450AJ", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "diésel", workingHeightM: 15.72,
      lengthM: 6.53, widthM: 1.98, loadCapacityKg: 230 }, fields: ["Anchura de plataforma", "Longitud de plumín"] }, facts: [
      { field: "Anchura de plataforma", value: "0,76 m", support: "JLG Europe SL002-ENGLISH, 2003, página 2, columna 450AJ: plataforma 0,76 x 1,83 m; anchura común con la configuración corta de la ficha JLG 3131117 R061208. No atribuye longitud de cesta." },
      { field: "Longitud de plumín", value: "1,24 m", support: "JLG Europe SL002-ENGLISH, 2003, página 2, columna 450AJ: Jib – Overall Length 1.24 m; capacidad 230 kg, longitud 6,53 m, anchura 1,98 m y peso 7100 kg. Altura de plataforma 13,72 m." }
    ]
  },
  {
    url: "https://high-lift.com/wp-content/uploads/2023/09/450A-450AJ-Specs-2012.pdf", brand: "Jlg", model: "450AJ Serie II", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "diésel", workingHeightM: 15.72,
      lengthM: 6.71, widthM: 2.34, loadCapacityKg: 227 }, fields: ["Anchura de plataforma", "Longitud de plumín"] }, facts: [
      { field: "Anchura de plataforma", value: "0,76 m", support: "JLG 450 SERIES II, 3131117 R061208, páginas 1-2: plataforma 0,76 x 1,83 m y opción 0,76 x 1,52 m; anchura común. Corroborada por ficha JLG 450AJ Series II CE https://www.cc-equipment.be/fileadmin/pdf/technical%20sheets/technical%20sheets%20hoogwerkers/Knikhoogwerkers/CC_Heftrucks_fiche_hoogwerker_knikarm_450AJ.pdf" },
      { field: "Longitud de plumín", value: "1,24 m", support: "JLG 450 SERIES II, 3131117 R061208, página 2: Jib (450AJ Only) 1.24 m; capacidad 227 kg, anchura 2,34 m, longitud 6,71 m y peso 6010 kg. Altura de plataforma 13,72 m; misma cota de plumín en la edición CE." }
    ]
  },
  {
    url: "https://logitrans.com/rotator-with-adjustable-box-holders/", brand: "LOGITRANS", model: "ELFRA/SELFRA",
    reviewedOn: "2026-11-21", facts: [
      { field: "Anchura de caja admitida", value: "800–1200 mm", support: "widths between 800 mm and 1200 mm" },
      { field: "Inclinación de cajas", value: "Hasta 180°", support: "Tilts boxes up to 180°" },
      { field: "Velocidad de volteo", value: "Regulable", support: "rotation speed control" }
    ]
  },
  {
    url: "https://logitrans.com/rotator-with-non-adjustable-box-holders/", brand: "LOGITRANS", model: "ELFR/SELFR",
    reviewedOn: "2026-11-21", facts: [
      { field: "Soportes de caja", value: "Fijos, sin regulación de anchura", support: "Rotator with non-adjustable box holders" }
    ]
  },
  {
    url: "https://logitrans.com/electric-logiflex-stacker-inox-ehsi/", brand: "LOGITRANS", model: "EHSI",
    reviewedOn: "2026-11-21", facts: [
      { field: "Accionamiento de elevación", value: "Eléctrico", support: "an electric lift, and manual transport capabilities" }
    ]
  },
  {
    url: "https://logitrans.com/panther-manual-pallet-truck/", brand: "LOGITRANS", model: "Panther",
    reviewedOn: "2026-11-21", facts: [
      { field: "Descenso de carga", value: "Controlado", support: "Gentle and controlled lowering of loads" },
      { field: "Propulsión", value: "Manual", support: "Our manual pallet truck" }
    ]
  },
  {
    url: "https://logitrans.com/US/panther-silent-manual-pallet-truck/", brand: "LOGITRANS", model: "Panther Silent",
    reviewedOn: "2026-11-21", facts: [
      { field: "Material de ruedas", value: "Caucho blando", support: "Soft rubber wheels" },
      { field: "Nivel sonoro de desplazamiento", value: "Inferior a 60 dB(A)", support: "noise levels below 60 dBA" }
    ]
  },
  {
    url: "https://logitrans.com/US/weighing-scale-pallet-truck-wsp-2200/", brand: "LOGITRANS", model: "WSP 2200",
    reviewedOn: "2026-11-21", facts: [
      { field: "Células de pesaje", value: "4", support: "four strong weighing cells" },
      { field: "Precisión del sistema de pesaje", value: "99,95 %", support: "accuracy (99,95%)" },
      { field: "Protección de las células de carga", value: "IP68", support: "IP68 load cells" }
    ]
  },
  {
    url: "https://logitrans.com/panther-manual-pallet-truck-inox-plus-pip/", brand: "LOGITRANS", model: "Panther Inox Plus",
    reviewedOn: "2026-11-21", facts: [
      { field: "Chasis", value: "Resistente a ácidos", support: "Acid-resistant chassis" },
      { field: "Construcción de horquillas", value: "Cerradas", support: "closed forks" }
    ]
  },
  {
    url: "https://www.lgmglifts.com/product/pro-detail-2028.htm", brand: "LGMG", model: "S1012EII",
    reviewedOn: "2026-11-21", facts: [
      { field: "Anchura de plataforma", value: "1,12 m", support: "C-Platform Width | 1.12m" },
      { field: "Capacidad de plataforma", value: "320 kg", support: "Platform Capacity | 320kg" },
      { field: "Extensión de plataforma", value: "0,9 m", support: "H-Extension Deck | 0.9m" },
      { field: "Longitud de plataforma", value: "2,26 m", support: "B-Platform Length | 2.26m" }
    ]
  },
  {
    url: "https://www.lgmglifts.com/product/pro-detail-1027.htm", brand: "LGMG", model: "SR1018D",
    reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "9,7 m", support: "A-Platform Height-Raised | 9.7m" },
      { field: "Anchura (mm)", value: "1,79 m", support: "F-Overall Width | 1.79m" },
      { field: "Capacidad máxima de plataforma", value: "454 kg", support: "Platform Capacity | 454kg" },
      { field: "Extensión de plataforma", value: "1,52 m", support: "H-Extension Deck | 1.52m" }
    ]
  },
  {
    url: "https://www.lgmglifts.com/product/pro-detail-616.htm", brand: "LGMG", model: "A14JE",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal máximo", value: "7,81 m", support: "Horizontal Outreach | 7.81m" },
      { field: "Capacidad de plataforma", value: "230 kg", support: "Platform Capacity | 230 kg" }
    ]
  },
  {
    url: "https://sinoboom.com/content/details_103_125.html", brand: "SINOBOOM", model: "0608ME",
    reviewedOn: "2026-11-21", facts: [
      { field: "Anchura de plataforma", value: "0,76 m", support: "Platform Dimensions(L×W×H) | 1.64m×0.76m×1.1m" },
      { field: "Longitud de plataforma", value: "1,64 m", support: "Platform Dimensions(L×W×H) | 1.64m×0.76m×1.1m" },
      { field: "Capacidad de plataforma", value: "230 kg", support: "Platform capacity | 230 kg" },
      { field: "Extensión máxima de plataforma", value: "0,9 m", support: "Max Horizontal Extension | 0.9m" }
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
    url: "https://manuals.genielift.com/operators/german/97752GR.pdf", brand: "Genie", model: "GR-15",
    reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "4,62 m", support: "GR-15 Maximale Plattformhöhe 4,62 m" },
      { field: "Anchura de la máquina", value: "0,75 m", support: "Breite 75 cm" },
      { field: "Longitud replegada", value: "1,35 m", support: "Länge, eingefahren 1,35 m" }
    ]
  },
  {
    url: "https://manuals.genielift.com/operators/english/114340.pdf", brand: "Genie", model: "Z-45/25J",
    reviewedOn: "2026-11-21", facts: [
      { field: "Anchura de plataforma", value: "0,76 m", support: "Platform dimensions, 6 foot | 1.8 m x 76 cm" },
      { field: "Capacidad máxima de plataforma", value: "227 kg", support: "Maximum load capacity | 227 kg" }
    ]
  },
  {
    url: "https://manuals.genielift.com/operators/english/219413.pdf", brand: "Genie", model: "Z-51/30J",
    reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "15,59 m", support: "Height platform maximum | 15.59 m" },
      { field: "Anchura (mm)", value: "2,29 m", support: "Width standard tires | 2.29 m" },
      { field: "Capacidad máxima de plataforma", value: "227 kg", support: "Maximum load capacity | 227 kg" }
    ]
  },
  {
    url: "https://www.genielift.com/en/aerial-lifts/articulated-boom-lifts/z3422ic", brand: "Genie", model: "Z-34/22",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "6,78 m", support: "Max Horizontal Reach | 6.78 m" },
      { field: "Capacidad máxima de plataforma", value: "227 kg", support: "Platform Capacity | 227 kg" }
    ]
  },
  {
    url: "https://manuals.genielift.com/operators/english/226486.pdf", brand: "Genie", model: "Z135",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal máximo", value: "21,3 m", support: "Horizontal reach maximum | 21.3 m" },
      { field: "Altura máxima de plataforma", value: "41,1 m", support: "Height platform maximum | 41.1 m" },
      { field: "Capacidad máxima de plataforma", value: "272 kg", support: "Maximum load capacity | 272 kg" }
    ]
  },
  {
    url: "https://manuals.genielift.com/operators/english/43650.pdf", brand: "Genie", model: "S85",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal máximo", value: "23,4 m", support: "S-85 Horizontal reach maximum | 23.4 m" },
      { field: "Altura máxima de plataforma", value: "25,9 m", support: "S-85 Height platform maximum | 25.9 m" },
      { field: "Anchura de máquina", value: "2,43 m", support: "S-85 Width | 2.43 m" },
      { field: "Capacidad máxima de plataforma", value: "227 kg", support: "S-85 Maximum load capacity | 227 kg" }
    ]
  },
  {
    url: "https://manuals.genielift.com/Operators/english/114305.pdf", brand: "Genie", model: "S-65",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "17,1 m", support: "S-65 Horizontal reach maximum | 17.1m" },
      { field: "Altura de plataforma", value: "19,8 m", support: "S-65 Height platform maximum | 19.8m" },
      { field: "Anchura (mm)", value: "2,49 m", support: "S-65 Width | 2.49m" },
      { field: "Capacidad máxima de plataforma", value: "227 kg", support: "S-65 Maximum load capacity | 227kg" }
    ]
  },
  {
    url: "https://logitrans.com/manual-logiflex-stacker-lf/", brand: "LOGITRANS", model: "Logiflex M",
    reviewedOn: "2026-11-21", facts: [
      { field: "Accionamiento de elevación", value: "Hidráulico manual", support: "Manual hydraulic pump ensures controlled and effortless lifting" },
      { field: "Freno de estacionamiento", value: "Incorporado", support: "Equipped with parking brake for secure positioning" },
      { field: "Propulsión", value: "Manual", support: "This model is equipped with manual propulsion and pumping (for lifting and lowering)" }
    ]
  },
  {
    url: "https://logitrans.com/US/manual-logiflex-stacker-with-straddle-legs-lfs/", brand: "LOGITRANS", model: "Logiflex MS",
    reviewedOn: "2026-11-21", facts: [
      { field: "Accionamiento de elevación", value: "Hidráulico manual", support: "Manual hydraulic pump ensures controlled and effortless lifting" },
      { field: "Patas envolventes", value: "Para palés cerrados", support: "this stacker can handle closed pallets as well" },
      { field: "Propulsión", value: "Manual", support: "This model is supplied with manual propulsion and pumping (for lifting and lowering)" }
    ]
  },
  {
    url: "https://logitrans.com/electric-logiflex-stacker-elf/", brand: "LOGITRANS", model: "Logiflex SE",
    reviewedOn: "2026-11-21", facts: [
      { field: "Dirección", value: "Asistida en ambas ruedas", support: "Assisted steering on both wheels" },
      { field: "Propulsión", value: "Manual", support: "Manual propulsion" }
    ]
  },
  {
    url: "https://logitrans.com/electric-logiflex-stacker-with-straddle-legs-elfs/", brand: "LOGITRANS", model: "Logiflex SE-ARTICULADAS",
    reviewedOn: "2026-11-21", facts: [
      { field: "Dirección", value: "Asistida en ambas ruedas", support: "Assisted steering on both wheels" },
      { field: "Propulsión", value: "Manual", support: "Manual propulsion" }
    ]
  },
  {
    url: "https://logitrans.com/manual-logiflex-stacker-inox-hsi-and-manual-logiflex-stacker-with-straddle-legs-inox-hssi/", brand: "LOGITRANS", model: "HSI HSSI",
    reviewedOn: "2026-11-21", facts: [
      { field: "Accionamiento de elevación", value: "Manual", support: "Manual Logiflex Stacker INOX (HSI and HSSI)" }
    ]
  },
  {
    url: "https://logitrans.com/electric-logiflex-stacker-with-straddle-legs-inox-ehssi/", brand: "LOGITRANS", model: "EHSS",
    reviewedOn: "2026-11-21", facts: [
      { field: "Accionamiento de elevación", value: "Eléctrico", support: "Electric Logiflex Stacker with Straddle Legs INOX (EHSSI)" }
    ]
  },
  {
    url: "https://logitrans.com/solutions/pallet-tansportation/panther-maxi-fully-powered-pallet-truck/", brand: "LOGITRANS", model: "Panther Maxi",
    reviewedOn: "2026-11-21", facts: [
      { field: "Conducción con timón vertical", value: "Permitida", support: "Upright handle operation" },
      { field: "Controlador de tracción", value: "Curtis ACF2C", support: "ACF2C-technology (Curtis Controller)" }
    ]
  },
  {
    url: "https://logitrans.com/stainless-steel-highlifters/", brand: "LOGITRANS", model: "HLI",
    reviewedOn: "2026-11-21", facts: [
      { field: "Accionamiento de elevación", value: "Manual", support: "Manual highlifter Inox (HLI), manual lifting" }
    ]
  },
  {
    url: "https://logitrans.com/manual-highlifter-inox-plus-hlip/", brand: "LOGITRANS", model: "HLI Plus",
    reviewedOn: "2026-11-21", facts: [
      { field: "Accionamiento de elevación", value: "Manual", support: "Manual highlifter Inox Plus (HLIP)" }
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
    url: "https://www.lgmglifts.com/upload/file/2025/04/lgmg-scissorlift-en-S1012E-2.pdf", brand: "LGMG", model: "S1012E-2",
    reviewedOn: "2026-11-21", facts: [
      { field: "Anchura de plataforma", value: "1,12 m", support: "Platform Width | 1.12m" },
      { field: "Capacidad de plataforma", value: "320 kg", support: "Platform Capacity | 320kg" },
      { field: "Extensión de plataforma", value: "0,9 m", support: "Extension Deck | 0.9m" },
      { field: "Longitud de plataforma", value: "2,26 m", support: "Platform Length | 2.26m" }
    ]
  },
  {
    url: "https://www.megaltura.com/wp-content/uploads/2022/08/JLG-2630-ES.pdf", brand: "JLG", model: "2630ES",
    reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "7,77 m", support: "Altura de plataforma (Elevada) | 7,77 m" },
      { field: "Anchura (mm)", value: "0,76 m", support: "Anchura total | 0,76 m" },
      { field: "Distancia entre ejes (mm)", value: "1,88 m", support: "Distancia entre ejes | 1,88 m" },
      { field: "Extensión de plataforma", value: "0,9 m", support: "Lateral extensible de 0,90 m" }
    ]
  },
  {
    url: "https://www.skyjack.com/sites/default/files/specifications/ENEU-SJ9241-50RT_0.pdf", brand: "Skyjack", model: "SJ9250",
    reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "15,24 m", support: "SJ9250 RT | Raised Platform Height | 15.24 m" },
      { field: "Anchura (mm)", value: "2,34 m", support: "SJ9250 RT | Overall Width | 2.34 m" },
      { field: "Anchura de plataforma", value: "1,88 m", support: "SJ9250 RT | Platform Width (Inside Dimension) | 1.88 m" }
    ]
  },
  {
    url: "https://www.grarasulin.com/wp-content/uploads/2023/05/ha20px_uk_bda0a.pdf", brand: "Haulotte", model: "HA20PX",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "13,5 m", support: "HA20 PX | Horizontal outreach | 13.5 m" },
      { field: "Altura de plataforma", value: "18,65 m", support: "HA20 PX | Platform height | 18.65 m" },
      { field: "Anchura (mm)", value: "2,38 m", support: "HA20 PX | Width | 2.38 m" },
      { field: "Capacidad máxima de plataforma", value: "230 kg", support: "HA20 PX | Lift capacity | 230 kg" }
    ]
  },
  {
    url: "https://www.colle.eu/media/3955/genie-s65-en.pdf", brand: "Genie", model: "S-65",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal máximo", value: "17,1 m", support: "S-65 | Horizontal reach maximum | 17.10 m" },
      { field: "Altura máxima de plataforma", value: "19,8 m", support: "S-65 | Platform height maximum | 19.80 m" },
      { field: "Capacidad máxima de plataforma", value: "227 kg", support: "S-65 | Lift capacity | 227 kg" }
    ]
  },
  {
    url: "https://www.jlg.com/en/equipment/boom-lifts/telescopic/engine-powered/800-series/860sj", brand: "JLG", model: "860SJ",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "22,86 m", support: "860SJ | Horizontal Outreach | 75-ft / 22.86-m" },
      { field: "Altura de plataforma", value: "26,21 m", support: "860SJ | Platform Height (Elevated) | 86-ft / 26.21-m" }
    ]
  },
  {
    url: "https://logitrans.com/rotator-with-non-adjustable-box-holders/", brand: "LOGITRANS", model: "ELFR/SELFR",
    reviewedOn: "2026-11-21", facts: [
      { field: "Soportes necesarios para más de 500 kg", value: "Dos", support: "An extra set of box holders is necessary when rotating more than 45 degrees, with more than 500 kg" }
    ]
  },
  {
    url: "https://logitrans.com/logiq-200-quarter-pallet-lifter/", brand: "LOGITRANS", model: "LogiQ 200/300",
    reviewedOn: "2026-11-21", facts: [
      { field: "Propulsión", value: "Manual", support: "The small, manual pallet lifter is easy to operate in crowded and compact areas" }
    ]
  },
  {
    url: "https://manualzilla.com/doc/6014943/from-sn-951-to-6289--z-30-20n--pn-43651-", brand: "Genie", model: "Z-30/20N",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "6,4 m", support: "Z-30/20N | Horizontal reach maximum | 21 ft / 6.4 m" },
      { field: "Altura de plataforma", value: "9,1 m", support: "Z-30/20N | Height platform maximum | 30 ft / 9.1 m" },
      { field: "Anchura (mm)", value: "1,2 m", support: "Z-30/20N | Width | 3 ft 11 in / 1.2 m" },
      { field: "Capacidad máxima de plataforma", value: "227 kg", support: "Z-30/20N | Maximum load capacity | 227 kg" }
    ]
  },
  {
    url: "https://www.lectura-specs.es/es/modelo/plataformas-elevadoras/plataformas-elevadoras-articuladas-plataformas-articuladas-de-ruedas-manitou/150-aetj-c-1036275", brand: "Manitou", model: "150AETJC",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "7,6 m", support: "Manitou 150 AETJ C | Max. Alcance lateral | 7.6 m" },
      { field: "Anchura (mm)", value: "1,5 m", support: "Manitou 150 AETJ C | Anchura transporte | 1.5 m" },
      { field: "Capacidad máxima de plataforma", value: "200 kg", support: "Manitou 150 AETJ C | Carga útil | 200 kg" }
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
    url: "https://www.mercaeleva.com/pdf/fichas/2022/merca-eleva-tijera-electrica-lgmg-as1413.pdf", brand: "LGMG", model: "AS1413",
    reviewedOn: "2026-11-21", facts: [
      { field: "Anchura de plataforma", value: "1,12 m", support: "AS1413 | Anchura de la plataforma | 1,12 m" },
      { field: "Capacidad de plataforma", value: "320 kg", support: "AS1413 | Capacidad de la plataforma | 320 kg" },
      { field: "Extensión de plataforma", value: "0,9 m", support: "AS1413 | Cubierta de extensión | 0,9 m" },
      { field: "Longitud de plataforma", value: "2,64 m", support: "AS1413 | Longitud de la plataforma | 2,64 m" }
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
    url: "https://www.lectura-specs.com/en/model/aerial-work-platform/articulating-boom-lifts-wheeled-articulating-boom-lifts-manitou/200-atj-1161009", brand: "Manitou", model: "200ATJ",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "12 m", support: "200 ATJ | Max. reach horizontal | 12 m" },
      { field: "Anchura (mm)", value: "2,4 m", support: "200 ATJ | Transport width | 2.4 m" },
      { field: "Capacidad máxima de plataforma", value: "230 kg", support: "200 ATJ | Net load | 230 kg" }
    ]
  },
  {
    url: "https://cdnc.heyzine.com/flip-book/pdf/3bf89898f6e750b3a716118e3b59d30cf09fe308-1.pdf", brand: "JLG", model: "SL203-204",
    reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma según catálogo técnico", value: "20,30 m", support: "JLG SL203-204 | Altura plataforma | 20,30 m" },
      { field: "Anchura según catálogo técnico", value: "2,40 m", support: "JLG SL203-204 | Ancho | 2,40 m" },
      { field: "Capacidad de carga de plataforma según catálogo técnico", value: "750 kg", support: "JLG SL203-204 | Capacidad de carga | 750 kg" },
      { field: "Dimensiones de plataforma según catálogo técnico", value: "4,35 x 2,30 m", support: "JLG SL203-204 | Medidas plataforma | 4,35 x 2,30 m" },
      { field: "Longitud según catálogo técnico", value: "4,80 m", support: "JLG SL203-204 | Longitud | 4,80 m" }
    ]
  },
  {
    url: "https://www.mateco.es/fileadmin/user_upload/Guia-de-alquiler-2019.pdf", brand: "Genie", model: "Z-30/20NRJ",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "6,25 m", support: "GENIE Z-30/20NRJ | Alcance horizontal | 6,25 m" },
      { field: "Altura de plataforma", value: "8,89 m", support: "GENIE Z-30/20NRJ | Altura plataforma | 8,89 m" },
      { field: "Anchura (mm)", value: "1,19 m", support: "GENIE Z-30/20NRJ | Dimensiones transporte | Ancho 1,19 m" },
      { field: "Capacidad máxima de plataforma", value: "227 kg", support: "GENIE Z-30/20NRJ | Capacidad plataforma | 227 kg" }
    ]
  },
  {
    url: "https://www.manualslib.com/manual/1277304/Jlg-1350sjp.html", brand: "JLG", model: "1350 SJP",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal máximo sin restricción de carga", value: "24,4 m", support: "1350SJP | Max Horizontal Reach (unrestricted) | 80 ft / 24.4 m" },
      { field: "Altura de plataforma", value: "41,2 m", support: "1350SJP | Maximum Platform Height | 135 ft / 41.2 m" },
      { field: "Anchura con ejes recogidos", value: "2,49 m", support: "1350SJP | Width (Axles Retracted) | 8 ft 2 in / 2.49 m" },
      { field: "Capacidad de plataforma sin restricciones", value: "227 kg", support: "1350SJP | Platform Capacity (Unrestricted) | 500 lb / 227 kg" }
    ]
  },
  {
    url: "https://www.manualslib.com/manual/2197948/Littium-Ibiza-Titanium.html?page=20", brand: "LITTIUM", model: "Ibiza Titanium",
    reviewedOn: "2026-11-21", facts: [
      { field: "Carga máxima admitida", value: "120 kg", support: "PESO 20.5 KG (BATERÍA INCLUIDA) – CHASIS DE ALUMINIO. CARGA MÁXIMA 120 KG" },
      { field: "Peso con batería", value: "20,5 kg", support: "PESO 20.5 KG (BATERÍA INCLUIDA)" },
      { field: "Potencia del motor", value: "250 W", support: "POTENCIA 250W" },
      { field: "Tensión nominal del motor", value: "36 V", support: "VOLTAJE 36V EFICIENCIA 80%" },
      { field: "Velocidad máxima de asistencia", value: "25 km/h", support: "VELOCIDAD ASISTIDA HASTA 25 KM/H" }
    ]
  },
  {
    url: "https://www.bravi-platforms.com/wp-content/uploads/2022/08/PERI-SKYDECK_EN.pdf", brand: "BRAVI", model: "SKY DECK",
    reviewedOn: "2026-11-21", facts: [
      { field: "Dimensiones del panel admitido", value: "1500 x 750 x 120 mm", support: "Panel size 1500 x 750 x 120 mm" },
      { field: "Montaje del soporte", value: "Sin herramientas", support: "tool-free setup" },
      { field: "Número máximo de soportes por Leonardo HD", value: "3", support: "three panel holders can be mounted on one Leonardo HD" },
      { field: "Peso neto del portapaneles", value: "4,2 kg", support: "total weight of only 4.2kg (9.25 lbs)" }
    ]
  },
  {
    url: "https://www.zeromotorcycle.eu/en/motorcycle/ds/", brand: "ZERO", model: "DS 14",
    reviewedOn: "2026-11-21", facts: [
      { field: "Altura del asiento", value: "843 mm", support: "Seat height 843 mm" },
      { field: "Par motor máximo del modelo", value: "109 Nm", support: "Peak torque 109Nm" },
      { field: "Peso en orden de marcha del modelo", value: "187 kg", support: "Curb weight 187 kg" }
    ]
  },
  {
    url: "https://sitecore.jlg.com/dfsmedia/e4042b10c9ce4595b4cc059f1299f079/140840-source", brand: "JLG", model: "E600JP",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "13,54 m", support: "E600JP/M600JP Horizontal Outreach 44 ft 5 in. 13.54 m" },
      { field: "Altura de plataforma", value: "18,39 m", support: "E600JP/M600JP Platform Height 66 ft 4 in. 18.39 m" },
      { field: "Capacidad máxima de plataforma", value: "227 kg", support: "Platform Capacity 500 lb 227 kg" }
    ]
  },
  {
    url: "https://sitecore.jlg.com/dfsmedia/e4042b10c9ce4595b4cc059f1299f079/142288-source", brand: "JLG", model: "800AJ",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "15,8 m", support: "800AJ Horizontal Outreach 51 ft 10 in. 15.8 m" },
      { field: "Altura de plataforma", value: "24,38 m", support: "800AJ Platform Height 80 ft 24.38 m" }
    ]
  },
  {
    url: "https://www.jlg.com/en/equipment/boom-lifts/telescopic/engine-powered/800-series/860sj", brand: "JLG", model: "860SJ",
    reviewedOn: "2026-11-21", facts: [
      { field: "Anchura (mm)", value: "2,49 m", support: "860SJ Overall Width 2.49 m" },
      { field: "Capacidad de plataforma sin restricciones", value: "230 kg", support: "860SJ Platform Capacity - Unrestricted 230 kg" }
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
    url: "https://logitrans.com/fully-powered-logiflex-stacker-self-maxi/", brand: "LOGITRANS", model: "Self Maxi",
    reviewedOn: "2026-11-21", facts: [
      { field: "Controlador de tracción", value: "Curtis (CA)", support: "With the Curtis Controller you can easily pre-set speed, acceleration and deceleration" }
    ]
  },
  {
    url: "https://logitrans.com/fully-powered-logiflex-stacker-with-straddle-legs-selfs-maxi/", brand: "LOGITRANS", model: "Self Maxi S",
    reviewedOn: "2026-11-21", facts: [
      { field: "Controlador de tracción", value: "Curtis (CA)", support: "With the Curtis Controller you can easily pre-set speed, acceleration and deceleration" }
    ]
  },
  {
    url: "https://cpslift.com/access-platforms/cte-traccess-platforms/traccess-170-e/", brand: "CTE", model: "TRACCESS 170E",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "7,5 m", support: "Max Outreach | 7.5 m" },
      { field: "Rotación de torreta", value: "330°", support: "Turret Rotation | 330º" }
    ]
  },
  {
    url: "https://cpslift.com/access-platforms/cte-traccess-platforms/traccess-230/", brand: "CTE", model: "TRACCESS 230",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "12 m", support: "Max Outreach | 12 m" },
      { field: "Anchura en transporte", value: "780 mm", support: "Transport Dimensions (L x W x H) | 5337 x 780 x 2010 mm" }
    ]
  },
  {
    url: "https://jlg.ru/upload/iblock/a55/a55ac022eb564236eb1714d950c513c3.pdf", brand: "JLG", model: "1250AJP",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "19,25 m", support: "1250AJP | Horizontal Outreach | 19.25 m" },
      { field: "Altura de plataforma", value: "38,3 m", support: "1250AJP | Platform Height | 38.30 m" },
      { field: "Anchura con ejes recogidos", value: "2,49 m", support: "1250AJP | Overall Width (Axles Retracted) | 2.49 m" },
      { field: "Longitud (mm)", value: "11,46 m", support: "1250AJP | Stowed Length | 11.46 m (transport position)" }
    ]
  },
  {
    url: "https://www.dragon-access.co.uk/niftylift-hr12/", brand: "Niftylift", model: "HR12NDE",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "6,1 m", support: "Niftylift HR12 NDE | Max. Outreach | 6.1m" },
      { field: "Capacidad máxima de plataforma", value: "200 kg", support: "Niftylift HR12 NDE | Basket Capacity | 200kg" }
    ]
  },
  {
    url: "https://www.colle.eu/en/rent/working-at-heights/aerial-lifts/scissor-lifts/holland-lift-n165el12/", brand: "Hollandlift", model: "N-165EL12",
    reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "16,5 m", support: "Holland Lift N165EL12 | Platform height | 16,50 m" },
      { field: "Capacidad máxima de plataforma", value: "500 kg", support: "Holland Lift N165EL12 | Platform capacity | 500 kg" }
    ]
  },
  {
    url: "https://www.lectura-specs.com/en/model/aerial-work-platform/articulating-boom-lifts-trailer-mounted-articulating-boom-lifts-oil-steel/snake-189-11697682", brand: "Oil & Steel", model: "SNAKE 189",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "9,2 m", support: "Snake 189 Oil & Steel | Max. Reach horizontal | 9.2 m" },
      { field: "Capacidad máxima de plataforma", value: "225 kg", support: "Snake 189 Oil & Steel | Net load | 225 kg" }
    ]
  },
  {
    url: "https://www.lectura-specs.com/en/model/forklifts/telehandlers-jlg/4014-ps-1152518", brand: "JLG", model: "4014PS",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "9,2 m", support: "4014 PS JLG | Max. Reach horizontal | 9.2 m" },
      { field: "Anchura de transporte", value: "2,43 m", support: "4014 PS JLG | Transport width | 2.43 m" },
      { field: "Longitud de transporte", value: "6,32 m", support: "4014 PS JLG | Transport length | 6.32 m" }
    ]
  },
  {
    url: "https://www.manualslib.mx/manual/359967/Jlg-Liftlux-153-12.html?page=64", brand: "JLG", model: "153-12",
    reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "15,3 m", support: "LIFTLUX 153-12 | Altura máxima de la plataforma | 15,3 m" },
      { field: "Capacidad máxima de plataforma", value: "500 kg", support: "LIFTLUX 153-12 | Capacidad máxima de carga, plataforma principal | 500 kg" }
    ]
  },
  {
    url: "https://www.tvicranes.com/es/paginas/alquiler", brand: "Oil & Steel", model: "SCORPION 1812",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "12 m", support: "Oil & Steel Scorpion 1812 | Alcance máximo de trabajo | 12 m" },
      { field: "Anchura de plataforma", value: "0,7 m", support: "Oil & Steel Scorpion 1812 | Dimensiones de la carga de aluminio | 1400 x 700 x h 1100 mm" }
    ]
  },
  {
    url: "https://www.manualslib.com/manual/2589077/Bravi-Platforms-Solo-Gyps.html", brand: "BRAVI", model: "SOLO GYPS",
    reviewedOn: "2026-11-21", facts: [
      { field: "Capacidad del elevador de paneles", value: "40 kg", support: "SOLO GYPS | LOAD RATING | 40 Kg (89 Lbs)" },
      { field: "Tamaño máximo del panel", value: "3,65 x 1,20 m", support: "SOLO GYPS | DRYWALL PANEL SIZE CAPACITY | 365 cm x 120 cm" }
    ]
  },
  {
    url: "https://www.gregorypoolelift.com/new-equipment/aerial-lifts/3394rt/", brand: "JLG", model: "3394RT",
    reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "10,06 m", support: "JLG 3394RT | Platform Height | 10.06 m" },
      { field: "Anchura (mm)", value: "2,39 m", support: "JLG 3394RT | Machine Width | 2.39 m" },
      { field: "Anchura de plataforma", value: "2,18 m", support: "JLG 3394RT | Platform Width | 2.18 m" },
      { field: "Longitud de plataforma", value: "3,81 m", support: "JLG 3394RT | Platform Length | 3.81 m" }
    ]
  },
  {
    url: "https://www.lectura-specs.es/es/modelo/plataformas-elevadoras/plataformas-elevadoras-articuladas-plataformas-articuladas-de-ruedas-manitou/160-atj-11680545", brand: "Manitou", model: "160ATJ",
    reviewedOn: "2026-11-21", facts: [
      { field: "Anchura (mm)", value: "2,30 m", support: "Manitou 160 ATJ | Transport width | 2.3 m" },
      { field: "Anchura de plataforma", value: "0,8 m", support: "Manitou 160 ATJ | Platform width | 0.8 m" },
      { field: "Capacidad máxima de plataforma", value: "230 kg", support: "Manitou 160 ATJ | Platform capacity | 230 kg" },
      { field: "Longitud de plataforma", value: "1,80 m", support: "Manitou 160 ATJ | Platform length | 1.8 m" }
    ]
  },
  {
    url: "https://www.lectura-specs.es/es/modelo/plataformas-elevadoras/plataformas-telescopicas/plataformas-telescopicas-de-ruedas-jlg/660sj-1157114", brand: "JLG", model: "660SJ",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "17,3 m", support: "JLG 660SJ | Max. Reach horizontal | 17.3 m" },
      { field: "Anchura (mm)", value: "2,49 m", support: "JLG 660SJ | Transport width | 2.49 m" },
      { field: "Capacidad máxima de plataforma", value: "230 kg", support: "JLG 660SJ | Net load | 230 kg" }
    ]
  },
  {
    url: "https://www.gtaccess.co.uk/machine/genie-s125", brand: "Genie", model: "S-125",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "24,38 m", support: "Genie S-125 | Max. horizontal outreach | 24.38 m" },
      { field: "Capacidad máxima de plataforma", value: "227 kg", support: "Genie S-125 | Safe working load | 227 kg" }
    ]
  },
  {
    url: "https://www.afi-rentals.co.uk/news/wilson-access-continues-fleet-investment-with-four-new-cte-zed-213-jhv-truck-mounts", brand: "CTE", model: "ZED 21.3 JHV",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "10 m", support: "CTE ZED 21.3 JHV | Horizontal outreach | 10 m" }
    ]
  },

  {
    url: "https://logitrans.com/fully-powered-logiflex-stacker-self-maxi/", brand: "LOGITRANS", model: "Self Maxi",
    reviewedOn: "2026-11-21", facts: [
      { field: "Conducción con timón vertical", value: "Permitida", support: "Logitrans SELF MAXI | Permite operar con el timón en posición vertical | https://logitrans.com/media/2344/self_maxi_es_200_v1.pdf" }
    ]
  },
  {
    url: "https://logitrans.com/fully-powered-logiflex-stacker-with-straddle-legs-selfs-maxi/", brand: "LOGITRANS", model: "Self Maxi S",
    reviewedOn: "2026-11-21", facts: [
      { field: "Conducción con timón vertical", value: "Permitida", support: "Logitrans SELFS MAXI | Possible to operate with the handle upright | https://static.machinetools.com/uploads/4731764/selfs_maxi_en.pdf" }
    ]
  },
  {
    url: "https://www.howardhandling.co.uk/logitrans-reel-loader-manual-reel-lifter-and-positioner-500kg-48", brand: "LOGITRANS", model: "RL 500",
    reviewedOn: "2026-11-21", facts: [
      { field: "Recorrido de elevación", value: "800 mm", support: "RL500 | Lifting height h3 | 800 mm; altura inicial 250 mm, final 1050 mm | https://logitrans.com/media/2392/reel_lifter_72.pdf" }
    ]
  },
  {
    url: "https://logitrans.com/US/panther-silent-manual-pallet-truck/", brand: "LOGITRANS", model: "Panther Silent",
    reviewedOn: "2026-11-21", facts: [
      { field: "Sistema de elevación", value: "Elevación rápida permanente", support: "Panther Silent | Panther Silent has permanent quick lift | https://logitrans.com/media/3595/product_spec_sheets_2022_3.pdf" }
    ]
  },
  {
    url: "https://logitrans.com/panther-manual-pallet-truck-inox-plus-pip/", brand: "LOGITRANS", model: "Panther Inox Plus",
    reviewedOn: "2026-11-21", facts: [
      { field: "Timón y componentes de elevación", value: "Acero inoxidable", support: "Panther Inox Plus | Stainless handle, wheel forks, lifting arm and thrust plate | https://logitrans.com/media/3595/product_spec_sheets_2022_3.pdf" }
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
    url: "https://logitrans.com/electric-logitilt/", brand: "LOGITRANS", model: "Logitilt LT",
    reviewedOn: "2026-11-21", facts: [
      { field: "Recorrido de elevación", value: "275 mm", support: "LT 1001 | Lifting height h3 | 275 mm" },
      { field: "Altura de trabajo con caja inclinada", value: "750–950 mm", support: "LT 1001 | Height, tilted ht | 750-950 mm" }
    ]
  },
  {
    url: "https://logitrans.com/electric-logitilt-with-straddle-legs/", brand: "LOGITRANS", model: "Logitilt LTS",
    reviewedOn: "2026-11-21", facts: [
      { field: "Recorrido de elevación", value: "275 mm", support: "LTS 1001 | Lifting height h3 | 275 mm" },
      { field: "Altura de trabajo con caja inclinada", value: "750–950 mm", support: "LTS 1001 | Height, tilted ht | 750-950 mm" }
    ]
  },
  {
    url: "https://logitrans.com/logiq-200-quarter-pallet-lifter/", brand: "LOGITRANS", model: "LogiQ 200/300",
    reviewedOn: "2026-11-21", facts: [
      { field: "Longitud de horquillas", value: "600 mm", support: "LQHM 200 / LQHM 300 | Gabellänge l | 600 mm" },
      { field: "Altura mínima de horquillas", value: "85 mm", support: "LQHM 200 / LQHM 300 | Einfahrhöhe h13 | 85 mm" }
    ]
  },
  {
    url: "https://logitrans.com/electric-logitilt-inox-lti/", brand: "LOGITRANS", model: "Logitilt LTI",
    reviewedOn: "2026-11-21", facts: [
      { field: "Recorrido de elevación", value: "275 mm", support: "Logitilt LTI 1001 | Lifting height h3 | 275 mm" },
      { field: "Altura de trabajo con caja inclinada", value: "750–950 mm", support: "Logitilt LTI 1001 | Height, tilted ht | 750-950 mm" }
    ]
  },
  {
    url: "https://logitrans.com/media/3839/lm1500_us_72_v2.pdf", brand: "LOGITRANS", model: "Mover",
    reviewedOn: "2026-11-21", facts: [
      { field: "Acceso del operador", value: "Mediante código PIN", support: "Logitrans Mover | The handle has integrated PIN code panel" },
      { field: "Panel de control", value: "Pantalla LCD con estado de batería", support: "Logitrans Mover | LCD display with status indication" }
    ]
  },
  {
    url: "https://www.tennantco.com/en_eu/1/machines/scrubbers/product.m-t16.html", brand: null, model: "T16",
    reviewedOn: "2026-11-21", facts: [
      { field: "Anchura de la boquilla de aspiración", value: "1065 mm", support: "Squeegee Width: 42 in / 1065 mm" },
      { field: "Depósito de agua limpia estándar", value: "190 L", support: "Solution Tank Capacity: 50 gal / 190 L (standard)" },
      { field: "Depósito de recuperación", value: "225 L", support: "Recovery Tank Capacity: 60 gal / 225 L" }
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
    url: "https://www.auto-data.net/es/audi-cabriolet-b3-8g-2.6-v6-150hp-4251", brand: null, model: "6 CABRIO 80 2",
    reviewedOn: "2026-11-21", facts: [
      { field: "Cilindrada del motor", value: "2598 cm³", support: "2598 cm³" },
      { field: "Par motor máximo", value: "225 Nm", support: "150 CV, 225 Nm" },
      { field: "Potencia máxima del motor", value: "150 CV", support: "150 CV, 225 Nm" },
      { field: "Tipo de tracción", value: "Delantera", support: "Tracción delantera" }
    ]
  },
  {
    url: "https://www.carandclassic.com/car/C1956678", brand: null, model: "304 S CABRIOLET",
    reviewedOn: "2026-11-21", facts: [
      { field: "Caja de cambios", value: "Manual de 4 velocidades", support: "1972 Peugeot 304 S Cabriolet | Manual, 4 speed | 4-speed front synchronised gearbox" },
      { field: "Cilindrada del motor", value: "1288 cm³", support: "1972 Peugeot 304 S Cabriolet | Displacement: 1,288 cc" },
      { field: "Potencia máxima DIN", value: "74,5 CV", support: "1972 Peugeot 304 S Cabriolet | DIN: 74.5 hp at 6,000 rpm" },
      { field: "Tipo de tracción", value: "Delantera", support: "1972 Peugeot 304 Cabriolet S | Front-wheel drive | https://www.oldtimerfarm.be/en/collection-cars-for-sale/6301/peugeot-304s-cabriolet-72.php" }
    ]
  },
  {
    url: "https://www.equipostrex.com/chi/producto/plataforma-elevadora-snake-2010-plus/", brand: "Oil & Steel", model: "SNAKE 2010 PLUS",
    reviewedOn: "2026-11-21", facts: [
      { field: "Anchura de plataforma", value: "0,7 m", support: "Snake 2010 Plus | Plataforma | 1400 x 700 x h 1100 mm" },
      { field: "Longitud de plataforma", value: "1,4 m", support: "Snake 2010 Plus | Plataforma | 1400 x 700 x h 1100 mm" }
    ]
  },
  {
    url: "https://www.lectura-specs.com/en/model/aerial-work-platform/articulating-boom-lifts-wheeled-articulating-boom-lifts-manitou/200-atj-1161009", brand: "Manitou", model: "200ATJ",
    reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "18,28 m", support: "Manitou 200 ATJ | Platform height | 18,28 m | https://www.colle.eu/en/rent/working-at-heights/aerial-lifts/articulating-boom-lifts/manitou-200-atj/" }
    ]
  },
  {
    url: "https://sitecore.jlg.com/dfsmedia/e4042b10c9ce4595b4cc059f1299f079/140840-source", brand: "JLG", model: "E600JP",
    reviewedOn: "2026-11-21", facts: [
      { field: "Anchura (mm)", value: "2,42 m", support: "JLG E600JP | Anchura transporte | 2.42 m | https://www.lectura-specs.es/es/modelo/plataformas-elevadoras/plataformas-telescopicas-plataformas-telescopicas-de-ruedas-jlg/e600jp-998943" }
    ]
  },
  {
    url: "https://sitecore.jlg.com/dfsmedia/e4042b10c9ce4595b4cc059f1299f079/142288-source", brand: "JLG", model: "800AJ",
    reviewedOn: "2026-11-21", facts: [
      { field: "Anchura (mm)", value: "2,44 m", support: "JLG 800AJ | Overall Width | 2.44 m | https://www.spiderliftasia.com/products/boom-lift-jlg-800aj/" },
      { field: "Capacidad máxima de plataforma", value: "230 kg", support: "JLG 800AJ | Platform Capacity - Unrestricted | 230 kg | https://www.spiderliftasia.com/products/boom-lift-jlg-800aj/" }
    ]
  },
  {
    url: "https://www.linde-mh.es/es/Productos/Transpaletas/T14-T20/",
    brand: "Linde", model: "T18", reviewedOn: "2026-11-21", facts: [
      { field: "Centro de carga (mm)", value: "600 mm", support: "Linde T18 | Load centre distance c (mm) | 600 | https://www.linde-mh.co.uk/media/Datasheets/EN_ds_t14_t20_1155_en_c_0624_view.pdf" }
    ]
  },
  {
    url: "https://jlg.manymanuals.it/special-machinery/450aaj-series-ii-service-manual/user-manual-38276/17",
    brand: "JLG", model: "450 AJ SII", reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "13,72 m", support: "JLG 450AJ Series II | Max. Platform Height | 45 ft. (13.72 M)" },
      { field: "Alcance horizontal (m)", value: "7,47 m", support: "450AJ SII | Max. Horizontal Reach | 24 ft. 6 in. (7.47 M)" }
    ]
  },
  {
    url: "https://www.pgplatforms.co.uk/_webedit/uploaded-files/All%20Files/Boom%20Lifts/Diesel/NIFTYLIFT%20HR21%204%C3%974%20Spec.pdf",
    brand: "Niftylift", model: "HR21D 4X4", reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "18,8 m", support: "Niftylift HR21 4x4 | Platform height | 18.8 m" },
      { field: "Capacidad máxima de plataforma", value: "225 kg", support: "Niftylift HR21 4x4 | Platform capacity | 225 kg" }
    ]
  },
  {
    url: "https://aftersales.paxster.no/wp-content/uploads/2023/05/User-Manual-Paxster-Gen2.2-Rev6-05-05-2023.pdf",
    brand: "Paxster", model: "Gen 2.2", reviewedOn: "2026-11-21", facts: [
      { field: "Número de plazas del modelo", value: "1", support: "Paxster Gen 2.2, Operating Instructions rev. 06, p. 25: Seats | 1 (center seat), en las cuatro variantes" }
    ]
  },
  {
    url: "https://logitrans.com/panther-manual-pallet-truck/", brand: "LOGITRANS", model: "Panther Flex",
    reviewedOn: "2026-11-21", facts: [
      { field: "Propulsión", value: "Manual", support: "Our manual pallet truck; la misma ficha identifica expresamente Panther Flex como configuración de horquillas" },
      { field: "Descenso de carga", value: "Controlado", support: "Gentle and controlled lowering of loads; la misma ficha identifica Panther Flex" }
    ]
  },
  {
    url: "https://www.yale.com/es-es/emea/carretillas-para-pasillos-muy-estrechos-vna/mtc10-15/",
    brand: "YALE", model: "MTC15", reviewedOn: "2026-11-21", facts: [
      { field: "Rotación del cabezal trilateral", value: "180°", support: "Yale MTC10-15: El cabezal trilateral gira 180 grados" }
    ]
  },
  {
    url: "https://xcmguk.com/product/xt4014kh15/", brand: "XCMG", model: "XT4014KH",
    reviewedOn: "2026-11-21", facts: [
      { field: "Tracción", value: "4×4", support: "El fabricante describe literalmente XT4014KH: Its four-wheel drive and four-wheel steering. No se acredita potencia ni variantes" }
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
  },
  {
    url: "https://www.grupogalindoalquiler.es/wp-content/uploads/2017/06/manitou-150-aetjc.pdf",
    brand: "Manitou", model: "150AETJC", reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "13 m", support: "Manitou 150 AETJ C Compact, ficha 700344ES 01/07: Altura del suelo | 13,00 m" }
    ]
  },
  {
    url: "https://manuals.genielift.com/operators/english/228459.pdf", brand: "Genie", model: "S-125",
    reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "38,1 m", support: "Genie S-125, manual 228459, 5.ª edición, 2.ª impresión, pág. 65: Height, platform maximum | 38.1 m" },
      { field: "Anchura con ejes recogidos", value: "2,5 m", support: "Genie S-125, manual 228459, 5.ª edición, 2.ª impresión, pág. 65: Width, axles retracted | 2.5 m" }
    ]
  },
  {
    url: "https://www.skyjack.com/sites/default/files/specifications/SJ9250_RT.pdf", brand: "Skyjack", model: "SJ9250",
    reviewedOn: "2026-11-21", facts: [
      { field: "Longitud de plataforma", value: "4,27 m", support: "Skyjack SJ9250 RT, catálogo NA/ENG/03/2018, pág. 2: I Platform Length (Inside Dimension) | 168 in (4.27 m)" }
    ]
  },
  {
    url: "https://www.lvnengebike.com/LX05.html", brand: "LVNENG", model: "LX05",
    reviewedOn: "2026-11-21", facts: [
      { field: "Dimensiones exteriores", value: "1890 x 720 x 1110 mm", support: "MODEL LX05; Dimension(L*W*H) | 1890*720*1110mm" },
      { field: "Tipo de frenos", value: "Disco delantero y trasero", support: "MODEL LX05; Brake | Front & Rear disc brakes" }
    ]
  },
  {
    url: "https://ctelift.com/nuovi-prodotti-cte-2021/", brand: "CTE", model: "MP 24 C",
    reviewedOn: "2026-11-21", facts: [
      { field: "Altura sobre obstáculos", value: "10,5 m", support: "CTE MP 24 C: possibilità di scavalco di m 10,5" }
    ]
  },
  {
    url: "https://doc.pegamo.es/www/machinery/doc/0AEE48CF9C424F608F99E74F6D48876A.pdf",
    brand: "JLG", model: "660SJ", reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "20,31 m", support: "JLG Industries, guía de especificaciones 2015, página 20: modelo 660SJ | Altura de plataforma | 20,31 m" }
    ]
  },
  {
    url: "https://vertikal.net/en/pdf/78085/1beac504/ca_2025_8_p24-39.pdf",
    brand: "XCMG", model: "XT3207KH", reviewedOn: "2026-11-21", facts: [
      { field: "Tipo de motor", value: "Diésel", support: "Anuncio técnico de XCMG UK, Cranes & Access 2025/8, pág. 24: XT3207KH | Engine model: Deutz TCD 3.6. DEUTZ confirma que TCD 3.6 L4 es motor diésel: https://www.deutz.com/americas/en/products/power-packs/tcd-36-l4/" }
    ]
  },
  {
    url: "https://www.ctelift.com/wp-content/uploads/2020/11/B-LIFT-27.2_2021-05_EN.pdf",
    brand: "CTE", model: "B-LIFT 27.2", reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "25 m",
        support: "CTE B-LIFT 27.2, folleto oficial ed. 03/21, pág. 2: altura máxima de trabajo 27 m, altura de cesta 25 m, alcance 15,5 m, carga 250 kg. La ficha GAM 6190 identifica B-LIFT 27.2 FIB y reproduce 27 m, 15,5 m y 250 kg; se acredita únicamente la cota de plataforma del conjunto 27.2, no las propiedades específicas de la cesta FIB" }
    ]
  },
  {
    url: "https://www.automobile-catalog.com/make/alfa_romeo/spider_alfa_romeo/spider_serie_2/1973.html",
    brand: null, model: "SPIDE JUNIOR", reviewedOn: "2026-11-21", facts: [
      { field: "Altura exterior del modelo", value: "1290 mm",
        support: "Alfa Romeo Spider 1300 Junior y Spider 1600 Junior de 1973, fichas de ambas variantes: altura exterior 1290 mm; es una cota común, no una identificación de cilindrada" },
      { field: "Anchura exterior del modelo", value: "1630 mm",
        support: "Alfa Romeo Spider 1300 Junior y Spider 1600 Junior de 1973: anchura exterior 1630 mm en ambas fichas" },
      { field: "Distancia entre ejes del modelo", value: "2250 mm",
        support: "Alfa Romeo Spider 1300 Junior y Spider 1600 Junior de 1973: batalla de 2250 mm en ambas fichas" },
      { field: "Longitud exterior del modelo", value: "4120 mm",
        support: "Alfa Romeo Spider 1300 Junior y Spider 1600 Junior de 1973: longitud 4120 mm en ambas fichas" },
      { field: "Tipo de tracción", value: "Trasera",
        support: "Alfa Romeo Spider 1300 Junior y Spider 1600 Junior de 1973, fichas de ambas variantes: RWD (rear-wheel drive)" },
      { field: "Transmisión del modelo", value: "Manual de 5 velocidades",
        support: "Alfa Romeo Spider 1300 Junior y Spider 1600 Junior de 1973, fichas de ambas variantes: manual 5-speed (man. 5)" }
    ]
  },
  {
    url: "https://manuals.genielift.com/operators/english/133540.pdf", brand: "Genie", model: "Z-51/30J",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "9,25 m", support: "Manual oficial Genie PN 133540, quinta edición, primera impresión, página 49: Z-51/30J Horizontal reach maximum 9.25 m. El índice de manuales Genie lo asigna a la serie CE desde SN 10B-524 hasta 14B-1200, correspondiente al periodo de la ficha original de 2013; no acredita otras revisiones" }
    ]
  },
  {
    url: "https://logitrans.com/panther-manual-pallet-truck/", brand: "LOGITRANS", model: "Panther Flex",
    reviewedOn: "2026-11-21", facts: [
      { field: "Elevación", value: "Hidráulica manual", support: "Logitrans identifica Panther Flex como variante de horquillas del Panther manual; su catálogo describe elevaciones mediante bombeo manual y aceite especial. El despiece de fabricante Panther 2572/2582 muestra la bomba, el cilindro, el pistón, las juntas y las válvulas: https://logitrans-stapler.de/service/Ersatzteillisten/Gabelhubwagen/Panther2572-2582-Ersatzteilliste.pdf" }
    ]
  },
  {
    url: "https://www.genielift.com/docs/default-source/product-specifications/articulated-boom-lift/en/z-3422ic_spec_2019.pdf",
    brand: "Genie", model: "Z-34/22", reviewedOn: "2026-11-21", facts: [
      { field: "Longitud de plataforma", value: "0,76 m",
        support: "Genie Z-34/22 IC, ficha técnica del fabricante de 2019, página 1: A — Platform length 0.76 m para 2WD y 4WD" }
    ]
  },
  {
    url: "https://manuals.genielift.com/operators/Spanish/133102SP.pdf", brand: "Genie", model: "GR-15",
    reviewedOn: "2026-11-21", facts: [
      { field: "Capacidad nominal de la plataforma estándar", value: "227 kg",
        support: "GR-15 | Capacidad máxima, plataforma estándar | 227 kg (página 41)" }
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
    url: "https://www.automobile-catalog.com/make/santana/series_iii_land/series_iii_109_wagon/1980.html",
    brand: "LAND ROVER", model: "SANTANA", reviewedOn: "2026-11-21", facts: [
      { field: "Caja de cambios del modelo", value: "Manual de 4 velocidades", support: "Santana Series III 109 Techo Metálico (Wagon), gama 1980: manual 4-speed gearbox; el original GAM 5254 identifica 1980 y longitud 4440 mm, coincidente con la versión 109" },
      { field: "Distancia entre ejes del modelo", value: "2769 mm", support: "Santana Series III 109 Techo Metálico (Wagon), gama 1980: wheelbase 2769 mm; el original GAM 5254 indica longitud 4440 mm, propia de la batalla 109 frente a la 88" },
      { field: "Tipo de tracción", value: "4x4 conectable", support: "Santana Series III 109 Techo Metálico (Wagon), gama 1980: 4x4 part-time, rear permanent and front engaged manually; no se atribuye tracción permanente ni motorización concreta" }
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
    url: "https://manuals.genielift.com/operators/english/82600.pdf",
    brand: "Genie", model: "Z-45/25J", reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "13,8 m",
        support: "Manual oficial Genie PN 82600, segunda edición, segunda impresión: Z-45/25J con plumín, modelos de base estándar y estrecha, páginas 37 y 39: altura máxima de plataforma 13,8 m en ambas bases. Manual de servicio PN 219418 Rev C (2013) documenta asimismo 13,8 m para la serie IC desde SN 13A-47001; no acredita una placa de serie individual" },
      { field: "Alcance horizontal (m)", value: "7,7 m",
        support: "Manual oficial Genie PN 82600, segunda edición, segunda impresión: Z-45/25J con plumín, modelos de base estándar y estrecha, páginas 37 y 39: alcance horizontal máximo 7,7 m en ambas bases. Manual de servicio PN 219418 Rev C (2013) documenta asimismo 7,7 m para la serie IC desde SN 13A-47001; no acredita una placa de serie individual" }
    ]
  },
  {
    url: "https://www.truckscout24.de/tsp/ts-208-19-367",
    brand: "Manitou", model: "MT1440 SLT", reviewedOn: "2026-11-21", facts: [
      { field: "Tracción", value: "4x4",
        support: "Anuncio de MT 1440 SLT Turbo Serie III-E2 que identifica explícitamente ALLRAD (tracción integral) y 4x4x4. El original Mercaeleva M005-5167 identifica MT 1440 SLT 3E2, diésel, 14 m y 4000 kg; el anuncio acredita característica de familia Serie III-E2, no identidad de la unidad ni equipamiento opcional" }
    ]
  },
  {
    url: "https://www.coalci.es/wp-content/uploads/2019/07/1930ES_ES-pdf.pdf",
    brand: "JLG", model: "1930 ES", reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "5,72 m", support: "JLG 1930ES, ficha del fabricante, página 2: Altura de la Plataforma - Elevada | 5,72 m" },
      { field: "Anchura (mm)", value: "0,76 m", support: "JLG 1930ES, ficha del fabricante, página 2: F. Anchura Total | 0,76 m" },
      { field: "Capacidad máxima de plataforma", value: "230 kg", support: "JLG 1930ES, ficha del fabricante, página 2: Capacidad de la Plataforma | 230 kg; capacidad máxima de uso interior, distinta de la capacidad para exteriores de 120 kg" },
      { field: "Longitud (mm)", value: "1,87 m", support: "JLG 1930ES, ficha del fabricante, página 2: G. Longitud Total | 1,87 m" }
    ]
  },
  {
    url: "https://www.coalci.es/wp-content/uploads/2019/07/1930ES_ES-pdf.pdf",
    brand: "JLG", model: "1930ES", reviewedOn: "2026-11-21", facts: [
      { field: "Anchura (mm)", value: "0,76 m", support: "JLG 1930ES, ficha del fabricante, página 2: F. Anchura Total | 0,76 m" },
      { field: "Capacidad máxima de plataforma", value: "230 kg", support: "JLG 1930ES, ficha del fabricante, página 2: Capacidad de la Plataforma | 230 kg; capacidad máxima de uso interior, distinta de la capacidad para exteriores de 120 kg" },
      { field: "Extensión de plataforma", value: "0,9 m", support: "JLG 1930ES, ficha del fabricante, páginas 1-2: extensión de plataforma desplegable de 0,90 m" }
    ]
  },
  {
    url: "https://www.colle.eu/media/6015/170aetj-l_eng.pdf",
    brand: "Manitou", model: "170AETJL", reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "9,4 m", support: "170 AETJ L, página 2: Horizontal outreach 9.40 m" },
      { field: "Altura de plataforma", value: "14,9 m", support: "170 AETJ L, página 2: Platform height 14.90 m" },
      { field: "Anchura (mm)", value: "1,75 m", support: "170 AETJ L, página 2: Width 1.75 m" },
      { field: "Capacidad máxima de plataforma", value: "200 kg", support: "170 AETJ L, página 2: Platform capacity 200 kg / 2 peoples" }
    ]
  },
  {
    url: "https://www.geeritsverhuur.be/sites/default/files/2025-09/1_FICHE_JLG_450AJ.pdf",
    brand: "JLG", model: "450 AJ", reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "7,47 m", support: "JLG 450AJ 450 Series II, página 2: Horizontal Outreach 7.47 m" },
      { field: "Altura de plataforma", value: "13,72 m", support: "JLG 450AJ 450 Series II, página 2: Platform Height 13.72 m" },
      { field: "Capacidad máxima de plataforma", value: "230 kg", support: "JLG 450AJ 450 Series II, página 2: Platform Capacity Unrestricted 230 kg" }
    ]
  },
  {
    url: "https://shuttle-storage.s3.amazonaws.com/deblocknew/technische%20fiches/4302%20TF%20450-Series-II-Spec-Sheet.pdf?1591088111=&h=0&w=0",
    brand: "JLG", model: "450 AJ", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "diésel", workingHeightM: 16,
      invariantGeometry: true, firstYear: 2015, lastYear: 2015 }, fields: ["Anchura de plataforma", "Longitud de plumín"] }, facts: [
      { field: "Anchura de plataforma", value: "0,76 m", support: "JLG 450AJ, páginas 1-2: plataforma de serie 0,76 x 1,83 m; opciones 0,76 x 1,22 y 0,76 x 1,52 m. Anchura común a las tres configuraciones, corroborada en la ficha 450AJ posterior https://sitecore.jlg.com/dfsmedia/e4042b10c9ce4595b4cc059f1299f079/141151-source" },
      { field: "Longitud de plumín", value: "1,24 m", support: "JLG 450AJ, página 2: Jib – Overall Length 1.24 m; misma longitud en la ficha posterior https://sitecore.jlg.com/dfsmedia/e4042b10c9ce4595b4cc059f1299f079/141151-source" }
    ]
  },
  {
    url: "https://www.coalci.es/wp-content/uploads/2021/07/haulotte-ha15ip.pdf",
    brand: "Haulotte", model: "HA15IP", reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "8,45 m", support: "HA15 IP, página 2: Alcance máximo 8.45 m" },
      { field: "Altura de plataforma", value: "12,87 m", support: "HA15 IP, página 2: Altura plataforma 12.87 m" },
      { field: "Anchura (mm)", value: "1,52 m", support: "HA15 IP, página 2: B Ancho 1.52 m" },
      { field: "Capacidad máxima de plataforma", value: "230 kg", support: "HA15 IP, página 2: Capacidad máxima 230 kg" }
    ]
  },
  {
    url: "https://documentacionqr.com/sat/objects/919543/HAULOTTE_COMPACT10N_FICHA_CARACTERISTICAS_TECNICAS_ES.pdf",
    brand: "Haulotte", model: "COMPACT-10N", reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "8 m", support: "Compact 10 N, página 2, columna Compact 10 N: Altura plataforma 8 m" },
      { field: "Anchura (mm)", value: "0,81 m", support: "Compact 10 N, página 2, columna Compact 10 N: Ancho 0,81 m" },
      { field: "Capacidad máxima de plataforma", value: "230 kg", support: "Compact 10 N, página 2, columna Compact 10 N: Capacidad máxima 230 kg" },
      { field: "Distancia entre ejes (mm)", value: "1,86 m", support: "Compact 10 N, página 2: E Distancia entre ejes 1,86 m" }
    ]
  },
  {
    url: "https://www.plataformasnoain.com/wp-content/uploads/2022/03/Haulotte-OPTIMUM-8-AC.pdf",
    brand: "Haulotte", model: "Optimum 8", reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "5,77 m", support: "Optimum 8, página 2: Altura de plataforma 5.77 m" },
      { field: "Capacidad máxima de plataforma", value: "230 kg", support: "Optimum 8, página 2: Capacidad máxima interior/exterior 230 kg" },
      { field: "Distancia entre ejes (mm)", value: "1,38 m", support: "Optimum 8, página 2: G Distancia entre ejes 1.38 m" }
    ]
  },
  {
    url: "https://www.haulotte.com.es/es_ES/productos/ha16-rtj",
    brand: "Haulotte", model: "HA16RTJ", reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "8,3 m", support: "Haulotte HA16 RTJ, Datos Técnicos: Alcance máximo 8.3 m" },
      { field: "Altura de plataforma", value: "14 m", support: "Haulotte HA16 RTJ, Datos Técnicos: Altura plataforma 14 m" },
      { field: "Anchura (mm)", value: "2,3 m", support: "Haulotte HA16 RTJ, Datos Técnicos: Ancho 2.3 m" },
      { field: "Capacidad máxima de plataforma", value: "230 kg", support: "Haulotte HA16 RTJ, Datos Técnicos: Capacidad máxima 230 kg" }
    ]
  },
  {
    url: "https://www.lgmglifts.com/product/pro-detail-1028.htm",
    brand: "LGMG", model: "SR1218D", reviewedOn: "2026-11-21",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "diésel", workingHeightM: 13.9,
      lengthM: 3.76, widthM: 1.79, loadCapacityKg: 365 }, fields: ["Altura de plataforma", "Extensión de plataforma", "Longitud de plataforma", "Anchura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "11,9 m", support: "LGMG SR1218D, Specifications: A-Platform Height-Raised 11.9m" },
      { field: "Anchura (mm)", value: "1,79 m", support: "LGMG SR1218D, Specifications: F-Overall Width 1.79m" },
      { field: "Capacidad máxima de plataforma", value: "365 kg", support: "LGMG SR1218D, Specifications: Platform Capacity 365kg" },
      { field: "Extensión de plataforma", value: "1,52 m", support: "LGMG SR1218D, Specifications: Extension Deck 1.52m" }
    ]
  },
  {
    url: "https://www.eagleplatforms.com/wp-content/uploads/Haulotte-Compact-12-Electric-SPEC-SHEET.pdf",
    brand: "Haulotte", model: "Compact 12", reviewedOn: "2026-11-21", facts: [
      { field: "Anchura (mm)", value: "1,2 m", support: "Compact 12, página 2, columna COMPACT 12: F Overall width 1.2 m" },
      { field: "Capacidad máxima de plataforma", value: "300 kg", support: "Compact 12, página 2, columna COMPACT 12: Lift capacity inside/outside 300 kg" },
      { field: "Distancia entre ejes (mm)", value: "1,86 m", support: "Compact 12, página 2, columna COMPACT 12: H Wheelbase 1.86 m" },
      { field: "Extensión de plataforma", value: "0,92 m", support: "Compact 12, página 2, columna COMPACT 12: Length - extension 0.92 m" }
    ]
  },
  {
    url: "https://en.lgmg.com.cn/product/629.htm", brand: "LGMG", model: "AS0607WE", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 7.8,
      lengthM: 1.86, widthM: 0.81, loadCapacityKg: 230 }, fields: ["Longitud de plataforma", "Anchura de plataforma", "Extensión de plataforma"] }, facts: [
      { field: "Longitud de plataforma", value: "1,63 m", support: "LGMG AS0607WE, Specifications, Measurements: C-Platform Length 1.63m" },
      { field: "Anchura de plataforma", value: "0,74 m", support: "LGMG AS0607WE, Specifications, Measurements: D-Platform Width 0.74m" },
      { field: "Extensión de plataforma", value: "0,9 m", support: "LGMG AS0607WE, Specifications, Measurements: H-Extension Deck 0.9m" }
    ]
  },
  {
    url: "https://en.lgmg.com.cn/product/625.htm",
    brand: "LGMG", model: "AS1212E", reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "12 m", support: "LGMG AS1212E, Specifications: A-Platform Height-Raised 12m" },
      { field: "Anchura (mm)", value: "1,18 m", support: "LGMG AS1212E, Specifications: F-Overall Width 1.18m" },
      { field: "Capacidad máxima de plataforma", value: "320 kg", support: "LGMG AS1212E, Specifications: Platform Capacity 320kg" },
      { field: "Extensión de plataforma", value: "0,9 m", support: "LGMG AS1212E, Specifications: H-Extension Deck 0.9m" }
    ]
  },
  {
    url: "https://www.lgmglifts.com/product/pro-detail-616.htm",
    brand: "LGMG", model: "A14JE", reviewedOn: "2026-11-21",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "eléctrica", workingHeightM: 15.8,
      lengthM: 6.66, widthM: 1.8, loadCapacityKg: 230 }, fields: ["Altura de plataforma"] }, facts: [
      { field: "Alcance horizontal (m)", value: "7,81 m", support: "LGMG A14JE, Specifications: Horizontal Outreach 7.81m" },
      { field: "Altura de plataforma", value: "13,8 m", support: "LGMG A14JE, Specifications: Platform Height 13.8m" },
      { field: "Anchura (mm)", value: "1,8 m", support: "LGMG A14JE, Specifications: B-Overall Width 1.8m" },
      { field: "Capacidad máxima de plataforma", value: "230 kg", support: "LGMG A14JE, Specifications: Platform Capacity 230 kg" }
    ]
  },
  {
    url: "https://www.lgmglifts.com/product/pro-detail-617.htm",
    brand: "LGMG", model: "AR16J", reviewedOn: "2026-11-21",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "diésel", workingHeightM: 17.7,
      lengthM: 7.56, widthM: 2.31, loadCapacityKg: 230 }, fields: ["Altura de plataforma", "Longitud de plataforma", "Anchura de plataforma"] }, facts: [
      { field: "Alcance horizontal (m)", value: "9,39 m", support: "LGMG AR16J, Specifications: Horizontal Outreach 9.39m" },
      { field: "Altura de plataforma", value: "15,7 m", support: "LGMG AR16J, Specifications: Platform Height 15.7m" },
      { field: "Anchura (mm)", value: "2,31 m", support: "LGMG AR16J, Specifications: B-Stowed Width 2.31m" },
      { field: "Capacidad máxima de plataforma", value: "230 kg", support: "LGMG AR16J, Specifications: Platform Capacity 230kg" }
    ]
  },
  {
    url: "https://www.colle.eu/media/6020/180atj_eng.pdf",
    brand: "Manitou", model: "180ATJ", reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "10,62 m", support: "Manitou 180 ATJ, página 2: Outreach 10.62 m" },
      { field: "Capacidad máxima de plataforma", value: "230 kg", support: "Manitou 180 ATJ, página 2: Capacity 230 kg" }
    ]
  },
  {
    url: "https://www.colle.eu/media/6008/120aetj-c-eng.pdf", brand: "Manitou", model: "120AETJC", reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "7 m", support: "Manitou 120 AETJ-C, página 2: Outreach 7.00 m" },
      { field: "Altura de plataforma", value: "9,95 m", support: "Manitou 120 AETJ-C, página 2: Platform height 9.95 m" },
      { field: "Anchura (mm)", value: "1,2 m", support: "Manitou 120 AETJ-C, página 2: Overall width 1.20 m" },
      { field: "Capacidad máxima de plataforma", value: "200 kg", support: "Manitou 120 AETJ-C, página 2: Capacity 200 kg" }
    ]
  },
  {
    url: "https://documentacionqr.com/sat/objects/955887/HAULOTTE_COMPACT14_FICHA_TECNICA.pdf", brand: "Haulotte", model: "COMPACT-14", reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "11,85 m", support: "Haulotte COMPACT 14, página 2: Altura de plataforma 11.85 m" },
      { field: "Anchura (mm)", value: "1,2 m", support: "Haulotte COMPACT 14, página 2: Ancho de transporte 1.2 m" },
      { field: "Capacidad máxima de plataforma", value: "350 kg", support: "Haulotte COMPACT 14, página 2: Capacidad máxima 350 kg" },
      { field: "Distancia entre ejes (mm)", value: "1,86 m", support: "Haulotte COMPACT 14, página 2: F Distancia entre ejes 1.86 m" }
    ]
  },
  {
    url: "https://www.skyjack.com/sites/default/files/literature-library/KC_SJ6832_RT_TEAR_SHEET_WEB.pdf", brand: "Skyjack", model: "SJ6832RT", reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "9,75 m", support: "Skyjack SJ6832 RT, página 2: B Raised Platform Height 9.75 m" },
      { field: "Anchura (mm)", value: "1,76 m", support: "Skyjack SJ6832 RT, página 2: D Overall Width 1.76 m" },
      { field: "Capacidad máxima de plataforma", value: "454 kg", support: "Skyjack SJ6832 RT, página 2: Capacity (Overall) 454 kg" },
      { field: "Extensión de plataforma", value: "1,52 m", support: "Skyjack SJ6832 RT, página 2: Extension Deck 1.52 m" }
    ]
  },
  {
    url: "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf", brand: "MODULA", model: "MC25D", reviewedOn: "2026-11-21", facts: [
      { field: "Anchura de bandeja", value: "2500 mm", support: "Modula LIFT, página 6, fila MC25D: Tray width 2500 mm" },
      { field: "Anchura exterior del almacén", value: "2917 mm", support: "Modula LIFT, página 6, fila MC25D: Unit footprint INTERNAL bay, width 2917 mm" },
      { field: "Carga neta por bandeja", value: "250 kg", support: "Modula LIFT, página 6, fila MC25D: Net tray payload 250 kg" },
      { field: "Profundidad de bandeja", value: "857 mm", support: "Modula LIFT, página 6, fila MC25D: Tray depth 857 mm" }
    ]
  },
  {
    url: "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf", brand: "MODULA", model: "MC50D", reviewedOn: "2026-11-21", facts: [
      { field: "Anchura de bandeja", value: "2500 mm", support: "Modula LIFT, página 6, fila MC50D: Tray width 2500 mm" },
      { field: "Anchura exterior del almacén", value: "2917 mm", support: "Modula LIFT, página 6, fila MC50D: Unit footprint INTERNAL bay, width 2917 mm" },
      { field: "Carga neta por bandeja", value: "500 kg", support: "Modula LIFT, página 6, fila MC50D: Net tray payload 500 kg" },
      { field: "Profundidad de bandeja", value: "857 mm", support: "Modula LIFT, página 6, fila MC50D: Tray depth 857 mm" }
    ]
  },
  {
    url: "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf", brand: "MODULA", model: "MC75D", reviewedOn: "2026-11-21", facts: [
      { field: "Anchura de bandeja", value: "2500 mm", support: "Modula LIFT, página 6, fila MC75D: Tray width 2500 mm" },
      { field: "Anchura exterior del almacén", value: "2917 mm", support: "Modula LIFT, página 6, fila MC75D: Unit footprint INTERNAL bay, width 2917 mm" },
      { field: "Carga neta por bandeja", value: "750 kg", support: "Modula LIFT, página 6, fila MC75D: Net tray payload 750 kg" },
      { field: "Profundidad de bandeja", value: "857 mm", support: "Modula LIFT, página 6, fila MC75D: Tray depth 857 mm" }
    ]
  },
  {
    url: "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf", brand: "MODULA", model: "MX25D", reviewedOn: "2026-11-21", facts: [
      { field: "Anchura de bandeja", value: "3100 mm", support: "Modula LIFT, página 7, fila MX25D: Tray width 3100 mm" },
      { field: "Anchura exterior del almacén", value: "3517 mm", support: "Modula LIFT, página 7, fila MX25D: Unit footprint INTERNAL bay, width 3517 mm" },
      { field: "Carga neta por bandeja", value: "250 kg", support: "Modula LIFT, página 7, fila MX25D: Net tray payload 250 kg" },
      { field: "Profundidad de bandeja", value: "857 mm", support: "Modula LIFT, página 7, fila MX25D: Tray depth 857 mm" }
    ]
  },
  {
    url: "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf", brand: "MODULA", model: "MX50D", reviewedOn: "2026-11-21", facts: [
      { field: "Anchura de bandeja", value: "3100 mm", support: "Modula LIFT, página 7, fila MX50D: Tray width 3100 mm" },
      { field: "Anchura exterior del almacén", value: "3517 mm", support: "Modula LIFT, página 7, fila MX50D: Unit footprint INTERNAL bay, width 3517 mm" },
      { field: "Carga neta por bandeja", value: "500 kg", support: "Modula LIFT, página 7, fila MX50D: Net tray payload 500 kg" },
      { field: "Profundidad de bandeja", value: "857 mm", support: "Modula LIFT, página 7, fila MX50D: Tray depth 857 mm" }
    ]
  },
  {
    url: "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf", brand: "MODULA", model: "MX75D", reviewedOn: "2026-11-21", facts: [
      { field: "Anchura de bandeja", value: "3100 mm", support: "Modula LIFT, página 7, fila MX75D: Tray width 3100 mm" },
      { field: "Anchura exterior del almacén", value: "3517 mm", support: "Modula LIFT, página 7, fila MX75D: Unit footprint INTERNAL bay, width 3517 mm" },
      { field: "Carga neta por bandeja", value: "750 kg", support: "Modula LIFT, página 7, fila MX75D: Net tray payload 750 kg" },
      { field: "Profundidad de bandeja", value: "857 mm", support: "Modula LIFT, página 7, fila MX75D: Tray depth 857 mm" }
    ]
  },
  {
    url: "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf", brand: "MODULA", model: "ML25D", reviewedOn: "2026-11-21", facts: [
      { field: "Anchura de bandeja", value: "4100 mm", support: "Modula LIFT, página 7, fila ML25D: Tray width 4100 mm" },
      { field: "Anchura exterior del almacén", value: "4517 mm", support: "Modula LIFT, página 7, fila ML25D: Unit footprint INTERNAL bay, width 4517 mm" },
      { field: "Carga neta por bandeja", value: "250 kg", support: "Modula LIFT, página 7, fila ML25D: Net tray payload 250 kg" },
      { field: "Profundidad de bandeja", value: "857 mm", support: "Modula LIFT, página 7, fila ML25D: Tray depth 857 mm" }
    ]
  },
  {
    url: "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf", brand: "MODULA", model: "ML50D", reviewedOn: "2026-11-21", facts: [
      { field: "Anchura de bandeja", value: "4100 mm", support: "Modula LIFT, página 7, fila ML50D: Tray width 4100 mm" },
      { field: "Anchura exterior del almacén", value: "4517 mm", support: "Modula LIFT, página 7, fila ML50D: Unit footprint INTERNAL bay, width 4517 mm" },
      { field: "Carga neta por bandeja", value: "500 kg", support: "Modula LIFT, página 7, fila ML50D: Net tray payload 500 kg" },
      { field: "Profundidad de bandeja", value: "857 mm", support: "Modula LIFT, página 7, fila ML50D: Tray depth 857 mm" }
    ]
  },
  {
    url: "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf", brand: "MODULA", model: "ML75D", reviewedOn: "2026-11-21", facts: [
      { field: "Anchura de bandeja", value: "4100 mm", support: "Modula LIFT, página 7, fila ML75D: Tray width 4100 mm" },
      { field: "Anchura exterior del almacén", value: "4517 mm", support: "Modula LIFT, página 7, fila ML75D: Unit footprint INTERNAL bay, width 4517 mm" },
      { field: "Carga neta por bandeja", value: "750 kg", support: "Modula LIFT, página 7, fila ML75D: Net tray payload 750 kg" },
      { field: "Profundidad de bandeja", value: "857 mm", support: "Modula LIFT, página 7, fila ML75D: Tray depth 857 mm" }
    ]
  },
  {
    url: "https://www.lgmglifts.com/es/product/pro-detail-2066.htm", brand: "LGMG", model: "S0808EII", reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "7,8 m", support: "LGMG S0808EII, Especificación: A-Altura Plataforma levantada 7.8/6 m (dentro/fuera), altura interior 7.8 m" },
      { field: "Anchura (mm)", value: "0,83 m", support: "LGMG S0808EII, Especificación: E-Anchura Total 0.83 m" },
      { field: "Capacidad máxima de plataforma", value: "230 kg", support: "LGMG S0808EII, Especificación: Capacidad de la Plataforma 230 kg" },
      { field: "Extensión de plataforma", value: "0,9 m", support: "LGMG S0808EII, Especificación: H-Ampliación de la cubierta 0.9 m" }
    ]
  },
  {
    url: "https://www.lgmglifts.com/product/pro-detail-2026.htm", brand: "LGMG", model: "S0808EII", reviewedOn: "2026-11-21", facts: [
      { field: "Anchura de plataforma", value: "0,79 m", support: "LGMG S0808EII, Specifications: C-Platform Width 0.79m" },
      { field: "Capacidad de plataforma", value: "230 kg", support: "LGMG S0808EII, Specifications: Platform Capacity 230kg" },
      { field: "Extensión de plataforma", value: "0,9 m", support: "LGMG S0808EII, Specifications: H-Extension Deck 0.9m" },
      { field: "Longitud de plataforma", value: "2,26 m", support: "LGMG S0808EII, Specifications: B-Platform Length 2.26m" }
    ]
  },
  {
    url: "https://www.lgmglifts.com/product/pro-detail-1030.htm", brand: "LGMG", model: "SS0407ER", reviewedOn: "2026-11-21", facts: [
      { field: "Anchura de plataforma", value: "0,70 m", support: "LGMG SS0407ER, Specifications: C-Platform Width 0.7m" },
      { field: "Capacidad de plataforma", value: "240 kg", support: "LGMG SS0407ER, Specifications: Platform Capacity 240kg" },
      { field: "Extensión de plataforma", value: "0,6 m", support: "LGMG SS0407ER, Specifications: G-Extension Deck 0.6m" },
      { field: "Longitud de plataforma", value: "1,27 m", support: "LGMG SS0407ER, Specifications: B-Platform Length 1.27m" }
    ]
  },
  {
    url: "https://www.haulotte.co.uk/en_GB/product/compact-12-dx", brand: "Haulotte", model: "COMPACT-12DX", reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "10,06 m", support: "Haulotte Compact 12 DX, Technical data: Platform height 10.06 m" },
      { field: "Anchura (mm)", value: "1,78 m", support: "Haulotte Compact 12 DX, Technical data: Width 1.78 m" },
      { field: "Capacidad máxima de plataforma", value: "450 kg", support: "Haulotte Compact 12 DX, Technical data: Lift capacity 450 kg" },
      { field: "Longitud de plataforma", value: "2,45 m", support: "Haulotte Compact 12 DX, Technical data: Platform length 2.45 m" }
    ]
  },
  {
    url: "https://www.rothlehner.de/produkt/c10-29108/?lang=en", brand: "Haulotte", model: "COMPACT-10", reviewedOn: "2026-11-21", facts: [
      { field: "Anchura (mm)", value: "1,2 m", support: "Rothlehner Haulotte Compact 10, Technical data: Width 1.20 m" },
      { field: "Capacidad máxima de plataforma", value: "450 kg", support: "Rothlehner Haulotte Compact 10, Technical data: Basket load 450 kg" },
      { field: "Longitud (mm)", value: "2,45 m", support: "Rothlehner Haulotte Compact 10, Description: Overall length 2.45 m" }
    ]
  },
  {
    url: "https://www.lgmglifts.com/product/pro-detail-1027.htm", brand: "LGMG", model: "SR1018D", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "diésel", workingHeightM: 11.7,
      lengthM: 3.76, widthM: 1.79, loadCapacityKg: 454 }, fields: ["Altura de plataforma", "Longitud de plataforma", "Anchura de plataforma", "Extensión de plataforma"] },
    facts: [
      { field: "Longitud de plataforma", value: "2,79 m", support: "SR1018D, Specifications, Measurements: C-Platform Length 2.79m" },
      { field: "Anchura de plataforma", value: "1,6 m", support: "SR1018D, Specifications, Measurements: D-Platform Width 1.6m" }
    ]
  },
  {
    url: "https://www.lgmglifts.com/product/pro-detail-2033.htm", brand: "LGMG", model: "S0812II", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 10,
      lengthM: 2.49, widthM: 1.18, loadCapacityKg: 450 }, fields: ["Longitud de plataforma", "Anchura de plataforma", "Extensión de plataforma"] },
    facts: [
      { field: "Longitud de plataforma", value: "2,26 m", support: "S0812Ⅱ, Specifications, Measurements: B-Platform Length 2.26m" },
      { field: "Anchura de plataforma", value: "1,12 m", support: "S0812Ⅱ, Specifications, Measurements: C-Platform Width 1.12m" },
      { field: "Extensión de plataforma", value: "0,9 m", support: "S0812Ⅱ, Specifications, Measurements: H-Extension Deck 0.9m" }
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
    url: "https://www.automecaniccorbella.com/resource/B300II_ficha_t%C3%A9cnica.pdf",
    brand: "CESAB", model: "B318LII", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 1800,
      marketCountry: "España", firstYear: 2022 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "CESAB Material Handling Europe, SPEC_B300_ES_202202 / Ucan V02, p. 2, columna B318L-II, filas 1.5 y 1.6: 1,8 t y 500 mm; especificación nominal en condiciones estándar, no capacidad residual de la unidad." }
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
  },
  {
    url: "https://www.yale.com/globalassets/coms/yale/emea/documents/4-wheel-electric-forklift-trucks/erp22-35vl/220990057-vl-series-spec-sheet-rev07-en-lowres-zmag.pdf",
    brand: "YALE", model: "ERP35VL", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "carretilla-elevadora", energy: "eléctrica", loadCapacityKg: 3500,
      marketCountry: "España", firstYear: 2019, lastYear: 2021 }, fields: ["Centro de carga nominal del modelo"] },
    facts: [
      { field: "Centro de carga nominal del modelo", value: "500 mm", support: "Yale Europe 220990057 rev. 07 (02/2021), p. 3, filas 1.5 y 1.6: ERP 35 VL LWB, 3500 kg nominales a 500 mm en Value y Productivity. Corroborado en edición alemana 220990059 rev. 07 (07/2019), p. 3. Valores nominales de configuración estándar, no capacidad residual con mástil o accesorios instalados." }
    ]
  },
  {
    url: "https://www.lgmglifts.com/product/pro-detail-1028.htm", brand: "LGMG", model: "SR1218D", reviewedOn: "2026-11-24",
    facts: [
      { field: "Longitud de plataforma", value: "2,79 m", support: "LGMG SR1218D, Specifications, Measurements: C-Platform Length 2.79m" },
      { field: "Anchura de plataforma", value: "1,6 m", support: "LGMG SR1218D, Specifications, Measurements: D-Platform Width 1.6m" }
    ]
  },
  {
    url: "https://www.lgmglifts.com/product/pro-detail-617.htm", brand: "LGMG", model: "AR16J", reviewedOn: "2026-11-24",
    facts: [
      { field: "Longitud de plataforma", value: "1,83 m", support: "LGMG AR16J, Specifications, Measurements: D-Platform Size Length 1.83m" },
      { field: "Anchura de plataforma", value: "0,76 m", support: "LGMG AR16J, Specifications, Measurements: E-Platform Size Width 0.76m" }
    ]
  },
  {
    url: "https://www.lgmglifts.com/product/pro-detail-1026.htm", brand: "LGMG", model: "AR14J", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "diésel", workingHeightM: 16.09,
      lengthM: 6.77, widthM: 2.31, loadCapacityKg: 230 }, fields: ["Altura de plataforma", "Longitud de plataforma", "Anchura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "14,09 m", support: "LGMG AR14J, Specifications, Measurements: Platform Height 14.09m" },
      { field: "Longitud de plataforma", value: "1,83 m", support: "LGMG AR14J, Specifications, Measurements: D-Platform Size Length 1.83m" },
      { field: "Anchura de plataforma", value: "0,76 m", support: "LGMG AR14J, Specifications, Measurements: E-Platform Size Width 0.76m" }
    ]
  },
  {
    url: "https://www.lgmglifts.com/product/pro-detail-987.htm", brand: "LGMG", model: "SR1623D", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "diésel", workingHeightM: 17.9,
      lengthM: 4.9, widthM: 2.3, loadCapacityKg: 680 }, fields: ["Altura de plataforma", "Anchura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "15,9 m", support: "LGMG SR1623D, Specifications, Measurements: A-Platform Height-Raised 15.9m" },
      { field: "Anchura de plataforma", value: "1,83 m", support: "LGMG SR1623D, Specifications, Measurements: D-Platform Width 1.83m; common to both platform lengths listed in the table" }
    ]
  },
  {
    url: "https://en.lgmg.com.cn/product/623.htm", brand: "LGMG", model: "AS0808E", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 10,
      lengthM: 2.4, widthM: 0.83, loadCapacityKg: 230 }, fields: ["Altura de plataforma", "Longitud de plataforma", "Extensión de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "8 m", support: "LGMG AS0808E, Specifications, Measurements: A-Platform Height-Raised 8m" },
      { field: "Longitud de plataforma", value: "2,26 m", support: "LGMG AS0808E, Specifications, Measurements: C-Platform Length 2.26m" },
      { field: "Extensión de plataforma", value: "0,9 m", support: "LGMG AS0808E, Specifications, Measurements: H-Extension Deck 0.9m" }
    ]
  },
  {
    url: "https://en.lgmg.com.cn/product/624.htm", brand: "LGMG", model: "AS1012E", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 12,
      lengthM: 2.47, widthM: 1.18, loadCapacityKg: 320 }, fields: ["Altura de plataforma", "Longitud de plataforma", "Anchura de plataforma", "Extensión de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "10 m", support: "LGMG AS1012E, Specifications, Measurements: A-Platform Height-Raised 10m" },
      { field: "Longitud de plataforma", value: "2,26 m", support: "LGMG AS1012E, Specifications, Measurements: C-Platform Length 2.26m" },
      { field: "Anchura de plataforma", value: "1,12 m", support: "LGMG AS1012E, Specifications, Measurements: D-Platform Width 1.12m" },
      { field: "Extensión de plataforma", value: "0,9 m", support: "LGMG AS1012E, Specifications, Measurements: H-Extension Deck 0.9m" }
    ]
  },
  {
    url: "https://en.lgmg.com.cn/product/986.htm", brand: "LGMG", model: "AS0812", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 10,
      lengthM: 2.42, widthM: 1.18, loadCapacityKg: 450 }, fields: ["Altura de plataforma", "Longitud de plataforma", "Anchura de plataforma", "Extensión de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "8 m", support: "LGMG AS0812, Specifications, Measurements: A-Platform Height-Raised 8m" },
      { field: "Longitud de plataforma", value: "2,26 m", support: "LGMG AS0812, Specifications, Measurements: C-Platform Length 2.26m" },
      { field: "Anchura de plataforma", value: "1,15 m", support: "LGMG AS0812, Specifications, Measurements: D-Platform Width 1.15m" },
      { field: "Extensión de plataforma", value: "0,9 m", support: "LGMG AS0812, Specifications, Measurements: H-Extension Deck 0.9m" }
    ]
  },
  {
    url: "https://en.lgmg.com.cn/product/985.htm", brand: "LGMG", model: "AS0607W", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 7.8,
      lengthM: 1.83, widthM: 0.81, loadCapacityKg: 230 }, fields: ["Altura de plataforma", "Longitud de plataforma", "Anchura de plataforma", "Extensión de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "5,8 m", support: "LGMG AS0607W, Specifications, Measurements: A-Platform Height-Raised 5.8m" },
      { field: "Longitud de plataforma", value: "1,63 m", support: "LGMG AS0607W, Specifications, Measurements: C-Platform Length 1.63m" },
      { field: "Anchura de plataforma", value: "0,74 m", support: "LGMG AS0607W, Specifications, Measurements: D-Platform Width 0.74m" },
      { field: "Extensión de plataforma", value: "0,9 m", support: "LGMG AS0607W, Specifications, Measurements: H-Extension Deck 0.9m" }
    ]
  },
  {
    url: "https://en.lgmg.com.cn/product/625.htm", brand: "LGMG", model: "AS1212E", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 14,
      lengthM: 2.47, widthM: 1.18, loadCapacityKg: 320 }, fields: ["Altura de plataforma", "Longitud de plataforma", "Anchura de plataforma", "Extensión de plataforma"] }, facts: [
      { field: "Longitud de plataforma", value: "2,26 m", support: "LGMG AS1212E, Specifications, Measurements: C-Platform Length 2.26m" },
      { field: "Anchura de plataforma", value: "1,12 m", support: "LGMG AS1212E, Specifications, Measurements: D-Platform Width 1.12m" }
    ]
  },
  {
    url: "https://en.lgmg.com.cn/product/633.htm", brand: "LGMG", model: "AS1212", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 14,
      lengthM: 2.47, widthM: 1.18, loadCapacityKg: 320 }, fields: ["Altura de plataforma", "Longitud de plataforma", "Anchura de plataforma", "Extensión de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "12 m", support: "LGMG AS1212, Specifications, Measurements: A-Platform Height-Raised 12m" },
      { field: "Longitud de plataforma", value: "2,26 m", support: "LGMG AS1212, Specifications, Measurements: C-Platform Length 2.26m" },
      { field: "Anchura de plataforma", value: "1,15 m", support: "LGMG AS1212, Specifications, Measurements: D-Platform Width 1.15m" },
      { field: "Extensión de plataforma", value: "0,9 m", support: "LGMG AS1212, Specifications, Measurements: H-Extension Deck 0.9m" }
    ]
  },
  {
    url: "https://www.lgmglifts.com/product/pro-detail-620.htm", brand: "LGMG", model: "SS0507E", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 6.3,
      lengthM: 1.53, widthM: 0.81, loadCapacityKg: 230 }, fields: ["Altura de plataforma", "Longitud de plataforma", "Anchura de plataforma", "Extensión de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "4,3 m", support: "LGMG SS0507E, Specifications, Measurements, A: altura elevada 4.3 m" },
      { field: "Longitud de plataforma", value: "1,35 m", support: "LGMG SS0507E, Specifications, Measurements, B: longitud de plataforma 1.35 m" },
      { field: "Anchura de plataforma", value: "0,7 m", support: "LGMG SS0507E, Specifications, Measurements, C: anchura de plataforma 0.7 m" },
      { field: "Extensión de plataforma", value: "0,6 m", support: "LGMG SS0507E, Specifications, Measurements, G: extensión de plataforma 0.6 m" }
    ]
  },
  {
    url: "https://www.lgmglifts.com/product/pro-detail-990.htm", brand: "LGMG", model: "SR1023D", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "diésel", workingHeightM: 12,
      lengthM: 4.9, widthM: 2.3, loadCapacityKg: 1100 }, fields: ["Altura de plataforma", "Anchura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "10 m", support: "LGMG SR1023D, Specifications, Measurements, A: altura elevada 10 m, común a ambas configuraciones de plataforma" },
      { field: "Anchura de plataforma", value: "1,83 m", support: "LGMG SR1023D, Specifications, Measurements, D: anchura 1.83 m; la tabla distingue longitudes y extensiones alternativas, no se recuperan" }
    ]
  },
  {
    url: "https://dam.jlg.com/DigizuiteCore/LegacyService/api/assetstream/143203?timestamp=2026-07-29T00%3A14%3A53.1548290", brand: "Jlg", model: "2646ES", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 9.92,
      lengthM: 2.5, widthM: 1.17, loadCapacityKg: 450 }, fields: ["Altura de plataforma", "Longitud de plataforma", "Anchura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "7,92 m", support: "JLG Specifications 2015 CE, página 12, 2646ES, A: altura elevada 7.92 m" },
      { field: "Longitud de plataforma", value: "2,50 m", support: "JLG Specifications 2015 CE, páginas 12-13, 2646ES, E: longitud de plataforma principal 2,50 m" },
      { field: "Anchura de plataforma", value: "1,12 m", support: "JLG Specifications 2015 CE, páginas 12-13, 2646ES, E: anchura de plataforma principal 1,12 m" }
    ]
  },
  {
    url: "https://dam.jlg.com/DigizuiteCore/LegacyService/api/assetstream/143203?timestamp=2026-07-29T00%3A14%3A53.1548290", brand: "Jlg", model: "3246ES", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 11.68,
      lengthM: 2.5, widthM: 1.17, loadCapacityKg: 320 }, fields: ["Altura de plataforma", "Longitud de plataforma", "Anchura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "9,68 m", support: "JLG Specifications 2015 CE, página 12, 3246ES, A: altura elevada 9.68 m" },
      { field: "Longitud de plataforma", value: "2,50 m", support: "JLG Specifications 2015 CE, páginas 12-13, 3246ES, E: longitud de plataforma principal 2,50 m" },
      { field: "Anchura de plataforma", value: "1,12 m", support: "JLG Specifications 2015 CE, páginas 12-13, 3246ES, E: anchura de plataforma principal 1,12 m" }
    ]
  },
  {
    url: "https://www.snorkellifts.com/sites/default/files/pdf/english-ce-met/S3970RT.pdf", brand: "Snorkel", model: "S3970RT", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "diésel", workingHeightM: 13.8,
      lengthM: 3.4, widthM: 1.8, loadCapacityKg: 350 }, fields: ["Longitud de plataforma", "Anchura de plataforma", "Extensión de plataforma"] }, facts: [
      { field: "Longitud de plataforma", value: "2,8 m", support: "Snorkel CE 01/2021, página 2, S3970RT, dimensiones B: plataforma principal replegada 1.6 x 2.8 m" },
      { field: "Anchura de plataforma", value: "1,6 m", support: "Snorkel CE 01/2021, página 2, S3970RT, dimensiones B: plataforma principal replegada 1.6 x 2.8 m" },
      { field: "Extensión de plataforma", value: "1,2 m", support: "Snorkel CE 01/2021, página 2, S3970RT: extensión 1.2 m, equipamiento estándar; plataforma extendida 1.6 x 4.0 m" }
    ]
  },
  {
    url: "https://dam.jlg.com/DigizuiteCore/LegacyService/api/assetstream/143203?timestamp=2026-07-29T00%3A14%3A53.1548290", brand: "Jlg", model: "3369LE", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 12.06,
      lengthM: 3.07, widthM: 1.75, loadCapacityKg: 450 }, fields: ["Altura de plataforma", "Longitud de plataforma", "Anchura de plataforma", "Extensión de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "10,06 m", support: "JLG Specifications 2015 CE, página 16, 3369LE, A: altura elevada 10,06 m" },
      { field: "Longitud de plataforma", value: "2,92 m", support: "JLG Specifications 2015 CE, página 16, 3369LE, E: longitud de plataforma principal 2,92 m" },
      { field: "Anchura de plataforma", value: "1,65 m", support: "JLG Specifications 2015 CE, página 16, 3369LE, E: anchura de plataforma principal 1,65 m" },
      { field: "Extensión de plataforma", value: "0,91 m", support: "JLG Specifications 2015 CE, página 16, 3369LE, F: extensión 0,91 m" }
    ]
  },
  {
    url: "https://dam.jlg.com/DigizuiteCore/LegacyService/api/assetstream/143203?timestamp=2026-07-29T00%3A14%3A53.1548290", brand: "Jlg", model: "4069LE", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 14.19,
      lengthM: 3.07, widthM: 1.75, loadCapacityKg: 360 }, fields: ["Altura de plataforma", "Longitud de plataforma", "Anchura de plataforma", "Extensión de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "12,19 m", support: "JLG Specifications 2015 CE, página 16, 4069LE, A: altura elevada 12,19 m" },
      { field: "Longitud de plataforma", value: "2,92 m", support: "JLG Specifications 2015 CE, página 16, 4069LE, E: longitud de plataforma principal 2,92 m" },
      { field: "Anchura de plataforma", value: "1,65 m", support: "JLG Specifications 2015 CE, página 16, 4069LE, E: anchura de plataforma principal 1,65 m" },
      { field: "Extensión de plataforma", value: "0,91 m", support: "JLG Specifications 2015 CE, página 16, 4069LE, F: extensión 0,91 m" }
    ]
  },
  {
    url: "https://dam.jlg.com/DigizuiteCore/LegacyService/api/assetstream/143203?timestamp=2026-07-29T00%3A14%3A53.1548290", brand: "JLG", model: "4069LE", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 14.19,
      lengthM: 3.07, widthM: 1.75, loadCapacityKg: 360 }, fields: ["Altura de plataforma", "Longitud de plataforma", "Anchura de plataforma", "Extensión de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "12,19 m", support: "JLG Specifications 2015 CE, página 16, 4069LE, A: altura elevada 12,19 m" },
      { field: "Longitud de plataforma", value: "2,92 m", support: "JLG Specifications 2015 CE, página 16, 4069LE, E: longitud de plataforma principal 2,92 m" },
      { field: "Anchura de plataforma", value: "1,65 m", support: "JLG Specifications 2015 CE, página 16, 4069LE, E: anchura de plataforma principal 1,65 m" },
      { field: "Extensión de plataforma", value: "0,91 m", support: "JLG Specifications 2015 CE, página 16, 4069LE, F: extensión 0,91 m" }
    ]
  },
  {
    url: "https://www.lgmglifts.com/es/product/pro-detail-5033.htm", brand: "LGMG", model: "A09JE", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "eléctrica", workingHeightM: 11,
      lengthM: 5.46, widthM: 1.19, loadCapacityKg: 230 }, fields: ["Altura de plataforma", "Longitud de plataforma", "Anchura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "9 m", support: "LGMG A09JE, sección Medidas: altura de plataforma 9 m" },
      { field: "Longitud de plataforma", value: "1,17 m", support: "LGMG A09JE, sección Medidas: longitud de plataforma 1,17 m" },
      { field: "Anchura de plataforma", value: "0,76 m", support: "LGMG A09JE, sección Medidas: anchura de plataforma 0,76 m" }
    ]
  },
  {
    url: "https://www.lgmglifts.com/es/product/pro-detail-5034.htm", brand: "LGMG", model: "A13JE", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "eléctrica", workingHeightM: 15,
      lengthM: 6.7, widthM: 1.5, loadCapacityKg: 200 }, fields: ["Altura de plataforma", "Longitud de plataforma", "Anchura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "13 m", support: "LGMG A13JE, sección Medidas: altura de plataforma 13 m" },
      { field: "Longitud de plataforma", value: "1,2 m", support: "LGMG A13JE, sección Medidas: longitud de plataforma 1,2 m" },
      { field: "Anchura de plataforma", value: "0,9 m", support: "LGMG A13JE, sección Medidas: anchura de plataforma 0,9 m" }
    ]
  },
  {
    url: "https://en.lgmg.com.cn/product/631.htm", brand: "LGMG", model: "AS0808", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 10,
      lengthM: 2.4, widthM: 0.83, loadCapacityKg: 230 }, fields: ["Longitud de plataforma", "Anchura de plataforma", "Extensión de plataforma"] }, facts: [
      { field: "Longitud de plataforma", value: "2,26 m", support: "LGMG AS0808, Specifications, Measurements: C-Platform Length 2.26m" },
      { field: "Anchura de plataforma", value: "0,81 m", support: "LGMG AS0808, Specifications, Measurements: D-Platform Width 0.81m" },
      { field: "Extensión de plataforma", value: "0,9 m", support: "LGMG AS0808, Specifications, Measurements: H-Extension Deck 0.9m; indoor-use model" }
    ]
  },
  {
    url: "https://www.lgmglifts.com/product/pro-detail-4896.htm", brand: "LGMG", model: "AR20J", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "diésel", workingHeightM: 21.58,
      lengthM: 9.42, widthM: 2.5, loadCapacityKg: 260 }, fields: ["Altura de plataforma", "Longitud de plataforma", "Anchura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "19,58 m", support: "LGMG AR20J, Specifications, Measurements: Platform Height 19.58m; distinct from restricted/unrestricted capacity" },
      { field: "Longitud de plataforma", value: "2,44 m", support: "LGMG AR20J, Specifications, Measurements: Platform Length 2.44m" },
      { field: "Anchura de plataforma", value: "0,9 m", support: "LGMG AR20J, Specifications, Measurements: Platform Width 0.9m" }
    ]
  },
  {
    url: "https://www.lgmglifts.com/product/pro-detail-2030.htm", brand: "LGMG", model: "S1413EII", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 15.8,
      lengthM: 2.8, widthM: 1.3, loadCapacityKg: 320 }, fields: ["Longitud de plataforma", "Anchura de plataforma", "Extensión de plataforma"] }, facts: [
      { field: "Longitud de plataforma", value: "2,64 m", support: "LGMG S1413EII, Specifications, Measurements: B-Platform Length 2.64m" },
      { field: "Anchura de plataforma", value: "1,12 m", support: "LGMG S1413EII, Specifications, Measurements: C-Platform Width 1.12m" },
      { field: "Extensión de plataforma", value: "0,9 m", support: "LGMG S1413EII, Specifications, Measurements: H-Extension Deck 0.9m; geometry common to indoor/outdoor use, height limits differ (13.8/8m platform height)" }
    ]
  },
  {
    url: "https://www.cc-heftrucks.be/fileadmin/pdf/technical%20sheets/technical%20sheets%20hoogwerkers/Knikhoogwerkers/CC_Heftrucks_fiche_hoogwerker_knikarm_340AJ.pdf", brand: "JLG", model: "340AJ", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "diésel", workingHeightM: 12.33,
      lengthM: 5.52, widthM: 1.93, loadCapacityKg: 230 }, fields: ["Altura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "10,33 m", support: "JLG 340AJ, especificaciones 2010, página 1: altura de plataforma 10,33 m; manual JLG 3121258, tabla 6-2, CE y Australia; no atribuye dimensiones de cesta opcional" }
    ]
  },
  {
    url: "https://www.afi-rentals.co.uk/pdf/specifications/afi-resale/new/articulating-boom-lifts/jlg/600AJ_EN.pdf", brand: "JLG", model: "600AJ", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "diésel", workingHeightM: 20.46,
      lengthM: 8.82, widthM: 2.49, loadCapacityKg: 230 }, fields: ["Altura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "18,46 m", support: "Ficha JLG EMEA 600AJ, página 2, Performance: altura de plataforma 18,46 m; altura de trabajo 20,46 m; dimensiones de cesta opcionales no atribuidas" }
    ]
  },
  {
    url: "https://assets-eu-01.kc-usercontent.com/30405c01-b7f1-01d2-1201-2b428c3cf113/b1ef2a68-f977-4e67-9ec7-eafc5507a7e3/jlg-800aj-datasheet.pdf", brand: "JLG", model: "800AJ", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "diésel", workingHeightM: 26.38,
      lengthM: 11.12, widthM: 2.44, loadCapacityKg: 230 }, fields: ["Altura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "24,38 m", support: "JLG Europe SL006-ENGLISH, página 2, columna 800AJ: altura de plataforma 24,38 m; anchura 2,44 m, longitud 11,12 m y capacidad 230 kg; corroborada por ficha JLG Italia 800AJ, sección Prestazioni: altura de trabajo 26,38 m y plataforma 24,38 m; no atribuye cestas opcionales" }
    ]
  },
  {
    url: "https://dam.jlg.com/DigizuiteCore/LegacyService/api/assetstream/143203?timestamp=2026-07-29T00%3A14%3A53.1548290", brand: "JLG", model: "E300AJP", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "eléctrica", workingHeightM: 10.97,
      lengthM: 5.74, widthM: 1.22, loadCapacityKg: 230 }, fields: ["Altura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "8,97 m", support: "JLG Specifications 2015 CE, página 4, columna E300AJP: altura de plataforma 8,97 m; altura de trabajo 10,97 m; longitud 5,74 m, anchura 1,22 m y capacidad 230 kg; no extrapola alcance ni peso" }
    ]
  },
  {
    url: "https://dam.jlg.com/DigizuiteCore/LegacyService/api/assetstream/143203?timestamp=2026-07-29T00%3A14%3A53.1548290", brand: "JLG", model: "E400AJPN", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "eléctrica", workingHeightM: 14.19,
      lengthM: 6.71, widthM: 1.5, loadCapacityKg: 230 }, fields: ["Altura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "12,19 m", support: "JLG Specifications 2015 CE, página 6, columna E400AJPn: altura de plataforma 12,19 m, altura de trabajo 14,19 m, longitud 6,71 m, anchura 1,50 m y capacidad 230 kg; no atribuye las dimensiones opcionales de cesta de la página 35" }
    ]
  },
  {
    url: "https://www.haulotte.com.es/es_ES/productos/ha16-rtj", brand: "HAULOTTE", model: "HA 16 RTJ", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "diésel", workingHeightM: 16,
      lengthM: 6.75, widthM: 2.3, loadCapacityKg: 230 }, fields: ["Altura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "14 m", support: "Haulotte HA16 RTJ, Datos Técnicos: altura de plataforma 14 m, altura de trabajo 16 m, capacidad 230 kg, largo replegado 6,75 m y ancho 2,3 m; corroborado por ficha CE HA16 RTJ / RTJ O de abril de 2024, página 2; no atribuye dimensiones de cesta opcional" }
    ]
  },
  {
    url: "https://portalimages.blob.core.windows.net/products/pdfs/xuj041hy_Data-sheet-170-AETJ-L.pdf", brand: "MANITOU", model: "170 AETJ-L", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "eléctrica", workingHeightM: 16.9,
      lengthM: 6.84, widthM: 1.75, loadCapacityKg: 200 }, fields: ["Altura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "14,9 m", support: "Manitou 170 AETJ-L, ficha del 22/02/2021, página 2, h7: altura de plataforma 14,9 m, h21 16,9 m, Q 200 kg, l1 6,84 m y b1 1,75 m; corroborada por ficha CE FT016EN_A_0812_170AETJL de 2012; no aplicable a Bi-Energy ni a otras variantes ni se recupera geometría de cesta" }
    ]
  },
  {
    url: "https://www.cruzaraba.es/images/pdf/plataforma-brazo-articulado-diesel/brazos-articulados-diesel-21m-haulotte.pdf", brand: "HAULOTTE", model: "HA 20 PX", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "diésel", workingHeightM: 20.65,
      lengthM: 8.93, widthM: 2.38, loadCapacityKg: 230 }, fields: ["Altura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "18,65 m", support: "Haulotte HA20 PX, ficha 11/2011, página 2, Datos técnicos: altura de plataforma 18,65 m, trabajo 20,65 m, largo replegado 8,93 m, ancho 2,38 m, capacidad 230 kg; no atribuye cesta larga ni opción de 250 kg" }
    ]
  },
  {
    url: "https://rallco.se/wp-content/uploads/2020/09/HA260PX-Informationsbroschyr.pdf", brand: "HAULOTTE", model: "HA 260 PX", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "diésel", workingHeightM: 25.6,
      lengthM: 12, widthM: 2.38, loadCapacityKg: 230 }, fields: ["Altura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "23,6 m", support: "Haulotte HA260 PX, ficha de 2012, página 2, Technical data: altura de plataforma 23,6 m, trabajo 25,6 m, largo 12 m, ancho 2,38 m, capacidad 230 kg; corroborado en ficha española 10/2014; no atribuye altura replegada ni cesta opcional" }
    ]
  },
  {
    url: "https://irp.cdn-website.com/18c68e09/files/uploaded/Haulotte-HA12IP-UK-BD.pdf", brand: "Haulotte", model: "HA12IP", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "eléctrica", workingHeightM: 12,
      lengthM: 5.45, widthM: 1.35, loadCapacityKg: 230 }, fields: ["Altura de plataforma", "Anchura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "10 m", support: "Haulotte HA12IP, ficha 03/2012, página 2, datos técnicos: altura de plataforma 10 m, trabajo 12 m, largo 5,45 m, ancho 1,35 m y capacidad 230 kg" },
      { field: "Anchura de plataforma", value: "0,8 m", support: "Haulotte HA12IP, ficha 03/2012, página 2, cota G: 0,8 m tanto en cesta estándar 1,2 x 0,8 m como en opción 1,5 x 0,8 m; no atribuye la dimensión F variable" }
    ]
  },
  {
    url: "https://joysat.eu/wp-content/uploads/2020/09/Caracter%C2%B0stiques-Ta%CC%88cniques-HA15IP.pdf", brand: "Haulotte", model: "HA15IP", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "eléctrica", workingHeightM: 15,
      lengthM: 6.6, widthM: 1.5, loadCapacityKg: 230 }, fields: ["Altura de plataforma", "Anchura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "13 m", support: "Haulotte HA15IP, ficha 06/2012, página 2, datos técnicos: altura de plataforma 13 m, trabajo 15 m, largo 6,6 m, ancho 1,5 m y capacidad 230 kg" },
      { field: "Anchura de plataforma", value: "0,8 m", support: "Haulotte HA15IP, ficha 06/2012, página 2, cota G: 0,8 m tanto en cesta estándar 1,2 x 0,8 m como en opción 1,4 x 0,8 m; no atribuye la dimensión F variable" }
    ]
  },
  {
    url: "https://joysat.eu/wp-content/uploads/2020/09/Caracter%C2%B0stiques-Ta%CC%88cniques-HA15IP.pdf", brand: "HAULOTTE", model: "HA 15 IP", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "eléctrica", workingHeightM: 15,
      lengthM: 6.6, widthM: 1.5, loadCapacityKg: 230 }, fields: ["Altura de plataforma", "Anchura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "13 m", support: "Haulotte HA 15 IP, ficha 06/2012, página 2, datos técnicos: altura de plataforma 13 m, trabajo 15 m, largo 6,6 m, ancho 1,5 m y capacidad 230 kg" },
      { field: "Anchura de plataforma", value: "0,8 m", support: "Haulotte HA 15 IP, ficha 06/2012, página 2, cota G: 0,8 m tanto en cesta estándar 1,2 x 0,8 m como en opción 1,4 x 0,8 m; no atribuye la dimensión F variable" }
    ]
  },
  {
    url: "https://www.eagleplatforms.com/wp-content/uploads/HAULOTTE-COMPACT-12DX-SPEC-SHEET.pdf", brand: "HAULOTTE", model: "COMPACT 12 DX", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "diésel", workingHeightM: 12.06,
      lengthM: 3.17, widthM: 1.78, loadCapacityKg: 450 }, fields: ["Altura de plataforma", "Longitud de plataforma", "Anchura de plataforma", "Extensión de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "10,06 m", support: "Haulotte Compact 12 DX, ficha 06/2013, ref. 400007370, página 2: altura de plataforma 10,06 m, largo 3,17 m, ancho 1,78 m, trabajo 12,06 m y capacidad 450 kg; altura corroborada en ficha 12/2024" },
      { field: "Longitud de plataforma", value: "2,45 m", support: "Haulotte Compact 12 DX, fichas 06/2013 y 12/2024, página 2, cota F: longitud de plataforma 2,45 m" },
      { field: "Anchura de plataforma", value: "1,45 m", support: "Haulotte Compact 12 DX, fichas 06/2013 y 12/2024, página 2, cota G: anchura de plataforma 1,45 m" },
      { field: "Extensión de plataforma", value: "1,2 m", support: "Haulotte Compact 12 DX, fichas 06/2013 y 12/2024, página 2, datos técnicos y equipamiento estándar: una extensión de 1,2 m" }
    ]
  },
  {
    url: "https://www.coalci.es/wp-content/uploads/2020/02/HA32_RTJ_PRO_ES_BD.pdf", brand: "HAULOTTE", model: "HA 32 RTJ PRO", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "diésel", workingHeightM: 31.8,
      lengthM: 11.7, widthM: 2.53, loadCapacityKg: 250 }, fields: ["Altura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "29,8 m", support: "Haulotte HA32 RTJ PRO, ficha 05/2019, página 2, datos técnicos: altura de plataforma 29,8 m, trabajo 31,8 m, largo replegado 11,7 m, ancho 2,53 m y capacidad 250 kg; corroborado en ficha técnica oficial española vigente" }
    ]
  },
  {
    url: "https://www.cc-equipment.be/fileadmin/user_upload/ES1932_2020_EN.pdf", brand: "JLG", model: "ES1932", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 7.8,
      lengthM: 1.74, widthM: 0.81, loadCapacityKg: 230 }, fields: ["Altura de plataforma", "Longitud de plataforma", "Anchura de plataforma", "Extensión de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "5,8 m", support: "JLG EMEA ES1932, ficha 2020, página 2, Performance: altura de plataforma elevada 5,8 m; altura de trabajo 7,8 m, capacidad 230 kg interior y exterior" },
      { field: "Longitud de plataforma", value: "1,59 m", support: "JLG EMEA ES1932, ficha 2020, página 2, cota E: longitud de plataforma 1,59 m; corroborada por ficha EMEA de dimensiones" },
      { field: "Anchura de plataforma", value: "0,64 m", support: "JLG EMEA ES1932, ficha 2020, página 2, cota E: anchura de plataforma 0,64 m; corroborada por ficha EMEA de dimensiones" },
      { field: "Extensión de plataforma", value: "0,86 m", support: "JLG EMEA ES1932, ficha 2020, página 1, equipamiento estándar y página 2, cota F: extensión de 0,86 m; no atribuye capacidad de extensión" }
    ]
  },
  {
    url: "https://sosequipment.ca/wp-content/uploads/2023/05/R4045-SpecSheet-English.pdf", brand: "Jlg", model: "R4045", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 13.96,
      lengthM: 2.71, widthM: 1.14, loadCapacityKg: 350 }, fields: ["Longitud de plataforma", "Anchura de plataforma", "Extensión de plataforma"] }, facts: [
      { field: "Longitud de plataforma", value: "2,43 m", support: "JLG EMEA R4045, página 2, Performance, cota E: longitud interior 2,43 m; capacidad de 350 kg solo interior, no se atribuyen alturas de uso" },
      { field: "Anchura de plataforma", value: "1,05 m", support: "JLG EMEA R4045, página 2, Performance, cota E: anchura interior 1,05 m" },
      { field: "Extensión de plataforma", value: "0,91 m", support: "JLG EMEA R4045, página 1, equipamiento estándar y página 2, cota F: extensión de 0,91 m; no atribuye capacidad de extensión" }
    ]
  },
  {
    url: "https://media.gruasestacion.com/modelos/43/documentos/Datos_T%C3%A9cnicos.pdf", brand: "HAULOTTE", model: "H15 SXL", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "diésel", workingHeightM: 15,
      lengthM: 5.3, widthM: 2.25, loadCapacityKg: 500 }, fields: ["Altura de plataforma", "Longitud de plataforma", "Anchura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "13 m", support: "Haulotte H15 SXL, ficha 01/2016, página 2, datos técnicos: altura de plataforma 13 m, trabajo 15 m, longitud de transporte 5,3 m, ancho 2,25 m y capacidad 500 kg; no atribuye altura máxima de traslación" },
      { field: "Longitud de plataforma", value: "5,3 m", support: "Haulotte H15 SXL, ficha 01/2016, página 2: largo de plataforma sin extender 5,3 m; no atribuye extensión doble a un campo de extensión único" },
      { field: "Anchura de plataforma", value: "1,89 m", support: "Haulotte H15 SXL, ficha 01/2016, página 2: ancho de plataforma 1,89 m" }
    ]
  },
  {
    url: "https://www.coalci.es/wp-content/uploads/2019/07/H12_15_18SX-ES_BD.pdf", brand: "HAULOTTE", model: "H18 SX", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "diésel", workingHeightM: 18,
      lengthM: 4.18, widthM: 2.25, loadCapacityKg: 500 }, fields: ["Altura de plataforma", "Longitud de plataforma", "Anchura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "16 m", support: "Haulotte H18 SX, ficha 03/2018, página 2, datos técnicos: altura de plataforma 16 m, trabajo 18 m, longitud de transporte 4,18 m, ancho 2,25 m y capacidad 500 kg; no atribuye altura máxima de traslación" },
      { field: "Longitud de plataforma", value: "4 m", support: "Haulotte H18 SX, ficha 03/2018, página 2: largo de plataforma sin extender 4 m; no atribuye extensión doble a un campo de extensión único" },
      { field: "Anchura de plataforma", value: "1,89 m", support: "Haulotte H18 SX, ficha 03/2018, página 2: ancho de plataforma 1,89 m" }
    ]
  },
  {
    url: "https://www.w-schnitger.de/fileadmin/paeusergruppe/Arbeitsbuehne/Scherenarbeitsbuehnen/Haulotte_OPTIMUM_8_AE.pdf", brand: "HAULOTTE", model: "OPTIMUM 8 AE", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 7.77,
      lengthM: 1.9, widthM: 0.79, loadCapacityKg: 230 }, fields: ["Altura de plataforma", "Extensión de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "5,77 m", support: "Haulotte OPTIMUM 8, ficha alemana 05/2024, página 2: altura de plataforma 5,77 m, trabajo 7,77 m, largo 1,9 m, ancho 0,79 m y capacidad 230 kg interior y exterior; ficha enlazada por distribuidor Haulotte como Optimum 8 AE" },
      { field: "Extensión de plataforma", value: "0,86 m", support: "Haulotte OPTIMUM 8, ficha alemana 05/2024, página 2: extensión 0,86 m; corroborada en ficha oficial española, no atribuye capacidad de la extensión" }
    ]
  },
  {
    url: "https://www.tecnorent.com/imgs-productos/plataformas-tijera-diesel/jlg530lrt.pdf", brand: "JLG", model: "530LRT", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "diésel", workingHeightM: 18.15,
      lengthM: 4.88, widthM: 2.31, loadCapacityKg: 680 }, fields: ["Altura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "16,15 m", support: "JLG EMEA 530LRT, página 2, Performance: altura elevada de plataforma 16,15 m, trabajo 18,15 m, largo 4,88 m, ancho 2,31 m, capacidad 680 kg; no atribuye dimensiones de cesta ni extensiones opcionales" }
    ]
  },
  {
    url: "https://www.lejarzamaquinaria.com/wp-content/uploads/2023/07/150-AETJ-C.pdf", brand: "MANITOU", model: "150 AETJ C", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "eléctrica", workingHeightM: 15,
      lengthM: 6.05, widthM: 1.5, loadCapacityKg: 200 }, fields: ["Altura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "13 m", support: "Manitou 150 AETJ-C, ficha del 27/02/2023, página 2, h7: altura de plataforma 13 m, h21 15 m, Q 200 kg, l1 6,05 m y b1 1,50 m; corroborada por ficha CE FT015ES_B_0912_150AETJC de 2012. No aplicable a la versión posterior de 220 kg ni se recuperan dimensiones de cesta variables" }
    ]
  },
  {
    url: "https://www.genielift.com/docs/default-source/product-specifications/articulated-boom-lift/es/2022/zboomspec_z30_20n_z30_20n_rj_es_emear_lr.pdf", brand: "GENIE", model: "Z-30-20 N", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "eléctrica", workingHeightM: 11.14,
      lengthM: 5.11, widthM: 1.19, loadCapacityKg: 227 }, fields: ["Altura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "9,14 m", support: "Genie Z-30/20N, ficha CE EMEAR 2022, página 1, Especificaciones y Productividad: altura máxima de cesta 9,14 m, trabajo 11,14 m, largo replegado 5,11 m, ancho 1,19 m y capacidad sin restricciones 227 kg; corroborada por ficha europea 2020. No atribuye dimensiones de cestas alternativas ni peso de la unidad" }
    ]
  },
  {
    url: "https://www.genielift.com/docs/default-source/product-specifications/articulated-boom-lift/es/2022/zboomspec_z30_20n_z30_20n_rj_es_emear_lr.pdf", brand: "GENIE", model: "Z-30-20 N RJ", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "eléctrica", workingHeightM: 10.89,
      lengthM: 5.31, widthM: 1.19, loadCapacityKg: 227 }, fields: ["Altura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "8,89 m", support: "Genie Z-30/20N RJ, ficha CE EMEAR 2022, página 1, Especificaciones y Productividad: altura máxima de cesta 8,89 m, trabajo 10,89 m, largo replegado 5,31 m, ancho 1,19 m y capacidad sin restricciones 227 kg; corroborada por ficha europea 2020. No atribuye dimensiones de cestas alternativas ni peso de la unidad" }
    ]
  }
];

const claimHash = (document: ReviewedModelDocument, fact: ReviewedModelFact): string =>
  technicalDocumentClaimSha256(document, fact.field, fact.value, document.reviewedOn, fact.support);

export const reviewedModelDocumentVerification = (
  document: TechnicalDocumentReference, field: string, value: string
): TechnicalDocumentVerification | null => {
  const matches = documents.filter((entry) => entry.url === document.url &&
    entry.brand === document.brand && entry.model === document.model).flatMap((entry) =>
    entry.facts.filter((fact) => fact.field === field && fact.value === value).map((fact) => ({ entry, fact })));
  if (matches.length > 1) throw new Error("Acreditación documental repetida");
  const matched = matches[0];
  if (!matched) return null;
  return { kind: "reviewed-model-fact", reviewedOn: matched.entry.reviewedOn,
    support: matched.fact.support, claimSha256: claimHash(matched.entry, matched.fact) };
};

export const reviewedModelDocumentClaims = (): readonly {
  readonly document: TechnicalDocumentReference;
  readonly field: string;
  readonly value: string;
  readonly verification: TechnicalDocumentVerification;
}[] => documents.flatMap((entry) => entry.facts.map((fact) => ({
  document: { url: entry.url, brand: entry.brand, model: entry.model },
  field: fact.field, value: fact.value,
  verification: { kind: "reviewed-model-fact", reviewedOn: entry.reviewedOn,
    support: fact.support, claimSha256: claimHash(entry, fact) }
})));

export const reusableReviewedModelClaims = (brand: string, model: string) => documents
  .filter((entry) => entry.brand === brand && entry.model === model && entry.reuse !== undefined)
  .flatMap((entry) => {
    const reuse = entry.reuse;
    if (!reuse) return [];
    const facts = documents.filter((document) => document.brand === brand && document.model === model &&
      document.url === entry.url).flatMap((document) => document.facts.filter((fact) => reuse.fields.includes(fact.field)));
    return [{ url: entry.url, compatibility: reuse.compatibility, facts }];
  });

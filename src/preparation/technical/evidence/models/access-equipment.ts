import type { ReviewedModelDocument } from "./types.js";

export const accessEquipmentDocuments: readonly ReviewedModelDocument[] = [
  {
    url: "https://assets-global.website-files.com/6076df67e862471f3868ae5f/6107c525a4c12a6946856f3b_OPERATOR%20MANUAL%20-%20NIFTY%20LIFT%20HR21%20DIESEL.pdf", brand: "Niftylift", model: "HR21D 4X4", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "diésel", workingHeightM: 21,
      invariantGeometry: true, firstYear: 2015, lastYear: 2015 }, fields: ["Rotación de torreta"] }, facts: [
      { field: "Rotación de torreta", value: "355°", support: "Manual Nifty HR21 4x4 diésel, 09/12, apartado 1.5 p. 4: turret rotation 355°, capacidad europea 225 kg." }
    ]
  },
  {
    url: "https://www.myrlandkran.no/file/58611b104685/Brosjyre%20Skyjack%20SJ6832RTE%20(Engelsk).pdf", brand: "Skyjack", model: "SJ6832RT", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "diésel", workingHeightM: 12,
      invariantGeometry: true, firstYear: 2014, lastYear: 2015 }, fields: ["Longitud de plataforma", "Anchura de plataforma"] }, facts: [
      { field: "Longitud de plataforma", value: "2,44 m", support: "Skyjack Compact Series 11/2010, p. 2, SJ6832 RT: I 96 in y H 56 in; corroborados en ficha fabricante KC 04/2020 (2,44 m y 1,42 m)." },
      { field: "Anchura de plataforma", value: "1,42 m", support: "Skyjack Compact Series 11/2010, p. 2, SJ6832 RT: I 96 in y H 56 in; corroborados en ficha fabricante KC 04/2020 (2,44 m y 1,42 m)." }
    ]
  },
  {
    url: "https://gtmpoweredaccess.co.uk/media/hollandlift-n-120-140-165-195el12-gtm-operator-manual.pdf", brand: "Hollandlift", model: "N-165EL12", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 18.5,
      invariantGeometry: true, firstYear: 2011, lastYear: 2011 }, fields: ["Extensión de plataforma", "Longitud de plataforma", "Anchura de plataforma"] }, facts: [
      { field: "Extensión de plataforma", value: "1,5 m", support: "Holland Lift N-120/140/165/195EL12 Rev. A, 21/11/2007, apartado 2.4.3, p. 11, N-165EL12: extensión de plataforma 1,50 m, altura 18,5 m y capacidad 500 kg; corroborada en manual HL-190 E12/N-165EL12 Rev. F 2018, apartado 10.3, p. 52. No altera capacidad ni altura." },
      { field: "Longitud de plataforma", value: "3,38 m", support: "Holland Lift N-120/140/165/195EL12 Rev. A, 21/11/2007, apartado 2.4.3, p. 11, N-165EL12: Platform (retracted), 3,38 x 1,16 m." },
      { field: "Anchura de plataforma", value: "1,16 m", support: "Misma tabla, Platform (retracted), 3,38 x 1,16 m; anchura constante con plataforma extendida." }
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
    url: "https://snorkellifts.com/german-debut-for-new-snorkel-electric-scissor-lifts-at-platformers-days/", brand: "SNORKEL", model: "S3219E", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 7.79, advertisedHeightClassM: 8,
      lengthM: 1.78, widthM: 0.81, loadCapacityKg: 250, firstYear: 2016, lastYear: 2018 }, fields: ["Altura de plataforma"] },
    facts: [
      { field: "Altura de plataforma", value: "5,79 m", support: "Snorkel, presentación europea del 2015: S3219E, altura de plataforma 5,79 m, chasis 0,81 m y carga 250 kg. Presentación APEX Asia 2017 confirma longitud 1,78 m, anchura 0,81 m y altura de trabajo 7,79 m (clase comercial 8 m). Ficha CE del fabricante S3219E confirma la misma altura de plataforma. No atribuye dimensiones de cesta ni peso de la unidad." }
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
    url: "https://www.skyjack.com/sites/default/files/specifications/ENEU-SJ9241-50RT_0.pdf", brand: "Skyjack", model: "SJ9250",
    reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "15,24 m", support: "SJ9250 RT | Raised Platform Height | 15.24 m" },
      { field: "Anchura (mm)", value: "2,34 m", support: "SJ9250 RT | Overall Width | 2.34 m" },
      { field: "Anchura de plataforma", value: "1,88 m", support: "SJ9250 RT | Platform Width (Inside Dimension) | 1.88 m" }
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
    url: "https://www.equipostrex.com/chi/producto/plataforma-elevadora-snake-2010-plus/", brand: "Oil & Steel", model: "SNAKE 2010 PLUS",
    reviewedOn: "2026-11-21", facts: [
      { field: "Anchura de plataforma", value: "0,7 m", support: "Snake 2010 Plus | Plataforma | 1400 x 700 x h 1100 mm" },
      { field: "Longitud de plataforma", value: "1,4 m", support: "Snake 2010 Plus | Plataforma | 1400 x 700 x h 1100 mm" }
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
    url: "https://www.skyjack.com/sites/default/files/specifications/SJ9250_RT.pdf", brand: "Skyjack", model: "SJ9250",
    reviewedOn: "2026-11-21", facts: [
      { field: "Longitud de plataforma", value: "4,27 m", support: "Skyjack SJ9250 RT, catálogo NA/ENG/03/2018, pág. 2: I Platform Length (Inside Dimension) | 168 in (4.27 m)" }
    ]
  },
  {
    url: "https://ctelift.com/nuovi-prodotti-cte-2021/", brand: "CTE", model: "MP 24 C",
    reviewedOn: "2026-11-21", facts: [
      { field: "Altura sobre obstáculos", value: "10,5 m", support: "CTE MP 24 C: possibilità di scavalco di m 10,5" }
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
    url: "https://www.skyjack.com/sites/default/files/literature-library/KC_SJ6832_RT_TEAR_SHEET_WEB.pdf", brand: "Skyjack", model: "SJ6832RT", reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "9,75 m", support: "Skyjack SJ6832 RT, página 2: B Raised Platform Height 9.75 m" },
      { field: "Anchura (mm)", value: "1,76 m", support: "Skyjack SJ6832 RT, página 2: D Overall Width 1.76 m" },
      { field: "Capacidad máxima de plataforma", value: "454 kg", support: "Skyjack SJ6832 RT, página 2: Capacity (Overall) 454 kg" },
      { field: "Extensión de plataforma", value: "1,52 m", support: "Skyjack SJ6832 RT, página 2: Extension Deck 1.52 m" }
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
  }
];

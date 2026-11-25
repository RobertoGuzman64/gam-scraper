import type { ReviewedModelDocument } from "./types.js";

export const genieDocuments: readonly ReviewedModelDocument[] = [
  {
    url: "https://manuals.genielift.com/operators/english/133540.pdf", brand: "Genie", model: "Z-45/25J", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "diésel", workingHeightM: 16,
      invariantGeometry: true, firstYear: 2014, lastYear: 2014 }, fields: ["Rotación de torreta", "Rotación de cesta"] }, facts: [
      { field: "Rotación de torreta", value: "355°", support: "Genie PN 133540, quinta edición, p. 48, Z-45/25J: turntable rotation 355°." },
      { field: "Rotación de cesta", value: "160°", support: "Misma tabla, platform rotation 160°." }
    ]
  },
  {
    url: "https://manuals.genielift.com/operators/english/133540.pdf", brand: "Genie", model: "Z-51/30J", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "diésel", workingHeightM: 18,
      invariantGeometry: true, firstYear: 2013, lastYear: 2013 }, fields: ["Rotación de torreta", "Rotación de cesta"] }, facts: [
      { field: "Rotación de torreta", value: "359°", support: "Genie PN 133540, quinta edición, p. 49, Z-51/30J: turntable rotation 359°." },
      { field: "Rotación de cesta", value: "160°", support: "Misma tabla, platform rotation 160°." }
    ]
  },
  {
    url: "https://www.genielift.com/docs/default-source/product-specifications/articulated-boom-lift/en/z-3422ic_spec_2019.pdf", brand: "Genie", model: "Z-34/22", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "diésel", workingHeightM: 12,
      invariantGeometry: true, firstYear: 2019, lastYear: 2019 }, fields: ["Rotación de torreta", "Rotación de cesta"] }, facts: [
      { field: "Rotación de torreta", value: "355°", support: "Ficha Genie Z-34/22 IC 2019, p. 1, 2WD y 4WD: turntable rotation 355° no continuo." },
      { field: "Rotación de cesta", value: "180°", support: "Misma tabla, platform rotation 180° en ambas variantes." }
    ]
  },
  {
    url: "https://manuals.genielift.com/operators/english/35531.pdf", brand: "Genie", model: "Z-30/20N", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "eléctrica", workingHeightM: 11,
      invariantGeometry: true, firstYear: 2007, lastYear: 2007 }, fields: ["Rotación de torreta"] }, facts: [
      { field: "Rotación de torreta", value: "359°", support: "Genie PN 35531, Specifications, giro de torreta 359°; mismo valor en manual 43651GR, segunda edición novena impresión. Se omite giro de cesta por diferencias entre generaciones." }
    ]
  },
  {
    url: "https://manuals.genielift.com/operators/english/227521.pdf", brand: "Genie", model: "Z-30/20NRJ", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "eléctrica", workingHeightM: 11,
      invariantGeometry: true, firstYear: 2010, lastYear: 2010 }, fields: ["Rotación de torreta"] }, facts: [
      { field: "Rotación de torreta", value: "359°", support: "Genie PN 227521, sexta edición tercera impresión, Specifications Z-30/20N with rotating jib: turntable rotation 359°, corroborado en PN 43651GR. No se atribuye giro de cesta ni plumín." }
    ]
  },
  {
    url: "https://universalplataformas.com/wp-content/uploads/2022/10/TD15-TD18-Genie-GS3390R_4390RT_5390RT.pdf", brand: "Genie", model: "GS4390RT", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "diésel", workingHeightM: 15,
      invariantGeometry: true, firstYear: 2016, lastYear: 2016 }, fields: ["Longitud de plataforma", "Anchura de plataforma"] }, facts: [
      { field: "Longitud de plataforma", value: "3,98 m", support: "Genie B109352SP 04/2017, p. 1, GS-4390 RT, longitud exterior sin extensión C y anchura exterior G; corroborado en ficha Genie GS-4390 RT / GS-5390 RT 2012. No se atribuyen extensiones opcionales." },
      { field: "Anchura de plataforma", value: "1,83 m", support: "Genie B109352SP 04/2017, p. 1, GS-4390 RT, longitud exterior sin extensión C y anchura exterior G; corroborado en ficha Genie GS-4390 RT / GS-5390 RT 2012. No se atribuyen extensiones opcionales." }
    ]
  },
  {
    url: "https://universalplataformas.com/wp-content/uploads/2022/10/TD15-TD18-Genie-GS3390R_4390RT_5390RT.pdf", brand: "Genie", model: "GS5390RT", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "diésel", workingHeightM: 18,
      invariantGeometry: true, firstYear: 2013, lastYear: 2015 }, fields: ["Longitud de plataforma", "Anchura de plataforma"] }, facts: [
      { field: "Longitud de plataforma", value: "3,98 m", support: "Genie B109352SP 04/2017, p. 1, GS-5390 RT, longitud exterior sin extensión C y anchura exterior G; corroborado en ficha Genie GS-4390 RT / GS-5390 RT 2012. No se atribuyen extensiones opcionales." },
      { field: "Anchura de plataforma", value: "1,83 m", support: "Genie B109352SP 04/2017, p. 1, GS-5390 RT, longitud exterior sin extensión C y anchura exterior G; corroborado en ficha Genie GS-4390 RT / GS-5390 RT 2012. No se atribuyen extensiones opcionales." }
    ]
  },
  {
    url: "https://www.conger.com/wp-content/uploads/Scissor_Lifts/GS_3232/B_GS-2032_GS-2632_GS-3232_SpecSheet_2015.pdf", brand: "Genie", model: "GS2632", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 10,
      invariantGeometry: true, firstYear: 2016, lastYear: 2017 }, fields: ["Longitud de plataforma", "Anchura de plataforma"] }, facts: [
      { field: "Longitud de plataforma", value: "2,26 m", support: "Genie GS-2032/2632/3232, ficha 2015, p. 1, columna GS-2632, cotas C y D exteriores de plataforma sin extensión; incluye configuración CE." },
      { field: "Anchura de plataforma", value: "0,81 m", support: "Genie GS-2032/2632/3232, ficha 2015, p. 1, columna GS-2632, cotas C y D exteriores de plataforma sin extensión; incluye configuración CE." }
    ]
  },
  {
    url: "https://manuals.genielift.com/operators/english/133094.pdf", brand: "Genie", model: "Z-80/60", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "diésel", workingHeightM: 26,
      invariantGeometry: true, firstYear: 2015, lastYear: 2015 }, fields: ["Rotación de torreta", "Rotación de cesta"] }, facts: [
      { field: "Rotación de torreta", value: "360°", support: "Manual Genie Z-80/60 133094, cuarta edición segunda impresión, p. 54: 360° continuo." },
      { field: "Rotación de cesta", value: "160°", support: "Mismo manual, p. 54, giro total 160°; corroborado por manual de servicio de febrero de 2015. No se atribuyen dimensiones opcionales." }
    ]
  },
  {
    url: "https://documentacionqr.com/sat/objects/919708/GENIE_Z62-40_MANUAL_OPERARIO_ES.pdf", brand: "Genie", model: "Z-62/40", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "diésel", workingHeightM: 20,
      invariantGeometry: true, firstYear: 2017, lastYear: 2019 }, fields: ["Rotación de torreta", "Rotación de cesta"] }, facts: [
      { field: "Rotación de torreta", value: "360°", support: "Manual Genie Z-62/40 CE 1257653SP, primera edición, p. 59: 360° continuos." },
      { field: "Rotación de cesta", value: "180°", support: "Mismo manual, p. 59: giro de plataforma 180°. No acredita cesta opcional ni versión TRAX." }
    ]
  },
  {
    url: "https://manuals.genielift.com/operators/english/82597.pdf", brand: "Genie", model: "Z-34/22N", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "eléctrica", workingHeightM: 12,
      invariantGeometry: true, firstYear: 2012, lastYear: 2012 }, fields: ["Rotación de torreta"] }, facts: [
      { field: "Rotación de torreta", value: "355°", support: "Manual Genie Z-34/22N 82597, tercera edición cuarta impresión, p. 32: giro de torreta 355°. No se atribuye giro de cesta por diferencias entre ediciones." }
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
    url: "https://www.colle.eu/media/3955/genie-s65-en.pdf", brand: "Genie", model: "S-65",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal máximo", value: "17,1 m", support: "S-65 | Horizontal reach maximum | 17.10 m" },
      { field: "Altura máxima de plataforma", value: "19,8 m", support: "S-65 | Platform height maximum | 19.80 m" },
      { field: "Capacidad máxima de plataforma", value: "227 kg", support: "S-65 | Lift capacity | 227 kg" }
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
    url: "https://www.mateco.es/fileadmin/user_upload/Guia-de-alquiler-2019.pdf", brand: "Genie", model: "Z-30/20NRJ",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "6,25 m", support: "GENIE Z-30/20NRJ | Alcance horizontal | 6,25 m" },
      { field: "Altura de plataforma", value: "8,89 m", support: "GENIE Z-30/20NRJ | Altura plataforma | 8,89 m" },
      { field: "Anchura (mm)", value: "1,19 m", support: "GENIE Z-30/20NRJ | Dimensiones transporte | Ancho 1,19 m" },
      { field: "Capacidad máxima de plataforma", value: "227 kg", support: "GENIE Z-30/20NRJ | Capacidad plataforma | 227 kg" }
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
    url: "https://manuals.genielift.com/operators/english/228459.pdf", brand: "Genie", model: "S-125",
    reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "38,1 m", support: "Genie S-125, manual 228459, 5.ª edición, 2.ª impresión, pág. 65: Height, platform maximum | 38.1 m" },
      { field: "Anchura con ejes recogidos", value: "2,5 m", support: "Genie S-125, manual 228459, 5.ª edición, 2.ª impresión, pág. 65: Width, axles retracted | 2.5 m" }
    ]
  },
  {
    url: "https://manuals.genielift.com/operators/english/133540.pdf", brand: "Genie", model: "Z-51/30J",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "9,25 m", support: "Manual oficial Genie PN 133540, quinta edición, primera impresión, página 49: Z-51/30J Horizontal reach maximum 9.25 m. El índice de manuales Genie lo asigna a la serie CE desde SN 10B-524 hasta 14B-1200, correspondiente al periodo de la ficha original de 2013; no acredita otras revisiones" }
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
    url: "https://manuals.genielift.com/operators/english/82600.pdf",
    brand: "Genie", model: "Z-45/25J", reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "13,8 m",
        support: "Manual oficial Genie PN 82600, segunda edición, segunda impresión: Z-45/25J con plumín, modelos de base estándar y estrecha, páginas 37 y 39: altura máxima de plataforma 13,8 m en ambas bases. Manual de servicio PN 219418 Rev C (2013) documenta asimismo 13,8 m para la serie IC desde SN 13A-47001; no acredita una placa de serie individual" },
      { field: "Alcance horizontal (m)", value: "7,7 m",
        support: "Manual oficial Genie PN 82600, segunda edición, segunda impresión: Z-45/25J con plumín, modelos de base estándar y estrecha, páginas 37 y 39: alcance horizontal máximo 7,7 m en ambas bases. Manual de servicio PN 219418 Rev C (2013) documenta asimismo 7,7 m para la serie IC desde SN 13A-47001; no acredita una placa de serie individual" }
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

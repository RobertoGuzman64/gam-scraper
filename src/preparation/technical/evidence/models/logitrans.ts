import type { ReviewedModelDocument } from "./types.js";

const manualTravelConflict = /\b(?:propulsion|traccion|desplazamiento (?:manual|electrico|motorizado)|transporte (?:manual|electrico|motorizado)|conduccion (?:manual|electrica)|autopropulsad[oa]s?|motor de (?:traccion|desplazamiento)|motorizad[oa]s? para (?:el )?(?:transporte|desplazamiento)|convertid[oa]s?|modificad[oa]s?)\b/u;

export const logitransDocuments: readonly ReviewedModelDocument[] = [
  {
    url: "https://logitrans.com/electric-logiflex-stacker-with-straddle-legs-inox-ehssi/", brand: "LOGITRANS", model: "EHSS", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "apilador", firstYear: null, lastYear: null, anchoredCatalogOffer: true,
      sourceAnchors: { Marca: "LOGITRANS", Modelo: "EHSS", País: "ESPAÑA", "Capacidad de carga (kg)": "1000 KG" },
      conflictingEvidence: manualTravelConflict }, fields: ["Propulsión"] }, facts: [
      { field: "Propulsión", value: "Manual", support: "Ficha de fabricante EHSSI, sección Product information: electric lift and manual transport. Misma identidad documental que la elevación eléctrica de EHSS." }
    ]
  },
  {
    url: "https://logitrans.com/solutions/pallet-tansportation/panther-maxi-fully-powered-pallet-truck/", brand: "LOGITRANS", model: "Panther Maxi", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "transpaleta", firstYear: null, lastYear: null, anchoredCatalogOffer: true, familyFromSourcePath: true,
      sourceAnchors: { Marca: "LOGITRANS", Modelo: "Panther Maxi", País: "ESPAÑA", "Capacidad de carga (kg)": "1800 KG", Motorización: "Eléctrico" },
      conflictingEvidence: /\b(?:freno|cargador|convertid[oa]|modificad[oa])\b/u }, fields: ["Freno de motor", "Cargador"] }, facts: [
      { field: "Freno de motor", value: "Incorporado", support: "Panther Maxi, Product information: Motor brake." },
      { field: "Cargador", value: "Integrado", support: "Panther Maxi, Product information: integrated charger." }
    ]
  },
  {
    url: "https://logitrans.com/logiq-200-quarter-pallet-lifter/", brand: "LOGITRANS", model: "LogiQ 200/300", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "transpaleta", firstYear: null, lastYear: null, anchoredCatalogOffer: true,
      sourceAnchors: { Marca: "LOGITRANS", Modelo: "LogiQ 200/300", País: "ESPAÑA", "Capacidad de carga (kg)": "200/300 KG" },
      conflictingEvidence: /\b(?:proteccion de pies|protectores? (?:de|para) (?:los )?pies|convertid[oa]|modificad[oa])\b/u }, fields: ["Protección de pies"] }, facts: [
      { field: "Protección de pies", value: "Protectores en ruedas de dirección", support: "LogiQ 200 y LogiQ 300, Product information: foot protection on steering wheels." }
    ]
  },
  {
    url: "https://logitrans.com/fully-powered-logiflex-stacker-mini-self-mini/", brand: "LOGITRANS", model: "Self Mini", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "apilador", firstYear: null, lastYear: null, anchoredCatalogOffer: true,
      sourceAnchors: { Marca: "LOGITRANS", Modelo: "Self Mini", País: "ESPAÑA", "Capacidad de carga (kg)": "1000 KG", Motorización: "Eléctrico" },
      conflictingEvidence: /\b(?:accionamiento de elevacion|motor de elevacion|bomba de elevacion|elevacion manual|bombeo manual|convertid[oa]|modificad[oa])\b/u }, fields: ["Accionamiento de elevación"] }, facts: [
      { field: "Accionamiento de elevación", value: "Eléctrico", support: "SELF MINI, Product information: electrical propulsion and pumping (for lifting and lowering)." }
    ]
  },
  {
    url: "https://logitrans.com/fully-powered-logiflex-stacker-with-straddle-legs-selfs-mini/", brand: "LOGITRANS", model: "Self Mini S", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "apilador", firstYear: null, lastYear: null, anchoredCatalogOffer: true,
      sourceAnchors: { Marca: "LOGITRANS", Modelo: "Self Mini S", País: "ESPAÑA", "Capacidad de carga (kg)": "1000 KG", Motorización: "Eléctrico" },
      conflictingEvidence: /\b(?:accionamiento de elevacion|motor de elevacion|bomba de elevacion|elevacion manual|bombeo manual|convertid[oa]|modificad[oa])\b/u }, fields: ["Accionamiento de elevación"] }, facts: [
      { field: "Accionamiento de elevación", value: "Eléctrico", support: "SELFS MINI, Product information: electrical propulsion and pumping (for lifting and lowering)." }
    ]
  },
  {
    url: "https://logitrans.com/fully-powered-logiflex-stacker-self-maxi/", brand: "LOGITRANS", model: "Self Maxi", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "apilador", firstYear: null, lastYear: null, anchoredCatalogOffer: true,
      sourceAnchors: { Marca: "LOGITRANS", Modelo: "Self Maxi", País: "ESPAÑA", "Capacidad de carga (kg)": "1000 KG", Motorización: "Eléctrico" },
      conflictingEvidence: /\b(?:accionamiento de elevacion|motor de elevacion|bomba de elevacion|elevacion manual|bombeo manual|convertid[oa]|modificad[oa])\b/u }, fields: ["Accionamiento de elevación"] }, facts: [
      { field: "Accionamiento de elevación", value: "Eléctrico", support: "SELF MAXI, Product information: electrical propulsion and pumping (lifting and lowering)." }
    ]
  },
  {
    url: "https://logitrans.com/fully-powered-logiflex-stacker-with-straddle-legs-selfs-maxi/", brand: "LOGITRANS", model: "Self Maxi S", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "apilador", firstYear: null, lastYear: null, anchoredCatalogOffer: true,
      sourceAnchors: { Marca: "LOGITRANS", Modelo: "Self Maxi S", País: "ESPAÑA", "Capacidad de carga (kg)": "1000 KG", Motorización: "Eléctrico" },
      conflictingEvidence: /\b(?:accionamiento de elevacion|motor de elevacion|bomba de elevacion|elevacion manual|bombeo manual|convertid[oa]|modificad[oa])\b/u }, fields: ["Accionamiento de elevación"] }, facts: [
      { field: "Accionamiento de elevación", value: "Eléctrico", support: "SELFS MAXI, Product information: electrical propulsion and pumping (lifting and lowering)." }
    ]
  },
  {
    url: "https://logitrans.com/electric-logiflex-stacker-elf/", brand: "LOGITRANS", model: "Logiflex SE", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "apilador", firstYear: null, lastYear: null, anchoredCatalogOffer: true,
      sourceAnchors: { Marca: "LOGITRANS", Modelo: "Logiflex SE", País: "ESPAÑA", "Capacidad de carga (kg)": "1000 KG", Motorización: "Eléctrico" },
      conflictingEvidence: /\b(?:accionamiento de elevacion|motor de elevacion|bomba de elevacion|elevacion manual|bombeo manual|convertid[oa]|modificad[oa])\b/u }, fields: ["Accionamiento de elevación"] }, facts: [
      { field: "Accionamiento de elevación", value: "Eléctrico", support: "ELF, Product information: manual propulsion and electrical pumping (for lifting and lowering)." }
    ]
  },
  {
    url: "https://logitrans.com/manual-logiflex-stacker-lf/", brand: "LOGITRANS", model: "Logiflex M", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "apilador", firstYear: null, lastYear: null, anchoredCatalogOffer: true,
      sourceAnchors: { Marca: "LOGITRANS", Modelo: "Logiflex M", País: "ESPAÑA", "Capacidad de carga (kg)": "1000 KG" },
      conflictingEvidence: /\b(?:direccion|convertid[oa]|modificad[oa])\b/u }, fields: ["Dirección"] }, facts: [
      { field: "Dirección", value: "Asistida", support: "LF, Product information: assisted steering on the wheels for easy operation." }
    ]
  },
  {
    url: "https://logitrans.com/manual-logiflex-stacker-with-straddle-legs-lfs/", brand: "LOGITRANS", model: "Logiflex MS", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "apilador", firstYear: null, lastYear: null, anchoredCatalogOffer: true,
      sourceAnchors: { Marca: "LOGITRANS", Modelo: "Logiflex MS", País: "ESPAÑA", "Capacidad de carga (kg)": "1000 KG" },
      conflictingEvidence: /\b(?:direccion|convertid[oa]|modificad[oa])\b/u }, fields: ["Dirección"] }, facts: [
      { field: "Dirección", value: "Asistida", support: "LFS, Product information: assisted steering on the wheels for easy operation." }
    ]
  },
  {
    url: "https://logitrans.com/manual-logiflex-stacker-inox-hsi-and-manual-logiflex-stacker-with-straddle-legs-inox-hssi/", brand: "LOGITRANS", model: "HSI HSSI", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "apilador", firstYear: null, lastYear: null, anchoredCatalogOffer: true,
      sourceAnchors: { Marca: "LOGITRANS", Modelo: "HSI HSSI", País: "ESPAÑA", "Capacidad de carga (kg)": "1000 KG" },
      conflictingEvidence: manualTravelConflict }, fields: ["Propulsión"] }, facts: [
      { field: "Propulsión", value: "Manual", support: "HSI / HSSI, Product information: manual lifting and transport capabilities." }
    ]
  },
  {
    url: "https://logitrans.com/electric-highlifter-ehl/", brand: "LOGITRANS", model: "EHL", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "transpaleta", firstYear: null, lastYear: null, anchoredCatalogOffer: true, familyFromSourcePath: true,
      sourceAnchors: { Marca: "LOGITRANS", Modelo: "EHL", País: "ESPAÑA", "Capacidad de carga (kg)": "1500 KG", Motorización: "Eléctrico" }, conflictingEvidence: manualTravelConflict }, fields: ["Propulsión", "Accionamiento de elevación"] },
    facts: [{ field: "Propulsión", value: "Manual", support: "Ficha EHL, sección Product information y gama Highlifters (https://logitrans.com/solutions/pallet-lifters-stackers/): elevación eléctrica y transporte manual; no acredita tracción eléctrica." }, { field: "Accionamiento de elevación", value: "Eléctrico", support: "Ficha EHL, Product information: electrical lifting." }]
  },
  {
    url: "https://logitrans.com/manual-highlifter-hl/", brand: "LOGITRANS", model: "HL", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "transpaleta", firstYear: null, lastYear: null, anchoredCatalogOffer: true, familyFromSourcePath: true,
      sourceAnchors: { Marca: "LOGITRANS", Modelo: "HL", País: "ESPAÑA", "Capacidad de carga (kg)": "1500 KG" }, conflictingEvidence: manualTravelConflict }, fields: ["Propulsión", "Accionamiento de elevación"] },
    facts: [{ field: "Propulsión", value: "Manual", support: "Ficha HL, Product information: bombeo manual; gama Highlifters (https://logitrans.com/solutions/pallet-lifters-stackers/), transporte manual. No se atribuye configuración opcional." }, { field: "Accionamiento de elevación", value: "Manual", support: "Ficha HL, Product information: manual pumping." }]
  },
  {
    url: "https://logitrans.com/manual-highlifter-inox-hli/", brand: "LOGITRANS", model: "HLI", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "transpaleta", firstYear: null, lastYear: null, anchoredCatalogOffer: true, familyFromSourcePath: true,
      sourceAnchors: { Marca: "LOGITRANS", Modelo: "HLI", País: "ESPAÑA", "Capacidad de carga (kg)": "1500 KG" }, conflictingEvidence: manualTravelConflict }, fields: ["Propulsión"] },
    facts: [{ field: "Propulsión", value: "Manual", support: "Ficha HLI, Facts and features: elevación y transporte manuales." }]
  },
  {
    url: "https://logitrans.com/manual-highlifter-inox-plus-hlip/", brand: "LOGITRANS", model: "HLI Plus", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "transpaleta", firstYear: null, lastYear: null, anchoredCatalogOffer: true, familyFromSourcePath: true,
      sourceAnchors: { Marca: "LOGITRANS", Modelo: "HLI Plus", País: "ESPAÑA", "Capacidad de carga (kg)": "1500 KG" }, conflictingEvidence: manualTravelConflict }, fields: ["Propulsión"] },
    facts: [{ field: "Propulsión", value: "Manual", support: "Ficha HLIP, Facts: elevación y transporte manuales; variante Inox Plus." }]
  },
  {
    url: "https://logitrans.com/electric-highlifter-inox-ehli/", brand: "LOGITRANS", model: "EHLI", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "transpaleta", firstYear: null, lastYear: null, anchoredCatalogOffer: true, familyFromSourcePath: true,
      sourceAnchors: { Marca: "LOGITRANS", Modelo: "EHLI", País: "ESPAÑA", "Capacidad de carga (kg)": "1500 KG", Motorización: "Eléctrico" }, conflictingEvidence: manualTravelConflict }, fields: ["Propulsión"] },
    facts: [{ field: "Propulsión", value: "Manual", support: "Ficha EHLI, Key features: elevación eléctrica y transporte manual." }]
  },
  {
    url: "https://logitrans.com/electric-highlifter-inox-plus-ehlip/", brand: "LOGITRANS", model: "EHLI Plus", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "transpaleta", firstYear: null, lastYear: null, anchoredCatalogOffer: true, familyFromSourcePath: true,
      sourceAnchors: { Marca: "LOGITRANS", Modelo: "EHLI Plus", País: "ESPAÑA", "Capacidad de carga (kg)": "1500 KG", Motorización: "Eléctrico" }, conflictingEvidence: manualTravelConflict }, fields: ["Propulsión"] },
    facts: [{ field: "Propulsión", value: "Manual", support: "Ficha EHLIP, Facts: elevación eléctrica y transporte manual; variante Inox Plus." }]
  },
  {
    url: "https://logitrans.com/weighing-scale-pallet-truck-wsp-2200/", brand: "LOGITRANS", model: "WSP 2200", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "transpaleta", firstYear: null, lastYear: null, anchoredCatalogOffer: true, familyFromSourcePath: true,
      sourceAnchors: { Marca: "LOGITRANS", Modelo: "WSP 2200", País: "ESPAÑA", "Capacidad de carga (kg)": "2200 KG" }, conflictingEvidence: manualTravelConflict }, fields: ["Propulsión", "Funciones de pesaje"] },
    facts: [{ field: "Propulsión", value: "Manual", support: "Ficha WSP 2200, Product information, y clasificación expresa de WSP 2200 en Manual pallet trucks (https://logitrans.com/US/solutions/pallet-tansportation/manual-pallet-trucks/); alimentación de la balanza no equivale a tracción." }, { field: "Funciones de pesaje", value: "Tara, recuento, suma y puesta a cero", support: "Ficha WSP 2200, Product information: taring, counting, summation and zero setting." }]
  },
  {
    url: "https://logitrans.com/electric-logitilt/", brand: "LOGITRANS", model: "Logitilt LT", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "transpaleta", firstYear: null, lastYear: null, anchoredCatalogOffer: true, familyFromSourcePath: true,
      sourceAnchors: { Marca: "LOGITRANS", Modelo: "Logitilt LT", País: "ESPAÑA", "Capacidad de carga (kg)": "1000 KG", Motorización: "Eléctrico" }, conflictingEvidence: manualTravelConflict }, fields: ["Propulsión"] },
    facts: [{ field: "Propulsión", value: "Manual", support: "Manual de fabricante Logitilt LT/LTS, 20.04.2020, p. 6, apartado 3.1: empuje y arrastre desde el timón, independiente de elevación e inclinación (https://www.manualslib.com/manual/1823181/Logitrans-Logitilt-Lt1001.html?page=6); ficha LT. No se alteran ángulos ni se atribuye equipamiento opcional." }]
  },
  {
    url: "https://logitrans.com/electric-logitilt-with-straddle-legs/", brand: "LOGITRANS", model: "Logitilt LTS", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "transpaleta", firstYear: null, lastYear: null, anchoredCatalogOffer: true, familyFromSourcePath: true,
      sourceAnchors: { Marca: "LOGITRANS", Modelo: "Logitilt LTS", País: "ESPAÑA", "Capacidad de carga (kg)": "1000 KG", Motorización: "Eléctrico" }, conflictingEvidence: manualTravelConflict }, fields: ["Propulsión"] },
    facts: [{ field: "Propulsión", value: "Manual", support: "Manual de fabricante Logitilt LT/LTS, 20.04.2020, p. 6, apartado 3.1: empuje y arrastre desde el timón, variante LTS con patas abiertas (https://www.manualslib.com/manual/1823181/Logitrans-Logitilt-Lt1001.html?page=6). No se alteran ángulos ni se atribuye equipamiento opcional." }]
  },
  {
    url: "https://logitrans.com/electric-logitilt-inox-lti/", brand: "LOGITRANS", model: "Logitilt LTI", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "transpaleta", firstYear: null, lastYear: null, anchoredCatalogOffer: true, familyFromSourcePath: true,
      sourceAnchors: { Marca: "LOGITRANS", Modelo: "Logitilt LTI", País: "ESPAÑA", "Capacidad de carga (kg)": "1000 KG", Motorización: "Eléctrico" }, conflictingEvidence: manualTravelConflict }, fields: ["Propulsión"] },
    facts: [{ field: "Propulsión", value: "Manual", support: "Manual de fabricante Logitilt INOX/LTI, 06.04.2021, p. 6, apartado 3.1: empujar/tirar desde detrás del timón, independiente de elevación e inclinación (https://www.manualslib.fr/manual/468789/Logitrans-Logitilt-Inox-Lti-Serie.html?page=6). No se alteran ángulos ni se atribuye equipamiento opcional." }]
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
    url: "https://logitrans.com/panther-manual-pallet-truck/", brand: "LOGITRANS", model: "Panther Flex",
    reviewedOn: "2026-11-21", facts: [
      { field: "Propulsión", value: "Manual", support: "Our manual pallet truck; la misma ficha identifica expresamente Panther Flex como configuración de horquillas" },
      { field: "Descenso de carga", value: "Controlado", support: "Gentle and controlled lowering of loads; la misma ficha identifica Panther Flex" }
    ]
  },
  {
    url: "https://logitrans.com/panther-manual-pallet-truck/", brand: "LOGITRANS", model: "Panther Flex",
    reviewedOn: "2026-11-21", facts: [
      { field: "Elevación", value: "Hidráulica manual", support: "Logitrans identifica Panther Flex como variante de horquillas del Panther manual; su catálogo describe elevaciones mediante bombeo manual y aceite especial. El despiece de fabricante Panther 2572/2582 muestra la bomba, el cilindro, el pistón, las juntas y las válvulas: https://logitrans-stapler.de/service/Ersatzteillisten/Gabelhubwagen/Panther2572-2582-Ersatzteilliste.pdf" }
    ]
  }
];

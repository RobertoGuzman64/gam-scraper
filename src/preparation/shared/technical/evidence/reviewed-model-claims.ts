import { technicalDocumentClaimSha256 } from "../../../../contracts/technical-provenance.js";
import type { TechnicalDocumentReference, TechnicalDocumentVerification } from "../../../../contracts/technical-provenance.js";

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
};

const documents: readonly ReviewedModelDocument[] = [
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
    brand: "LGMG", model: "SR1218D", reviewedOn: "2026-11-21", facts: [
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
    brand: "LGMG", model: "A14JE", reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "7,81 m", support: "LGMG A14JE, Specifications: Horizontal Outreach 7.81m" },
      { field: "Altura de plataforma", value: "13,8 m", support: "LGMG A14JE, Specifications: Platform Height 13.8m" },
      { field: "Anchura (mm)", value: "1,8 m", support: "LGMG A14JE, Specifications: B-Overall Width 1.8m" },
      { field: "Capacidad máxima de plataforma", value: "230 kg", support: "LGMG A14JE, Specifications: Platform Capacity 230 kg" }
    ]
  },
  {
    url: "https://www.lgmglifts.com/product/pro-detail-617.htm",
    brand: "LGMG", model: "AR16J", reviewedOn: "2026-11-21", facts: [
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

import type { ReviewedModelDocument } from "./types.js";

export const jlgDocuments: readonly ReviewedModelDocument[] = [
  {
    url: "https://csapps.jlg.com/OnlineManuals/Manuals/LiftLux%20Scissors/180-12_153-12/Operation_3122640_06-27-08_CE_Spanish.pdf", brand: "JLG", model: "153-12", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 17,
      invariantGeometry: true, firstYear: 2006, lastYear: 2006 }, fields: ["Extensión de plataforma"] }, facts: [
      { field: "Extensión de plataforma", value: "1,5 m", support: "Manual JLG 3122640, tabla 6-2, p. 6-3: plataforma retraída 4 m y extendida 5,5 m; recorrido nominal 1,5 m. Manual 3121336, tabla 6-2, confirma el recorrido con 3,9 y 5,4 m. Ficha JLG LSL-0805-3000-3378 de 2005, extensión manual estándar y cotas 3,91 y 5,40 m redondeadas a décimas. Se conserva la altura anunciada de 17 m como clase comercial." }
    ]
  },
  {
    url: "https://alphapub.blob.core.windows.net/arena/documents/7805236.pdf", brand: "JLG", model: "E300AJP", reviewedOn: "2026-11-25",
    reuse: { fallback: true, compatibility: { family: "plataforma-articulada", energy: "eléctrica", workingHeightM: 11,
      invariantGeometry: true, firstYear: 2006, lastYear: 2006 }, fields: ["Anchura de plataforma"] }, facts: [
      { field: "Anchura de plataforma", value: "0,76 m", support: "JLG Europe SL094-ENGLISH, p. 2, E300AJP: dimensión corta de plataforma 0,76 m; corroborada en ficha E300AJP (https://www.plataformasnoain.com/wp-content/uploads/2021/10/JLG-E300AJP.pdf). No se atribuyen altura, capacidad, alcance ni longitud de plumín de otra edición." }
    ]
  },
  {
    url: "https://www.cc-equipment.be/fileadmin/pdf/technical%20sheets/technical%20sheets%20hoogwerkers/Knikhoogwerkers/CC_Heftrucks_fiche_hoogwerker_knikarm_450AJ.pdf", brand: "JLG", model: "450 AJ SII", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "diésel", workingHeightM: 16,
      invariantGeometry: true, firstYear: 2013, lastYear: 2013 }, fields: ["Anchura de plataforma"] }, facts: [
      { field: "Anchura de plataforma", value: "0,76 m", support: "JLG 450AJ Series II, ficha CE, tabla de dimensiones: cota corta 0,76 m; no atribuye longitud de cesta opcional ni longitud de plumín de otra edición." }
    ]
  },
  {
    url: "https://www.alpesur.com/images/pdf-maquinaria/1930ES%20-%20FICHA%20TECNICA.pdf", brand: "JLG", model: "1930 ES", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 8,
      invariantGeometry: true, firstYear: 2008, lastYear: 2008 }, fields: ["Extensión de plataforma"] },
    facts: [{ field: "Extensión de plataforma", value: "0,9 m", support: "Ficha JLG 1930ES, DS462-SPANISH (©2008), p. 1 equipamiento estándar: extensión de plataforma de 0,90 m; p. 2 dimensiones. Los 8 m anunciados identifican la clase de trabajo, no una nueva cota acreditada." }]
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
    url: "https://www.megaltura.com/wp-content/uploads/2022/08/JLG-2630-ES.pdf", brand: "JLG", model: "2630ES",
    reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "7,77 m", support: "Altura de plataforma (Elevada) | 7,77 m" },
      { field: "Anchura (mm)", value: "0,76 m", support: "Anchura total | 0,76 m" },
      { field: "Distancia entre ejes (mm)", value: "1,88 m", support: "Distancia entre ejes | 1,88 m" },
      { field: "Extensión de plataforma", value: "0,9 m", support: "Lateral extensible de 0,90 m" }
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
    url: "https://www.manualslib.com/manual/1277304/Jlg-1350sjp.html", brand: "JLG", model: "1350 SJP",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal máximo sin restricción de carga", value: "24,4 m", support: "1350SJP | Max Horizontal Reach (unrestricted) | 80 ft / 24.4 m" },
      { field: "Altura de plataforma", value: "41,2 m", support: "1350SJP | Maximum Platform Height | 135 ft / 41.2 m" },
      { field: "Anchura con ejes recogidos", value: "2,49 m", support: "1350SJP | Width (Axles Retracted) | 8 ft 2 in / 2.49 m" },
      { field: "Capacidad de plataforma sin restricciones", value: "227 kg", support: "1350SJP | Platform Capacity (Unrestricted) | 500 lb / 227 kg" }
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
    url: "https://jlg.ru/upload/iblock/a55/a55ac022eb564236eb1714d950c513c3.pdf", brand: "JLG", model: "1250AJP",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "19,25 m", support: "1250AJP | Horizontal Outreach | 19.25 m" },
      { field: "Altura de plataforma", value: "38,3 m", support: "1250AJP | Platform Height | 38.30 m" },
      { field: "Anchura con ejes recogidos", value: "2,49 m", support: "1250AJP | Overall Width (Axles Retracted) | 2.49 m" },
      { field: "Longitud (mm)", value: "11,46 m", support: "1250AJP | Stowed Length | 11.46 m (transport position)" }
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
    url: "https://www.gregorypoolelift.com/new-equipment/aerial-lifts/3394rt/", brand: "JLG", model: "3394RT",
    reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "10,06 m", support: "JLG 3394RT | Platform Height | 10.06 m" },
      { field: "Anchura (mm)", value: "2,39 m", support: "JLG 3394RT | Machine Width | 2.39 m" },
      { field: "Anchura de plataforma", value: "2,18 m", support: "JLG 3394RT | Platform Width | 2.18 m" },
      { field: "Longitud de plataforma", value: "3,81 m", support: "JLG 3394RT | Platform Length | 3.81 m" }
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
    url: "https://jlg.manymanuals.it/special-machinery/450aaj-series-ii-service-manual/user-manual-38276/17",
    brand: "JLG", model: "450 AJ SII", reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "13,72 m", support: "JLG 450AJ Series II | Max. Platform Height | 45 ft. (13.72 M)" },
      { field: "Alcance horizontal (m)", value: "7,47 m", support: "450AJ SII | Max. Horizontal Reach | 24 ft. 6 in. (7.47 M)" }
    ]
  },
  {
    url: "https://doc.pegamo.es/www/machinery/doc/0AEE48CF9C424F608F99E74F6D48876A.pdf",
    brand: "JLG", model: "660SJ", reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "20,31 m", support: "JLG Industries, guía de especificaciones 2015, página 20: modelo 660SJ | Altura de plataforma | 20,31 m" }
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
    url: "https://www.tecnorent.com/imgs-productos/plataformas-tijera-diesel/jlg530lrt.pdf", brand: "JLG", model: "530LRT", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "diésel", workingHeightM: 18.15,
      lengthM: 4.88, widthM: 2.31, loadCapacityKg: 680 }, fields: ["Altura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "16,15 m", support: "JLG EMEA 530LRT, página 2, Performance: altura elevada de plataforma 16,15 m, trabajo 18,15 m, largo 4,88 m, ancho 2,31 m, capacidad 680 kg; no atribuye dimensiones de cesta ni extensiones opcionales" }
    ]
  }
];

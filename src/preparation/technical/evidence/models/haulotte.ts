import type { ReviewedModelDocument } from "./types.js";

export const haulotteDocuments: readonly ReviewedModelDocument[] = [
  {
    url: "https://documentacionqr.com/sat/objects/955052/HAULOTTE_COMPACT%2010_FICHA_TECNICA_2018.pdf", brand: "Haulotte", model: "Compact 12", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 12,
      invariantGeometry: true, firstYear: 2018, lastYear: 2018 }, fields: ["Longitud de plataforma", "Anchura de plataforma"] }, facts: [
      { field: "Longitud de plataforma", value: "2,31 m", support: "Haulotte Compact 8 W/10/12, 03/2018, p. 2, columna Compact 12, cotas A y C." },
      { field: "Anchura de plataforma", value: "1,2 m", support: "Haulotte Compact 8 W/10/12, 03/2018, p. 2, columna Compact 12, cotas A y C." }
    ]
  },
  {
    url: "https://www.atirent.com/wp-content/uploads/2022/11/HA16RTJ.pdf", brand: "Haulotte", model: "HA16RTJ", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "diésel", workingHeightM: 16,
      invariantGeometry: true, firstYear: 2016, lastYear: 2018 }, fields: ["Rotación de torreta", "Rotación de cesta"] }, facts: [
      { field: "Rotación de torreta", value: "355°", support: "Ficha HA16 RTJ / RTJ O 06/2016, p. 2: 355° no continuo; corroborada en ficha 08/2018. No aplicable a PRO." },
      { field: "Rotación de cesta", value: "165°", support: "Mismas fichas, recorrido total -75°/+90°. No acredita dimensiones de cesta opcional." }
    ]
  },
  {
    url: "https://www.grupogalindoalquiler.es/wp-content/uploads/2017/06/haulotte-ha32px-es_1.pdf", brand: "Haulotte", model: "HA32PX", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "diésel", workingHeightM: 32,
      invariantGeometry: true, firstYear: 2004, lastYear: 2013 }, fields: ["Rotación de torreta"] }, facts: [
      { field: "Rotación de torreta", value: "360°", support: "Ficha HA32 PX 07/2013, p. 2: 360°; corroborada en ficha 03/2004 (https://gruaslozano.com/wp-content/uploads/2020/11/HA32PX-n.pdf). Se omite giro de cesta por diferencia entre ediciones." }
    ]
  },
  {
    url: "https://www.grarasulin.com/wp-content/uploads/2023/05/ha20px_uk_bda0a.pdf", brand: "Haulotte", model: "HA20PX", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "diésel", workingHeightM: 20,
      invariantGeometry: true, firstYear: 2011, lastYear: 2016 }, fields: ["Rotación de torreta", "Rotación de cesta"] }, facts: [
      { field: "Rotación de torreta", value: "360°", support: "Ficha HA20 PX 11/2011, p. 2, giro continuo 360°." },
      { field: "Rotación de cesta", value: "180°", support: "Misma tabla, recorrido total +90°/-90°; no modifica altura comercial declarada." }
    ]
  },
  {
    url: "https://tankrent.cl/wp-content/uploads/2024/07/HA260PX.pdf", brand: "Haulotte", model: "HA260PX", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "diésel", workingHeightM: 26,
      invariantGeometry: true, firstYear: 2005, lastYear: 2016 }, fields: ["Rotación de torreta", "Rotación de cesta"] }, facts: [
      { field: "Rotación de torreta", value: "360°", support: "Ficha HA260PX 06/2005, p. 2, giro continuo 360°; corroborado en manual HA20/260 2016 (https://www.sico.cz/wp-content/uploads/2021/05/Haulotte-HA-20-PX.pdf), características." },
      { field: "Rotación de cesta", value: "180°", support: "Mismas tablas, giro hidráulico de cesta 180° totales. No se atribuye cesta opcional." }
    ]
  },
  {
    url: "https://www.powerplant.ie/wp-content/uploads/2016/12/haulotte_optimum8.pdf", brand: "Haulotte", model: "Optimum 8", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 8,
      invariantGeometry: true, firstYear: 2017, lastYear: 2020 }, fields: ["Extensión de plataforma"] }, facts: [
      { field: "Extensión de plataforma", value: "0,86 m", support: "Haulotte Optimum 8, ficha 10/2016, p. 2, Length - extension 0,86 m; corroborada en ficha 06/2020 (https://portalimages.blob.core.windows.net/products/pdfs/skoluend_Haulotte-Optimum-8-Scissor-Lift-Specifications-United.pdf), p. 2, generación 7,77 m y anchura total 0,79 m. Se excluye 2016 y anteriores por coexistencia de generaciones; no se modifica la altura comercial declarada." }
    ]
  },
  {
    url: "https://vamenoleggio.it/images/mezzi/Piattaforme-Aeree/schede-tecniche/24-Scheda-tecnica-Haulotte-ha12ip-it.pdf", brand: "Haulotte", model: "HA12IP", reviewedOn: "2026-11-25",
    reuse: { fallback: true, compatibility: { family: "plataforma-articulada", energy: "eléctrica", workingHeightM: 12,
      invariantGeometry: true, firstYear: 2012, lastYear: 2018 }, fields: ["Anchura de plataforma"] }, facts: [
      { field: "Anchura de plataforma", value: "0,8 m", support: "Haulotte HA12 IP, ficha 09/2016, p. 2, cota G 0,8 m en cesta estándar y ancha; corroborada en ficha 03/2012 (https://irp.cdn-website.com/18c68e09/files/uploaded/Haulotte-HA12IP-UK-BD.pdf). No se atribuye capacidad ni dimensión F de la cesta opcional." }
    ]
  },
  {
    url: "https://www.coalci.es/wp-content/uploads/2021/07/haulotte-ha15ip.pdf", brand: "Haulotte", model: "HA15IP", reviewedOn: "2026-11-25",
    reuse: { fallback: true, compatibility: { family: "plataforma-articulada", energy: "eléctrica", workingHeightM: 15,
      invariantGeometry: true, firstYear: 2016, lastYear: 2018 }, fields: ["Anchura de plataforma"] }, facts: [
      { field: "Anchura de plataforma", value: "0,8 m", support: "Haulotte HA15 IP, ficha 01/2017, p. 2, cota G 0,8 m estándar y opcional; corroborada en ficha 06/2012 (https://joysat.eu/wp-content/uploads/2020/09/Caracter%C2%B0stiques-Ta%CC%88cniques-HA15IP.pdf). La altura comercial redondeada de 15 m identifica la clase; no se modifica la altura declarada ni se atribuye dimensión F." }
    ]
  },
  {
    url: "https://www.eagleplatforms.com/wp-content/uploads/HAULOTTE-COMPACT-12DX-SPEC-SHEET.pdf", brand: "Haulotte", model: "COMPACT-12DX", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "diésel", workingHeightM: 12,
      invariantGeometry: true, firstYear: 2018, lastYear: 2018 }, fields: ["Extensión de plataforma"] }, facts: [
      { field: "Extensión de plataforma", value: "1,2 m", support: "Haulotte Compact 12 DX, ficha 07/2013, p. 2, Platform extension length 1,2 m y equipamiento estándar; corroborada en ficha oficial (https://www.haulotte.co.uk/en_GB/product/compact-12-dx). Altura de trabajo comercial 12 m, no se altera." }
    ]
  },
  {
    url: "https://used-equipement.haulotte.com/images/atts/cdb14e_COMPACT8-10N%20FR.pdf", brand: "Haulotte", model: "COMPACT-10N", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 10,
      invariantGeometry: true, firstYear: 2014, lastYear: 2018 }, fields: ["Extensión de plataforma"] },
    facts: [{ field: "Extensión de plataforma", value: "0,92 m", support: "Haulotte Compact 8 / Compact 10N, 03/2018, p. 2, columna Compact 10N, Longueur extension 0,92 m; corroborada por ficha 04/2014, p. 2, bandeja extensible estándar (https://maximdomenech.es/alquiler/media/products/fichaTecnica/Haulotte_Compact_8-Compact_10N_8-10_metros.pdf). No aplicable a versiones AE o DX." }]
  },
  {
    url: "https://documentacionqr.com/sat/objects/955052/HAULOTTE_COMPACT%2010_FICHA_TECNICA_2018.pdf", brand: "Haulotte", model: "COMPACT-10", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 10,
      invariantGeometry: true, firstYear: 2018, lastYear: 2018 }, fields: ["Extensión de plataforma"] },
    facts: [{ field: "Extensión de plataforma", value: "0,92 m", support: "Haulotte Compact 8 W / 10 / 12, 03/2018, p. 2, columna Compact 10, Largo (extensión) 0,92 m, bandeja extensible estándar. Los 10 m declarados identifican la clase comercial; no se sustituye la altura ni se aplica a 10N, AE o DX." }]
  },
  {
    url: "https://documentacionqr.com/sat/objects/955887/HAULOTTE_COMPACT14_FICHA_TECNICA.pdf", brand: "Haulotte", model: "COMPACT-14", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-tijera", energy: "eléctrica", workingHeightM: 14,
      invariantGeometry: true, firstYear: 2014, lastYear: 2018 }, fields: ["Extensión de plataforma"] },
    facts: [{ field: "Extensión de plataforma", value: "0,92 m", support: "Haulotte Compact 14, 04/2014, p. 2, Largo (extensión) 0,92 m; p. 1 plataforma con una extensión. Coincide con ficha 02/2012, p. 2 (https://www.cdpaccess.ro/wp-content/uploads/2018/08/COMPACT14-UK-BD.pdf). Los 14 m anunciados identifican la clase comercial; no se alteran las alturas ni se atribuyen opciones." }]
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
    url: "https://www.grarasulin.com/wp-content/uploads/2023/05/ha20px_uk_bda0a.pdf", brand: "Haulotte", model: "HA20PX",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "13,5 m", support: "HA20 PX | Horizontal outreach | 13.5 m" },
      { field: "Altura de plataforma", value: "18,65 m", support: "HA20 PX | Platform height | 18.65 m" },
      { field: "Anchura (mm)", value: "2,38 m", support: "HA20 PX | Width | 2.38 m" },
      { field: "Capacidad máxima de plataforma", value: "230 kg", support: "HA20 PX | Lift capacity | 230 kg" }
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
    url: "https://www.eagleplatforms.com/wp-content/uploads/Haulotte-Compact-12-Electric-SPEC-SHEET.pdf",
    brand: "Haulotte", model: "Compact 12", reviewedOn: "2026-11-21", facts: [
      { field: "Anchura (mm)", value: "1,2 m", support: "Compact 12, página 2, columna COMPACT 12: F Overall width 1.2 m" },
      { field: "Capacidad máxima de plataforma", value: "300 kg", support: "Compact 12, página 2, columna COMPACT 12: Lift capacity inside/outside 300 kg" },
      { field: "Distancia entre ejes (mm)", value: "1,86 m", support: "Compact 12, página 2, columna COMPACT 12: H Wheelbase 1.86 m" },
      { field: "Extensión de plataforma", value: "0,92 m", support: "Compact 12, página 2, columna COMPACT 12: Length - extension 0.92 m" }
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
    url: "https://www.haulotte.com.es/es_ES/productos/ha16-rtj", brand: "HAULOTTE", model: "HA 16 RTJ", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "diésel", workingHeightM: 16,
      lengthM: 6.75, widthM: 2.3, loadCapacityKg: 230 }, fields: ["Altura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "14 m", support: "Haulotte HA16 RTJ, Datos Técnicos: altura de plataforma 14 m, altura de trabajo 16 m, capacidad 230 kg, largo replegado 6,75 m y ancho 2,3 m; corroborado por ficha CE HA16 RTJ / RTJ O de abril de 2024, página 2; no atribuye dimensiones de cesta opcional" }
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
      lengthM: 5.45, widthM: 1.35, loadCapacityKg: 230 }, fields: ["Altura de plataforma", "Anchura de plataforma", "Rotación de torreta"] }, facts: [
      { field: "Altura de plataforma", value: "10 m", support: "Haulotte HA12IP, ficha 03/2012, página 2, datos técnicos: altura de plataforma 10 m, trabajo 12 m, largo 5,45 m, ancho 1,35 m y capacidad 230 kg" },
      { field: "Anchura de plataforma", value: "0,8 m", support: "Haulotte HA12IP, ficha 03/2012, página 2, cota G: 0,8 m tanto en cesta estándar 1,2 x 0,8 m como en opción 1,5 x 0,8 m; no atribuye la dimensión F variable" }
    ]
  },
  {
    url: "https://irp.cdn-website.com/18c68e09/files/uploaded/Haulotte-HA12IP-UK-BD.pdf", brand: "Haulotte", model: "HA12IP", reviewedOn: "2026-11-26", facts: [
      { field: "Rotación de torreta", value: "355°", support: "Haulotte HA12IP, ficha 03/2012, p. 2, rotación de torreta 355°; corroborada en ficha 09/2016 (https://vamenoleggio.it/images/mezzi/Piattaforme-Aeree/schede-tecniche/24-Scheda-tecnica-Haulotte-ha12ip-it.pdf). Solo geometría compatible con la tabla; no equivale a rotación de cesta." }
    ]
  },
  {
    url: "https://joysat.eu/wp-content/uploads/2020/09/Caracter%C2%B0stiques-Ta%CC%88cniques-HA15IP.pdf", brand: "Haulotte", model: "HA15IP", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "eléctrica", workingHeightM: 15,
      lengthM: 6.6, widthM: 1.5, loadCapacityKg: 230 }, fields: ["Altura de plataforma", "Anchura de plataforma", "Rotación de torreta"] }, facts: [
      { field: "Altura de plataforma", value: "13 m", support: "Haulotte HA15IP, ficha 06/2012, página 2, datos técnicos: altura de plataforma 13 m, trabajo 15 m, largo 6,6 m, ancho 1,5 m y capacidad 230 kg" },
      { field: "Anchura de plataforma", value: "0,8 m", support: "Haulotte HA15IP, ficha 06/2012, página 2, cota G: 0,8 m tanto en cesta estándar 1,2 x 0,8 m como en opción 1,4 x 0,8 m; no atribuye la dimensión F variable" }
    ]
  },
  {
    url: "https://joysat.eu/wp-content/uploads/2020/09/Caracter%C2%B0stiques-Ta%CC%88cniques-HA15IP.pdf", brand: "Haulotte", model: "HA15IP", reviewedOn: "2026-11-26", facts: [
      { field: "Rotación de torreta", value: "350°", support: "Haulotte HA15IP, ficha 06/2012, p. 2, rotación de torreta 350°; corroborada en ficha 01/2017 (https://www.coalci.es/wp-content/uploads/2021/07/haulotte-ha15ip.pdf). Solo geometría compatible con la tabla; no equivale a rotación de cesta." }
    ]
  },
  {
    url: "https://joysat.eu/wp-content/uploads/2020/09/Caracter%C2%B0stiques-Ta%CC%88cniques-HA15IP.pdf", brand: "HAULOTTE", model: "HA 15 IP", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "eléctrica", workingHeightM: 15,
      lengthM: 6.6, widthM: 1.5, loadCapacityKg: 230 }, fields: ["Altura de plataforma", "Anchura de plataforma", "Rotación de torreta"] }, facts: [
      { field: "Altura de plataforma", value: "13 m", support: "Haulotte HA 15 IP, ficha 06/2012, página 2, datos técnicos: altura de plataforma 13 m, trabajo 15 m, largo 6,6 m, ancho 1,5 m y capacidad 230 kg" },
      { field: "Anchura de plataforma", value: "0,8 m", support: "Haulotte HA 15 IP, ficha 06/2012, página 2, cota G: 0,8 m tanto en cesta estándar 1,2 x 0,8 m como en opción 1,4 x 0,8 m; no atribuye la dimensión F variable" }
    ]
  },
  {
    url: "https://joysat.eu/wp-content/uploads/2020/09/Caracter%C2%B0stiques-Ta%CC%88cniques-HA15IP.pdf", brand: "HAULOTTE", model: "HA 15 IP", reviewedOn: "2026-11-26", facts: [
      { field: "Rotación de torreta", value: "350°", support: "Haulotte HA 15 IP, ficha 06/2012, p. 2, rotación de torreta 350°; corroborada en ficha 01/2017 (https://www.coalci.es/wp-content/uploads/2021/07/haulotte-ha15ip.pdf). Solo geometría compatible con la tabla; no equivale a rotación de cesta." }
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
  }
];

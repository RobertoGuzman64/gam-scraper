import type { ReviewedModelDocument } from "./types.js";

export const manitouDocuments: readonly ReviewedModelDocument[] = [
  {
    url: "https://malarlift.se/wp-content/uploads/2018/10/268388639-Manitou-Man-go-12-EN.pdf", brand: "Manitou", model: "MAN GO 12", reviewedOn: "2026-11-25",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "diésel", workingHeightM: 12,
      invariantGeometry: true, firstYear: 2017, lastYear: 2017 }, fields: ["Rotación de torreta"] }, facts: [
      { field: "Rotación de torreta", value: "350°", support: "Ficha MAN GO 12, p. 2, Turret rotation 350°, corroborada en https://www.manitou.com/en-GW/our-machines/mobile-elevating-work-platforms/mango-12. Se omite giro de cesta por diferencias entre ediciones." }
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
    url: "https://www.lectura-specs.es/es/modelo/plataformas-elevadoras/plataformas-elevadoras-articuladas-plataformas-articuladas-de-ruedas-manitou/150-aetj-c-1036275", brand: "Manitou", model: "150AETJC",
    reviewedOn: "2026-11-21", facts: [
      { field: "Alcance horizontal (m)", value: "7,6 m", support: "Manitou 150 AETJ C | Max. Alcance lateral | 7.6 m" },
      { field: "Anchura (mm)", value: "1,5 m", support: "Manitou 150 AETJ C | Anchura transporte | 1.5 m" },
      { field: "Capacidad máxima de plataforma", value: "200 kg", support: "Manitou 150 AETJ C | Carga útil | 200 kg" }
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
    url: "https://www.lectura-specs.es/es/modelo/plataformas-elevadoras/plataformas-elevadoras-articuladas-plataformas-articuladas-de-ruedas-manitou/160-atj-11680545", brand: "Manitou", model: "160ATJ",
    reviewedOn: "2026-11-21", facts: [
      { field: "Anchura (mm)", value: "2,30 m", support: "Manitou 160 ATJ | Transport width | 2.3 m" },
      { field: "Anchura de plataforma", value: "0,8 m", support: "Manitou 160 ATJ | Platform width | 0.8 m" },
      { field: "Capacidad máxima de plataforma", value: "230 kg", support: "Manitou 160 ATJ | Platform capacity | 230 kg" },
      { field: "Longitud de plataforma", value: "1,80 m", support: "Manitou 160 ATJ | Platform length | 1.8 m" }
    ]
  },
  {
    url: "https://www.lectura-specs.com/en/model/aerial-work-platform/articulating-boom-lifts-wheeled-articulating-boom-lifts-manitou/200-atj-1161009", brand: "Manitou", model: "200ATJ",
    reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "18,28 m", support: "Manitou 200 ATJ | Platform height | 18,28 m | https://www.colle.eu/en/rent/working-at-heights/aerial-lifts/articulating-boom-lifts/manitou-200-atj/" }
    ]
  },
  {
    url: "https://www.grupogalindoalquiler.es/wp-content/uploads/2017/06/manitou-150-aetjc.pdf",
    brand: "Manitou", model: "150AETJC", reviewedOn: "2026-11-21", facts: [
      { field: "Altura de plataforma", value: "13 m", support: "Manitou 150 AETJ C Compact, ficha 700344ES 01/07: Altura del suelo | 13,00 m" }
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
    url: "https://www.colle.eu/media/6015/170aetj-l_eng.pdf",
    brand: "Manitou", model: "170AETJL", reviewedOn: "2026-11-21",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "eléctrica", workingHeightM: 17,
      invariantGeometry: true, firstYear: 2014, lastYear: 2016 }, fields: ["Rotación de torreta", "Rotación de cesta"] }, facts: [
      { field: "Rotación de torreta", value: "355°", support: "Ficha Manitou 170AETJL, p. 2, Turntable rotation 355°; rango nominal de giro, no giro continuo." },
      { field: "Rotación de cesta", value: "140°", support: "Ficha Manitou 170AETJL, p. 2, Basket rotation 140°; recorrido total, no 140° por lado. No se atribuye dimensión de cesta opcional." },
      { field: "Alcance horizontal (m)", value: "9,4 m", support: "170 AETJ L, página 2: Horizontal outreach 9.40 m" },
      { field: "Altura de plataforma", value: "14,9 m", support: "170 AETJ L, página 2: Platform height 14.90 m" },
      { field: "Anchura (mm)", value: "1,75 m", support: "170 AETJ L, página 2: Width 1.75 m" },
      { field: "Capacidad máxima de plataforma", value: "200 kg", support: "170 AETJ L, página 2: Platform capacity 200 kg / 2 peoples" }
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
    url: "https://www.colle.eu/media/6008/120aetj-c-eng.pdf", brand: "Manitou", model: "120AETJC", reviewedOn: "2026-11-21",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "eléctrica", workingHeightM: 12,
      invariantGeometry: true, firstYear: 2015, lastYear: 2015 }, fields: ["Rotación de torreta", "Rotación de cesta"] }, facts: [
      { field: "Rotación de torreta", value: "355°", support: "Ficha Manitou 120AETJC, p. 2, Turntable rotation 355°; rango nominal de giro, no giro continuo." },
      { field: "Rotación de cesta", value: "140°", support: "Ficha Manitou 120AETJC, p. 2, Basket rotation 140°; recorrido total, no 140° por lado. No se atribuye dimensión de cesta opcional." },
      { field: "Alcance horizontal (m)", value: "7 m", support: "Manitou 120 AETJ-C, página 2: Outreach 7.00 m" },
      { field: "Altura de plataforma", value: "9,95 m", support: "Manitou 120 AETJ-C, página 2: Platform height 9.95 m" },
      { field: "Anchura (mm)", value: "1,2 m", support: "Manitou 120 AETJ-C, página 2: Overall width 1.20 m" },
      { field: "Capacidad máxima de plataforma", value: "200 kg", support: "Manitou 120 AETJ-C, página 2: Capacity 200 kg" }
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
    url: "https://www.lejarzamaquinaria.com/wp-content/uploads/2023/07/150-AETJ-C.pdf", brand: "MANITOU", model: "150 AETJ C", reviewedOn: "2026-11-24",
    reuse: { compatibility: { family: "plataforma-articulada", energy: "eléctrica", workingHeightM: 15,
      lengthM: 6.05, widthM: 1.5, loadCapacityKg: 200 }, fields: ["Altura de plataforma"] }, facts: [
      { field: "Altura de plataforma", value: "13 m", support: "Manitou 150 AETJ-C, ficha del 27/02/2023, página 2, h7: altura de plataforma 13 m, h21 15 m, Q 200 kg, l1 6,05 m y b1 1,50 m; corroborada por ficha CE FT015ES_B_0912_150AETJC de 2012. No aplicable a la versión posterior de 220 kg ni se recuperan dimensiones de cesta variables" }
    ]
  }
];

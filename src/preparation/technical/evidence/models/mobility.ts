import type { ReviewedModelDocument } from "./types.js";

export const mobilityDocuments: readonly ReviewedModelDocument[] = [
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
    url: "https://www.zeromotorcycle.eu/en/motorcycle/ds/", brand: "ZERO", model: "DS 14",
    reviewedOn: "2026-11-21", facts: [
      { field: "Altura del asiento", value: "843 mm", support: "Seat height 843 mm" },
      { field: "Par motor máximo del modelo", value: "109 Nm", support: "Peak torque 109Nm" },
      { field: "Peso en orden de marcha del modelo", value: "187 kg", support: "Curb weight 187 kg" }
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
    url: "https://aftersales.paxster.no/wp-content/uploads/2023/05/User-Manual-Paxster-Gen2.2-Rev6-05-05-2023.pdf",
    brand: "Paxster", model: "Gen 2.2", reviewedOn: "2026-11-21", facts: [
      { field: "Número de plazas del modelo", value: "1", support: "Paxster Gen 2.2, Operating Instructions rev. 06, p. 25: Seats | 1 (center seat), en las cuatro variantes" }
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
    url: "https://www.automobile-catalog.com/make/santana/series_iii_land/series_iii_109_wagon/1980.html",
    brand: "LAND ROVER", model: "SANTANA", reviewedOn: "2026-11-21", facts: [
      { field: "Caja de cambios del modelo", value: "Manual de 4 velocidades", support: "Santana Series III 109 Techo Metálico (Wagon), gama 1980: manual 4-speed gearbox; el original GAM 5254 identifica 1980 y longitud 4440 mm, coincidente con la versión 109" },
      { field: "Distancia entre ejes del modelo", value: "2769 mm", support: "Santana Series III 109 Techo Metálico (Wagon), gama 1980: wheelbase 2769 mm; el original GAM 5254 indica longitud 4440 mm, propia de la batalla 109 frente a la 88" },
      { field: "Tipo de tracción", value: "4x4 conectable", support: "Santana Series III 109 Techo Metálico (Wagon), gama 1980: 4x4 part-time, rear permanent and front engaged manually; no se atribuye tracción permanente ni motorización concreta" }
    ]
  }
];

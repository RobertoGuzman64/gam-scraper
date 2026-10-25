export type EditorialExclusion = {
  readonly providerId: string;
  readonly reference: string;
  readonly sourceUrl: string;
  readonly reason: string;
  readonly evidenceUrls: readonly string[];
  readonly requiredIssues: readonly string[];
};


export const exclusions: readonly EditorialExclusion[] = [
  {
    providerId: "gam", reference: "6682",
    sourceUrl: "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/6682-2020-hyster-h35ft",
    reason: "No publicable hasta acreditar la identidad física y la titularidad del número de serie compartido con GAM-11594; el stock GAM-11596 y el horómetro distintos no demuestran dos unidades independientes",
    evidenceUrls: [
      "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/6682-2020-hyster-h35ft",
      "https://www.machineryzone.es/usado/carretilla-elevadora-gas/47102132/hyster-h3-5ft.html"
    ],
    requiredIssues: ["Número de serie P177B10585U compartido", "Stock GAM diferenciado"]
  },
  {
    providerId: "gam", reference: "6703",
    sourceUrl: "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/6703-2020-hyster-h35ft",
    reason: "No publicable hasta acreditar la identidad física y la titularidad del número de serie compartido con GAM-11596; no consolidar ni asignar el VIN por suposición",
    evidenceUrls: [
      "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/6703-2020-hyster-h35ft",
      "https://www.machineryzone.es/usado/carretilla-elevadora-gas/47102020/hyster-h3-5ft.html"
    ],
    requiredIssues: ["Número de serie P177B10585U compartido", "Stock GAM diferenciado"]
  },
  {
    providerId: "mercaeleva", reference: "M827-8304",
    sourceUrl: "https://sales.mercaeleva.com/es/for-sale/machine/Linde-E48P-M827-8304",
    reason: "No publicable: la publicación MER0798 contradice la capacidad de carga (4800/3000 kg) y el mástil (dúplex/tríplex); requiere confirmación del equipo físico",
    evidenceUrls: [
      "https://sales.mercaeleva.com/es/for-sale/machine/Linde-E48P-M827-8304",
      "https://machineryline.info/-/sale/electric-forklifts/Linde/E48P-CARRETILLA-ELEVADORA-ELECTRICA-4800-KG--26071017125032650600"
    ],
    requiredIssues: ["Atributo contradictorio: Capacidad de carga", "Atributo contradictorio: Tipo de mástil", "MER0798:"]
  }
];

export type EditorialHold = {
  readonly providerId: string;
  readonly reference: string;
  readonly sourceUrl: string;
  readonly currentSourceUrl: string;
  readonly reason: string;
  readonly evidenceUrls: readonly string[];
  readonly requiredIssues: readonly string[];
};

export const identityHolds: readonly EditorialHold[] = [
  {
    providerId: "gam", reference: "6002",
    sourceUrl: "https://online.gamrentals.com/es/hyster/6002-carretilla-elevadora-electrica-hyster-j50xtg6",
    currentSourceUrl: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-hyster/6002-carretilla-elevadora-electrica-hyster-j50xtg6",
    reason: "La carretilla Hyster J5.0XTLG6 se anuncia como Hyster, pero GAM publica YALE como marca técnica. Identidad no reconciliada; no corregir ni publicar sin evidencia",
    evidenceUrls: ["https://online.gamrentals.com/es/hyster/6002-carretilla-elevadora-electrica-hyster-j50xtg6"],
    requiredIssues: ["marca HYSTER en anuncio y YALE en ficha técnica"]
  },
  {
    providerId: "gam", reference: "6003",
    sourceUrl: "https://online.gamrentals.com/es/hyster/6003-carretilla-elevadora-electrica-hyster-j60xtg6",
    currentSourceUrl: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-hyster/6003-carretilla-elevadora-electrica-hyster-j60xtg6",
    reason: "La carretilla Hyster J6.0XTLG6 se anuncia como Hyster, pero GAM publica YALE como marca técnica. Identidad no reconciliada; no corregir ni publicar sin evidencia",
    evidenceUrls: ["https://online.gamrentals.com/es/hyster/6003-carretilla-elevadora-electrica-hyster-j60xtg6"],
    requiredIssues: ["marca HYSTER en anuncio y YALE en ficha técnica"]
  },
  {
    providerId: "gam", reference: "6004",
    sourceUrl: "https://online.gamrentals.com/es/hyster/6004-carretilla-elevadora-electrica-hyster-j70xtg6",
    currentSourceUrl: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-hyster/6004-carretilla-elevadora-electrica-hyster-j70xtg6",
    reason: "GAM anuncia Hyster J7.0XTLG6, pero especifica YALE J7.0XTG6. Marca y modelo sin acreditar; no corregir ni publicar por suposición",
    evidenceUrls: ["https://online.gamrentals.com/es/hyster/6004-carretilla-elevadora-electrica-hyster-j70xtg6"],
    requiredIssues: ["marca HYSTER en anuncio y YALE en ficha técnica", "modelo anunciado distinto de J7.0XTG6"]
  }
];


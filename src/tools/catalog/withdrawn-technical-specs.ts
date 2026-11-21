import type { PanelProviderId } from "../../panel/evidence/types.js";

export type WithdrawnTechnicalSpec = {
  readonly providerId: PanelProviderId;
  readonly reference: string;
  readonly field: string;
  readonly value: string;
  readonly reason: string;
};

export const withdrawnTechnicalSpecs: readonly WithdrawnTechnicalSpec[] = [
  { providerId: "gam", reference: "6994", field: "Yale MP16 · Ancho exterior de horquillas", value: "680 mm",
    reason: "Configuración no acreditada; documentación contradictoria de 670/680 mm" },
  { providerId: "mercaeleva", reference: "M690-5522", field: "Anchura de plataforma", value: "1,42 m",
    reason: "Ancho de cesta opcional; configuración instalada no acreditada" },
  { providerId: "mercaeleva", reference: "M879-4639", field: "Centro de carga", value: "600 mm",
    reason: "Documentos de variantes relacionadas sin identidad inequívoca" }
];

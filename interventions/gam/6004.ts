import type { InterventionMetadata, ManualInterventionProposal } from "../../src/catalog/interventions/contracts.js";

export const metadata = {
  id: "gam-6004",
  summary: "Corrige la marca y el modelo de la carretilla HYSTER GAM 6004"
} satisfies InterventionMetadata;

export const proposals = [
  {
    "providerId": "gam",
    "identity": "gam:ref:6004",
    "field": "brand",
    "expected": "YALE",
    "next": "HYSTER",
    "reason": "La ficha GAM 6004 se anuncia y describe como HYSTER, mientras el campo de marca indica YALE. Corrección puntual ya acreditada en la campaña previa.",
    "evidence": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-hyster/6004-carretilla-elevadora-electrica-hyster-j70xtg6"
  },
  {
    "providerId": "gam",
    "identity": "gam:ref:6004",
    "field": "model",
    "expected": "J7.0XTG6",
    "next": "J7.0XTLG6",
    "reason": "La denominación y descripción publicadas para GAM 6004 identifican el modelo J7.0XTLG6; el dato técnico J7.0XTG6 es contradictorio. Corrección puntual acreditada en la campaña previa.",
    "evidence": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-hyster/6004-carretilla-elevadora-electrica-hyster-j70xtg6"
  },
  {
    "providerId": "gam",
    "identity": "gam:ref:6004",
    "field": "spec:Marca",
    "expected": "YALE",
    "next": "HYSTER",
    "reason": "La ficha GAM 6004 se anuncia y describe como HYSTER, mientras el campo de marca indica YALE. Corrección puntual ya acreditada en la campaña previa.",
    "evidence": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-hyster/6004-carretilla-elevadora-electrica-hyster-j70xtg6"
  },
  {
    "providerId": "gam",
    "identity": "gam:ref:6004",
    "field": "spec:Modelo",
    "expected": "J7.0XTG6",
    "next": "J7.0XTLG6",
    "reason": "La denominación y descripción publicadas para GAM 6004 identifican el modelo J7.0XTLG6; el dato técnico J7.0XTG6 es contradictorio. Corrección puntual acreditada en la campaña previa.",
    "evidence": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-hyster/6004-carretilla-elevadora-electrica-hyster-j70xtg6"
  }
] satisfies readonly ManualInterventionProposal[];

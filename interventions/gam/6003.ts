import type { InterventionMetadata, ManualInterventionProposal } from "../../src/catalog/interventions/contracts.js";

export const metadata = {
  id: "gam-6003",
  summary: "Corrige la marca YALE por HYSTER de la carretilla GAM 6003"
} satisfies InterventionMetadata;

export const proposals = [
  {
    "providerId": "gam",
    "identity": "gam:ref:6003",
    "field": "brand",
    "expected": "YALE",
    "next": "HYSTER",
    "reason": "La ficha GAM 6003 se anuncia y describe como HYSTER, mientras el campo de marca indica YALE. Corrección puntual ya acreditada en la campaña previa.",
    "evidence": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-hyster/6003-carretilla-elevadora-electrica-hyster-j60xtg6"
  },
  {
    "providerId": "gam",
    "identity": "gam:ref:6003",
    "field": "spec:Marca",
    "expected": "YALE",
    "next": "HYSTER",
    "reason": "La ficha GAM 6003 se anuncia y describe como HYSTER, mientras el campo de marca indica YALE. Corrección puntual ya acreditada en la campaña previa.",
    "evidence": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-hyster/6003-carretilla-elevadora-electrica-hyster-j60xtg6"
  }
] satisfies readonly ManualInterventionProposal[];

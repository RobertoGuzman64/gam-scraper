import type { PanelExplorerProduct, PanelFieldDifference, PanelSpecAddition } from "../explorer/types.js";

export const stages: Readonly<Record<PanelExplorerProduct["stage"], string>> = {
  commercial: "Exportada", "commercial-excluded": "Excluida comercial", "editorial-excluded": "Excluida editorial"
};
export const changes: Readonly<Record<PanelFieldDifference["change"], string>> = {
  added: "Incorporado", changed: "Modificado", unchanged: "Conservado", removed: "Retirado", ambiguous: "Sin correspondencia unívoca"
};
export const formatNumber = new Intl.NumberFormat("es-ES");
export const additionLabels: Readonly<Record<PanelSpecAddition["kind"], string>> = {
  own: "Propia ficha", reused: "Reutilizada", pending: "Por investigar"
};

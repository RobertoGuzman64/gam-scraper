import type { PanelDashboardPayload } from "../application/dashboard-data.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isPayload = (value: unknown): value is PanelDashboardPayload => {
  if (!isRecord(value) || !isRecord(value.snapshot) || !isRecord(value.names)) return false;
  return Array.isArray(value.snapshot.providers) && isRecord(value.snapshot.totals) &&
    typeof value.snapshot.packageDateUtc === "string" &&
    Array.isArray(value.definitions) &&
    isRecord(value.explorer) && Array.isArray(value.explorer.products) && Array.isArray(value.explorer.cases);
};
export const readPanelPayload = (): PanelDashboardPayload => {
  const raw = document.getElementById("panel-data")?.textContent;
  if (!raw) throw new Error("Datos del panel no disponibles");
  const decoded: unknown = JSON.parse(raw);
  if (!isPayload(decoded)) throw new Error("Contrato de visualización incompatible");
  return decoded;
};

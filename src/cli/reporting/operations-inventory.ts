import type { CampaignOperationsStatus } from "../../pipeline/campaign/operations-status.js";
import type { InventoryItem, OperationsInventory } from "../../pipeline/campaign/operations-inventory.js";
import { formatHeader, printStatus, printReportLine } from "./terminal.js";

const printItem = (label: string, item: InventoryItem): void => {
  if (item.state === "ausente") {
    printReportLine(`  ${label} | AUSENTE | ${item.detail}`);
    return;
  }
  const level = item.state === "correcto" ? "PASS" : item.state === "error" ? "FAIL" : "WARN";
  printStatus(level, `${label} | ${item.state.toUpperCase()} | ${item.detail}`);
};

export const printOperationsInventory = (status: CampaignOperationsStatus, inventory: OperationsInventory): void => {
  printReportLine(formatHeader("ESTADO OPERATIVO"));
  printReportLine(`LOTE RECONOCIDO | ${status.campaign.runId ?? "sin lote"} | ${status.description}`);
  for (const issue of status.campaign.issues) printStatus("WARN", issue);
  printItem("REFERENCIA", status.reference.status === "valid"
    ? { state: "correcto", detail: "Válida" }
    : status.reference.status === "absent" ? { state: "ausente", detail: "No existe referencia" }
      : { state: status.reference.status === "recoverable" ? "parcial" : "error",
        detail: status.reference.reason });
  printReportLine("\nDOCUMENTACIÓN Y RECURSOS ESENCIALES");
  for (const entry of inventory.essentials) printItem(entry.path, entry.status);
  printReportLine("\nPROVEEDORES");
  for (const provider of inventory.providers) {
    printReportLine(`  ${provider.providerId.toUpperCase()}`);
    printItem("  ORIGINAL OPERATIVO", provider.original);
    printItem("  ORIGINAL REPOSITORIO", provider.portableOriginal);
    if (provider.consistency.state !== "ausente") printItem("  COHERENCIA", provider.consistency);
    printItem("  PREPARACIÓN", provider.preparation);
    printItem("  JSON FINAL", provider.final);
  }
  printReportLine("\nCAMPAÑAS CONSERVADAS");
  printReportLine(`  ENTREGAS ACREDITADAS | ${inventory.retainedDeliveries}/2`);
  for (const campaign of inventory.campaigns) printItem(`  ${campaign.runId}`, campaign.status);
  if (!inventory.campaigns.length) printReportLine("  Sin campañas registradas");
  for (const issue of inventory.campaignIssues) printStatus("FAIL", issue);
  printReportLine("\nCATALOGS/ VERSIONADOS");
  printReportLine(`  CAMPAÑAS ACREDITADAS | ${inventory.portableDeliveries}/2`);
  for (const campaign of inventory.portableCampaigns) printItem(`  ${campaign.runId}`, campaign.status);
  if (!inventory.portableCampaigns.length) printReportLine("  Sin campañas portátiles registradas");
  for (const issue of inventory.portableIssues) printStatus("FAIL", issue);
  printReportLine("  CONSULTA | Sin escrituras, extracciones ni recomendaciones operativas");
};

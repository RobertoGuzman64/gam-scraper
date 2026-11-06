import type { CampaignOperationsStatus } from "../../campaign/operations-status.js";
import type { InventoryItem, OperationsInventory } from "../../campaign/operations-inventory.js";
import {
  printCommandHeader, printCommandProvider, printCommandResult, printCommandSection,
  printCommandWarning, printStatus, printReportLine
} from "./terminal.js";

const printItem = (label: string, item: InventoryItem): void => {
  if (item.state === "ausente") {
    printReportLine(`  ${label} | AUSENTE | ${item.detail}`);
    return;
  }
  const level = item.state === "correcto" ? "PASS" : item.state === "error" ? "FAIL" : "WARN";
  printStatus(level, `${label} | ${item.state.toUpperCase()} | ${item.detail}`);
};

const printDetails = (status: CampaignOperationsStatus, inventory: OperationsInventory): void => {
  printCommandSection("CAMPAÑA GLOBAL");
  printReportLine(`${status.campaign.runId ?? "sin lote"} | ${status.description}`);
  for (const issue of status.campaign.issues) printCommandWarning(issue);
  printItem("REFERENCIA", status.reference.status === "valid"
    ? { state: "correcto", detail: "Válida" }
    : status.reference.status === "absent" ? { state: "ausente", detail: "No existe referencia" }
      : { state: status.reference.status === "recoverable" ? "parcial" : "error",
        detail: status.reference.reason });
  printCommandSection("PROVEEDORES · DIAGNÓSTICO COMPLETO");
  for (const provider of inventory.providers) {
    printReportLine("");
    printReportLine(`  ${provider.providerId.toUpperCase()}`);
    printItem("  ORIGINAL OPERATIVO", provider.original);
    printItem("  ORIGINAL REPOSITORIO", provider.portableOriginal);
    if (provider.consistency.state !== "ausente") printItem("  COHERENCIA", provider.consistency);
    printItem("  PREPARACIÓN", provider.preparation);
    printItem("  JSON FINAL", provider.final);
  }
  printCommandSection("CAMPAÑAS CONSERVADAS");
  printReportLine(`  ENTREGAS ACREDITADAS | ${inventory.retainedDeliveries}/2`);
  for (const campaign of inventory.campaigns) printItem(`  ${campaign.runId}`, campaign.status);
  if (!inventory.campaigns.length) printReportLine("  Sin campañas registradas");
  printCommandSection("CATALOGS/ VERSIONADOS");
  printReportLine(`  CAMPAÑAS ACREDITADAS | ${inventory.portableDeliveries}/2`);
  for (const campaign of inventory.portableCampaigns) printItem(`  ${campaign.runId}`, campaign.status);
  if (!inventory.portableCampaigns.length) printReportLine("  Sin campañas portátiles registradas");
};

export const printOperationsInventory = (
  status: CampaignOperationsStatus, inventory: OperationsInventory, detailed = false
): void => {
  printCommandHeader("ESTADO OPERATIVO");
  const individual = inventory.providers.filter((entry) =>
    ["gam", "gomariz", "mercaeleva"].includes(entry.providerId));
  const verified = individual.filter((entry) => entry.final.state === "correcto").length;
  printReportLine(`PUBLICACIONES INDIVIDUALES | ${verified}/${individual.length} vigentes verificables`);
  printReportLine(`CAMPAÑA GLOBAL | ${status.campaign.runId ? status.description : "sin actividad"} (circuito independiente)`);
  printCommandSection("PROVEEDORES");
  for (const provider of inventory.providers) {
    const primary = provider.final.state === "correcto" ? "publicación verificada" :
      provider.final.state === "ausente" ? "sin publicación individual" : provider.final.state.toUpperCase();
    printCommandProvider(provider.providerId, `${primary} · preparación ${provider.preparation.state}`);
    if (["gam", "gomariz", "mercaeleva"].includes(provider.providerId)) {
      for (const [label, item] of [["ORIGINAL", provider.original], ["ORIGINAL REPOSITORIO", provider.portableOriginal],
        ["COHERENCIA", provider.consistency], ["PREPARACIÓN", provider.preparation], ["PUBLICACIÓN", provider.final]] as const) {
        if (item.state !== "correcto" && (label !== "COHERENCIA" || item.state !== "ausente")) {
          printStatus(item.state === "error" ? "FAIL" : "WARN", `${provider.providerId.toUpperCase()} ${label} | ${item.detail}`);
        }
      }
    } else if (provider.final.state === "ausente") {
      printReportLine(`  ${provider.providerId.toUpperCase()} no participa en las publicaciones individuales`);
    }
  }
  if (status.reference.status === "invalid") printStatus("FAIL", `REFERENCIA GLOBAL | ${status.reference.reason}`);
  else if (status.reference.status === "recoverable") printCommandWarning(`REFERENCIA GLOBAL | ${status.reference.reason}`);
  for (const issue of status.campaign.issues) printCommandWarning(issue);
  for (const issue of [...inventory.campaignIssues, ...inventory.portableIssues]) printStatus("FAIL", issue);
  if (detailed) printDetails(status, inventory);
  const invalid = individual.some((item) => item.final.state === "error");
  printCommandResult(verified === individual.length
    ? `Publicaciones individuales ${verified}/${individual.length} verificadas; consulta sin escrituras`
    : `Publicaciones individuales ${verified}/${individual.length} verificadas; revisar proveedores pendientes`,
  verified === individual.length ? "PASS" : invalid ? "FAIL" : "WARN");
};

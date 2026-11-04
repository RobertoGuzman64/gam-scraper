import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { CampaignOperationsStatus } from "../../../pipeline/campaign/operations-status.js";
import type { InventoryItem, OperationsInventory, ProviderInventory } from "../../../pipeline/campaign/operations-inventory.js";
import { printOperationsInventory } from "../operations-inventory.js";

const valid: InventoryItem = { state: "correcto", detail: "Verificado" };
const missing: InventoryItem = { state: "ausente", detail: "Sin JSON final acreditado" };

const provider = (providerId: string, final: InventoryItem = valid): ProviderInventory => ({
  providerId, original: valid, portableOriginal: valid, consistency: valid, preparation: valid, final
});

const status: CampaignOperationsStatus = {
  campaign: { requestedProviders: [], runId: null, runFile: null, status: "none", providers: [], issues: [] },
  reference: { status: "absent" }, description: "Sin campaña activa", next: [], alerts: []
};

const inventory: OperationsInventory = {
  essentials: [{ path: "README.md", status: valid }, { path: "package.json", status: valid }],
  providers: [provider("gam"), provider("gomariz"), provider("mercaeleva"), provider("manain", missing)],
  campaigns: [], retainedDeliveries: 0, portableCampaigns: [], portableDeliveries: 0,
  portableIssues: [], campaignIssues: []
};

test("estado omite recursos esenciales y separa los proveedores sin cambiar sus diagnósticos", () => {
  const lines: string[] = [];
  const consoleLog = mock.method(console, "log", (message: string) => { lines.push(message); });
  const stdout = mock.method(process.stdout, "write", (message: string | Uint8Array) => {
    lines.push(typeof message === "string" ? message.trimEnd() : message.toString().trimEnd());
    return true;
  });
  try {
    printOperationsInventory(status, inventory);
  } finally {
    stdout.mock.restore();
    consoleLog.mock.restore();
  }
  const output = lines.join("\n").replace(/\u001b\[[0-9;]*m/g, "");
  assert.doesNotMatch(output, /DOCUMENTACIÓN Y RECURSOS ESENCIALES|README\.md|package\.json/);
  assert.match(output, /PUBLICACIONES INDIVIDUALES \| 3\/3 vigentes verificables/);
  assert.match(output, /  GAM\n(?:.|\n)*  JSON FINAL \| CORRECTO \| Verificado\n\n  GOMARIZ/);
  assert.match(output, /  GOMARIZ\n(?:.|\n)*  JSON FINAL \| CORRECTO \| Verificado\n\n  MERCAELEVA/);
  assert.match(output, /  MERCAELEVA\n(?:.|\n)*  JSON FINAL \| CORRECTO \| Verificado\n\n  MANAIN/);
  assert.match(output, /  MANAIN\n(?:.|\n)*  PREPARACIÓN \| CORRECTO \| Verificado\n\n    JSON FINAL \| AUSENTE/);
  assert.match(output, /CONSULTA \| Sin escrituras, extracciones ni recomendaciones operativas/);
});

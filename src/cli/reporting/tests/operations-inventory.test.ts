import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { CampaignOperationsStatus } from "../../../campaign/operations-status.js";
import type { InventoryItem, OperationsInventory, ProviderInventory } from "../../../campaign/operations-inventory.js";
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

const capture = (detailed: boolean, snapshot: OperationsInventory = inventory): string => {
  const lines: string[] = [];
  const consoleLog = mock.method(console, "log", (message: string) => { lines.push(message); });
  const stderr = mock.method(process.stderr, "write", (message: string | Uint8Array) => {
    lines.push(typeof message === "string" ? message.trimEnd() : message.toString().trimEnd());
    return true;
  });
  const stdout = mock.method(process.stdout, "write", (message: string | Uint8Array) => {
    lines.push(typeof message === "string" ? message.trimEnd() : message.toString().trimEnd());
    return true;
  });
  try {
    printOperationsInventory(status, snapshot, detailed);
  } finally {
    stdout.mock.restore();
    stderr.mock.restore();
    consoleLog.mock.restore();
  }
  return lines.join("\n").replace(/\u001b\[[0-9;]*m/g, "");
};

test("estado breve distingue publicaciones verificadas, campaña inactiva y MANAIN parcial", () => {
  const output = capture(false);
  assert.match(output, /PUBLICACIONES INDIVIDUALES \| 3\/3 vigentes verificables/);
  assert.match(output, /CAMPAÑA GLOBAL \| sin actividad/);
  assert.match(output, /GAM.*publicación verificada/);
  assert.match(output, /MERCAELEVA.*publicación verificada/);
  assert.match(output, /MANAIN.*no participa en las publicaciones individuales/);
  assert.match(output, /RESULTADO\nPASS \| Publicaciones individuales 3\/3 verificadas/);
  assert.doesNotMatch(output, /README\.md|JSON FINAL|CAMPAÑAS CONSERVADAS/);
  assert.ok(output.split("\n").length < 20);
});

test("estado detallado conserva cada diagnóstico y separa los proveedores", () => {
  const output = capture(true);
  assert.match(output, /GAM\n(?:.|\n)*JSON FINAL \| CORRECTO \| Verificado/);
  assert.match(output, /GOMARIZ\n(?:.|\n)*JSON FINAL \| CORRECTO \| Verificado/);
  assert.match(output, /MERCAELEVA\n(?:.|\n)*JSON FINAL \| CORRECTO \| Verificado/);
  assert.match(output, /MANAIN\n(?:.|\n)*JSON FINAL \| AUSENTE/);
  assert.match(output, /CAMPAÑAS CONSERVADAS/);
  assert.match(output, /CATALOGS\/ VERSIONADOS/);
});

test("estado breve no oculta un fallo de la publicación individual", () => {
  const output = capture(false, { ...inventory, providers: [
    provider("gam", { state: "error", detail: "SHA-256 incorrecto" }), provider("gomariz"), provider("mercaeleva")
  ] });
  assert.match(output, /FAIL \| GAM PUBLICACIÓN \| SHA-256 incorrecto/);
  assert.match(output, /RESULTADO\nFAIL \| Publicaciones individuales 2\/3 verificadas/);
});

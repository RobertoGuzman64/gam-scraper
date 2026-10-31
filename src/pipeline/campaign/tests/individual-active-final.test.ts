import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { selectActivePublication } from "../../publication/active-publication.js";
import { inspectCampaignOperations } from "../operations-status.js";
import { inspectOperationsInventory } from "../operations-inventory.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const sha = "1e094214a4a5a6ea4bc8943c5028620bee9359d6c13aff27ec29a62bfbb4d59e";

test("estado consulta el final individual vigente sin acreditarlo como campaña global", async () => {
  const temp = await mkdtemp(join(tmpdir(), "inventario-final-vigente-"));
  try {
    const dir = join(temp, "catalogs", "providers", "gomariz", "publications");
    await mkdir(dir, { recursive: true });
    await cp(join(root, "catalogs", "providers", "gomariz", "publications", sha), join(dir, sha), { recursive: true });
    assert.equal((await selectActivePublication(temp, "gomariz", sha, true)).status, "activated");
    const status = await inspectCampaignOperations(temp);
    const inventory = await inspectOperationsInventory(temp, status);
    const provider = inventory.providers.find((item) => item.providerId === "gomariz");
    assert.equal(provider?.final.state, "correcto");
    assert.match(provider?.final.detail ?? "", new RegExp(sha));
    assert.equal(inventory.retainedDeliveries, 0);
    assert.equal(inventory.portableDeliveries, 0);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

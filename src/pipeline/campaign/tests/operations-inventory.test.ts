import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { inspectCampaignOperations } from "../operations-status.js";
import { inspectOperationsInventory } from "../operations-inventory.js";

test("estado distingue parcial acreditado y archivo alterado sin crear archivos de trabajo", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-inventory-"));
  try {
    const status = await inspectCampaignOperations(root);
    const initial = await inspectOperationsInventory(root, status);
    assert.equal(initial.providers.length, 4);
    assert.ok(initial.providers.every((provider) => provider.original.state === "ausente" && provider.final.state === "ausente"));
    assert.ok(initial.essentials.every((entry) => entry.status.state === "error"));
    assert.deepEqual(await readdir(root), []);

    const dir = join(root, "storage", "scraped", "manain");
    await mkdir(dir, { recursive: true });
    const csv = join(dir, "scrape-manain-partial-all.csv");
    const content = "providerId,title\nmanain,TEST\n";
    await writeFile(csv, content);
    await writeFile(join(dir, "scrape-manain-summary.json"), JSON.stringify({
      quality: { status: "partial", published: false },
      artifacts: { csvSha256: createHash("sha256").update(content).digest("hex") }
    }));
    const partial = await inspectOperationsInventory(root, status);
    const manain = partial.providers.find((provider) => provider.providerId === "manain");
    assert.equal(manain?.original.state, "parcial");
    assert.equal(manain?.final.state, "ausente");
    assert.equal((await readdir(dir)).length, 2);

    const runId = "lote-tecnico";
    const runDir = join(root, "storage", "runs", runId);
    await mkdir(runDir, { recursive: true });
    const providers = ["gam", "gomariz", "mercaeleva"];
    const startedAt = "2026-10-29T09:00:00.000Z";
    const endedAt = "2026-10-29T09:30:00.000Z";
    await writeFile(join(runDir, "run.json"), JSON.stringify({
      version: 1, runId, status: "complete", startedAt, endedAt,
      requestedProviders: providers,
      providers: providers.map((providerId) => ({
        providerId, status: "complete", startedAt, endedAt,
        outputDir: `storage/scraped/${providerId}`, outputPrefix: `scrape-${providerId}`,
        durationMs: 1800000
      }))
    }));
    const independent = await inspectOperationsInventory(root, status);
    assert.equal(independent.campaigns.length, 0);
    assert.equal(independent.retainedDeliveries, 0);

    await writeFile(csv, content + "manain,ALTERADO\n");
    const altered = await inspectOperationsInventory(root, status);
    assert.equal(altered.providers.find((provider) => provider.providerId === "manain")?.original.state, "error");
    assert.equal((await readFile(csv, "utf8")).endsWith("ALTERADO\n"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

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

test("estado mantiene la preparación acreditada al rotar el nombre original", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-inventory-retention-"));
  try {
    const providerId = "gam";
    const prefix = "scrape-gam-marzo-2026";
    const sourceDir = join(root, "storage", "scraped", providerId);
    const folder = join(root, "storage", "prepared", providerId);
    await mkdir(sourceDir, { recursive: true });
    await mkdir(folder, { recursive: true });
    const original = "original-de-prueba";
    await writeFile(join(sourceDir, `${prefix}-catalog.json`), original);
    const catalogSha256 = createHash("sha256").update(original).digest("hex");
    const writePreparation = async (name: string, preparedAt: string, ready: boolean): Promise<void> => {
      const item = {
        status: ready ? "ready" : "review",
        issues: ready ? [] : ["Pendiente de revisión"],
        product: {
          providerId, sourceUrl: "https://example.org/producto", reference: "GAM-1", title: "Máquina de prueba",
          categorySellID: null, category: null, condition: null, price: null,
          description_title: null, description: null, description_general: null, images: [], attributes: []
        }
      };
      const preparation = JSON.stringify({
        version: 1, quality: "complete", published: true, preparedAt,
        source: { providerId, prefix, scope: "0".repeat(16), catalogSha256, productCount: 1 },
        fingerprints: { rulesVersion: 2, rulesSha256: "a".repeat(64) },
        totals: { ready: ready ? 1 : 0, review: ready ? 0 : 1 },
        identities: ["gam:ref:GAM-1"], products: [item]
      });
      const stem = join(folder, name);
      await writeFile(`${stem}-preparation.json`, preparation);
      await writeFile(`${stem}-preparation.manifest.json`, JSON.stringify({
        version: 1, providerId, catalogSha256,
        preparationSha256: createHash("sha256").update(preparation).digest("hex")
      }));
    };
    await writePreparation(prefix, "2026-10-29T00:00:00.000Z", true);
    await writePreparation(`${prefix}-20261101`, "2026-11-01T00:00:00.000Z", false);
    await writePreparation(`${prefix}-20261102`, "2026-11-02T00:00:00.000Z", false);
    const status = await inspectCampaignOperations(root);
    const before = await inspectOperationsInventory(root, status);
    assert.deepEqual(before.providers.find((entry) => entry.providerId === providerId)?.preparation, {
      state: "correcto", detail: "Preparación acreditada (0 Ready / 1 Review)"
    });
    await rm(join(folder, `${prefix}-preparation.json`));
    await rm(join(folder, `${prefix}-preparation.manifest.json`));
    const after = await inspectOperationsInventory(root, status);
    assert.deepEqual(after.providers.find((entry) => entry.providerId === providerId)?.preparation,
      before.providers.find((entry) => entry.providerId === providerId)?.preparation);
    await writeFile(join(folder, `${prefix}-20261102-preparation.manifest.json`), "{}");
    const altered = await inspectOperationsInventory(root, status);
    assert.equal(altered.providers.find((entry) => entry.providerId === providerId)?.preparation.state, "error");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

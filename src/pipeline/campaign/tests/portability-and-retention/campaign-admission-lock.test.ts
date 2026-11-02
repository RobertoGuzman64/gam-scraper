import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { withCampaignAdmissionLock } from "../../retention/lock.js";

const withRoot = async (action: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-admission-lock-"));
  try { await action(root); }
  finally { await rm(root, { recursive: true, force: true }); }
};

const lockFile = (root: string): string => join(root, "storage", "scraped", "campaigns", ".batch.lock");

const assertReleased = async (root: string): Promise<void> => {
  await assert.rejects(readFile(lockFile(root), "utf8"), { code: "ENOENT" });
};

test("el bloqueo de admisión se conserva durante la acción y se libera al finalizar", async () => {
  await withRoot(async (root) => {
    const result = await withCampaignAdmissionLock(root, async () => {
      const owner: unknown = JSON.parse(await readFile(lockFile(root), "utf8"));
      assert.ok(typeof owner === "object" && owner !== null && "runId" in owner);
      assert.match(String(owner.runId), /^campaign-admission-/);
      return "completado";
    });
    assert.equal(result, "completado");
    await assertReleased(root);
  });
});

test("un error en la acción libera el bloqueo sin esconder el fallo original", async () => {
  await withRoot(async (root) => {
    await assert.rejects(withCampaignAdmissionLock(root, async () => {
      throw new Error("fallo controlado");
    }), /fallo controlado/);
    await assertReleased(root);
    await withCampaignAdmissionLock(root, async () => undefined);
    await assertReleased(root);
  });
});

test("una segunda admisión no puede tomar un bloqueo activo de la primera", async () => {
  await withRoot(async (root) => {
    await withCampaignAdmissionLock(root, async () => {
      const original = await readFile(lockFile(root), "utf8");
      await assert.rejects(withCampaignAdmissionLock(root, async () => undefined), /Ya hay un lote con PID/);
      assert.equal(await readFile(lockFile(root), "utf8"), original);
    });
    await assertReleased(root);
    await withCampaignAdmissionLock(root, async () => undefined);
  });
});

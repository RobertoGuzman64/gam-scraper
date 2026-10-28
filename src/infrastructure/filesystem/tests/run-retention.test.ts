import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { batchRunExcess, cleanBatchExcess } from "../runs/run-retention.js";

const runId = (day: number): string => `2026-10-${String(day).padStart(2, "0")}T10-00-00-000Z-1234abcd`;

test("historial de lotes retiene tres ejecuciones por proveedor y respeta directorios desconocidos", async () => {
  const dir = await mkdtemp(join(tmpdir(), "retencion-lotes-"));
  try {
    const groups = [["gam"], ["gomariz"], ["gam"], ["gam", "gomariz"], ["gam"], ["gam"]];
    for (let day = 1; day <= groups.length; day += 1) {
      const name = runId(day);
      await mkdir(join(dir, name));
      await writeFile(join(dir, name, "run.json"), JSON.stringify({
        version: 1, runId: name, startedAt: "2026-10-01T10:00:00Z",
        endedAt: "2026-10-01T10:10:00Z", status: "complete", requestedProviders: groups[day - 1], providers: []
      }));
    }
    await mkdir(join(dir, "copia-personal"));
    const expected = await batchRunExcess(dir);
    assert.deepEqual(expected.map((entry) => entry.path), [join(dir, runId(3)), join(dir, runId(1))]);
    await cleanBatchExcess(dir, false);
    await assert.rejects(readFile(join(dir, runId(1), "run.json"), "utf8"), { code: "ENOENT" });
    await assert.ok((await readFile(join(dir, runId(2), "run.json"), "utf8")).includes("gomariz"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

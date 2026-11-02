import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { batchRunExcess, cleanBatchExcess } from "../runs/run-retention.js";

const runId = (day: number): string => `2026-10-${String(day).padStart(2, "0")}T10-00-00-000Z-1234abcd`;

test("historial de lotes retiene dos ejecuciones completas por proveedor y respeta directorios desconocidos", async () => {
  const root = await mkdtemp(join(tmpdir(), "retencion-lotes-"));
  const dir = join(root, "storage", "runs");
  await mkdir(dir, { recursive: true });
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
    await rm(root, { recursive: true, force: true });
  }
});


test("elimina excedentes completos y conserva ejecuciones fallidas o parciales", async () => {
  const root = await mkdtemp(join(tmpdir(), "retencion-lotes-estados-"));
  const dir = join(root, "storage", "runs");
  await mkdir(dir, { recursive: true });
  try {
    for (let day = 1; day <= 6; day += 1) {
      const name = runId(day);
      await mkdir(join(dir, name));
      await writeFile(join(dir, name, "run.json"), JSON.stringify({
        version: 1, runId: name, startedAt: "2026-10-01T10:00:00Z",
        endedAt: "2026-10-01T10:10:00Z",
        status: day === 5 ? "failed" : day === 6 ? "partial" : "complete",
        requestedProviders: ["gam"], providers: []
      }));
    }
    const excess = await batchRunExcess(dir);
    assert.deepEqual(excess.map((item) => item.path), [join(dir, runId(2)), join(dir, runId(1))]);
    await cleanBatchExcess(dir, false);
    for (const day of [3, 4, 5, 6]) {
      assert.ok((await readFile(join(dir, runId(day), "run.json"), "utf8")).includes('"runId"'));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test("no elimina ejecuciones completas referenciadas desde acreditaciones externas", async () => {
  const root = await mkdtemp(join(tmpdir(), "retencion-lotes-referencias-"));
  const dir = join(root, "storage", "runs");
  try {
    await mkdir(dir, { recursive: true });
    for (let day = 1; day <= 4; day += 1) {
      const name = runId(day);
      await mkdir(join(dir, name));
      await writeFile(join(dir, name, "run.json"), JSON.stringify({
        version: 1, runId: name, startedAt: "2026-10-01T10:00:00Z",
        endedAt: "2026-10-01T10:10:00Z", status: "complete", requestedProviders: ["gam"], providers: []
      }));
    }
    const evidence = join(root, "storage", "providers", "gam", "editorial");
    await mkdir(evidence, { recursive: true });
    await writeFile(join(evidence, "accreditation.json"), JSON.stringify({ sourceRunId: runId(1) }));
    assert.deepEqual((await batchRunExcess(dir)).map((item) => item.path), [join(dir, runId(2))]);
    assert.deepEqual((await cleanBatchExcess(dir, false)).map((item) => item.path), [join(dir, runId(2))]);
    assert.ok((await readFile(join(dir, runId(1), "run.json"), "utf8")).includes(runId(1)));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("la presencia de referencias ilegibles bloquea las eliminaciones", async () => {
  const root = await mkdtemp(join(tmpdir(), "retencion-lotes-incierto-"));
  const dir = join(root, "storage", "runs");
  try {
    await mkdir(dir, { recursive: true });
    for (let day = 1; day <= 3; day += 1) {
      const name = runId(day);
      await mkdir(join(dir, name));
      await writeFile(join(dir, name, "run.json"), JSON.stringify({
        version: 1, runId: name, endedAt: "2026-10-01T10:10:00Z", status: "complete",
        requestedProviders: ["gam"], providers: []
      }));
    }
    const evidence = join(root, "storage", "providers", "gam");
    await mkdir(evidence, { recursive: true });
    await writeFile(join(evidence, "evidencia.bin"), "formato desconocido");
    assert.deepEqual(await batchRunExcess(dir), []);
    assert.deepEqual(await cleanBatchExcess(dir, false), []);
    assert.ok((await readFile(join(dir, runId(1), "run.json"), "utf8")).includes(runId(1)));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("no considera versiones válidas las ejecuciones sin proveedores o modificadas", async () => {
  const root = await mkdtemp(join(tmpdir(), "retencion-lotes-invalido-"));
  const dir = join(root, "storage", "runs");
  try {
    await mkdir(dir, { recursive: true });
    for (let day = 1; day <= 4; day += 1) {
      const name = runId(day);
      await mkdir(join(dir, name));
      await writeFile(join(dir, name, "run.json"), JSON.stringify({
        version: 1, runId: name, endedAt: "2026-10-01T10:10:00Z", status: "complete",
        requestedProviders: day === 4 ? [] : ["gam"], providers: []
      }));
    }
    assert.deepEqual((await batchRunExcess(dir)).map((item) => item.path), [join(dir, runId(1))]);
    await writeFile(join(dir, runId(1), "run.json"), JSON.stringify({
      version: 1, runId: runId(1), endedAt: "2026-10-01T10:10:00Z", status: "failed",
      requestedProviders: ["gam"], providers: []
    }));
    assert.deepEqual(await batchRunExcess(dir), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("una retención en curso bloquea el segundo borrado sin tocar los conjuntos", async () => {
  const root = await mkdtemp(join(tmpdir(), "retencion-lotes-bloqueo-"));
  const dir = join(root, "storage", "runs");
  try {
    await mkdir(dir, { recursive: true });
    for (let day = 1; day <= 3; day += 1) {
      const name = runId(day);
      await mkdir(join(dir, name));
      await writeFile(join(dir, name, "run.json"), JSON.stringify({
        version: 1, runId: name, endedAt: "2026-10-01T10:10:00Z", status: "complete",
        requestedProviders: ["gam"], providers: []
      }));
    }
    await writeFile(join(dir, ".retention-runs.lock"), "ocupado");
    await assert.rejects(cleanBatchExcess(dir, false), { code: "EEXIST" });
    assert.ok((await readFile(join(dir, runId(1), "run.json"), "utf8")).includes(runId(1)));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

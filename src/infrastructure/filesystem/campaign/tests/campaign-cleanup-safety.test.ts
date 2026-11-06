import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { inspectCleanupArea, persistCampaignDelivery, removeCleanupDirectories, removeDeliveredRunLogs, type CampaignDeliveryReceipt } from "../campaign-cleanup.js";

const withRoot = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "eqz-campaign-cleanup-"));
  try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
};

test("inspección de campaña computa artefactos y no modifica los ficheros", async () => {
  await withRoot(async (root) => {
    const path = join(root, "storage", "campaigns", "campaign1");
    const editorial = join(path, "editorial");
    await mkdir(editorial, { recursive: true });
    const delivery = join(path, "delivery.json");
    const accreditation = join(editorial, `accreditation-${"a".repeat(64)}.json`);
    await writeFile(delivery, "entrega");
    await writeFile(accreditation, "acreditación");
    const inventory = await inspectCleanupArea(root, path, "campaign");
    assert.deepEqual(inventory, { files: 2, bytes: Buffer.byteLength("entrega") + Buffer.byteLength("acreditación"),
      breakdown: [{ kind: "other", files: 2, bytes: Buffer.byteLength("entrega") + Buffer.byteLength("acreditación") }] });
    assert.equal(await readFile(delivery, "utf8"), "entrega");
    assert.equal(await readFile(accreditation, "utf8"), "acreditación");
  });
});

test("rechazo de archivo desconocido y symlink protege rutas externas", async () => {
  await withRoot(async (root) => {
    const path = join(root, "storage", "runs", "run1");
    await mkdir(path, { recursive: true });
    const outside = join(root, "external.txt");
    await writeFile(outside, "privado");
    await writeFile(join(path, "run.json"), "{}");
    await writeFile(join(path, "desconocido.txt"), "no tocar");
    await symlink(outside, join(path, "gam.log"));
    await assert.rejects(inspectCleanupArea(root, path, "run"), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /desconocido\.txt/);
      assert.match(error.message, /gam\.log/);
      return true;
    });
    assert.equal(await readFile(outside, "utf8"), "privado");
  });
});

test("ruta enlazada e inventario inexistente no se confunden", async () => {
  await withRoot(async (root) => {
    const path = join(root, "storage", "runs", "run2");
    await mkdir(path, { recursive: true });
    const linked = join(root, "linked");
    await symlink(path, linked, "dir");
    await assert.rejects(inspectCleanupArea(root, linked, "run"), /Ruta no segura/);
    assert.equal(await inspectCleanupArea(root, join(root, "absent"), "run"), null);
  });
});

test("temporal parcial solo se admite con bandera explícita", async () => {
  await withRoot(async (root) => {
    const path = join(root, "storage", "runs", "run3");
    await mkdir(path, { recursive: true });
    const temporary = join(path, "run.json.00000000-0000-4000-8000-000000000001.tmp");
    await writeFile(temporary, "escritura interrumpida");
    await assert.rejects(inspectCleanupArea(root, path, "run"), /no reconocido/);
    assert.equal((await inspectCleanupArea(root, path, "run", new Map(), true))?.files, 1);
  });
});

test("persistencia de entrega no sobrescribe y retira temporal al fallar", async () => {
  await withRoot(async (root) => {
    const receipt: CampaignDeliveryReceipt = { version: 1, runId: "run4", date: "2026-11-06", zipFile: "campaign.zip",
      zipSha256: "a".repeat(64), selectionSha256: "b".repeat(64) };
    await persistCampaignDelivery(root, receipt);
    const path = join(root, "storage", "campaigns", "run4");
    const original = await readFile(join(path, "delivery.json"), "utf8");
    await assert.rejects(persistCampaignDelivery(root, receipt), { code: "EEXIST" });
    assert.equal(await readFile(join(path, "delivery.json"), "utf8"), original);
    assert.deepEqual(await readdir(path), ["delivery.json"]);
  });
});

test("borrado de logs reconocidos respeta otros archivos y bloquea enlaces", async () => {
  await withRoot(async (root) => {
    const path = join(root, "storage", "runs", "run5");
    await mkdir(path, { recursive: true });
    await writeFile(join(path, "gam.log"), "registro");
    await writeFile(join(path, "notas.txt"), "importante");
    assert.equal(await removeDeliveredRunLogs(root, "run5"), 1);
    assert.equal(await removeDeliveredRunLogs(root, "run5"), 0);
    assert.equal(await readFile(join(path, "notas.txt"), "utf8"), "importante");
    const outside = join(root, "fuera.txt");
    await writeFile(outside, "privado");
    await symlink(outside, join(path, "gam.log"));
    await assert.rejects(removeDeliveredRunLogs(root, "run5"), /Log no regular/);
    assert.equal(await readFile(outside, "utf8"), "privado");
  });
});

test("retirada de carpeta temporal y reinspección conservan semántica actual", async () => {
  await withRoot(async (root) => {
    const path = join(root, "storage", "runs", "run6");
    await mkdir(path, { recursive: true });
    await writeFile(join(path, "run.json"), "{}");
    assert.equal((await inspectCleanupArea(root, path, "run"))?.files, 1);
    await removeCleanupDirectories([path]);
    assert.equal(await inspectCleanupArea(root, path, "run"), null);
    await assert.rejects(removeCleanupDirectories([path]), { code: "ENOENT" });
  });
});

test("historial de extracción válido se inventaría sin borrar el actual ni el anterior", async () => {
  await withRoot(async (root) => {
    const path = join(root, "storage", "scraped", "campaigns", "lote1");
    const gam = join(path, "gam");
    const prefix = "scrape-gam";
    const history = join(gam, ".history", prefix);
    const archive = join(history, "archive-2026-10-01T10-00-00-000Z-00000000-0000-4000-8000-000000000001");
    await mkdir(archive, { recursive: true });
    const csvName = `${prefix}-all.csv`;
    const contents = "categoryKey,categoryName,title,\n";
    await writeFile(join(gam, csvName), contents);
    await writeFile(join(archive, csvName), contents);
    await writeFile(join(archive, "manifest.json"), JSON.stringify({ version: 1, prefix, files: [csvName] }));
    await writeFile(join(history, "active.json"), JSON.stringify({ version: 1, summary: {}, changes: {}, errors: {} }));
    const inventory = await inspectCleanupArea(root, path, "scraped", new Map([["gam", prefix]]));
    assert.equal(inventory?.files, 4);
    assert.deepEqual(inventory?.breakdown.map(({ kind, files }) => [kind, files]).sort(), [["csv", 1], ["history", 3]]);
    assert.equal(await readFile(join(archive, csvName), "utf8"), contents);
    assert.equal(await readFile(join(gam, csvName), "utf8"), contents);
  });
});

test("manifiesto de histórico incompatible y CSV corrupto impiden la inspección", async () => {
  await withRoot(async (root) => {
    const path = join(root, "storage", "scraped", "campaigns", "lote2");
    const gam = join(path, "gam");
    const prefix = "scrape-gam";
    const history = join(gam, ".history", prefix);
    const archive = join(history, "archive-2026-10-01T10-00-00-000Z-00000000-0000-4000-8000-000000000001");
    await mkdir(archive, { recursive: true });
    const csv = join(gam, `${prefix}-all.csv`);
    await writeFile(csv, "cabecera errónea");
    await writeFile(join(archive, "manifest.json"), JSON.stringify({ version: 1, prefix: "otro", files: [] }));
    await assert.rejects(inspectCleanupArea(root, path, "scraped", new Map([["gam", prefix]])), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /CSV de publicación no reconocible/);
      assert.match(error.message, /Manifiesto del histórico inválido/);
      return true;
    });
    assert.equal((await inspectCleanupArea(root, path, "scraped", new Map([["gam", prefix]]), true))?.files, 2);
    assert.equal(await readFile(csv, "utf8"), "cabecera errónea");
  });
});

test("prefijos inválidos y subdirectorios enlazados bloquean la limpieza", async () => {
  await withRoot(async (root) => {
    const path = join(root, "storage", "scraped", "campaigns", "lote3");
    await mkdir(path, { recursive: true });
    await assert.rejects(inspectCleanupArea(root, path, "scraped"), /Los prefijos de extracción no son válidos/);
    await assert.rejects(inspectCleanupArea(root, path, "scraped", new Map([["gam", "../escape"]])), /Los prefijos de extracción no son válidos/);
    const outside = join(root, "externo");
    await mkdir(outside);
    await symlink(outside, join(path, "gam"), "dir");
    await assert.rejects(inspectCleanupArea(root, path, "scraped", new Map([["gam", "scrape-gam"]])), /no reconocido/);
  });
});

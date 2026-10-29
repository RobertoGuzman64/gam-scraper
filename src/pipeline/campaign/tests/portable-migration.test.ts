import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { readPortableOriginal } from "../../../infrastructure/filesystem/catalog/portable-original.js";
import { readPortableCampaign } from "../../../infrastructure/filesystem/catalog/portable-campaign.js";
import { inspectPortableInventory } from "../portable-inventory.js";
import { finalizeActiveCampaign } from "../finalization.js";
import { deliverActiveCampaign } from "../delivery/execute.js";
import { applyPortableMigration, planPortableMigration } from "../portable-migration.js";
import { approveDraft, createFixture } from "./finalization-fixture.js";

const prefix = "scrape-gomariz";
const fixture = resolve("src/testing/fixtures/gomariz");
const originalFiles = [`${prefix}-catalog.json`, `${prefix}-catalog.manifest.json`, `${prefix}-summary.json`] as const;

const withOriginal = async (callback: (root: string, source: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-migration-"));
  const source = join(root, "storage", "scraped", "gomariz");
  await mkdir(source, { recursive: true });
  try {
    for (const file of originalFiles) await copyFile(join(fixture, file), join(source, file));
    await callback(root, source);
  } finally { await rm(root, { recursive: true, force: true }); }
};

test("simulación sin escrituras, migración completa, idempotencia y portabilidad sin storage", async () => {
  await withOriginal(async (root) => {
    const plan = await planPortableMigration(root);
    assert.deepEqual(plan.providers.map((p) => p.status), ["ausente", "consolidar", "ausente", "ausente"]);
    await assert.rejects(readPortableOriginal(root, "gomariz"));
    assert.equal((await readdir(root)).includes("catalogs"), false);
    const applied = await applyPortableMigration(root);
    assert.equal(applied.providers[1]?.status, "actualizado");
    assert.equal((await readPortableOriginal(root, "gomariz")).productCount, 14);
    assert.equal((await applyPortableMigration(root)).providers[1]?.status, "actualizado");
    const moved = join(root, "clean-copy");
    await mkdir(moved);
    await cp(join(root, "catalogs"), join(moved, "catalogs"), { recursive: true });
    assert.equal((await readPortableOriginal(moved, "gomariz")).productCount, 14);
    const inventory = await inspectPortableInventory(moved, {});
    assert.equal(inventory.providers.find((p) => p.providerId === "gomariz")?.original.state, "correcto");
    assert.deepEqual(inventory.issues, []);
  });
});

test("un original dañado detiene la migración antes de escribir cualquier destino", async () => {
  await withOriginal(async (root, source) => {
    await writeFile(join(source, `${prefix}-catalog.manifest.json`), "{}");
    await assert.rejects(applyPortableMigration(root));
    assert.equal((await readdir(root)).includes("catalogs"), false);
  });
});

test("un parcial verificable no se promociona ni se interpreta como completo", async () => {
  await withOriginal(async (root, source) => {
    for (const name of originalFiles) await rm(join(source, name));
    const csv = "url,title\nhttps://example.org/1,prueba\n";
    const partial = join(source, `${prefix}-partial-all.csv`);
    await writeFile(partial, csv);
    await writeFile(join(source, `${prefix}-summary.json`), JSON.stringify({
      quality: { status: "partial", published: false },
      totals: { scrapedProducts: 1 },
      artifacts: { csvSha256: createHash("sha256").update(csv).digest("hex") }
    }));
    const plan = await planPortableMigration(root);
    assert.equal(plan.providers[1]?.status, "parcial");
    await applyPortableMigration(root);
    assert.equal((await readdir(root)).includes("catalogs"), false);
    assert.equal(await readFile(partial, "utf8"), csv);
    await writeFile(partial, "alterado");
    await assert.rejects(planPortableMigration(root), /Parcial no verificable/);
  });
});

test("intentos bloqueados sin productos no invalidan un parcial real de otro prefijo", async () => {
  await withOriginal(async (root, source) => {
    for (const name of originalFiles) await rm(join(source, name));
    const fixtures = [
      { name: "prueba-gomariz", status: "blocked", count: 0 },
      { name: "prueba-gomariz-cdp", status: "blocked", count: 0 },
      { name: prefix, status: "partial", count: 14 }
    ] as const;
    for (const item of fixtures) {
      const csv = `url,title\nhttps://example.org/${item.name},prueba\n`;
      await writeFile(join(source, `${item.name}-partial-all.csv`), csv);
      await writeFile(join(source, `${item.name}-summary.json`), JSON.stringify({
        quality: { status: item.status, published: false },
        totals: { scrapedProducts: item.count },
        artifacts: { csvSha256: createHash("sha256").update(csv).digest("hex") }
      }));
    }
    assert.equal((await planPortableMigration(root)).providers[1]?.status, "parcial");
    await applyPortableMigration(root);
    assert.equal((await readdir(root)).includes("catalogs"), false);
    const prueba = join(source, "prueba-gomariz-partial-all.csv");
    assert.equal((await readFile(prueba, "utf8")).includes("prueba-gomariz"), true);
  });
});

test("dos parciales con productos siguen siendo incompatibles", async () => {
  await withOriginal(async (root, source) => {
    for (const name of originalFiles) await rm(join(source, name));
    for (const name of ["uno", "dos"]) {
      const csv = `url,title\nhttps://example.org/${name},prueba\n`;
      await writeFile(join(source, `${name}-partial-all.csv`), csv);
      await writeFile(join(source, `${name}-summary.json`), JSON.stringify({
        quality: { status: "partial", published: false }, totals: { scrapedProducts: 1 },
        artifacts: { csvSha256: createHash("sha256").update(csv).digest("hex") }
      }));
    }
    await assert.rejects(planPortableMigration(root), /Varios parciales incompatibles/);
    assert.equal((await readdir(root)).includes("catalogs"), false);
  });
});

test("un intento bloqueado con hash incorrecto no se ignora", async () => {
  await withOriginal(async (root, source) => {
    for (const name of originalFiles) await rm(join(source, name));
    const file = "prueba-gomariz";
    await writeFile(join(source, `${file}-partial-all.csv`), "contenido");
    await writeFile(join(source, `${file}-summary.json`), JSON.stringify({
      quality: { status: "blocked", published: false }, totals: { scrapedProducts: 0 },
      artifacts: { csvSha256: "no-coincide" }
    }));
    await assert.rejects(planPortableMigration(root), /Parcial no verificable/);
    assert.equal((await readdir(root)).includes("catalogs"), false);
  });
});

test("un almacén portátil corrupto o con entradas extrañas bloquea sin sobrescribir", async () => {
  await withOriginal(async (root) => {
    await applyPortableMigration(root);
    const catalog = join(root, "catalogs", "providers", "gomariz", "original", originalFiles[0]);
    await writeFile(catalog, "{}");
    await assert.rejects(applyPortableMigration(root));
    assert.equal(await readFile(catalog, "utf8"), "{}");
  });
});

test("campaña ya entregada se puede importar sin nueva aprobación ni nuevos JSON de prueba", async () => {
  const data = await createFixture();
  try {
    const draft = await finalizeActiveCampaign(data.root, false, data.runId);
    await approveDraft(draft.draftFile);
    const desktop = join(data.root, "Escritorio");
    await mkdir(desktop);
    const delivery = await deliverActiveCampaign(data.root, desktop, new Date(2026, 9, 26, 12));
    assert.equal(delivery.runId, data.runId);
    // Reproduce el estado legado: entrega y recibo válidos, pero falta la copia portátil.
    await rm(join(data.root, "catalogs", "campaigns", data.runId), { recursive: true });
    const before = await readFile(draft.draftFile, "utf8");
    const plan = await planPortableMigration(data.root);
    assert.equal(plan.campaigns.find((p) => p.runId === data.runId)?.status, "consolidar");
    const applied = await applyPortableMigration(data.root);
    assert.equal(applied.campaigns.find((p) => p.runId === data.runId)?.status, "actualizado");
    assert.equal(await readFile(draft.draftFile, "utf8"), before);
    assert.equal((await readPortableCampaign(data.root, data.runId)).runId, data.runId);
    const clean = join(data.root, "portable-only");
    await mkdir(clean);
    await cp(join(data.root, "catalogs"), join(clean, "catalogs"), { recursive: true });
    assert.equal((await readPortableCampaign(clean, data.runId)).runId, data.runId);
    assert.equal((await inspectPortableInventory(clean, {})).accreditedCampaigns, 1);
  } finally { await data.cleanup(); }
});

test("una campaña sin entrega no se transforma en campaña acreditada por la migración", async () => {
  const data = await createFixture();
  try {
    const draft = await finalizeActiveCampaign(data.root, false, data.runId);
    await approveDraft(draft.draftFile);
    const plan = await planPortableMigration(data.root);
    assert.equal(plan.campaigns.length, 0); // Aprobar un borrador no equivale a entregar el lote.
    await applyPortableMigration(data.root);
    // Nunca genera un justificante de entrega inexistente.
    await assert.rejects(readFile(join(data.root, "storage", "campaigns", data.runId, "delivery.json")));
  } finally { await data.cleanup(); }
});

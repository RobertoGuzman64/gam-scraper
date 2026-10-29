import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { consolidatePortableOriginal } from "../../../infrastructure/filesystem/catalog/portable-original.js";
import { readCanonicalCatalog, writeCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { inspectPortableInventory } from "../portable-inventory.js";
import { createFixture, approveDraft } from "./finalization-fixture.js";
import { finalizeActiveCampaign } from "../finalization.js";

const prefix = "scrape-gomariz";
const fixture = resolve("src/testing/fixtures/gomariz");
const pathFor = (root: string): string => join(root, "storage", "scraped", "gomariz", `${prefix}-catalog.json`);
const files = [`${prefix}-catalog.json`, `${prefix}-catalog.manifest.json`, `${prefix}-summary.json`] as const;
const portable = (root: string): string => join(root, "catalogs", "providers", "gomariz", "original");
const input = (root: string): Readonly<Record<string, string>> => ({ gomariz: pathFor(root) });

const withOriginal = async (callback: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-inventory-portable-"));
  try {
    const dir = join(root, "storage", "scraped", "gomariz");
    await mkdir(dir, { recursive: true });
    for (const file of files) await copyFile(join(fixture, file), join(dir, file));
    await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

const updateSource = async (root: string): Promise<void> => {
  const original = await readCanonicalCatalog(pathFor(root));
  const endedAt = "2026-10-27T13:20:00.000Z";
  const sha = await writeCanonicalCatalog(join(root, "storage", "scraped", "gomariz"), prefix,
    original.scope, original.startedAt, endedAt,
    original.products.map((product, index) => index ? product : { ...product, title: "Título actualizado" }));
  await writeFile(join(root, "storage", "scraped", "gomariz", `${prefix}-summary.json`), JSON.stringify({
    startedAt: original.startedAt, endedAt, quality: { status: "complete", published: true },
    totals: { scrapedProducts: original.productCount }, artifacts: { catalogSha256: sha }
  }));
};

test("sin catalogs ni storage inventaría ausencias sin crear directorios", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-inventory-empty-"));
  try {
    const result = await inspectPortableInventory(root, input(root));
    assert.equal(result.accreditedCampaigns, 0);
    assert.equal(result.providers.length, 4);
    assert.ok(result.providers.every((provider) => provider.original.state === "ausente" &&
      provider.final.state === "ausente"));
    assert.deepEqual(await readdir(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("original local pendiente, sincronizado y portátil autónomo sin storage", async () => {
  await withOriginal(async (root) => {
    const pending = await inspectPortableInventory(root, input(root));
    assert.match(pending.providers.find((provider) => provider.providerId === "gomariz")?.consistency.detail ?? "", /pendiente/);
    await consolidatePortableOriginal(root, pathFor(root));
    const synced = await inspectPortableInventory(root, input(root));
    assert.equal(synced.providers.find((provider) => provider.providerId === "gomariz")?.consistency.state, "correcto");
    assert.equal(synced.providers.find((provider) => provider.providerId === "gomariz")?.original.state, "correcto");
    await rm(join(root, "storage"), { recursive: true });
    const moved = `${root}-moved`;
    await rename(root, moved);
    try {
      const clean = await inspectPortableInventory(moved, input(moved));
      assert.equal(clean.providers.find((provider) => provider.providerId === "gomariz")?.consistency.state, "correcto");
      assert.equal(clean.providers.find((provider) => provider.providerId === "gomariz")?.original.state, "correcto");
    } finally { await rename(moved, root); }
  });
});

test("diferencia entre original local reciente y portable queda señalada, sin escrituras", async () => {
  await withOriginal(async (root) => {
    await consolidatePortableOriginal(root, pathFor(root));
    const before = await readFile(join(portable(root), `${prefix}-catalog.json`), "utf8");
    await updateSource(root);
    const result = await inspectPortableInventory(root, input(root));
    const entry = result.providers.find((provider) => provider.providerId === "gomariz");
    assert.equal(entry?.original.state, "correcto");
    assert.equal(entry?.consistency.state, "parcial");
    assert.match(entry?.consistency.detail ?? "", /pendiente de consolidación/);
    assert.equal(await readFile(join(portable(root), `${prefix}-catalog.json`), "utf8"), before);
  });
});

test("manifiesto alterado, recuperación pendiente y residuos inesperados se señalan", async () => {
  await withOriginal(async (root) => {
    await consolidatePortableOriginal(root, pathFor(root));
    const manifest = join(portable(root), `${prefix}-catalog.manifest.json`);
    const before = await readFile(manifest, "utf8");
    await writeFile(manifest, "{}");
    let inspected = await inspectPortableInventory(root, input(root));
    assert.equal(inspected.providers.find((provider) => provider.providerId === "gomariz")?.original.state, "error");
    await writeFile(manifest, before);
    await mkdir(join(root, "catalogs", "providers", "gomariz", ".original-rollback"));
    inspected = await inspectPortableInventory(root, input(root));
    assert.equal(inspected.providers.find((provider) => provider.providerId === "gomariz")?.original.state, "error");
    await rm(join(root, "catalogs", "providers", "gomariz", ".original-rollback"), { recursive: true });
    await writeFile(join(root, "catalogs", "providers", "unexpected.tmp"), "test");
    inspected = await inspectPortableInventory(root, input(root));
    assert.ok(inspected.issues.some((issue) => issue.includes("unexpected.tmp")));
  });
});

test("campaña aprobada es verificable sin storage; adulteración señala error en JSON final", async () => {
  const data = await createFixture();
  try {
    const draft = await finalizeActiveCampaign(data.root, false);
    await approveDraft(draft.draftFile);
    assert.equal((await finalizeActiveCampaign(data.root, false)).status, "selected");
    const before = await inspectPortableInventory(data.root, input(data.root));
    assert.equal(before.accreditedCampaigns, 1);
    assert.ok(before.providers.every((provider) => provider.final.state === "correcto"));
    assert.ok(before.providers.every((provider) => provider.original.state === "correcto"));
    assert.match(before.providers.find((provider) => provider.providerId === "gam")?.final.detail ?? "", /fichas/);
    await rm(join(data.root, "storage"), { recursive: true });
    const clean = await inspectPortableInventory(data.root, input(data.root));
    assert.equal(clean.accreditedCampaigns, 1);
    const file = join(data.root, "catalogs", "campaigns", data.runId, "gam", "publishable.json");
    await writeFile(file, `${await readFile(file, "utf8")} `);
    const damaged = await inspectPortableInventory(data.root, input(data.root));
    assert.equal(damaged.accreditedCampaigns, 0);
    assert.equal(damaged.campaigns[0]?.status.state, "error");
    assert.ok(damaged.providers.every((provider) => provider.final.state === "error"));
  } finally { await data.cleanup(); }
});


test("se detecta exceso de campañas sin borrar ni interpretar carpetas desconocidas", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-inventory-overflow-"));
  try {
    for (const name of ["run-1", "run-2", "run-3"]) {
      await mkdir(join(root, "catalogs", "campaigns", name), { recursive: true });
    }
    const result = await inspectPortableInventory(root, input(root));
    assert.equal(result.campaigns.length, 3);
    assert.ok(result.issues.some((issue) => issue.includes("Retención")));
    assert.ok(result.providers.every((provider) => provider.final.state === "error"));
    assert.deepEqual((await readdir(join(root, "catalogs", "campaigns"))).sort(), ["run-1", "run-2", "run-3"]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

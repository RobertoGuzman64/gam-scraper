import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { consolidatePortableOriginal } from "../../../infrastructure/filesystem/catalog/portable-original.js";
import { readCanonicalCatalog, writeCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { inspectPortableInventory } from "../../portable-inventory.js";
import { retainRepositoryArtifact } from "../../../infrastructure/filesystem/catalog/repository-artifact-snapshot.js";
import { createFixture, approveDraft } from "../finalization-fixture.js";
import { finalizeActiveCampaign } from "../../finalization.js";
import { copyCampaignTestCatalog } from "../campaign-catalog-fixture.js";

const prefix = "scrape-gomariz";
const pathFor = (root: string): string => join(root, "storage", "scraped", "gomariz", `${prefix}-catalog.json`);
const portable = (root: string): string => join(root, "catalogs", "providers", "gomariz", "original");
const input = (root: string): Readonly<Record<string, string>> => ({ gomariz: pathFor(root) });

const withOriginal = async (callback: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-inventory-portable-"));
  try {
    const dir = join(root, "storage", "scraped", "gomariz");
    await mkdir(dir, { recursive: true });
    await copyCampaignTestCatalog(dir, "gomariz", prefix);
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

test("admite informes en catalogs/reports sin admitir entradas desconocidas en la raíz", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-inventory-reports-"));
  try {
    const directory = join(root, "catalogs", "reports", "revision");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "categorias-sin-asignar.csv"), "referencia,categoria\n");
    for (const name of ["editorial-coverage", "editorial-knowledge"]) {
      const report = join(root, "catalogs", "reports", name);
      await mkdir(report);
      await writeFile(join(report, "audit.json"), "{}");
    }
    const valid = await inspectPortableInventory(root, input(root));
    assert.deepEqual(valid.issues, []);
    await writeFile(join(root, "catalogs", "reports", "desconocido.txt"), "entrada no acreditada");
    await writeFile(join(root, "catalogs", "desconocido.txt"), "entrada no acreditada");
    const invalid = await inspectPortableInventory(root, input(root));
    assert.equal(invalid.issues.filter((issue) => issue.includes("desconocido.txt")).length, 2);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("reconoce informes y entregas comerciales retenidas y denuncia alteraciones", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-inventory-artifacts-"));
  try {
    const directory = join(root, "catalogs", "reports", "individual-finish");
    await retainRepositoryArtifact(directory, "INFORME.txt", [{ name: "INFORME.txt", content: "resultado real" }]);
    const valid = await inspectPortableInventory(root, input(root));
    assert.deepEqual(valid.issues, []);
    const current = JSON.parse(await readFile(join(directory, "active.json"), "utf8")) as { sha256: string };
    await writeFile(join(directory, "versions", current.sha256, "INFORME.txt"), "alteración");
    const invalid = await inspectPortableInventory(root, input(root));
    assert.ok(invalid.issues.some((issue) => issue.includes("Huella del artefacto no coincide")));
  } finally { await rm(root, { recursive: true, force: true }); }
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


test("registro parcial Manain se distingue de un original inválido sin promocionarlo", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-inventory-manain-record-"));
  try {
    const directory = join(root, "catalogs", "providers", "manain", "records");
    await mkdir(directory, { recursive: true });
    const record = JSON.stringify({ providerId: "manain", quality: { status: "partial", published: false }, products: [] });
    await writeFile(join(directory, "manain-record.json"), record);
    const entry = (await inspectPortableInventory(root, input(root))).providers.find((provider) => provider.providerId === "manain");
    assert.equal(entry?.original.state, "parcial");
    assert.equal(entry?.consistency.state, "parcial");
    assert.equal(entry?.final.state, "ausente");
    assert.equal(await readFile(join(directory, "manain-record.json"), "utf8"), record);
    await writeFile(join(directory, "manain-record.json"), "{}");
    const invalid = (await inspectPortableInventory(root, input(root))).providers.find((provider) => provider.providerId === "manain");
    assert.equal(invalid?.original.state, "error");
    assert.equal(invalid?.consistency.state, "error");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("Manain publicado conserva el registro parcial y admite su índice de retención acreditado", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-inventory-manain-retention-"));
  try {
    const base = join(root, "catalogs", "providers", "manain");
    const records = join(base, "records");
    const publications = join(base, "publications");
    const sha = "a".repeat(64);
    const active = { version: 1, providerId: "manain", approvalSha256: sha };
    const retention = { ...active, previousSha256: null };
    await mkdir(records, { recursive: true });
    await mkdir(publications, { recursive: true });
    await writeFile(join(records, "manain-record.json"), JSON.stringify({
      providerId: "manain", quality: { status: "partial", published: false }, products: []
    }));
    await writeFile(join(publications, "active.json"), JSON.stringify(active));
    const retentionPath = join(base, "publication-retention.json");
    await writeFile(retentionPath, JSON.stringify(retention));

    const entry = (await inspectPortableInventory(root, input(root))).providers.find((provider) => provider.providerId === "manain");
    assert.equal(entry?.original.state, "parcial");
    assert.equal(entry?.consistency.state, "parcial");
    assert.match(entry?.original.detail ?? "", /Registro parcial de Manain conservado/);

    await writeFile(retentionPath, JSON.stringify({ ...retention, providerId: "gam" }));
    const foreign = (await inspectPortableInventory(root, input(root))).providers.find((provider) => provider.providerId === "manain");
    assert.equal(foreign?.original.state, "error");
    assert.match(foreign?.original.detail ?? "", /retención individual no acreditado/);

    await writeFile(retentionPath, JSON.stringify({ ...retention, approvalSha256: "b".repeat(64) }));
    const mismatched = (await inspectPortableInventory(root, input(root))).providers.find((provider) => provider.providerId === "manain");
    assert.equal(mismatched?.original.state, "error");
    assert.match(mismatched?.original.detail ?? "", /retención individual no acreditado/);

    await writeFile(retentionPath, JSON.stringify(retention));
    await writeFile(join(base, "unexpected.tmp"), "entrada no acreditada");
    const unexpected = (await inspectPortableInventory(root, input(root))).providers.find((provider) => provider.providerId === "manain");
    assert.equal(unexpected?.original.state, "error");
    assert.match(unexpected?.original.detail ?? "", /Archivos inesperados/);
    await rm(join(base, "unexpected.tmp"));

    await rm(retentionPath);
    await mkdir(retentionPath);
    const nonRegular = (await inspectPortableInventory(root, input(root))).providers.find((provider) => provider.providerId === "manain");
    assert.equal(nonRegular?.original.state, "error");
    assert.match(nonRegular?.original.detail ?? "", /retención individual no regular/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("otros proveedores no admiten registros Manain ni entradas desconocidas", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-inventory-foreign-record-"));
  try {
    const directory = join(root, "catalogs", "providers", "gam", "records");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "manain-record.json"), JSON.stringify({ providerId: "manain", quality: { status: "partial", published: false }, products: [] }));
    const entry = (await inspectPortableInventory(root, input(root))).providers.find((provider) => provider.providerId === "gam");
    assert.equal(entry?.original.state, "error");
    assert.equal(entry?.consistency.state, "error");
  } finally { await rm(root, { recursive: true, force: true }); }
});

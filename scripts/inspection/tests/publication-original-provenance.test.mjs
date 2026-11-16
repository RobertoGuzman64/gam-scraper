import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("../publication-original-provenance.mjs", import.meta.url));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const run = (root, candidate = null) => spawnSync(process.execPath,
  [script, "--root", root, "--json", ...(candidate === null ? [] : ["--candidate", candidate])], { encoding: "utf8" });

const isolated = async (action) => {
  const root = await mkdtemp(join(tmpdir(), "eqz-operativa-origen-"));
  try { await action(root); }
  finally { await rm(root, { recursive: true, force: true }); }
};

const makeSource = async (root, providerId, prefix, { archived = false, alias = false } = {}) => {
  const scope = "abcdef0123456789";
  const startedAt = "2026-10-29T08:00:00.000Z";
  const endedAt = "2026-10-29T09:00:00.000Z";
  const catalog = { version: 1, providerId, prefix, scope, startedAt, endedAt,
    quality: { status: "complete", published: true }, productCount: 1,
    products: [{ providerId, reference: "123" }] };
  const raw = JSON.stringify(catalog);
  const catalogSha256 = hash(raw);
  const metadata = { version: 1, providerId, prefix, scope, startedAt, endedAt,
    productCount: 1, catalogSha256 };
  const summary = { startedAt, endedAt, quality: { status: "complete", published: true },
    totals: { scrapedProducts: 1 }, artifacts: { catalogSha256 } };
  const filePrefix = alias ? `scrape-${providerId}` : prefix;
  const directory = archived
    ? join(root, "storage", "scraped", providerId, ".history", prefix,
      "archive-2026-10-29T12-00-00-000Z-11111111-1111-4111-8111-111111111111")
    : join(root, "catalogs", "providers", providerId, "original");
  await mkdir(directory, { recursive: true });
  for (const [suffix, value] of Object.entries({
    "-catalog.json": raw,
    "-catalog.manifest.json": JSON.stringify(metadata),
    "-summary.json": JSON.stringify(summary)
  })) await writeFile(join(directory, `${filePrefix}${suffix}`), value);
  return { directory, prefix: filePrefix, metadata };
};

const publish = async (root, providerId, source) => {
  const approvalSha256 = "a".repeat(64);
  const location = join(root, "catalogs", "providers", providerId, "publications");
  await mkdir(join(location, approvalSha256.slice(0, 12)), { recursive: true });
  await writeFile(join(location, "active.json"), JSON.stringify({ version: 1, providerId, approvalSha256 }));
  await writeFile(join(location, approvalSha256.slice(0, 12), "manifest.json"),
    JSON.stringify({ version: 1, providerId, approvalSha256,
      source: { providerId, prefix: source.prefix, scope: source.scope,
        productCount: source.productCount, catalogSha256: source.catalogSha256 } }));
};

test("original vigente íntegro y alias portátil reconocidos sin escribir", async () => {
  await isolated(async (root) => {
    const { metadata } = await makeSource(root, "gam", "scrape-gam-historico", { alias: true });
    await publish(root, "gam", metadata);
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.sources[0].diagnosis, "ORIGINAL_DISPONIBLE");
    assert.equal(report.sources[0].current.state, "COINCIDE");
    assert.equal(report.sources[0].current.sha256, metadata.catalogSha256);
  });
});

test("histórico ausente no se sustituye por el inventario vigente ni por candidato externo", async () => {
  await isolated(async (root) => {
    const { metadata } = await makeSource(root, "gomariz", "scrape-gomariz");
    await publish(root, "gomariz", { ...metadata, catalogSha256: "b".repeat(64), productCount: 143 });
    const external = join(root, "candidato", "scrape-gomariz-catalog.json");
    await mkdir(dirname(external), { recursive: true });
    await writeFile(external, await readFile(join(root, "catalogs", "providers", "gomariz", "original", "scrape-gomariz-catalog.json")));
    const result = run(root, external);
    assert.equal(result.status, 2);
    const report = JSON.parse(result.stdout);
    assert.equal(report.sources[0].current.state, "OTRO_CORTE");
    assert.equal(report.sources[0].candidate.state, "INVALIDO");
    assert.equal(report.sources[0].diagnosis, "HISTORICO_NO_DISPONIBLE");
    assert.equal(report.sources[0].archives.entries.length, 0);
  });
});

test("candidato íntegro es solo evidencia y nunca se incorpora al histórico", async () => {
  await isolated(async (root) => {
    const source = await makeSource(root, "gomariz", "scrape-gomariz");
    await publish(root, "gomariz", source.metadata);
    const externalRoot = await mkdtemp(join(tmpdir(), "eqz-operativa-candidato-"));
    try {
      const { metadata } = await makeSource(externalRoot, "gomariz", "scrape-gomariz");
      const candidate = join(externalRoot, "catalogs", "providers", "gomariz", "original", "scrape-gomariz-catalog.json");
      const original = join(root, "catalogs", "providers", "gomariz", "original", "scrape-gomariz-catalog.json");
      await rm(original);
      const result = run(root, candidate);
      assert.equal(result.status, 2);
      const report = JSON.parse(result.stdout);
      assert.equal(report.sources[0].candidate.state, "COINCIDE");
      assert.equal(report.sources[0].diagnosis, "HISTORICO_NO_DISPONIBLE");
      assert.equal(report.sources[0].expected.catalogSha256, metadata.catalogSha256);
      assert.equal(report.sources[0].archives.entries.length, 0);
    } finally { await rm(externalRoot, { recursive: true, force: true }); }
  });
});

test("histórico íntegro permite comparar sin original vigente", async () => {
  await isolated(async (root) => {
    const historical = await makeSource(root, "gomariz", "scrape-gomariz", { archived: true });
    await publish(root, "gomariz", historical.metadata);
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    const row = JSON.parse(result.stdout).sources[0];
    assert.equal(row.current.state, "AUSENTE");
    assert.equal(row.archives.entries[0].state, "COINCIDE");
    assert.equal(row.diagnosis, "ORIGINAL_DISPONIBLE");
  });
});

test("histórico alterado o manifiesto incompatible es INVALIDO, no ausencia silenciosa", async () => {
  await isolated(async (root) => {
    const historical = await makeSource(root, "gomariz", "scrape-gomariz", { archived: true });
    await publish(root, "gomariz", historical.metadata);
    const original = join(historical.directory, `${historical.prefix}-catalog.json`);
    const clean = await readFile(original, "utf8");
    await writeFile(original, clean + " ");
    const corrupt = run(root);
    assert.equal(corrupt.status, 1);
    assert.equal(JSON.parse(corrupt.stdout).sources[0].archives.entries[0].state, "INVALIDO");
    await writeFile(original, clean);
    const manifest = join(historical.directory, `${historical.prefix}-catalog.manifest.json`);
    await writeFile(manifest, JSON.stringify({ ...historical.metadata, catalogSha256: "c".repeat(64) }));
    const invalidManifest = run(root);
    assert.equal(invalidManifest.status, 1);
    assert.equal(JSON.parse(invalidManifest.stdout).sources[0].archives.entries[0].state, "INVALIDO");
  });
});

test("una fuente histórica ausente no impide evaluar otras publicaciones", async () => {
  await isolated(async (root) => {
    const gam = await makeSource(root, "gam", "scrape-gam-historico", { alias: true });
    await publish(root, "gam", gam.metadata);
    const gomariz = await makeSource(root, "gomariz", "scrape-gomariz");
    await publish(root, "gomariz", { ...gomariz.metadata, catalogSha256: "f".repeat(64) });
    const result = run(root);
    assert.equal(result.status, 2);
    const report = JSON.parse(result.stdout);
    assert.equal(report.sources.length, 2);
    assert.equal(report.sources.find((item) => item.providerId === "gam")?.available, true);
    assert.equal(report.sources.find((item) => item.providerId === "gomariz")?.available, false);
  });
});


test("un manifiesto antiguo sin prefix usa el prefijo del canónico portátil verificado", async () => {
  await isolated(async (root) => {
    const original = await makeSource(root, "gam", "scrape-gam-historico", { alias: true });
    const { prefix: discardedPrefix, ...source } = original.metadata;
    assert.equal(discardedPrefix, "scrape-gam-historico");
    await publish(root, "gam", source);
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    const item = JSON.parse(result.stdout).sources[0];
    assert.equal(item.current.state, "COINCIDE");
    assert.equal(item.expected.prefix, discardedPrefix);
  });
});

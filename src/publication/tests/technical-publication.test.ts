import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { consolidatePortableOriginal } from "../../infrastructure/filesystem/catalog/portable-original.js";
import { readActiveTechnicalPublication, activateTechnicalPublication, readTechnicalVersion, listTechnicalVersions } from "../../infrastructure/filesystem/catalog/technical-publication.js";
import { publishTechnicalSnapshot, compareWithTechnicalVersion } from "../technical-publication.js";
import { parseTechnicalSnapshot } from "../technical-snapshot.js";
import { prepareImportBatch } from "../../preparation/prepare.js";
import { loadPreparationInputs } from "../../infrastructure/filesystem/preparation/preparation-inputs.js";
import { offlinePreparationManifest } from "../../infrastructure/filesystem/preparation/offline-preparation.js";
import { readCanonicalCatalog } from "../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { buildProductIdentity } from "../../catalog/identity.js";
import type { OfflinePreparation } from "../../preparation/offline-document.js";
import { buildManainRecord } from "../../preparation/workflow/manain-record.js";
import { discardedManainProductUrls } from "../../preparation/manain/identity/evidence/discarded-urls.js";
import { baseProductHeaders } from "../../scraping/output/csv-serializer.js";
import { toCsv } from "../../shared/csv.js";
import { inspectPortableInventory } from "../../campaign/portable-inventory.js";
import { readContentGapOptions } from "../../cli/commands/catalog/catalog-content-gaps-options.js";
import { runTechnicalPublication } from "../../cli/commands/catalog/technical-publication.js";

const hash = (text: string): string => createHash("sha256").update(text).digest("hex");
const originals = ["scrape-gomariz-catalog.json", "scrape-gomariz-catalog.manifest.json", "scrape-gomariz-summary.json"] as const;
const fixture = join(process.cwd(), "src", "testing", "fixtures", "gomariz");
const technicalPath = (root: string, provider: string): string =>
  join(root, "catalogs", "providers", provider, "technical");

const workspace = async (): Promise<{ root: string; preparation: string }> => {
  const root = await mkdtemp(join(tmpdir(), "eqz-technical-"));
  const source = join(root, "source");
  await mkdir(source);
  for (const name of originals) await copyFile(join(fixture, name), join(source, name));
  await consolidatePortableOriginal(root, join(source, originals[0]));
  const originalFile = join(root, "catalogs", "providers", "gomariz", "original", originals[0]);
  const canonical = await readCanonicalCatalog(originalFile);
  const catalogSha256 = hash(await readFile(originalFile, "utf8"));
  const { fingerprints } = await loadPreparationInputs();
  const prepared = prepareImportBatch(canonical.products);
  const report: OfflinePreparation = {
    version: 1, quality: "complete", published: true, preparedAt: new Date().toISOString(),
    source: {
      providerId: "gomariz", prefix: canonical.prefix, scope: canonical.scope,
      catalogSha256, productCount: canonical.products.length
    },
    fingerprints, totals: prepared.totals,
    identities: canonical.products.map((item) => buildProductIdentity(item).key),
    products: prepared.products
  };
  const folder = join(root, "preparations");
  await mkdir(folder);
  const preparation = join(folder, "scrape-gomariz-test-preparation.json");
  const raw = `${JSON.stringify(report, null, 2)}\n`;
  await writeFile(preparation, raw);
  await writeFile(preparation.replace(/-preparation\.json$/, "-preparation.manifest.json"), offlinePreparationManifest(raw, report));
  return { root, preparation };
};

test("publicación técnica completa conserva revisión, permite simulación, idempotencia y no toca la vía comercial", async () => {
  const { root, preparation } = await workspace();
  try {
    const commercialRoot = join(root, "catalogs", "providers", "gomariz", "publications");
    await mkdir(commercialRoot);
    const commercialFile = join(commercialRoot, "evidence.txt");
    await writeFile(commercialFile, "publicación comercial inmutable\n");
    const before = await readFile(commercialFile);
    const simulation = await publishTechnicalSnapshot(root, "gomariz", { preparation }, false);
    assert.equal(simulation.status, "simulated");
    assert.equal(simulation.snapshot.products.length, 14);
    assert.equal(simulation.snapshot.quality, "complete");
    assert.equal(simulation.snapshot.totals.ready + simulation.snapshot.totals.review, 14);
    await assert.rejects(lstat(technicalPath(root, "gomariz")), { code: "ENOENT" });
    const activated = await publishTechnicalSnapshot(root, "gomariz", { preparation }, true);
    assert.equal(activated.status, "activated");
    assert.equal(activated.sha256, simulation.sha256);
    const current = await readActiveTechnicalPublication(root, "gomariz");
    assert.equal(current?.sha256, simulation.sha256);
    assert.deepEqual(current?.snapshot.products, simulation.snapshot.products);
    assert.deepEqual(await listTechnicalVersions(root, "gomariz"), [simulation.sha256]);
    const pointer = join(technicalPath(root, "gomariz"), "active.json");
    const stat = await lstat(pointer);
    assert.equal((await publishTechnicalSnapshot(root, "gomariz", { preparation }, true)).status, "unchanged");
    assert.equal((await lstat(pointer)).mtimeMs, stat.mtimeMs);
    assert.deepEqual(await readFile(commercialFile), before);
    assert.equal((await readdir(commercialRoot)).length, 1);
    const inventory = await inspectPortableInventory(root, {});
    assert.equal(inventory.providers.find((provider) => provider.providerId === "gomariz")?.original.state, "correcto");
    assert.deepEqual(inventory.issues, []);
    const versionPath = join(technicalPath(root, "gomariz"), "versions", simulation.sha256, "snapshot.json");
    await writeFile(versionPath, `${await readFile(versionPath, "utf8")} `);
    await assert.rejects(readTechnicalVersion(root, "gomariz", simulation.sha256), /alterado/);
    await assert.rejects(readActiveTechnicalPublication(root, "gomariz"), /alterado/);
    assert.deepEqual(await readFile(commercialFile), before);
  } finally { await rm(root, { force: true, recursive: true }); }
});

test("cortes técnicos comparan cambios y pérdidas sin bloquear la activación ni aprobarlos comercialmente", async () => {
  const { root, preparation } = await workspace();
  try {
    const candidate = (await publishTechnicalSnapshot(root, "gomariz", { preparation }, false)).snapshot;
    const first = await activateTechnicalPublication(root, candidate);
    const selected = candidate.products.findIndex((item) => item.status === "ready");
    assert.ok(selected >= 0);
    const changed = candidate.products.map((item, index) => index === selected
      ? { ...item, status: "review" as const, issues: ["Revisión de ejemplo"] }
      : item);
    const replacement = parseTechnicalSnapshot({ ...candidate,
      totals: { ready: candidate.totals.ready - 1, review: candidate.totals.review + 1 },
      products: changed
    }, "gomariz");
    const second = await activateTechnicalPublication(root, replacement);
    assert.notEqual(first.sha256, second.sha256);
    await assert.rejects(activateTechnicalPublication(root, candidate, null), /cambió desde la simulación/);
    assert.equal((await readActiveTechnicalPublication(root, "gomariz"))?.sha256, second.sha256);
    const difference = await compareWithTechnicalVersion(root, "gomariz", first.sha256);
    assert.equal(difference.changedStatus.length, 1);
    assert.equal(difference.changedIssues.length, 1);
    assert.deepEqual(difference.removed, []);
    assert.deepEqual((await readTechnicalVersion(root, "gomariz", first.sha256)).snapshot, candidate);
  } finally { await rm(root, { force: true, recursive: true }); }
});

test("fuente obsoleta, suplantación de proveedor y enlace simbólico bloquean sin activar", async () => {
  const { root, preparation } = await workspace();
  try {
    const candidate = (await publishTechnicalSnapshot(root, "gomariz", { preparation }, false)).snapshot;
    assert.throws(() => parseTechnicalSnapshot({ ...candidate, providerId: "gam" }, "gam"), /inválid|identidad|discordant/i);
    assert.throws(() => parseTechnicalSnapshot({ ...candidate, identities: candidate.identities.map(() => "gomariz:ref:duplicada") }, "gomariz"), /Identidades/);
    await writeFile(preparation, "{}");
    await assert.rejects(publishTechnicalSnapshot(root, "gomariz", { preparation }, true));
    await assert.rejects(lstat(technicalPath(root, "gomariz")), { code: "ENOENT" });
    await symlink(join(root, "source"), technicalPath(root, "gomariz"), "dir");
    await assert.rejects(readActiveTechnicalPublication(root, "gomariz"), /no regular/);
  } finally { await rm(root, { force: true, recursive: true }); }
});

test("Manain solo admite registro parcial conciliado con CSV, errores y censo", async () => {
  const root = await mkdtemp(join(tmpdir(), "eqz-technical-manain-"));
  try {
    const records = join(root, "catalogs", "providers", "manain", "records");
    const evidence = join(root, "scraped");
    await mkdir(records, { recursive: true });
    await mkdir(evidence);
    const url = "https://manain.com/producto/plataforma-elevadora-de-ocasion/";
    const csv = toCsv([{
      providerId: "manain", categoryKey: "venta", categoryName: "Maquinaria en venta", url,
      reference: "MA-PRUEBA", title: "Plataforma", condition: "Segunda mano",
      specJson: JSON.stringify({ Peso: "2100 kg" }), imagesJson: "[]", breadcrumbsJson: "[]"
    }], baseProductHeaders);
    const census = {
      type: "manain-diagnostic-census", providerId: "manain", complete: true, published: false,
      endReason: "control-exhausted", urlCount: 4, urls: [url, ...discardedManainProductUrls]
    };
    const summary = {
      quality: { status: "partial", published: false },
      totals: { scrapedProducts: 1, discoveredProductUrls: 4, failures: 3 },
      artifacts: { csvSha256: hash(csv) }
    };
    const errors = {
      quality: "partial", failures: discardedManainProductUrls.map((entry) => ({
        categoryKey: "venta", url: entry, error: "Ficha inaccesible"
      }))
    };
    const filename = join(evidence, "manain-partial-all.csv");
    const censusPath = join(evidence, "censo.json");
    await writeFile(filename, csv);
    await writeFile(filename.replace(/-partial-all\.csv$/, "-summary.json"), JSON.stringify(summary));
    await writeFile(filename.replace(/-partial-all\.csv$/, "-errors.json"), JSON.stringify(errors));
    await writeFile(censusPath, JSON.stringify(census));
    await writeFile(join(records, "manain-record.json"), `${JSON.stringify(buildManainRecord(csv, summary, errors, census), null, 2)}\n`);
    const inputs = { csv: filename, census: censusPath };
    const candidate = await publishTechnicalSnapshot(root, "manain", inputs, false);
    assert.equal(candidate.snapshot.quality, "partial");
    assert.equal(candidate.snapshot.products.length, 1);
    assert.equal(candidate.snapshot.source.kind, "manain-record");
    await assert.rejects(lstat(technicalPath(root, "manain")), { code: "ENOENT" });
    const committed = await publishTechnicalSnapshot(root, "manain", inputs, true);
    assert.equal(committed.status, "activated");
    assert.equal((await readActiveTechnicalPublication(root, "manain"))?.snapshot.quality, "partial");
    assert.equal((await readFile(join(records, "manain-record.json"), "utf8")).includes('"published": false'), true);
    await writeFile(censusPath, JSON.stringify({ ...census, urls: census.urls.slice(1), urlCount: 3 }));
    await assert.rejects(publishTechnicalSnapshot(root, "manain", inputs, true), /no conciliadas|incompleto|inválido/);
    assert.equal((await readActiveTechnicalPublication(root, "manain"))?.sha256, committed.sha256);
  } finally { await rm(root, { force: true, recursive: true }); }
});

test("la auditoría técnica es explícita y no altera los modos comerciales existentes", () => {
  assert.equal(readContentGapOptions(["--tecnicas", "--json"]).technicalPublications, true);
  assert.equal(readContentGapOptions(["--finales"]).technicalPublications, false);
  assert.equal(readContentGapOptions(["--comparar"]).technicalPublications, false);
  for (const args of [["--tecnicas", "--finales"], ["--tecnicas", "--comparar"],
    ["--tecnicas", "--specs"], ["--tecnicas", "--catalogo", "origen.json"]]) {
    assert.throws(() => readContentGapOptions(args), /--tecnicas/);
  }
});


test("la CLI técnica admite las opciones normalizadas por tooling y los alias públicos", async () => {
  const { root, preparation } = await workspace();
  try {
    await runTechnicalPublication(["gomariz", "--preparation", preparation], root);
    await runTechnicalPublication(["gomariz", "--preparacion", preparation], root);
    await assert.rejects(lstat(technicalPath(root, "gomariz")), { code: "ENOENT" });
    await publishTechnicalSnapshot(root, "gomariz", { preparation }, true);
    const versions = await listTechnicalVersions(root, "gomariz");
    assert.equal(versions.length, 1);
    await runTechnicalPublication(["gomariz", "--compare", versions[0]!], root);
    await runTechnicalPublication(["gomariz", "--comparar", versions[0]!], root);
    assert.equal((await readActiveTechnicalPublication(root, "gomariz"))?.sha256, versions[0]);
  } finally { await rm(root, { force: true, recursive: true }); }
});

import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { accreditedPublicationOriginalSources } from "../accredited-publication-original.js";
import { readAccreditedPublication } from "../accredited-publication.js";
import { originalSources } from "../original-catalog-sources.js";
import { assertCurrentCommercialInventory, loadCommercialPublicationInputs } from "../../../../commercial/export/commercial-inputs.js";
import { loadImportCatalog } from "../../legacy-export/import-catalog-loader.js";

const fixture = join(process.cwd(), "src", "testing", "fixtures", "gomariz");
const historical = join(fixture, "regression-143");
const production = join(process.cwd(), "catalogs", "providers", "gomariz", "publications");
const prefix = "scrape-gomariz";
const files = [`${prefix}-catalog.json`, `${prefix}-catalog.manifest.json`, `${prefix}-summary.json`] as const;
const archiveName = "archive-2026-10-29T12-00-00-000Z-11111111-1111-4111-8111-111111111111";

const workspace = async (): Promise<{ root: string; publicationFile: string; archived: string }> => {
  const root = await mkdtemp(join(tmpdir(), "eqz-commercial-original-"));
  const base = join(root, "catalogs", "providers", "gomariz");
  const current = join(base, "original");
  const versions = join(base, "publications");
  const archived = join(root, "storage", "scraped", "gomariz", ".history", prefix, archiveName);
  await mkdir(current, { recursive: true });
  await mkdir(versions);
  await mkdir(archived, { recursive: true });
  for (const name of files) {
    await copyFile(join(fixture, name), join(current, name));
    await copyFile(join(historical, name), join(archived, name));
  }
  const active = JSON.parse(await readFile(join(production, "active.json"), "utf8")) as { approvalSha256: string };
  const version = active.approvalSha256.slice(0, 12);
  const destination = join(versions, version);
  await mkdir(destination);
  for (const name of ["gomariz-publishable.json", "manifest.json", "accreditation.json"]) {
    await copyFile(join(production, version, name), join(destination, name));
  }
  await copyFile(join(production, "active.json"), join(versions, "active.json"));
  return { root, publicationFile: join(destination, "gomariz-publishable.json"), archived };
};

test("la publicación comercial usa el original histórico acreditado tras renovar el inventario vigente", async () => {
  const { root, publicationFile } = await workspace();
  try {
    const published = await readAccreditedPublication(publicationFile);
    assert.equal(published.products.length, 143);
    assert.equal((await originalSources(root, "gomariz"))?.size, 14);
    const historicalSources = await accreditedPublicationOriginalSources(root, publicationFile, "gomariz");
    assert.equal(historicalSources.size, 143);
    assert.ok(historicalSources.has("gomariz:ref:mt1579"));
    const inputs = await loadCommercialPublicationInputs(root, await loadImportCatalog());
    assert.equal(inputs.length, 1);
    assert.equal(inputs[0]?.originalProducts, 143);
    assert.equal(inputs[0]?.entries.length, 143);
    await assert.rejects(assertCurrentCommercialInventory(root, inputs),
      /Exportación comercial bloqueada: gomariz conserva \d+ referencias ausentes del original vigente/);
    assert.equal((await originalSources(root, "gomariz"))?.size, 14);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("la publicación individual admite manifiestos con el contrato mínimo de procedencia", async () => {
  const { root, publicationFile } = await workspace();
  try {
    const manifestPath = join(root, "catalogs", "providers", "gomariz", "publications",
      "ffe1f64cd24d", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      source: { prefix?: string; scope?: string }
    };
    delete manifest.source.prefix;
    delete manifest.source.scope;
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    assert.equal((await accreditedPublicationOriginalSources(root, publicationFile, "gomariz")).size, 143);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("ni la ausencia ni la alteración del archivo histórico permiten usar el original nuevo como sustituto", async () => {
  const { root, publicationFile, archived } = await workspace();
  try {
    const oldCatalog = join(archived, `${prefix}-catalog.json`);
    await writeFile(oldCatalog, `${await readFile(oldCatalog, "utf8")} `);
    await assert.rejects(accreditedPublicationOriginalSources(root, publicationFile, "gomariz"), /No se conserva el original acreditado/);
    await rm(archived, { recursive: true, force: true });
    await assert.rejects(accreditedPublicationOriginalSources(root, publicationFile, "gomariz"), /No se conserva el original acreditado/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("once bajas de Gomariz no invalidan la auditoría histórica ni pueden exportarse sin reacreditación", async () => {
  const { root, publicationFile } = await workspace();
  try {
    const current = join(root, "catalogs", "providers", "gomariz", "original");
    const source = JSON.parse(await readFile(join(historical, `${prefix}-catalog.json`), "utf8")) as {
      productCount: number;
      products: { reference: string | null }[];
    };
    const missing = new Set(["MT1579", "TE61", "BA1347", "5051BDX", "1011JFB", "GR1113",
      "BA1262", "CAE1054", "RO1197", "RO457", "TE1606"]);
    const retained = source.products.filter((product) => !missing.has(product.reference ?? ""));
    assert.equal(source.products.length - retained.length, 11);
    const changed = { ...source, products: retained, productCount: retained.length };
    const raw = JSON.stringify(changed, null, 2);
    const hash = (await import("node:crypto")).createHash("sha256").update(raw).digest("hex");
    const oldManifest = JSON.parse(await readFile(join(historical, `${prefix}-catalog.manifest.json`), "utf8")) as {
      productCount: number; catalogSha256: string;
    };
    const oldSummary = JSON.parse(await readFile(join(historical, `${prefix}-summary.json`), "utf8")) as {
      totals: { scrapedProducts: number }; artifacts: { catalogSha256: string };
    };
    await writeFile(join(current, `${prefix}-catalog.json`), raw);
    await writeFile(join(current, `${prefix}-catalog.manifest.json`), JSON.stringify({
      ...oldManifest, productCount: retained.length, catalogSha256: hash
    }, null, 2));
    await writeFile(join(current, `${prefix}-summary.json`), JSON.stringify({
      ...oldSummary, totals: { ...oldSummary.totals, scrapedProducts: retained.length },
      artifacts: { ...oldSummary.artifacts, catalogSha256: hash }
    }, null, 2));
    const inputs = await loadCommercialPublicationInputs(root, await loadImportCatalog());
    assert.equal(inputs[0]?.entries.length, 143);
    await assert.rejects(assertCurrentCommercialInventory(root, inputs), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /gomariz conserva 11 referencias ausentes/);
      for (const reference of missing) assert.match(error.message, new RegExp(reference));
      return true;
    });
  } finally { await rm(root, { recursive: true, force: true }); }
});

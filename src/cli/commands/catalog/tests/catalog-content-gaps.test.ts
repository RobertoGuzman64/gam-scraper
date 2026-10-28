import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../../../../../", import.meta.url));
const fixture = (provider: string, prefix: string): string =>
  join(root, "src", "testing", "fixtures", provider, `${prefix}-catalog.json`);
const gam = fixture("gam", "scrape-gam-marzo-2026");
const gomariz = fixture("gomariz", "scrape-gomariz");
const mercaeleva = fixture("mercaeleva", "scrape-mercaeleva");
const cli = join(root, "dist", "cli", "commands", "catalog", "catalog-content-gaps.js");

const execute = async (args: readonly string[]): Promise<string> =>
  (await run(process.execPath, [cli, ...args], { cwd: root, maxBuffer: 16 * 1024 * 1024 })).stdout;

test("huecos analiza catálogos canónicos explícitos sin exigir referencia global", async () => {
  const before = await readFile(gam, "utf8");
  const single = JSON.parse(await execute(["--catalogo", gam, "--json"])) as {
    provenance: { source: string; catalogs: { providerId: string; contentSha256: string }[] };
    universe: { total: number; providers: { providerId: string }[] };
  };
  assert.equal(single.provenance.source, "catalogos_canonicos");
  assert.equal(single.universe.total, 244);
  assert.deepEqual(single.universe.providers.map((item) => item.providerId), ["gam"]);
  assert.match(single.provenance.catalogs[0]?.contentSha256 ?? "", /^[a-f0-9]{64}$/);
  const combined = await execute(["--catalogo", gam, "--catalogo", gomariz, "--catalogo", mercaeleva, "--top", "1"]);
  assert.match(combined, /catálogos explícitos \(gam, gomariz, mercaeleva\)/);
  assert.match(combined, /originales 276/);
  assert.equal(await readFile(gam, "utf8"), before);
});

test("huecos rechaza fuentes parciales y proveedores repetidos", async () => {
  await assert.rejects(execute(["--catalogo", "storage/scraped/manain/scrape-manain-partial-all.csv"]));
  await assert.rejects(execute(["--catalogo", gam, "--catalogo", gam]), /Proveedor duplicado/);
  await assert.rejects(execute(["--catalogo", "--json"]), /requiere la ruta/);
});

test("huecos exige manifiesto y publicación completa coherentes para la fuente explícita", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gaps-catalogo-"));
  try {
    const catalog = join(dir, "scrape-gomariz-catalog.json");
    const sourceDir = resolve(gomariz, "..");
    for (const name of ["scrape-gomariz-catalog.json", "scrape-gomariz-catalog.manifest.json", "scrape-gomariz-summary.json"]) {
      await copyFile(join(sourceDir, name), join(dir, name));
    }
    const valid = await execute(["--catalogo", catalog, "--top", "1"]);
    assert.match(valid, /originales 14/);
    const original = await readFile(catalog, "utf8");
    await writeFile(catalog, `${original} `);
    await assert.rejects(execute(["--catalogo", catalog]), /ejecuciones distintas/);
    await writeFile(catalog, original);
    await rm(join(dir, "scrape-gomariz-summary.json"));
    await assert.rejects(execute(["--catalogo", catalog]));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

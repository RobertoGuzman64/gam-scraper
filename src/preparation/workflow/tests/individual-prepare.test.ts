import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test, { after } from "node:test";
import { writeCanonicalCatalog, readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { consolidatePortableOriginal } from "../../../infrastructure/filesystem/catalog/portable-original.js";
import { requireIndividualPreparationContext } from "../individual-context.js";
import { parseIndividualCatalogProviders } from "../../../cli/options/individual-catalog.js";
import { prepareIndividualCatalogs } from "../individual-prepare.js";
import { reuseWorkspaceTestFixture } from "../../../testing/builders/reusable-workspace-fixture.js";

const files = ["scrape-gomariz-catalog.json", "scrape-gomariz-catalog.manifest.json", "scrape-gomariz-summary.json"] as const;
const fixtures = join(process.cwd(), "src", "testing", "fixtures", "gomariz");

const fixtureCache = reuseWorkspaceTestFixture(async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-catalogo preparar "));
  const source = join(root, "fixture");
  try {
    await mkdir(source);
    for (const name of files) await copyFile(join(fixtures, name), join(source, name));
    await consolidatePortableOriginal(root, join(source, files[0]));
    return { root, source, cleanup: () => rm(root, { recursive: true, force: true }) };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
});

const withWorkspace = async (
  run: (root: string, source: string) => Promise<void>, state: "original" | "prepared" = "original"
): Promise<void> => {
  const current = state === "prepared"
    ? await fixtureCache.prepared("prepared-gomariz", async ({ root }) => { await firstPreparation(root); })
    : await fixtureCache.fixture();
  try { await run(current.root, current.source); }
  finally { await current.cleanup(); }
};

after(fixtureCache.close);

const runGomariz = (root: string, dryRun = false) => prepareIndividualCatalogs({
  workspace: root, providers: ["gomariz"], dryRun
});

const firstPreparation = async (root: string): Promise<string> => {
  const [result] = await runGomariz(root);
  assert.equal(result?.error, null);
  assert.equal(result.summary?.status, "generada");
  assert.equal(result.summary.sourceCount, 14);
  assert.ok(result.summary.preparationFile);
  return result.summary.preparationFile;
};

const preparedFile = async (root: string): Promise<string> => {
  const folder = join(root, "storage", "prepared", "gomariz");
  const prepared = (await readdir(folder)).filter((name) => name.endsWith("-preparation.json"));
  assert.equal(prepared.length, 1);
  return join(folder, prepared[0]!);
};

const changeOriginal = async (source: string, root: string): Promise<void> => {
  const file = join(source, files[0]);
  const current = await readCanonicalCatalog(file);
  const endedAt = "2026-11-03T09:00:00Z";
  const products = current.products.map((item, index) => index === 0 ? { ...item, title: "Título revisado" } : item);
  const hash = await writeCanonicalCatalog(source, "scrape-gomariz", current.scope, current.startedAt, endedAt, products);
  await writeFile(join(source, files[2]), JSON.stringify({
    startedAt: current.startedAt, endedAt, quality: { status: "complete", published: true },
    totals: { scrapedProducts: products.length }, artifacts: { catalogSha256: hash }
  }, null, 2));
  await consolidatePortableOriginal(root, file);
};

test("prepara desde original portátil sin storage, reutiliza bytes intactos y soporta cambio de carpeta", async () => {
  await withWorkspace(async (root) => {
    await assert.rejects(requireIndividualPreparationContext(root, "gomariz"), /catalogo:preparar/);
    const file = await firstPreparation(root);
    const before = await readFile(file);
    const beforeSha = createHash("sha256").update(before).digest("hex");
    const firstStat = await lstat(file);
    const repeated = await runGomariz(root);
    assert.equal(repeated[0]?.summary?.status, "reutilizada");
    assert.equal(repeated[0]?.summary?.preparationFile, file);
    assert.equal(createHash("sha256").update(await readFile(file)).digest("hex"), beforeSha);
    assert.equal((await lstat(file)).mtimeMs, firstStat.mtimeMs);
    const directory = join(root, "storage", "prepared", "gomariz");
    assert.equal((await readdir(directory)).length, 3);
    const moved = `${root}-movido`;
    await rename(root, moved);
    try {
      const after = await runGomariz(moved);
      assert.equal(after[0]?.summary?.status, "reutilizada");
      assert.equal(after[0]?.summary?.preparationFile, join(moved, "storage", "prepared", "gomariz", basename(file)));
    } finally { await rename(moved, root); }
  });
});

test("simulación offline no crea carpetas, archivos ni cambia el original", async () => {
  await withWorkspace(async (root) => {
    const original = join(root, "catalogs", "providers", "gomariz", "original", files[0]);
    const before = await readFile(original);
    const result = await runGomariz(root, true);
    assert.equal(result[0]?.summary?.status, "simulada");
    assert.equal(result[0]?.summary?.preparationFile, null);
    await assert.rejects(lstat(join(root, "storage")), { code: "ENOENT" });
    assert.deepEqual(await readFile(original), before);
  });
});

test("corrupción del manifest bloquea sin sobrescribir ni elegir otra versión", async () => {
  await withWorkspace(async (root) => {
    const file = await preparedFile(root);
    const manifest = file.replace(/-preparation\.json$/, "-preparation.manifest.json");
    await writeFile(manifest, "{}");
    const repeated = await runGomariz(root);
    assert.equal(repeated[0]?.summary, null);
    assert.match(repeated[0]?.error ?? "", /Manifest de preparación/);
    assert.equal(await readFile(manifest, "utf8"), "{}");
  }, "prepared");
});

test("original modificado legítimamente produce versión distinta y conserva la anterior", async () => {
  await withWorkspace(async (root, source) => {
    const first = await preparedFile(root);
    const bytes = await readFile(first);
    await changeOriginal(source, root);
    const second = await firstPreparation(root);
    assert.notEqual(first, second);
    assert.deepEqual(await readFile(first), bytes);
    assert.equal((await readdir(join(root, "storage", "prepared", "gomariz"))).length, 6);
    assert.equal((await runGomariz(root))[0]?.summary?.status, "reutilizada");
  }, "prepared");
});

test("dos preparaciones válidas para la misma fuente bloquean selección ambigua", async () => {
  await withWorkspace(async (root) => {
    const first = await preparedFile(root);
    const originalPrefix = first.slice(0, -"-preparation.json".length);
    const secondPrefix = join(root, "storage", "prepared", "gomariz", "scrape-gomariz-copia");
    for (const suffix of ["-preparation.json", "-preparation.manifest.json", "-diagnostics.json"]) {
      await copyFile(`${originalPrefix}${suffix}`, `${secondPrefix}${suffix}`);
    }
    const result = await runGomariz(root);
    assert.equal(result[0]?.summary, null);
    assert.match(result[0]?.error ?? "", /Preparaciones ambiguas/);
  }, "prepared");
});

test("un archivo de preparación enlazado detiene el preflight", async () => {
  await withWorkspace(async (root) => {
    const file = await preparedFile(root);
    const linked = join(root, "storage", "prepared", "gomariz", "scrape-gomariz-enlace-preparation.json");
    await symlink(file, linked);
    const result = await runGomariz(root);
    assert.equal(result[0]?.summary, null);
    assert.match(result[0]?.error ?? "", /no reconocido o no regular/);
  }, "prepared");
});

test("no mezcla un original operativo discordante con el portátil", async () => {
  await withWorkspace(async (root, source) => {
    const operationalDir = join(root, "storage", "scraped", "gomariz");
    await mkdir(operationalDir, { recursive: true });
    for (const name of files) await copyFile(join(source, name), join(operationalDir, name));
    assert.equal((await runGomariz(root, true))[0]?.error, null);
    await changeOriginal(source, root);
    const result = await runGomariz(root);
    assert.equal(result[0]?.summary, null);
    assert.match(result[0]?.error ?? "", /Original operativo distinto del portátil/);
  });
});


test("diagnóstico alterado en incidencias o procedencia bloquea reutilización", async () => {
  await withWorkspace(async (root) => {
    const file = await preparedFile(root);
    const diagnosis = file.replace(/-preparation\.json$/, "-diagnostics.json");
    const original = await readFile(diagnosis, "utf8");
    const originalPreparation = await readFile(file, "utf8");
    const parsed: unknown = JSON.parse(original);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Diagnóstico inválido");
    for (const change of [
      { issues: [{ code: "incidencia-inventada" }] },
      { sourceTriage: [{ issueCode: "evidencia-inventada" }] }
    ]) {
      await writeFile(diagnosis, JSON.stringify({ ...parsed, ...change }, null, 2));
      const result = await runGomariz(root);
      assert.equal(result[0]?.summary, null);
      assert.match(result[0]?.error ?? "", /Diagnóstico incoherente con las incidencias/);
      assert.equal(await readFile(file, "utf8"), originalPreparation);
    }
    await writeFile(diagnosis, original);
    assert.equal((await runGomariz(root))[0]?.summary?.status, "reutilizada");
  }, "prepared");
});

test("preparación obsoleta por reglas deja su versión intacta y genera una actual", async () => {
  await withWorkspace(async (root) => {
    const first = await preparedFile(root);
    const originalPrefix = first.slice(0, -"-preparation.json".length);
    const oldPrefix = join(root, "storage", "prepared", "gomariz", "scrape-gomariz-anterior");
    for (const suffix of ["-preparation.json", "-preparation.manifest.json", "-diagnostics.json"]) {
      await rename(`${originalPrefix}${suffix}`, `${oldPrefix}${suffix}`);
    }
    const oldFile = `${oldPrefix}-preparation.json`;
    const parsed: unknown = JSON.parse(await readFile(oldFile, "utf8"));
    const diagnosticsFile = `${oldPrefix}-diagnostics.json`;
    const diagnostic: unknown = JSON.parse(await readFile(diagnosticsFile, "utf8"));
    assert.ok(typeof parsed === "object" && parsed !== null && "source" in parsed && "fingerprints" in parsed);
    assert.ok(typeof diagnostic === "object" && diagnostic !== null && "fingerprints" in diagnostic);
    const oldFingerprints = { rulesVersion: 2, rulesSha256: "a".repeat(64) };
    const older = JSON.stringify({ ...parsed, fingerprints: oldFingerprints }, null, 2);
    await writeFile(oldFile, older);
    const manifestFile = `${oldPrefix}-preparation.manifest.json`;
    const manifest: unknown = JSON.parse(await readFile(manifestFile, "utf8"));
    assert.ok(typeof manifest === "object" && manifest !== null);
    await writeFile(manifestFile, JSON.stringify({
      ...manifest, preparationSha256: createHash("sha256").update(older).digest("hex")
    }, null, 2));
    await writeFile(diagnosticsFile, JSON.stringify({ ...diagnostic, fingerprints: oldFingerprints }, null, 2));
    const second = await firstPreparation(root);
    assert.notEqual(second, oldFile);
    assert.deepEqual(await readFile(oldFile, "utf8"), older);
    assert.equal((await runGomariz(root))[0]?.summary?.status, "reutilizada");
  }, "prepared");
});

test("bloqueo de retención impide consultar un estado parcial", async () => {
  await withWorkspace(async (root) => {
    const folder = join(root, "storage", "prepared");
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, ".retention-gomariz.lock"), "proceso externo");
    const result = await runGomariz(root, true);
    assert.equal(result[0]?.summary, null);
    assert.match(result[0]?.error ?? "", /bloqueo vigente/);
  });
});

test("parser permite tres proveedores por defecto, selección específica y simulación; rechaza duplicados", () => {
  assert.deepEqual(parseIndividualCatalogProviders([]).providerIds, ["gam", "gomariz", "mercaeleva"]);
  assert.deepEqual(parseIndividualCatalogProviders(["--proveedor", "gomariz", "--simular"]), {
    providerIds: ["gomariz"], dryRun: true
  });
  assert.throws(() => parseIndividualCatalogProviders(["--proveedor", "manain"]), /requiere/);
  assert.throws(() => parseIndividualCatalogProviders(["--proveedor", "gam", "--proveedor", "gam"]), /requiere/);
  assert.throws(() => parseIndividualCatalogProviders(["--dry-run", "--simular"]), /repetido/);
  assert.throws(() => parseIndividualCatalogProviders(["--source", "x"]), /desconocida/);
});

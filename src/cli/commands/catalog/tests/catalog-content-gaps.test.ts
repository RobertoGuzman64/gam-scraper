import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { accreditedBaselineSha, accreditedBaselineFile } from "../../../../testing/accredited-publication-fixture.js";

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

let baselineRoot: string | undefined;
const createBaselineRoot = async (): Promise<string> => {
  const temporary = join(root, "storage");
  await mkdir(temporary, { recursive: true });
  const destination = await mkdtemp(join(temporary, "huecos-baseline-"));
  try {
    await cp(join(root, "dist"), join(destination, "dist"), { recursive: true });
    for (const providerId of ["gam", "gomariz", "mercaeleva"] as const) {
      const source = join(root, "catalogs", "providers", providerId);
      const target = join(destination, "catalogs", "providers", providerId);
      await cp(join(source, "publications", accreditedBaselineSha[providerId]),
        join(target, "publications", accreditedBaselineSha[providerId]), { recursive: true });
      if (providerId !== "mercaeleva") {
        await cp(join(source, "original"), join(target, "original"), { recursive: true });
      }
    }
    return destination;
  } catch (error) {
    await rm(destination, { recursive: true, force: true });
    throw error;
  }
};
const executeBaseline = async (args: readonly string[]): Promise<string> => {
  baselineRoot ??= await createBaselineRoot();
  const fixtureCli = join(baselineRoot, "dist", "cli", "commands", "catalog", "catalog-content-gaps.js");
  return (await run(process.execPath, [fixtureCli, ...args], { cwd: baselineRoot, maxBuffer: 16 * 1024 * 1024 })).stdout;
};
test.after(async () => {
  if (baselineRoot) await rm(baselineRoot, { recursive: true, force: true });
});

test("huecos analiza catálogos canónicos explícitos sin exigir referencia global", async () => {
  const before = await readFile(gam, "utf8");
  const single = JSON.parse(await execute(["--catalogo", gam, "--json"])) as {
    provenance: { source: string; catalogs: { providerId: string; contentSha256: string }[] };
    universe: { total: number; providers: { providerId: string }[] };
    editorial: { lengths: { description: { missing: number } }; providers: { providerId: string }[] };
  };
  assert.equal(single.provenance.source, "catalogos_canonicos");
  assert.equal(single.universe.total, 244);
  assert.equal(single.editorial.providers[0]?.providerId, "gam");
  assert.ok(single.editorial.lengths.description.missing >= 0);
  assert.deepEqual(single.universe.providers.map((item) => item.providerId), ["gam"]);
  assert.match(single.provenance.catalogs[0]?.contentSha256 ?? "", /^[a-f0-9]{64}$/);
  const combined = await execute(["--catalogo", gam, "--catalogo", gomariz, "--catalogo", mercaeleva, "--top", "1"]);
  assert.match(combined, /catálogos explícitos \(gam, gomariz, mercaeleva\)/);
  assert.match(combined, /originales 276/);
  assert.match(combined, /CALIDAD EDITORIAL/);
  assert.match(combined, /SEÑALES EDITORIALES/);
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

test("huecos audita las publicaciones finales acreditadas sin atribuirles originales", async () => {
  const publications = (["gam", "gomariz", "mercaeleva"] as const)
    .map((providerId) => accreditedBaselineFile(root, providerId));
  const raw = await execute(publications.flatMap((path) => ["--publicacion", path]).concat(["--top", "2", "--json"]));
  const report: unknown = JSON.parse(raw);
  assert.ok(isEditorialReport(report));
  assert.equal(report.provenance.source, "publicaciones_acreditadas");
  assert.equal(report.editorial.providers.length, 3);
  assert.ok(report.editorial.providers.every((item) => item.total > 0));
  assert.ok(report.editorial.longestGeneral.length > 0);
  assert.ok(report.editorial.longestGeneral.every((item, index, items) =>
    index === 0 || (items[index - 1]?.words ?? 0) >= item.words));
  const text = await execute(["--publicacion", publications[2] ?? "", "--top", "1"]);
  assert.match(text, /finales [1-9]\d*/);
  assert.match(text, /DESCRIPCIONES GENERALES MÁS LARGAS/);
  await assert.rejects(execute(["--catalogo", gam, "--publicacion", publications[0] ?? ""]), /modos alternativos/);
  await assert.rejects(execute(["--publicacion", publications[0] ?? "", "--publicacion", publications[0] ?? ""]), /Proveedor duplicado/);
});

test("huecos no acepta publicaciones manipuladas aunque el JSON siga siendo válido", async () => {
  const { readdir } = await import("node:fs/promises");
  const rootDir = join(root, "catalogs", "providers", "gomariz", "publications");
  const folder = (await readdir(rootDir)).filter((name) => /^[a-f0-9]{64}$/.test(name)).sort()[0];
  assert.ok(folder);
  const from = join(rootDir, folder);
  const temp = await mkdtemp(join(tmpdir(), "huecos-publicacion-"));
  try {
    for (const name of ["gomariz-publishable.json", "manifest.json", "accreditation.json"]) {
      await copyFile(join(from, name), join(temp, name));
    }
    const publication = join(temp, "gomariz-publishable.json");
    assert.match(await execute(["--publicacion", publication, "--top", "1"]), /finales [1-9]\d*/);
    await writeFile(publication, `${await readFile(publication, "utf8")} `);
    await assert.rejects(execute(["--publicacion", publication]), /SHA256 distinto del manifest/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("huecos puede descubrir y auditar las publicaciones finales sin listar rutas", async () => {
  const output = await executeBaseline(["--finales", "--top", "2"]);
  assert.match(output, /finales 1341/);
  assert.match(output, /DESCRIPCIONES GENERALES MÁS LARGAS/);
  const automatic = await executeBaseline(["--top", "1"]);
  assert.match(automatic, /finales 1341/);
  await assert.rejects(execute(["--finales", "--catalogo", gam]), /no se combina/);
});

test("huecos identifica la conversión CRLF sin aceptar una publicación modificada", async () => {
  const { readdir } = await import("node:fs/promises");
  const publicationsRoot = join(root, "catalogs", "providers", "gomariz", "publications");
  const folder = (await readdir(publicationsRoot)).find((name) => /^[a-f0-9]{64}$/.test(name));
  assert.ok(folder);
  const source = join(publicationsRoot, folder);
  const temp = await mkdtemp(join(tmpdir(), "huecos-crlf-"));
  try {
    for (const name of ["gomariz-publishable.json", "manifest.json", "accreditation.json"]) {
      await copyFile(join(source, name), join(temp, name));
    }
    const publication = join(temp, "gomariz-publishable.json");
    const accreditation = join(temp, "accreditation.json");
    const rawPublication = await readFile(publication, "utf8");
    const rawAccreditation = await readFile(accreditation, "utf8");
    assert.match(await execute(["--publicacion", publication, "--top", "1"]), /finales [1-9]\d*/);
    await writeFile(publication, rawPublication.replace(/\r?\n/g, "\r\n"));
    await assert.rejects(execute(["--publicacion", publication]), /gomariz-publishable\.json: SHA256 distinto del manifest:.*CRLF/);
    await writeFile(publication, rawPublication);
    await writeFile(accreditation, rawAccreditation.replace(/\r?\n/g, "\r\n"));
    await assert.rejects(execute(["--publicacion", publication]), /accreditation\.json: SHA256 de acreditación distinto del manifest:.*CRLF/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("huecos identifica el motivo y la ficha exacta si falla la validación de Gomariz", async () => {
  const { readdir } = await import("node:fs/promises");
  const publicationsRoot = join(root, "catalogs", "providers", "gomariz", "publications");
  const folder = (await readdir(publicationsRoot)).find((name) => /^[a-f0-9]{64}$/.test(name));
  assert.ok(folder);
  const source = join(publicationsRoot, folder);
  const temp = await mkdtemp(join(tmpdir(), "huecos-diagnostico-"));
  try {
    for (const name of ["gomariz-publishable.json", "manifest.json", "accreditation.json"]) {
      await copyFile(join(source, name), join(temp, name));
    }
    const publication = join(temp, "gomariz-publishable.json");
    const raw = await readFile(publication, "utf8");
    await writeFile(publication, `${raw} `);
    await assert.rejects(execute(["--publicacion", publication]), /gomariz-publishable\.json: SHA256 distinto del manifest/);
    await writeFile(publication, raw);
    const parsed: unknown = JSON.parse(raw);
    assert.ok(Array.isArray(parsed));
    const changed = parsed.map((value: unknown, index: number) =>
      index === 0 && typeof value === "object" && value !== null ? { ...value, description: 99 } : value);
    const modified = JSON.stringify(changed);
    await writeFile(publication, modified);
    const manifestPath = join(temp, "manifest.json");
    const manifest: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
    assert.ok(typeof manifest === "object" && manifest !== null && "files" in manifest);
    const files = manifest.files;
    assert.ok(typeof files === "object" && files !== null);
    await writeFile(manifestPath, JSON.stringify({ ...manifest, files: {
      ...files, "gomariz-publishable.json": createHash("sha256").update(modified).digest("hex")
    } }));
    await assert.rejects(execute(["--publicacion", publication]), /ficha 1 .*description: debe ser texto o null/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

type EditorialReport = {
  readonly provenance: { readonly source: string };
  readonly editorial: {
    readonly providers: readonly { readonly total: number }[];
    readonly patterns: readonly { readonly code: string; readonly providerId: string }[];
    readonly longestGeneral: readonly { readonly reference: string | null; readonly words: number }[];
  };
};
const isEditorialReport = (value: unknown): value is EditorialReport => {
  if (typeof value !== "object" || value === null || !('editorial' in value) ||
    typeof value.editorial !== "object" || value.editorial === null ||
    !('provenance' in value) || typeof value.provenance !== "object" || value.provenance === null) return false;
  const editorial = value.editorial;
  return 'providers' in editorial && Array.isArray(editorial.providers) &&
    'patterns' in editorial && Array.isArray(editorial.patterns) &&
    'longestGeneral' in editorial && Array.isArray(editorial.longestGeneral) &&
    'source' in value.provenance && typeof value.provenance.source === "string";
};

test("huecos compara las 1341 publicaciones y acredita la cobertura completa de descripciones", async () => {
  const raw = await executeBaseline(["--comparar", "--json", "--top", "1"]);
  const report: unknown = JSON.parse(raw);
  assert.ok(isComparisonReport(report));
  assert.equal(report.provenance.source, "comparacion_publicaciones_y_preparacion");
  assert.equal(report.coverage.totals.products, 1341);
  assert.deepEqual(report.coverage.totals.publishedMissing, { description: 163, description_general: 11 });
  assert.deepEqual(report.coverage.totals.recovered, { description: 163, description_general: 11 });
  assert.deepEqual(report.coverage.totals.pending, { description: 0, description_general: 0 });
  assert.deepEqual(report.coverage.totals.lost, { description: 0, description_general: 0 });
  assert.equal(report.coverage.totals.incompleteProducts, 0);
  assert.equal(report.coverage.totals.bothPending, 0);
  assert.equal(report.coverage.pendingCases.length, 0);
  assert.equal(report.coverage.providers.find((item) => item.providerId === "mercaeleva")?.origin, "reconstruccion_publicada");
  assert.equal(report.editorial.providers.length, 3);
  assert.equal(report.editorialPrepared.providers.length, 3);
  assert.equal(report.priorities.totals.pendingByStage.P0, 0);
  assert.ok(report.priorities.pending.length > 0);
  for (const reference of ["M432-1479", "M913-0641", "M736-5615", "M095-5362", "M144-5512", "M171-6370", "M200-9533", "M178-6194", "M205-2951", "M572-8190", "M030-7485", "M005-4474"]) {
    assert.ok(!report.priorities.pending.some((item) => item.reference === reference && item.signal === "general_muy_breve"));
    assert.ok(report.priorities.resolved.some((item) => item.reference === reference && item.signal === "general_muy_breve"));
  }
  for (const reference of ["6617", "BT1461"]) {
    assert.ok(!report.priorities.pending.some((item) => item.reference === reference && item.signal === "general_muy_breve"));
    assert.ok(report.priorities.resolved.some((item) => item.reference === reference && item.signal === "general_muy_breve"));
  }
  assert.ok(!report.priorities.pending.some((item) => item.reference === "5996" && item.signal === "general_desproporcionada"));
  assert.ok(report.priorities.pending.some((item) => item.reference === "5992" && item.signal === "general_desproporcionada" && item.preparedWords > 2000));
  for (const reference of ["2628", "6217", "2150", "5710", "6358", "6367", "920", "2263", "2111"]) {
    assert.ok(!report.priorities.pending.some((item) => item.reference === reference && item.signal === "general_muy_breve"));
    assert.ok(report.priorities.resolved.some((item) => item.reference === reference && item.signal === "general_muy_breve"));
  }
  assert.equal(report.priorities.totals.pendingByStage.P0, 0);
  assert.ok(report.priorities.pending.some((item) => item.signal === "general_muy_breve"));
  assert.ok(report.priorities.pending.some((item) => item.stage === "P2" && item.familySamples >= 5));
  assert.equal(report.priorities.resolved.filter((item) => item.stage === "P0").length, 174);
  assert.ok(report.priorities.technical.some((item) => item.contradictions.length > 0));
  const text = await executeBaseline(["--comparar", "--top", "1"]);
  assert.match(text, /P0 COLA RESIDUAL \| 0 fichas, sin recorte por --top/);
  assert.match(text, /ORDEN DE TRABAJO \| P0 vacíos 0/);
  assert.match(text, /INCIDENCIAS TÉCNICAS/);
  await assert.rejects(execute(["--comparar", "--finales"]), /no se combina/);
});

type ComparisonReport = {
  readonly provenance: { readonly source: string };
  readonly editorial: { readonly providers: readonly unknown[] };
  readonly editorialPrepared: { readonly providers: readonly unknown[] };
  readonly priorities: {
    readonly totals: { readonly pendingByStage: { readonly P0: number } };
    readonly pending: readonly { readonly reference: string | null; readonly signal: string;
      readonly stage: string; readonly preparedWords: number; readonly familySamples: number }[];
    readonly resolved: readonly { readonly stage: string; readonly reference: string | null; readonly signal: string }[];
    readonly technical: readonly { readonly contradictions: readonly string[] }[];
  };
  readonly coverage: {
    readonly totals: {
      readonly products: number;
      readonly publishedMissing: { readonly description: number; readonly description_general: number };
      readonly recovered: { readonly description: number; readonly description_general: number };
      readonly pending: { readonly description: number; readonly description_general: number };
      readonly lost: { readonly description: number; readonly description_general: number };
      readonly incompleteProducts: number;
      readonly bothPending: number;
    };
    readonly pendingCases: readonly { readonly reference: string | null; readonly missing: readonly string[] }[];
    readonly providers: readonly { readonly providerId: string; readonly origin: string }[];
  };
};
const isComparisonReport = (value: unknown): value is ComparisonReport => {
  if (typeof value !== "object" || value === null || !("coverage" in value) || !("editorial" in value) ||
    !("editorialPrepared" in value) || !("provenance" in value) ||
    typeof value.coverage !== "object" || value.coverage === null ||
    typeof value.provenance !== "object" || value.provenance === null ||
    typeof value.editorial !== "object" || value.editorial === null ||
    typeof value.editorialPrepared !== "object" || value.editorialPrepared === null) return false;
  return "totals" in value.coverage && "pendingCases" in value.coverage && "providers" in value.coverage &&
    "source" in value.provenance && "providers" in value.editorial && "providers" in value.editorialPrepared &&
    "priorities" in value && typeof value.priorities === "object" && value.priorities !== null &&
    "totals" in value.priorities && "pending" in value.priorities && "resolved" in value.priorities &&
    "technical" in value.priorities;
};

test("huecos --comparar --specs diferencia cobertura técnica sin alterar el informe editorial", async () => {
  const comparison = JSON.parse(await executeBaseline(["--comparar", "--specs", "--json"])) as {
    coverage: { totals: { products: number; pending: { description: number; description_general: number } } };
    priorities: { totals: { pending: number } };
    technicalSpecs: { totals: { products: number; canonicalOriginals: number; reconstructedSources: number;
      pendingPublication: number; observationalMissing: number };
      cases: { providerId: string; reference: string | null; stage: string }[] };
  };
  assert.equal(comparison.coverage.totals.products, 1341);
  assert.deepEqual(comparison.coverage.totals.pending, { description: 0, description_general: 0 });
  assert.ok(comparison.priorities.totals.pending > 0);
  assert.equal(comparison.technicalSpecs.totals.products, 1341);
  assert.equal(comparison.technicalSpecs.totals.canonicalOriginals, 1121);
  assert.equal(comparison.technicalSpecs.totals.reconstructedSources, 220);
  assert.equal(comparison.technicalSpecs.totals.pendingPublication,
    comparison.technicalSpecs.cases.filter((item) => item.stage === "pendiente_publicacion").length);
  assert.ok(comparison.technicalSpecs.totals.observationalMissing > 0);
  assert.ok(comparison.technicalSpecs.cases.some((item) => item.providerId === "gam" &&
    item.reference === "6807" && item.stage === "diferencia_origen_preparacion"));
  await assert.rejects(execute(["--finales", "--specs"]), /requiere --comparar/);
});

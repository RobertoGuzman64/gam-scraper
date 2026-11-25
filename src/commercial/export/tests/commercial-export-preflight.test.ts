import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createCommercialReferenceFixture, type CommercialReferenceFixture } from "../../../testing/builders/commercial-reference-fixture.js";
import { inspectCommercialExportPreflight, prepareCommercialExportPreflight, type CommercialExportPreflight } from "../commercial-export-preflight.js";
import { validateCommercialExportFiles } from "../commercial-export-verification.js";
import { renderCommercialExportPreflight } from "../../../cli/reporting/commercial/commercial-export-preflight.js";
import { renderCommercialIntegrationReport } from "../../../cli/reporting/commercial/commercial-integration-report.js";

const publication = (providerId: string, root: string): string =>
  join(root, "catalogs", "providers", providerId, "publications", "active.json");

let referenceFixturePromise: Promise<CommercialReferenceFixture> | undefined;
const referenceFixture = (): Promise<CommercialReferenceFixture> =>
  referenceFixturePromise ??= createCommercialReferenceFixture();

test.after(async () => {
  if (referenceFixturePromise) await (await referenceFixturePromise).cleanup();
});

test("preflight comercial usa tres proveedores y acredita el corte sin fecha inventada", async () => {
  const { root } = await referenceFixture();
  const progress: string[] = [];
  const { preflight: result, files } = await prepareCommercialExportPreflight(root, "develop",
    (providerId, completed, total) => progress.push(`${providerId}:${completed}/${total}`));
  assert.deepEqual(progress, ["gam:1/3", "gomariz:2/3", "mercaeleva:3/3"]);
  assert.deepEqual(result.publications.map((item) => item.providerId), ["gam", "gomariz", "mercaeleva"]);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.globalFailures, []);
  assert.ok(result.publications.every((item) => item.products > 0 && /^[a-f0-9]{64}$/u.test(item.publicationSha256)));
  const lines = renderCommercialExportPreflight(result, "develop").join("\n");
  assert.match(lines, /Fecha de publicación: no declarada/);
  assert.match(lines, /publicaciones vigentes REUTILIZADAS/);
  assert.match(lines, /paquete comercial AÚN NO GENERADO/);
  assert.doesNotMatch(lines, /Categoría comercial no válida para gam:ref:2071: 11/);
  assert.doesNotMatch(lines, /PUBLICACIÓN VIGENTE \| manain/u);
  assert.doesNotMatch(lines, /SHA256|Run:|selección:/u);
  assert.equal((lines.match(/Fecha de publicación: no declarada/g) ?? []).length, 1);
  const detailed = renderCommercialExportPreflight(result, "develop", true).join("\n");
  for (const item of result.publications) {
    assert.ok(detailed.includes(item.publicationSha256));
    assert.ok(detailed.includes(item.runId));
    assert.ok(detailed.includes(item.selection));
    if (item.sourceCatalogSha256) assert.ok(detailed.includes(item.sourceCatalogSha256));
  }
  assert.match(detailed, /Fecha de publicación: no declarada en el contrato acreditado/);
  assert.ok(files);
  assert.doesNotThrow(() => validateCommercialExportFiles(files));
});

test("selecciones corruptas se informan por proveedor sin bloquear otros diagnósticos", async () => {
  const { root } = await referenceFixture();
  const gam = publication("gam", root);
  const gomariz = publication("gomariz", root);
  const beforeGam = await readFile(gam);
  const beforeGomariz = await readFile(gomariz);
  try {
    await writeFile(gam, "{invalido");
    await writeFile(gomariz, "{invalido");
    const result = await inspectCommercialExportPreflight(root, null);
    assert.ok(result.failures.some((item) => item.providerId === "gam" && item.category === "ERROR"));
    assert.ok(result.failures.some((item) => item.providerId === "gomariz" && item.category === "ERROR"));
    assert.ok(result.publications.some((item) => item.providerId === "mercaeleva"));
    for (const detailed of [false, true]) {
      const rendered = renderCommercialExportPreflight(result, null, detailed).join("\n");
      for (const failure of result.failures) assert.ok(rendered.includes(failure.detail));
      assert.match(rendered, /publicaciones inspeccionadas con bloqueos/);
      assert.match(rendered, /paquete comercial NO GENERADO/);
    }
    const prepared = await prepareCommercialExportPreflight(root, null);
    assert.equal(prepared.files, null);
    assert.ok(prepared.preflight.failures.some((item) => item.providerId === "gam"));
  } finally {
    await writeFile(gam, beforeGam);
    await writeFile(gomariz, beforeGomariz);
  }
});

test("el reporte de integración distingue fecha del paquete y fechas de publicaciones no acreditadas", () => {
  const markdown = renderCommercialIntegrationReport({ environment: null,
    manifestSha256: "a".repeat(64), providers: [] }, "2026-11-16");
  assert.match(markdown, /Fecha del paquete \(UTC\): 2026-11-16/);
  assert.match(markdown, /Origen: publicaciones técnicas acreditadas seleccionadas como vigentes ANTES de la exportación/);
  assert.match(markdown, /Fecha de cada publicación de origen: NO DECLARADA/);
  assert.match(markdown, /NO VERIFICADO EN BD/);
});

test("el preflight no entrega archivos si faltan las publicaciones y notifica el avance real", async () => {
  const root = await mkdtemp(join(tmpdir(), "eqz-commercial-preflight-"));
  try {
    const progress: string[] = [];
    const result = await prepareCommercialExportPreflight(root, null,
      (providerId, completed, total) => progress.push(`${providerId}:${completed}/${total}`));
    assert.equal(result.files, null);
    assert.equal(result.preflight.failures.length, 3);
    assert.deepEqual(progress, ["gam:1/3", "gomariz:2/3", "mercaeleva:3/3"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test("el preflight conserva las alertas históricas y reserva las huellas completas para el detalle", () => {
  const mismatch = { path: "data/reference.json", expectedSha256: "a".repeat(64), actualSha256: null };
  const result: CommercialExportPreflight = {
    publications: [], failures: [], globalFailures: ["Diagnóstico de prueba"],
    historicalReferences: [mismatch], historicalReferenceWarning: null
  };
  const compact = renderCommercialExportPreflight(result, null).join("\n");
  const detailed = renderCommercialExportPreflight(result, null, true).join("\n");
  for (const output of [compact, detailed]) {
    assert.match(output, /WARN \| REFERENCIAS HISTÓRICAS \| 1 discrepancia de huella; archivos no modificados/);
    assert.match(output, /ERROR \| Diagnóstico de prueba/);
  }
  assert.match(compact, /\n\nERROR \| Diagnóstico de prueba\n\nWARN \| REFERENCIAS HISTÓRICAS/);
  assert.match(compact, /--detalle/);
  assert.ok(!compact.includes(mismatch.path));
  assert.ok(!compact.includes(mismatch.expectedSha256));
  assert.ok(detailed.includes(mismatch.path));
  assert.ok(detailed.includes(mismatch.expectedSha256));
  assert.match(detailed, /archivo ausente o no regular/);
  assert.match(renderCommercialExportPreflight({ ...result, historicalReferences: null }, null).join("\n"), /sin manifiesto disponible/);
  assert.match(renderCommercialExportPreflight({ ...result, historicalReferenceWarning: "Lectura fallida" }, null).join("\n"), /diagnóstico no disponible: Lectura fallida/);
});

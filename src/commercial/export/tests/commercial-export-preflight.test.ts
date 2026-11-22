import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { createCommercialReferenceFixture, type CommercialReferenceFixture } from "../../../testing/builders/commercial-reference-fixture.js";
import { inspectCommercialExportPreflight } from "../commercial-export-preflight.js";
import { renderCommercialExportPreflight } from "../../../cli/reporting/commercial-export-preflight.js";
import { renderCommercialIntegrationReport } from "../../../cli/reporting/commercial-integration-report.js";

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
  const result = await inspectCommercialExportPreflight(root, "develop");
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

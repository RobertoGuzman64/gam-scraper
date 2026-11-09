import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { accreditedPublicationDirectory, accreditedPublicationFile } from "../../../../testing/builders/accredited-publication-fixture.js";
import { execute, gam, root } from "./catalog-content-gaps-fixtures.js";

test("huecos audita las publicaciones finales acreditadas sin atribuirles originales", async () => {
  const publications = await Promise.all((["gam", "gomariz", "mercaeleva"] as const)
    .map((providerId) => accreditedPublicationFile(root, providerId)));
  const raw = await execute(publications.flatMap((path) => ["--publicacion", path]).concat(["--top", "2", "--json"]));
  const report: unknown = JSON.parse(raw);
  assert.ok(isEditorialReport(report));
  assert.equal(report.provenance.source, "publicaciones_acreditadas");
  assert.equal(report.editorial.providers.length, 3);
  assert.ok(report.editorial.providers.every((item) => item.total > 0));
  assert.ok(report.editorial.longestGeneral.length > 0);
  assert.equal(report.technicalDensity.totals.products,
    report.technicalDensity.providers.reduce((total, provider) => total + provider.products, 0));
  assert.equal(report.technicalDensity.totals.sparse, report.technicalDensity.cases.length);
  assert.equal(report.technicalSemantics.totals.products, report.technicalDensity.totals.products);
  assert.equal(report.technicalSemantics.totals.findings, report.technicalSemantics.cases.length);
  assert.equal(report.technicalSemantics.totals.affectedProducts,
    new Set(report.technicalSemantics.cases.map((issue) => issue.identity)).size);
  assert.ok(report.editorial.longestGeneral.every((item, index, items) =>
    index === 0 || (items[index - 1]?.words ?? 0) >= item.words));
  const text = await execute(["--publicacion", publications[2] ?? "", "--top", "1", "--detalle"]);
  assert.match(text, /finales [1-9]\d*/);
  assert.match(text, /DESCRIPCIONES GENERALES MÁS LARGAS/);
  assert.match(text, /DENSIDAD TÉCNICA \| PRIORIDAD EDITORIAL/);
  assert.match(text, /VALORES TÉCNICOS \| fichas/);
  await assert.rejects(execute(["--catalogo", gam, "--publicacion", publications[0] ?? ""]), /modos alternativos/);
  await assert.rejects(execute(["--publicacion", publications[0] ?? "", "--publicacion", publications[0] ?? ""]), /Proveedor duplicado/);
});

test("huecos no acepta publicaciones manipuladas aunque el JSON siga siendo válido", async () => {
  const from = await accreditedPublicationDirectory(root, "gomariz");
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

test("huecos identifica la conversión CRLF sin aceptar una publicación modificada", async () => {
  const source = await accreditedPublicationDirectory(root, "gomariz");
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
  const source = await accreditedPublicationDirectory(root, "gomariz");
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
  readonly technicalDensity: {
    readonly totals: { readonly products: number; readonly sparse: number };
    readonly providers: readonly { readonly products: number }[];
    readonly cases: readonly unknown[];
  };
  readonly technicalSemantics: {
    readonly totals: { readonly products: number; readonly affectedProducts: number; readonly findings: number };
    readonly cases: readonly { readonly identity: string }[];
  };
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
  return 'technicalSemantics' in value && typeof value.technicalSemantics === 'object' &&
    value.technicalSemantics !== null && 'totals' in value.technicalSemantics &&
    'cases' in value.technicalSemantics &&
    'technicalDensity' in value && typeof value.technicalDensity === 'object' &&
    value.technicalDensity !== null && 'totals' in value.technicalDensity &&
    'providers' in value.technicalDensity && 'cases' in value.technicalDensity &&
    'providers' in editorial && Array.isArray(editorial.providers) &&
    'patterns' in editorial && Array.isArray(editorial.patterns) &&
    'longestGeneral' in editorial && Array.isArray(editorial.longestGeneral) &&
    'source' in value.provenance && typeof value.provenance.source === "string";
};


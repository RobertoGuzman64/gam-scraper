import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { inspectCatalogReplicas, inspectRepositoryGovernance } from "./tests-repository-governance-guard.mjs";

const fixture = (t) => {
  const root = mkdtempSync(join(tmpdir(), "eq-governance-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, contents) => {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents);
  };
  write("docs/QUALITY.md", "Reglas vigentes\n");
  write("scripts/run.mjs", "export const run = true;\n");
  write("package.json", JSON.stringify({ scripts: { test: "node scripts/run.mjs" } }));
  const policy = {
    version: 3,
    maxCounts: { markdown: 1, scripts: 1 },
    allowedPaths: { markdown: ["docs/QUALITY.md"], scripts: ["scripts/run.mjs"] },
    npmScripts: { test: "node scripts/run.mjs" },
    npmBin: null
  };
  return { root, write, policy };
};

const findings = (fixtureValue) => inspectRepositoryGovernance(fixtureValue.root, fixtureValue.policy).findings;

test("acepta el inventario autorizado sin generar artefactos", (t) => {
  const value = fixture(t);
  assert.deepEqual(findings(value), []);
  assert.deepEqual(inspectRepositoryGovernance(value.root, value.policy).counts, {
    markdown: 1, scripts: 1, npmScripts: 1
  });
});

test("permite editar y eliminar documentos existentes sin controlar el contenido", (t) => {
  const value = fixture(t);
  value.write("docs/QUALITY.md", "Texto actualizado\n");
  assert.deepEqual(findings(value), []);
  rmSync(join(value.root, "docs/QUALITY.md"));
  assert.deepEqual(findings(value), []);
  assert.equal(inspectRepositoryGovernance(value.root, value.policy).counts.markdown, 0);
});

test("rechaza documentos nuevos aunque no se supere el máximo", (t) => {
  const value = fixture(t);
  rmSync(join(value.root, "docs/QUALITY.md"));
  value.write("data/NEW.md", "sin autorización");
  assert.deepEqual(findings(value), ["Markdown no autorizado: data/NEW.md"]);
});

test("rechaza superar el máximo de documentos aunque sean de otras carpetas", (t) => {
  const value = fixture(t);
  value.write("docs/NEW.md", "sin autorización");
  value.write("data/NOTES.md", "sin autorización");
  assert.ok(findings(value).some((item) => item.includes("Exceso de Markdown: 3 (máximo 1)")));
});

test("permite editar y eliminar scripts existentes sin controlar el contenido", (t) => {
  const value = fixture(t);
  value.write("scripts/run.mjs", "export default 2;\n");
  assert.deepEqual(findings(value), []);
  rmSync(join(value.root, "scripts/run.mjs"));
  assert.deepEqual(findings(value), []);
});

test("rechaza scripts añadidos o sustituidos dentro del máximo", (t) => {
  const value = fixture(t);
  rmSync(join(value.root, "scripts/run.mjs"));
  value.write("tools/new.py", "print(1)\n");
  assert.deepEqual(findings(value), ["Script no autorizado: tools/new.py"]);
});

test("rechaza un script añadido fuera de las carpetas habituales", (t) => {
  const value = fixture(t);
  value.write("src/preparation/auxiliary.mjs", "export {};\n");
  assert.ok(findings(value).includes("Script no autorizado: src/preparation/auxiliary.mjs"));
});

test("rechaza superar el máximo de scripts desde cualquier carpeta", (t) => {
  const value = fixture(t);
  value.write("tools/new.py", "print(1)\n");
  value.write("docs/hidden.sh", "echo fail\n");
  value.write("scripts/123.ts", "export const id = '123';\n");
  assert.ok(findings(value).some((item) => item.includes("Exceso de scripts: 4 (máximo 1)")));
});

test("rechaza scripts y documentación temporal sin depender de la extensión", (t) => {
  const value = fixture(t);
  value.write("docs/notes.tmp", "borrador\n");
  value.write("scripts/scratch.txt", "prueba\n");
  value.write("src/preparation/temp-audit.ts", "export const run = true;\n");
  const result = findings(value);
  assert.ok(result.includes("Archivo temporal prohibido: docs/notes.tmp"));
  assert.ok(result.includes("Archivo temporal prohibido: scripts/scratch.txt"));
  assert.ok(result.includes("Archivo temporal prohibido: src/preparation/temp-audit.ts"));
});

test("rechaza archivos encubiertos en las carpetas de documentación y scripts", (t) => {
  const value = fixture(t);
  value.write("docs/nota.txt", "texto\n");
  value.write("scripts/nota.txt", "texto\n");
  value.write("GUARDS/otro.json", "{}\n");
  const result = findings(value);
  assert.ok(result.includes("Archivo no autorizado en docs/: docs/nota.txt"));
  assert.ok(result.includes("Archivo no autorizado en scripts/: scripts/nota.txt"));
  assert.ok(result.includes("Archivo no autorizado en GUARDS/: GUARDS/otro.json"));
});

test("mantiene protegidos los comandos npm y los cambios de su contenido", (t) => {
  const value = fixture(t);
  value.write("package.json", JSON.stringify({ scripts: { test: "node scripts/changed.mjs", extra: "echo no" } }));
  assert.ok(findings(value).some((item) => item.includes("Comando npm modificado")));
  assert.ok(findings(value).some((item) => item.includes("Comando npm no autorizado")));
});

test("mantiene protegidos los puntos de entrada package bin", (t) => {
  const value = fixture(t);
  value.write("package.json", JSON.stringify({ scripts: value.policy.npmScripts, bin: "scripts/run.mjs" }));
  assert.ok(findings(value).some((item) => item.includes("package.json/bin")));
});

test("prohíbe nombres de fases en cualquier carpeta y extensión", (t) => {
  const value = fixture(t);
  for (const pathname of ["docs/OPERATIVA_F8.md", "src/phase-12.ts", "data/FASE_15.json", "src/f16-extra.ts"]) {
    value.write(pathname, "contenido");
  }
  assert.equal(findings(value).filter((item) => item.includes("Nombre de fase prohibido")).length, 4);
});

test("rechaza contratos incompletos, rutas duplicadas y límites inválidos", (t) => {
  const value = fixture(t);
  assert.throws(() => inspectRepositoryGovernance(value.root, { version: 3 }), /inválido/u);
  for (const count of [-1, 0.5, "1", null]) {
    assert.throws(() => inspectRepositoryGovernance(value.root, {
      ...value.policy, maxCounts: { markdown: count, scripts: 1 }
    }), /inválido/u);
  }
  for (const pathname of ["../escape.md", "/docs/NEW.md", "docs\\BAD.md", "storage/hidden.md", "scripts/run.mjs"]) {
    assert.throws(() => inspectRepositoryGovernance(value.root, {
      ...value.policy, allowedPaths: { markdown: [pathname], scripts: ["scripts/run.mjs"] }
    }), /inválido/u);
  }
  assert.throws(() => inspectRepositoryGovernance(value.root, {
    ...value.policy, allowedPaths: { markdown: ["docs/QUALITY.md", "docs/QUALITY.md"], scripts: ["scripts/run.mjs"] }
  }), /inválido/u);
  assert.throws(() => inspectRepositoryGovernance(value.root, {
    ...value.policy, maxCounts: { markdown: 2, scripts: 1 }
  }), /inválido/u);
});

const machine = (reference) => ({
  providerId: "gam", reference, categoryKey: "elevacion", title: `Máquina ${reference}`,
  url: `https://example.test/machine/${reference}`, brand: "Marca", model: "Modelo", specifications: []
});

const zip = (entries) => {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, value] of entries) {
    const filename = Buffer.from(name);
    const content = Buffer.isBuffer(value) ? value : Buffer.from(value);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(filename.length, 26);
    locals.push(local, filename, content);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt32LE(content.length, 20);
    directory.writeUInt32LE(content.length, 24);
    directory.writeUInt16LE(filename.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, filename);
    offset += local.length + filename.length + content.length;
  }
  const listing = Buffer.concat(central);
  const trailer = Buffer.alloc(22);
  trailer.writeUInt32LE(0x06054b50, 0);
  trailer.writeUInt16LE(entries.length, 8);
  trailer.writeUInt16LE(entries.length, 10);
  trailer.writeUInt32LE(listing.length, 12);
  trailer.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, listing, trailer]);
};

const replicaCodes = (root) => inspectCatalogReplicas(root).findings.map((finding) => finding.split(":")[0]);

test("impide un archivo clonado de catalogs aunque cambie de carpeta o extensión", (t) => {
  const value = fixture(t);
  const { root, write } = value;
  const source = JSON.stringify({ providerId: "gam", productCount: 1, products: [machine("100")] });
  write("catalogs/providers/gam/original/original.json", source);
  write("src/other/source.evidence", source);
  assert.ok(replicaCodes(root).includes("R-ARCHIVO-DUPLICADO"));
  assert.ok(findings({ root, policy: value.policy }).some((finding) => finding.includes("R-ARCHIVO-DUPLICADO")));
});

test("detecta registros íntegros copiados aunque cambien formato y orden de campos", (t) => {
  const { root, write } = fixture(t);
  write("catalogs/providers/gam/original/original.json", JSON.stringify({ products: [machine("101")] }));
  write("data/cache/not-a-catalog.txt", JSON.stringify([{ ...machine("101") }], null, 2));
  assert.ok(replicaCodes(root).includes("R-REGISTRO-COPIADO"));
});

test("rechaza catálogos renombrados y productos repartidos en múltiples datasets", (t) => {
  const { root, write } = fixture(t);
  write("src/testing/data/one.payload", JSON.stringify({ providerId: "gam", products: Array.from({ length: 11 }, (_, i) => machine(String(i))) }));
  assert.ok(replicaCodes(root).includes("R-REPLICA-CATALOGO"));
  assert.ok(replicaCodes(root).includes("R-DATASET-DE-MAQUINAS"));
  rmSync(join(root, "src/testing/data/one.payload"));
  for (let i = 0; i < 3; i++) {
    write(`src/testing/data/shard-${i}.dat`, JSON.stringify(Array.from({ length: 4 }, (_, j) => machine(`${i}-${j}`))));
  }
  assert.ok(replicaCodes(root).includes("R-CATALOGO-FRAGMENTADO"));
});

test("bloquea manifests y publicaciones de catálogo fuera del propietario legítimo", (t) => {
  const { root, write } = fixture(t);
  write("src/testing/manifest.json", JSON.stringify({ version: 1, providerId: "gam", productCount: 3, catalogSha256: "a".repeat(64) }));
  assert.ok(replicaCodes(root).includes("R-ARTEFACTO-CATALOGO"));
  rmSync(join(root, "src/testing/manifest.json"));
  write("src/testing/publication.json", JSON.stringify({
    providerId: "gam", runId: "historical", source: { catalogSha256: "a".repeat(64) },
    totals: { ready: 2 }, files: { "published.json": "b".repeat(64) }
  }));
  assert.ok(replicaCodes(root).includes("R-ARTEFACTO-CATALOGO"));
});

test("detecta archivos ZIP disfrazados por la firma, la ruta y el contenido", (t) => {
  const { root, write } = fixture(t);
  write("src/testing/panel/published-snapshot.evidence", zip([
    ["catalogs/providers/gam/original/source.json", "{}"]
  ]));
  assert.ok(replicaCodes(root).includes("R-CATALOGO-EMPAQUETADO"));
  rmSync(join(root, "src/testing/panel/published-snapshot.evidence"));
  write("data/renamed.bin", zip([["hidden.json", JSON.stringify({ providerId: "gam", products: Array.from({ length: 12 }, (_, i) => machine(String(i))) })]]));
  assert.ok(replicaCodes(root).includes("R-DATASET-DE-MAQUINAS"));
});

test("rechaza archivos GZIP renombrados con productos de un proveedor", (t) => {
  const { root, write } = fixture(t);
  write("src/backup/evidence.dat", gzipSync(Buffer.from(JSON.stringify({ providerId: "gam", products: Array.from({ length: 5 }, (_, i) => machine(String(i))) }))));
  assert.ok(replicaCodes(root).includes("R-REPLICA-CATALOGO"));
});

test("rechaza payloads de catálogo incrustados masivamente en código de pruebas", (t) => {
  const { root, write } = fixture(t);
  const value = Array.from({ length: 12 }, (_, i) => JSON.stringify(machine(String(i))));
  write("src/testing/builders/embedded.ts", `export const entries = [${value.join(",")}];\n`);
  assert.ok(replicaCodes(root).includes("R-REGISTROS-EMBEBIDOS"));
});

test("permite catálogos bajo catalogs, casos sintéticos pequeños y conocimientos derivados", (t) => {
  const { root, write } = fixture(t);
  write("catalogs/providers/gam/original/source.json", JSON.stringify({ providerId: "gam", products: Array.from({ length: 12 }, (_, i) => machine(String(i))) }));
  write("src/testing/fixtures/sample.json", JSON.stringify([{ ...machine("synthetic-1"), title: "Ejemplo sintético" }]));
  write("data/editorial/knowledge/verified-units.json", JSON.stringify({ version: 1, entries: Array.from({ length: 30 }, (_, i) => ({ key: `gam:${i}`, model: "MODEL", facts: ["dato"] })) }));
  write("src/testing/panel/benign.evidence", zip([["readme.txt", "texto sin datos de catálogo"]]));
  assert.deepEqual(replicaCodes(root), []);
});

test("un contenedor corrupto no evade el guard", (t) => {
  const { root, write } = fixture(t);
  write("src/testing/fixtures/hidden.evidence", Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]));
  assert.ok(replicaCodes(root).includes("R-CONTENEDOR-NO-INSPECCIONABLE"));
});

test("protege proveedores futuros sin incorporar listas cerradas", (t) => {
  const { root, write } = fixture(t);
  write("src/testing/data/new-provider.bin", JSON.stringify({
    providerId: "proveedor-futuro", products: Array.from({ length: 12 }, (_, i) => ({
      ...machine(`future-${i}`), providerId: "proveedor-futuro"
    }))
  }));
  assert.ok(replicaCodes(root).includes("R-REPLICA-CATALOGO"));
});

test("detecta las evidencias y resúmenes históricos que no incluyen providerId en la raíz", (t) => {
  const { root, write } = fixture(t);
  write("src/testing/fixtures/preparation.json", JSON.stringify({
    version: 1, quality: "complete", source: { providerId: "gam", catalogSha256: "a".repeat(64) },
    totals: { ready: 2, review: 0 }, fingerprints: { rulesVersion: 1 }
  }));
  write("data/history/summary.json", JSON.stringify({
    startedAt: "2026-01-01", endedAt: "2026-01-01", totals: { scrapedProducts: 2 },
    artifacts: { catalogSha256: "a".repeat(64) }
  }));
  write("data/history/accreditation.json", JSON.stringify({
    runId: "historical", approved: true, sources: [{ providerId: "gam", catalogSha256: "a".repeat(64) }]
  }));
  const matching = inspectCatalogReplicas(root).findings.filter((finding) => finding.startsWith("R-ARTEFACTO-CATALOGO"));
  assert.equal(matching.length, 3);
});

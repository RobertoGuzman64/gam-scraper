import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { parseCanonicalCatalog } from "../../catalog/canonical-catalog.js";
import { buildProductIdentity } from "../../catalog/identity.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import { writeCanonicalCatalog } from "../../infrastructure/filesystem/canonical-catalog.js";
import { readInterventionSource } from "../../infrastructure/filesystem/intervention-source.js";
import type { ManualInterventionProposal } from "../contracts.js";
import { simulateIntervention } from "../simulation.js";
import { formatInterventionSimulation } from "../../cli/intervene.js";
import { parseInterveneOptions } from "../../cli/options/intervene.js";

const item: ProductRecord = {
  providerId: "gam", categoryKey: "maquinas", categoryName: "Máquinas",
  url: "https://proveedor.example/m-1", title: "Producto original", shortDescription: "Texto anterior",
  longDescription: null, price: null, reference: "M-1", brand: null, model: null,
  year: null, location: null, country: null, horometer: null, serialNumber: null,
  image: "https://proveedor.example/a.jpg", images: ["https://proveedor.example/a.jpg"]
};
const identity = buildProductIdentity(item).key;
const base: ManualInterventionProposal = {
  providerId: "gam", identity, field: "shortDescription", expected: "Texto anterior",
  next: "Texto revisado", reason: "Dato puntual contrastado", evidence: "Ficha vigente comprobada"
};
const second: ManualInterventionProposal = {
  ...base, field: "longDescription", expected: null, next: "Detalle contrastado"
};
const catalog = parseCanonicalCatalog({
  version: 1, providerId: "gam", prefix: "gam-simulation", scope: "0123456789abcdef",
  startedAt: "2026-10-25T10:00:00.000Z", endedAt: "2026-10-25T10:02:00.000Z",
  quality: { status: "complete", published: true }, productCount: 1, products: [item]
});
const sourceHash = createHash("sha256").update("origen de prueba").digest("hex");

const makeSource = async (): Promise<{ file: string; dir: string; cleanup: () => void }> => {
  const dir = mkdtempSync(join(tmpdir(), "intervention-simulation-catalog-"));
  const prefix = "gam-simulation";
  const file = join(dir, `${prefix}-catalog.json`);
  const catalogSha256 = await writeCanonicalCatalog(
    dir, prefix, catalog.scope, catalog.startedAt, catalog.endedAt, catalog.products
  );
  writeFileSync(join(dir, `${prefix}-summary.json`), JSON.stringify({
    quality: { status: "complete", published: true },
    totals: { scrapedProducts: catalog.productCount },
    startedAt: catalog.startedAt, endedAt: catalog.endedAt,
    artifacts: { catalogSha256 }
  }));
  return { file, dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
};

const makeScript = (providerId = "gam", productIdentity = identity): { path: string; cleanup: () => void } => {
  mkdirSync(join("storage", "interventions"), { recursive: true });
  const dir = mkdtempSync(join("storage", "interventions", "intervention-simulation-test-"));
  mkdirSync(join(dir, "scripts"));
  const path = join(dir, "scripts", "cambio.ts");
  writeFileSync(path, `import type { ManualInterventionProposal } from "../../../../src/manual-interventions/contracts.js";
export const proposals = [{
  providerId: "${providerId}", identity: "${productIdentity}", field: "shortDescription",
  expected: "Texto anterior", next: "Texto revisado",
  reason: "Dato puntual contrastado", evidence: "Ficha vigente comprobada"
}] satisfies readonly ManualInterventionProposal[];
`);
  return { path, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
};

test("simula antes/después sin mutar el catálogo ni las propuestas", () => {
  const original = JSON.stringify(catalog);
  const initial = JSON.stringify([base, second]);
  const result = simulateIntervention(catalog, sourceHash, [base, second]);
  assert.equal(result.analyzedProducts, 1);
  assert.equal(result.affectedProducts, 1);
  assert.equal(result.changes.length, 2);
  assert.equal(result.changes[0]?.field, "longDescription");
  assert.equal(result.changes[1]?.field, "shortDescription");
  assert.equal(JSON.stringify(catalog), original);
  assert.equal(JSON.stringify([base, second]), initial);
  assert.deepEqual(catalog.products[0]?.images, item.images);
});

test("produce la misma huella para el mismo plan aunque cambie el orden", () => {
  const left = simulateIntervention(catalog, sourceHash, [base, second]);
  const right = simulateIntervention(catalog, sourceHash, [second, base]);
  assert.equal(left.planSha256, right.planSha256);
  assert.notEqual(left.planSha256, simulateIntervention(catalog, sourceHash, [{ ...base, reason: "Otro motivo" }, second]).planSha256);
  assert.notEqual(left.planSha256, simulateIntervention(catalog, createHash("sha256").update("otro origen").digest("hex"), [base, second]).planSha256);
});

test("rechaza identidad ausente, esperado obsoleto y propuestas duplicadas", () => {
  assert.throws(() => simulateIntervention(catalog, sourceHash, [{ ...base, identity: "gam:ref:no-existe" }]), /identidad no encontrada/);
  assert.throws(() => simulateIntervention(catalog, sourceHash, [{ ...base, expected: "Texto antiguo" }]), /valor actual no coincide/);
  assert.throws(() => simulateIntervention(catalog, sourceHash, [base, base]), /duplicada/);
  assert.throws(() => simulateIntervention(catalog, sourceHash, [{ ...base, field: "images" }]), /campo prohibido/);
});

test("valida proveedor y huella de catálogo sin permitir alteración de identidad", () => {
  assert.throws(() => simulateIntervention(catalog, "hash inválido", [base]), /SHA-256/);
  assert.throws(() => simulateIntervention(catalog, sourceHash, [{ ...base, providerId: "gomariz" }]), /proveedor diferente/);
  assert.throws(() => simulateIntervention(catalog, sourceHash, [{ ...base, field: "serialNumber" }]), /campo prohibido/);
});

test("lee el triple canónico acreditado y no escribe ni modifica ningún artefacto", async () => {
  const fixture = await makeSource();
  try {
    const names = readdirSync(fixture.dir).sort();
    const before = names.map((name) => readFileSync(join(fixture.dir, name)));
    const { catalog: readCatalog, catalogSha256 } = await readInterventionSource(fixture.file);
    const result = simulateIntervention(readCatalog, catalogSha256, [base]);
    assert.equal(result.catalogSha256, createHash("sha256").update(readFileSync(fixture.file)).digest("hex"));
    assert.equal(result.affectedProducts, 1);
    assert.deepEqual(readdirSync(fixture.dir).sort(), names);
    for (const [index, name] of names.entries()) assert.deepEqual(readFileSync(join(fixture.dir, name)), before[index]);
  } finally {
    fixture.cleanup();
  }
});

test("rechaza canónicos manipulados y proveedores incorrectos", async () => {
  const fixture = await makeSource();
  try {
    const script = makeScript("gomariz", "gomariz:ref:M-1");
    try {
      const attempt = spawnSync(process.execPath, ["dist/cli/intervene.js", "gomariz", "--script", script.path, "--source", fixture.file], { cwd: process.cwd(), encoding: "utf8", timeout: 20000 });
      assert.notEqual(attempt.status, 0);
      assert.match(attempt.stderr, /El catálogo pertenece a gam, no a gomariz/);
    } finally {
      script.cleanup();
    }
    writeFileSync(fixture.file, readFileSync(fixture.file, "utf8").replace("Producto original", "Producto diferente"));
    await assert.rejects(readInterventionSource(fixture.file), /manifest pertenecen a ejecuciones distintas/);
  } finally {
    fixture.cleanup();
  }
});

test("presenta diferencias acotadas, detalle opt-in y hashes auditables", () => {
  const result = simulateIntervention(catalog, sourceHash, [base, second]);
  const overview = formatInterventionSimulation(result, false);
  assert.match(overview, /SIMULACIÓN/);
  assert.match(overview, /Texto anterior.*Texto revisado/);
  assert.match(overview, /SHA plan: [a-f0-9]{64}/);
  assert.doesNotMatch(overview, /Evidencia:/);
  assert.match(formatInterventionSimulation(result, true), /Evidencia: Ficha vigente comprobada/);
});

test("conserva simulación por defecto y la aplicación exige autorización para aplicar", () => {
  const parsed = parseInterveneOptions(["gam", "--script", "storage/interventions/c/scripts/x.ts", "--source", "a-catalog.json", "--detalle"]);
  assert.equal(parsed.detail, true);
  assert.equal(parsed.providerId, "gam");
  assert.equal(parsed.source, resolve("a-catalog.json"));
  assert.equal(parsed.apply, false);
  assert.throws(() => parseInterveneOptions(["gam", "--script", "uno.ts", "--aplicar", "--source", "a-catalog.json"]), /requiere --campana y --plan/);
  assert.throws(() => parseInterveneOptions(["gam", "--script", "uno.ts"]), /--origen/);
});

test("CLI simula de extremo a extremo sin escribir un resultado", async () => {
  const fixture = await makeSource();
  const script = makeScript();
  try {
    const catalogBefore = readFileSync(fixture.file);
    const scriptBefore = readFileSync(script.path);
    const output = execFileSync(process.execPath, ["dist/cli/intervene.js", "gam", "--script", script.path, "--source", fixture.file], {
      cwd: process.cwd(), encoding: "utf8", timeout: 20000
    });
    assert.match(output, /SIMULACIÓN VÁLIDA/);
    assert.match(output, /Productos afectados: 1/);
    assert.deepEqual(readFileSync(fixture.file), catalogBefore);
    assert.deepEqual(readFileSync(script.path), scriptBefore);
    assert.deepEqual(readdirSync(dirname(script.path)), ["cambio.ts"]);
  } finally {
    script.cleanup();
    fixture.cleanup();
  }
});

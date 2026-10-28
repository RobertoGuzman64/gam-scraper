import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import test from "node:test";
import { parseCanonicalCatalog } from "../../canonical-catalog.js";
import { buildProductIdentity } from "../../identity.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { writeCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { persistAppliedIntervention } from "../../../infrastructure/filesystem/interventions/intervention-application.js";
import { readInterventionSource } from "../../../infrastructure/filesystem/interventions/intervention-source.js";
import { parseInterveneOptions } from "../../../cli/options/intervene.js";
import { applyInterventionToCatalog } from "../application.js";
import type { ManualInterventionProposal } from "../contracts.js";
import { simulateIntervention } from "../simulation.js";

const product: ProductRecord = {
  providerId: "gam", categoryKey: "maquinas", categoryName: "Máquinas",
  url: "https://proveedor.example/m-1", title: "Producto original", shortDescription: "Texto anterior",
  longDescription: null, price: null, reference: "M-1", brand: null, model: null,
  year: null, location: null, country: null, horometer: null, serialNumber: null,
  image: "https://proveedor.example/a.jpg", images: ["https://proveedor.example/a.jpg"]
};
const proposal: ManualInterventionProposal = {
  providerId: "gam", identity: buildProductIdentity(product).key, field: "shortDescription",
  expected: "Texto anterior", next: "Texto revisado", reason: "Corrección puntual contrastada",
  evidence: "Descripción vigente revisada manualmente"
};
const catalog = parseCanonicalCatalog({
  version: 1, providerId: "gam", prefix: "gam-application", scope: "0123456789abcdef",
  startedAt: "2026-10-25T10:00:00.000Z", endedAt: "2026-10-25T10:02:00.000Z",
  quality: { status: "complete", published: true }, productCount: 1, products: [product]
});

const makeFixture = async () => {
  const dir = mkdtempSync(join(tmpdir(), "intervention-application-catalog-"));
  const source = join(dir, "gam-application-catalog.json");
  const sha = await writeCanonicalCatalog(dir, catalog.prefix, catalog.scope, catalog.startedAt, catalog.endedAt, catalog.products);
  writeFileSync(join(dir, "gam-application-summary.json"), JSON.stringify({
    quality: { status: "complete", published: true },
    totals: { scrapedProducts: catalog.productCount },
    startedAt: catalog.startedAt, endedAt: catalog.endedAt,
    artifacts: { catalogSha256: sha }
  }));
  const interventions = join("storage", "interventions");
  mkdirSync(interventions, { recursive: true });
  const campaignDir = mkdtempSync(join(interventions, "intervention-application-test-"));
  mkdirSync(join(campaignDir, "scripts"));
  const script = join(campaignDir, "scripts", "cambio.ts");
  writeFileSync(script, `import type { ManualInterventionProposal } from "../../../../src/catalog/interventions/contracts.js";
export const proposals = [{
  providerId: "gam", identity: "${proposal.identity}", field: "shortDescription",
  expected: "Texto anterior", next: "Texto revisado",
  reason: "Corrección puntual contrastada", evidence: "Descripción vigente revisada manualmente"
}] satisfies readonly ManualInterventionProposal[];
`);
  const campaign = basename(campaignDir);
  const simulation = simulateIntervention((await readInterventionSource(source)).catalog, sha, [proposal]);
  return {
    source, dir, script, campaign, campaignDir, simulation,
    cleanup: () => {
      rmSync(dir, { recursive: true, force: true });
      rmSync(campaignDir, { recursive: true, force: true });
    }
  };
};

const hash = (file: string): string => createHash("sha256").update(readFileSync(file)).digest("hex");

test("crea datos derivados sin modificar imágenes, identidades o el original", () => {
  const simulation = simulateIntervention(catalog, createHash("sha256").update("source").digest("hex"), [proposal]);
  const before = JSON.stringify(catalog);
  const result = applyInterventionToCatalog(catalog, simulation);
  assert.equal(result.products[0]?.shortDescription, "Texto revisado");
  assert.deepEqual(result.products[0]?.images, product.images);
  assert.equal(result.products[0]?.image, product.image);
  assert.equal(buildProductIdentity(result.products[0] ?? product).key, proposal.identity);
  assert.equal(JSON.stringify(catalog), before);
  assert.equal(result.productCount, 1);
  assert.throws(() => applyInterventionToCatalog(catalog, { ...simulation, affectedProducts: 2 }), /identidades/);
});

test("guarda derivado y expediente con SHA y jamás sobrescribe resultados", async () => {
  const fixture = await makeFixture();
  try {
    const original = [fixture.source, join(fixture.dir, "gam-application-catalog.manifest.json"), join(fixture.dir, "gam-application-summary.json")].map(hash);
    const result = await persistAppliedIntervention({
      source: fixture.source, script: fixture.script, campaign: fixture.campaign,
      confirmation: fixture.simulation.planSha256, simulation: fixture.simulation
    });
    assert.equal(result.planSha256, fixture.simulation.planSha256);
    assert.deepEqual(readdirSync(result.path).sort(), ["catalog-derived.json", "intervention-record.json"]);
    const derived = JSON.parse(readFileSync(join(result.path, "catalog-derived.json"), "utf8"));
    const record = JSON.parse(readFileSync(join(result.path, "intervention-record.json"), "utf8"));
    assert.equal(derived.kind, "manual-intervention-derived-catalog");
    assert.equal(derived.catalog.products[0].shortDescription, "Texto revisado");
    assert.deepEqual(derived.catalog.products[0].images, product.images);
    assert.equal(record.sourceCatalogSha256, original[0]);
    assert.equal(record.derivedCatalogSha256, hash(join(result.path, "catalog-derived.json")));
    assert.deepEqual(record.changes, [proposal]);
    assert.equal(record.status, "applied");
    assert.equal(record.campaign, fixture.campaign);
    assert.deepEqual([fixture.source, join(fixture.dir, "gam-application-catalog.manifest.json"), join(fixture.dir, "gam-application-summary.json")].map(hash), original);
    const outputBefore = [hash(join(result.path, "catalog-derived.json")), hash(join(result.path, "intervention-record.json"))];
    await assert.rejects(persistAppliedIntervention({
      source: fixture.source, script: fixture.script, campaign: fixture.campaign,
      confirmation: fixture.simulation.planSha256, simulation: fixture.simulation
    }), /Ya existe/);
    assert.deepEqual([hash(join(result.path, "catalog-derived.json")), hash(join(result.path, "intervention-record.json"))], outputBefore);
    assert.deepEqual(readdirSync(dirname(result.path)), [fixture.simulation.planSha256]);
  } finally {
    fixture.cleanup();
  }
});

test("rechaza confirmación errónea, plan alterado, origen cambiado y campaña distinta", async () => {
  const fixture = await makeFixture();
  const base = { source: fixture.source, script: fixture.script, campaign: fixture.campaign, simulation: fixture.simulation };
  try {
    await assert.rejects(persistAppliedIntervention({ ...base, confirmation: "a".repeat(64) }), /SHA del plan/);
    await assert.rejects(persistAppliedIntervention({
      ...base, confirmation: fixture.simulation.planSha256,
      simulation: { ...fixture.simulation, changes: [{ ...proposal, next: "Otra cosa" }] }
    }), /plan no coincide/);
    await assert.rejects(persistAppliedIntervention({ ...base, confirmation: fixture.simulation.planSha256, campaign: "otra-campana" }), /ENOENT|campaña/);
    assert.equal(readdirSync(fixture.campaignDir).join(","), "scripts");
    writeFileSync(fixture.source, readFileSync(fixture.source, "utf8") + " ");
    await assert.rejects(persistAppliedIntervention({ ...base, confirmation: fixture.simulation.planSha256 }), /catálogo|manifest|publicación/i);
    assert.equal(readdirSync(fixture.campaignDir).join(","), "scripts");
  } finally {
    fixture.cleanup();
  }
});

test("CLI exige SHA completo, campaña y aplicación separada de simulación", () => {
  const args = ["gam", "--script", "uno.ts", "--source", "gam-catalog.json"];
  assert.equal(parseInterveneOptions(args).apply, false);
  assert.throws(() => parseInterveneOptions([...args, "--aplicar"]), /requiere --campana y --plan/);
  assert.throws(() => parseInterveneOptions([...args, "--aplicar", "--campana", "manual-application", "--plan", "abc"]), /SHA-256 completo/);
  assert.throws(() => parseInterveneOptions([...args, "--aplicar", "--campana", "manual-application", "--plan", "a".repeat(64), "--dry-run"]), /combinar/);
  assert.throws(() => parseInterveneOptions([...args, "--campana", ".."]), /campaña inválido/);
  assert.throws(() => parseInterveneOptions([...args, "--plan", "a".repeat(64)]), /solo se admite/);
  assert.equal(parseInterveneOptions([...args, "--campana", "manual-application", "--aplicar", "--plan", "a".repeat(64)]).apply, true);
});

test("CLI simula y aplica manualmente con el SHA exacto, sin publicar", async () => {
  const fixture = await makeFixture();
  try {
    const args = ["dist/cli/commands/interventions/intervene.js", "gam", "--script", fixture.script, "--source", fixture.source];
    const simulated = execFileSync(process.execPath, args, { cwd: process.cwd(), encoding: "utf8", timeout: 20000 });
    assert.match(simulated, /SIMULACIÓN VÁLIDA/);
    assert.match(simulated, new RegExp(fixture.simulation.planSha256));
    const applied = execFileSync(process.execPath, [...args, "--campana", fixture.campaign, "--aplicar", "--plan", fixture.simulation.planSha256], {
      cwd: process.cwd(), encoding: "utf8", timeout: 20000
    });
    assert.match(applied, /APLICADA/);
    assert.match(applied, /Salida derivada, no publicable aún/);
    const second = spawnSync(process.execPath, [...args, "--campana", fixture.campaign, "--aplicar", "--plan", fixture.simulation.planSha256], {
      cwd: process.cwd(), encoding: "utf8", timeout: 20000
    });
    assert.notEqual(second.status, 0);
    assert.match(second.stderr, /Ya existe/);
  } finally {
    fixture.cleanup();
  }
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import test from "node:test";
import { buildProductIdentity } from "../../catalog/identity.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import { writeCanonicalCatalog } from "../../infrastructure/filesystem/canonical-catalog.js";
import { readInterventionSource } from "../../infrastructure/filesystem/intervention-source.js";
import { parseInterveneOptions } from "../../cli/options/intervene.js";
import { validateInterventionProposals } from "../proposals.js";
import { loadInterventionScript } from "../script-loader.js";
import { simulateIntervention } from "../simulation.js";
import type { ManualInterventionProposal } from "../contracts.js";

const product: ProductRecord = {
  providerId: "gam", categoryKey: "industrial", categoryName: "Industrial",
  url: "https://proveedor.example/maquina", title: "Equipo original",
  shortDescription: "Descripción original", longDescription: null, price: null,
  reference: "P-1", brand: "Marca previa", model: "Modelo anterior", year: null,
  location: null, country: null, horometer: null, serialNumber: "SER-1",
  image: "https://proveedor.example/imagen-actual.jpg", images: ["https://proveedor.example/imagen-actual.jpg"],
  specs: { "Capacidad de carga": 3000 }
};
const sha = (value: string): string => createHash("sha256").update(value).digest("hex");
const makeProposal = (field: ManualInterventionProposal["field"], expected: ManualInterventionProposal["expected"], next: ManualInterventionProposal["next"]): ManualInterventionProposal => ({
  providerId: "gam", identity: buildProductIdentity(product).key, field, expected, next,
  reason: "Corrección puntual contrastada", evidence: "Ficha de la máquina revisada manualmente"
});

const fixture = async () => {
  const dir = await mkdtemp(join(process.cwd(), "storage", "interventions", "multiple-scripts-test-"));
  const campaign = basename(dir);
  const scripts = join(dir, "scripts");
  const originalDir = join(dir, "original");
  await mkdir(scripts);
  await mkdir(originalDir);
  const prefix = "gam-multiple-scripts";
  const startedAt = "2026-10-25T10:00:00.000Z";
  const endedAt = "2026-10-25T10:02:00.000Z";
  const hash = await writeCanonicalCatalog(originalDir, prefix, "0123456789abcdef", startedAt, endedAt, [product]);
  const source = join(originalDir, `${prefix}-catalog.json`);
  await writeFile(join(originalDir, `${prefix}-summary.json`), JSON.stringify({
    quality: { status: "complete", published: true }, totals: { scrapedProducts: 1 },
    startedAt, endedAt, artifacts: { catalogSha256: hash }
  }));
  const first = join(scripts, "marca.ts");
  const second = join(scripts, "capacidad.ts");
  const firstProposal = makeProposal("brand", "Marca previa", "Marca revisada");
  const secondProposal = makeProposal("spec:Capacidad de carga", 3000, 4800);
  await writeFile(first, `export const proposals = ${JSON.stringify([firstProposal])};`);
  await writeFile(second, `export const proposals = ${JSON.stringify([secondProposal])};`);
  return { dir, campaign, source, first, second, firstProposal, secondProposal, cleanup: () => rm(dir, { recursive: true, force: true }) };
};

test("compone propuestas de scripts distintos y mantiene el SHA independientemente del orden", async () => {
  await mkdir(join("storage", "interventions"), { recursive: true });
  const data = await fixture();
  try {
    const source = await readInterventionSource(data.source);
    const a = await loadInterventionScript(data.first, "gam");
    const b = await loadInterventionScript(data.second, "gam");
    const forward = simulateIntervention(source.catalog, source.catalogSha256, [...a, ...b]);
    const backward = simulateIntervention(source.catalog, source.catalogSha256, [...b, ...a]);
    assert.equal(forward.planSha256, backward.planSha256);
    assert.equal(forward.affectedProducts, 1);
    assert.equal(forward.changes.length, 2);
    assert.throws(() => validateInterventionProposals([...a, ...a], "gam"), /duplicada/);
  } finally { await data.cleanup(); }
});

test("aplica varios archivos juntos sin sobrescribir originales y bloquea conflictos", async () => {
  await mkdir(join("storage", "interventions"), { recursive: true });
  const data = await fixture();
  try {
    const sourceBytes = await readFile(data.source);
    const args = ["dist/cli/intervene.js", "gam", "--script", data.first, "--script", data.second, "--source", data.source];
    const simulation = execFileSync(process.execPath, args, { encoding: "utf8", timeout: 30000 });
    const match = simulation.match(/SHA plan: ([a-f0-9]{64})/);
    assert.ok(match);
    const applied = execFileSync(process.execPath, [...args, "--campana", data.campaign, "--aplicar", "--plan", match[1]!], {
      encoding: "utf8", timeout: 30000
    });
    assert.match(applied, /APLICADA/);
    const derived = JSON.parse(await readFile(join(data.dir, "results", match[1]!, "catalog-derived.json"), "utf8"));
    assert.equal(derived.catalog.products[0].brand, "Marca revisada");
    assert.equal(derived.catalog.products[0].specs["Capacidad de carga"], 4800);
    assert.deepEqual(derived.catalog.products[0].images, product.images);
    assert.equal(sha((await readFile(data.source)).toString("utf8")), sha(sourceBytes.toString("utf8")));
    const conflict = spawnSync(process.execPath, [...args, "--script", data.first], { encoding: "utf8", timeout: 30000 });
    assert.notEqual(conflict.status, 0);
    assert.match(conflict.stderr, /repetido/);
    const replay = spawnSync(process.execPath, [...args, "--campana", data.campaign, "--aplicar", "--plan", match[1]!], {
      encoding: "utf8", timeout: 30000
    });
    assert.notEqual(replay.status, 0);
    assert.match(replay.stderr, /Ya existe/);
  } finally { await data.cleanup(); }
});

test("el parser admite varios scripts pero rechaza rutas y confirmaciones incompletas", () => {
  const opts = parseInterveneOptions(["gam", "--script", "uno.ts", "--script", "dos.ts", "--source", "gam-catalog.json"]);
  assert.deepEqual(opts.scripts, ["uno.ts", "dos.ts"]);
  assert.throws(() => parseInterveneOptions(["gam", "--script", "uno.ts", "--script", "uno.ts", "--source", "gam-catalog.json"]), /repetido/);
  assert.throws(() => parseInterveneOptions(["gam", "--script", "uno.ts", "--source", "gam-catalog.json", "--aplicar"]), /requiere/);
});

test("rechaza cambios sin evidencia, atributos nuevos e imágenes", async () => {
  await mkdir(join("storage", "interventions"), { recursive: true });
  const data = await fixture();
  try {
    const source = await readInterventionSource(data.source);
    assert.throws(() => validateInterventionProposals([{ ...data.firstProposal, evidence: "" }], "gam"), /evidence/);
    assert.throws(() => validateInterventionProposals([{ ...data.firstProposal, field: "images" }], "gam"), /campo prohibido/);
    assert.throws(() => validateInterventionProposals([{ ...data.firstProposal, field: "serialNumber" }], "gam"), /campo prohibido/);
    assert.throws(() => simulateIntervention(source.catalog, source.catalogSha256, [makeProposal("spec:Otro", 3000, 4800)]), /valor actual no coincide/);
  } finally { await data.cleanup(); }
});

test("no compone scripts de campañas diferentes", async () => {
  await mkdir(join("storage", "interventions"), { recursive: true });
  const first = await fixture();
  const second = await fixture();
  try {
    const result = spawnSync(process.execPath, [
      "dist/cli/intervene.js", "gam", "--script", first.first,
      "--script", second.second, "--source", first.source
    ], { encoding: "utf8", timeout: 30000 });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /misma campaña/);
  } finally { await first.cleanup(); await second.cleanup(); }
});

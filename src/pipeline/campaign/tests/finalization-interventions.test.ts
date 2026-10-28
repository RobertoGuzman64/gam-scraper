import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { buildProductIdentity } from "../../../catalog/identity.js";
import { readOfflinePreparation } from "../../../infrastructure/filesystem/preparation/offline-preparation.js";
import { reviewActiveCampaign } from "../review.js";
import { interveneActiveCampaign } from "../intervention.js";
import { finalizeActiveCampaign } from "../finalization.js";
import { reuseCampaignTestFixture } from "./campaign-catalog-fixture.js";
import { approveDraft, campaignScript, createFixture, prefixes } from "./finalization-fixture.js";

const fixtureCache = reuseCampaignTestFixture(createFixture);
const fixture = fixtureCache.fixture;
after(fixtureCache.close);

test("rechaza un script de otra campaña y requiere autorización explícita para aplicar", async () => {
  const data = await fixture();
  try {
    const script = await campaignScript(data.root, data.runId);
    const preview = await interveneActiveCampaign(data.root, "gam", [script], false);
    assert.equal(preview.applied, false);
    assert.ok(preview.simulation);
    assert.equal(preview.simulation.changes.length, 1);
    const oldDir = join(data.root, "storage", "interventions", "otro-lote", "scripts");
    await mkdir(oldDir, { recursive: true });
    const old = join(oldDir, "correccion.ts");
    await copyFile(script, old);
    await assert.rejects(interveneActiveCampaign(data.root, "gam", [old], true), /no pertenece al lote actual/);
    const original = data.providers.find((item) => item.providerId === "gam");
    assert.ok(original);
    const originalFile = join(original.outputDir, `${original.outputPrefix}-catalog.json`);
    const before = await readFile(originalFile);
    const applied = await interveneActiveCampaign(data.root, "gam", [script], true);
    assert.equal(applied.applied, true);
    assert.ok(applied.derivedFile);
    assert.ok(applied.preparationFile);
    assert.deepEqual(await readFile(originalFile), before);
    assert.ok((await readOfflinePreparation(applied.preparationFile, "gam")).source.intervention);
    const reviewed = await reviewActiveCampaign(data.root);
    assert.equal(reviewed.complete, true, JSON.stringify(reviewed));
    assert.equal(reviewed.providers.find((item) => item.providerId === "gam")?.preparationFile, applied.preparationFile);
    await assert.rejects(interveneActiveCampaign(data.root, "gam", [script], true), /ya tiene un origen libre|no tiene un origen libre/);
  } finally { await data.cleanup(); }
});

test("utiliza un script permanente directamente y mantiene el expediente del lote", async () => {
  const data = await fixture();
  try {
    const temporal = await campaignScript(data.root, data.runId);
    const folder = join(data.root, "interventions", "gam");
    await mkdir(folder, { recursive: true });
    const permanent = join(folder, "correccion.ts");
    const source = await readFile(temporal, "utf8");
    await writeFile(permanent, `export const metadata = { id: "gam-correccion", summary: "Corrección puntual acreditada" };\n${source}`);
    const preview = await interveneActiveCampaign(data.root, "gam", [permanent], false);
    assert.equal(preview.applied, false);
    assert.ok(preview.simulation);
    assert.equal(preview.simulation.changes.length, 1);
    const applied = await interveneActiveCampaign(data.root, "gam", [permanent], true);
    assert.equal(applied.applied, true);
    assert.ok(applied.derivedFile);
    const record = JSON.parse(await readFile(join(dirname(applied.derivedFile), "intervention-record.json"), "utf8"));
    assert.equal(record.campaign, data.runId);
    assert.deepEqual(record.scripts, ["correccion.ts"]);
    assert.equal(record.version, 2);
    assert.equal(record.scriptVersions.length, 1);
    assert.equal(record.scriptVersions[0].id, "gam-correccion");
    assert.match(record.scriptVersions[0].sha256, /^[a-f0-9]{64}$/);
    assert.equal((await finalizeActiveCampaign(data.root, false)).status, "draft");
  } finally { await data.cleanup(); }
});

test("compone intervenciones versionadas en una campaña nueva sin duplicar las corregidas ni ausentes", async () => {
  const data = await fixture();
  try {
    const temporal = await campaignScript(data.root, data.runId);
    const original = await readFile(temporal, "utf8");
    const catalogFile = join(data.root, "storage", "scraped", "campaigns", data.runId, "gam", `${prefixes.gam}-catalog.json`);
    const catalog = await readCanonicalCatalog(catalogFile);
    const second = catalog.products.find((product) => product.title !== null &&
      buildProductIdentity(product).key !== JSON.parse(original.slice(original.indexOf("["), original.lastIndexOf("]") + 1))[0]?.identity);
    assert.ok(second?.title);
    const folder = join(data.root, "interventions", "gam");
    await mkdir(folder, { recursive: true });
    const scripts = ["pendiente.ts", "corregida.ts", "ausente.ts"].map((name) => join(folder, name));
    await writeFile(scripts[0]!, `export const metadata = { id: "gam-pendiente", summary: "Corrección pendiente" };\n${original}`);
    const asScript = (id: string, entry: object) => `export const metadata = { id: "${id}", summary: "Corrección conocida" };\nexport const proposals = ${JSON.stringify([entry])};`;
    const corrected = {
      providerId: "gam", identity: buildProductIdentity(second).key, field: "title", expected: "Otro título incorrecto",
      next: second.title, reason: "Resuelto en origen", evidence: "Ficha vigente contrastada"
    };
    const absent = { ...corrected, identity: "gam:ref:inexistente", expected: "Título anterior", next: "Título nuevo" };
    await writeFile(scripts[1]!, asScript("gam-corregida", corrected));
    await writeFile(scripts[2]!, asScript("gam-ausente", absent));
    const before = await readFile(catalogFile);
    const preview = await interveneActiveCampaign(data.root, "gam", scripts, false);
    assert.deepEqual(preview.comparison.scripts.map((item) => item.status), ["pending", "corrected", "absent"]);
    assert.equal(preview.simulation?.changes.length, 1);
    const applied = await interveneActiveCampaign(data.root, "gam", scripts, true);
    assert.ok(applied.derivedFile);
    const record = JSON.parse(await readFile(join(dirname(applied.derivedFile), "intervention-record.json"), "utf8"));
    assert.equal(record.version, 2);
    assert.equal(record.scriptVersions.length, 3);
    assert.equal(record.changes.length, 1);
    assert.deepEqual(record.scripts, ["ausente.ts", "corregida.ts", "pendiente.ts"]);
    assert.deepEqual(await readFile(catalogFile), before);
  } finally { await data.cleanup(); }
});

test("bloquea divergencias y alteraciones de scripts permanentes antes de generar resultados", async () => {
  const data = await fixture();
  try {
    const temporal = await campaignScript(data.root, data.runId);
    const original = await readFile(temporal, "utf8");
    const folder = join(data.root, "interventions", "gam");
    await mkdir(folder, { recursive: true });
    const permanent = join(folder, "correccion.ts");
    await writeFile(permanent, `export const metadata = { id: "gam-correccion", summary: "Cambio de ficha" };\n${original}`);
    let comparison = "";
    await assert.rejects(interveneActiveCampaign(data.root, "gam", [permanent], true, () => {
      writeFileSync(permanent, `export const metadata = { id: "gam-correccion", summary: "Cambio alterado" };\n${original}`);
    }), /cambió desde la simulación/);
    const parsed = JSON.parse(original.slice(original.indexOf("["), original.lastIndexOf("]") + 1));
    parsed[0].expected = "Valor incorrecto";
    parsed[0].next = "Valor arbitrario";
    await writeFile(permanent, `export const metadata = { id: "gam-correccion", summary: "Cambio divergente" };\nexport const proposals = ${JSON.stringify(parsed)};`);
    await assert.rejects(interveneActiveCampaign(data.root, "gam", [permanent], true, (_sim, state) => {
      comparison = state.scripts[0]?.status ?? "";
    }), /divergentes/);
    assert.equal(comparison, "divergent");
    const result = join(data.root, "storage", "interventions", data.runId, "results");
    await assert.rejects(readFile(join(result, "intervention-record.json")), /ENOENT/);
  } finally { await data.cleanup(); }
});

test("no reutiliza un borrador anterior después de una intervención", async () => {
  const data = await fixture();
  try {
    const initial = await finalizeActiveCampaign(data.root, false);
    await approveDraft(initial.draftFile);
    const script = await campaignScript(data.root, data.runId);
    await interveneActiveCampaign(data.root, "gam", [script], true);
    const updated = await finalizeActiveCampaign(data.root, false);
    assert.equal(updated.status, "draft");
    assert.notEqual(updated.draftFile, initial.draftFile);
    const old = JSON.parse(await readFile(initial.draftFile, "utf8"));
    assert.equal(old.approved, true);
    assert.equal((await finalizeActiveCampaign(data.root, false)).status, "pending");
    await approveDraft(updated.draftFile);
    const selected = await finalizeActiveCampaign(data.root, false);
    assert.equal(selected.status, "selected");
    assert.equal(selected.selection?.source.find((item) => item.providerId === "gam")?.intervention?.campaign, data.runId);
  } finally { await data.cleanup(); }
});

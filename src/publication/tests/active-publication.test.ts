import { accreditedPublicationDirectory, accreditedPublicationSha } from "../../testing/builders/accredited-publication-fixture.js";
import { isCandidate } from "../../preparation/preparation-document.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { discoverAccreditedPublications, readAccreditedPublication, resolveAccreditedPublication } from "../../infrastructure/filesystem/catalog/accredited-publication.js";
import { selectActivePublication } from "../active-publication.js";
import type { ImportCandidate } from "../../commercial/legacy-export/contracts.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const providerId = "gomariz";
const existingSha = accreditedPublicationSha(root, "gomariz");
const hash = (text: string): string => createHash("sha256").update(text).digest("hex");
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const setup = async (): Promise<{ root: string; publications: string; original: string; other: string }> => {
  const temp = await mkdtemp(join(tmpdir(), "catalogo-activo-"));
  const publications = join(temp, "catalogs", "providers", providerId, "publications");
  const original = join(publications, existingSha);
  await mkdir(publications, { recursive: true });
  await cp(await accreditedPublicationDirectory(root, providerId), original, { recursive: true });
  const approval = JSON.parse(await readFile(join(original, "accreditation.json"), "utf8")) as Record<string, unknown>;
  const nextApproval = JSON.stringify({ ...approval, edition: "nueva versión acreditada" }, null, 2);
  const nextSha = hash(nextApproval);
  const next = join(publications, nextSha);
  await cp(original, next, { recursive: true });
  const productFile = `${providerId}-publishable.json`;
  const products = JSON.parse(await readFile(join(next, productFile), "utf8")) as Record<string, unknown>[];
  const first = products[0];
  assert.ok(first);
  products[0] = { ...first, description: "Descripción revisada y acreditada" };
  const changedProducts = JSON.stringify(products, null, 2);
  const manifest = JSON.parse(await readFile(join(next, "manifest.json"), "utf8")) as Record<string, unknown>;
  const files = manifest.files as Record<string, string>;
  await writeFile(join(next, productFile), changedProducts);
  await writeFile(join(next, "accreditation.json"), nextApproval);
  await writeFile(join(next, "manifest.json"), JSON.stringify({
    ...manifest, approvalSha256: nextSha, files: { ...files, [productFile]: hash(changedProducts), "accreditation.json": nextSha }
  }, null, 2));
  return { root: temp, publications, original, other: nextSha };
};

test("selección explícita, simulación, idempotencia y cambio sin pérdidas", async () => {
  const ctx = await setup();
  try {
    await assert.rejects(discoverAccreditedPublications(ctx.root), /Varias publicaciones/);
    const before = await readFile(join(ctx.original, `${providerId}-publishable.json`), "utf8");
    const simulation = await selectActivePublication(ctx.root, providerId, ctx.other);
    assert.equal(simulation.status, "simulation");
    assert.equal(simulation.difference.previous, null);
    assert.equal(simulation.difference.candidateProducts, (await readAccreditedPublication(join(ctx.publications, ctx.other, `${providerId}-publishable.json`))).products.length);
    await assert.rejects(lstat(join(ctx.publications, "active.json")), /ENOENT/);
    const activated = await selectActivePublication(ctx.root, providerId, ctx.other, true);
    assert.equal(activated.status, "activated");
    const current = await resolveAccreditedPublication(ctx.root, providerId);
    assert.equal(current, join(ctx.publications, ctx.other, `${providerId}-publishable.json`));
    const old = await selectActivePublication(ctx.root, providerId, existingSha);
    assert.equal(old.difference.modified.length, 1);
    assert.equal(old.difference.added.length, 0);
    assert.equal(old.difference.removed.length, 0);
    assert.equal((await selectActivePublication(ctx.root, providerId, ctx.other, true)).status, "unchanged");
    assert.equal((await selectActivePublication(ctx.root, providerId, existingSha, true)).status, "activated");
    assert.equal(await resolveAccreditedPublication(ctx.root, providerId),
      join(ctx.original, `${providerId}-publishable.json`));
    assert.equal(await readFile(join(ctx.original, `${providerId}-publishable.json`), "utf8"), before);
  } finally { await rm(ctx.root, { recursive: true, force: true }); }
});

test("índice y acreditaciones corruptos no permiten seleccionar una publicación", async () => {
  const ctx = await setup();
  try {
    const index = join(ctx.publications, "active.json");
    await writeFile(index, JSON.stringify({ version: 1, providerId, approvalSha256: "../../other" }));
    await assert.rejects(discoverAccreditedPublications(ctx.root), /selección vigente inválida/);
    await writeFile(index, JSON.stringify({ version: 1, providerId, approvalSha256: "f".repeat(64) }));
    await assert.rejects(discoverAccreditedPublications(ctx.root), /versión seleccionada no existe/);
    await rm(index);
    await symlink(join(ctx.original, "manifest.json"), index);
    await assert.rejects(discoverAccreditedPublications(ctx.root), /archivo regular/);
    await rm(index);
    await writeFile(join(ctx.publications, ctx.other, "accreditation.json"), "{}");
    await assert.rejects(selectActivePublication(ctx.root, providerId, ctx.other, true), /huella de la aprobación/);
    await assert.rejects(lstat(index), /ENOENT/);
  } finally { await rm(ctx.root, { recursive: true, force: true }); }
});

test("una publicación legada mantiene compatibilidad y puede fijarse sin mutar su JSON", async () => {
  const ctx = await setup();
  try {
    await rm(join(ctx.publications, ctx.other), { recursive: true, force: true });
    assert.equal((await discoverAccreditedPublications(ctx.root)).length, 1);
    assert.equal((await selectActivePublication(ctx.root, providerId, existingSha, true)).status, "activated");
    const active = JSON.parse(await readFile(join(ctx.publications, "active.json"), "utf8")) as Record<string, unknown>;
    assert.deepEqual(active, { version: 1, providerId, approvalSha256: existingSha });
    assert.equal((await selectActivePublication(ctx.root, providerId, existingSha, true)).status, "unchanged");
  } finally { await rm(ctx.root, { recursive: true, force: true }); }
});

test("la simulación revela pérdidas de contenido y rechaza activaciones concurrentes", async () => {
  const ctx = await setup();
  try {
    await selectActivePublication(ctx.root, providerId, existingSha, true);
    const next = join(ctx.publications, ctx.other);
    const path = join(next, `${providerId}-publishable.json`);
    const products = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>[];
    const first = products[0];
    assert.ok(first);
    assert.ok(typeof first.description_general === "string" && first.description_general.length > 0);
    const firstSpec = first.spec;
    assert.ok(typeof firstSpec === "object" && firstSpec !== null);
    products[0] = { ...first, description_general: null, spec: {} };
    const content = JSON.stringify(products, null, 2);
    const manifestPath = join(next, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    const files = manifest.files as Record<string, string>;
    await writeFile(path, content);
    await writeFile(manifestPath, JSON.stringify({ ...manifest, files: { ...files, [`${providerId}-publishable.json`]: hash(content) } }, null, 2));
    const preview = await selectActivePublication(ctx.root, providerId, ctx.other);
    assert.ok(preview.difference.lostDescriptions.some((id) => id.endsWith(":description_general")));
    assert.ok(preview.difference.removedSpecifications.length > 0);
    assert.equal(preview.status, "simulation");
    const lock = join(ctx.publications, ".active.lock");
    await writeFile(lock, "concurrente", { flag: "wx" });
    await assert.rejects(selectActivePublication(ctx.root, providerId, ctx.other, true), /Otra selección/);
    assert.equal((await resolveAccreditedPublication(ctx.root, providerId))?.includes(existingSha), true);
  } finally { await rm(ctx.root, { recursive: true, force: true }); }
});


test("valores técnicos vaciados o procedencias cambiadas bloquean la selección sin alterar la vigente", async () => {
  const ctx = await setup();
  try {
    await selectActivePublication(ctx.root, providerId, existingSha, true);
    const path = join(ctx.publications, ctx.other, `${providerId}-publishable.json`);
    const products = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>[];
    const first = products[0];
    assert.ok(first);
    const specs = first.spec;
    assert.ok(specs && typeof specs === "object" && !Array.isArray(specs));
    const spec = specs as Record<string, unknown>;
    const key = Object.keys(spec)[0];
    assert.ok(key);
    products[0] = { ...first, sourceUrl: "https://example.test/producto-nuevo", spec: { ...spec, [key]: "" } };
    const changed = JSON.stringify(products, null, 2);
    const manifestPath = join(ctx.publications, ctx.other, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    const files = manifest.files as Record<string, string>;
    await writeFile(path, changed);
    await writeFile(manifestPath, JSON.stringify({
      ...manifest, files: { ...files, [`${providerId}-publishable.json`]: hash(changed) }
    }, null, 2));
    const preview = await selectActivePublication(ctx.root, providerId, ctx.other);
    assert.equal(preview.acceptance.accepted, false);
    assert.ok(preview.difference.lostSpecificationValues.some((entry) => entry.endsWith(`:${key}`)));
    assert.deepEqual(preview.difference.changedSources, [`ref:${String(first.reference).toLowerCase()}`]);
    await assert.rejects(selectActivePublication(ctx.root, providerId, ctx.other, true), /Valores técnicos vaciados/);
    assert.equal(await resolveAccreditedPublication(ctx.root, providerId),
      join(ctx.publications, existingSha, `${providerId}-publishable.json`));
  } finally { await rm(ctx.root, { recursive: true, force: true }); }
});


test("GAM simula cinco exclusiones aprobadas y treinta horómetros no cuantitativos sin admitir pérdidas ajenas", async () => {
  const temp = await mkdtemp(join(tmpdir(), "finish-gam-compatibilidad-"));
  try {
    const provider = "gam";
    const historical = await accreditedPublicationDirectory(root, provider);
    const historicalSha = accreditedPublicationSha(root, provider);
    const publications = join(temp, "catalogs", "providers", provider, "publications");
    await mkdir(publications, { recursive: true });
    const oldDir = join(publications, historicalSha);
    await cp(historical, oldDir, { recursive: true });
    const publishedFile = `${provider}-publishable.json`;
    const rawAccredited = await readFile(join(oldDir, publishedFile), "utf8");
    const parsed: unknown = JSON.parse(rawAccredited);
    assert.ok(Array.isArray(parsed) && parsed.every(isCandidate));
    const accredited: readonly ImportCandidate[] = parsed;
    const candidates = accredited.filter((product) => product.reference && product.sourceUrl.startsWith("https://"));
    assert.ok(candidates.length >= 35);
    const references = new Set(candidates.slice(0, 5).map((product) => product.reference));
    const hourReferences = new Set(candidates.slice(5, 35).map((product) => product.reference));
    const original = accredited.map((product) => hourReferences.has(product.reference)
      ? { ...product, spec: { ...product.spec, "Horómetro": "NA horas" } }
      : product);
    const rawOriginal = JSON.stringify(original, null, 2);
    const baselineManifestPath = join(oldDir, "manifest.json");
    const baselineManifest: unknown = JSON.parse(await readFile(baselineManifestPath, "utf8"));
    assert.ok(isRecord(baselineManifest) && isRecord(baselineManifest.files));
    await writeFile(join(oldDir, publishedFile), rawOriginal);
    await writeFile(baselineManifestPath, JSON.stringify({
      ...baselineManifest, files: { ...baselineManifest.files, [publishedFile]: hash(rawOriginal) }
    }, null, 2));
    const revised = original.filter((product) => !references.has(product.reference)).map((product) => {
      if (!hourReferences.has(product.reference)) return product;
      const { ["Horómetro"]: reading, ...spec } = product.spec;
      assert.ok(typeof reading === "string" && /^na(?:\s+[a-z]\d{8,20})?\s+horas$/iu.test(reading));
      return { ...product, spec };
    });
    assert.equal(original.length - revised.length, 5);
    const rawApproval = await readFile(join(oldDir, "accreditation.json"), "utf8");
    const approval: unknown = JSON.parse(rawApproval);
    assert.ok(isRecord(approval) && Array.isArray(approval.exclusions));
    const newlyExcluded = original.filter((product) => references.has(product.reference)).map((product) => ({
      providerId: provider, reference: product.reference, sourceUrl: product.sourceUrl, status: "review",
      issues: ["Incidencia editorial del escenario de prueba"], decision: "excluir",
      reason: "Exclusión individual autorizada en el escenario de prueba",
      evidenceUrls: [product.sourceUrl]
    }));
    assert.equal(newlyExcluded.length, 5);
    const approvalText = JSON.stringify({ ...approval, exclusions: [...approval.exclusions, ...newlyExcluded] }, null, 2);
    const newSha = hash(approvalText);
    const destination = join(publications, newSha);
    await cp(oldDir, destination, { recursive: true });
    const publishedText = JSON.stringify(revised, null, 2);
    const manifest: unknown = JSON.parse(await readFile(join(oldDir, "manifest.json"), "utf8"));
    assert.ok(isRecord(manifest) && isRecord(manifest.files) && isRecord(manifest.totals));
    await writeFile(join(destination, publishedFile), publishedText);
    await writeFile(join(destination, "accreditation.json"), approvalText);
    await writeFile(join(destination, "manifest.json"), JSON.stringify({
      ...manifest, approvalSha256: newSha,
      totals: { ...manifest.totals, publishable: revised.length, excluded: original.length - revised.length + 5 },
      files: { ...manifest.files, [publishedFile]: hash(publishedText), "accreditation.json": newSha }
    }, null, 2));
    assert.equal((await selectActivePublication(temp, provider, historicalSha, true)).status, "activated");
    const simulation = await selectActivePublication(temp, provider, newSha);
    assert.equal(simulation.difference.removed.length, 5);
    assert.equal(simulation.difference.removedSpecifications.length, 30);
    assert.deepEqual(simulation.acceptance, { accepted: true, blockers: [] });
    const activated = await selectActivePublication(temp, provider, newSha, true);
    assert.equal(activated.status, "activated");
    assert.equal(await resolveAccreditedPublication(temp, provider), join(destination, publishedFile));
    assert.equal(await readFile(join(oldDir, publishedFile), "utf8"), rawOriginal);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

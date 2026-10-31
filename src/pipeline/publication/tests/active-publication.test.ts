import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { discoverAccreditedPublications, resolveAccreditedPublication } from "../../../infrastructure/filesystem/catalog/accredited-publication.js";
import { selectActivePublication } from "../active-publication.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const providerId = "gomariz";
const existingSha = "1e094214a4a5a6ea4bc8943c5028620bee9359d6c13aff27ec29a62bfbb4d59e";
const hash = (text: string): string => createHash("sha256").update(text).digest("hex");

const setup = async (): Promise<{ root: string; publications: string; original: string; other: string }> => {
  const temp = await mkdtemp(join(tmpdir(), "catalogo-activo-"));
  const publications = join(temp, "catalogs", "providers", providerId, "publications");
  const original = join(publications, existingSha);
  await mkdir(publications, { recursive: true });
  await cp(join(root, "catalogs", "providers", providerId, "publications", existingSha), original, { recursive: true });
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

test("selección explícita de dos versiones, simulación, activación, idempotencia y reversión", async () => {
  const ctx = await setup();
  try {
    await assert.rejects(discoverAccreditedPublications(ctx.root), /Varias publicaciones/);
    const before = await readFile(join(ctx.original, `${providerId}-publishable.json`), "utf8");
    const simulation = await selectActivePublication(ctx.root, providerId, ctx.other);
    assert.equal(simulation.status, "simulation");
    assert.equal(simulation.difference.previous, null);
    assert.equal(simulation.difference.candidateProducts, 143);
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
      join(ctx.publications, existingSha, `${providerId}-publishable.json`));
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

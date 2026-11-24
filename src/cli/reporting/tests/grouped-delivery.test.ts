import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";
import { readZipArchive } from "../../../infrastructure/archive/zip.js";
import { deliverGrouped } from "../grouped-delivery.js";
import { parseGroupedDelivery } from "../../commands/campaign/campaign-deliver.js";

const hash = (content: string): string => createHash("sha256").update(content).digest("hex");

const createPublication = async (root: string, providerId: string): Promise<{ index: string; file: string; content: string }> => {
  const approval = JSON.stringify({ approved: true, runId: `test-${providerId}` });
  const approvalSha256 = hash(approval);
  const publications = join(root, "catalogs", "providers", providerId, "publications");
  const directory = join(publications, approvalSha256);
  await mkdir(directory, { recursive: true });
  const name = `${providerId}-publishable.json`;
  const content = "[\n]\n";
  const index = join(publications, "active.json");
  const file = join(directory, name);
  await writeFile(file, content);
  await writeFile(join(directory, "accreditation.json"), approval);
  await writeFile(join(directory, "manifest.json"), JSON.stringify({ version: 1, providerId,
    runId: `test-${providerId}`, approvalSha256, totals: { publishable: 0 },
    files: { [name]: hash(content), "accreditation.json": approvalSha256 } }));
  await writeFile(index, JSON.stringify({ version: 1, providerId, approvalSha256 }));
  return { index, file, content };
};

const withPublications = async (task: (root: string, desktop: string, publications: Awaited<ReturnType<typeof createPublication>>[]) => Promise<void>): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), "eqz-grouped-"));
  try {
    const root = join(directory, "repo");
    const desktop = join(directory, "desktop");
    await mkdir(desktop);
    const publications = await Promise.all(CAMPAIGN_PROVIDERS.map((id) => createPublication(root, id)));
    await task(root, desktop, publications);
  } finally { await rm(directory, { recursive: true, force: true }); }
};

const tree = async (root: string): Promise<readonly (readonly [string, string])[]> => {
  const entries = await readdir(root, { withFileTypes: true });
  const files: (readonly [string, string])[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await tree(path));
    else if (entry.isFile()) files.push([path, hash(await readFile(path, "utf8"))]);
  }
  return files;
};

test("la entrega agrupada exige modos explícitos y conserva el comando de campaña", () => {
  assert.equal(parseGroupedDelivery([]), null);
  assert.deepEqual(parseGroupedDelivery(["--publicos"]), { kind: "publicos" });
  assert.deepEqual(parseGroupedDelivery(["--informes", "--environment", "production"]), { kind: "informes", environment: "production" });
  for (const args of [["--informes"], ["--publicos", "--informes"], ["--publicos", "--dry-run"], ["--informes", "--entorno", "otro"]]) {
    assert.throws(() => parseGroupedDelivery(args), /Uso: entregar/);
  }
});

test("entrega los cuatro públicos exactos sin escrituras internas, es idempotente y no sobrescribe", async () => {
  await withPublications(async (root, desktop, publications) => {
    const before = await tree(root);
    await writeFile(join(desktop, "anterior.zip"), "anterior");
    const request = { kind: "publicos" } as const;
    const zip = await deliverGrouped(root, desktop, request);
    const entries = readZipArchive(await readFile(zip));
    assert.deepEqual(entries.map(({ name }) => name), CAMPAIGN_PROVIDERS.map((id) => `${id}-publishable.json`));
    assert.deepEqual(entries.map(({ data }) => data.toString("utf8")), publications.map(({ content }) => content));
    assert.equal(await deliverGrouped(root, desktop, request), zip);
    assert.deepEqual(await tree(root), before);
    await writeFile(zip, "colisión");
    await assert.rejects(deliverGrouped(root, desktop, request), /Colisión/);
    assert.equal(await readFile(zip, "utf8"), "colisión");
    assert.equal(await readFile(join(desktop, "anterior.zip"), "utf8"), "anterior");
    assert.equal((await readdir(desktop)).length, 2);
    await assert.rejects(deliverGrouped(root, root, request), /fuera del repositorio/);
  });
});

test("bloquea una selección ausente aunque exista una candidata y detecta corrupción sin ZIP parcial", async () => {
  await withPublications(async (root, desktop, publications) => {
    const publication = publications[0];
    assert.ok(publication);
    const index = await readFile(publication.index);
    await rm(publication.index);
    await assert.rejects(deliverGrouped(root, desktop, { kind: "publicos" }), /Selección vigente/);
    await writeFile(publication.index, index);
    await writeFile(publication.file, "[]");
    await assert.rejects(deliverGrouped(root, desktop, { kind: "publicos" }), /SHA256 distinto/);
    assert.deepEqual(await readdir(desktop), []);
  });
});

import { accreditedPublicationSha } from "../../../testing/accredited-publication-fixture.js";
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { resolveAccreditedPublication } from "../catalog/accredited-publication.js";
import { publicationApprovalSha, publicationDirectoryForApproval, resolvePublicationDirectory } from "../catalog/publication-identity.js";
import { selectActivePublication } from "../../../pipeline/publication/active-publication.js";

const repository = fileURLToPath(new URL("../../../../", import.meta.url));
const providerId = "gomariz";
const sha = accreditedPublicationSha(repository, "gomariz");
const relative = join("catalogs", "providers", providerId, "publications");

const withPublishedVersion = async (task: (root: string, directory: string, folder: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-alias-"));
  const folder = join(root, relative);
  try {
    await mkdir(folder, { recursive: true });
    await cp(join(repository, relative, sha), join(folder, sha), { recursive: true });
    await task(root, join(folder, sha), folder);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

test("la carpeta SHA completa legada sigue siendo verificable", async () => {
  await withPublishedVersion(async (root, directory, folder) => {
    assert.equal(await publicationApprovalSha(directory), sha);
    assert.equal(await resolvePublicationDirectory(folder, sha), directory);
    assert.equal(await resolveAccreditedPublication(root, providerId), join(directory, `${providerId}-publishable.json`));
  });
});

test("un alias corto verifica el SHA completo y admite un índice activo sin recortar", async () => {
  await withPublishedVersion(async (root, directory, folder) => {
    const aliasDirectory = join(folder, sha.slice(0, 12));
    await rename(directory, aliasDirectory);
    assert.equal(await publicationApprovalSha(aliasDirectory), sha);
    assert.equal(await resolvePublicationDirectory(folder, sha), aliasDirectory);
    const selection = await selectActivePublication(root, providerId, sha, true);
    assert.equal(selection.status, "activated");
    const current = await resolveAccreditedPublication(root, providerId);
    assert.equal(current, join(aliasDirectory, `${providerId}-publishable.json`));
    const simulation = await selectActivePublication(root, providerId, sha);
    assert.equal(simulation.difference.previous, sha);
    const active: unknown = JSON.parse(await readFile(join(folder, "active.json"), "utf8"));
    assert.deepEqual(active, { version: 1, providerId, approvalSha256: sha });
  });
});

test("rechaza coexistencia de alias, acreditación alterada y prefijo de otro SHA", async () => {
  await withPublishedVersion(async (root, directory, folder) => {
    const aliasDirectory = join(folder, sha.slice(0, 12));
    await cp(directory, aliasDirectory, { recursive: true });
    await assert.rejects(resolvePublicationDirectory(folder, sha), /ambiguo/);
    await rm(aliasDirectory, { recursive: true });
    await rename(directory, aliasDirectory);
    await writeFile(join(aliasDirectory, "accreditation.json"), "{}");
    await assert.rejects(resolveAccreditedPublication(root, providerId), /SHA-256 completo/);
    await assert.rejects(selectActivePublication(root, providerId, sha), /SHA-256 completo/);
  });
});

test("no acepta un alias con formato inválido ni un hash truncado como identidad", async () => {
  await withPublishedVersion(async (_root, _directory, folder) => {
    await assert.rejects(resolvePublicationDirectory(folder, sha.slice(0, 12)), /SHA-256/);
    await assert.rejects(resolvePublicationDirectory(folder, "../".padEnd(64, "a")), /SHA-256/);
  });
});

test("el generador reutiliza el SHA legado y reserva un alias corto solo para nuevas acreditaciones", async () => {
  await withPublishedVersion(async (_root, directory, folder) => {
    assert.equal(await publicationDirectoryForApproval(folder, sha), directory);
    const newSha = "f".repeat(64);
    assert.equal(await publicationDirectoryForApproval(folder, newSha), join(folder, newSha.slice(0, 12)));
    await assert.rejects(publicationDirectoryForApproval(folder, newSha.slice(0, 12)), /SHA-256/);
  });
});

test("la generación no sortea una colisión de alias que impediría resolver la acreditación", async () => {
  await withPublishedVersion(async (_root, directory, folder) => {
    await rename(directory, join(folder, sha.slice(0, 12)));
    const collidingSha = `${sha.slice(0, 12)}${"f".repeat(52)}`;
    await assert.rejects(publicationDirectoryForApproval(folder, collidingSha), /distinta/);
  });
});

import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { createPublishedIndividualFinishWorkspace } from "../../../../testing/builders/individual-finish-fixture.js";
import { accreditedPublicationOriginalSources } from "../accredited-publication-original.js";
import { readAccreditedPublication, resolveAccreditedPublication } from "../accredited-publication.js";

const withPublished = createPublishedIndividualFinishWorkspace();

test("la publicación acreditada recupera sus originales sin depender del inventario histórico", async () => {
  await withPublished(async (root) => {
    const publicationFile = await resolveAccreditedPublication(root, "gomariz");
    assert.ok(publicationFile);
    const publication = await readAccreditedPublication(publicationFile);
    const originals = await accreditedPublicationOriginalSources(root, publicationFile, "gomariz");
    assert.equal(originals.size, 3);
    for (const product of publication.products) {
      assert.ok([...originals.values()].some((original) =>
        original.providerId === product.providerId && original.reference === product.reference &&
        original.url === product.sourceUrl));
    }
  });
});

test("una alteración del original acreditado no puede sustituirse silenciosamente", async () => {
  await withPublished(async (root) => {
    const publicationFile = await resolveAccreditedPublication(root, "gomariz");
    assert.ok(publicationFile);
    const originalFile = join(root, "catalogs", "providers", "gomariz", "original", "scrape-gomariz-catalog.json");
    const original = await readFile(originalFile, "utf8");
    await writeFile(originalFile, `${original} `);
    await assert.rejects(accreditedPublicationOriginalSources(root, publicationFile, "gomariz"),
      /No se conserva el original acreditado|alterado|coincide|SHA256|manifest pertenecen a ejecuciones distintas/);
    await writeFile(originalFile, original);
    assert.equal((await accreditedPublicationOriginalSources(root, publicationFile, "gomariz")).size, 3);
  });
});

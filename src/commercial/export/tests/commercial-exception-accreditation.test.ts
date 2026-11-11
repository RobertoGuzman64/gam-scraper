import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createHistoricalCommercialFixture } from "../../../testing/builders/historical-commercial-fixture.js";
import { buildCommercialExportFiles } from "../commercial-export.js";
import { validateCommercialExportFiles } from "../commercial-export-verification.js";
import { createCommercialExceptionAccreditation, validCommercialExceptionAccreditation } from "../commercial-exception-accreditation.js";
import { loadFindingRecognitionRegistry } from "../../../infrastructure/filesystem/catalog/finding-recognition-store.js";

test("los cuatro avisos documentales acreditados viajan vinculados a su revisión vigente", async () => {
  const fixture = await createHistoricalCommercialFixture();
  try {
    const [files, registry] = await Promise.all([
      buildCommercialExportFiles(fixture.root, "develop"), loadFindingRecognitionRegistry(fixture.root),
    ]);
    validateCommercialExportFiles(files);
    const registered = new Set(registry.recognitions.map((item) => item.fingerprint));
    const gamFile = files.find((entry) => entry.name === "gam-commercial.json");
    assert.ok(gamFile);
    const gam: unknown = JSON.parse(gamFile.content);
    assert.ok(gam && typeof gam === "object" && "exceptions" in gam && Array.isArray(gam.exceptions));
    assert.equal(gam.exceptions.length, 4);
    for (const exception of gam.exceptions) {
      assert.ok(exception && typeof exception === "object" && "accreditation" in exception);
      assert.ok(exception.accreditation && registered.has(exception.accreditation.fingerprint));
    }
    assert.equal(files.filter((entry) => entry.name.endsWith("-commercial.json")).length, 3);

    const forged = JSON.parse(gamFile.content) as {
      exceptions: { accreditation: { fingerprint: string } }[];
    };
    const first = forged.exceptions[0];
    assert.ok(first);
    first.accreditation.fingerprint = "0".repeat(64);
    const modifiedContent = `${JSON.stringify(forged, null, 2)}\n`;
    const modifiedHash = createHash("sha256").update(modifiedContent).digest("hex");
    const manifestFile = files.find((entry) => entry.name === "commercial-manifest.json");
    assert.ok(manifestFile);
    const manifest = JSON.parse(manifestFile.content) as { providers: { providerId: string; sha256: string; bytes: number }[] };
    const gamDeclaration = manifest.providers.find((entry) => entry.providerId === "gam");
    assert.ok(gamDeclaration);
    gamDeclaration.sha256 = modifiedHash;
    gamDeclaration.bytes = Buffer.byteLength(modifiedContent);
    const alteredManifest = `${JSON.stringify(manifest, null, 2)}\n`;
    const changed = files.map((entry) => entry.name === gamFile.name
      ? { ...entry, content: modifiedContent, sha256: modifiedHash, bytes: Buffer.byteLength(modifiedContent) }
      : entry.name === manifestFile.name
        ? { ...entry, content: alteredManifest, sha256: createHash("sha256").update(alteredManifest).digest("hex"),
          bytes: Buffer.byteLength(alteredManifest) }
        : entry);
    assert.throws(() => validateCommercialExportFiles(changed), /Acreditación comercial incoherente/);
  } finally {
    await fixture.cleanup();
  }
});

test("una evidencia solo ampara la incidencia, origen y producto exactos", () => {
  const issue = {
    identity: "gam:ref:123", reference: "123", sourceUrl: "https://example.com/123",
    reason: "ano-url-atributo-discordante",
  };
  const product = { reference: "123", title: "Máquina", attributes: [{ attributeID: 7, value: 2017 }] };
  const recognition = { fingerprint: "a".repeat(64), evidenceSha256: "b".repeat(64), field: "year" };
  const accreditation = createCommercialExceptionAccreditation("gam", issue, product, recognition);
  const original = { ...issue, accreditation };
  assert.equal(validCommercialExceptionAccreditation("gam", original, product), true);
  assert.equal(validCommercialExceptionAccreditation("gam", original, { ...product, title: "Otra máquina" }), false);
  assert.equal(validCommercialExceptionAccreditation("gomariz", original, product), false);
  assert.equal(validCommercialExceptionAccreditation("gam", { ...original, identity: "gam:ref:456" }, product), false);
  assert.equal(validCommercialExceptionAccreditation("gam", { ...original, reason: "incidencia-nueva" }, product), false);
  assert.equal(validCommercialExceptionAccreditation("gam", { ...original, accreditation: {
    ...accreditation, fingerprint: "c".repeat(64)
  } }, product), false);
  assert.equal(validCommercialExceptionAccreditation("gam", { ...issue }, product), false);
});

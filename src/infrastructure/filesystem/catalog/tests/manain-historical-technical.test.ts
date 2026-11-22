import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readManainHistoricalTechnicalEvidence } from "../manain-historical-technical.js";

const data = {
  version: 1, providerId: "manain", legacyRecordSha256: "a".repeat(64), entries: [{
    reference: "MA4075", brand: "HAULOTTE", model: "HA 120 PX", year: "2015",
    sourceUrl: "https://manain.com/producto/venta-elevacion-brazo-articulado-haulotte-ha-120-px/",
    technicalSheetUrl: "https://manain.com/ficha-tecnica/venta-elevacion-brazo-articulado-haulotte-ha-120-px/",
    scrapedAt: "2026-10-28T10:47:17.791Z", specs: { Motor: "Diésel" }
  }]
};

test("Manain: el archivo complementario es opcional pero exige su pareja y su huella", async () => {
  const root = await mkdtemp(join(tmpdir(), "eqz-manain-history-"));
  const folder = join(root, "evidence");
  await mkdir(folder);
  try {
    assert.equal(await readManainHistoricalTechnicalEvidence(folder), null);
    const raw = JSON.stringify(data);
    const path = join(folder, "manain-historical-technical.json");
    const manifest = join(folder, "manain-historical-technical.manifest.json");
    await writeFile(path, raw);
    await assert.rejects(readManainHistoricalTechnicalEvidence(folder), /incompleta/);
    const digest = createHash("sha256").update(raw).digest("hex");
    await writeFile(manifest, JSON.stringify({ version: 1, providerId: "manain", entryCount: 1, evidenceSha256: digest }));
    const loaded = await readManainHistoricalTechnicalEvidence(folder);
    assert.equal(loaded?.evidenceSha256, digest);
    await writeFile(path, JSON.stringify({ ...data, providerId: "otro" }));
    await assert.rejects(readManainHistoricalTechnicalEvidence(folder));
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

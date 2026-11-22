import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { createManainStocklistManifest } from "../../catalog/manain-stocklist.js";
import { readPreparationOriginal } from "../preparation-source.js";
import { prepareSavedCatalog } from "../../../../preparation/workflow/prepare.js";
import { validateOfflinePreparation } from "../../../../preparation/workflow/validation/offline.js";
import { buildTechnicalCandidate } from "../../../../publication/technical-publication.js";
import { parsePrepareOptions } from "../../../../cli/options/prepare.js";

const fixture = {
  fuente: {
    archivo: "StocklistNoviembreManain.pdf",
    sha256: "c7c2f88e284c2efa153c1e8ff51d771d9195e0952a57820c1456974f8f2d2fb2",
    paginas: 42,
    tipo: "Stocklist Noviembre",
    proveedor: "Manain",
    registros_declarados: 2
  },
  productos: [
    {
      referencia: "MA4075", familia: "AD-12 ARTICULADA DIESEL", marca: "HAULOTTE", modelo: "HA 120 PX",
      anio: 2015, horas: 2885, precio_eur: 24500, estado: "Usada", observaciones: null,
      foto: "05/26", url: "https://manain.com/?sku=MA4075", pagina_pdf: 1
    },
    {
      referencia: "MAN3112", familia: "AD-12 ARTICULADA DIESEL", marca: "MANITOU", modelo: "MAN GO 12 K19 S1",
      anio: 2026, horas: 73, precio_eur: null, estado: "Usada", observaciones: null,
      foto: "NO", url: "https://manain.com/?sku=MAN3112", pagina_pdf: 1
    }
  ]
};

const withFixture = async (fn: (root: string, source: string, out: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "eqz-manain-f3-"));
  const source = join(root, "catalogs", "providers", "manain", "original", "manain-stocklist.json");
  const out = join(root, "prepared", "manain-stocklist-preparation.json");
  await mkdir(dirname(source), { recursive: true });
  const raw = JSON.stringify(fixture, null, 2);
  await writeFile(source, raw);
  await writeFile(join(dirname(source), "manain-stocklist.manifest.json"), JSON.stringify(createManainStocklistManifest(raw)));
  try { await fn(root, source, out); }
  finally { await rm(root, { force: true, recursive: true }); }
};

test("Manain: el stocklist acreditado alimenta la preparación compartida y la publicación técnica sin CSV", async () => {
  await withFixture(async (root, source, out) => {
    const original = await readPreparationOriginal(source);
    assert.equal(original.document?.kind, "stocklist");
    assert.equal(original.productCount, 2);
    const result = await prepareSavedCatalog({ providerId: "manain", source, out, dryRun: false, compare: null });
    assert.equal(result.preparation.products.length, 2);
    assert.equal(result.preparation.totals.ready + result.preparation.totals.review, 2);
    assert.deepEqual(result.preparation.source.document, original.document);
    const validated = await validateOfflinePreparation("manain", out, source);
    assert.equal(validated.sourceProducts.length, 2);
    assert.equal(validated.catalog.endedAt, null);
    const candidate = await buildTechnicalCandidate(root, "manain", { preparation: out });
    assert.equal(candidate.quality, "complete");
    assert.equal(candidate.source.kind, "stocklist");
    assert.equal(candidate.products.length, 2);
    await assert.rejects(buildTechnicalCandidate(root, "manain", {}),
      /requiere --preparacion/);
  });
});

test("Manain: cambios de contenido sin manifiesto actualizado bloquean la preparación y la comprobación", async () => {
  await withFixture(async (_root, source, out) => {
    const result = await prepareSavedCatalog({ providerId: "manain", source, out, dryRun: true, compare: null });
    assert.equal(result.preparation.products.length, 2);
    const raw = await readFile(source, "utf8");
    await writeFile(source, raw.replace("MA4075", "MA9999").replace("sku=MA4075", "sku=MA9999"));
    await assert.rejects(readPreparationOriginal(source), /contenido alterado|manifiesto discordante/);
    await assert.rejects(prepareSavedCatalog({ providerId: "manain", source, out, dryRun: false, compare: null }));
  });
});

test("Manain: la CLI usa el original documental y no admite el circuito web parcial", () => {
  const options = parsePrepareOptions(["manain", "--dry-run"]);
  assert.match(options.source, /catalogs[/\\]providers[/\\]manain[/\\]original[/\\]manain-stocklist\.json$/u);
  assert.equal(options.dryRun, true);
  assert.throws(() => parsePrepareOptions(["manain", "--censo", "censo.json"]), /desconocida/);
  assert.throws(() => parsePrepareOptions(["manain", "--source", "scrape-manain-catalog.json"]),
    /manain-stocklist/);
});


test("Manain: la evidencia técnica complementaria queda vinculada al original y al corte técnico", async () => {
  await withFixture(async (root, source, out) => {
    const evidenceFolder = join(root, "catalogs", "providers", "manain", "evidence");
    await mkdir(evidenceFolder);
    const evidence = {
      version: 1, providerId: "manain", legacyRecordSha256: "a".repeat(64), entries: [{
        reference: "MA4075", brand: "HAULOTTE", model: "HA 120 PX", year: "2015",
        sourceUrl: "https://manain.com/producto/venta-elevacion-brazo-articulado-haulotte-ha-120-px/",
        technicalSheetUrl: "https://manain.com/ficha-tecnica/venta-elevacion-brazo-articulado-haulotte-ha-120-px/",
        scrapedAt: "2026-10-28T10:47:17.791Z", specs: { Motor: "Diésel", "Altura trabajo": "12 m" }
      }]
    };
    const raw = JSON.stringify(evidence);
    const evidenceSha256 = createHash("sha256").update(raw).digest("hex");
    await writeFile(join(evidenceFolder, "manain-historical-technical.json"), raw);
    await writeFile(join(evidenceFolder, "manain-historical-technical.manifest.json"), JSON.stringify({
      version: 1, providerId: "manain", entryCount: 1, evidenceSha256
    }));
    const original = await readPreparationOriginal(source);
    assert.deepEqual(original.products[0]?.specs, evidence.entries[0]?.specs);
    assert.equal(original.products[1]?.specs, undefined);
    assert.equal(original.document?.technicalEvidenceSha256, evidenceSha256);
    const prepared = await prepareSavedCatalog({ providerId: "manain", source, out, dryRun: false, compare: null });
    assert.equal(prepared.preparation.source.document?.technicalEvidenceSha256, evidenceSha256);
    assert.deepEqual((await validateOfflinePreparation("manain", out, source)).sourceProducts[0]?.specs,
      evidence.entries[0]?.specs);
    const cut = await buildTechnicalCandidate(root, "manain", { preparation: out });
    assert.equal(cut.source.kind, "stocklist");
    if (cut.source.kind !== "stocklist") throw new Error("Se esperaba stocklist");
    assert.equal(cut.source.technicalEvidenceSha256, evidenceSha256);
    await writeFile(join(evidenceFolder, "manain-historical-technical.json"), `${raw} `);
    await assert.rejects(validateOfflinePreparation("manain", out, source), /huella de evidencia histórica/);
  });
});

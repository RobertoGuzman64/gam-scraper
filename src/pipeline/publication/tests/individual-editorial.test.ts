import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../../../catalog/editorial/campaign-accreditation.js";
import { readZipArchive } from "../../../infrastructure/archive/zip.js";
import { deliverIndividualArchive } from "../individual-archive.js";
import { deliverIndividualProvider } from "../individual-delivery.js";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { CategoryConfig, CategoryScrapeResult } from "../../../contracts/scraping.js";
import { prepareSavedCatalog } from "../../preparation/prepare.js";
import { writeOutputs } from "../../publication/publish.js";
import { selectIndividualPublishable, readIndividualSelection } from "../individual-selection.js";
import {
  approveIndividualEditorial, decideIndividualEditorial, inspectIndividualEditorial, startIndividualEditorial
} from "../individual-editorial.js";
import type { IndividualEditorialOptions } from "../individual-editorial.js";

const category: CategoryConfig = {
  key: "elevacion-nueva", name: "Plataformas elevadoras nuevas", url: "https://example.test/catalogo"
};

const machine = (reference: string, serialNumber: string | null): ProductRecord => ({
  providerId: "gam", categoryKey: category.key, categoryName: category.name,
  url: `https://online.gamrentals.com/es/plataformas-de-tijera-electricas-xcmg/${reference}-maquina`,
  reference, title: "Plataforma de tijera eléctrica XCMG", shortDescription: "Plataforma eléctrica",
  longDescription: "Maquinaria", price: "20000 €", brand: "XCMG", model: "Tijera", year: null,
  location: null, country: null, horometer: null, serialNumber, condition: "Nuevo",
  image: "https://example.test/image.jpg", images: ["https://example.test/image.jpg"],
  specs: { "Altura de trabajo": "8 m" }
});

const fixture = async (run: (options: IndividualEditorialOptions) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-editorial-individual-"));
  const catalogFile = join(root, "original", "catalogo-ejemplo-catalog.json");
  const preparationFile = join(root, "prepared", "catalogo-ejemplo-preparation.json");
  const now = new Date().toISOString();
  const products = [machine("11111", "SERIE-COMPARTIDA"), machine("22222", "SERIE-COMPARTIDA"), machine("33333", null)];
  const result: CategoryScrapeResult = { category, discoveredProductUrls: products.length, products, failures: [] };
  try {
    await writeOutputs(join(root, "original"), "catalogo-ejemplo", [result], now, now);
    await prepareSavedCatalog({ providerId: "gam", source: catalogFile, out: preparationFile, dryRun: false, compare: null });
    await run({ rootDirectory: root, providerId: "gam", catalogFile, preparationFile });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

const reason = "Identidad de origen sin garantías suficientes para publicar";

test("acreditación individual exige decisiones reales y aprobación humana sin publicar", async () => {
  await fixture(async (options) => {
    const context = await readIndividualSelection(options.providerId, options.catalogFile, options.preparationFile);
    assert.equal(context.preparation.totals.ready, 1);
    assert.equal(context.preparation.totals.review, 2);
    const first = await startIndividualEditorial(options);
    assert.equal(first.inspection.total, 2);
    assert.equal(first.inspection.completed, 0);
    assert.equal(first.inspection.approved, false);
    assert.equal((await startIndividualEditorial(options)).draftFile, first.draftFile);
    await assert.rejects(approveIndividualEditorial(options, "Aprobación completa tras revisión del origen"), /decisiones pendientes/);
    const decision = first.accreditation.exclusions[0];
    assert.ok(decision);
    await assert.rejects(decideIndividualEditorial(options, {
      reference: decision.reference, decision: "incluir", reason,
      evidenceUrls: [decision.sourceUrl]
    }), /Solo se admite incluir/);
    await assert.rejects(decideIndividualEditorial(options, {
      reference: decision.reference, decision: "excluir", reason, evidenceUrls: ["https://example.test/no-es-la-fuente"]
    }), /URL original/);
    const updated = await decideIndividualEditorial(options, {
      reference: decision.reference, decision: "excluir", reason, evidenceUrls: [decision.sourceUrl]
    });
    assert.equal(updated.inspection.completed, 1);
    const other = updated.accreditation.exclusions.find((item) => item.reference !== decision.reference);
    assert.ok(other);
    await decideIndividualEditorial(options, {
      reference: other.reference, decision: "excluir", reason, evidenceUrls: [other.sourceUrl]
    });
    const beforeApproval = await inspectIndividualEditorial(options);
    assert.equal(beforeApproval.inspection.completed, 2);
    assert.equal(beforeApproval.inspection.approved, false);
    const approved = await approveIndividualEditorial(options, "Conjunto individual contrastado y aprobado por una persona");
    assert.equal(approved.inspection.approved, true);
    assert.equal(approved.inspection.completed, 2);
    const selection = selectIndividualPublishable(context, await readFile(approved.draftFile, "utf8"));
    assert.equal(selection.totals.original, 3);
    assert.equal(selection.totals.publishable, 1);
    assert.equal(selection.totals.excluded, 2);
    await assert.rejects(decideIndividualEditorial(options, {
      reference: decision.reference, decision: "excluir", reason, evidenceUrls: [decision.sourceUrl]
    }), /ya está aprobada/);
    await assert.rejects(approveIndividualEditorial(options, "Otra aprobación indebida"), /ya está aprobada/);
  });
});

test("acreditación individual no reutiliza borradores manipulados o preparaciones cambiadas", async () => {
  await fixture(async (options) => {
    const created = await startIndividualEditorial(options);
    const raw = await readFile(created.draftFile, "utf8");
    await writeFile(created.draftFile, raw.replace('"reference": "11111"', '"reference": "99999"'));
    await assert.rejects(inspectIndividualEditorial(options), /caducada/);
    await writeFile(created.draftFile, raw);
    await writeFile(options.preparationFile, (await readFile(options.preparationFile, "utf8")).replace("11111", "99999"));
    await assert.rejects(inspectIndividualEditorial(options), /Manifest/);
  });
});

test("la acreditación individual no crea borrador por consultas antes del inicio", async () => {
  await fixture(async (options) => {
    await assert.rejects(inspectIndividualEditorial(options), /No hay borrador individual/);
  });
});


test("entrega individual bloquea borradores y validaciones sin aprobación", async () => {
  await fixture(async (options) => {
    await assert.rejects(deliverIndividualProvider(options, "simulation"), /No hay borrador individual/);
    await startIndividualEditorial(options);
    await assert.rejects(deliverIndividualProvider(options), /aprobación humana/);
    await assert.rejects(deliverIndividualProvider(options, "verify"), /aprobación humana/);
    const folder = join(options.rootDirectory, "catalogs", "providers", "gam");
    await assert.rejects(readdir(folder), /ENOENT/);
  });
});

test("entrega individual guarda JSON exacto, acreditación y manifiesto sin sobrescribir", async () => {
  await fixture(async (options) => {
    const started = await startIndividualEditorial(options);
    for (const item of started.accreditation.exclusions) {
      await decideIndividualEditorial(options, {
        reference: item.reference, decision: "excluir", reason, evidenceUrls: [item.sourceUrl]
      });
    }
    const approved = await approveIndividualEditorial(options, "Selección individual contrastada y aprobada expresamente");
    const simulated = await deliverIndividualProvider(options, "simulation");
    assert.equal(simulated.status, "simulation");
    await assert.rejects(readdir(simulated.publicationDirectory), /ENOENT/);
    await assert.rejects(deliverIndividualProvider(options, "verify"), /No existe una publicación/);
    const delivered = await deliverIndividualProvider(options);
    assert.equal(delivered.status, "published");
    assert.equal(delivered.publishable, 1);
    assert.equal(delivered.excluded, 2);
    assert.equal(delivered.productFile, simulated.productFile);
    const products: unknown = JSON.parse(await readFile(delivered.productFile, "utf8"));
    assert.ok(Array.isArray(products));
    assert.equal(products.length, 1);
    const first: unknown = products[0];
    assert.ok(first !== null && typeof first === "object" && "reference" in first);
    assert.equal(first.reference, "33333");
    const approvalText = await readFile(approved.draftFile, "utf8");
    assert.equal(await readFile(join(delivered.publicationDirectory, "accreditation.json"), "utf8"), approvalText);
    const manifest: unknown = JSON.parse(await readFile(join(delivered.publicationDirectory, "manifest.json"), "utf8"));
    assert.ok(manifest && typeof manifest === "object" && "approvalSha256" in manifest);
    assert.equal(manifest.approvalSha256, sha256(approvalText));
    assert.deepEqual((await readdir(delivered.publicationDirectory)).sort(),
      ["accreditation.json", "gam-publishable.json", "manifest.json"]);
    assert.equal((await deliverIndividualProvider(options, "verify")).status, "verified");
    assert.equal((await deliverIndividualProvider(options)).status, "verified");
    await assert.rejects(readdir(join(options.rootDirectory, "catalogs", "campaigns")), /ENOENT/);
    await writeFile(delivered.productFile, "[]");
    await assert.rejects(deliverIndividualProvider(options, "verify"), /archivo alterado/);
    await assert.rejects(deliverIndividualProvider(options), /archivo alterado/);
    assert.equal(await readFile(delivered.productFile, "utf8"), "[]");
  });
});

test("entrega individual rechaza aprobación obsoleta y artefactos adicionales", async () => {
  await fixture(async (options) => {
    const draft = await startIndividualEditorial(options);
    for (const item of draft.accreditation.exclusions) {
      await decideIndividualEditorial(options, {
        reference: item.reference, decision: "excluir", reason, evidenceUrls: [item.sourceUrl]
      });
    }
    await approveIndividualEditorial(options, "Conjunto de equipos validado editorialmente");
    const publication = await deliverIndividualProvider(options);
    await writeFile(join(publication.publicationDirectory, "extra.json"), "{}");
    await assert.rejects(deliverIndividualProvider(options, "verify"), /archivos adicionales/);
    await rm(join(publication.publicationDirectory, "extra.json"));
    await writeFile(options.preparationFile,
      (await readFile(options.preparationFile, "utf8")).replace("11111", "99999"));
    await assert.rejects(deliverIndividualProvider(options), /Manifest|preparación/);
  });
});


test("la entrega individual empaqueta el JSON aprobado y verifica el ZIP sin duplicarlo", async () => {
  await fixture(async (options) => {
    const draft = await startIndividualEditorial(options);
    for (const item of draft.accreditation.exclusions) {
      await decideIndividualEditorial(options, {
        reference: item.reference, decision: "excluir", reason, evidenceUrls: [item.sourceUrl]
      });
    }
    await approveIndividualEditorial(options, "Exclusiones revisadas y aprobadas editorialmente");
    const desktop = join(options.rootDirectory, "Escritorio");
    await mkdir(desktop);
    const date = new Date(2026, 9, 29);
    const simulated = await deliverIndividualArchive(options, desktop, "simulation", date);
    assert.equal(simulated.status, "simulation");
    assert.equal(simulated.zipFile, null);
    assert.deepEqual(await readdir(desktop), []);

    await deliverIndividualProvider(options);
    await assert.rejects(deliverIndividualArchive(options, desktop, "verify", date), /No existe todavía un ZIP/);
    const published = await deliverIndividualArchive(options, desktop, "publish", date);
    assert.equal(published.status, "published");
    assert.match(published.zipFile ?? "", /equipzilla-gam-2026-10-29-[a-f0-9]{16}\.zip$/);
    const zip = readZipArchive(await readFile(published.zipFile ?? ""));
    assert.equal(zip.length, 1);
    assert.equal(zip[0]?.name, "gam-2026-10-29.json");
    assert.equal(zip[0]?.data.toString("utf8"), await readFile(published.productFile, "utf8"));
    assert.equal((await deliverIndividualArchive(options, desktop, "verify", date)).status, "verified");
    const repeated = await deliverIndividualArchive(options, desktop, "publish", new Date(2026, 9, 30));
    assert.equal(repeated.status, "verified");
    assert.equal(repeated.zipFile, published.zipFile);
    assert.equal((await readdir(desktop)).length, 1);

    await writeFile(published.zipFile ?? "", "ZIP alterado");
    await assert.rejects(deliverIndividualArchive(options, desktop, "verify", date), /ZIP individual alterado/);
    await assert.rejects(deliverIndividualArchive(options, desktop, "publish", date), /ZIP individual alterado/);
    assert.equal(await readFile(published.zipFile ?? "", "utf8"), "ZIP alterado");
  });
});

test("la entrega individual no sobrescribe ZIP ajenos con el mismo nombre", async () => {
  await fixture(async (options) => {
    const draft = await startIndividualEditorial(options);
    for (const item of draft.accreditation.exclusions) {
      await decideIndividualEditorial(options, {
        reference: item.reference, decision: "excluir", reason, evidenceUrls: [item.sourceUrl]
      });
    }
    const approved = await approveIndividualEditorial(options, "Exclusiones verificadas y aprobadas expresamente");
    const desktop = join(options.rootDirectory, "Escritorio");
    await mkdir(desktop);
    const date = new Date(2026, 9, 29);
    const identifier = sha256(await readFile(approved.draftFile, "utf8")).slice(0, 16);
    const zipFile = join(desktop, `equipzilla-gam-2026-10-29-${identifier}.zip`);
    await writeFile(zipFile, "Archivo externo que debe conservarse");
    await assert.rejects(deliverIndividualArchive(options, desktop, "publish", date), /no se sobrescribe/);
    assert.equal(await readFile(zipFile, "utf8"), "Archivo externo que debe conservarse");
  });
});

import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { sha256 } from "../../catalog/editorial/campaign-accreditation.js";
import { proposeIndividualExclusions } from "../../catalog/editorial/individual-decision-proposals.js";
import type { CampaignAccreditation } from "../../catalog/editorial/campaign-accreditation.js";
import { readZipArchive } from "../../infrastructure/archive/zip.js";
import { deliverIndividualArchive } from "../individual-archive.js";
import { deliverIndividualProvider } from "../individual-delivery.js";
import { completeIndividualDelivery } from "../complete-individual-delivery.js";
import { resolveAccreditedPublication } from "../../infrastructure/filesystem/catalog/accredited-publication.js";
import test, { after } from "node:test";
import type { ProductRecord } from "../../contracts/catalog.js";
import type { CategoryConfig, CategoryScrapeResult } from "../../contracts/scraping.js";
import { prepareSavedCatalog } from "../../preparation/workflow/prepare.js";
import { writeOutputs } from "../../scraping/output/publish.js";
import { selectIndividualPublishable, readIndividualSelection } from "../individual-selection.js";
import {
  approveIndividualEditorial, decideIndividualEditorial, inspectIndividualEditorial,
  prepareIndividualEditorialProposals, startIndividualEditorial
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

const reason = "Identidad de origen sin garantías suficientes para publicar";

let baseWorkspace: Promise<string> | undefined;
let baseApprovedWorkspace: Promise<string> | undefined;
const createBaseWorkspace = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-editorial-seed-"));
  const now = new Date().toISOString();
  const products = [machine("11111", "SERIE-COMPARTIDA"), machine("22222", "SERIE-COMPARTIDA"), machine("33333", null)];
  const result: CategoryScrapeResult = { category, discoveredProductUrls: products.length, products, failures: [] };
  try {
    await writeOutputs(join(root, "original"), "catalogo-ejemplo", [result], now, now);
    await prepareSavedCatalog({
      providerId: "gam", source: join(root, "original", "catalogo-ejemplo-catalog.json"),
      out: join(root, "prepared", "catalogo-ejemplo-preparation.json"), dryRun: false, compare: null
    });
    return root;
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
};

const optionsFor = (root: string): IndividualEditorialOptions => ({
  rootDirectory: root, providerId: "gam",
  catalogFile: join(root, "original", "catalogo-ejemplo-catalog.json"),
  preparationFile: join(root, "prepared", "catalogo-ejemplo-preparation.json")
});

const createApprovedWorkspace = async (): Promise<string> => {
  baseWorkspace ??= createBaseWorkspace();
  const source = await baseWorkspace;
  const root = await mkdtemp(join(tmpdir(), "equipzilla-editorial-approved-seed-"));
  try {
    await cp(source, root, { recursive: true });
    const options = optionsFor(root);
    const started = await startIndividualEditorial(options);
    for (const item of started.accreditation.exclusions) {
      await decideIndividualEditorial(options, {
        reference: item.reference, decision: "excluir", reason, evidenceUrls: [item.sourceUrl]
      });
    }
    await approveIndividualEditorial(options, "Selección individual contrastada y aprobada expresamente");
    return root;
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
};

const fixture = async (
  run: (options: IndividualEditorialOptions) => Promise<void>,
  state: "prepared" | "approved" = "prepared"
): Promise<void> => {
  const seed = state === "approved"
    ? (baseApprovedWorkspace ??= createApprovedWorkspace())
    : (baseWorkspace ??= createBaseWorkspace());
  const source = await seed;
  const root = await mkdtemp(join(tmpdir(), "equipzilla-editorial-individual-"));
  try {
    await cp(source, root, { recursive: true });
    await run(optionsFor(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

after(async () => {
  const seeds = [baseApprovedWorkspace, baseWorkspace].filter((value): value is Promise<string> => value !== undefined);
  const results = await Promise.allSettled(seeds);
  await Promise.all(results.flatMap((result) => result.status === "fulfilled"
    ? [rm(result.value, { recursive: true, force: true })] : []));
});

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
    await assert.rejects(deliverIndividualProvider(options), /acreditación aprobada/);
    await assert.rejects(deliverIndividualProvider(options, "verify"), /acreditación aprobada/);
    const folder = join(options.rootDirectory, "catalogs", "providers", "gam");
    await assert.rejects(readdir(folder), /ENOENT/);
  });
});

test("entrega individual guarda JSON exacto, acreditación y manifiesto sin sobrescribir", async () => {
  await fixture(async (options) => {
    const approved = await inspectIndividualEditorial(options);
    const simulated = await deliverIndividualProvider(options, "simulation");
    assert.equal(simulated.status, "simulation");
    await assert.rejects(readdir(simulated.publicationDirectory), /ENOENT/);
    await assert.rejects(deliverIndividualProvider(options, "verify"), /No existe una publicación/);
    const delivered = await deliverIndividualProvider(options);
    assert.equal(delivered.status, "published");
    assert.match(basename(delivered.publicationDirectory), /^[a-f0-9]{12}$/);
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
  }, "approved");
});

test("entrega individual rechaza aprobación obsoleta y artefactos adicionales", async () => {
  await fixture(async (options) => {
    const publication = await deliverIndividualProvider(options);
    await writeFile(join(publication.publicationDirectory, "extra.json"), "{}");
    await assert.rejects(deliverIndividualProvider(options, "verify"), /archivos adicionales/);
    await rm(join(publication.publicationDirectory, "extra.json"));
    await writeFile(options.preparationFile,
      (await readFile(options.preparationFile, "utf8")).replace("11111", "99999"));
    await assert.rejects(deliverIndividualProvider(options), /Manifest|preparación/);
  }, "approved");
});


test("la entrega individual empaqueta el JSON aprobado y verifica el ZIP sin duplicarlo", async () => {
  await fixture(async (options) => {
    const desktop = join(options.rootDirectory, "Escritorio");
    await mkdir(desktop);
    const date = new Date("2026-10-29T10:00:00Z");
    const simulated = await deliverIndividualArchive(options, desktop, "simulation", date);
    assert.equal(simulated.status, "simulation");
    assert.equal(simulated.zipFile, null);
    assert.deepEqual(await readdir(desktop), []);

    await deliverIndividualProvider(options);
    await assert.rejects(deliverIndividualArchive(options, desktop, "verify", date), /No existe todavía un ZIP/);
    const published = await deliverIndividualArchive(options, desktop, "publish", date);
    assert.equal(published.status, "published");
    assert.match(published.zipFile ?? "", /equipzilla-gam-20261029-[a-f0-9]{16}\.zip$/);
    const zip = readZipArchive(await readFile(published.zipFile ?? ""));
    assert.equal(zip.length, 1);
    assert.equal(zip[0]?.name, "gam-2026-10-29.json");
    assert.equal(zip[0]?.data.toString("utf8"), await readFile(published.productFile, "utf8"));
    assert.equal((await deliverIndividualArchive(options, desktop, "verify", date)).status, "verified");
    const repeated = await deliverIndividualArchive(options, desktop, "publish", new Date("2026-10-30T10:00:00Z"));
    assert.equal(repeated.status, "verified");
    assert.equal(repeated.zipFile, published.zipFile);
    assert.equal((await readdir(desktop)).length, 1);

    await writeFile(published.zipFile ?? "", "ZIP alterado");
    await assert.rejects(deliverIndividualArchive(options, desktop, "verify", date), /ZIP individual alterado/);
    await assert.rejects(deliverIndividualArchive(options, desktop, "publish", date), /ZIP individual alterado/);
    assert.equal(await readFile(published.zipFile ?? "", "utf8"), "ZIP alterado");
  }, "approved");
});

test("la generación posterior reutiliza publicaciones legadas de SHA completo sin duplicar", async () => {
  await fixture(async (options) => {
    const approved = await inspectIndividualEditorial(options);
    const delivered = await deliverIndividualProvider(options);
    const fullSha = sha256(await readFile(approved.draftFile, "utf8"));
    const legacyDirectory = join(dirname(delivered.publicationDirectory), fullSha);
    await rename(delivered.publicationDirectory, legacyDirectory);
    const verified = await deliverIndividualProvider(options, "publish");
    assert.equal(verified.status, "verified");
    assert.equal(verified.publicationDirectory, legacyDirectory);
    assert.deepEqual((await readdir(dirname(legacyDirectory))).sort(), [fullSha]);
  }, "approved");
});

test("un recibo y ZIP de nomenclatura anterior siguen verificándose íntegros", async () => {
  await fixture(async (options) => {
    const approved = await inspectIndividualEditorial(options);
    const desktop = join(options.rootDirectory, "Escritorio");
    await mkdir(desktop);
    const date = new Date("2026-10-29T10:00:00Z");
    const published = await deliverIndividualArchive(options, desktop, "publish", date);
    const fullSha = sha256(await readFile(approved.draftFile, "utf8"));
    const receiptPath = join(options.rootDirectory, "storage", "providers", "gam", "deliveries", `${fullSha}.json`);
    const raw: unknown = JSON.parse(await readFile(receiptPath, "utf8"));
    assert.ok(raw && typeof raw === "object" && "zipFile" in raw && typeof raw.zipFile === "string");
    const legacyZip = join(desktop, `equipzilla-gam-2026-10-29-${fullSha.slice(0, 16)}.zip`);
    await rename(published.zipFile!, legacyZip);
    await writeFile(receiptPath, JSON.stringify({ ...raw, zipFile: legacyZip }, null, 2));
    const verified = await deliverIndividualArchive(options, desktop, "verify", date);
    assert.equal(verified.status, "verified");
    assert.equal(verified.zipFile, legacyZip);
    assert.equal((await readdir(desktop)).length, 1);
  }, "approved");
});

test("la entrega individual no sobrescribe ZIP ajenos con el mismo nombre", async () => {
  await fixture(async (options) => {
    const approved = await inspectIndividualEditorial(options);
    const desktop = join(options.rootDirectory, "Escritorio");
    await mkdir(desktop);
    const date = new Date("2026-10-29T10:00:00Z");
    const identifier = sha256(await readFile(approved.draftFile, "utf8")).slice(0, 16);
    const zipFile = join(desktop, `equipzilla-gam-20261029-${identifier}.zip`);
    await writeFile(zipFile, "Archivo externo que debe conservarse");
    await assert.rejects(deliverIndividualArchive(options, desktop, "publish", date), /no se sobrescribe/);
    assert.equal(await readFile(zipFile, "utf8"), "Archivo externo que debe conservarse");
  }, "approved");
});


test("propuestas individuales conservan decisiones humanas, no aprueban y son idempotentes", async () => {
  await fixture(async (options) => {
    const started = await startIndividualEditorial(options);
    const first = started.accreditation.exclusions[0];
    assert.ok(first);
    const manualReason = "Exclusión contrastada manualmente y registrada con evidencia original";
    await decideIndividualEditorial(options, {
      reference: first.reference, decision: "excluir", reason: manualReason, evidenceUrls: [first.sourceUrl]
    });
    const proposed = await prepareIndividualEditorialProposals(options);
    assert.equal(proposed.inspection.completed, 2);
    assert.equal(proposed.inspection.approved, false);
    const manual = proposed.accreditation.exclusions.find((item) => item.reference === first.reference);
    const assisted = proposed.accreditation.exclusions.find((item) => item.reference !== first.reference);
    assert.equal(manual?.reason, manualReason);
    assert.ok(assisted);
    assert.equal(assisted.decision, "excluir");
    assert.match(assisted.reason ?? "", /incidencias documentadas en la preparación/);
    assert.deepEqual(assisted.evidenceUrls, [assisted.sourceUrl]);
    await assert.rejects(deliverIndividualProvider(options), /acreditación aprobada/);
    const before = await readFile(proposed.draftFile, "utf8");
    await prepareIndividualEditorialProposals(options);
    assert.equal(await readFile(proposed.draftFile, "utf8"), before);
    await decideIndividualEditorial(options, {
      reference: assisted.reference, decision: "excluir",
      reason: "Decisión humana revisada y reemplazada antes de aprobar el conjunto",
      evidenceUrls: [assisted.sourceUrl]
    });
    const approved = await approveIndividualEditorial(options, "Decisiones asistidas revisadas y aprobadas expresamente");
    assert.equal(approved.inspection.approved, true);
    await assert.rejects(prepareIndividualEditorialProposals(options), /ya está aprobada/);
  });
});

test("propuestas no descartan errores técnicos, intervenciones ni inventan evidencias", async () => {
  await fixture(async (options) => {
    const started = await startIndividualEditorial(options);
    const first = started.accreditation.exclusions[0];
    const second = started.accreditation.exclusions[1];
    assert.ok(first);
    assert.ok(second);
    const intervention: CampaignAccreditation["exclusions"][number] = { ...first, status: "intervention" };
    const invalidUrl: CampaignAccreditation["exclusions"][number] = {
      ...second, sourceUrl: "http://example.test/origen"
    };
    const attributeIssue: CampaignAccreditation["exclusions"][number] = {
      ...first, issues: ["Atributo no normalizable: Potencia"]
    };
    const mixedIssue: CampaignAccreditation["exclusions"][number] = {
      ...first, issues: [...first.issues, "Atributo no normalizable: Altura de plataforma"]
    };
    const proposed = proposeIndividualExclusions({
      ...started.accreditation, exclusions: [intervention, invalidUrl, attributeIssue, mixedIssue]
    });
    assert.deepEqual(proposed.exclusions, [intervention, invalidUrl, attributeIssue, mixedIssue]);
    assert.equal(proposed.approved, false);
  });
});


test("el cierre JSON respeta simulación, candidata y verificación, y activa al entregar definitivamente", async () => {
  await fixture(async (options) => {
    const preview = await completeIndividualDelivery(options, null, "simulation");
    assert.equal(preview.activation, "not_requested");
    await assert.rejects(readdir(join(options.rootDirectory, "catalogs")), /ENOENT/);
    const candidate = await completeIndividualDelivery(options, null, "candidate");
    assert.equal(candidate.delivery.status, "published");
    assert.equal(candidate.activation, "not_requested");
    const selector = join(options.rootDirectory, "catalogs", "providers", "gam", "publications", "active.json");
    await assert.rejects(readFile(selector), /ENOENT/);
    const verified = await completeIndividualDelivery(options, null, "verify");
    assert.equal(verified.delivery.status, "verified");
    assert.equal(verified.activation, "not_requested");
    await assert.rejects(readFile(selector), /ENOENT/);
    const closed = await completeIndividualDelivery(options, null, "publish");
    assert.equal(closed.activation, "activated");
    assert.equal(await resolveAccreditedPublication(options.rootDirectory, "gam"), closed.delivery.productFile);
    const selectorBefore = await readFile(selector, "utf8");
    const again = await completeIndividualDelivery(options, null, "publish");
    assert.equal(again.activation, "unchanged");
    assert.equal(await readFile(selector, "utf8"), selectorBefore);
  }, "approved");
});

test("el cierre ZIP exige recibo íntegro antes de activar y permite reanudar una candidata", async () => {
  await fixture(async (options) => {
    const desktop = join(options.rootDirectory, "Escritorio");
    await mkdir(desktop);
    const candidate = await completeIndividualDelivery(options, desktop, "candidate");
    assert.equal(candidate.activation, "not_requested");
    assert.ok(candidate.delivery.zipFile);
    const selector = join(options.rootDirectory, "catalogs", "providers", "gam", "publications", "active.json");
    await assert.rejects(readFile(selector), /ENOENT/);
    const zip = candidate.delivery.zipFile;
    await writeFile(zip, "ZIP externo alterado");
    await assert.rejects(completeIndividualDelivery(options, desktop, "publish"), /ZIP individual alterado/);
    await assert.rejects(readFile(selector), /ENOENT/);
    await assert.rejects(completeIndividualDelivery(options, desktop, "verify"), /ZIP individual alterado/);
  }, "approved");
});

test("el cierre ZIP nuevo completa entrega y activación sin un segundo comando", async () => {
  await fixture(async (options) => {
    const desktop = join(options.rootDirectory, "Escritorio");
    await mkdir(desktop);
    const closed = await completeIndividualDelivery(options, desktop);
    assert.equal(closed.activation, "activated");
    assert.ok(closed.delivery.zipFile);
    assert.equal(await resolveAccreditedPublication(options.rootDirectory, "gam"), closed.delivery.productFile);
    assert.equal((await completeIndividualDelivery(options, desktop)).activation, "unchanged");
  }, "approved");
});


test("el cierre definitivo no elige una publicación entre históricos sin selección inequívoca", async () => {
  await fixture(async (options) => {
    const candidate = await completeIndividualDelivery(options, null, "candidate");
    const directory = candidate.delivery.publicationDirectory;
    const accreditation = JSON.parse(await readFile(join(directory, "accreditation.json"), "utf8")) as Record<string, unknown>;
    const alternateAccreditation = JSON.stringify({ ...accreditation, edition: "histórica" }, null, 2);
    const alternateSha = sha256(alternateAccreditation);
    const alternateDirectory = join(dirname(directory), alternateSha);
    await cp(directory, alternateDirectory, { recursive: true });
    const manifest = JSON.parse(await readFile(join(alternateDirectory, "manifest.json"), "utf8")) as Record<string, unknown>;
    const files = manifest.files as Record<string, string>;
    await writeFile(join(alternateDirectory, "accreditation.json"), alternateAccreditation);
    await writeFile(join(alternateDirectory, "manifest.json"), JSON.stringify({
      ...manifest, approvalSha256: alternateSha, files: { ...files, "accreditation.json": alternateSha }
    }, null, 2));
    const result = await completeIndividualDelivery(options, null, "publish");
    assert.equal(result.activation, "blocked");
    assert.match(result.blockers[0] ?? "", /selección inicial inequívoca/);
    await assert.rejects(readFile(join(dirname(directory), "active.json")), /ENOENT/);
  }, "approved");
});

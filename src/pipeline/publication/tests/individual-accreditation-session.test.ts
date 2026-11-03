import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { runAccreditIndividual } from "../../../cli/commands/catalog/accredit-individual.js";
import { preflightIndividualAccreditations } from "../individual-accreditation.js";
import type { IndividualAccreditationProvider, IndividualEditorialAntecedent } from "../individual-accreditation.js";
import { planAutomaticIndividualAccreditation } from "../automatic-individual-accreditation.js";
import { inspectIndividualEditorial, startIndividualEditorial } from "../individual-editorial.js";
import { readIndividualSelection, selectIndividualPublishable } from "../individual-selection.js";
import { publishIndividualCatalogs } from "../individual-finish.js";
import { createIndividualWorkspaceFixture, prepareIndividualTestWorkspace } from "../../../testing/builders/individual-workspace-fixture.js";

const withWorkspace = createIndividualWorkspaceFixture({
  prefix: "equipzilla auto-acreditar ", serialNumber: "SERIE-REPETIDA", defaultState: "prepared"
});

const historical = (context: IndividualAccreditationProvider): IndividualAccreditationProvider => ({
  ...context,
  antecedents: context.expected.exclusions.map((entry): IndividualEditorialAntecedent => ({
    reference: entry.reference, sourceUrl: entry.sourceUrl, status: entry.status,
    issues: entry.issues, reason: "Exclusión histórica acreditada por identidad contradictoria",
    evidenceUrls: [entry.sourceUrl]
  }))
});

const prepared = async (root: string, providerId: "gam" | "gomariz") => {
  const contexts = await preflightIndividualAccreditations(root, [providerId]);
  const current = contexts[0];
  assert.ok(current);
  return current;
};

test("la acreditación automática rechaza incidencias nuevas y no crea publicaciones ni borradores", async () => {
  await withWorkspace(async (root) => {
    const context = await prepared(root, "gam");
    assert.equal(context.expected.exclusions.length, 2);
    assert.equal(context.antecedents.length, 0);
    assert.throws(() => planAutomaticIndividualAccreditation(context), /incidencia nueva/);
    await assert.rejects(runAccreditIndividual(["--proveedor", "gam"], root), /incidencia nueva/);
    await assert.rejects(publishIndividualCatalogs({
      workspace: root, providers: ["gam"], dryRun: false, desktopDirectory: root
    }), /incidencia nueva/);
    await assert.rejects(lstat(join(root, "storage", "providers")), { code: "ENOENT" });
    await assert.rejects(lstat(join(root, "storage", "publication")), { code: "ENOENT" });
  });
});

test("solo reutiliza exclusiones históricas idénticas con evidencia original", async () => {
  await withWorkspace(async (root) => {
    const context = historical(await prepared(root, "gam"));
    const planned = planAutomaticIndividualAccreditation(context);
    assert.equal(planned.approved, true);
    assert.equal(planned.exclusions.length, 2);
    assert.ok(planned.exclusions.every((item) => item.decision === "excluir"));
    const selection = await readIndividualSelection(context.providerId, context.options.catalogFile, context.options.preparationFile);
    const publishable = selectIndividualPublishable(selection, JSON.stringify(planned, null, 2));
    assert.equal(publishable.totals.excluded, 2);
    assert.equal(publishable.totals.publishable, 1);
    assert.deepEqual(publishable.exclusions.map((item) => item.reference), ["11111", "22222"]);
  });
});

test("un cambio de incidencias, URL, estado o referencia en el antecedente bloquea la exclusión", async () => {
  await withWorkspace(async (root) => {
    const context = historical(await prepared(root, "gam"));
    const entries = context.antecedents;
    const first = entries[0];
    assert.ok(first);
    const altered: readonly IndividualEditorialAntecedent[] = [
      { ...first, issues: [...first.issues, "Nuevo problema"] }, ...entries.slice(1)
    ];
    assert.throws(() => planAutomaticIndividualAccreditation({ ...context, antecedents: altered }), /incidencia nueva/);
    assert.throws(() => planAutomaticIndividualAccreditation({ ...context,
      antecedents: [{ ...first, sourceUrl: "https://example.test/fuente-distinta" }, ...entries.slice(1)]
    }), /incidencia nueva/);
    assert.throws(() => planAutomaticIndividualAccreditation({ ...context,
      antecedents: [{ ...first, status: "identity" }, ...entries.slice(1)]
    }), /incidencia nueva/);
    assert.throws(() => planAutomaticIndividualAccreditation({ ...context,
      antecedents: [{ ...first, reference: "otra" }, ...entries.slice(1)]
    }), /incidencia nueva/);
  });
});

test("proveedor sin incidencias se acredita sin terminal y --simular no escribe", async () => {
  await withWorkspace(async (root) => {
    const context = await prepared(root, "gomariz");
    assert.equal(context.expected.exclusions.length, 0);
    assert.equal(await runAccreditIndividual(["--proveedor", "gomariz", "--simular"], root), true);
    await assert.rejects(lstat(join(root, "storage", "providers")), { code: "ENOENT" });
    assert.equal(await runAccreditIndividual(["--proveedor", "gomariz"], root), true);
    const approved = await inspectIndividualEditorial(context.options);
    assert.equal(approved.inspection.approved, true);
    assert.equal(approved.inspection.total, 0);
    const before = createHash("sha256").update(await readFile(approved.draftFile)).digest("hex");
    assert.equal(await runAccreditIndividual(["--proveedor", "gomariz"], root), true);
    const after = createHash("sha256").update(await readFile(approved.draftFile)).digest("hex");
    assert.equal(after, before);
    await assert.rejects(lstat(join(root, "catalogs", "providers", "gomariz", "publications")), { code: "ENOENT" });
  });
});

test("un borrador sin aprobar no se interpreta como consentimiento", async () => {
  await withWorkspace(async (root) => {
    const context = await prepared(root, "gam");
    await startIndividualEditorial(context.options);
    const pending = await prepared(root, "gam");
    assert.equal(pending.existing?.inspection.approved, false);
    assert.throws(() => planAutomaticIndividualAccreditation(pending), /incidencia nueva/);
  });
});

test("la integridad canónica sigue siendo obligatoria antes de acreditar", async () => {
  await withWorkspace(async (root) => {
    const source = join(root, "catalogs/providers/gam/original/scrape-gam-catalog.json");
    const before = createHash("sha256").update(await readFile(source)).digest("hex");
    assert.equal(before.length, 64);
    await prepareIndividualTestWorkspace(root);
    await assert.rejects(runAccreditIndividual(["--proveedor", "gam"], root), /incidencia nueva/);
    assert.equal(createHash("sha256").update(await readFile(source)).digest("hex"), before);
  }, "original");
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { preflightIndividualAccreditations, validateIndividualAccreditations } from "../individual-accreditation.js";
import { inspectIndividualEditorial, readIndividualEditorialState } from "../individual-editorial.js";
import { runAccreditIndividual } from "../../../cli/commands/catalog/accredit-individual.js";
import type { EditorialSessionInput } from "../../../cli/commands/catalog/accredit-individual.js";
import { createIndividualWorkspaceFixture, prepareIndividualTestWorkspace } from "../../../testing/builders/individual-workspace-fixture.js";

const withFixture = createIndividualWorkspaceFixture({
  prefix: "equipzilla acreditar sesión ", serialNumber: "SERIE-REPETIDA", defaultState: "prepared"
});
const withWorkspace = (action: (root: string) => Promise<void>, state: "original" | "prepared" = "prepared") =>
  withFixture((root) => action(root), state);

const inputs = (...answers: readonly string[]): EditorialSessionInput & { readonly remaining: () => number } => {
  const list = [...answers];
  return { ask: async () => list.shift() ?? "q", close: () => undefined, remaining: () => list.length };
};
const draft = async (root: string, providerId: "gam" | "gomariz") => {
  const contexts = await preflightIndividualAccreditations(root, [providerId]);
  const context = contexts[0];
  assert.ok(context);
  return context;
};

const reason = "Revisión de procedencia e identidad contrastada expresamente";

test("no hay borrador ni aprobación sin preparar; simulación, no-TTY y denegación preservan originales", async () => {
  await withWorkspace(async (root) => {
    await assert.rejects(preflightIndividualAccreditations(root, ["gam"]), /catalogo:preparar/);
    const original = join(root, "catalogs/providers/gam/original/scrape-gam-catalog.json");
    const before = createHash("sha256").update(await readFile(original)).digest("hex");
    await prepareIndividualTestWorkspace(root);
    const preview = await draft(root, "gam");
    assert.equal(preview.expected.exclusions.length, 2);
    assert.equal(preview.proposed.exclusions.filter((item) => item.decision === "excluir").length, 2);
    assert.equal(await runAccreditIndividual(["--proveedor", "gam", "--simular"], root), true);
    await assert.rejects(lstat(join(root, "storage/providers")), { code: "ENOENT" });
    assert.equal(await runAccreditIndividual(["--proveedor", "gam"], root, inputs("q")), false);
    const existing = await draft(root, "gam");
    assert.equal(existing.existing?.inspection.approved, false);
    assert.equal(existing.existing?.inspection.completed, 0);
    assert.equal(createHash("sha256").update(await readFile(original)).digest("hex"), before);
    await assert.rejects(lstat(join(root, "catalogs/providers/gam/publications")), { code: "ENOENT" });
  }, "original");
});

test("sesión única admite propuestas explícitas, evidencia, denegación, reanudación y aprobación por proveedor", async () => {
  await withWorkspace(async (root) => {
    const gam = await draft(root, "gam");
    assert.equal(gam.expected.exclusions.length, 2);
    assert.equal((await draft(root, "gomariz")).expected.exclusions.length, 0);
    assert.equal(await runAccreditIndividual(["--proveedor", "gam"], root, inputs("p", "EXCLUIR", "q")), false);
    const partial = await draft(root, "gam");
    assert.equal(partial.existing?.inspection.completed, 1);
    assert.equal(partial.existing?.inspection.approved, false);
    assert.equal(await runAccreditIndividual(["--proveedor", "gam"], root, inputs("r", "s")), false);
    assert.equal((await draft(root, "gam")).existing?.inspection.completed, 1);
    assert.equal(await runAccreditIndividual(["--proveedor", "gam"], root, inputs("p", "EXCLUIR", reason, "NO")), false);
    assert.equal((await draft(root, "gam")).existing?.inspection.approved, false);
    assert.equal(await runAccreditIndividual(["--proveedor", "gam"], root, inputs(reason, "APROBAR")), true);
    const approved = await draft(root, "gam");
    assert.equal(approved.existing?.inspection.approved, true);
    assert.equal(approved.existing?.inspection.completed, 2);
    assert.match(approved.existing?.accreditation.approvalReason ?? "", /Aprobación expresa del conjunto/);
    const raw = await readFile(approved.existing.draftFile);
    assert.equal(await runAccreditIndividual(["--proveedor", "gam"], root, inputs()), true);
    assert.deepEqual(await readFile(approved.existing.draftFile), raw);
    assert.equal(await runAccreditIndividual(["--proveedor", "gomariz"], root, inputs(reason, "APROBAR")), true);
    assert.equal((await draft(root, "gomariz")).existing?.inspection.approved, true);
    await assert.rejects(lstat(join(root, "catalogs/providers/gam/publications")), { code: "ENOENT" });
    assert.equal((await validateIndividualAccreditations(await preflightIndividualAccreditations(root, ["gam", "gomariz"]))).length, 2);
  });
});

test("no admite evidencia incompleta, aplazamiento ni aprobación silenciosa para un conjunto nuevo", async () => {
  await withWorkspace(async (root) => {
    const before = await draft(root, "gam");
    const urls = before.expected.exclusions.map((item) => item.sourceUrl);
    assert.ok(urls[0]);
    assert.equal(await runAccreditIndividual(["--proveedor", "gam"], root,
      inputs("e", reason, "https://example.test/otra-url", "e", reason, urls[0], "s")), false);
    const current = await draft(root, "gam");
    assert.equal(current.existing?.inspection.completed, 1);
    assert.equal(current.existing?.inspection.approved, false);
    await assert.rejects(validateIndividualAccreditations([current]), /pendientes/);
    await assert.rejects(lstat(join(root, "catalogs/providers/gam/publications")), { code: "ENOENT" });
  });
});

test("sesión ordinaria de los tres proveedores y aprobación global incluso sin review en Gomariz", async () => {
  await withWorkspace(async (root) => {
    const before = await preflightIndividualAccreditations(root, ["gam", "gomariz", "mercaeleva"]);
    assert.deepEqual(before.map((context) => context.expected.exclusions.length), [2, 0, 1]);
    const merc = before[2]?.expected.exclusions[0];
    assert.ok(merc);
    const session = inputs("p", "EXCLUIR", "p", "EXCLUIR", "e", reason, merc.sourceUrl, reason, "APROBAR");
    assert.equal(await runAccreditIndividual([], root, session), true);
    assert.equal(session.remaining(), 0);
    const after = await preflightIndividualAccreditations(root, ["gam", "gomariz", "mercaeleva"]);
    assert.ok(after.every((context) => context.existing?.inspection.approved));
    assert.equal(after[1]?.existing?.inspection.total, 0);
    assert.ok(after.every((context) => context.existing?.accreditation.approvalReason?.includes("gam, gomariz, mercaeleva")));
    for (const providerId of ["gam", "gomariz", "mercaeleva"]) {
      await assert.rejects(lstat(join(root, "catalogs", "providers", providerId, "publications")), { code: "ENOENT" });
    }
    assert.equal((await validateIndividualAccreditations(after)).length, 3);
  });
});

test("alteración de preparación o de borrador impide la aprobación y no reescribe artefactos", async () => {
  await withWorkspace(async (root) => {
    assert.equal(await runAccreditIndividual(["--proveedor", "gam"], root, inputs("q")), false);
    const context = await draft(root, "gam");
    const review = await inspectIndividualEditorial(context.options);
    const originalDraft = await readFile(review.draftFile, "utf8");
    await writeFile(review.draftFile, originalDraft.replace('"reference": "11111"', '"reference": "99999"'));
    await assert.rejects(preflightIndividualAccreditations(root, ["gam"]), /caducada/);
    await writeFile(review.draftFile, originalDraft);
    await writeFile(context.options.preparationFile, (await readFile(context.options.preparationFile, "utf8")).replace("11111", "99999"));
    await assert.rejects(preflightIndividualAccreditations(root, ["gam"]), /Manifest|preparación/);
    const state = await readIndividualEditorialState(context.options).catch((error: unknown) => error);
    assert.ok(state instanceof Error);
  });
});

test("rechaza carpeta editorial enlazada antes de crear borradores", async () => {
  await withWorkspace(async (root) => {
    const { symlink } = await import("node:fs/promises");
    const target = join(root, "editorial-fuera");
    await mkdir(target);
    await symlink(target, join(root, "storage", "providers"));
    await assert.rejects(preflightIndividualAccreditations(root, ["gam"]), /no regular/);
    await assert.rejects(lstat(join(target, "gam")), { code: "ENOENT" });
  });
});

test("cambio de preparación justo antes de confirmar impide aprobación incluso sin decisiones", async () => {
  await withWorkspace(async (root) => {
    const context = await draft(root, "gomariz");
    let asked = 0;
    const input: EditorialSessionInput = {
      ask: async (question: string) => {
        asked += 1;
        if (question.startsWith("Motivo global")) return reason;
        if (question.startsWith("Para aprobar")) {
          await writeFile(context.options.preparationFile,
            (await readFile(context.options.preparationFile, "utf8")).replace("gomariz", "mercaeleva"));
          return "APROBAR";
        }
        return "q";
      },
      close: () => undefined
    };
    await assert.rejects(runAccreditIndividual(["--proveedor", "gomariz"], root, input), /Manifest|preparación|Preparación offline/);
    assert.equal(asked, 2);
    const { inspectIndividualEditorial } = await import("../individual-editorial.js");
    const review = await inspectIndividualEditorial(context.options).catch((error: unknown) => error);
    assert.ok(review instanceof Error);
  });
});

test("edición concurrente bloquea decisión y deja borrador sin aprobar", async () => {
  await withWorkspace(async (root) => {
    assert.equal(await runAccreditIndividual(["--proveedor", "gam"], root, inputs("q")), false);
    const context = await draft(root, "gam");
    assert.ok(context.existing);
    const lock = `${context.existing.draftFile}.lock`;
    await writeFile(lock, "edición externa");
    try {
      assert.equal(await runAccreditIndividual(["--proveedor", "gam"], root, inputs("p", "EXCLUIR", "q")), false);
      const current = await draft(root, "gam");
      assert.equal(current.existing?.inspection.completed, 0);
      assert.equal(current.existing?.inspection.approved, false);
    } finally { await rm(lock); }
  });
});

test("sin TTY el comando normal no crea borradores ni consiente aprobaciones", async () => {
  if (process.stdin.isTTY || process.stdout.isTTY) return;
  await withWorkspace(async (root) => {
    assert.equal(await runAccreditIndividual(["--proveedor", "gomariz"], root), false);
    await assert.rejects(lstat(join(root, "storage/providers")), { code: "ENOENT" });
  });
});

test("la preparación compartida de prueba no conserva mutaciones entre workspaces", async () => {
  let original: Buffer | null = null;
  await withWorkspace(async (root) => {
    const context = await draft(root, "gam");
    original = await readFile(context.options.preparationFile);
    await writeFile(context.options.preparationFile, "PREPARACIÓN MODIFICADA");
    await assert.rejects(preflightIndividualAccreditations(root, ["gam"]), /preparación|Preparación|JSON|Manifest/);
  });
  await withWorkspace(async (root) => {
    const context = await draft(root, "gam");
    assert.deepEqual(await readFile(context.options.preparationFile), original);
    assert.equal(context.expected.exclusions.length, 2);
  });
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  advanceIndividualFinishClosure, individualFinishClosurePhase, listIndividualFinishJournals, markIndividualFinishCandidates,
  openIndividualFinishJournal, updateIndividualFinishJournal, withIndividualFinishLock
} from "../../infrastructure/filesystem/catalog/individual-finish-journal.js";
import type { IndividualFinishTarget } from "../../infrastructure/filesystem/catalog/individual-finish-journal.js";
import { formatAccreditationIssues } from "../../cli/reporting/individual-accreditation.js";
import type { AccreditationIssue } from "../../catalog/editorial/campaign-accreditation.js";

const target: IndividualFinishTarget = { providerId: "gam", approvalSha256: "a".repeat(64), previousSha256: null };
const other: IndividualFinishTarget = { providerId: "gomariz", approvalSha256: "b".repeat(64), previousSha256: null };
const workspace = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-journal-f7-"));
  try { await run(root); }
  finally { await rm(root, { recursive: true, force: true }); }
};

test("46 decisiones se agrupan sin ocultar sus 138 requisitos", () => {
  const issues: AccreditationIssue[] = Array.from({ length: 46 }, (_, index) =>
    ["decisión pendiente", "motivo requerido", "evidencia HTTPS requerida"].map((message) => ({
      providerId: "gam", reference: `${1000 + index}`, message
    }))).flat();
  assert.equal(issues.length, 138);
  assert.equal(formatAccreditationIssues(issues, false).length, 46);
  assert.equal(formatAccreditationIssues(issues, true).length, 138);
});

test("consulta no crea storage y candidato impide otro FINISH", async () => {
  await workspace(async (root) => {
    assert.deepEqual(await listIndividualFinishJournals(root), []);
    const { journal } = await openIndividualFinishJournal(root, [target]);
    assert.equal(journal.status, "pending");
    assert.equal(individualFinishClosurePhase(journal), "activated");
    await assert.rejects(openIndividualFinishJournal(root, [other]), /FINISH sin cerrar/);
  });
});

test("diario conserva cierre por etapas, recibo y compatibilidad histórica", async () => {
  await workspace(async (root) => {
    const { path, journal } = await openIndividualFinishJournal(root, [target]);
    await assert.rejects(advanceIndividualFinishClosure(path, journal, "retained"), /activaciones confirmadas/);
    const candidate = await markIndividualFinishCandidates(path, journal);
    assert.equal(candidate.candidatesVerified, true);
    const activated = await updateIndividualFinishJournal(path, candidate, ["gam"]);
    assert.equal(individualFinishClosurePhase(activated), "activated");
    await assert.rejects(advanceIndividualFinishClosure(path, activated, "reported"), /Transición/);
    const retained = await advanceIndividualFinishClosure(path, activated, "retained");
    const file = join(root, "report.zip");
    await writeFile(file, "Informe de prueba");
    const receipt = { path: file, sha256: createHash("sha256").update(await readFile(file)).digest("hex") };
    const closed = await advanceIndividualFinishClosure(path, retained, "reported", receipt);
    assert.equal(individualFinishClosurePhase(closed), "reported");
    assert.deepEqual((await listIndividualFinishJournals(root))[0]?.journal.closure?.report, receipt);
    await assert.rejects(advanceIndividualFinishClosure(path, closed, "retained"), /Transición/);
    assert.equal((await openIndividualFinishJournal(root, [other])).journal.status, "pending");
    await writeFile(path, JSON.stringify({ ...closed, closure: { phase: "reported", report: null } }));
    await assert.rejects(listIndividualFinishJournals(root), /Diario de FINISH inválido/);
  });
});

test("lock impide concurrencia y se libera al fallar", async () => {
  await workspace(async (root) => {
    await assert.rejects(withIndividualFinishLock(root, async () => {
      await assert.rejects(withIndividualFinishLock(root, async () => undefined), /FINISH bloqueado/);
      throw new Error("interrupción");
    }), /interrupción/);
    await withIndividualFinishLock(root, async () => undefined);
  });
});

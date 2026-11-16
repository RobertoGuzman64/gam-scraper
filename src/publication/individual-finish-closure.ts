import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { resolveAccreditedPublication } from "../infrastructure/filesystem/catalog/accredited-publication.js";
import { publicationApprovalSha } from "../infrastructure/filesystem/catalog/publication-identity.js";
import {
  advanceIndividualFinishClosure, individualFinishClosurePhase, openIndividualFinishJournal, withIndividualFinishLock
} from "../infrastructure/filesystem/catalog/individual-finish-journal.js";
import type { IndividualFinishClosurePhase, IndividualFinishJournal, IndividualFinishReportReceipt } from "../infrastructure/filesystem/catalog/individual-finish-journal.js";
import type { IndividualFinishResult } from "./individual-finish.js";
import { readIndividualActiveSha } from "./individual-finish.js";

export type IndividualFinishClosureResult = {
  readonly journalPath: string;
  readonly phase: IndividualFinishClosurePhase;
  readonly executed: readonly IndividualFinishClosurePhase[];
  readonly reportFile: string;
};

type ClosureActions = {
  readonly retention: () => Promise<void>;
  readonly auditor: () => Promise<void>;
  readonly reporter: () => Promise<{ readonly zipFile: string }>;
};

const verifyReport = async (receipt: IndividualFinishReportReceipt): Promise<void> => {
  const metadata = await lstat(receipt.path);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1) {
    throw new Error("Informe FINISH no es un archivo regular e independiente");
  }
  const digest = createHash("sha256").update(await readFile(receipt.path)).digest("hex");
  if (digest !== receipt.sha256) throw new Error("Informe FINISH alterado desde el cierre acreditado");
};

const assertActive = async (workspace: string, journal: IndividualFinishJournal): Promise<void> => {
  if (journal.status !== "complete" || journal.completed.length !== journal.targets.length) {
    throw new Error("FINISH | activaciones incompletas; cerrar está bloqueado");
  }
  for (const target of journal.targets) {
    const active = await readIndividualActiveSha(workspace, target.providerId, target.approvalSha256);
    if (active !== target.approvalSha256) throw new Error(`FINISH | selección activa distinta: ${target.providerId}`);
    const path = await resolveAccreditedPublication(workspace, target.providerId);
    if (!path || await publicationApprovalSha(dirname(path)) !== target.approvalSha256) {
      throw new Error(`FINISH | publicación acreditada no verificable: ${target.providerId}`);
    }
  }
};

export const completeIndividualFinishClosure = async (
  workspace: string, result: IndividualFinishResult, actions: ClosureActions
): Promise<IndividualFinishClosureResult> => {
  if (result.mode !== "complete" || !result.providers.length) throw new Error("FINISH | cierre requiere activaciones reales");
  const root = resolve(workspace);
  return withIndividualFinishLock(root, async () => {
    const targets = result.providers.map((item) => ({
      providerId: item.providerId, approvalSha256: item.approvalSha256, previousSha256: item.activeSha256
    }));
    const { path, journal: original } = await openIndividualFinishJournal(root, targets);
    let journal = original;
    await assertActive(root, journal);
    const executed: IndividualFinishClosurePhase[] = [];
    if (individualFinishClosurePhase(journal) === "activated") {
      try { await actions.retention(); }
      catch (error) {
        throw new Error(`ARCHIVADO PENDIENTE | Publicaciones activas conservadas. Diario: ${path}. ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      }
      await assertActive(root, journal);
      journal = await advanceIndividualFinishClosure(path, journal, "retained");
      executed.push("retained");
    }
    if (individualFinishClosurePhase(journal) === "retained") {
      try { await actions.auditor(); }
      catch (error) {
        throw new Error(`AUDITOR PENDIENTE | Publicaciones activas conservadas. Diario: ${path}. ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      }
      await assertActive(root, journal);
      journal = await advanceIndividualFinishClosure(path, journal, "audited");
      executed.push("audited");
    }
    if (individualFinishClosurePhase(journal) === "audited") {
      let receipt: IndividualFinishReportReceipt;
      try {
        const delivered = await actions.reporter();
        const file = resolve(delivered.zipFile);
        receipt = { path: file, sha256: createHash("sha256").update(await readFile(file)).digest("hex") };
        await verifyReport(receipt);
      } catch (error) {
        throw new Error(`INFORME PENDIENTE | Publicaciones activas conservadas. Diario: ${path}. ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      }
      await assertActive(root, journal);
      journal = await advanceIndividualFinishClosure(path, journal, "reported", receipt);
      executed.push("reported");
    }
    const report = journal.closure?.report;
    if (!report || individualFinishClosurePhase(journal) !== "reported") {
      throw new Error(`FINISH | cierre de diario incompleto: ${path}`);
    }
    await verifyReport(report);
    return { journalPath: path, phase: "reported", executed, reportFile: report.path };
  });
};

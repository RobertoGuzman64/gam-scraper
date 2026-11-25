import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { resolveAccreditedPublication } from "../../infrastructure/filesystem/catalog/publications/accredited-publication.js";
import { publicationApprovalSha } from "../../infrastructure/filesystem/catalog/publications/publication-identity.js";
import {
  advanceIndividualFinishClosure, individualFinishClosurePhase, openIndividualFinishJournal, renewIndividualFinishReport, withIndividualFinishLock
} from "../../infrastructure/filesystem/catalog/publications/individual-finish-journal.js";
import type { IndividualFinishClosurePhase, IndividualFinishJournal, IndividualFinishReportReceipt } from "../../infrastructure/filesystem/catalog/publications/individual-finish-journal.js";
import type { IndividualFinishResult } from "./individual-finish.js";
import { readIndividualActiveSha } from "./individual-finish.js";
import { inspectRepositoryArtifact } from "../../infrastructure/filesystem/catalog/repository-artifact-snapshot.js";

export type IndividualFinishClosureResult = {
  readonly journalPath: string;
  readonly phase: IndividualFinishClosurePhase;
  readonly executed: readonly IndividualFinishClosurePhase[];
  readonly reportFile: string;
};

type ClosureActions = {
  readonly retention: () => Promise<void>;
  readonly reporter: () => Promise<{ readonly reportFile: string }>;
};

const reportDirectory = (workspace: string): string => join(workspace, "catalogs", "reports", "individual-finish");
const internalReportPath = (workspace: string, fingerprint: string): string =>
  join(reportDirectory(workspace), "versions", fingerprint, "INFORME.txt");

const verifyReport = async (workspace: string, receipt: IndividualFinishReportReceipt): Promise<void> => {
  if (receipt.kind === "internal" && receipt.path !== internalReportPath(workspace, receipt.sha256)) {
    throw new Error("Recibo FINISH interno no corresponde a su versión");
  }
  const metadata = await lstat(receipt.path);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1) {
    throw new Error("Informe FINISH no es un archivo regular e independiente");
  }
  const digest = createHash("sha256").update(await readFile(receipt.path)).digest("hex");
  if (digest !== receipt.sha256) throw new Error("Informe FINISH alterado desde el cierre acreditado");
  if (receipt.kind === "internal") {
    const selected = await inspectRepositoryArtifact(reportDirectory(workspace), "INFORME.txt", ["INFORME.txt"]);
    if (!selected || (selected.sha256 !== receipt.sha256 && selected.previousSha256 !== receipt.sha256)) {
      throw new Error("Informe FINISH fuera de la retención interna verificable");
    }
  }
};

const reportWasRetired = async (workspace: string, receipt: IndividualFinishReportReceipt): Promise<boolean> => {
  if (receipt.kind !== "internal" || receipt.path !== internalReportPath(workspace, receipt.sha256)) return false;
  try { await lstat(receipt.path); return false; }
  catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  const selected = await inspectRepositoryArtifact(reportDirectory(workspace), "INFORME.txt", ["INFORME.txt"]);
  return selected !== null && selected.sha256 !== receipt.sha256 && selected.previousSha256 !== receipt.sha256;
};

const retainReportReceipt = async (workspace: string, actions: ClosureActions): Promise<IndividualFinishReportReceipt> => {
  const delivered = await actions.reporter();
  const file = resolve(delivered.reportFile);
  const selected = await inspectRepositoryArtifact(reportDirectory(workspace), "INFORME.txt", ["INFORME.txt"]);
  if (!selected || file !== internalReportPath(workspace, selected.sha256)) throw new Error("Informe FINISH no corresponde a la selección interna vigente");
  const receipt: IndividualFinishReportReceipt = { path: file, sha256: selected.sha256, kind: "internal" };
  await verifyReport(workspace, receipt);
  return receipt;
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
        throw new Error(`RETENCIÓN PENDIENTE | Publicaciones activas conservadas. Diario: ${path}. ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      }
      await assertActive(root, journal);
      journal = await advanceIndividualFinishClosure(path, journal, "retained");
      executed.push("retained");
    }
    if (individualFinishClosurePhase(journal) === "retained") {
      let receipt: IndividualFinishReportReceipt;
      try {
        receipt = await retainReportReceipt(root, actions);
      } catch (error) {
        throw new Error(`INFORME PENDIENTE | Publicaciones activas conservadas. Diario: ${path}. ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      }
      await assertActive(root, journal);
      journal = await advanceIndividualFinishClosure(path, journal, "reported", receipt);
      executed.push("reported");
    }
    let report = journal.closure?.report;
    if (!report || individualFinishClosurePhase(journal) !== "reported") {
      throw new Error(`FINISH | cierre de diario incompleto: ${path}`);
    }
    if (await reportWasRetired(root, report)) {
      try {
        const renewed = await retainReportReceipt(root, actions);
        await assertActive(root, journal);
        journal = await renewIndividualFinishReport(path, journal, renewed);
        report = renewed;
        executed.push("reported");
      } catch (error) {
        throw new Error(`INFORME PENDIENTE | Recibo interno de una versión retirada. Diario: ${path}. ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      }
    }
    await verifyReport(root, report);
    return { journalPath: path, phase: "reported", executed, reportFile: report.path };
  });
};

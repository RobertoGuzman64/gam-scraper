import * as ts from "typescript";
import type { ManualInterventionProposal } from "../../../catalog/interventions/contracts.js";
import { validateInterventionProposals } from "../../../catalog/interventions/proposals.js";

import { resolveInterventionScriptLocation } from "./script-location.js";

export const interventionScriptCampaign = (input: string, workspaceRoot = process.cwd()): string => {
  const location = resolveInterventionScriptLocation(input, workspaceRoot);
  if (location.campaign === null) throw new Error("El script versionado no pertenece a una campaña específica");
  return location.campaign;
};

const rejectRuntimeImports = (sourceFile: ts.SourceFile): void => {
  const check = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) {
      throw new Error("Solo se permiten declaraciones import type en scripts temporales");
    }
    if (ts.isImportEqualsDeclaration(node) || ts.isExportDeclaration(node) ||
      (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword)) {
      throw new Error("No se permiten imports dinámicos ni reexportaciones en scripts temporales");
    }
    ts.forEachChild(node, check);
  };
  check(sourceFile);
};

const formatDiagnostics = (diagnostics: readonly ts.Diagnostic[]): string => ts.formatDiagnosticsWithColorAndContext(
  diagnostics,
  {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => "\n"
  }
);

export const loadInterventionScript = async (
  script: string,
  providerId: string,
  workspaceRoot = process.cwd()
): Promise<readonly ManualInterventionProposal[]> => {
  const location = resolveInterventionScriptLocation(script, workspaceRoot);
  if (location.providerId !== null && location.providerId !== providerId) {
    throw new Error(`El script versionado pertenece a ${location.providerId}, no a ${providerId}`);
  }
  const scriptPath = location.path;
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    skipLibCheck: true,
    noEmit: true
  };
  const program = ts.createProgram([scriptPath], compilerOptions);
  const sourceFile = program.getSourceFile(scriptPath);
  if (!sourceFile) throw new Error("No se pudo leer el TypeScript de la intervención");
  rejectRuntimeImports(sourceFile);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length) throw new Error(`TypeScript inválido:\n${formatDiagnostics(diagnostics)}`);
  const result = ts.transpileModule(sourceFile.text, {
    fileName: scriptPath,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
  });
  const url = `data:text/javascript;base64,${Buffer.from(result.outputText).toString("base64")}`;
  const loaded: unknown = await import(url);
  if (typeof loaded !== "object" || loaded === null || !("proposals" in loaded)) {
    throw new Error("El script debe exportar una constante llamada proposals");
  }
  return validateInterventionProposals(loaded.proposals, providerId);
};

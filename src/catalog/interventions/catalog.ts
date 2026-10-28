import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import * as ts from "typescript";
import type { InterventionMetadata, ManualInterventionProposal } from "./contracts.js";
import { validateInterventionProposals } from "./proposals.js";
import { resolveInterventionScriptLocation } from "../../infrastructure/filesystem/intervention-scripts/script-location.js";

export type CatalogIntervention = {
  readonly script: string;
  readonly metadata: InterventionMetadata;
  readonly providerId: string;
  readonly identities: readonly string[];
  readonly fields: readonly string[];
  readonly proposals: readonly ManualInterventionProposal[];
};

const literal = (node: ts.Expression): unknown => {
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
    return literal(node.expression);
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)) return -Number(node.operand.text);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map((entry) => {
    if (ts.isSpreadElement(entry) || ts.isOmittedExpression(entry)) {
      throw new Error("No se permiten elementos dinámicos en proposals");
    }
    return literal(entry);
  });
  if (ts.isObjectLiteralExpression(node)) {
    const value: Record<string, unknown> = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property) ||
        (!ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name))) {
        throw new Error("Solo se admiten propiedades literales en el catálogo");
      }
      const key = property.name.text;
      if (key === "__proto__" || Object.hasOwn(value, key)) {
        throw new Error(`Propiedad duplicada o no permitida: ${key}`);
      }
      value[key] = literal(property.initializer);
    }
    return value;
  }
  throw new Error("El catálogo solo admite valores literales; no se ejecutan expresiones TypeScript");
};

const isExported = (node: ts.VariableStatement): boolean =>
  node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) === true;

const parseDeclarations = (path: string): ReadonlyMap<string, unknown> => {
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.ES2022, true);
  const diagnostics = ts.transpileModule(source.text, {
    fileName: path,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
  }).diagnostics ?? [];
  if (diagnostics.length) throw new Error("El script tiene errores de sintaxis TypeScript");
  const values = new Map<string, unknown>();
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && statement.importClause?.isTypeOnly === true) continue;
    if (!ts.isVariableStatement(statement) || !isExported(statement) ||
      (statement.declarationList.flags & ts.NodeFlags.Const) === 0 ||
      statement.declarationList.declarations.length !== 1) {
      throw new Error("El catálogo solo permite import type y export const de metadata/proposals");
    }
    const declaration = statement.declarationList.declarations[0];
    if (!declaration || !ts.isIdentifier(declaration.name) || !declaration.initializer ||
      (declaration.name.text !== "metadata" && declaration.name.text !== "proposals") ||
      values.has(declaration.name.text)) {
      throw new Error("El script debe declarar metadata y proposals una sola vez");
    }
    values.set(declaration.name.text, literal(declaration.initializer));
  }
  if (values.size !== 2 || !values.has("metadata") || !values.has("proposals")) {
    throw new Error("El script versionado debe exportar metadata y proposals");
  }
  return values;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseMetadata = (input: unknown, providerId: string): InterventionMetadata => {
  if (!isRecord(input) ||
    Object.keys(input).length !== 2 || !Object.hasOwn(input, "id") || !Object.hasOwn(input, "summary")) {
    throw new Error("metadata debe contener exclusivamente id y summary");
  }
  const id = input.id;
  const summary = input.summary;
  if (typeof id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || !id.startsWith(`${providerId}-`)) {
    throw new Error(`metadata.id debe ser estable y comenzar por ${providerId}-`);
  }
  if (typeof summary !== "string" || !summary.trim() || summary !== summary.trim()) {
    throw new Error("metadata.summary debe ser texto descriptivo no vacío y sin espacios exteriores");
  }
  return { id, summary };
};

export const readCatalogIntervention = (script: string, workspaceRoot = process.cwd()): CatalogIntervention => {
  const location = resolveInterventionScriptLocation(script, workspaceRoot);
  if (location.providerId === null) throw new Error("Solo se catalogan scripts versionados permanentes");
  const declarations = parseDeclarations(location.path);
  const providerId = location.providerId;
  const metadata = parseMetadata(declarations.get("metadata"), providerId);
  const proposals = validateInterventionProposals(declarations.get("proposals"), providerId);
  return {
    script: relative(workspaceRoot, location.path).split(sep).join("/"),
    metadata,
    providerId,
    identities: [...new Set(proposals.map((proposal) => proposal.identity))],
    fields: [...new Set(proposals.map((proposal) => proposal.field))],
    proposals
  };
};

export const readInterventionCatalog = (providerId: string, workspaceRoot = process.cwd()): readonly CatalogIntervention[] => {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(providerId)) throw new Error("Proveedor inválido");
  const directory = join(workspaceRoot, "interventions", providerId);
  if (!existsSync(directory)) return [];
  const entries = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts"))
    .sort((a, b) => a.name.localeCompare(b.name));
  const seen = new Set<string>();
  return entries.map((entry) => {
    const path = join(directory, entry.name);
    try {
      const intervention = readCatalogIntervention(path, workspaceRoot);
      if (intervention.providerId !== providerId) throw new Error("Script de otro proveedor");
      if (seen.has(intervention.metadata.id)) throw new Error(`Identificador duplicado: ${intervention.metadata.id}`);
      seen.add(intervention.metadata.id);
      return intervention;
    } catch (error: unknown) {
      throw new Error(`${basename(path)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
};

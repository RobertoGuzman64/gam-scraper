import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ts, makeProject, reachable, visitNodes, isTest, nameOf,
  findIssue, uniqueFindings, optionsFrom, present, digest
} from "./guards-architecture-core.mjs";

const providerEditorial = /^src\/preparation\/(?:gam|gomariz|mercaeleva)\/editorial\//u;
const sharedEditorial = /^src\/preparation\/shared\/editorial\//u;
const sharedDomain = /^src\/preparation\/shared\/editorial\/domain\//u;
const trustedSourceAdapters = new Set([
  "src/preparation/gam/editorial/source/domain-source.ts",
  "src/preparation/gomariz/editorial/mapping/domain-source.ts",
  "src/preparation/mercaeleva/editorial/mapping/domain-source.ts"
]);
const dispatch = "src/preparation/shared/editorial/domain/editorial-source.ts";
const textualFields = new Set(["description", "description_general", "short", "general"]);
const narrativeNames = /(?:description|general|short|summary|title|editorial)/iu;

export const inspectEditorialArchitecture = (root) => {
  const project = makeProject(root);
  const active = reachable(project, [
    "src/preparation/prepare-product.ts",
    "src/commercial/projection/presentation-projection.ts"
  ]);
  const issues = [];
  const push = (rule, path, node, detail, signature) => {
    const source = project.files.get(path);
    if (source) issues.push(findIssue(rule, path, source, node, detail, signature));
  };

  const entry = "src/preparation/prepare-product.ts";
  const preparation = project.files.get(entry);
  if (!preparation) throw new Error(`Falta el punto de entrada: ${entry}`);
  const code = preparation.text;
  if (!/\bresolvePreparedEditorial\s*\(/u.test(code) || ![...project.dependencies.get(entry) ?? []]
    .includes("src/preparation/shared/editorial/mapping/prepared-editorial.ts")) {
    push("E-ENTRYPOINT", entry, undefined, "La preparación debe invocar al propietario editorial compartido");
  }

  for (const [path, source] of project.files) {
    if (isTest(path) || !path.startsWith("src/")) continue;
    const connected = active.has(path);
    if (connected && providerEditorial.test(path) && !trustedSourceAdapters.has(path)) {
      push("E-ACTIVE-PROVIDER-NARRATOR", path, undefined,
        "Módulo editorial específico alcanzable desde preparación/exportación; revisar propiedad de redacción");
    }
    if (!connected && providerEditorial.test(path)) {
      let narrative = null;
      visitNodes(source, (node) => {
        if (!narrative && ts.isFunctionDeclaration(node) && node.name && narrativeNames.test(node.name.text)) narrative = node.name;
        if (!narrative && ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && narrativeNames.test(node.name.text) &&
          node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) narrative = node.name;
      });
      if (narrative) push("E-LEGACY-NARRATOR", path, narrative,
        "Módulo narrativo específico aislado: clasificar conocimiento/evidencia antes de retirarlo",
        `legacy:${narrative.getText(source)}:${digest(source.text)}`);
    }
    if (sharedDomain.test(path) && path !== dispatch) {
      const vendorImports = (project.dependencies.get(path) ?? []).filter((dep) => providerEditorial.test(dep));
      if (vendorImports.length > 0) push("E-DOMAIN-DEPENDENCY", path, undefined,
        `El dominio general depende de adaptadores editoriales: ${vendorImports.join(", ")}`);
    }
    visitNodes(source, (node) => {
      if (sharedDomain.test(path) && path !== dispatch && ts.isPropertyAccessExpression(node) &&
        node.name.text === "providerId" && node.parent && ts.isBinaryExpression(node.parent) &&
        [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken,
          ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(node.parent.operatorToken.kind)) {
        push("E-DOMAIN-PROVIDER-BRANCH", path, node.parent,
          "El dominio común selecciona comportamiento según proveedor; debe justificarse en un adaptador");
      }
      if (sharedEditorial.test(path) && !path.includes("/evidence/") && ts.isBinaryExpression(node) &&
        [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(node.operatorToken.kind) &&
        ((ts.isPropertyAccessExpression(node.left) && node.left.name.text === "reference" && ts.isStringLiteralLike(node.right)) ||
          (ts.isPropertyAccessExpression(node.right) && node.right.name.text === "reference" && ts.isStringLiteralLike(node.left)))) {
        push("E-HARDCODED-REFERENCE", path, node,
          "Comparación con referencia literal en el compositor/mapping compartido");
      }
      if (connected && providerEditorial.test(path) && ts.isPropertyAssignment(node) &&
        textualFields.has(nameOf(node.name)) &&
        (ts.isTemplateExpression(node.initializer) || ts.isBinaryExpression(node.initializer) ||
          (ts.isCallExpression(node.initializer) && narrativeNames.test(node.initializer.expression.getText(source))))) {
        push("E-PROVIDER-COMPOSITION", path, node,
          "El adaptador conectado compone texto editorial en vez de aportar hechos acreditados");
      }
      if (path.startsWith("src/catalog/editorial/") && !isTest(path) && ts.isPropertyAssignment(node) &&
        ["description", "description_general", "description_title", "title"].includes(nameOf(node.name)) &&
        !(ts.isPropertyAccessExpression(node.initializer) && node.initializer.expression.getText(source) === "product")) {
        push("E-POST-PREP-EDITORIAL", path, node,
          "La selección/publicación reescribe texto después de la composición compartida");
      }
      if (path.startsWith("src/catalog/editorial/") && !isTest(path) && ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(node.left) &&
        ["description", "description_general", "title"].includes(node.left.name.text)) {
        push("E-POST-PREP-EDITORIAL-ASSIGNMENT", path, node,
          "El catálogo editorial reasigna un campo redactado después de preparación");
      }
      if (path.startsWith("src/commercial/projection/") && connected && ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(node.left) &&
        ["description", "description_general", "shortDescription", "longDescription"].includes(node.left.name.text)) {
        push("E-PROJECTION-MUTATION", path, node,
          "La proyección comercial modifica un campo editorial");
      }
      if (path === "src/commercial/projection/presentation-projection.ts" && ts.isPropertyAssignment(node) &&
        ["description", "description_general"].includes(nameOf(node.name)) &&
        node.initializer.getText(source) !== `published.${nameOf(node.name)}`) {
        push("E-PROJECTION-REWRITE", path, node,
          "La exportación debe transferir el texto preparado sin reescribirlo");
      }
    });
  }
  const projection = project.files.get("src/commercial/projection/presentation-projection.ts");
  if (!projection) throw new Error("Falta la proyección comercial protegida");
  for (const field of ["description", "description_general"]) {
    if (!new RegExp(`\\b${field}:\\s*published\\.${field}\\b`, "u").test(projection.text)) {
      push("E-PROJECTION-CONTRACT", "src/commercial/projection/presentation-projection.ts", undefined,
        `Falta la proyección directa de ${field}`, `projection-${field}`);
    }
  }
  return { findings: uniqueFindings(issues), files: project.files.size, reachable: active.size };
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = optionsFrom(process.argv.slice(2));
    const result = inspectEditorialArchitecture(options.root);
    console.log(`EDITORIAL | ${result.files} TS inspeccionados | ${result.reachable} módulos alcanzables`);
    process.exitCode = present("GUARD ARQUITECTURA EDITORIAL", result.findings, options).exitCode;
  } catch (error) {
    console.error(`ERROR | GUARD ARQUITECTURA EDITORIAL | ${error.message}`);
    process.exitCode = 2;
  }
}

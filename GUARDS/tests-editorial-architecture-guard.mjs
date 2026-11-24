import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ts, makeProject, reachable, visitNodes, isTest, nameOf,
  findIssue, uniqueFindings, optionsFrom, present, digest
} from "./guards-architecture-core.mjs";

const providerEditorial = /^src\/preparation\/(?!shared\/)[^/]+\/editorial\//u;
const sharedEditorial = /^src\/preparation\/editorial\//u;
const sharedDomain = /^src\/preparation\/editorial\/core\/editorial-[^/]+\.ts$/u;
const sharedMapping = /^src\/preparation\/editorial\//u;
const trustedSourceAdapter = /^src\/preparation\/[^/]+\/editorial\/(?:source|mapping)\/domain-source\.ts$/u;
const dispatch = "src/preparation/editorial/core/editorial-source.ts";
const textualFields = new Set(["description", "description_general", "short", "general"]);
const narrativeNames = /(?:description|general|short|summary|title|editorial)/iu;
const editorialFields = new Set(["description", "description_general", "shortDescription", "longDescription", "title"]);
const matchesMember = (node, name) =>
  ts.isPropertyAccessExpression(node) && node.name.text === name ||
  ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression) &&
    node.argumentExpression.text === name;
const hasReference = (node) => matchesMember(node, "reference");
const providerCondition = (condition, aliases) => {
  let matched = false;
  const check = (node) => {
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken,
      ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(node.operatorToken.kind) &&
      ((ts.isStringLiteralLike(node.left) && (matchesMember(node.right, "providerId") ||
        ts.isIdentifier(node.right) && aliases.has(node.right.text))) ||
        (ts.isStringLiteralLike(node.right) && (matchesMember(node.left, "providerId") ||
          ts.isIdentifier(node.left) && aliases.has(node.left.text))))) matched = true;
    ts.forEachChild(node, check);
  };
  check(condition);
  return matched;
};
const narrativeLiteral = (node) => {
  if (ts.isStringLiteralLike(node)) return node.text.trim().length >= 10 &&
    /\p{L}[^\p{L}]+\p{L}/u.test(node.text) && !/^https?:\/\//iu.test(node.text);
  if (ts.isTemplateExpression(node)) return node.head.text.trim().length >= 10 &&
    /\s/u.test(node.head.text);
  if (ts.isParenthesizedExpression(node)) return narrativeLiteral(node.expression);
  if (ts.isReturnStatement(node)) return Boolean(node.expression && narrativeLiteral(node.expression));
  if (ts.isBlock(node)) return node.statements.some((statement) => narrativeLiteral(statement));
  if (ts.isIfStatement(node)) return narrativeLiteral(node.thenStatement) ||
    Boolean(node.elseStatement && narrativeLiteral(node.elseStatement));
  if (ts.isVariableStatement(node)) return node.declarationList.declarations.some((declaration) =>
    ts.isIdentifier(declaration.name) && narrativeNames.test(declaration.name.text) &&
    Boolean(declaration.initializer && narrativeLiteral(declaration.initializer)));
  if (ts.isObjectLiteralExpression(node)) return node.properties.some((property) =>
    ts.isPropertyAssignment(property) && editorialFields.has(nameOf(property.name)) && narrativeLiteral(property.initializer));
  return false;
};
const referenceAliases = (source) => {
  const aliases = new Set();
  const collections = new Set();
  const declarations = [];
  visitNodes(source, (node) => {
    if (ts.isVariableDeclaration(node) && node.initializer) declarations.push(node);
  });
  let changed = true;
  while (changed) {
    changed = false;
    for (const declaration of declarations) {
      const { name, initializer } = declaration;
      if (ts.isObjectBindingPattern(name)) {
        if (name.elements.some((element) => nameOf(element.propertyName ?? element.name) === "reference" &&
          ts.isIdentifier(element.name) && !aliases.has(element.name.text))) {
          for (const element of name.elements) {
            if (nameOf(element.propertyName ?? element.name) === "reference" && ts.isIdentifier(element.name)) {
              aliases.add(element.name.text);
              changed = true;
            }
          }
        }
      } else if (ts.isIdentifier(name) && !aliases.has(name.text) &&
        (hasReference(initializer) || ts.isIdentifier(initializer) && aliases.has(initializer.text))) {
        aliases.add(name.text);
        changed = true;
      }
      if (ts.isIdentifier(name) && !collections.has(name.text) &&
        (ts.isArrayLiteralExpression(initializer) && initializer.elements.some(ts.isStringLiteralLike) ||
          ts.isNewExpression(initializer) && initializer.expression.getText(source) === "Set" &&
          initializer.arguments?.some((argument) => ts.isArrayLiteralExpression(argument) &&
            argument.elements.some(ts.isStringLiteralLike)))) {
        collections.add(name.text);
        changed = true;
      }
    }
  }
  return { aliases, collections };
};
const referenceExpression = (node, aliases) => hasReference(node) || ts.isIdentifier(node) && aliases.has(node.text);
const memberTransfer = (node, name) => matchesMember(node, name) &&
  (ts.isIdentifier(node.expression) || ts.isPropertyAccessExpression(node.expression));

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
    .includes("src/preparation/editorial/core/prepared-editorial.ts")) {
    push("E-ENTRYPOINT", entry, undefined, "La preparación debe invocar al propietario editorial compartido");
  }

  for (const [path, source] of project.files) {
    if (isTest(path) || !path.startsWith("src/")) continue;
    const connected = active.has(path);
    if (connected && providerEditorial.test(path) && !trustedSourceAdapter.test(path)) {
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
    const { aliases, collections } = referenceAliases(source);
    const providerAliases = new Set();
    visitNodes(source, (node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer &&
        matchesMember(node.initializer, "providerId")) providerAliases.add(node.name.text);
    });
    visitNodes(source, (node) => {
      if (sharedDomain.test(path) && path !== dispatch && ts.isPropertyAccessExpression(node) &&
        node.name.text === "providerId" && node.parent && ts.isBinaryExpression(node.parent) &&
        [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken,
          ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(node.parent.operatorToken.kind)) {
        push("E-DOMAIN-PROVIDER-BRANCH", path, node.parent,
          "El dominio común selecciona comportamiento según proveedor; debe justificarse en un adaptador");
      }
      if (sharedMapping.test(path) &&
        ((ts.isConditionalExpression(node) && providerCondition(node.condition, providerAliases) &&
          (narrativeLiteral(node.whenTrue) || narrativeLiteral(node.whenFalse))) ||
          (ts.isIfStatement(node) && providerCondition(node.expression, providerAliases) &&
            (narrativeLiteral(node.thenStatement) || node.elseStatement && narrativeLiteral(node.elseStatement))))) {
        push("E-MAPPING-PROVIDER-NARRATIVE", path, node,
          "La selección por proveedor introduce texto narrativo en el mapping común");
      }
      if (sharedEditorial.test(path) && !path.includes("/evidence/") &&
        ((ts.isBinaryExpression(node) &&
          [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(node.operatorToken.kind) &&
          ((ts.isStringLiteralLike(node.left) && referenceExpression(node.right, aliases)) ||
            (ts.isStringLiteralLike(node.right) && referenceExpression(node.left, aliases)))) ||
          (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
            ["includes", "has"].includes(node.expression.name.text) &&
            node.arguments.some((argument) => referenceExpression(argument, aliases)) &&
            (ts.isArrayLiteralExpression(node.expression.expression) &&
              node.expression.expression.elements.some(ts.isStringLiteralLike) ||
              ts.isIdentifier(node.expression.expression) && collections.has(node.expression.expression.text) ||
              ts.isNewExpression(node.expression.expression) &&
              node.expression.expression.arguments?.some((argument) => ts.isArrayLiteralExpression(argument) &&
                argument.elements.some(ts.isStringLiteralLike)))))) {
        push("E-HARDCODED-REFERENCE", path, node,
          "La lógica editorial identifica una unidad mediante referencia literal, directa o indirecta");
      }
      if (connected && providerEditorial.test(path) && ts.isPropertyAssignment(node) &&
        textualFields.has(nameOf(node.name)) &&
        (ts.isStringLiteralLike(node.initializer) || ts.isTemplateExpression(node.initializer) ||
          ts.isBinaryExpression(node.initializer) ||
          (ts.isCallExpression(node.initializer) && narrativeNames.test(node.initializer.expression.getText(source))))) {
        push("E-PROVIDER-COMPOSITION", path, node,
          "El adaptador conectado compone texto editorial en vez de aportar hechos acreditados");
      }
      if (connected && trustedSourceAdapter.test(path) && ts.isReturnStatement(node) &&
        node.expression && narrativeLiteral(node.expression)) {
        push("E-SOURCE-ADAPTER-NARRATIVE", path, node,
          "Un adaptador de origen produce texto narrativo en vez de hechos técnicos");
      }
      if (path.startsWith("src/publication/") && ts.isPropertyAssignment(node) &&
        editorialFields.has(nameOf(node.name)) && !memberTransfer(node.initializer, nameOf(node.name))) {
        push("E-PUBLICATION-REWRITE", path, node,
          "La publicación debe transferir campos editoriales preparados sin recomponerlos");
      }
      if (path.startsWith("src/publication/") && ts.isBinaryExpression(node) &&
        [ts.SyntaxKind.EqualsToken, ts.SyntaxKind.PlusEqualsToken].includes(node.operatorToken.kind) &&
        [...editorialFields].some((name) => matchesMember(node.left, name))) {
        push("E-PUBLICATION-MUTATION", path, node,
          "La publicación modifica el texto preparado");
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

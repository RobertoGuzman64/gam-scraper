import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ts, makeProject, reachable, visitNodes, isTest, nameOf,
  findIssue, uniqueFindings, optionsFrom, present, digest
} from "./guards-architecture-core.mjs";

const providerEditorial = /^src\/preparation\/[^/]+\/editorial\//u;
const providerModule = /^src\/preparation\/(?!classification\/|documents\/|editorial\/|product\/|provenance\/|quality\/|technical\/|testing\/|tests\/|workflow\/)[^/]+\//u;
const sharedEditorial = /^src\/preparation\/editorial\//u;
const sourcedContext = /^src\/preparation\/editorial\/source\/context\/[^/]+\.ts$/u;
const sharedDomain = /^src\/preparation\/editorial\/core\/editorial-[^/]+\.ts$/u;
const sharedMapping = /^src\/preparation\/editorial\//u;
const trustedSourceAdapter = /^src\/preparation\/[^/]+\/(?:domain-source|editorial\/(?:source|mapping)\/domain-source)\.ts$/u;
const dispatch = "src/preparation/editorial/core/editorial-source.ts";
const textualFields = new Set(["description", "description_general", "short", "general"]);
const narrativeNames = /(?:description|general|short|summary|title|editorial)/iu;
const providerNarrativeName = /^(?:(?:general|short|description|summary)For|(?:compose|build|create|write|generate|resolve)[A-Z].*(?:General|Short|Description|Summary))/u;
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
const runtimeComposition = (node) => {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isFunctionLike(parent)) return true;
    if (ts.isSourceFile(parent)) return false;
  }
  return false;
};
const providerNarrator = (source) => {
  let narrative = null;
  visitNodes(source, (node) => {
    if (narrative) return;
    if (ts.isFunctionDeclaration(node) && node.name && providerNarrativeName.test(node.name.text) &&
      node.body && narrativeLiteral(node.body)) narrative = node.name;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && providerNarrativeName.test(node.name.text) &&
      node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) &&
      narrativeLiteral(node.initializer.body)) narrative = node.name;
  });
  return narrative;
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

const documentaryEvidenceFields = new Set(["models", "technicalReferences", "catalogReferences", "modelReference"]);
const technicalEvidenceModule = /(?:^src\/contracts\/technical-provenance\.ts$|^src\/preparation\/provenance\/)/u;
const enclosingFunction = (node) => {
  for (let parent = node; parent; parent = parent.parent) {
    if (!ts.isFunctionLike(parent)) continue;
    if (parent.name) return nameOf(parent.name);
    if (parent.parent && ts.isVariableDeclaration(parent.parent)) return nameOf(parent.parent.name);
  }
  return null;
};
const boundaryMember = (node) => {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) return node.argumentExpression.text;
  if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) return nameOf(node.propertyName ?? node.name);
  if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) return nameOf(node.name);
  return null;
};
const documentaryBoundary = (project, path, source, push) => {
  const dependencies = project.dependencies.get(path) ?? [];
  const consumers = [...project.dependencies].filter(([, imports]) => imports.includes(path)).map(([consumer]) => consumer);
  const downstream = consumers.filter((consumer) => !isTest(consumer));
  const tests = consumers.filter(isTest);
  const context = (node) => {
    const owner = enclosingFunction(node);
    return `${owner ? ` | función: ${owner}` : ""} | consumidores directos: ${downstream.join(", ") || "ninguno"}` +
      ` | tests consumidores directos a revisar: ${tests.join(", ") || "ninguno"}`;
  };
  const raw = dependencies.filter((dependency) => technicalEvidenceModule.test(dependency));
  if (raw.length > 0) {
    const imports = [];
    visitNodes(source, (node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier) &&
        /(?:\/technical-provenance(?:\.js)?$|\/provenance\/)/u.test(node.moduleSpecifier.text)) imports.push(node);
    });
    const node = imports[0] ?? source;
    push("E-DOCUMENTARY-PROVENANCE-BOUNDARY", path, node,
      `La composición no recibe el expediente de procedencia técnica (${raw.join(", ")}); conservarlo en recuperación y acreditación, entregar hechos aptos para redacción${context(node)}`);
  }
  visitNodes(source, (node) => {
    const field = boundaryMember(node);
    if (!documentaryEvidenceFields.has(field)) return;
    const rule = field === "modelReference" ? "E-DOCUMENTARY-NARRATIVE-CHANNEL" : "E-DOCUMENTARY-MODEL-EVIDENCE";
    const detail = field === "modelReference" ?
      "Retirar el canal narrativo de referencias de modelo; no retirar el conocimiento técnico" :
      `La composición accede a evidencia cruda de modelo (${field}); trasladar su consumo a la acreditación de hechos, no a la redacción`;
    push(rule, path, node, `${detail}${context(node)}`);
  });
};

const documentaryTestExpectation = (source, path, push) => {
  const knownJustification = /documentaci[oó]n t[eé]cnica (?:de referencia )?del modelo|otras fichas del cat[aá]logo|prestaciones de referencia del modelo|no acreditan la configuraci[oó]n ni las prestaciones de esta unidad|las magnitudes corresponden al modelo o versi[oó]n documentada/iu;
  visitNodes(source, (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression) ||
      node.expression.expression.getText(source) !== "assert" || node.expression.name.text !== "match") return;
    const expected = node.arguments[1];
    if (!expected || !ts.isRegularExpressionLiteral(expected) || !knownJustification.test(expected.text)) return;
    let title = null;
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isCallExpression(parent) && ts.isIdentifier(parent.expression) && parent.expression.text === "test" &&
        parent.arguments[0] && ts.isStringLiteralLike(parent.arguments[0])) {
        title = parent.arguments[0].text;
        break;
      }
    }
    push("E-DOCUMENTARY-TEST-EXPECTATION", path, node,
      `La prueba exige una fórmula de justificación documental; revisar el contrato de redacción, conservar las comprobaciones de valor y procedencia${title ? ` | test: ${title}` : ""}`);
  });
};

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
    if (isTest(path)) {
      if (sharedEditorial.test(path)) documentaryTestExpectation(source, path, push);
      continue;
    }
    if (!path.startsWith("src/")) continue;
    const connected = active.has(path);
    if (sharedEditorial.test(path)) documentaryBoundary(project, path, source, push);
    const narrative = providerModule.test(path) ? providerNarrator(source) : null;
    if (connected && providerModule.test(path) && !trustedSourceAdapter.test(path) &&
      (providerEditorial.test(path) || narrative)) {
      push("E-ACTIVE-PROVIDER-NARRATOR", path, narrative,
        "Módulo narrativo específico alcanzable desde preparación/exportación; revisar propiedad de redacción");
    }
    if (!connected && providerModule.test(path)) {
      let legacy = narrative;
      if (!legacy && providerEditorial.test(path)) {
        visitNodes(source, (node) => {
          if (!legacy && ts.isFunctionDeclaration(node) && node.name && narrativeNames.test(node.name.text)) legacy = node.name;
          if (!legacy && ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && narrativeNames.test(node.name.text) &&
            node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) legacy = node.name;
        });
      }
      if (legacy) push("E-LEGACY-NARRATOR", path, legacy,
        "Módulo narrativo específico aislado: clasificar conocimiento/evidencia antes de retirarlo",
        `legacy:${legacy.getText(source)}:${digest(source.text)}`);
    }
    if (sourcedContext.test(path)) {
      const providerImports = [...project.dependencies.get(path) ?? []].filter((dependency) =>
        providerModule.test(dependency));
      if (providerImports.length > 0) push("E-SOURCE-CONTEXT-PROVIDER-DEPENDENCY", path, undefined,
        `El contexto editorial reutilizable depende directamente de un proveedor: ${providerImports.join(", ")}`);
    }
    if (sharedDomain.test(path) && path !== dispatch) {
      const vendorImports = (project.dependencies.get(path) ?? []).filter((dep) =>
        providerEditorial.test(dep) || project.files.has(dep) && providerModule.test(dep) &&
        providerNarrator(project.files.get(dep)));
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
      if (connected && providerModule.test(path) && ts.isPropertyAssignment(node) &&
        (providerEditorial.test(path) || runtimeComposition(node)) && textualFields.has(nameOf(node.name)) &&
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

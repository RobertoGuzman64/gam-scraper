import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ts, makeProject, visitNodes, isTest, findIssue,
  uniqueFindings, optionsFrom, present
} from "./guards-architecture-core.mjs";

const monitoredTest = (path) => isTest(path) && /^(?:src|scripts)\//u.test(path);
const domainTest = (path) => isTest(path) &&
  /^(?:src\/preparation\/(?!workflow\/)|src\/catalog\/(?:normalization|reference|validation|diagnostics|editorial|coverage)\/|src\/commercial\/(?:validation|diagnostics|projection)\/|src\/(?:domain|normalization|reconciliation)\/)/u.test(path);
const localTestSupport = (path) => !isTest(path) && /\/tests\//u.test(path);
const supportModule = (path) => !isTest(path) &&
  /^(?:src\/testing\/|scripts\/testing\/)|\/fixtures?\/|(?:^|\/)[\w-]*fixture\.(?:ts|tsx|mts|js|mjs)$/u.test(path) ||
  localTestSupport(path);
const catalogPath = (value) => /catalogs\s*[/\\]\s*providers\s*[/\\]/iu.test(value) &&
  /(?:original|publications|technical|catalog\.json|publishable)/iu.test(value);
const historicalFixture = (value) => /(?:src\/testing\/fixtures\/|testing\/fixtures\/)/iu.test(value) &&
  /(?:regression[-_/]\d+|(?:scrape|catalog)[\w-]*20\d\d|(?:catalog|publishable)\.json)/iu.test(value);

const testingRoots = new Set(["builders", "fixtures", "integration"]);
const integrationRoots = new Set(["catalog", "commercial", "preparation"]);
const establishedPreparationHelpers = new Set([
  "src/preparation/testing/category-slug-resolver.ts",
  "src/preparation/testing/gam-verified-basket-dimensions.ts",
  "src/preparation/testing/mapping-fixtures.ts",
  "src/preparation/testing/require-product-reference.ts",
  "src/preparation/testing/preparation-fixtures.ts",
  "src/preparation/testing/prepare-cached.ts"
]);
const testOrchestrator = /(?:^|[-_.])(?:runner|reporter|orchestrator|scheduler|test-executor|test-worker)(?:[-_.]|$)/iu;
const restrictedExecutionModule = new Set(["node:child_process", "child_process", "node:worker_threads", "worker_threads"]);

const testSuiteLocation = (path) => {
  if (path.startsWith("src/testing/")) {
    return path.startsWith("src/testing/integration/") || path.startsWith("src/testing/builders/tests/");
  }
  return path.includes("/tests/") || /^src\/preparation\/.+\.test\.ts$/u.test(path);
};

const checkTestLayout = (project, visit) => {
  const testingDirectory = join(project.root, "src", "testing");
  if (existsSync(testingDirectory)) {
    for (const entry of readdirSync(testingDirectory, { withFileTypes: true })) {
      if (!testingRoots.has(entry.name) || !entry.isDirectory()) {
        visit("T-TESTING-ROOT", `src/testing/${entry.name}`,
          "El soporte compartido de tests solo puede estar en builders, fixtures o integration");
      }
    }
  }
  const integrationDirectory = join(testingDirectory, "integration");
  if (existsSync(integrationDirectory)) {
    const pending = [{ directory: integrationDirectory, path: "src/testing/integration" }];
    while (pending.length > 0) {
      const current = pending.pop();
      for (const entry of readdirSync(current.directory, { withFileTypes: true })) {
        const path = `${current.path}/${entry.name}`;
        if (entry.isDirectory()) {
          pending.push({ directory: join(current.directory, entry.name), path });
        } else if (entry.isFile()) {
          const area = path.split("/")[3];
          if (!integrationRoots.has(area)) {
            visit("T-INTEGRATION-AREA", path, "La integración debe seguir un área productiva acreditada");
          }
          if (!path.endsWith(".test.ts")) {
            visit("T-INTEGRATION-SUPPORT", path,
              "Las fixtures y los helpers deben vivir fuera de integration/");
          }
        }
      }
    }
  }
  for (const [path, source] of project.files) {
    const oldDataPath = /(?:src[\\/])?testing[\\/]fixtures[\\/][^'"`\n]{0,160}(?:\.json|\.evidence|\.zip)/iu;
    const segmentedDataPath = /["'`]testing["'`]\s*,\s*["'`]fixtures["'`][\s\S]{0,150}(?:catalog|regression[-_]\d+|published-snapshot)/iu;
    if ((isTest(path) || supportModule(path)) && (oldDataPath.test(source.text) || segmentedDataPath.test(source.text) || /(?:accredited-source-samples|published-snapshot\.evidence|(?:src[\\/])?testing[\\/]domain-cases[\\/]data)/iu.test(source.text))) {
      visit("T-RETIRED-DATASET", path, "Prohibido recuperar loaders o rutas de datasets históricos eliminados");
    }
    if (isTest(path) && path.startsWith("src/") && !path.endsWith(".test.ts")) {
      visit("T-TEST-DISCOVERY", path,
        "El runner solo descubre archivos *.test.ts en src/; esta suite quedaría sin ejecutar");
    }
    if (isTest(path) && path.startsWith("src/") && !testSuiteLocation(path)) {
      visit("T-TEST-LOCATION", path,
        "Las suites deben vivir junto al módulo en tests/, en la integración compartida o en los tests técnicos GAM ya existentes");
    }
    if (/^src\/(?!testing\/)(?:[^/]+\/)+testing\//u.test(path) && !establishedPreparationHelpers.has(path)) {
      visit("T-PARALLEL-TEST-SUPPORT", path,
        "Los helpers nuevos se ubican en src/testing/builders o en el tests/ local, no en otro árbol testing/");
    }
    if (!path.startsWith("src/testing/") || isTest(path)) continue;
    const filename = path.slice(path.lastIndexOf("/") + 1).replace(/\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/u, "");
    if (testOrchestrator.test(filename)) {
      visit("T-PARALLEL-TEST-RUNNER", path,
        "La ejecución, planificación y presentación de tests pertenecen al runner existente en scripts/");
    }
    visitNodes(source, (node) => {
      const reference = ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
        ? node.moduleSpecifier
        : ts.isCallExpression(node) && node.arguments.length > 0 &&
          (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
            ts.isIdentifier(node.expression) && node.expression.text === "require")
          ? node.arguments[0]
          : null;
      if (reference && ts.isStringLiteralLike(reference) && restrictedExecutionModule.has(reference.text)) {
        visit("T-PARALLEL-TEST-RUNNER", path,
          "Los helpers no deben orquestar procesos o workers de un runner paralelo", node);
      }
    });
  }
  for (const [path, dependencies] of project.dependencies) {
    for (const dependency of dependencies) {
      if (isTest(dependency)) {
        visit("T-TEST-AS-HELPER", path,
          `Una suite no puede importarse como helper desde ${dependency}; extraer el soporte reutilizable`, undefined,
          `suite:${dependency}`);
      }
    }
  }
};

const sourceEvidence = (source) => {
  const candidate = [];
  visitNodes(source, (node) => {
    if (ts.isCallExpression(node) && /(?:readVerifiedManainRecordSource)$/u.test(node.expression.getText(source))) {
      candidate.push(node);
    }
    if (ts.isCallExpression(node) && /(?:readFile(?:Sync)?|readCanonicalCatalog|loadCatalog|createReadStream|openSync|join|resolve|readdir(?:Sync)?)$/u.test(node.expression.getText(source))) {
      const expression = node.getText(source);
      const literals = [...expression.matchAll(/["'`]([^"'`]+)["'`]/gu)].map((match) => match[1]?.toLowerCase());
      const segmented = literals.includes("catalogs") && literals.includes("providers") &&
        literals.some((word) => ["original", "publications", "technical"].includes(word));
      if (catalogPath(expression) || segmented || historicalFixture(expression)) candidate.push(node);
    }
    if ((ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) &&
      (catalogPath(node.getText(source)) || historicalFixture(node.getText(source)))) candidate.push(node);
  });
  const { liveRead } = createSourceTracing(source);
  visitNodes(source, (node) => {
    if (ts.isCallExpression(node) && liveRead(node)) candidate.push(node);
  });
  const chosen = [];
  for (const node of candidate.sort((a, b) => b.getWidth(source) - a.getWidth(source))) {
    if (!chosen.some((other) => other.getStart(source) <= node.getStart(source) &&
      other.getEnd() >= node.getEnd())) chosen.push(node);
  }
  return chosen.sort((a, b) => a.getStart(source) - b.getStart(source));
};

const declaredValues = (source) => {
  const declarations = new Map();
  visitNodes(source, (node) => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) return;
    const scope = nearestScope(node);
    if (!scope) return;
    const key = `${scope.pos}:${node.name.text}`;
    const matches = declarations.get(key) ?? [];
    matches.push(node);
    declarations.set(key, matches);
  });
  const declaration = (node) => {
    if (!ts.isIdentifier(node)) return null;
    let scope = nearestScope(node);
    while (scope) {
      const matches = declarations.get(`${scope.pos}:${node.text}`) ?? [];
      const previous = matches.filter((entry) => entry.getStart(source) < node.getStart(source));
      if (previous.length > 0) return previous[previous.length - 1].initializer;
      scope = nearestScope(scope);
    }
    return null;
  };
  return declaration;
};

const createSourceTracing = (source) => {
  const declaration = declaredValues(source);
  const unwrap = (node) => ts.isParenthesizedExpression(node) || ts.isAwaitExpression(node) ||
    ts.isAsExpression(node) ? unwrap(node.expression) : node;
  const literals = (node, visited = new Set()) => {
    const current = unwrap(node);
    if (ts.isStringLiteralLike(current)) return [current.text.toLowerCase()];
    if (ts.isIdentifier(current)) {
      const value = declaration(current);
      if (!value || visited.has(value)) return [];
      visited.add(value);
      return literals(value, visited);
    }
    if (ts.isCallExpression(current) && /^(?:join|resolve|path\.(?:join|resolve))$/u.test(current.expression.getText(source))) {
      return current.arguments.flatMap((part) => literals(part, new Set(visited)));
    }
    return [];
  };
  const cwdRoot = (node, visited = new Set()) => {
    const current = unwrap(node);
    if (ts.isCallExpression(current) && /^process\.cwd$/u.test(current.expression.getText(source))) return true;
    if (ts.isIdentifier(current)) {
      const value = declaration(current);
      if (!value || visited.has(value)) return false;
      visited.add(value);
      return cwdRoot(value, visited);
    }
    if (ts.isCallExpression(current) && /^(?:join|resolve|path\.(?:join|resolve))$/u.test(current.expression.getText(source))) {
      return current.arguments.some((part) => cwdRoot(part, visited));
    }
    return false;
  };
  const relativeRoot = (node, visited = new Set()) => {
    const current = unwrap(node);
    if (ts.isStringLiteralLike(current)) return /^(?:\.\/?|catalogs(?:[/\\]|$))/u.test(current.text);
    if (ts.isIdentifier(current)) {
      const value = declaration(current);
      if (!value || visited.has(value)) return false;
      visited.add(value);
      return relativeRoot(value, visited);
    }
    if (ts.isCallExpression(current) && /^(?:join|resolve|path\.(?:join|resolve))$/u.test(current.expression.getText(source))) {
      const first = current.arguments[0];
      return Boolean(first && (cwdRoot(first) || relativeRoot(first, visited)));
    }
    return false;
  };
  const livePath = (node, visited = new Set()) => {
    const current = unwrap(node);
    if (ts.isStringLiteralLike(current)) return catalogPath(current.text);
    if (ts.isIdentifier(current)) {
      const value = declaration(current);
      if (!value || visited.has(value)) return false;
      visited.add(value);
      return livePath(value, visited);
    }
    if (!ts.isCallExpression(current) ||
      !/^(?:join|resolve|path\.(?:join|resolve))$/u.test(current.expression.getText(source))) return false;
    const parts = current.arguments.flatMap((part) => literals(part));
    const providerPath = parts.some(catalogPath) || parts.includes('catalogs') && parts.includes('providers') &&
      parts.some((part) => ['original', 'publications', 'technical', 'records'].includes(part));
    const first = current.arguments[0];
    const currentRoot = first && (cwdRoot(first) || relativeRoot(first));
    return Boolean(providerPath && currentRoot);
  };
  const liveRead = (node) => {
    const current = unwrap(node);
    if (!ts.isCallExpression(current)) return false;
    const callee = current.expression.getText(source);
    if (/\breadVerifiedManainRecordSource$/u.test(callee)) {
      return current.arguments.some((argument) => cwdRoot(argument));
    }
    if (!/(?:readCanonicalCatalog|readFile(?:Sync)?|loadCatalog|createReadStream|openSync)$/u.test(callee)) return false;
    return current.arguments.some((argument) => livePath(argument));
  };
  const liveValue = (node, visited = new Set()) => {
    const current = unwrap(node);
    if (liveRead(current)) return true;
    if (ts.isIdentifier(current)) {
      const value = declaration(current);
      if (!value || visited.has(value)) return false;
      visited.add(value);
      return liveValue(value, visited);
    }
    if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
      return liveValue(current.expression, visited);
    }
    if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
      return liveValue(current.expression.expression, visited);
    }
    return false;
  };
  return { liveRead, liveValue };
};

const liveSourceEvidence = (source) => {
  const { liveRead } = createSourceTracing(source);
  let live = false;
  visitNodes(source, (node) => {
    if (ts.isCallExpression(node) && liveRead(node)) live = true;
  });
  return live;
};

const accreditedCatalogIntegrations = new Map([
  ["src/preparation/tests/catalog-publication-consistency.test.ts", {
    sha256: "cb1371989fae497c6e9804c0b6ba0a617500f5e5083222dc5f9d1ef35cb7f487",
    reads: 2,
    responsibility: "Integridad, procedencia y proyección de publicaciones acreditadas"
  }]
]);

const accreditedSourceSha256 = (source) => createHash("sha256")
  .update(source.replace(/\r\n/gu, "\n")).digest("hex");

const creditedCatalogIntegration = (path, source, direct) => {
  const contract = accreditedCatalogIntegrations.get(path);
  if (!contract || direct.length !== contract.reads) return null;
  return accreditedSourceSha256(source.text) === contract.sha256 ? contract : null;
};

const transitiveExceptions = new Map([
  ["src/publication/tests/manain-individual-selection.test.ts",
    "src/testing/builders/manain-individual-selection-fixture.ts"],
  ["src/publication/tests/manain-individual-finish.test.ts",
    "src/testing/builders/manain-individual-selection-fixture.ts"]
]);

const accreditedTransitiveSources = new Map([
  ["src/testing/builders/manain-individual-selection-fixture.ts",
    "435bdfb7175acf306d4b024332fa46999aeb78b1caeff4fb4976e020d738424b"]
]);

const isAccreditedTransitive = (path, helper, project, helperEvidence) => {
  if (transitiveExceptions.get(path) !== helper || (helperEvidence.get(helper) ?? []).length !== 1) return false;
  const source = project.files.get(helper)?.text;
  return typeof source === "string" &&
    accreditedSourceSha256(source) === accreditedTransitiveSources.get(helper);
};

const isCount = (node, source) => /\b(?:catalog|original|publication|products|changed|improved|records|entries|units|machines|gam|gomariz|mercaeleva|manain)\b[\w.\[\]?]*\.length\b/iu.test(node.getText(source));
const nearestScope = (node) => {
  let current = node.parent;
  while (current && !ts.isBlock(current) && !ts.isSourceFile(current)) current = current.parent;
  return current;
};
const numericBindings = (source) => {
  const constants = new Map();
  visitNodes(source, (node) => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer ||
      !ts.isNumericLiteral(node.initializer) ||
      !(ts.getCombinedNodeFlags(node) & ts.NodeFlags.Const)) return;
    const scope = nearestScope(node);
    if (scope) constants.set(`${scope.pos}:${node.name.text}`, node.getStart(source));
  });
  return constants;
};
const isNumber = (node, constants) => {
  if (ts.isNumericLiteral(node)) return true;
  if (!ts.isIdentifier(node)) return false;
  let scope = nearestScope(node);
  while (scope) {
    const position = constants.get(`${scope.pos}:${node.text}`);
    if (position !== undefined && position < node.getStart()) return true;
    scope = nearestScope(scope);
  }
  return false;
};
const isEquality = (node, source) =>
  ts.isCallExpression(node) && /^(?:(?:assert|expect)\.)?(?:equal|strictEqual|deepEqual|toEqual)$/u.test(node.expression.getText(source));

const checkFrozen = (source, visit) => {
  const constants = numericBindings(source);
  const { liveValue } = createSourceTracing(source);
  const liveCount = (node) => {
    const current = ts.isParenthesizedExpression(node) ? node.expression : node;
    return ts.isPropertyAccessExpression(current) && current.name.text === 'length' &&
      liveValue(current.expression);
  };
  const frozen = (left, right) => isNumber(right, constants) &&
    (liveCount(left) || isCount(left, source));
  visitNodes(source, (node) => {
    if (isEquality(node, source)) {
      const [left, right] = node.arguments;
      if (left && right && (frozen(left, right) || frozen(right, left))) {
        visit("T-FIXED-COHORT", node, "El test fija el tamaño de un catálogo operativo como resultado de dominio");
      }
    }
    if (ts.isCallExpression(node) && /^(?:assert|expect)\.(?:ok|equal|strictEqual)$/u.test(node.expression.getText(source))) {
      visitNodes(node, (expression) => {
        if (!ts.isBinaryExpression(expression) || ![
          ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken
        ].includes(expression.operatorToken.kind)) return;
        if (frozen(expression.left, expression.right) || frozen(expression.right, expression.left)) {
          visit("T-FIXED-COHORT", node, "El test exige un tamaño fijo de catálogo operativo mediante igualdad");
        }
      });
    }
  });
};

const checkVolatileExpectations = (source, visit) => {
  const constants = numericBindings(source);
  visitNodes(source, (node) => {
    if (!isEquality(node, source)) return;
    const [left, right] = node.arguments;
    if (!left || !right) return;
    if ((ts.isPropertyAccessExpression(left) && /\.(?:discoveredProductUrls|pendingCategory|withPrice)$/u.test(left.getText(source)) && isNumber(right, constants)) ||
      (ts.isPropertyAccessExpression(right) && /\.(?:discoveredProductUrls|pendingCategory|withPrice)$/u.test(right.getText(source)) && isNumber(left, constants))) {
      visit("T-FIXED-STOCK-FIELD", node, "El test congela un indicador variable de la fuente o la proyección");
    }
  });
};

const checkMandatoryReferences = (source, visit) => {
  const foundReference = new Map();
  const localArrays = new Set();
  visitNodes(source, (node) => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) return;
    const scope = nearestScope(node);
    if (!scope) return;
    if (ts.isArrayLiteralExpression(node.initializer)) {
      localArrays.add(`${scope.pos}:${node.name.text}`);
      return;
    }
    const expression = node.initializer.getText(source);
    const receiver = /^([\w$]+)\.find\s*\(/u.exec(expression)?.[1];
    if (receiver && localArrays.has(`${scope.pos}:${receiver}`)) return;
    if (/\.find\s*\(/u.test(expression) &&
      /\.reference\s*===?\s*["'`][A-Za-z0-9-]+["'`]/u.test(expression)) {
      foundReference.set(`${scope.pos}:${node.name.text}`, node.getStart(source));
    }
  });
  visitNodes(source, (node) => {
    if (!ts.isCallExpression(node) || !/^(?:assert|expect)\.(?:ok|equal|strictEqual|deepEqual|notEqual|toEqual)$/u.test(node.expression.getText(source))) return;
    const statement = node.getText(source);
    const requiredReference = /\.(?:find|some)\s*\(/u.test(statement) &&
      /\.reference\s*===?\s*["'`][A-Za-z0-9-]+["'`]/u.test(statement);
    const requiredSet = /\b(?:reference|references)\b/iu.test(statement) &&
      node.arguments.some((argument) => ts.isArrayLiteralExpression(argument) &&
        argument.elements.length > 0 && argument.elements.every((element) => ts.isStringLiteralLike(element)));
    const requiredLookup = /\.get\s*\(\s*["'`][A-Za-z0-9-]+["'`]\s*\)/u.test(statement);
    const first = node.arguments[0];
    let requiredVariable = false;
    if (ts.isIdentifier(first) && /^(?:assert|expect)\.ok$/u.test(node.expression.getText(source))) {
      let scope = nearestScope(node);
      while (scope && !requiredVariable) {
        const position = foundReference.get(`${scope.pos}:${first.text}`);
        requiredVariable = position !== undefined && position < node.getStart(source);
        scope = nearestScope(scope);
      }
    }
    if (requiredReference || requiredSet || requiredLookup || requiredVariable) {
      visit("T-FIXED-REFERENCE", node, "El test exige referencias concretas de un catálogo operativo");
    }
  });
};

const editorialField = /\b(?:description_general|shortDescription|longDescription|description)\b/iu;
const isEditorialHash = (node, source, calculated) => {
  if (ts.isIdentifier(node)) return calculated.has(node.text);
  if (ts.isParenthesizedExpression(node)) return isEditorialHash(node.expression, source, calculated);
  if (!ts.isCallExpression(node)) return false;
  const code = node.getText(source);
  return /\b(?:createHash|sha256)\b/iu.test(code) && /\.update\s*\(/u.test(code) && editorialField.test(code);
};

const checkFrozenText = (source, visit) => {
  if (!/\b(?:createHash|sha256)\b/iu.test(source.text)) return;
  const calculated = new Set();
  visitNodes(source, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer &&
      isEditorialHash(node.initializer, source, calculated)) calculated.add(node.name.text);
  });
  visitNodes(source, (node) => {
    if (!ts.isCallExpression(node) ||
      !/^(?:(?:assert|expect)\.)?(?:equal|strictEqual|deepEqual|toEqual)$/u.test(node.expression.getText(source))) return;
    const [left, right] = node.arguments;
    if (!left || !right) return;
    if ((isEditorialHash(left, source, calculated) && ts.isStringLiteralLike(right)) ||
      (isEditorialHash(right, source, calculated) && ts.isStringLiteralLike(left))) {
      visit("T-FROZEN-EDITORIAL-HASH", node,
        "El test de dominio congela mediante hash la redacción de fichas de un catálogo real");
    }
  });
};

export const inspectTestArchitecture = (root) => {
  const project = makeProject(root);
  const issues = [];
  const exceptions = [];
  const integrations = [];
  const push = (rule, path, node, detail, signature) => {
    const source = project.files.get(path);
    if (source || !node) issues.push(findIssue(rule, path, source, node, detail, signature));
  };
  const suites = [...project.files.keys()].filter(monitoredTest);
  checkTestLayout(project, (rule, path, detail, node, signature) => push(rule, path, node, detail, signature));
  const helperEvidence = new Map();
  for (const [path, source] of project.files) {
    if (supportModule(path)) helperEvidence.set(path, sourceEvidence(source));
  }
  for (const path of suites) {
    const source = project.files.get(path);
    const direct = sourceEvidence(source);
    const integration = creditedCatalogIntegration(path, source, direct);
    for (const node of direct) {
      if (integration) {
        integrations.push({
          rule: "T-PRODUCT-CATALOG", path, source: node.getText(source),
          responsibility: integration.responsibility
        });
      } else if (domainTest(path)) {
        push("T-PRODUCT-CATALOG", path, node,
          "Una prueba de dominio obtiene su entrada de un catálogo productivo o fixture histórica completa");
      }
    }
    const seen = new Set([path]);
    let catalogDependent = direct.length > 0;
    let liveDependent = liveSourceEvidence(source);
    const pending = [...project.dependencies.get(path) ?? []];
    while (pending.length > 0) {
      const current = pending.pop();
      if (!current || seen.has(current) || !supportModule(current)) continue;
      seen.add(current);
      if ((helperEvidence.get(current) ?? []).length > 0) {
        catalogDependent = true;
        if (liveSourceEvidence(project.files.get(current))) liveDependent = true;
        if (isAccreditedTransitive(path, current, project, helperEvidence)) {
          exceptions.push({ rule: "T-TRANSITIVE-CATALOG", path, source: current });
        } else if ((domainTest(path) &&
          (transitiveExceptions.get(path) === current || !localTestSupport(current))) ||
          liveSourceEvidence(project.files.get(current))) {
          push("T-TRANSITIVE-CATALOG", path, undefined,
            `La prueba de dominio obtiene catálogos históricos/operativos mediante ${current}`, `helper:${current}`);
        }
      }
      pending.push(...project.dependencies.get(current) ?? []);
    }
    if (catalogDependent && liveDependent) {
      checkFrozen(source, (rule, node, detail) => push(rule, path, node, detail));
      checkVolatileExpectations(source, (rule, node, detail) => push(rule, path, node, detail));
      checkMandatoryReferences(source, (rule, node, detail) => push(rule, path, node, detail));
      checkFrozenText(source, (rule, node, detail) => push(rule, path, node, detail));
    }
  }
  return {
    findings: uniqueFindings(issues), exceptions, integrations, suites: suites.length,
    supportModules: helperEvidence.size, files: project.files.size
  };
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = optionsFrom(process.argv.slice(2));
    const result = inspectTestArchitecture(options.root);
    console.log(`TESTS | ${result.suites} suites de dominio | ${result.supportModules} módulos auxiliares | ${result.files} archivos inspeccionados`);
    console.log(`EXCEPCIONES ACREDITADAS | ${result.exceptions.length} usos exactos conservados | sin exenciones generales`);
    console.log(`INTEGRACIONES ACREDITADAS | ${result.integrations.length} lecturas exactas de catálogos en ${new Set(result.integrations.map((item) => item.path)).size} suites protegidas`);
    process.exitCode = present("GUARD ARQUITECTURA DE TESTS", result.findings, options).exitCode;
  } catch (error) {
    console.error(`ERROR | GUARD ARQUITECTURA DE TESTS | ${error.message}`);
    process.exitCode = 2;
  }
}

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ts, makeProject, visitNodes, isTest, findIssue,
  uniqueFindings, optionsFrom, present
} from "./guards-architecture-core.mjs";

const domainTest = (path) => isTest(path) &&
  /^(?:src\/preparation\/(?!workflow\/)|src\/catalog\/(?:normalization|reference|validation|diagnostics|editorial|coverage)\/|src\/commercial\/(?:validation|diagnostics|projection)\/|src\/(?:domain|normalization|reconciliation)\/)/u.test(path);
const supportModule = (path) => !isTest(path) &&
  /^(?:src\/testing\/|scripts\/testing\/)|\/fixtures?\/|\/tests\/helpers?\/|(?:^|\/)[\w-]*fixture\.(?:ts|tsx|mts|js|mjs)$/u.test(path);
const catalogPath = (value) => /catalogs\s*[/\\]\s*providers\s*[/\\]/iu.test(value) &&
  /(?:original|publications|technical|catalog\.json|publishable)/iu.test(value);
const historicalFixture = (value) => /(?:src\/testing\/fixtures\/|testing\/fixtures\/)/iu.test(value) &&
  /(?:regression[-_/]\d+|(?:scrape|catalog)[\w-]*20\d\d|(?:catalog|publishable)\.json)/iu.test(value);

const sourceEvidence = (source) => {
  const candidate = [];
  visitNodes(source, (node) => {
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
  const chosen = [];
  for (const node of candidate.sort((a, b) => b.getWidth(source) - a.getWidth(source))) {
    if (!chosen.some((other) => other.getStart(source) <= node.getStart(source) &&
      other.getEnd() >= node.getEnd())) chosen.push(node);
  }
  return chosen.sort((a, b) => a.getStart(source) - b.getStart(source));
};

const isCount = (node, source) => /\b(?:catalog|original|publication|products|changed|improved|records)\b[\w.\[\]?]*\.length\b/iu.test(node.getText(source));
const isNumber = (node) => ts.isNumericLiteral(node);

const checkFrozen = (source, visit) => {
  visitNodes(source, (node) => {
    if (ts.isCallExpression(node) && /^(?:(?:assert|expect)\.)?(?:equal|strictEqual|deepEqual|toEqual)$/u.test(node.expression.getText(source))) {
      const [left, right] = node.arguments;
      if (left && right && ((isCount(left, source) && isNumber(right)) || (isCount(right, source) && isNumber(left)))) {
        visit("T-FIXED-COHORT", node, "El test fija el tamaño de un catálogo operativo como resultado de dominio");
      }
    }
  });
};

const checkFrozenText = (source, visit) => {
  if (!/\b(?:createHash|sha256)\b/iu.test(source.text) ||
      !/(?:description_general|shortDescription|longDescription|description)/iu.test(source.text)) return;
  visitNodes(source, (node) => {
    if (ts.isCallExpression(node) && /^(?:(?:assert|expect)\.)?(?:equal|strictEqual|deepEqual|toEqual)$/u.test(node.expression.getText(source)) &&
      /(?:hash|digest|sha256)/iu.test(node.getText(source))) {
      visit("T-FROZEN-EDITORIAL-HASH", node,
        "El test de dominio congela mediante hash la redacción de fichas de un catálogo real");
    }
  });
};

export const inspectTestArchitecture = (root) => {
  const project = makeProject(root);
  const issues = [];
  const push = (rule, path, node, detail, signature) => {
    const source = project.files.get(path);
    if (source) issues.push(findIssue(rule, path, source, node, detail, signature));
  };
  const suites = [...project.files.keys()].filter(domainTest);
  const helperEvidence = new Map();
  for (const [path, source] of project.files) {
    if (supportModule(path)) helperEvidence.set(path, sourceEvidence(source));
  }
  for (const path of suites) {
    const source = project.files.get(path);
    const direct = sourceEvidence(source);
    for (const node of direct) push("T-PRODUCT-CATALOG", path, node,
      "Una prueba de dominio obtiene su entrada de un catálogo productivo o fixture histórica completa");
    const seen = new Set([path]);
    let catalogDependent = direct.length > 0;
    const pending = [...project.dependencies.get(path) ?? []];
    while (pending.length > 0) {
      const current = pending.pop();
      if (!current || seen.has(current) || !supportModule(current)) continue;
      seen.add(current);
      if ((helperEvidence.get(current) ?? []).length > 0) {
        catalogDependent = true;
        push("T-TRANSITIVE-CATALOG", path, undefined,
          `La prueba de dominio obtiene catálogos históricos/operativos mediante ${current}`, `helper:${current}`);
      }
      pending.push(...project.dependencies.get(current) ?? []);
    }
    if (catalogDependent) {
      checkFrozen(source, (rule, node, detail) => push(rule, path, node, detail));
      checkFrozenText(source, (rule, node, detail) => push(rule, path, node, detail));
    }
  }
  return {
    findings: uniqueFindings(issues), suites: suites.length,
    supportModules: helperEvidence.size, files: project.files.size
  };
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = optionsFrom(process.argv.slice(2));
    const result = inspectTestArchitecture(options.root);
    console.log(`TESTS | ${result.suites} suites de dominio | ${result.supportModules} módulos auxiliares | ${result.files} archivos inspeccionados`);
    process.exitCode = present("GUARD ARQUITECTURA DE TESTS", result.findings, options).exitCode;
  } catch (error) {
    console.error(`ERROR | GUARD ARQUITECTURA DE TESTS | ${error.message}`);
    process.exitCode = 2;
  }
}

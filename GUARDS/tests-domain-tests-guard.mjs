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

const cohortExceptions = new Map([
  ["src/catalog/normalization/gam/tests/gallery.test.ts", {
    test: "GAM: conserva las vistas del baño unitario y excluye la portada del módulo doble",
    assertion: "assert.equal(original.length, 7)"
  }],
  ["src/preparation/gam/identity/tests/gam-identity-variants.test.ts", {
    test: "GAM: tres series colisionadas conservan seis fichas y bloquean solo las Hyster",
    assertion: "assert.equal(batch.products.length, 6)"
  }],
  ["src/preparation/gam/quality/tests/gam-verified-operational-safety.test.ts", {
    test: "recupera veinte prestaciones de seguridad de fuentes individuales conservando las especificaciones anteriores",
    assertion: "assert.equal(changed.length, 20)"
  }],
  ["src/preparation/gam/technical/measurements/gam-clearance-platform.test.ts", {
    test: "solo las referencias acreditadas reciben medidas nuevas y Gomariz queda intacto",
    assertion: "assert.equal(changed.length, 30)"
  }],
  ["src/preparation/gam/technical/measurements/gam-qualified-geometry-evidence.test.ts", {
    test: "solo las veinte referencias acreditadas reciben nuevas especificaciones",
    assertion: "assert.equal(changed.length, 20)"
  }],
  ["src/preparation/gam/technical/mobility/gam-traction-braking-evidence.test.ts", {
    test: "añade una prestación acreditada a veintiuna fichas sin modificar originales",
    assertion: "assert.equal(changed.length, 21)"
  }],
  ["src/preparation/gam/technical/mobility/gam-verified-drivetrain-brakes.test.ts", {
    test: "recupera únicamente prestaciones demostradas por el original sin perder acreditaciones anteriores",
    assertion: "assert.equal(changed.length, 38)"
  }],
  ["src/preparation/gam/technical/operations/gam-cleaning-tank-evidence.test.ts", {
    test: "solo las 25 fichas GAM con prueba atribuible reciben depósitos, sin arrastrar Gomariz",
    assertion: "assert.equal(changed.length, 27)"
  }],
  ["src/preparation/gam/technical/operations/gam-unit-performance-specs.test.ts", {
    test: "recupera solo las referencias acreditadas y conserva los originales",
    assertion: "assert.equal(changed.length, 56)"
  }],
  ["src/preparation/gam/technical/safety/gam-acoustic-evidence.test.ts", {
    test: "las 22 fichas únicas pertenecen a GAM y Gomariz queda intacto",
    assertion: "assert.equal(changed.length, 22)"
  }],
  ["src/preparation/gam/technical/safety/gam-verified-operator-controls.test.ts", {
    test: "recupera prestaciones de mando y presencia acreditadas y normalizables",
    assertion: "assert.equal(changed.length, 25)"
  }],
  ["src/preparation/gam/technical/tests/gam-verified-tyre-and-noise-details.test.ts", {
    test: "la recuperación se limita a veinte identidades únicas de GAM",
    assertion: "assert.equal(changed.length, 20)"
  }]
]);

const transitiveExceptions = new Map([
  ["src/preparation/gam/classification/tests/gam-verified-category-equivalences.test.ts",
    "src/preparation/gam/technical/tests/support/gam-historical-category-fixture.ts"],
  ["src/preparation/gam/identity/tests/gam-categories-condition.test.ts",
    "src/preparation/gam/technical/tests/support/gam-historical-category-fixture.ts"],
  ["src/preparation/gam/identity/tests/gam-source-category-and-condition.test.ts",
    "src/preparation/gam/technical/tests/support/gam-historical-category-fixture.ts"],
  ["src/preparation/mercaeleva/technical/tests/models/jlg-450aj-base-model-evidence.test.ts",
    "src/testing/builders/mercaeleva-source-fixture.ts"],
  ["src/preparation/mercaeleva/technical/tests/specifications/mercaeleva-documented-equipment-technical-specs.test.ts",
    "src/testing/builders/mercaeleva-source-fixture.ts"],
  ["src/preparation/mercaeleva/technical/tests/specifications/mercaeleva-documented-platform-technical-specs.test.ts",
    "src/testing/builders/mercaeleva-source-fixture.ts"],
  ["src/preparation/shared/quality/tests/source-semantic-quality.test.ts",
    "src/testing/builders/mercaeleva-source-fixture.ts"]
]);

const cohortTestName = (source, node) => {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isCallExpression(current) && ts.isIdentifier(current.expression) &&
      ["test", "it"].includes(current.expression.text) && ts.isStringLiteralLike(current.arguments[0])) {
      return current.arguments[0].text;
    }
  }
  return null;
};

const isAccreditedCohort = (path, source, node) => {
  const exception = cohortExceptions.get(path);
  return !!exception && node.getText(source).replace(/\s+/gu, " ").trim() === exception.assertion &&
    cohortTestName(source, node) === exception.test;
};

const isAccreditedTransitive = (path, helper, project, helperEvidence) => {
  if (transitiveExceptions.get(path) !== helper || (helperEvidence.get(helper) ?? []).length !== 1) return false;
  const source = project.files.get(helper)?.text ?? "";
  if (helper.includes("gam-historical-category-fixture")) {
    return source.includes("scrape-gam-marzo-2026-catalog.json") && source.includes("readCanonicalCatalog");
  }
  return helper === "src/testing/builders/mercaeleva-source-fixture.ts" &&
    source.includes("readCanonicalCatalog") && source.includes('join("catalogs", "providers", "mercaeleva", "original")') &&
    source.includes("entries.length !== 1");
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
        if (isAccreditedTransitive(path, current, project, helperEvidence)) {
          exceptions.push({ rule: "T-TRANSITIVE-CATALOG", path, source: current });
        } else {
          push("T-TRANSITIVE-CATALOG", path, undefined,
            `La prueba de dominio obtiene catálogos históricos/operativos mediante ${current}`, `helper:${current}`);
        }
      }
      pending.push(...project.dependencies.get(current) ?? []);
    }
    if (catalogDependent) {
      checkFrozen(source, (rule, node, detail) => {
        if (isAccreditedCohort(path, source, node)) {
          exceptions.push({ rule, path, source: node.getText(source) });
        } else {
          push(rule, path, node, detail);
        }
      });
      checkFrozenText(source, (rule, node, detail) => push(rule, path, node, detail));
    }
  }
  return {
    findings: uniqueFindings(issues), exceptions, suites: suites.length,
    supportModules: helperEvidence.size, files: project.files.size
  };
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = optionsFrom(process.argv.slice(2));
    const result = inspectTestArchitecture(options.root);
    console.log(`TESTS | ${result.suites} suites de dominio | ${result.supportModules} módulos auxiliares | ${result.files} archivos inspeccionados`);
    console.log(`EXCEPCIONES ACREDITADAS | ${result.exceptions.length} usos exactos conservados | sin exenciones generales`);
    process.exitCode = present("GUARD ARQUITECTURA DE TESTS", result.findings, options).exitCode;
  } catch (error) {
    console.error(`ERROR | GUARD ARQUITECTURA DE TESTS | ${error.message}`);
    process.exitCode = 2;
  }
}

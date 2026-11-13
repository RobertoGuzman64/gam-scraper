import { createHash } from "node:crypto";
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

const accreditedCatalogIntegrations = new Map([
  ["src/catalog/normalization/gam/tests/gallery.test.ts", {
    sha256: "d1c1837b7ff5c8b5d51a1e0edb98c7b9e0cbc71b43d2dbd7e544c2f7f5f44568",
    reads: 2,
    responsibility: "Regresión real de procedencia de imágenes y exclusión de galerías ajenas"
  }],
  ["src/preparation/gam/identity/tests/gam-identity-variants.test.ts", {
    sha256: "29400091418295a3aadaf8f6b922a88f1d25d6796e37674d119a1c6c19d0acf8",
    reads: 1,
    responsibility: "Variantes e identidad cruzada contra fixture histórica firmada"
  }],
  ["src/preparation/gam/quality/tests/gam-verified-operational-safety.test.ts", {
    sha256: "8c755a49c8d3fcf67465c6497548d0ce1679be270617f7c7134358ddf29b0836",
    reads: 1,
    responsibility: "Censo de recuperación de seguridad por unidad y protección entre proveedores"
  }],
  ["src/preparation/gam/technical/measurements/gam-clearance-platform.test.ts", {
    sha256: "1a6f3d733722df5edf02f25efb4de533833bff045b916500ae72656a62536d30",
    reads: 2,
    responsibility: "Censo de medidas de plataforma y altura sin propagación entre proveedores"
  }],
  ["src/preparation/gam/technical/measurements/gam-qualified-geometry-evidence.test.ts", {
    sha256: "596472785bcc646539887bc6483d34e28fc46d626dbb0fff37dc8d63ff4b0985",
    reads: 1,
    responsibility: "Censo de geometría técnica acreditada y preservación de originales"
  }],
  ["src/preparation/gam/technical/mobility/gam-traction-braking-evidence.test.ts", {
    sha256: "96911b800cbc9d375eefd8c6b70ae7062552dbffcd5529c607000c80b8b50ba9",
    reads: 1,
    responsibility: "Censo de tracción y frenada atribuibles a la fuente"
  }],
  ["src/preparation/gam/technical/mobility/gam-verified-drivetrain-brakes.test.ts", {
    sha256: "35bb397e129a9518caf1a7ddd1f8a7b9515b2db66f09a7c19e86155dc5d38de3",
    reads: 1,
    responsibility: "Censo de motorización y frenada acreditadas sin contaminación"
  }],
  ["src/preparation/gam/technical/operations/gam-cleaning-tank-evidence.test.ts", {
    sha256: "e1998ac6a0c41c657d44c5ea68ce17b955958b679083fbef518a1bc8c942831f",
    reads: 2,
    responsibility: "Censo de depósitos de limpieza con aislamiento entre proveedores"
  }],
  ["src/preparation/gam/technical/operations/gam-unit-performance-specs.test.ts", {
    sha256: "6f6e302fc291b30300ae1d4bb6649a13dab6a3c93ce1e8ec24cb985497b936f7",
    reads: 1,
    responsibility: "Censo de prestaciones técnicas y pruebas de no propagación"
  }],
  ["src/preparation/gam/technical/safety/gam-acoustic-evidence.test.ts", {
    sha256: "656769063ad54f20b376994cabda6748127d8095912d2a9274021b7a0f36a844",
    reads: 2,
    responsibility: "Censo de acústica acreditada y exclusión entre proveedores"
  }],
  ["src/preparation/gam/technical/safety/gam-verified-operator-controls.test.ts", {
    sha256: "cd8b298d922e8fbfd0c7199e004afb8225c48f35e643f4bf66aeb76c599cc1d9",
    reads: 1,
    responsibility: "Censo de mandos y controles de seguridad con procedencia"
  }],
  ["src/preparation/gam/technical/tests/gam-verified-tyre-and-noise-details.test.ts", {
    sha256: "d9558900d252cc1e58dc7b5cc39bded95397c46c9dcec2a1a069c57a5fc1ca20",
    reads: 2,
    responsibility: "Censo de neumáticos y ruido con normalización y variantes negativas"
  }],
  ["src/preparation/shared/quality/tests/source-semantic-quality.test.ts", {
    sha256: "3224c3251324ad2c5a9210e0446396185ba4a2bb15261a84ff98268db2aac70f",
    reads: 2,
    responsibility: "Regresión histórica de contradicciones semánticas y calidad de fuente"
  }],
  ["src/preparation/tests/catalog-publication-consistency.test.ts", {
    sha256: "a4312b94bad875a822a7846de2cd6f1c9d8472fece7c6c42a292d95e1d0256c9",
    reads: 2,
    responsibility: "Integridad, procedencia y proyección de publicaciones acreditadas"
  }]
]);

const creditedCatalogIntegration = (path, source, direct) => {
  const contract = accreditedCatalogIntegrations.get(path);
  if (!contract || direct.length !== contract.reads) return null;
  const sha256 = createHash("sha256").update(source.text).digest("hex");
  return sha256 === contract.sha256 ? contract : null;
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
  const integrations = [];
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
    const integration = creditedCatalogIntegration(path, source, direct);
    for (const node of direct) {
      if (integration) {
        integrations.push({ rule: "T-PRODUCT-CATALOG", path, source: node.getText(source),
          responsibility: integration.responsibility });
      } else {
        push("T-PRODUCT-CATALOG", path, node,
          "Una prueba de dominio obtiene su entrada de un catálogo productivo o fixture histórica completa");
      }
    }
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

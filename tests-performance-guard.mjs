import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = dirname(fileURLToPath(import.meta.url));
const normalize = (value) => value.split(sep).join("/");
const protectedSuites = [
  "src/publication/tests/individual-finish-editorial.test.ts",
  "src/publication/tests/individual-finish.test.ts",
  "src/publication/tests/individual-work-report.test.ts",
  "src/cli/commands/catalog/tests/catalog-content-gaps-comparison.test.ts"
];
const shared = {
  finish: "src/testing/builders/individual-finish-fixture.ts",
  individual: "src/testing/builders/individual-workspace-fixture.ts",
  gaps: "src/cli/commands/catalog/tests/catalog-content-gaps-fixtures.ts"
};
const contracts = {
  "src/publication/individual-finish.ts": {
    publishIndividualCatalogs: ["publish", "createIndividualFinishWorkspace / publishIndividualTestWorkspace"]
  },
  "src/cli/commands/catalog/publish-individual.ts": {
    runPublishIndividual: ["finish-cli", "createIndividualFinishWorkspace"]
  },
  "src/preparation/workflow/individual-prepare.ts": {
    prepareIndividualCatalogs: ["prepare", "createIndividualFinishWorkspace / createIndividualWorkspaceFixture"]
  },
  "src/testing/builders/individual-workspace-fixture.ts": {
    createIndividualWorkspaceFixture: ["workspace-factory", "createIndividualFinishWorkspace / createPublishedIndividualFinishWorkspace"],
    prepareIndividualTestWorkspace: ["prepare-helper", "createIndividualFinishWorkspace"]
  },
  "src/testing/builders/individual-finish-fixture.ts": {
    createIndividualFinishWorkspace: ["finish-factory", "reutilizar el mismo withWorkspace dentro de la suite"],
    createPublishedIndividualFinishWorkspace: ["published-factory", "reutilizar el mismo withWorkspace dentro de la suite"],
    publishIndividualTestWorkspace: ["publish-helper", "createIndividualFinishWorkspace"]
  },
  "src/cli/commands/catalog/tests/catalog-content-gaps-fixtures.ts": {
    executeBaseline: ["gaps-cli", "readBaselineComparison / readBaselineDetailedComparison"]
  },
  "src/cli/reporting/published-work-archive.ts": {
    deliverPublishedWorkReport: ["work-report", "createPublishedIndividualFinishWorkspace"]
  },
  "src/publication/individual-work-report.ts": {
    collectPublishedWork: ["work-collection", "createPublishedIndividualFinishWorkspace"]
  },
};
const limits = {
  "src/publication/tests/individual-finish-editorial.test.ts": {
    "finish-cli": 5, publish: 1, "publish-helper": 1, "finish-factory": 1
  },
  "src/publication/tests/individual-finish.test.ts": {
    publish: 4, "publish-helper": 3, "prepare-helper": 1, "finish-factory": 1
  },
  "src/publication/tests/individual-finish-cycle.test.ts": {
    publish: 1, "publish-helper": 2, "finish-factory": 1
  },
  "src/publication/tests/individual-work-report.test.ts": {
    "work-report": 5, "work-collection": 2, "published-factory": 1
  },
  "src/publication/tests/individual-accreditation-session.test.ts": {
    publish: 1, "workspace-factory": 1, "prepare-helper": 1
  },
  "src/preparation/workflow/tests/individual-prepare.test.ts": {
    prepare: 1
  },
  "src/cli/commands/catalog/tests/catalog-content-gaps-comparison.test.ts": {
    "gaps-cli": 3
  },
  "src/cli/commands/catalog/tests/catalog-content-gaps-discovery.test.ts": {
    "gaps-cli": 2
  },
  [shared.finish]: {
    "workspace-factory": 2, publish: 1, editorial: 2
  },
  [shared.individual]: {
    prepare: 1
  }
};
const rawSources = {
  "node:fs/promises": new Set(["cp", "copyFile", "mkdtemp"]),
  "node:fs": new Set(["cpSync", "copyFileSync", "mkdtempSync"]),
  "node:child_process": new Set(["execFile", "exec", "spawn", "fork", "execSync", "execFileSync", "spawnSync"])
};
const rawLimits = {
  [shared.individual]: { cp: 2, copyFile: 1, mkdtemp: 2 },
  "src/testing/builders/reusable-workspace-fixture.ts": { cp: 3, mkdtemp: 1 },
  [shared.gaps]: { cp: 4, mkdtemp: 1, execFile: 1 },
  "src/cli/commands/catalog/tests/catalog-content-gaps-publications.test.ts": { mkdtemp: 3, copyFile: 3 },
  "src/cli/commands/catalog/tests/catalog-content-gaps.test.ts": { mkdtemp: 1, copyFile: 1 }
};
const trustedProduction = new Set([
  "src/cli/commands/catalog/publish-individual.ts",
  "src/cli/commands/catalog/prepare-individual.ts",
  "src/cli/reporting/published-work-archive.ts",
  "src/publication/individual-finish.ts",
  "src/publication/individual-work-report.ts"
]);
const trustedDirectImports = new Set([
  "src/cli/commands/catalog/publish-individual.ts",
  "src/publication/individual-accreditation.ts",
  "src/publication/individual-finish.ts",
  "src/infrastructure/filesystem/catalog/accredited-publication.ts",
  "src/publication/active-publication.ts",
  "src/infrastructure/archive/zip.ts",
  "src/publication/individual-work-report.ts",
  "src/cli/reporting/published-work-archive.ts",
  "src/catalog/diagnostics/description-coverage.ts",
  "src/catalog/diagnostics/description-priorities.ts",
  "src/catalog/diagnostics/specification-coverage.ts",
  "src/catalog/diagnostics/technical-density.ts",
  "src/catalog/diagnostics/audit-closure.ts",
  "src/cli/commands/catalog/catalog-audit-closure-report.ts",
  "src/cli/commands/catalog/technical-density-report.ts",
  "src/cli/commands/catalog/specification-coverage-report.ts",
  "src/cli/commands/catalog/catalog-content-gaps-options.ts"
]);

const enumerate = (directory, names = []) => {
  for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!["node_modules", "dist", "storage", ".git"].includes(entry.name)) enumerate(path, names);
    } else if (entry.isFile() && /\.(?:ts|mts|mjs|js)$/u.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      names.push(path);
    }
  }
  return names;
};
const loadSources = () => new Map([...enumerate("src"), ...enumerate("scripts")]
  .map((path) => [path, readFileSync(join(root, path), "utf8")]));

const resolveModule = (source, specifier, files) => {
  if (specifier === "fs" || specifier === "fs/promises" || specifier === "child_process") return `node:${specifier}`;
  if (!specifier.startsWith(".")) return specifier;
  const base = normalize(relative(root, resolve(root, dirname(source), specifier)));
  const options = [base, base.replace(/\.(?:m?js)$/u, ".ts"), `${base}.ts`, `${base}.mjs`, `${base}/index.ts`];
  return options.find((candidate) => files.has(candidate)) ?? base;
};
const namesFor = (file, sources) => {
  const source = ts.createSourceFile(file, sources.get(file), ts.ScriptTarget.Latest, true,
    extname(file) === ".ts" ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const imports = new Map();
  const modules = new Set();
  const deferred = [];
  const aliases = new Map();
  const remember = (module, imported, local) => imports.set(local, { module, imported });
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const module = resolveModule(file, statement.moduleSpecifier.text, sources);
      modules.add(module);
      const clause = statement.importClause;
      if (clause?.isTypeOnly) continue;
      if (clause?.name) remember(module, "default", clause.name.text);
      if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
        remember(module, "*", clause.namedBindings.name.text);
      } else if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) {
          if (!element.isTypeOnly) remember(module, (element.propertyName ?? element.name).text, element.name.text);
        }
      }
    } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      const module = resolveModule(file, statement.moduleSpecifier.text, sources);
      modules.add(module);
      if (!statement.isTypeOnly) {
        const elements = statement.exportClause && ts.isNamedExports(statement.exportClause)
          ? statement.exportClause.elements.filter((element) => !element.isTypeOnly)
          : [];
        deferred.push({ kind: "reexport", module, elements, node: statement });
      }
    }
  }
  const resolveName = (expression) => {
    if (ts.isParenthesizedExpression(expression)) return resolveName(expression.expression);
    if (ts.isIdentifier(expression)) return imports.get(expression.text) ?? aliases.get(expression.text);
    if (ts.isPropertyAccessExpression(expression)) {
      const owner = resolveName(expression.expression);
      if (owner?.module === "node:fs" && owner.imported === "promises") {
        return { module: "node:fs/promises", imported: expression.name.text };
      }
      if (owner && ["*", "default"].includes(owner.imported)) {
        return { module: owner.module, imported: expression.name.text };
      }
    }
    if (ts.isElementAccessExpression(expression) && ts.isStringLiteral(expression.argumentExpression)) {
      const owner = resolveName(expression.expression);
      if (owner?.imported === "*") return { module: owner.module, imported: expression.argumentExpression.text };
    }
    return null;
  };
  const visitAliases = (node) => {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      if (ts.isIdentifier(node.name)) {
        const alias = resolveName(node.initializer);
        if (alias) aliases.set(node.name.text, alias);
      } else if (ts.isObjectBindingPattern(node.name)) {
        const owner = resolveName(node.initializer);
        if (owner?.imported === "*") {
          for (const element of node.name.elements) {
            if (ts.isIdentifier(element.name)) aliases.set(element.name.text, {
              module: owner.module, imported: element.propertyName?.getText(source) ?? element.name.text
            });
          }
        }
      }
    }
    ts.forEachChild(node, visitAliases);
  };
  visitAliases(source);
  const calls = [];
  const append = (node, target, kind = "call") => {
    if (!target) return;
    const position = source.getLineAndCharacterOfPosition(node.getStart(source));
    let repeated = false;
    for (let current = node.parent; current; current = current.parent) {
      if (ts.isForStatement(current) || ts.isForOfStatement(current) || ts.isForInStatement(current) ||
        ts.isWhileStatement(current) || ts.isDoStatement(current)) repeated = true;
      if ((ts.isArrowFunction(current) || ts.isFunctionExpression(current)) &&
        ts.isCallExpression(current.parent) && ts.isPropertyAccessExpression(current.parent.expression) &&
        ["map", "forEach", "flatMap", "reduce"].includes(current.parent.expression.name.text)) repeated = true;
    }
    calls.push({ ...target, kind, repeated, line: position.line + 1, column: position.character + 1 });
  };
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      append(node, resolveName(node.expression));
      if ((node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require")) &&
        node.arguments.length && ts.isStringLiteral(node.arguments[0])) {
        const module = resolveModule(file, node.arguments[0].text, sources);
        modules.add(module);
        append(node, { module, imported: "*" }, "dynamic-import");
      }
    }
    if (ts.isExportDeclaration(node) && !node.moduleSpecifier && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const element of node.exportClause.elements) {
        const original = (element.propertyName ?? element.name).text;
        append(node, imports.get(original) ?? aliases.get(original), "reexport");
      }
    }
    if (ts.isVariableStatement(node) && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const declaration of node.declarationList.declarations) {
        if (declaration.initializer) append(node, resolveName(declaration.initializer), "reexport");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  for (const item of deferred) {
    for (const element of item.elements) {
      append(item.node, { module: item.module, imported: (element.propertyName ?? element.name).text }, "reexport");
    }
    if (!item.elements.length && contracts[item.module]) append(item.node, { module: item.module, imported: "*" }, "reexport");
  }
  return { modules, calls, bindings: [...imports.values()] };
};

const testSupport = (path) => path.startsWith("src/testing/") || /(?:^|\/)tests\//u.test(path) ||
  /\.test\.[cm]?[jt]s$/u.test(path) || path.startsWith("scripts/tests/");
const isProtectedSource = (path, discovered) => protectedSuites.includes(path) || Object.values(shared).includes(path) ||
  discovered.has(path);
const guard = (sources) => {
  const parsed = new Map([...sources].map(([file]) => [file, namesFor(file, sources)]));
  const related = new Set(protectedSuites);
  const queue = [...protectedSuites];
  for (let index = 0; index < queue.length; index++) {
    const file = queue[index];
    for (const module of parsed.get(file)?.modules ?? []) {
      if (!sources.has(module) || related.has(module)) continue;
      related.add(module);
      queue.push(module);
    }
  }
  const discovered = new Set();
  for (const [file, entry] of parsed) {
    if (!testSupport(file)) continue;
    if (related.has(file) || entry.modules.has(shared.finish) || entry.modules.has(shared.individual) ||
      entry.modules.has(shared.gaps)) discovered.add(file);
  }
  const relatedQueue = [...discovered];
  for (let index = 0; index < relatedQueue.length; index++) {
    const file = relatedQueue[index];
    for (const imported of parsed.get(file)?.modules ?? []) {
      if (testSupport(imported) && sources.has(imported) && !discovered.has(imported)) {
        discovered.add(imported);
        relatedQueue.push(imported);
      }
    }
  }
  const helperImports = new Set([...parsed].filter(([file]) =>
    protectedSuites.includes(file) || (testSupport(file) && discovered.has(file)))
    .flatMap(([, entry]) => [...entry.modules]));
  const errors = [];
  const count = new Map();
  const rawCount = new Map();
  const add = (file, call, message) => errors.push(`${file}:${call.line}:${call.column} | ${message}`);
  const increase = (bucket, file, kind) => {
    const key = `${file}#${kind}`;
    bucket.set(key, (bucket.get(key) ?? 0) + 1);
  };
  for (const [file, entry] of parsed) {
    const relevant = isProtectedSource(file, discovered) || dirname(file) === "src/testing/builders";
    const isNewRelatedHelper = helperImports.has(file) && !testSupport(file) && !trustedDirectImports.has(file) &&
      !trustedProduction.has(file);
    for (const call of entry.calls) {
      const contract = contracts[call.module]?.[call.imported];
      if (contract && !trustedProduction.has(file)) {
        if (call.kind !== "call") {
          add(file, call, `acceso indirecto a operación costosa (${contract[0]}); reutiliza ${contract[1]}`);
        } else {
          increase(count, file, contract[0]);
          if (call.repeated) add(file, call, `operación ${contract[0]} dentro de iteración; reutiliza el contexto ya preparado`);
          const limit = limits[file]?.[contract[0]] ??
            (["finish-factory", "published-factory"].includes(contract[0]) && testSupport(file) ? 1 : 0);
          if (limit === 0) {
            add(file, call, `nueva vía de ${contract[0]}; reutiliza ${contract[1]} (excepción de integración requiere revisar este guardián)`);
          }
        }
      }
      const raw = rawSources[call.module];
      if (raw && (relevant || isNewRelatedHelper) && !trustedProduction.has(file)) {
        if (call.kind !== "call") {
          add(file, call, `acceso indirecto a filesystem/procesos (${call.module}); utiliza las fixtures compartidas`);
        } else if (raw.has(call.imported)) {
          increase(rawCount, file, call.imported);
          if (!(rawLimits[file]?.[call.imported] > 0)) {
            add(file, call, `nueva preparación ${call.imported}; reutiliza ${shared.finish} o ${shared.gaps}`);
          }
        }
      }
      if (call.kind === "dynamic-import" && (contracts[call.module] || rawSources[call.module]) && (relevant || isNewRelatedHelper)) {
        add(file, call, `importación dinámica de operación costosa; utiliza el mecanismo compartido existente`);
      }
    }
  }
  for (const [file, entry] of parsed) {
    if (trustedProduction.has(file)) continue;
    for (const binding of entry.bindings) {
      const contract = contracts[binding.module]?.[binding.imported];
      if (!contract) continue;
      const allowed = limits[file]?.[contract[0]] ??
        (["finish-factory", "published-factory"].includes(contract[0]) && testSupport(file) ? 1 : 0);
      if (!allowed && !entry.calls.some((call) => call.module === binding.module && call.imported === binding.imported)) {
        errors.push(`${file} | importación nueva de ${binding.imported} sin mecanismo compartido; reutiliza ${contract[1]}`);
      }
    }
  }
  for (const [key, amount] of count) {
    const [file, kind] = key.split("#");
    const limit = limits[file]?.[kind] ??
      (["finish-factory", "published-factory"].includes(kind) && testSupport(file) ? 1 : 0);
    if (amount > limit) errors.push(`${file} | ${kind}: ${amount} ejecuciones declaradas, máximo acreditado ${limit}; amplía cobertura reutilizando contexto`);
  }
  for (const [key, amount] of rawCount) {
    const [file, kind] = key.split("#");
    const limit = rawLimits[file]?.[kind] ?? 0;
    if (amount > limit) errors.push(`${file} | ${kind}: ${amount} operaciones costosas, máximo acreditado ${limit}`);
  }
  const required = [
    [protectedSuites[0], shared.finish, "createIndividualFinishWorkspace"],
    [protectedSuites[1], shared.finish, "createIndividualFinishWorkspace"],
    [protectedSuites[2], shared.finish, "createPublishedIndividualFinishWorkspace"],
    [protectedSuites[3], shared.gaps, "executeBaseline"]
  ];
  for (const [file, module, symbol] of required) {
    const parsedFile = parsed.get(file);
    if (!parsedFile || !parsedFile.calls.some((call) => call.module === module && call.imported === symbol)) {
      errors.push(`${file} | falta uso de ${symbol} desde ${module}; la suite debe conservar la vía compartida`);
    }
  }
  return { errors, files: sources.size, contracts: count.size, raw: rawCount.size };
};

const sources = loadSources();
const result = guard(sources);
if (result.errors.length) {
  console.error(`FAIL | PROTECCIÓN DE TESTS | ${result.errors.length} incumplimientos`);
  for (const problem of result.errors) console.error(`  ${problem}`);
  process.exitCode = 1;
} else {
  console.log(`PASS | PROTECCIÓN DE TESTS | ${protectedSuites.length} suites | ${result.files} módulos | ${result.contracts} cuotas de ejecución | ${result.raw} cuotas de infraestructura`);
}
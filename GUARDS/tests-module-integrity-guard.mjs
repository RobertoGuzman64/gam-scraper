import { formatScriptStatus } from "../scripts/terminal.mjs";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { ts, visitNodes, isTest } from "./guards-architecture-core.mjs";

const productionLayers = new Set([
  "campaign", "catalog", "commercial", "contracts", "infrastructure",
  "preparation", "publication", "scraping", "shared"
]);
const providers = new Set(["gam", "gomariz", "mercaeleva", "manain"]);
const internalTools = new Set(["cli", "testing", "tools"]);
const portable = (path) => path.split(sep).join("/");
const sourceExtension = /\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/u;

const moduleSpecifiers = (path, code) => {
  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true);
  const specifiers = [];
  const add = (node) => {
    if (node && ts.isStringLiteralLike(node)) specifiers.push(node.text);
  };
  visitNodes(source, (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) add(node.moduleSpecifier);
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      add(node.moduleReference.expression);
    }
    if (ts.isCallExpression(node) && node.arguments.length === 1 &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        ts.isIdentifier(node.expression) && node.expression.text === "require")) add(node.arguments[0]);
  });
  return specifiers;
};

const resolvedLocalModule = (path, specifier) => {
  const absolute = resolve(dirname(path), specifier);
  const stem = absolute.replace(sourceExtension, "");
  const candidates = [
    `${stem}.ts`, `${stem}.tsx`, `${stem}.mts`, `${stem}.cts`, absolute,
    `${stem}.js`, `${stem}.mjs`, `${stem}.cjs`,
    resolve(absolute, "index.ts"), resolve(absolute, "index.js")
  ];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
};

const boundaryViolation = (source, target) => {
  const from = source.split("/");
  const to = target.split("/");
  if (source.startsWith("src/cli/reporting/") && target.startsWith("src/cli/commands/")) {
    return "La presentación de terminal no debe depender de orquestadores CLI";
  }
  if (from[0] !== "src" || to[0] !== "src" || !productionLayers.has(from[1])) return null;
  if (internalTools.has(to[1])) return "La lógica productiva no debe depender de CLI, herramientas ni fixtures de test";
  if (to.includes("tests") || /(?:\.test|\.spec)\.(?:ts|tsx|mts|js|mjs|cjs)$/u.test(target)) {
    return "Un módulo productivo no debe depender de módulos de pruebas";
  }
  if (from[1] === "preparation" && to[1] === "preparation" &&
    providers.has(from[2]) && providers.has(to[2]) && from[2] !== to[2]) {
    return "Las implementaciones de proveedores de preparación no deben importarse entre sí";
  }
  if (from[1] === "scraping" && to[1] === "scraping" &&
    from[2] === "providers" && to[2] === "providers" &&
    providers.has(from[3]) && providers.has(to[3]) && from[3] !== to[3]) {
    return "Los adaptadores de extracción de proveedores no deben importarse entre sí";
  }
  if (source.startsWith("src/preparation/shared/technical/") && to[1] === "commercial") {
    return "El motor técnico compartido no debe depender de la proyección comercial";
  }
  if (source.startsWith("src/commercial/projection/") && to[1] === "scraping") {
    return "La proyección comercial no debe depender directamente del scraping";
  }
  if (from[1] === "scraping" && to[1] === "commercial") {
    return "La extracción no debe depender de la capa comercial";
  }
  return null;
};

export const inspectModuleIntegrity = (root) => {
  const pending = [resolve(root, "src")];
  const missing = [];
  const boundaries = [];
  let inspected = 0;
  for (const forbidden of ["src/pipeline", "src/catalog/preparation"]) {
    if (existsSync(resolve(root, forbidden))) {
      boundaries.push(`${forbidden} | Ubicación de responsabilidad retirada de la arquitectura vigente`);
    }
  }
  while (pending.length > 0) {
    const directory = pending.pop();
    if (!directory || !existsSync(directory)) continue;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "tests") pending.push(path);
        continue;
      }
      if (!sourceExtension.test(path) || isTest(path)) continue;
      inspected++;
      const source = readFileSync(path, "utf8");
      const from = portable(relative(root, path));
      for (const specifier of moduleSpecifiers(from, source)) {
        if (!specifier.startsWith(".")) continue;
        const module = resolvedLocalModule(path, specifier);
        if (!module) {
          missing.push(`${from} → ${specifier}`);
          continue;
        }
        const to = portable(relative(root, module));
        const violation = boundaryViolation(from, to);
        if (violation) boundaries.push(`${from} → ${to} | ${violation}`);
      }
    }
  }
  return { inspected, missing, boundaries };
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = inspectModuleIntegrity(process.cwd());
  for (const problem of result.missing) console.error(`ERROR | IMPORT AUSENTE | ${problem}`);
  for (const problem of result.boundaries) console.error(`ERROR | FRONTERA ARQUITECTÓNICA | ${problem}`);
  if (result.missing.length || result.boundaries.length) {
    console.error(formatScriptStatus("FAIL", `INTEGRIDAD DEL REPOSITORIO | ${result.missing.length} imports ausentes | ${result.boundaries.length} infracciones arquitectónicas`));
    process.exitCode = 1;
  } else {
    console.log(formatScriptStatus("PASS", `INTEGRIDAD DEL REPOSITORIO | ${result.inspected} módulos TS productivos; 0 imports relativos ausentes; 0 infracciones arquitectónicas`));
  }
}

import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const require = createRequire(import.meta.url);

const loadCompiler = () => {
  try {
    return require("typescript");
  } catch {
    const globalCompiler = resolve(dirname(realpathSync(process.execPath)), "../lib/node_modules/typescript/lib/typescript.js");
    if (existsSync(globalCompiler)) return require(globalCompiler);
    throw new Error("Se necesita TypeScript (dependencia de desarrollo existente); no se instala ni se intenta compilar nada.");
  }
};

export const ts = loadCompiler();
export const slash = (value) => value.split(sep).join("/");
export const digest = (value) => createHash("sha256").update(value).digest("hex");

export const allSourceFiles = (root) => {
  const found = [];
  const walk = (directory) => {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== "dist") walk(full);
      } else if (entry.isFile() && /\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/u.test(entry.name)) found.push(slash(relative(root, full)));
    }
  };
  walk(resolve(root, "src"));
  walk(resolve(root, "scripts"));
  return found;
};

const resolveModule = (root, file, specifier) => {
  if (!specifier.startsWith(".")) return null;
  const resolved = resolve(root, dirname(file), specifier);
  const stem = resolved.replace(/\.(?:js|mjs|cjs|ts|mts|cts|tsx)$/u, "");
  for (const candidate of [
    `${stem}.ts`, `${stem}.tsx`, `${stem}.mts`, `${stem}.cts`,
    resolved, `${stem}.js`, `${stem}.mjs`, `${stem}.cjs`,
    join(resolved, "index.ts"), join(resolved, "index.js")
  ]) {
    if (existsSync(candidate) && /\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/u.test(candidate)) {
      return slash(relative(root, candidate));
    }
  }
  return null;
};

const importsFrom = (tsFile) => {
  const imported = new Set();
  const add = (specifier) => {
    if (specifier && ts.isStringLiteralLike(specifier)) imported.add(specifier.text);
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) add(node.moduleSpecifier);
    if (ts.isCallExpression(node) && node.arguments.length === 1 &&
      ((ts.isIdentifier(node.expression) && node.expression.text === "require") || node.expression.kind === ts.SyntaxKind.ImportKeyword)) {
      add(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(tsFile);
  return [...imported];
};

export const makeProject = (root) => {
  const files = new Map();
  const dependencies = new Map();
  for (const path of allSourceFiles(root)) {
    const absolute = resolve(root, path);
    const code = readFileSync(absolute, "utf8");
    const kind = /\.(?:js|mjs|cjs)$/u.test(path) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
    const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, kind);
    files.set(path, source);
  }
  for (const [path, source] of files) {
    const deps = importsFrom(source).map((specifier) => resolveModule(root, path, specifier)).filter(Boolean);
    dependencies.set(path, [...new Set(deps)].sort());
  }
  return { root, files, dependencies };
};

export const reachable = (project, roots) => {
  const seen = new Set();
  const visit = (path) => {
    if (seen.has(path) || !project.files.has(path)) return;
    seen.add(path);
    for (const dep of project.dependencies.get(path) ?? []) visit(dep);
  };
  for (const root of roots) visit(root);
  return seen;
};

export const visitNodes = (source, predicate) => {
  const visit = (node) => {
    predicate(node, source);
    ts.forEachChild(node, visit);
  };
  visit(source);
};

export const isTest = (path) => /(?:\.test|\.spec)\.(?:ts|tsx|mts|js|mjs|cjs)$/u.test(path);
export const nameOf = (node) => node && (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) ? node.text : node?.getText?.() ?? "";

export const findIssue = (rule, path, source, node, detail, signature) => {
  const position = node ? source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 : 0;
  const expression = signature ?? (node ? node.getText(source).replace(/\s+/gu, " ").slice(0, 280) : rule);
  return {
    rule, path, line: position, detail,
    id: `${rule}|${path}|${digest(expression).slice(0, 16)}`
  };
};

export const uniqueFindings = (items) => {
  const ordered = [...items].sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.rule.localeCompare(b.rule));
  const occurrences = new Map();
  return ordered.map((item) => {
    const next = (occurrences.get(item.id) ?? 0) + 1;
    occurrences.set(item.id, next);
    return next === 1 ? item : { ...item, id: `${item.id}#${next}` };
  });
};

export const optionsFrom = (argv) => {
  const options = { root: process.cwd(), audit: false, strict: false, detail: false };
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i];
    if (argument === "--root") {
      if (!argv[i + 1]) throw new Error("--root exige una ruta");
      options.root = resolve(argv[++i]);
    } else if (argument === "--audit") options.audit = true;
    else if (argument === "--strict") options.strict = true;
    else if (argument === "--detail") options.detail = true;
    else throw new Error(`Opción desconocida: ${argument}`);
  }
  return options;
};

export const present = (label, findings, options) => {
  const failed = findings.length > 0;
  const status = failed ? "FAIL" : "PASS";
  console.log(`${status} | ${label} | ${findings.length} infracciones | sin baseline ni deuda aceptada`);
  const shown = options.detail || options.audit ? findings : findings.slice(0, 35);
  for (const item of shown) {
    console.log(`  ERROR | ${item.rule} | ${item.path}:${item.line} | ${item.detail}`);
  }
  if (findings.length > shown.length) {
    console.log(`  ... ${findings.length - shown.length} infracciones adicionales (usar --detail)`);
  }
  return { exitCode: failed ? 1 : 0, findings };
};

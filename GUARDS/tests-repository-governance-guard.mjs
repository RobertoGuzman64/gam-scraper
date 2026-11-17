import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatScriptStatus } from "../scripts/terminal.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const excludedDirectories = new Set([".git", "node_modules", "dist", "storage", "output", "out", "reports", "coverage"]);
const scriptExtension = /\.(?:[cm]?[jt]s|[jt]sx|ps1|py|sh|cmd|bat)$/iu;
const externalScriptExtension = /\.(?:mjs|cjs|ps1|py|sh|cmd|bat)$/iu;
const phaseFileName = /(?:^|[-_.])(?:fase|phase)[-_.]?(?:\d+|[ivxlcdm]+)(?=$|[-_.])|(?:^|[-_.])(?:f\d+|operativa[-_.]?f\d+)(?=$|[-_.])/iu;
const temporaryFileName = /(?:^|[-_.])(?:temp|temporary|tmp|scratch|backup)(?=$|[-_.])|(?:~|\.(?:bak|orig|rej|swp|swo|tmp))$/iu;

const walk = (root, directory = "") => {
  const files = [];
  for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
    const pathname = [directory, entry.name].filter(Boolean).join("/");
    if (entry.isDirectory()) {
      if (!(directory === "" && excludedDirectories.has(entry.name))) files.push(...walk(root, pathname));
    } else if (entry.isFile()) {
      files.push(pathname);
    }
  }
  return files;
};

const isScript = (pathname) => {
  if (/^(?:scripts|GUARDS|interventions)\//u.test(pathname)) return scriptExtension.test(pathname);
  if (/^(?:tools|bin)\//u.test(pathname)) return scriptExtension.test(pathname);
  return externalScriptExtension.test(pathname) || (!pathname.includes("/") && scriptExtension.test(pathname));
};

export const repositoryInventory = (root) => {
  const paths = walk(root);
  const markdownPaths = paths.filter((pathname) => /\.md$/iu.test(pathname));
  const scriptPaths = paths.filter(isScript);
  const counts = { markdown: markdownPaths.length, scripts: scriptPaths.length };
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  return { paths, counts, markdownPaths, scriptPaths, npmScripts: packageJson.scripts ?? {}, npmBin: packageJson.bin ?? null };
};

const differences = (label, expected, actual, findings) => {
  for (const name of Object.keys(actual)) {
    if (!Object.hasOwn(expected, name)) findings.push(`${label} no autorizado: ${name}`);
    else if (actual[name] !== expected[name]) findings.push(`${label} modificado sin actualizar el contrato: ${name}`);
  }
  for (const name of Object.keys(expected)) {
    if (!Object.hasOwn(actual, name)) findings.push(`${label} eliminado o movido: ${name}`);
  }
};

const validPaths = (paths, extension) => Array.isArray(paths) &&
  paths.every((pathname) => typeof pathname === "string" && pathname.length > 0 &&
    !pathname.startsWith("/") && !pathname.includes("\\") &&
    pathname.split("/").every((part) => part.length > 0 && part !== "." && part !== "..") &&
    !excludedDirectories.has(pathname.split("/")[0]) && extension(pathname)) &&
  new Set(paths).size === paths.length;

export const inspectRepositoryGovernance = (root, policy) => {
  if (policy?.version !== 3 || !policy.maxCounts ||
    !Number.isSafeInteger(policy.maxCounts.markdown) || policy.maxCounts.markdown < 0 ||
    !Number.isSafeInteger(policy.maxCounts.scripts) || policy.maxCounts.scripts < 0 ||
    !policy.allowedPaths ||
    !validPaths(policy.allowedPaths.markdown, (pathname) => /\.md$/iu.test(pathname)) ||
    !validPaths(policy.allowedPaths.scripts, isScript) ||
    policy.allowedPaths.markdown.length !== policy.maxCounts.markdown ||
    policy.allowedPaths.scripts.length !== policy.maxCounts.scripts ||
    !policy.npmScripts || typeof policy.npmScripts !== "object" || Array.isArray(policy.npmScripts) ||
    !Object.hasOwn(policy, "npmBin")) {
    throw new Error("Contrato de gobernanza inválido");
  }
  const inventory = repositoryInventory(root);
  const findings = [];
  if (inventory.counts.markdown > policy.maxCounts.markdown) {
    findings.push(`Exceso de Markdown: ${inventory.counts.markdown} (máximo ${policy.maxCounts.markdown})`);
  }
  if (inventory.counts.scripts > policy.maxCounts.scripts) {
    findings.push(`Exceso de scripts: ${inventory.counts.scripts} (máximo ${policy.maxCounts.scripts})`);
  }
  for (const [label, currentPaths, authorizedPaths] of [
    ["Markdown", inventory.markdownPaths, policy.allowedPaths.markdown],
    ["Script", inventory.scriptPaths, policy.allowedPaths.scripts]
  ]) {
    const authorized = new Set(authorizedPaths);
    for (const pathname of currentPaths) {
      if (!authorized.has(pathname)) findings.push(`${label} no autorizado: ${pathname}`);
    }
  }
  differences("Comando npm", policy.npmScripts, inventory.npmScripts, findings);
  if (JSON.stringify(inventory.npmBin) !== JSON.stringify(policy.npmBin)) {
    findings.push("Entradas ejecutables package.json/bin modificadas");
  }
  for (const pathname of inventory.paths) {
    if (pathname.startsWith("docs/") && !/\.md$/iu.test(pathname)) {
      findings.push(`Archivo no autorizado en docs/: ${pathname}`);
    }
    if (pathname.startsWith("scripts/") && !isScript(pathname)) {
      findings.push(`Archivo no autorizado en scripts/: ${pathname}`);
    }
    if (pathname.startsWith("GUARDS/") && pathname !== "GUARDS/repository-governance.json" &&
      !/\.md$/iu.test(pathname) && !isScript(pathname)) {
      findings.push(`Archivo no autorizado en GUARDS/: ${pathname}`);
    }
    const fileName = pathname.split("/").at(-1);
    if (phaseFileName.test(fileName)) findings.push(`Nombre de fase prohibido: ${pathname}`);
    if (temporaryFileName.test(fileName) &&
      (/\.(?:md|txt)$/iu.test(pathname) || scriptExtension.test(pathname) || /^(?:docs|GUARDS|scripts)\//u.test(pathname))) {
      findings.push(`Archivo temporal prohibido: ${pathname}`);
    }
  }
  if (existsSync(join(root, ".git"))) {
    try {
      const tracked = execFileSync("git", ["ls-files", "-z", "--", "reports"], { cwd: root, encoding: "utf8" });
      for (const pathname of tracked.split("\0").filter(Boolean)) {
        findings.push(`Artefacto reports/ versionado: ${pathname}`);
      }
    } catch {
      findings.push("No se ha podido comprobar el índice Git de reports/");
    }
  }
  return {
    findings,
    counts: {
      markdown: inventory.counts.markdown,
      scripts: inventory.counts.scripts,
      npmScripts: Object.keys(inventory.npmScripts).length
    }
  };
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const policy = JSON.parse(readFileSync(join(repositoryRoot, "GUARDS/repository-governance.json"), "utf8"));
    const result = inspectRepositoryGovernance(repositoryRoot, policy);
    for (const finding of result.findings) console.error(formatScriptStatus("FAIL", `GOBERNANZA | ${finding}`, process.stderr));
    const status = result.findings.length ? "FAIL" : "PASS";
    console.log(formatScriptStatus(status, `GOBERNANZA | ${result.counts.markdown} Markdown | ${result.counts.scripts} scripts | ${result.counts.npmScripts} comandos npm | ${result.findings.length} infracciones`));
    if (result.findings.length) process.exitCode = 1;
  } catch (error) {
    console.error(formatScriptStatus("FAIL", `GOBERNANZA | ${error instanceof Error ? error.message : String(error)}`, process.stderr));
    process.exitCode = 1;
  }
}

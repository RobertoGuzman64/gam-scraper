import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const excludedDirectories = new Set([".git", "node_modules", "dist", "storage", "output", "out", "reports", "coverage"]);
const scriptExtension = /\.(?:[cm]?[jt]s|[jt]sx|ps1|py|sh|cmd|bat)$/iu;
const externalScriptExtension = /\.(?:mjs|cjs|ps1|py|sh|cmd|bat)$/iu;
const phaseFileName = /(?:^|[-_.])(?:fase|phase)[-_.]?(?:\d+|[ivxlcdm]+)(?=$|[-_.])|(?:^|[-_.])(?:f\d+|operativa[-_.]?f\d+)(?=$|[-_.])/iu;

const hash = (value) => createHash("sha256").update(value).digest("hex");

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
  const markdown = {};
  const scripts = {};
  for (const pathname of paths) {
    if (/\.md$/iu.test(pathname)) markdown[pathname] = hash(readFileSync(join(root, pathname)));
    if (isScript(pathname)) scripts[pathname] = hash(readFileSync(join(root, pathname)));
  }
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  return { paths, markdown, scripts, npmScripts: packageJson.scripts ?? {}, npmBin: packageJson.bin ?? null };
};

const differences = (label, expected, actual, findings) => {
  for (const name of Object.keys(actual)) {
    if (!(name in expected)) findings.push(`${label} no autorizado: ${name}`);
    else if (actual[name] !== expected[name]) findings.push(`${label} modificado sin actualizar el contrato: ${name}`);
  }
  for (const name of Object.keys(expected)) {
    if (!(name in actual)) findings.push(`${label} eliminado o movido: ${name}`);
  }
};

export const inspectRepositoryGovernance = (root, policy) => {
  if (policy.version !== 1 || !policy.markdown || !policy.scripts || !policy.npmScripts || !("npmBin" in policy)) {
    throw new Error("Contrato de gobernanza inválido");
  }
  const inventory = repositoryInventory(root);
  const findings = [];
  differences("Markdown", policy.markdown, inventory.markdown, findings);
  differences("Script", policy.scripts, inventory.scripts, findings);
  differences("Comando npm", policy.npmScripts, inventory.npmScripts, findings);
  if (JSON.stringify(inventory.npmBin) !== JSON.stringify(policy.npmBin)) {
    findings.push("Entradas ejecutables package.json/bin modificadas");
  }
  for (const pathname of inventory.paths) {
    if (phaseFileName.test(pathname.split("/").at(-1))) findings.push(`Nombre de fase prohibido: ${pathname}`);
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
      markdown: Object.keys(inventory.markdown).length,
      scripts: Object.keys(inventory.scripts).length,
      npmScripts: Object.keys(inventory.npmScripts).length
    }
  };
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const policy = JSON.parse(readFileSync(join(repositoryRoot, "GUARDS/repository-governance.json"), "utf8"));
    const result = inspectRepositoryGovernance(repositoryRoot, policy);
    for (const finding of result.findings) console.error(`FAIL | GOBERNANZA | ${finding}`);
    const status = result.findings.length ? "FAIL" : "PASS";
    console.log(`${status} | GOBERNANZA | ${result.counts.markdown} Markdown | ${result.counts.scripts} scripts | ${result.counts.npmScripts} comandos npm | ${result.findings.length} infracciones`);
    if (result.findings.length) process.exitCode = 1;
  } catch (error) {
    console.error(`FAIL | GOBERNANZA | ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

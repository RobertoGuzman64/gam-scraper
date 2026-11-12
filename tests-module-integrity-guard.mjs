import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";

const root = process.cwd();
const pending = [resolve(root, "src")];
const problems = [];
let inspected = 0;
while (pending.length > 0) {
  const directory = pending.pop();
  if (!directory) continue;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "tests") pending.push(path);
      continue;
    }
    if (!path.endsWith(".ts") || path.endsWith(".test.ts")) continue;
    inspected++;
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(/\b(?:from\s*|import\s*\(?)\s*["']([^"']+)["']/gu)) {
      if (!match[1]?.startsWith(".")) continue;
      const module = resolve(dirname(path), match[1].replace(/\.js$/u, ".ts"));
      if (!existsSync(module)) problems.push(`${relative(root, path)} → ${match[1]}`);
    }
  }
}
if (problems.length > 0) {
  throw new Error(`Imports locales de producción ausentes:\n${problems.join("\n")}`);
}
console.log(`PASS | INTEGRIDAD DEL REPOSITORIO | ${inspected} módulos TS productivos; 0 imports relativos ausentes`);

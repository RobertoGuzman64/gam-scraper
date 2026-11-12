import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

const root = process.cwd();
const output = resolve(root, "reports/editorial-phase7");
const sources = [];
const visit = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) visit(path);
    else if (path.endsWith(".ts")) sources.push(path);
  }
};
visit(resolve(root, "src"));

const imports = new Map();
const reverse = new Map();
for (const file of sources) {
  const code = readFileSync(file, "utf8");
  const dependencies = [];
  for (const match of code.matchAll(/\b(?:from\s*|import\s*\(?)\s*["']([^"']+)["']/gu)) {
    if (!match[1]?.startsWith(".")) continue;
    const target = resolve(dirname(file), match[1].replace(/\.js$/u, ".ts"));
    if (!existsSync(target)) continue;
    dependencies.push(target);
    reverse.set(target, [...(reverse.get(target) ?? []), file]);
  }
  imports.set(file, dependencies);
}

const reachable = new Set();
const walk = (file) => {
  if (reachable.has(file)) return;
  reachable.add(file);
  for (const child of imports.get(file) ?? []) walk(child);
};
walk(resolve(root, "src/preparation/prepare-product.ts"));

const loadCsv = (name) => {
  const text = readFileSync(resolve(root, name), "utf8").replace(/^\uFEFF/u, "");
  const cells = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(value);
      if (row.some((cell) => cell.length > 0)) cells.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  if (value || row.length) { row.push(value); cells.push(row); }
  const [header, ...body] = cells;
  if (!header) throw new Error(`Inventario vacío: ${name}`);
  return body.map((cells) => Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ""])));
};

const f1 = "reports/editorial-phase2/phase1-inventory/";
const modules = loadCsv(`${f1}01-INVENTARIO-TOTAL-EDITORIAL-140.csv`);
const symbols = loadCsv(`${f1}02-INVENTARIO-SIMBOLOS.csv`);
const capabilities = loadCsv("reports/editorial-phase5/82-capacidades-trazabilidad.csv");
if (modules.length !== 140 || symbols.length !== 1509 || capabilities.length !== 82) {
  throw new Error(`Inventario base discordante: ${modules.length} / ${symbols.length} / ${capabilities.length}`);
}
const rel = (path) => relative(root, path).split(sep).join("/");
const statusByPath = new Map();
const checkedModules = modules.map((entry) => {
  const full = resolve(root, entry.ruta);
  const present = existsSync(full);
  const consumers = reverse.get(full) ?? [];
  const tests = consumers.filter((consumer) => consumer.endsWith(".test.ts") || consumer.includes("/tests/"));
  const remaining = consumers.filter((consumer) => !tests.includes(consumer));
  const preparation = reachable.has(full);
  const state = !present ? "retirado" : preparation ? "productivo" : remaining.length ?
    "no_alcanzable_con_dependencias" : tests.length ? "solo_pruebas_historicas" : "sin_importadores";
  statusByPath.set(entry.ruta, state);
  return {
    ruta: entry.ruta,
    estado: state,
    importadores_productivos: remaining.map(rel).join(" | "),
    importadores_tests: tests.length,
    sha256_origen_f1: entry.sha256,
    destino_propuesto_f1: entry.destino_propuesto
  };
});

const checkedSymbols = symbols.map((entry) => ({
  ruta: entry.ruta,
  linea_f1: entry.linea,
  simbolo_f1: entry.simbolo,
  alcance_f1: entry.alcance,
  estado_modulo_f7: statusByPath.get(entry.ruta) ?? "fuera_inventario",
  destino_propuesto_f1: entry.destino,
  equivalencia_demostrada_por_simbolo: "no_acreditada_individualmente"
}));

const checkedCapabilities = capabilities.map((entry) => ({
  id: entry.id,
  grupo: entry.grupo,
  regla_funcional: entry.regla_funcional,
  precondicion_f1: entry.hechos_y_precondicion_f1,
  negativa_f1: entry.negativa_f1,
  estado_f5: entry.estado_f5,
  ubicacion_f5: entry.ubicacion_operativa_o_evidencia,
  avance_f7: entry.id === "RE021" ? "tension_bateria_afirmada_compartida_y_negativos" :
    entry.id === "RE055" ? "compresion_corta_sin_perdida_de_hechos_y_negativos" :
      entry.id === "RE081" ? "autoridad_unica_acreditada_fase6" : "sin_nueva_equivalencia_individual",
  equivalencia_f1: "pendiente_de_acreditacion_exhaustiva"
}));

const asCsv = (rows) => {
  const fields = Object.keys(rows[0] ?? {});
  const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [fields.join(","), ...rows.map((row) => fields.map((name) => quote(row[name])).join(","))].join("\n") + "\n";
};
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, "01-82-capacidades.csv"), asCsv(checkedCapabilities));
writeFileSync(resolve(output, "02-140-modulos.csv"), asCsv(checkedModules));
writeFileSync(resolve(output, "03-1509-simbolos.csv"), asCsv(checkedSymbols));
const counts = Object.fromEntries([...new Set(checkedModules.map((item) => item.estado))]
  .map((state) => [state, checkedModules.filter((item) => item.estado === state).length]));
const summary = {
  phase: 7,
  modulesF1: modules.length,
  symbolsF1: symbols.length,
  capabilitiesF1: capabilities.length,
  reachedFromPreparation: reachable.size,
  statuses: counts,
  sourceRulesImplemented: ["RE021", "RE055"],
  individuallyAccreditedHistoricSymbols: 0,
  exhaustiveMigrationCertified: false
};
writeFileSync(resolve(output, "00-inventario.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(`AUDITORÍA EDITORIAL RESIDUAL | ${modules.length} módulos | ${symbols.length} símbolos | ${capabilities.length} capacidades | ${JSON.stringify(counts)}`);

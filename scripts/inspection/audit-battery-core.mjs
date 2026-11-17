import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectPublicationOriginals } from "./publication-original-provenance.mjs";

export const AUDIT_MODES = Object.freeze([
  { id: "finales", command: "huecos", args: ["--finales", "--json"], format: "json", stage: "publicacion_final" },
  { id: "tecnicas", command: "huecos", args: ["--tecnicas", "--json"], format: "json", stage: "publicacion_tecnica" },
  { id: "gomariz", command: "huecos", args: ["--catalogo", "catalogs/providers/gomariz/original/scrape-gomariz-catalog.json", "--json"], format: "json", stage: "originales_canonicos" },
  { id: "tecnicas-detalle", command: "huecos", args: ["--tecnicas", "--detalle"], format: "texto", stage: "publicacion_tecnica" },
  { id: "comparar", command: "huecos", args: ["--comparar", "--json"], format: "json", stage: "comparacion_publicacion_original" },
  { id: "comparar-specs", command: "huecos", args: ["--comparar", "--specs", "--json"], format: "json", stage: "comparacion_publicacion_original" },
  { id: "comparar-titulos", command: "huecos", args: ["--comparar", "--titulos", "--json"], format: "json", stage: "comparacion_publicacion_original" },
  { id: "revision", command: "auditar:comercial", args: ["--revision"], format: "texto", stage: "publicacion_final" },
  { id: "contenido-revision", command: "auditar:comercial", args: ["--contenido-revision"], format: "texto", stage: "publicacion_final" },
  { id: "acreditacion-json", command: "auditar:comercial", args: ["--acreditacion-json"], format: "json", stage: "publicacion_final" },
  { id: "coherencia", command: "auditar:comercial", args: ["--coherencia"], format: "texto", stage: "preparacion_recalculada" }
]);

const digest = (value) => createHash("sha256").update(value).digest("hex");
const message = (error) => error instanceof Error ? error.message : String(error);
const relativePath = (base, path) => relative(base, path).split(sep).join("/");
const validJson = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export const classifyAudit = (mode, run, json) => {
  if (run.error || run.timedOut || run.signal || run.exitCode === null ||
    (mode.format === "json" && !validJson(json)) || json?.status === "ERROR") return "ERROR";
  const coverage = validJson(json?.auditCoverage) ? json.auditCoverage : null;
  if (coverage && (coverage.errors > 0 || coverage.failures?.some((item) => item.category === "ERROR"))) return "ERROR";
  if ((coverage && coverage.incompleteSource > 0) || /^INCOMPLETE_SOURCE\s*\|/mu.test(run.stderr)) return "INCOMPLETE_SOURCE";
  if (/^ERROR\s*\|/mu.test(run.stderr)) return "ERROR";
  if (run.exitCode === 0) return "SUCCESS";
  if (mode.id === "coherencia" && /\b[1-9]\d* defectos\b/u.test(run.stdout) && /^\s*DEFECTO\s/mu.test(run.stdout)) return "FINDINGS";
  return "ERROR";
};

export const executeNode = async (root, args, timeoutMs) => {
  const child = spawn(process.execPath, args, {
    cwd: root, env: { ...process.env, NO_COLOR: "1", CI: "1", TERM: "dumb" },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true
  });
  const stdout = [];
  const stderr = [];
  child.stdout.on("data", (chunk) => stdout.push(chunk));
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
  const result = await new Promise((done) => {
    let spawnError = null;
    child.once("error", (error) => { spawnError = message(error); });
    child.once("close", (exitCode, signal) => done({ exitCode, signal, error: spawnError }));
  });
  clearTimeout(timer);
  return { ...result, stdout: Buffer.concat(stdout).toString("utf8"),
    stderr: Buffer.concat(stderr).toString("utf8"), timedOut };
};

const readSources = async (root) => {
  const { readEditorialPopulations } = await import("./editorial-populations.mjs");
  const [originals, populations] = await Promise.all([
    inspectPublicationOriginals(root), readEditorialPopulations(root)
  ]);
  return { originals, populations };
};

const sourceFingerprint = (sources) => {
  const { analyzedAt, ...populations } = sources.populations;
  return digest(JSON.stringify({ originals: sources.originals, populations }));
};

const modeSourceStages = (mode, byStage) => {
  const needed = mode.stage === "comparacion_publicacion_original" ? ["originales_canonicos", "publicacion_final"]
    : mode.stage === "preparacion_recalculada" ? ["originales_canonicos"] : [mode.stage];
  return byStage.filter((item) => needed.includes(item.stage)).map((item) => ({
    stage: item.stage, products: item.products, complete: item.complete,
    providers: item.providers.map((provider) => ({ providerId: provider.providerId, products: provider.products,
      sourceSha256: provider.sourceSha256, sourceCut: provider.sourceCut }))
  }));
};

const renderSummary = (report) => {
  const lines = [
    "# Expediente de auditorías EQUIPZILLA",
    "",
    `Corte iniciado: ${report.startedAt}. Finalizado: ${report.finishedAt}.`,
    `Estado global: **${report.status}**. Fuente y universos: ${report.sources.status}.`,
    "",
    "| Auditoría | Estado | Código | Duración | Universo |",
    "|---|---|---:|---:|---|",
    ...report.audits.map((item) => `| ${item.id} | ${item.status} | ${item.exitCode ?? "—"} | ${item.durationMs} ms | ${item.stage} |`),
    "",
    `**Contabilización de modos:** ${report.audits.length}/11; ` +
      Object.entries(report.totals).map(([key, count]) => `${key} ${count}`).join(" · "),
    "",
    "## Poblaciones y etapas",
    ""
  ];
  if (report.sources.status !== "ERROR") {
    for (const group of report.sources.byStage) {
      lines.push(`- ${group.stage}: ${group.products ?? "no disponible"} productos; ` +
        `${group.complete ? "completo" : "parcial"}; ` +
        group.providers.map((item) => `${item.providerId} ${item.products} (${item.sourceSha256})`).join(", "));
    }
    const unavailable = report.sources.originalAvailability.sources.filter((item) => !item.available);
    if (unavailable.length) lines.push(`- Fuentes históricas no disponibles: ${unavailable.map((item) => `${item.providerId} (${item.expected.catalogSha256})`).join(", ")}. No se sustituyen por originales de otro corte.`);
  } else lines.push(`- Procedencia no evaluable: ${report.sources.error ?? "fuentes distintas durante la auditoría"}`);
  lines.push("", "- `preparado`: no evaluado por esta batería; los originales canónicos no equivalen a una preparación.",
    "- `auditado`: los once modos se registran individualmente arriba, con sus fuentes originales.",
    "- `exportado`: no evaluado ni generado. Esta batería no exporta paquetes.", "",
    "## Condiciones de lectura", "",
    "Los ficheros JSON de resultados solo existen cuando el auditor emitió un documento JSON válido. Los demás textos se conservan literalmente. La ausencia de fuente histórica no equivale a cero hallazgos.",
    "El objetivo exploratorio de seis atributos no es una infracción ni modifica umbrales de negocio.",
    "Cada modo incluye comandos, capturas, huellas, duración y cobertura en `manifest.json`. Los documentos no se mezclan con ejecuciones anteriores.", "");
  if (report.build.status !== "SUCCESS") lines.push(`**Herramientas:** ${report.build.status}; ${report.build.error ?? "consultar captura de compilación"}.`, "");
  if (report.sources.changed) lines.push("**ADVERTENCIA:** el origen cambió durante la batería: no comparar estos resultados como un solo corte.", "");
  return lines.join("\n");
};

export const runAuditBattery = async ({ root, outDirectory, timeoutMs = 240_000,
  execute = executeNode, prepare = null, sources = readSources } = {}) => {
  const workspace = resolve(root ?? dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
  const parent = resolve(outDirectory ?? join(workspace, "catalogs", "reports", "audit-battery"));
  await mkdir(parent, { recursive: true });
  const output = await mkdtemp(join(parent, "corte-"));
  const startedAt = new Date().toISOString();
  const buildStart = Date.now();
  const buildArgs = ["scripts/run-build.mjs", "--quiet", "--if-needed"];
  const safeRun = async (args) => {
    try { return await execute(workspace, args, timeoutMs); }
    catch (error) { return { stdout: "", stderr: "", exitCode: null,
      signal: null, error: message(error), timedOut: false }; }
  };
  const buildResult = prepare ? await prepare(workspace, timeoutMs) : await safeRun(buildArgs);
  const buildStatus = buildResult.exitCode === 0 && !buildResult.error && !buildResult.timedOut && !buildResult.signal ? "SUCCESS" : "ERROR";
  await writeFile(join(output, "build.stdout.txt"), buildResult.stdout);
  await writeFile(join(output, "build.stderr.txt"), buildResult.stderr);
  const build = { status: buildStatus, exitCode: buildResult.exitCode, durationMs: Date.now() - buildStart,
    error: buildResult.error ?? (buildStatus === "ERROR" ? "No se pudo acreditar la compilación" : null) };
  let before = null;
  let sourceError = null;
  if (buildStatus === "SUCCESS") {
    try { before = await sources(workspace); }
    catch (error) { sourceError = message(error); }
  }
  const folder = join(output, "resultados");
  await mkdir(folder);
  const audits = [];
  for (const mode of AUDIT_MODES) {
    const started = new Date().toISOString();
    const time = Date.now();
    const args = ["scripts/tooling.mjs", mode.command, ...mode.args];
    const run = buildStatus === "SUCCESS" ? await safeRun(args)
      : { stdout: "", stderr: "", exitCode: null, signal: null, error: "Compilación no disponible", timedOut: false };
    const durationMs = Date.now() - time;
    const capture = `${mode.id}.stdout.txt`;
    const errors = `${mode.id}.stderr.txt`;
    await writeFile(join(folder, capture), run.stdout);
    await writeFile(join(folder, errors), run.stderr);
    let json = null;
    if (mode.format === "json") {
      try { json = JSON.parse(run.stdout); }
      catch { json = null; }
    }
    const status = classifyAudit(mode, run, json);
    const jsonPath = status !== "ERROR" && mode.format === "json" && validJson(json) ? `${mode.id}.json` : null;
    if (jsonPath) await writeFile(join(folder, jsonPath), run.stdout);
    const coverage = validJson(json?.auditCoverage) ? json.auditCoverage : null;
    audits.push({ id: mode.id, command: mode.command, args: mode.args, stage: mode.stage,
      startedAt: started, finishedAt: new Date().toISOString(), durationMs,
      exitCode: run.exitCode, signal: run.signal ?? null, timedOut: run.timedOut,
      status, error: run.error ?? (status === "ERROR" ? "Revisar stdout, stderr y código de salida" : null),
      stdout: relativePath(output, join(folder, capture)), stderr: relativePath(output, join(folder, errors)),
      stdoutSha256: digest(run.stdout), stderrSha256: digest(run.stderr),
      json: jsonPath ? relativePath(output, join(folder, jsonPath)) : null,
      provenance: validJson(json?.provenance) ? json.provenance : null, auditCoverage: coverage,
      sourceStages: modeSourceStages(mode, before?.populations.byStage ?? []) });
  }
  let after = null;
  if (buildStatus === "SUCCESS" && before) {
    try { after = await sources(workspace); }
    catch (error) { sourceError = message(error); }
  }
  const beforeSha256 = before ? sourceFingerprint(before) : null;
  const afterSha256 = after ? sourceFingerprint(after) : null;
  const changed = beforeSha256 !== null && afterSha256 !== null && beforeSha256 !== afterSha256;
  const sourceStatus = sourceError || !after || !before || changed ? "ERROR"
    : before.originals.complete ? "SUCCESS" : "INCOMPLETE_SOURCE";
  const byStage = before?.populations.byStage ?? [];
  const evidence = { version: 1, startedAt, sourceStatus, beforeSha256, afterSha256,
    originalAvailability: before?.originals ?? null, populations: before?.populations ?? null,
    error: sourceError };
  await writeFile(join(output, "fuentes.json"), JSON.stringify(evidence, null, 2) + "\n");
  const totals = Object.fromEntries(["SUCCESS", "FINDINGS", "INCOMPLETE_SOURCE", "ERROR"].map((key) =>
    [key, audits.filter((item) => item.status === key).length]));
  const status = buildStatus === "ERROR" || sourceStatus === "ERROR" || totals.ERROR ? "ERROR"
    : totals.INCOMPLETE_SOURCE || sourceStatus === "INCOMPLETE_SOURCE" ? "INCOMPLETE_SOURCE"
      : totals.FINDINGS ? "FINDINGS" : "SUCCESS";
  const report = { version: 1, startedAt, finishedAt: new Date().toISOString(), status,
    workspace, build, sources: { status: sourceStatus, changed, error: sourceError,
      beforeSha256, afterSha256, byStage, originalAvailability: before?.originals ?? null }, totals, audits,
    stages: { originales: "fuentes.json", preparado: "NO_EVALUADO", publicado: "fuentes.json",
      snapshotTecnico: "fuentes.json", auditado: `${audits.length} modos`, exportado: "NO_EVALUADO" } };
  await writeFile(join(output, "manifest.json"), JSON.stringify(report, null, 2) + "\n");
  await writeFile(join(output, "resumen.txt"), renderSummary(report));
  return { output, report };
};

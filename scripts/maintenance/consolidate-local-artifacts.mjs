import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, lstat, mkdir, open, readFile, readdir, rename, rm, rmdir, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isPublicationDirectoryName, matchesPublicationApproval } from "../shared/publication-identity.mjs";
import { readOfflinePreparation } from "../../dist/infrastructure/filesystem/preparation/offline-preparation.js";
import { isPublicationTechnicalProvenance } from "../../dist/contracts/technical-provenance.js";

const providers = ["gam", "gomariz", "mercaeleva", "manain"];
const memberSuffixes = ["-preparation.manifest.json", "-preparation.json", "-diagnostics.json", "-comparison.json"];
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const missing = (error) => error !== null && typeof error === "object" && error.code === "ENOENT";
const validSha = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

const regularFile = async (path) => {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new Error(`Archivo no regular o compartido: ${path}`);
  return info;
};

const regularDirectory = async (path) => {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Directorio no regular: ${path}`);
};

const readJson = async (path) => {
  await regularFile(path);
  return JSON.parse(await readFile(path, "utf8"));
};

const list = async (path) => {
  try {
    await regularDirectory(path);
    return await readdir(path, { withFileTypes: true });
  } catch (error) {
    if (missing(error)) return [];
    throw error;
  }
};

const addUnit = (units, paths, reason) => {
  for (const path of paths) {
    if (units.has(path)) throw new Error(`Duplicado en el plan: ${path}`);
    units.set(path, reason);
  }
};

const preparedSets = async (root, provider) => {
  const folder = join(root, "storage", "prepared", provider);
  const names = (await list(folder)).map((entry) => {
    if (!entry.isFile() || entry.isSymbolicLink()) throw new Error(`Entrada desconocida en ${folder}: ${entry.name}`);
    return entry.name;
  });
  const grouped = new Map();
  for (const name of names) {
    const suffix = memberSuffixes.find((part) => name.endsWith(part));
    if (!suffix) throw new Error(`Artefacto de preparación sin clasificar: ${name}`);
    const id = name.slice(0, -suffix.length);
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error(`Prefijo de preparación inválido: ${name}`);
    grouped.set(id, [...(grouped.get(id) ?? []), name]);
  }
  const sets = [];
  for (const [id, members] of grouped) {
    for (const suffix of ["-preparation.json", "-preparation.manifest.json", "-diagnostics.json"]) {
      if (!members.includes(`${id}${suffix}`)) throw new Error(`Preparación incompleta: ${id}`);
    }
    const preparationPath = join(folder, `${id}-preparation.json`);
    const [raw, manifest, diagnostics] = await Promise.all([
      readFile(preparationPath),
      readJson(join(folder, `${id}-preparation.manifest.json`)),
      readJson(join(folder, `${id}-diagnostics.json`))
    ]);
    const preparation = JSON.parse(raw.toString("utf8"));
    if (!isRecord(preparation) || !isRecord(preparation.source) || !isRecord(manifest) ||
      manifest.version !== 1 || manifest.providerId !== provider ||
      manifest.preparationSha256 !== sha256(raw) || !validSha(manifest.catalogSha256) ||
      !isRecord(diagnostics) || diagnostics.providerId !== provider ||
      !isRecord(preparation.totals) || !Array.isArray(preparation.products) ||
      diagnostics.totals?.products !== preparation.products.length ||
      diagnostics.totals?.ready !== preparation.totals.ready ||
      diagnostics.totals?.review !== preparation.totals.review) {
      throw new Error(`Preparación no acreditada: ${id}`);
    }
    const stamp = Date.parse(preparation.preparedAt);
    if (!Number.isFinite(stamp) || preparation.source.providerId !== provider ||
      manifest.catalogSha256 !== preparation.source.catalogSha256) {
      throw new Error(`Identidad de preparación inválida: ${id}`);
    }
    for (const name of members) await regularFile(join(folder, name));
    const group = [provider, preparation.source.scope, preparation.source.prefix, preparation.source.catalogSha256].join(":");
    sets.push({
      id, group, timestamp: stamp, sha: manifest.preparationSha256,
      source: preparation.source, preparationPath,
      paths: members.map((name) => join(folder, name))
    });
  }
  return sets;
};

const publicationSets = async (root, provider, prepared) => {
  const folder = join(root, "catalogs", "providers", provider, "publications");
  const entries = await list(folder);
  const activePath = join(folder, "active.json");
  const active = await readJson(activePath);
  if (!isRecord(active) || active.version !== 1 || active.providerId !== provider || !validSha(active.approvalSha256)) {
    throw new Error(`Índice de publicación vigente inválido: ${provider}`);
  }
  const times = new Map(prepared.map((set) => [set.sha, set.timestamp]));
  const indexPath = join(root, "storage", "providers", provider, "publication-retention.json");
  let historic = { publications: [] };
  try { historic = await readJson(indexPath); }
  catch (error) { if (!missing(error)) throw error; }
  if (!Array.isArray(historic.publications) ||
    (historic.version !== undefined && (historic.version !== 1 || historic.providerId !== provider)) ||
    historic.publications.some((item) => !isRecord(item) || !validSha(item.approvalSha256) ||
      !validSha(item.preparationSha256) || !Number.isFinite(Date.parse(item.preparedAt))) ||
    new Set(historic.publications.map((item) => item.approvalSha256)).size !== historic.publications.length) {
    throw new Error(`Índice de retención inválido: ${provider}`);
  }
  const result = [];
  const seenApprovals = new Set();
  for (const entry of entries) {
    if (entry.name === "active.json") continue;
    if (!entry.isDirectory() || entry.isSymbolicLink() || !isPublicationDirectoryName(entry.name)) {
      throw new Error(`Publicación sin clasificar: ${entry.name}`);
    }
    const directory = join(folder, entry.name);
    const files = (await list(directory)).map((child) => {
      if (!child.isFile() || child.isSymbolicLink()) throw new Error(`Miembro irregular: ${child.name}`);
      return child.name;
    }).sort();
    const manifest = await readJson(join(directory, "manifest.json"));
    if (!isRecord(manifest) || !isRecord(manifest.files)) {
      throw new Error(`Integridad de publicación no acreditada: ${directory}`);
    }
    const evidenceSha = manifest.files["technical-provenance.json"];
    const expected = ["accreditation.json", `${provider}-publishable.json`, "manifest.json",
      ...(evidenceSha === undefined ? [] : ["technical-provenance.json"])].sort();
    if (JSON.stringify(files) !== JSON.stringify(expected)) throw new Error(`Publicación incompleta: ${directory}`);
    const approvalBytes = await readFile(join(directory, "accreditation.json"));
    const productBytes = await readFile(join(directory, `${provider}-publishable.json`));
    const approval = sha256(approvalBytes);
    if (manifest.version !== 1 || manifest.providerId !== provider ||
      typeof manifest.runId !== "string" || !validSha(manifest.preparationSha256) ||
      manifest.approvalSha256 !== approval || !matchesPublicationApproval(entry.name, approval) ||
      manifest.files[`${provider}-publishable.json`] !== sha256(productBytes) ||
      manifest.files["accreditation.json"] !== approval ||
      (evidenceSha !== undefined && !validSha(evidenceSha))) {
      throw new Error(`Integridad de publicación no acreditada: ${directory}`);
    }
    if (evidenceSha !== undefined) {
      const evidenceBytes = await readFile(join(directory, "technical-provenance.json"));
      const evidence = JSON.parse(evidenceBytes);
      const products = JSON.parse(productBytes);
      if (sha256(evidenceBytes) !== evidenceSha || !isPublicationTechnicalProvenance(evidence) ||
        evidence.providerId !== provider || evidence.preparationSha256 !== manifest.preparationSha256 ||
        !Array.isArray(products) || evidence.products.length !== products.length ||
        evidence.products.some((item, index) =>
          item.reference !== products[index]?.reference || item.sourceUrl !== products[index]?.sourceUrl)) {
        throw new Error(`Procedencia técnica publicada inválida: ${directory}`);
      }
    }
    if (seenApprovals.has(approval) || result.some((item) =>
      entry.name.startsWith(basename(item.directory)) || basename(item.directory).startsWith(entry.name))) {
      throw new Error(`Alias de publicación ambiguo para ${approval}`);
    }
    seenApprovals.add(approval);
    const stored = historic.publications.find((item) => item.approvalSha256 === approval);
    if (stored && stored.preparationSha256 !== manifest.preparationSha256) {
      throw new Error(`Índice de retención referencia publicación modificada: ${provider}`);
    }
    const stamp = times.get(manifest.preparationSha256) ?? (stored ? Date.parse(stored.preparedAt) : NaN);
    result.push({
      directory, approval, runId: manifest.runId,
      timestamp: Number.isFinite(stamp) ? stamp : null, prepSha: manifest.preparationSha256
    });
  }
  if (!result.some((item) => item.approval === active.approvalSha256)) throw new Error(`Publicación activa ausente: ${provider}`);
  const retentionPath = join(root, "catalogs", "providers", provider, "publication-retention.json");
  let selection = null;
  try { selection = await readJson(retentionPath); }
  catch (error) { if (!missing(error)) throw error; }
  if (selection !== null && (!isRecord(selection) || selection.version !== 1 ||
    selection.providerId !== provider || selection.approvalSha256 !== active.approvalSha256 ||
    (selection.previousSha256 !== null && (!validSha(selection.previousSha256) ||
      selection.previousSha256 === selection.approvalSha256 ||
      !result.some((item) => item.approval === selection.previousSha256))) ||
    Object.keys(selection).length !== 4)) {
    throw new Error(`Índice de retención individual inválido: ${provider}`);
  }
  return { result, active: active.approvalSha256, selection };
};

const retainPublications = (publications, active, selection = null) => {
  if (selection !== null) {
    const keep = publications.filter((item) => item.approval === selection.approvalSha256 ||
      item.approval === selection.previousSha256);
    return { keep, protectedApprovals: new Set(keep.map((item) => item.approval)) };
  }
  const current = publications.find((item) => item.approval === active);
  if (!current) throw new Error(`Publicación activa ausente: ${active}`);
  const previous = publications.filter((item) => item.approval !== active &&
    item.timestamp !== null && current.timestamp !== null && item.timestamp <= current.timestamp)
    .sort((a, b) => b.timestamp - a.timestamp || b.approval.localeCompare(a.approval))[0];
  const keep = [current, ...(previous ? [previous] : [])];
  const protectedApprovals = new Set(keep.map((item) => item.approval));
  for (const item of publications) {
    if (item.timestamp === null || current.timestamp === null || item.timestamp > current.timestamp) {
      protectedApprovals.add(item.approval);
    }
  }
  return { keep, protectedApprovals };
};

const protectOperationalPreparations = async (root, provider, preparations, keptPreps) => {
  const originals = join(root, "storage", "scraped", provider);
  const available = new Map();
  for (const entry of await list(originals)) {
    if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith("-catalog.json")) continue;
    const path = join(originals, entry.name);
    await regularFile(path);
    available.set(entry.name.slice(0, -"-catalog.json".length), sha256(await readFile(path)));
  }
  const candidates = preparations.filter((item) => available.get(item.source.prefix) === item.source.catalogSha256 &&
    item.id.startsWith(`${item.source.prefix}-`))
    .sort((a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id));
  const protectedSources = new Set();
  for (const item of candidates) {
    if (protectedSources.has(item.source.prefix)) continue;
    try {
      await readOfflinePreparation(item.preparationPath, provider);
      keptPreps.add(item.sha);
      protectedSources.add(item.source.prefix);
    } catch {
      continue;
    }
  }
};

const planForProvider = async (root, provider, units) => {
  const preparations = await preparedSets(root, provider);
  if (provider === "manain" && (await list(join(root, "catalogs", "providers", provider, "publications"))).length === 0) {
    return { prepared: preparations.length, publications: 0, keptPrepared: preparations.length, keptPublications: 0 };
  }
  const groups = new Map();
  for (const prepared of preparations) groups.set(prepared.group, [...(groups.get(prepared.group) ?? []), prepared]);
  const keptPreps = new Set();
  for (const sets of groups.values()) {
    sets.sort((a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id));
    if (new Set(sets.map((item) => item.timestamp)).size !== sets.length) throw new Error(`Fechas ambiguas: ${provider}`);
    for (const set of sets.slice(0, 2)) keptPreps.add(set.sha);
  }
  if (preparations.length === 0) {
    const publicationsRoot = join(root, "catalogs", "providers", provider, "publications");
    if ((await list(publicationsRoot)).length === 0) return { prepared: 0, publications: 0, keptPrepared: 0, keptPublications: 0 };
    const inspected = await publicationSets(root, provider, preparations);
    const { protectedApprovals } = retainPublications(inspected.result, inspected.active, inspected.selection);
    for (const publication of inspected.result) {
      if (!protectedApprovals.has(publication.approval)) {
        addUnit(units, [publication.directory], `publicación anterior: ${provider}`);
      }
    }
    return {
      prepared: 0, publications: inspected.result.length, keptPrepared: 0,
      keptPublications: protectedApprovals.size
    };
  }
  const { result: publications, active, selection } = await publicationSets(root, provider, preparations);
  const { keep, protectedApprovals } = retainPublications(publications, active, selection);
  for (const publication of publications) {
    if (!protectedApprovals.has(publication.approval)) {
      addUnit(units, [publication.directory], `publicación anterior: ${provider}`);
    } else {
      keptPreps.add(publication.prepSha);
    }
  }
  await protectOperationalPreparations(root, provider, preparations, keptPreps);
  for (const prepared of preparations) {
    if (!keptPreps.has(prepared.sha)) addUnit(units, prepared.paths, `preparación anterior: ${provider}`);
  }
  const preparedTimes = new Map(preparations.map((item) => [item.sha, item.timestamp]));
  const editorialFolder = join(root, "storage", "providers", provider, "editorial");
  const editorial = [];
  for (const entry of await list(editorialFolder)) {
    if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith(".json")) {
      throw new Error(`Evidencia sin clasificar: ${join(editorialFolder, entry.name)}`);
    }
    const path = join(editorialFolder, entry.name);
    const data = await readJson(path);
    const preparedHash = Array.isArray(data?.sources) ? data.sources[0]?.preparationSha256 : undefined;
    if (typeof data?.runId !== "string" || !validSha(preparedHash)) {
      throw new Error(`Acreditación editorial irregular: ${path}`);
    }
    editorial.push({ path, runId: data.runId, sha: preparedHash, timestamp: preparedTimes.get(preparedHash) ?? -1 });
  }
  editorial.sort((a, b) => b.timestamp - a.timestamp || b.runId.localeCompare(a.runId));
  const keptEditorial = new Set(editorial.slice(0, 2).map((item) => item.path));
  for (const item of editorial) {
    if (keptPreps.has(item.sha)) keptEditorial.add(item.path);
  }
  for (const item of editorial) {
    if (!keptEditorial.has(item.path)) addUnit(units, [item.path], `acreditación editorial histórica: ${provider}`);
  }
  const receiptFolder = join(root, "storage", "providers", provider, "deliveries");
  for (const entry of await list(receiptFolder)) {
    if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith(".json")) {
      throw new Error(`Recibo sin clasificar: ${join(receiptFolder, entry.name)}`);
    }
    const path = join(receiptFolder, entry.name);
    const data = await readJson(path);
    if (!validSha(data?.approvalSha256)) throw new Error(`Recibo sin aprobación válida: ${path}`);
    if (!protectedApprovals.has(data.approvalSha256)) addUnit(units, [path], `recibo histórico: ${provider}`);
  }
  return {
    prepared: preparations.length, publications: publications.length,
    keptPrepared: keptPreps.size, keptPublications: protectedApprovals.size
  };
};

const additionalArtifacts = async (root, units) => {
  const runs = join(root, "storage", "runs");
  for (const entry of await list(runs)) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error(`Ejecución no clasificable: ${entry.name}`);
    const directory = join(runs, entry.name);
    const run = await readJson(join(directory, "run.json"));
    if (isRecord(run) && run.status === "failed" && run.runId === entry.name) {
      addUnit(units, [directory], "ejecución fallida histórica");
    }
  }
  for (const [provider, prefixes] of [["manain", ["prueba-manain-cdp", "prueba-manain"]],
  ["mercaeleva", ["scrape-mercaeleva"]]]) {
    const directory = join(root, "storage", "scraped", provider);
    for (const prefix of prefixes) {
      const summary = join(directory, `${prefix}-summary.json`);
      let data;
      try { data = await readJson(summary); }
      catch (error) { if (missing(error)) continue; throw error; }
      if (!isRecord(data) || data.quality?.status !== "blocked" || data.quality?.published !== false ||
        data.totals?.scrapedProducts !== 0) throw new Error(`Extracción de prueba no descartable: ${prefix}`);
      const files = (await list(directory)).filter((entry) => entry.isFile() &&
        entry.name.startsWith(`${prefix}-`) && /\.(json|csv)$/.test(entry.name));
      for (const entry of files) await regularFile(join(directory, entry.name));
      addUnit(units, files.map((entry) => join(directory, entry.name)).filter((path) => !units.has(path)), `extracción vacía: ${provider}`);
    }
  }
};

export const planConsolidation = async (root) => {
  const units = new Map();
  for (const provider of providers) await planForProvider(root, provider, units);
  await additionalArtifacts(root, units);
  const items = [...units].map(([path, reason]) => ({ path: relative(root, path).replaceAll(sep, "/"), reason }));
  if (items.some((item) => item.path.startsWith("../") || isAbsolute(item.path))) {
    throw new Error("Ruta fuera del repositorio");
  }
  return items.sort((a, b) => a.path.localeCompare(b.path));
};

const filesIn = async (path) => {
  const info = await lstat(path);
  if (info.isSymbolicLink()) throw new Error(`Enlace no permitido: ${path}`);
  if (info.isFile()) {
    if (info.nlink !== 1) throw new Error(`Archivo compartido: ${path}`);
    return [path];
  }
  if (!info.isDirectory()) throw new Error(`Artefacto no regular: ${path}`);
  const result = [];
  for (const entry of await readdir(path)) result.push(...await filesIn(join(path, entry)));
  return result;
};

const snapshot = async (root, items) => {
  const records = [];
  for (const item of items) {
    const full = join(root, item.path);
    const files = await filesIn(full);
    const contents = [];
    for (const file of files) {
      const info = await regularFile(file);
      contents.push({ path: relative(root, file).replaceAll(sep, "/"), size: info.size, sha256: sha256(await readFile(file)) });
    }
    records.push({ ...item, type: (await lstat(full)).isDirectory() ? "directory" : "file", files: contents.sort((a, b) => a.path.localeCompare(b.path)) });
  }
  return records;
};

const restoreTree = async (source, destination) => {
  const info = await lstat(source);
  let existing;
  try { existing = await lstat(destination); }
  catch (error) { if (!missing(error)) throw error; }
  if (info.isFile()) {
    if (existing) {
      if (!existing.isFile() || existing.isSymbolicLink() ||
        sha256(await readFile(source)) !== sha256(await readFile(destination))) {
        throw new Error(`Recuperación con conflicto: ${destination}`);
      }
      return;
    }
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination, constants.COPYFILE_EXCL);
    return;
  }
  await regularDirectory(source);
  if (existing && (!existing.isDirectory() || existing.isSymbolicLink())) {
    throw new Error(`Recuperación con directorio alterado: ${destination}`);
  }
  if (!existing) await mkdir(destination, { recursive: true });
  for (const name of await readdir(source)) await restoreTree(join(source, name), join(destination, name));
};

const compareSnapshot = async (root, records) => {
  for (const record of records) {
    for (const file of record.files) {
      const path = join(root, file.path);
      const info = await regularFile(path);
      if (info.size !== file.size || sha256(await readFile(path)) !== file.sha256) {
        throw new Error(`Huella diferente: ${file.path}`);
      }
    }
  }
};

const runStatus = (root) => {
  const result = spawnSync(process.execPath, [join(root, "scripts", "tooling.mjs"), "estado"],
    { cwd: root, encoding: "utf8", timeout: 120_000 });
  if (result.error || result.status !== 0) {
    throw new Error(`Estado operativo no comprobable: ${result.stderr || result.error?.message || result.status}`);
  }
  return result.stdout.trim();
};

const operationalStateChange = (before, after, items) => {
  const previous = before.split(/\r?\n/);
  const current = after.split(/\r?\n/);
  if (previous.length !== current.length) return `Número de líneas: antes ${previous.length}, después ${current.length}`;
  const removedPartial = new Set();
  if (items.some((item) => item.path === "storage/scraped/mercaeleva/scrape-mercaeleva-summary.json")) {
    removedPartial.add("MERCAELEVA");
  }
  if (items.some((item) => /^storage\/scraped\/manain\/prueba-manain(?:-cdp)?-summary\.json$/.test(item.path))) {
    removedPartial.add("MANAIN");
  }
  let provider = "";
  for (let index = 0; index < previous.length; index += 1) {
    const first = previous[index];
    const next = current[index];
    if (first === next) {
      if (/^ {0,2}(GAM|GOMARIZ|MERCAELEVA|MANAIN)$/.test(first)) provider = first.trim();
      continue;
    }
    if (/^PASS \|\s+PREPARACIÓN \| CORRECTO \| Preparación acreditada \(\d+ Ready \/ \d+ Review\)$/.test(first) &&
      /^PASS \|\s+PREPARACIÓN \| CORRECTO \| Preparación acreditada \(\d+ Ready \/ \d+ Review\)$/.test(next)) continue;
    if (removedPartial.has(provider) &&
      (first === "WARN |   ORIGINAL OPERATIVO | PARCIAL | Extracción parcial conservada; CSV coincide con el resumen" &&
        next === "    ORIGINAL OPERATIVO | AUSENTE | Sin extracción conservada" ||
        first === "WARN |   PREPARACIÓN | PARCIAL | Preparación heredada disponible; no acreditada como preparación offline" &&
        next === "    PREPARACIÓN | AUSENTE | Sin preparación conservada")) continue;
    return `Línea ${index + 1}: antes ${JSON.stringify(first)}; después ${JSON.stringify(next)}`;
  }
  return null;
};

const retentionIndexes = async (root) => {
  const indexes = [];
  for (const provider of providers) {
    const prepared = await preparedSets(root, provider);
    if (prepared.length === 0 || provider === "manain" &&
      (await list(join(root, "catalogs", "providers", provider, "publications"))).length === 0) continue;
    const { result: publications, active, selection } = await publicationSets(root, provider, prepared);
    const { keep } = retainPublications(publications, active, selection);
    if (keep[0].timestamp === null) continue;
    const path = join(root, "storage", "providers", provider, "publication-retention.json");
    let previous = null;
    try { await regularFile(path); previous = (await readFile(path)).toString("base64"); } catch (error) { if (!missing(error)) throw error; }
    const current = JSON.stringify({
      version: 1, providerId: provider,
      publications: keep.filter((item) => item.timestamp !== null).map((item) => ({
        approvalSha256: item.approval, preparationSha256: item.prepSha,
        preparedAt: new Date(item.timestamp).toISOString()
      }))
    }, null, 2);
    indexes.push({ path, previous, current });
  }
  return indexes;
};

const transactionName = ".equipzilla-consolidation";
const lockName = ".equipzilla-consolidation.lock";
const exists = async (path) => {
  try { return await lstat(path); } catch (error) { if (missing(error)) return null; throw error; }
};

const safeRelative = (path) => typeof path === "string" && path.length > 0 &&
  !isAbsolute(path) && !path.includes("\\") && !path.includes(":") &&
  path.split("/").every((part) => part && part !== "." && part !== "..");

const physicalPath = async (root, path) => {
  if (!safeRelative(path)) throw new Error(`Ruta de consolidación inválida: ${path}`);
  await regularDirectory(root);
  const parts = path.split("/");
  let current = root;
  for (const part of parts.slice(0, -1)) {
    current = join(current, part);
    if (await exists(current)) await regularDirectory(current);
  }
  return join(root, path);
};

const processAlive = (pid) => {
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === "ESRCH") return false; throw error; }
};

const withConsolidationLock = async (root, action) => {
  await regularDirectory(root);
  const folder = join(root, lockName);
  const token = `${process.pid}-${randomUUID()}`;
  const claim = join(folder, token);
  for (;;) {
    try { await mkdir(folder); } catch (error) { if (error.code !== "EEXIST") throw error; }
    await regularDirectory(folder).catch((error) => {
      throw new Error(`Bloqueo de consolidación no reconocido: ${folder}. Revisar el proceso anterior sin borrar datos`, { cause: error });
    });
    try { await writeFile(claim, "", { flag: "wx" }); break; }
    catch (error) { if (!missing(error)) throw error; }
  }
  try {
    for (const entry of await readdir(folder)) {
      if (entry === token) continue;
      const match = /^(\d+)-[a-f0-9-]{36}$/.exec(entry);
      if (!match || !Number.isSafeInteger(Number(match[1])) || Number(match[1]) <= 0) {
        throw new Error(`Bloqueo de consolidación no reconocido: ${entry}`);
      }
      const other = join(folder, entry);
      try { await regularFile(other); } catch (error) { if (missing(error)) continue; throw error; }
      if (processAlive(Number(match[1]))) throw new Error("Consolidación concurrente: otro proceso mantiene el bloqueo");
      await rm(other, { force: true });
    }
    return await action();
  } finally {
    await rm(claim, { force: true });
    try { await rmdir(folder); } catch (error) {
      if (!missing(error) && error.code !== "ENOTEMPTY" && error.code !== "EEXIST") throw error;
    }
  }
};

const atomicWrite = async (path, stage, content) => {
  await rm(stage, { force: true });
  const handle = await open(stage, "wx");
  try { await handle.writeFile(content); await handle.sync(); }
  finally { await handle.close(); }
  await rename(stage, path);
};

const indexValue = async (path) => {
  try { await regularFile(path); return (await readFile(path)).toString("base64"); }
  catch (error) { if (missing(error)) return null; throw error; }
};

const currentIndex = (entry) => Buffer.from(entry.current).toString("base64");
const indexPathFor = (root, entry) => physicalPath(root, entry.path);
const checkIndexes = async (root, indexes, allowCurrent = false) => {
  for (const entry of indexes) {
    const value = await indexValue(await indexPathFor(root, entry));
    if (value !== entry.previous && !(allowCurrent && value === currentIndex(entry))) {
      throw new Error(`Índice de retención modificado concurrentemente: ${entry.path}`);
    }
  }
};

const updateIndexes = async (root, transaction, indexes, restore = false) => {
  for (const entry of indexes) {
    const path = await indexPathFor(root, entry);
    const value = await indexValue(path);
    const expected = restore ? currentIndex(entry) : entry.previous;
    const desired = restore ? entry.previous : currentIndex(entry);
    if (value === desired) continue;
    if (value !== expected) throw new Error(`Índice de retención modificado concurrentemente: ${entry.path}`);
    if (desired === null) await rm(path);
    else {
      await mkdir(dirname(path), { recursive: true });
      await atomicWrite(path, join(transaction, "index.tmp"), Buffer.from(desired, "base64"));
    }
  }
};

const verifyRecord = async (root, record) => {
  await physicalPath(root, record.path);
  const [actual] = await snapshot(root, [{ path: record.path, reason: record.reason }]);
  if (actual.type !== record.type || JSON.stringify(actual.files) !== JSON.stringify(record.files)) {
    throw new Error(`Huella diferente o miembros alterados: ${record.path}`);
  }
};

const verifyRecords = async (root, records) => {
  for (const record of records) await verifyRecord(root, record);
};

const validateTransaction = (root, journal) => {
  if (!isRecord(journal) || journal.version !== 1 || journal.root !== root ||
    !["pending", "committed", "rolled-back"].includes(journal.state) || typeof journal.initialState !== "string" ||
    !Array.isArray(journal.records) || journal.records.length === 0 || !Array.isArray(journal.indexes)) {
    throw new Error("Diario de consolidación inválido");
  }
  const paths = new Set();
  for (const record of journal.records) {
    if (!isRecord(record) || !safeRelative(record.path) ||
      !/^(?:storage\/(?:prepared|providers|runs|scraped)\/|catalogs\/providers\/[^/]+\/publications\/)/.test(record.path) ||
      !["file", "directory"].includes(record.type) || typeof record.reason !== "string" ||
      !Array.isArray(record.files) || [...paths].some((path) => path === record.path ||
        path.startsWith(`${record.path}/`) || record.path.startsWith(`${path}/`))) {
      throw new Error("Ruta o conjunto inválido en diario de consolidación");
    }
    paths.add(record.path);
    if (record.files.some((file) => !isRecord(file) || !safeRelative(file.path) ||
      (record.type === "file" ? file.path !== record.path : !file.path.startsWith(`${record.path}/`)) ||
      !Number.isSafeInteger(file.size) || file.size < 0 || !validSha(file.sha256)) ||
      new Set(record.files.map((file) => file.path)).size !== record.files.length ||
      (record.type === "file" && record.files.length !== 1)) throw new Error("Huellas inválidas en diario de consolidación");
  }
  const indexPaths = new Set(providers.map((provider) => `storage/providers/${provider}/publication-retention.json`));
  for (const entry of journal.indexes) {
    if (!isRecord(entry) || !indexPaths.delete(entry.path) || typeof entry.current !== "string" ||
      (entry.previous !== null && (typeof entry.previous !== "string" ||
        Buffer.from(entry.previous, "base64").toString("base64") !== entry.previous))) {
      throw new Error("Índice inválido en diario de consolidación");
    }
  }
};

const writeJournal = (transaction, journal) => atomicWrite(join(transaction, "manifest.json"),
  join(transaction, "manifest.tmp"), JSON.stringify(journal));

const cleanTransaction = async (transaction, journal = null) => {
  const files = join(transaction, "files");
  if (await exists(files)) {
    await regularDirectory(files);
    const expected = new Map((journal?.records ?? []).flatMap((record) => record.files).map((file) => [file.path, file]));
    for (const path of await filesIn(files)) {
      const name = relative(files, path).replaceAll(sep, "/");
      const file = expected.get(name);
      if (journal?.state !== "committed" || !file || (await regularFile(path)).size !== file.size ||
        sha256(await readFile(path)) !== file.sha256) throw new Error(`Archivo transitorio no reconocido: ${name}`);
    }
    await rm(files, { recursive: true });
  }
  for (const name of ["index.tmp", "manifest.tmp", "manifest.json"]) {
    const path = join(transaction, name);
    if (await exists(path)) { await regularFile(path); await rm(path); }
  }
  await rmdir(transaction);
};

const rollback = async (root, transaction, journal) => {
  const staged = join(transaction, "files");
  await checkIndexes(root, journal.indexes, true);
  for (const record of journal.records) {
    const source = await physicalPath(root, record.path);
    const backup = await physicalPath(staged, record.path);
    const sourceExists = await exists(source);
    const backupExists = await exists(backup);
    if (Boolean(sourceExists) === Boolean(backupExists)) throw new Error(`Recuperación con conflicto: ${record.path}`);
    await verifyRecord(sourceExists ? root : staged, record);
  }
  for (const record of journal.records.slice().reverse()) {
    const source = await physicalPath(root, record.path);
    const backup = await physicalPath(staged, record.path);
    if (await exists(backup)) {
      if (await exists(source)) throw new Error(`Recuperación con conflicto: ${record.path}`);
      await mkdir(dirname(source), { recursive: true });
      await rename(backup, source);
    }
  }
  await updateIndexes(root, transaction, journal.indexes, true);
  await verifyRecords(root, journal.records);
  if (runStatus(root) !== journal.initialState) throw new Error("Estado operativo diferente tras recuperar la consolidación");
  await writeJournal(transaction, { ...journal, state: "rolled-back" });
  await cleanTransaction(transaction, journal);
};

const recoverTransaction = async (root, transaction) => {
  if (!(await exists(transaction))) return;
  await regularDirectory(transaction);
  const entries = await readdir(transaction);
  if (entries.some((name) => !["files", "manifest.json", "manifest.tmp", "index.tmp"].includes(name))) {
    throw new Error("Contenido no reconocido en transacción de consolidación");
  }
  if (!entries.includes("manifest.json")) {
    if (entries.includes("index.tmp") || (entries.includes("files") && (await list(join(transaction, "files"))).length)) {
      throw new Error("Transacción de consolidación sin diario: recuperación manual necesaria");
    }
    await cleanTransaction(transaction);
    return;
  }
  const journal = await readJson(join(transaction, "manifest.json"));
  validateTransaction(root, journal);
  if (journal.state === "pending") await rollback(root, transaction, journal);
  else await cleanTransaction(transaction, journal);
  return journal.state === "committed" ? journal.records : [];
};

const cleanEmptyParents = async (root, items) => {
  const candidates = new Set(items.map((item) => dirname(join(root, item.path))));
  for (const folder of [...candidates].sort((a, b) => b.length - a.length)) {
    if (folder === root) continue;
    try { await rmdir(folder); } catch (error) {
      if (!missing(error) && error.code !== "ENOTEMPTY" && error.code !== "EEXIST") throw error;
    }
  }
};

const consolidationResult = (records) => {
  const files = records.flatMap((record) => record.files);
  return { versions: records.length, files: files.length, bytes: files.reduce((sum, file) => sum + file.size, 0), destination: null };
};

const selectionSnapshot = async (root) => {
  const selections = [];
  for (const provider of providers) {
    for (const suffix of ["publications/active.json", "publication-retention.json"]) {
      const path = `catalogs/providers/${provider}/${suffix}`;
      selections.push({ path, value: await indexValue(await physicalPath(root, path)) });
    }
  }
  return selections;
};

export const consolidateLocalArtifacts = async (root) => {
  root = resolve(root);
  return withConsolidationLock(root, async () => {
    const transaction = join(root, transactionName);
    const recovered = await recoverTransaction(root, transaction) ?? [];
    const selections = await selectionSnapshot(root);
    const items = await planConsolidation(root);
    if (items.length === 0) return consolidationResult(recovered);
    for (const item of items) await physicalPath(root, item.path);
    const records = await snapshot(root, items);
    const indexes = (await retentionIndexes(root)).map((entry) => ({ ...entry, path: relative(root, entry.path).replaceAll(sep, "/") }));
    const initialState = runStatus(root);
    const journal = { version: 1, root, state: "pending", initialState, records, indexes };
    const verifySelections = async () => {
      if (JSON.stringify(await selectionSnapshot(root)) !== JSON.stringify(selections)) throw new Error("Selecciones de publicación modificadas concurrentemente");
    };
    validateTransaction(root, journal);
    if (JSON.stringify(await planConsolidation(root)) !== JSON.stringify(items)) throw new Error("Plan de consolidación modificado concurrentemente");
    await verifyRecords(root, records);
    await verifySelections();
    await checkIndexes(root, indexes);
    await mkdir(transaction);
    const staged = join(transaction, "files");
    await mkdir(staged);
    await writeJournal(transaction, journal);
    try {
      for (const record of records) {
        await verifyRecord(root, record);
        const source = await physicalPath(root, record.path);
        const backup = await physicalPath(staged, record.path);
        await mkdir(dirname(backup), { recursive: true });
        await rename(source, backup);
        await verifyRecord(staged, record);
      }
      await updateIndexes(root, transaction, indexes);
      const stateChange = operationalStateChange(initialState, runStatus(root), items);
      if (stateChange !== null) throw new Error(`El estado operativo cambió tras retirar los históricos: ${stateChange}`);
      await verifyRecords(staged, records);
      await verifySelections();
      for (const record of records) {
        if (await exists(await physicalPath(root, record.path))) throw new Error(`Histórico recreado concurrentemente: ${record.path}`);
      }
      for (const entry of indexes) {
        if (await indexValue(await indexPathFor(root, entry)) !== currentIndex(entry)) throw new Error(`Índice modificado: ${entry.path}`);
      }
      await cleanEmptyParents(root, items);
      await verifySelections();
      await writeJournal(transaction, { ...journal, state: "committed" });
    } catch (error) {
      try { await recoverTransaction(root, transaction); }
      catch (restoreError) { throw new Error(`Consolidación fallida, recuperación incompleta: ${restoreError.message}`, { cause: error }); }
      throw error;
    }
    try { await cleanTransaction(transaction, { ...journal, state: "committed" }); }
    catch (error) { throw new Error(`Retirada confirmada, eliminación definitiva pendiente: ${error.message}. Repetir --aplicar`, { cause: error }); }
    return consolidationResult([...recovered, ...records]);
  });
};

export const restoreLocalArtifacts = async (root, archive) => {
  root = resolve(root);
  archive = resolve(archive);
  return withConsolidationLock(root, async () => {
    if (await exists(join(root, transactionName))) throw new Error("Consolidación pendiente: resolver con --aplicar antes de restaurar archivos antiguos");
    const manifest = await readJson(join(archive, "manifest.json"));
    if (manifest.version !== 1 || manifest.originalRoot !== root || !Array.isArray(manifest.records)) {
      throw new Error("Archivo externo no corresponde a este repositorio");
    }
    for (const item of manifest.records) {
      if (!item || typeof item.path !== "string" ||
        resolve(root, item.path) === root || !resolve(root, item.path).startsWith(`${root}${sep}`)) {
        throw new Error("Ruta inválida en el manifiesto de recuperación");
      }
      for (const file of item.files ?? []) {
        if (typeof file.path !== "string" || !resolve(root, file.path).startsWith(`${root}${sep}`)) {
          throw new Error("Miembro inválido en el manifiesto de recuperación");
        }
      }
    }
    for (const item of manifest.records) {
      await physicalPath(root, item.path);
      await physicalPath(archive, item.path);
      for (const file of item.files) {
        await physicalPath(root, file.path);
        await physicalPath(archive, file.path);
      }
    }
    await compareSnapshot(archive, manifest.records);
    for (const item of manifest.records) await restoreTree(join(archive, item.path), join(root, item.path));
    await compareSnapshot(root, manifest.records);
    return manifest.records.length;
  });
};

const entryPoint = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (entryPoint) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const args = process.argv.slice(2);
  try {
    if (args[0] === "--restaurar" && args.length === 2) {
      const total = await restoreLocalArtifacts(root, args[1]);
      process.stdout.write(`RESTAURACIÓN | ${total} conjuntos recuperados\n`);
    } else if (args.length === 1 && args[0] === "--aplicar") {
      const result = await consolidateLocalArtifacts(root);
      process.stdout.write(`CONSOLIDACIÓN | ${result.versions} conjuntos | ${result.files} archivos | ${(result.bytes / 1048576).toFixed(2)} MiB eliminados definitivamente\n`);
    } else if (args.length === 1 && args[0] === "--simular") {
      if (await exists(join(root, transactionName))) throw new Error("Consolidación pendiente: resolver con --aplicar antes de simular");
      const items = await planConsolidation(root);
      for (const item of items) process.stdout.write(`${item.path} | ${item.reason}\n`);
      process.stdout.write(`CONSOLIDACIÓN | SIMULACIÓN | ${items.length} conjuntos elegibles | sin escrituras\n`);
    } else {
      throw new Error("Uso: node scripts/maintenance/consolidate-local-artifacts.mjs --simular | --aplicar | --restaurar ruta-de-archivo");
    }
  } catch (error) {
    console.error(`CONSOLIDACIÓN BLOQUEADA | ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

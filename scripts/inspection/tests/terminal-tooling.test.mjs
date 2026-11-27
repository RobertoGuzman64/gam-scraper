import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import test from "node:test";

const root = resolve(".");
const run = (...args) => spawnSync(process.execPath, ["scripts/tooling.mjs", ...args], {
  cwd: root,
  encoding: "utf8",
  timeout: 10000,
  env: { ...process.env, CI: "true", NO_COLOR: "1", TERM: "dumb", FORCE_COLOR: "0" }
});

test("ayuda CLI sin stdin ni TTY termina con cero y sin ANSI", () => {
  const result = run("ayuda", "acreditar:proveedor");
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /--detalle/);
  assert.equal(result.stdout.includes("\u001b"), false);
});

test("comando inválido devuelve error por stderr, código 1 y salida limpia", () => {
  const result = run("comando-inexistente");
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /FAIL \| Comando desconocido/);
  assert.equal(result.stderr.includes("\u001b"), false);
});

test("ayuda nativa del comando conserva UTF-8, stderr vacío y cierre", () => {
  const result = run("ayuda", "auditar:huecos");
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /calidad editorial de publicaciones acreditadas/);
  assert.equal(result.stdout.includes("\u001b"), false);
});

test("normalización se expone como diagnóstico independiente y no como paso de FINISH", () => {
  const result = run("ayuda", "auditar:normalizacion");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Diagnóstico de desarrollo bajo demanda/u);
  assert.match(result.stdout, /--top 20/u);
  assert.match(result.stdout, /--json/u);
  assert.equal(result.stderr, "");
  const finish = run("ayuda", "publicar");
  assert.equal(finish.status, 0, finish.stderr);
  assert.doesNotMatch(finish.stdout, /auditar:normalizacion|huecos/u);
});


test("la ayuda agrupa todos los comandos npm una sola vez y prioriza la operativa habitual", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const result = run("ayuda");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const entries = [...result.stdout.matchAll(/^  ([a-z][a-z0-9:-]*) {2,}\S/gm)].map((match) => match[1]);
  assert.deepEqual([...entries].sort(), Object.keys(pkg.scripts).sort());
  assert.deepEqual(entries.slice(0, 6), ["preparar", "publicar:simular", "publicar", "comercial:simular", "comercial", "estado"]);
  assert.match(result.stdout, /AUDITORÍA Y CALIDAD/u);
  assert.match(result.stdout, /ENTREGAS/u);
  for (const command of Object.keys(pkg.scripts)) {
    const help = run("ayuda", command);
    assert.equal(help.status, 0, command);
    assert.equal(help.stderr, "", command);
    assert.ok(help.stdout.includes(command === "test" ? "Uso: npm test" : `Uso: npm run ${command}`), command);
  }
});

test("la interfaz operativa usa los propietarios existentes y conserva el guard comercial", () => {
  const workspace = mkdtempSync(join(tmpdir(), "equipzilla comandos "));
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const commands = ["preparar", "preparar:manual", "publicar", "publicar:simular", "comercial", "comercial:simular", "entregar", "entregar:publicos", "entregar:informes"];
    for (const command of commands) assert.ok(Object.hasOwn(pkg.scripts, command), command);
    for (const old of ["catalogo:preparar", "catalogo:publicar", "exportar:comercial", "auditar:comercial", "contrato:comercial", "huecos", "normalizar:auditar"]) {
      assert.ok(!Object.hasOwn(pkg.scripts, old), old);
      assert.equal(run(old, "--help").status, 1, old);
    }
    writeFileSync(join(workspace, "package.json"), JSON.stringify({ type: "module", scripts: Object.fromEntries(commands.map((name) => [name, pkg.scripts[name]])) }));
    for (const path of ["scripts/tooling.mjs", "scripts/terminal.mjs", "scripts/build/build-cache.mjs"]) {
      mkdirSync(dirname(join(workspace, path)), { recursive: true });
      copyFileSync(join(root, path), join(workspace, path));
    }
    writeFileSync(join(workspace, "scripts/build/run-build.mjs"), "process.exitCode = 0;\n");
    const guard = join(workspace, "guards/tests-commercial-contract-guard.mjs");
    mkdirSync(dirname(guard), { recursive: true });
    writeFileSync(guard, 'console.log("GUARD");\n');
    for (const [entry, label] of [
      ["catalog/individual/prepare-individual", "PREPARAR"],
      ["catalog/prepare", "MANUAL"],
      ["catalog/individual/publish-individual", "FINISH"],
      ["catalog/commercial/commercial-export", "COMERCIAL"],
      ["campaign/campaign-deliver", "ENTREGA"]
    ]) {
      const file = join(workspace, "dist/cli/commands", `${entry}.js`);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, `console.log(${JSON.stringify(label)} + " " + JSON.stringify(process.argv.slice(2)));\n`);
    }
    const invoke = (command, ...args) => spawnSync(process.execPath, [join(workspace, "scripts/tooling.mjs"), command, ...args], {
      cwd: workspace, encoding: "utf8", timeout: 10000, windowsHide: true
    });
    for (const [command, args, label, forwarded] of [
      ["preparar", [], "PREPARAR", []],
      ["preparar:manual", ["gam", "--origen", "origen.json"], "MANUAL", ["gam", "--source", "origen.json"]],
      ["publicar", [], "FINISH", []],
      ["publicar:simular", [], "FINISH", ["--dry-run"]],
      ["publicar:simular", ["--proveedor", "manain"], "FINISH", ["--dry-run", "--proveedor", "manain"]],
      ["comercial", [], "COMERCIAL", ["--environment", "develop"]],
      ["comercial:simular", [], "COMERCIAL", ["--dry-run", "--environment", "develop"]],
      ["comercial:simular", ["--entorno", "production"], "COMERCIAL", ["--dry-run", "--environment", "production"]],
      ["comercial", ["--entorno", "production"], "COMERCIAL", ["--environment", "production"]],
      ["entregar", [], "ENTREGA", []],
      ["entregar:publicos", [], "ENTREGA", ["--publicos"]],
      ["entregar:informes", [], "ENTREGA", ["--informes", "--environment", "develop"]],
      ["entregar:informes", ["--entorno", "production"], "ENTREGA", ["--informes", "--environment", "production"]]
    ]) {
      const result = invoke(command, ...args);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), `${label === "COMERCIAL" ? "GUARD\n" : ""}${label} ${JSON.stringify(forwarded)}`);
    }
    writeFileSync(guard, "process.exitCode = 1;\n");
    for (const command of ["comercial", "comercial:simular"]) {
      const blocked = invoke(command);
      assert.equal(blocked.status, 1);
      assert.doesNotMatch(blocked.stdout, /COMERCIAL/);
      assert.match(blocked.stderr, /contrato comercial/);
    }
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

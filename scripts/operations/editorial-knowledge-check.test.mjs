import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

const copy = (root, relativePath) => {
  const destination = join(root, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(join(repositoryRoot, relativePath), destination);
};

const execute = (root, checkOnly = true) => spawnSync(process.execPath, [
  "scripts/operations/rebuild-editorial-knowledge.mjs", ...(checkOnly ? ["--check"] : [])
], {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env, NO_COLOR: "1" }
});

test("la comprobación verifica contenido e identidad sin imponer formato de JSON", () => {
  const root = mkdtempSync(join(tmpdir(), "equipzilla-knowledge-check-"));
  try {
    writeFileSync(join(root, "package.json"), '{"type":"module"}\n');
    copy(root, "scripts/operations/rebuild-editorial-knowledge.mjs");
    copy(root, "scripts/terminal.mjs");
    copy(root, "data/editorial/knowledge/verified-units.json");
    for (const provider of ["gam", "gomariz", "mercaeleva"]) {
      copy(root, `catalogs/providers/${provider}/original/scrape-${provider}-catalog.json`);
    }

    const indexPath = join(root, "data/editorial/knowledge/verified-units.json");
    const canonical = JSON.stringify(JSON.parse(readFileSync(indexPath, "utf8")), null, 2) + "\n";
    assert.equal(execute(root).status, 0);

    writeFileSync(indexPath, canonical.trimEnd());
    const withoutFinalNewline = readFileSync(indexPath);
    assert.equal(execute(root).status, 0);
    assert.ok(readFileSync(indexPath).equals(withoutFinalNewline), "--check modificó el índice sin salto final");

    const windowsContent = canonical.replace(/\n/gu, "\r\n");
    writeFileSync(indexPath, windowsContent);
    const before = readFileSync(indexPath);
    const windowsCheck = execute(root);
    assert.equal(windowsCheck.status, 0, windowsCheck.stderr);
    assert.ok(readFileSync(indexPath).equals(before), "--check modificó el índice con CRLF");

    const differentFormatting = JSON.stringify(JSON.parse(canonical), null, 4);
    writeFileSync(indexPath, differentFormatting);
    const beforeAlternative = readFileSync(indexPath);
    const alternativeCheck = execute(root);
    assert.equal(alternativeCheck.status, 0, alternativeCheck.stderr);
    assert.ok(readFileSync(indexPath).equals(beforeAlternative), "--check modificó el índice con formato alternativo");

    const canonicalUpdate = execute(root, false);
    assert.equal(canonicalUpdate.status, 0, canonicalUpdate.stderr);
    assert.ok(readFileSync(indexPath, "utf8") === canonical, "La actualización no generó el JSON canónico");

    const invalidJson = canonical.slice(0, -2);
    writeFileSync(indexPath, invalidJson);
    const invalidSyntax = execute(root);
    assert.notEqual(invalidSyntax.status, 0);
    assert.match(invalidSyntax.stderr, /SyntaxError/);

    const modified = JSON.parse(canonical);
    modified.entries[0].brand = "MARCA DIFERENTE";
    writeFileSync(indexPath, `${JSON.stringify(modified, null, 2)}\n`);
    const invalidIdentity = execute(root);
    assert.notEqual(invalidIdentity.status, 0);
    assert.match(invalidIdentity.stderr, /Conocimiento sin identidad o huella/);

    modified.entries[0].brand = JSON.parse(canonical).entries[0].brand;
    modified.entries[0].sourceDigest = "0".repeat(64);
    writeFileSync(indexPath, `${JSON.stringify(modified, null, 2)}\n`);
    const invalidDigest = execute(root);
    assert.notEqual(invalidDigest.status, 0);
    assert.match(invalidDigest.stderr, /Conocimiento sin identidad o huella/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

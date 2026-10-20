import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { waitForDebuggingPort } from "../browser.js";

const portFile = "9333\n/devtools/browser/abc123ef-1234-5678-910a-1234567890ab\n";

const withProfile = async (run: (profile: string) => Promise<void>): Promise<void> => {
  const profile = await mkdtemp(join(tmpdir(), "merca-browser-launch-"));
  try {
    await run(profile);
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
};

test("Mercaeleva: reconoce el puerto aunque el proceso inicial de Chrome haya terminado con código cero", async () => {
  await withProfile(async (profile) => {
    const published = new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        writeFile(join(profile, "DevToolsActivePort"), portFile).then(resolve, reject);
      }, 50);
    });
    const endpoint = await waitForDebuggingPort(profile, { exitCode: 0, signalCode: null }, 1000);
    await published;
    assert.equal(endpoint, "ws://127.0.0.1:9333/devtools/browser/abc123ef-1234-5678-910a-1234567890ab");
  });
});

test("Mercaeleva: comprueba el puerto existente antes de dar por terminado Chrome", async () => {
  await withProfile(async (profile) => {
    await writeFile(join(profile, "DevToolsActivePort"), portFile);
    assert.match(await waitForDebuggingPort(profile, { exitCode: 0, signalCode: null }, 100), /^ws:\/\/127\.0\.0\.1:9333\//);
  });
});

test("Mercaeleva: rechaza un Chrome que termina con error sin publicar el puerto", async () => {
  await withProfile(async (profile) => {
    await assert.rejects(waitForDebuggingPort(profile, { exitCode: 12, signalCode: null }, 500), /código 12/);
  });
});

test("Mercaeleva: el cierre normal sin puerto también finaliza con tiempo límite", async () => {
  await withProfile(async (profile) => {
    await assert.rejects(waitForDebuggingPort(profile, { exitCode: 0, signalCode: null }, 150), /sin publicar DevToolsActivePort/);
  });
});

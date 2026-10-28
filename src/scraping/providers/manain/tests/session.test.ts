import assert from "node:assert/strict";
import test from "node:test";
import { manainChromeArguments } from "../session.js";

test("Manain: Chrome visible usa un perfil aislado y depuración local sin modo headless", () => {
  const flags = manainChromeArguments("C:\\Temp\\manain chrome");
  assert.ok(flags.includes("--user-data-dir=C:\\Temp\\manain chrome"));
  assert.ok(flags.includes("--remote-debugging-address=127.0.0.1"));
  assert.ok(flags.includes("--remote-debugging-port=0"));
  assert.ok(flags.includes("https://manain.com/catalogo/venta/"));
  assert.ok(flags.every((flag) => !flag.includes("headless") && !flag.includes("disable-web-security")));
});

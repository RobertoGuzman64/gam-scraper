import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import { assertChromeWebSocketSupport, DevtoolsPipe, DevtoolsWebSocket } from "../devtools.js";

const pipeChannel = () => {
  const child = new EventEmitter() as ChildProcess;
  const input = new PassThrough();
  const output = new PassThrough();
  const messages: string[] = [];
  input.on("data", (chunk: Buffer) => messages.push(chunk.toString("utf8")));
  const events: string[] = [];
  const channel = new DevtoolsPipe(child, input, output, (event) => {
    if (event.method) events.push(event.method);
  });
  return { child, input, output, messages, events, channel };
};

class TestSocket extends EventTarget {
  readonly messages: string[] = [];

  send(message: string): void { this.messages.push(message); }

  receive(value: string): void {
    this.dispatchEvent(new MessageEvent("message", { data: value }));
  }
}

test("DevTools Pipe reconstruye frames parciales y conserva eventos y resultados", async () => {
  const { output, channel, messages, events } = pipeChannel();
  const pending = channel.send("Page.enable");
  assert.equal(messages.length, 1);
  output.write('{"method":"Page.loadEventFired"}\0{"id":1,"res');
  assert.deepEqual(events, ["Page.loadEventFired"]);
  output.write('ult":{"ok":true}}\0');
  assert.deepEqual(await pending, { ok: true });
});

test("DevTools Pipe rechaza pendientes y bloquea nuevos envíos ante JSON ilegible", async () => {
  const { output, channel, messages } = pipeChannel();
  const first = channel.send("Page.enable");
  const second = channel.send("Runtime.enable");
  output.write('{no-es-json}\0');
  await assert.rejects(first, /mensaje de depuración inválido/);
  await assert.rejects(second, /mensaje de depuración inválido/);
  await assert.rejects(channel.send("Page.navigate"), /mensaje de depuración inválido/);
  assert.equal(messages.length, 2);
});

test("DevTools Pipe rechaza respuestas de forma inválida y fallos del proceso", async () => {
  const malformed = pipeChannel();
  const promise = malformed.channel.send("Page.enable");
  malformed.output.write('{"id":"1","result":{}}\0');
  await assert.rejects(promise, /mensaje de depuración inválido/);
  const terminated = pipeChannel();
  const waiting = terminated.channel.send("Runtime.enable");
  terminated.child.emit("exit", 1);
  await assert.rejects(waiting, /Chrome finalizó/);
  await assert.rejects(terminated.channel.send("Page.enable"), /Chrome finalizó/);
});

test("DevTools WebSocket conserva respuestas válidas y rechaza frames corruptos", async () => {
  const socket = new TestSocket();
  const channel = new DevtoolsWebSocket(socket as unknown as WebSocket);
  const first = channel.send("Page.enable");
  socket.receive('{"id":1,"result":{"ok":true}}');
  assert.deepEqual(await first, { ok: true });
  const waiting = channel.send("Runtime.enable");
  socket.receive('[]');
  await assert.rejects(waiting, /mensaje de depuración inválido/);
  await assert.rejects(channel.send("Page.navigate"), /mensaje de depuración inválido/);
  assert.equal(socket.messages.length, 2);
});

test("La capacidad WebSocket global se exige solo al recorrido que la utiliza", () => {
  const current = Object.getOwnPropertyDescriptor(globalThis, "WebSocket");
  try {
    Object.defineProperty(globalThis, "WebSocket", { configurable: true, value: undefined });
    assert.throws(() => assertChromeWebSocketSupport(), /WebSocket global/);
  } finally {
    if (current) Object.defineProperty(globalThis, "WebSocket", current);
    else Reflect.deleteProperty(globalThis, "WebSocket");
  }
});

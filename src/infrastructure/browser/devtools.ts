import type { ChildProcess } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type DevtoolsResponse = {
  readonly method?: string;
  readonly params?: {
    readonly type?: string;
    readonly args?: readonly { readonly value?: unknown }[];
    readonly errorText?: string;
    readonly requestId?: string;
    readonly response?: { readonly status?: number };
  };
  readonly id?: number;
  readonly result?: Record<string, unknown>;
  readonly error?: { readonly message: string };
  readonly sessionId?: string;
};

export const withTimeout = async <T>(operation: Promise<T>, timeoutMs: number, detail: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Tiempo agotado (${timeoutMs} ms): ${detail}`)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

type Pending = {
  readonly resolve: (value: Record<string, unknown>) => void;
  readonly reject: (reason: Error) => void;
};

export class DevtoolsPipe {
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;
  private buffer = "";

  constructor(
    private readonly child: ChildProcess, private readonly input: Writable, output: Readable,
    private readonly onEvent?: (message: DevtoolsResponse) => void
  ) {
    output.setEncoding("utf8");
    output.on("data", (chunk: string) => {
      this.buffer += chunk;
      const frames = this.buffer.split("\0");
      this.buffer = frames.pop() ?? "";
      for (const frame of frames) {
        if (!frame) continue;
        const response: DevtoolsResponse = JSON.parse(frame);
        if (response.id === undefined) { this.onEvent?.(response); continue; }
        const pending = this.pending.get(response.id);
        if (!pending) continue;
        this.pending.delete(response.id);
        if (response.error) pending.reject(new Error(response.error.message));
        else pending.resolve(response.result ?? {});
      }
    });
    child.on("error", (error) => this.fail(error));
    child.on("exit", (code) => this.fail(new Error(`Chrome finalizó durante la navegación (código ${String(code)})`)));
  }

  private fail(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  send(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<Record<string, unknown>> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const message = { id, method, params, ...(sessionId ? { sessionId } : {}) };
      this.input.write(`${JSON.stringify(message)}\0`, (error?: Error | null) => {
        if (!error) return;
        this.pending.delete(id);
        reject(error);
      });
    });
  }
}

export class DevtoolsWebSocket {
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;

  constructor(private readonly socket: WebSocket, private readonly onEvent?: (message: DevtoolsResponse) => void) {
    socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      let response: DevtoolsResponse;
      try {
        response = JSON.parse(event.data);
      } catch {
        this.fail(new Error("Chrome devolvió un mensaje de depuración inválido"));
        return;
      }
      if (response.id === undefined) { this.onEvent?.(response); return; }
      const pending = this.pending.get(response.id);
      if (!pending) return;
      this.pending.delete(response.id);
      if (response.error) pending.reject(new Error(response.error.message));
      else pending.resolve(response.result ?? {});
    });
    socket.addEventListener("close", () => this.fail(new Error("Chrome cerró la conexión de depuración")));
    socket.addEventListener("error", () => this.fail(new Error("Error en la conexión de depuración de Chrome")));
  }

  private fail(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  send(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<Record<string, unknown>> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      } catch (error) {
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
}

export const waitForDebuggingPort = async (
  profile: string, child: Pick<ChildProcess, "exitCode" | "signalCode">, timeoutMs: number
): Promise<string> => {
  const path = join(profile, "DevToolsActivePort");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let content: string | null = null;
    try {
      content = await readFile(path, "utf8");
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error;
    }
    if (content !== null) {
      const [portText, browserPath] = content.trim().split(/\r?\n/);
      const port = Number(portText);
      if (!Number.isInteger(port) || port < 1 || port > 65535 || !browserPath ||
        !/^\/devtools\/browser\/[a-z0-9-]+$/i.test(browserPath)) {
        throw new Error("Chrome devolvió un endpoint de depuración inválido");
      }
      return `ws://127.0.0.1:${port}${browserPath}`;
    }
    if ((child.exitCode !== null && child.exitCode !== 0) || child.signalCode !== null) {
      throw new Error(`Chrome terminó sin abrir la depuración (código ${String(child.exitCode)}, señal ${String(child.signalCode)})`);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
  if (child.exitCode !== null || child.signalCode !== null) {
    throw new Error(`Chrome terminó sin publicar DevToolsActivePort (código ${String(child.exitCode)}, señal ${String(child.signalCode)})`);
  }
  throw new Error(`Chrome no publicó DevToolsActivePort tras ${timeoutMs} ms`);
};

export const openDebugSocket = async (url: string, timeoutMs: number): Promise<WebSocket> => {
  if (typeof WebSocket === "undefined") {
    throw new Error("La depuración de Chrome en Windows requiere Node.js 22 o posterior");
  }
  const socket = new WebSocket(url);
  try {
    await withTimeout(new Promise<void>((resolve, reject) => {
      const onOpen = (): void => { cleanup(); resolve(); };
      const onError = (): void => { cleanup(); reject(new Error("No se pudo conectar con el puerto de depuración de Chrome")); };
      const onClose = (): void => { cleanup(); reject(new Error("Chrome cerró el puerto de depuración antes de conectar")); };
      const cleanup = (): void => {
        socket.removeEventListener("open", onOpen);
        socket.removeEventListener("error", onError);
        socket.removeEventListener("close", onClose);
      };
      socket.addEventListener("open", onOpen);
      socket.addEventListener("error", onError);
      socket.addEventListener("close", onClose);
    }), timeoutMs, "conexión de Chrome con DevTools");
  } catch (error) {
    socket.close();
    throw error;
  }
  return socket;
};


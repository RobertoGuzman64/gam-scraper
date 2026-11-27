import { run } from "node:test";
import { parentPort } from "node:worker_threads";

if (!parentPort) throw new Error("El ejecutor necesita un canal con el runner");

const execute = async ({ file, laneName }) => {
  parentPort.postMessage({ type: "dispatch", file, laneName });
  for await (const event of run({ files: [file], concurrency: 1 })) {
    parentPort.postMessage({ type: "event", event, laneName });
  }
  parentPort.postMessage({ type: "complete", laneName });
};

parentPort.on("message", (message) => {
  if (message.type === "stop") parentPort.close();
  else if (message.type === "run") {
    void execute(message).catch((error) => parentPort.postMessage({ type: "failure", error }));
  }
});

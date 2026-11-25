import { run } from "node:test";
import { parentPort, workerData } from "node:worker_threads";

if (!parentPort) throw new Error("El ejecutor necesita un canal con el runner");

let nextFile = 0;
const execute = async () => {
  while (nextFile < workerData.files.length) {
    const file = workerData.files[nextFile];
    nextFile += 1;
    parentPort.postMessage({ type: "dispatch", file });
    for await (const event of run({ files: [file], concurrency: 1 })) {
      parentPort.postMessage({ type: "event", event });
    }
  }
};

const results = await Promise.allSettled(
  Array.from({ length: Math.min(workerData.concurrency, workerData.files.length) }, execute)
);
const failed = results.find((result) => result.status === "rejected");
if (failed) throw failed.reason;
parentPort.postMessage({ type: "complete" });

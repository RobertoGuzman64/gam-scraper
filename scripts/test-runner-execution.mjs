import { Worker } from "node:worker_threads";

const MAX_CONCURRENT_RUNS_PER_WORKER = 8;

const executeShard = (laneName, shard, consumeEvent) => new Promise((resolve, reject) => {
  const worker = new Worker(new URL("./test-runner-worker.mjs", import.meta.url), {
    workerData: shard,
    execArgv: []
  });
  let completed = false;
  let failure = null;
  worker.on("message", (message) => {
    if (failure) return;
    try {
      if (message.type === "event") consumeEvent(message.event, laneName);
      else if (message.type === "dispatch") consumeEvent({ type: "runner:dispatch", data: { file: message.file } }, laneName);
      else if (message.type === "complete") completed = true;
    } catch (error) {
      failure = error;
      void worker.terminate();
    }
  });
  worker.on("error", (error) => { failure ??= error; });
  worker.on("exit", (code) => {
    if (failure) reject(failure);
    else if (code !== 0 || !completed) reject(new Error(`La cola ${laneName} terminó sin completar su ejecución (código ${code})`));
    else resolve();
  });
});

const executeLane = async (lane, consumeEvent, finishLane) => {
  const concurrency = Math.min(lane.concurrency, lane.files.length);
  const shards = Array.from({ length: Math.ceil(concurrency / MAX_CONCURRENT_RUNS_PER_WORKER) }, (_, index) => ({
    files: [],
    concurrency: Math.min(MAX_CONCURRENT_RUNS_PER_WORKER, concurrency - index * MAX_CONCURRENT_RUNS_PER_WORKER)
  }));
  lane.files.forEach((file, index) => {
    shards[Math.floor((index % concurrency) / MAX_CONCURRENT_RUNS_PER_WORKER)].files.push(file);
  });
  try {
    const results = await Promise.allSettled(shards.map((shard) => executeShard(lane.name, shard, consumeEvent)));
    const failed = results.find((result) => result.status === "rejected");
    if (failed) throw failed.reason;
  } finally {
    finishLane(lane.name);
  }
};

export const executeTestLanes = async (lanes, consumeEvent, finishLane) => {
  const results = await Promise.allSettled(lanes.map((lane) => executeLane(lane, consumeEvent, finishLane)));
  const failed = results.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
};

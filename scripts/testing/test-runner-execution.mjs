import { Worker } from "node:worker_threads";

const MAX_CONCURRENT_RUNS_PER_WORKER = 8;

const executeShard = (concurrency, takeJob, consumeEvent, completeJob) => new Promise((resolve, reject) => {
  const worker = new Worker(new URL("./test-runner-worker.mjs", import.meta.url), { execArgv: [] });
  let active = 0;
  let closing = false;
  let failure = null;
  const dispatchNext = () => {
    const job = takeJob();
    if (job) {
      active += 1;
      worker.postMessage({ type: "run", ...job });
    } else if (active === 0 && !closing) {
      closing = true;
      worker.postMessage({ type: "stop" });
    }
  };
  worker.on("message", (message) => {
    if (failure) return;
    try {
      if (message.type === "event") consumeEvent(message.event, message.laneName);
      else if (message.type === "dispatch") consumeEvent({ type: "runner:dispatch", data: { file: message.file } }, message.laneName);
      else if (message.type === "complete") {
        active -= 1;
        completeJob(message.laneName);
        dispatchNext();
      } else if (message.type === "failure") throw message.error;
    } catch (error) {
      failure = error;
      void worker.terminate();
    }
  });
  worker.on("error", (error) => { failure ??= error; });
  worker.on("exit", (code) => {
    if (failure) reject(failure);
    else if (code !== 0 || !closing || active !== 0) reject(new Error(`El ejecutor terminó sin completar su ejecución (código ${code})`));
    else resolve();
  });
  for (let index = 0; index < concurrency && !closing; index += 1) dispatchNext();
});

export const createLaneScheduler = (lanes, finishLane) => {
  const states = new Map(lanes.map((lane) => [lane.name, {
    lane, next: 0, active: 0, remaining: lane.files.length, finished: false
  }]));
  const general = states.get("general");
  const intensive = states.get("intensiva");
  const globalLimit = lanes.reduce((sum, lane) => sum + lane.concurrency, 0);
  let active = 0;
  const hasPending = (state) => state && state.next < state.lane.files.length;
  const finish = (state) => {
    if (state.finished) return;
    state.finished = true;
    finishLane(state.lane.name);
  };
  const take = (state) => {
    if (!hasPending(state) || active >= globalLimit) return null;
    if (state === intensive) {
      const limit = hasPending(general) ? state.lane.concurrency : state.lane.maxConcurrency ?? state.lane.concurrency;
      if (state.active >= limit) return null;
    }
    const file = state.lane.files[state.next++];
    state.active += 1;
    active += 1;
    return { file, laneName: state.lane.name };
  };
  const takeJob = (name) => take(states.get(name)) ??
    (name === "intensiva" ? take(general) : name === "general" && !hasPending(general) ? take(intensive) : null);
  const completeJob = (name) => {
    const state = states.get(name);
    if (!state || state.active === 0) throw new Error(`Finalización inesperada de la cola ${name}`);
    state.active -= 1;
    active -= 1;
    state.remaining -= 1;
    if (state.remaining === 0) finish(state);
  };
  const finishEmpty = () => {
    for (const state of states.values()) if (state.remaining === 0) finish(state);
  };
  const finishAll = () => {
    for (const state of states.values()) finish(state);
  };
  const assertComplete = () => {
    if (active !== 0 || [...states.values()].some((state) => state.remaining !== 0)) {
      throw new Error("La ejecución terminó con archivos pendientes");
    }
  };
  return { takeJob, completeJob, finishEmpty, finishAll, assertComplete };
};

export const executeTestLanes = async (lanes, consumeEvent, finishLane) => {
  const scheduler = createLaneScheduler(lanes, finishLane);
  try {
    scheduler.finishEmpty();
    const executions = [];
    const totalFiles = lanes.reduce((sum, lane) => sum + lane.files.length, 0);
    for (const lane of lanes) {
      const concurrency = Math.min(lane.concurrency, totalFiles);
      for (let index = 0; index < concurrency; index += MAX_CONCURRENT_RUNS_PER_WORKER) {
        executions.push(executeShard(Math.min(MAX_CONCURRENT_RUNS_PER_WORKER, concurrency - index),
          () => scheduler.takeJob(lane.name), consumeEvent, scheduler.completeJob));
      }
    }
    const results = await Promise.allSettled(executions);
    const failed = results.find((result) => result.status === "rejected");
    if (failed) throw failed.reason;
    scheduler.assertComplete();
  } finally {
    scheduler.finishAll();
  }
};

import { resolve } from "node:path";

export const createRunnerTimeline = (files, cachedFiles, lanes, now) => {
  const known = new Set(files.map((file) => resolve(file)));
  const reused = new Set(cachedFiles.map((file) => resolve(file)));
  const started = new Map();
  const reported = new Map([...reused].map((file) => [file, 0]));
  const assigned = new Map(lanes.map((lane) => [lane.name, {
    name: lane.name,
    files: lane.files.length,
    concurrency: lane.concurrency,
    events: 0,
    started: 0,
    reported: 0,
    first_event_ms: null,
    last_event_ms: null,
    last_report_ms: null,
    global_summary_ms: null,
    finished_ms: null
  }]));
  const snapshots = [];
  let lastStartMs = null;
  let lastReportMs = null;

  const register = (event, laneName) => {
    const lane = assigned.get(laneName);
    if (!lane) throw new Error(`Cola de pruebas desconocida: ${laneName}`);
    const elapsed = now();
    lane.events += 1;
    lane.first_event_ms ??= elapsed;
    lane.last_event_ms = elapsed;
    const candidate = event.type === "test:dequeue" ? event.data?.name : null;
    if (typeof candidate === "string") {
      const name = resolve(candidate);
      if (known.has(name) && !reused.has(name) && !started.has(name)) {
        started.set(name, elapsed);
        lane.started += 1;
        lastStartMs = elapsed;
      }
    }
    const isFileSummary = event.type === "test:summary" && typeof event.data?.file === "string";
    const isFileFailure = event.type === "test:fail" && typeof event.data?.name === "string" &&
      event.data?.details?.type !== "test" && known.has(resolve(event.data.name));
    const reportName = isFileSummary ? event.data.file : isFileFailure ? event.data.name : null;
    if (reportName !== null) {
      const name = resolve(reportName);
      if (known.has(name) && !reported.has(name)) {
        reported.set(name, elapsed);
        lane.reported += 1;
        lane.last_report_ms = elapsed;
        lastReportMs = elapsed;
      }
    }
    if (event.type === "test:summary" && !event.data?.file) lane.global_summary_ms = elapsed;
  };

  const finishLane = (name) => {
    const lane = assigned.get(name);
    if (!lane) throw new Error(`Cola de pruebas desconocida: ${name}`);
    lane.finished_ms = now();
  };

  const progress = () => {
    const awaiting = [...started].filter(([file]) => !reported.has(file))
      .sort((left, right) => left[1] - right[1]);
    return {
      total: known.size,
      reused: reused.size,
      started: started.size,
      reported: reported.size,
      not_started: known.size - reused.size - started.size,
      without_report: awaiting.length,
      remaining: known.size - reported.size,
      oldest_without_report: awaiting.slice(0, 8).map(([file, start]) => ({
        file,
        elapsed_ms: Math.max(0, now() - start)
      }))
    };
  };

  const sample = (counts) => {
    const state = progress();
    snapshots.push({ elapsed_ms: now(), ...state, ...counts });
    return state;
  };

  const metrics = () => ({
    last_start_ms: lastStartMs,
    last_report_ms: lastReportMs,
    last_lane_finished_ms: Math.max(0, ...[...assigned.values()].map((lane) => lane.finished_ms ?? 0)),
    lanes: [...assigned.values()].map((lane) => ({ ...lane })),
    snapshots,
    final_progress: progress()
  });

  return { register, finishLane, progress, sample, metrics, started, reported };
};

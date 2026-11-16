const colors = { PASS: "\u001b[32m", WARN: "\u001b[33m", FAIL: "\u001b[31m", RUN: "\u001b[36m" };

export const supportsScriptColor = (stream = process.stdout, env = process.env) =>
  env.NO_COLOR === undefined && env.FORCE_COLOR !== "0" &&
  (env.FORCE_COLOR !== undefined ||
    stream.isTTY === true && env.CI !== "true" && env.TERM !== "dumb");

export const formatScriptStatus = (status, message, stream = process.stdout) => {
  const label = supportsScriptColor(stream) && colors[status]
    ? `${colors[status]}${status}\u001b[0m` : status;
  return `${label} | ${message}`;
};

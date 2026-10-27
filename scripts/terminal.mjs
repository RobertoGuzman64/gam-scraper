const colors = { PASS: "\u001b[32m", WARN: "\u001b[33m", FAIL: "\u001b[31m", RUN: "\u001b[36m" };

export const formatScriptStatus = (status, message, stream = process.stdout) => {
  const color = stream.isTTY === true && process.env.NO_COLOR === undefined &&
    process.env.CI !== "true" && process.env.TERM !== "dumb";
  const label = color ? `${colors[status]}${status}\u001b[0m` : status;
  return `${label} | ${message}`;
};

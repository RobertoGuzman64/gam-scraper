export const isTestRunAccreditable = (summaries, expectedFiles, stableInputs, completeReports) =>
  stableInputs && completeReports && summaries.length === expectedFiles &&
  summaries.every(({ success, counts }) => success === true &&
    Number.isSafeInteger(counts?.passed) && counts.passed > 0 &&
    counts.failed === 0 && counts.skipped === 0 && counts.todo === 0 && counts.cancelled === 0);

const runs = new Map();

function saveRun(runId, payload) {
  runs.set(runId, {
    ...payload,
    createdAt: Date.now(),
  });
}

function getRun(runId) {
  return runs.get(runId);
}

module.exports = {
  saveRun,
  getRun,
};

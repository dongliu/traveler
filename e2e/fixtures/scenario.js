const { beginScenario } = require('./artifact-registry');
const { finishScenario } = require('./cleanup');

function scenarioName(testInfo) {
  return testInfo.titlePath.join(' › ');
}

function useScenarioHooks(test) {
  test.beforeEach(({}, testInfo) => beginScenario(scenarioName(testInfo)));
  test.afterEach(async ({}, testInfo) =>
    finishScenario(scenarioName(testInfo))
  );
}

module.exports = { scenarioName, useScenarioHooks };

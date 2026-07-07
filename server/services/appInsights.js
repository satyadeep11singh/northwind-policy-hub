let client = null;

function init() {
  const connStr = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (!connStr) return;

  const appInsights = require('applicationinsights');
  appInsights
    .setup(connStr)
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setUseDiskRetryCaching(true)
    .start();

  client = appInsights.defaultClient;
}

function trackEvent(name, properties = {}) {
  if (!client) return;
  client.trackEvent({ name, properties });
}

function trackMetric(name, value) {
  if (!client) return;
  client.trackMetric({ name, value });
}

module.exports = { init, trackEvent, trackMetric };

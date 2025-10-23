"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createActivitiesImpl = createActivitiesImpl;
exports.createContest = createContest;
exports.processEntries = processEntries;
exports.determineWinners = determineWinners;
exports.initialize = initialize;
exports.cleanup = cleanup;
exports.checkHealth = checkHealth;
exports.collectMetrics = collectMetrics;
exports.handleCommand = handleCommand;
const activities_js_1 = require("./activities.js");
// Factory function to create activities implementation
function createActivitiesImpl(config, deps) {
    return new activities_js_1.ContestAgentActivitiesImpl(config, deps);
}
// Export individual activity functions for direct use
function createContest(config, deps) {
    const impl = createActivitiesImpl(config, deps);
    return impl.createContest.bind(impl);
}
function processEntries(config, deps) {
    const impl = createActivitiesImpl(config, deps);
    return impl.processEntries.bind(impl);
}
function determineWinners(config, deps) {
    const impl = createActivitiesImpl(config, deps);
    return impl.determineWinners.bind(impl);
}
function initialize(config, deps) {
    const impl = createActivitiesImpl(config, deps);
    return impl.initialize.bind(impl);
}
function cleanup(config, deps) {
    const impl = createActivitiesImpl(config, deps);
    return impl.cleanup.bind(impl);
}
function checkHealth(config, deps) {
    const impl = createActivitiesImpl(config, deps);
    return impl.checkHealth.bind(impl);
}
function collectMetrics(config, deps) {
    const impl = createActivitiesImpl(config, deps);
    return impl.collectMetrics.bind(impl);
}
function handleCommand(config, deps) {
    const impl = createActivitiesImpl(config, deps);
    return impl.handleCommand.bind(impl);
}

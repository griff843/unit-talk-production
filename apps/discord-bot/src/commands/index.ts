// Export all commands for dynamic loading
export * as ping from './ping';
export * as stats from './stats';
export * as upgrade from './upgrade';
export * as pick from './pick';
export * as portfolio from './portfolio';
export * as trends from './trends';
export * as recap from './recap';

// Commands with hyphens need special handling
import * as testOnboarding from './test-onboarding';
import * as debugTier from './debug-tier';
import * as capperOnboard from './capper-onboard';
import * as capperStats from './capper-stats';
import * as enhancedPick from './enhanced-pick';
import * as pickResult from './pick-result';
import * as topPlays from './top-plays';
import * as alertsSetup from './alerts-setup';
import * as askAi from './ask-ai';
import * as heatSignal from './heat-signal';
import * as edgeTracker from './edge-tracker';
import * as startTrialOnboarding from './start-trial-onboarding';
import * as simulateTier from './simulate-tier';

// Create an object with the command names as they appear in config
const commands = {
  'test-onboarding': testOnboarding,
  'debug-tier': debugTier,
  'capper-onboard': capperOnboard,
  'capper-stats': capperStats,
  'enhanced-pick': enhancedPick,
  'pick-result': pickResult,
  'top-plays': topPlays,
  'alerts-setup': alertsSetup,
  'ask-ai': askAi,
  'heat-signal': heatSignal,
  'edge-tracker': edgeTracker,
  'start-trial-onboarding': startTrialOnboarding,
  'simulate-tier': simulateTier,
};

// Export individual commands with hyphenated names
export default commands;
Object.entries(commands).forEach(([name, command]) => {
  (module.exports as any)[name] = command;
});

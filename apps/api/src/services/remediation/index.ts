/**
 * @fileoverview Remediation Service Exports
 *
 * Barrel exports for PR8: Auto-Remediation Playbooks
 *
 * @module services/remediation
 */

// Types
export * from './types';

// Core services
export {
  RemediationEngine,
  getRemediationEngine,
  createRemediationEngine,
} from './RemediationEngine';
export { PlaybookRegistry, getPlaybookRegistry, createPlaybookRegistry } from './PlaybookRegistry';
export { KnobResolver, getKnobResolver, createKnobResolver } from './KnobResolver';

// Playbooks
export * from './playbooks';

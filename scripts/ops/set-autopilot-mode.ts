#!/usr/bin/env npx tsx
/**
 * Set Autopilot Mode - CI Freeze State Management
 *
 * Sets the autopilot freeze state for CI automation.
 * Used by CI workflows to freeze agent operations during high-risk failures.
 *
 * Usage:
 *   npx tsx scripts/ops/set-autopilot-mode.ts --mode=SAFE --reason="CI failure" --scope=ALL
 *   npx tsx scripts/ops/set-autopilot-mode.ts --mode=NORMAL
 *   npx tsx scripts/ops/set-autopilot-mode.ts --status
 *
 * Modes:
 *   SAFE   - Freeze autopilot operations (agents skip risky operations)
 *   NORMAL - Unfreeze autopilot operations (normal operation)
 *
 * Scopes:
 *   ALL              - Freeze all autopilot operations
 *   DEPLOYMENTS      - Freeze deployment-related operations only
 *   AFFECTED_FLOW    - Freeze only the affected workflow/agent lane
 *   DATA_OPERATIONS  - Freeze data-modifying operations only
 *
 * Lane-Specific Freeze (use with --lane):
 *   ScoringAgent     - Freeze scoring operations
 *   SettlementAgent  - Freeze settlement operations
 *   GradingAgent     - Freeze grading operations
 *   PublishingAgent  - Freeze publishing operations
 *
 * @see docs/ops/AUTOPILOT_FREEZE_MATRIX.md
 * @see docs/ops/AUTO_RESOLUTION_POLICY.md
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Types
// =============================================================================

type FreezeScope = 'ALL' | 'DEPLOYMENTS' | 'AFFECTED_FLOW' | 'DATA_OPERATIONS';
type AgentLane = 'ScoringAgent' | 'SettlementAgent' | 'GradingAgent' | 'PublishingAgent';

interface AutopilotState {
  frozen: boolean;
  scope: FreezeScope | null;
  reason: string | null;
  triggered_at: string | null;
  triggered_by: string | null;
  auto_unfreeze_at: string | null;
  incident_id: string | null;
  frozen_lanes: AgentLane[];
  _comment: string;
}

interface CLIArgs {
  mode?: 'SAFE' | 'NORMAL';
  reason?: string;
  scope?: FreezeScope;
  lane?: AgentLane;
  incident?: string;
  autoUnfreezeHours?: number;
  triggeredBy?: string;
  status?: boolean;
  help?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const CONFIG_DIR = path.resolve(__dirname, '../../runtime_config');
const STATE_FILE = path.join(CONFIG_DIR, 'autopilot_state.json');

const DEFAULT_STATE: AutopilotState = {
  frozen: false,
  scope: null,
  reason: null,
  triggered_at: null,
  triggered_by: null,
  auto_unfreeze_at: null,
  incident_id: null,
  frozen_lanes: [],
  _comment: 'Managed by CI automation. See docs/ops/AUTOPILOT_FREEZE_MATRIX.md',
};

// =============================================================================
// Helper Functions
// =============================================================================

function parseArgs(): CLIArgs {
  const args: CLIArgs = {};

  for (const arg of process.argv.slice(2)) {
    if (arg === '--status') {
      args.status = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg.startsWith('--mode=')) {
      const mode = arg.split('=')[1].toUpperCase();
      if (mode === 'SAFE' || mode === 'NORMAL') {
        args.mode = mode;
      } else {
        console.error(`Invalid mode: ${mode}. Use SAFE or NORMAL.`);
        process.exit(1);
      }
    } else if (arg.startsWith('--reason=')) {
      args.reason = arg.split('=').slice(1).join('=');
    } else if (arg.startsWith('--scope=')) {
      const scope = arg.split('=')[1].toUpperCase() as FreezeScope;
      if (['ALL', 'DEPLOYMENTS', 'AFFECTED_FLOW', 'DATA_OPERATIONS'].includes(scope)) {
        args.scope = scope;
      } else {
        console.error(`Invalid scope: ${scope}`);
        process.exit(1);
      }
    } else if (arg.startsWith('--lane=')) {
      const lane = arg.split('=')[1] as AgentLane;
      if (['ScoringAgent', 'SettlementAgent', 'GradingAgent', 'PublishingAgent'].includes(lane)) {
        args.lane = lane;
      } else {
        console.error(`Invalid lane: ${lane}`);
        process.exit(1);
      }
    } else if (arg.startsWith('--incident=')) {
      args.incident = arg.split('=')[1];
    } else if (arg.startsWith('--auto-unfreeze-hours=')) {
      args.autoUnfreezeHours = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--triggered-by=')) {
      args.triggeredBy = arg.split('=')[1];
    }
  }

  return args;
}

function readState(): AutopilotState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, 'utf-8');
      return { ...DEFAULT_STATE, ...JSON.parse(content) };
    }
  } catch (error) {
    console.warn('Warning: Could not read existing state, using defaults');
  }
  return { ...DEFAULT_STATE };
}

function writeState(state: AutopilotState): void {
  // Ensure directory exists
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf-8');
}

function printStatus(state: AutopilotState): void {
  console.log('='.repeat(60));
  console.log('Autopilot Freeze State');
  console.log('='.repeat(60));
  console.log();
  console.log(`  Status:        ${state.frozen ? '🔴 FROZEN (SAFE MODE)' : '🟢 NORMAL'}`);
  console.log(`  Scope:         ${state.scope || 'N/A'}`);
  console.log(`  Reason:        ${state.reason || 'N/A'}`);
  console.log(`  Triggered At:  ${state.triggered_at || 'N/A'}`);
  console.log(`  Triggered By:  ${state.triggered_by || 'N/A'}`);
  console.log(`  Incident ID:   ${state.incident_id || 'N/A'}`);
  console.log(`  Auto Unfreeze: ${state.auto_unfreeze_at || 'N/A'}`);

  if (state.frozen_lanes && state.frozen_lanes.length > 0) {
    console.log(`  Frozen Lanes:  ${state.frozen_lanes.join(', ')}`);
  } else {
    console.log(`  Frozen Lanes:  None (or ALL if frozen)`);
  }

  console.log();
  console.log('-'.repeat(60));
  console.log(`State file: ${STATE_FILE}`);
  console.log();
}

function printHelp(): void {
  console.log(`
Set Autopilot Mode - CI Freeze State Management

USAGE:
  npx tsx scripts/ops/set-autopilot-mode.ts [OPTIONS]

OPTIONS:
  --mode=SAFE|NORMAL       Set autopilot mode (required unless --status)
  --reason="..."           Reason for the freeze (required for SAFE mode)
  --scope=SCOPE            Freeze scope (default: ALL)
                           Values: ALL, DEPLOYMENTS, AFFECTED_FLOW, DATA_OPERATIONS
  --lane=LANE              Freeze specific agent lane
                           Values: ScoringAgent, SettlementAgent, GradingAgent, PublishingAgent
  --incident=ID            Link to incident/issue ID
  --triggered-by=WHO       Who/what triggered the freeze (e.g., "ci-failure-resolver")
  --auto-unfreeze-hours=N  Auto-unfreeze after N hours
  --status                 Show current freeze state
  --help, -h               Show this help message

EXAMPLES:
  # Freeze all operations due to migration failure
  npx tsx scripts/ops/set-autopilot-mode.ts --mode=SAFE --reason="Migration CI failure" --scope=ALL

  # Freeze only ScoringAgent lane
  npx tsx scripts/ops/set-autopilot-mode.ts --mode=SAFE --reason="Scoring tests failed" --lane=ScoringAgent

  # Unfreeze (return to normal)
  npx tsx scripts/ops/set-autopilot-mode.ts --mode=NORMAL

  # Check current status
  npx tsx scripts/ops/set-autopilot-mode.ts --status

NOTES:
  - SAFE mode causes agents to skip risky operations
  - NORMAL mode restores normal agent operation
  - Always provide a reason when freezing
  - No secrets are logged by this script
  - See docs/ops/AUTOPILOT_FREEZE_MATRIX.md for freeze matrix details
`);
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const args = parseArgs();

  // Help
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Status check
  if (args.status) {
    const state = readState();
    printStatus(state);
    process.exit(0);
  }

  // Mode is required for non-status operations
  if (!args.mode) {
    console.error('Error: --mode is required. Use --mode=SAFE or --mode=NORMAL');
    console.error('Run with --help for usage information.');
    process.exit(1);
  }

  const currentState = readState();

  if (args.mode === 'SAFE') {
    // Freeze
    if (!args.reason) {
      console.error('Error: --reason is required when setting SAFE mode');
      process.exit(1);
    }

    const now = new Date().toISOString();
    let autoUnfreezeAt: string | null = null;

    if (args.autoUnfreezeHours) {
      const unfreezeDate = new Date(Date.now() + args.autoUnfreezeHours * 60 * 60 * 1000);
      autoUnfreezeAt = unfreezeDate.toISOString();
    }

    // Handle lane-specific freeze
    let frozenLanes = currentState.frozen_lanes || [];
    if (args.lane) {
      if (!frozenLanes.includes(args.lane)) {
        frozenLanes = [...frozenLanes, args.lane];
      }
    }

    const newState: AutopilotState = {
      frozen: true,
      scope: args.scope || 'ALL',
      reason: args.reason,
      triggered_at: now,
      triggered_by: args.triggeredBy || 'manual',
      auto_unfreeze_at: autoUnfreezeAt,
      incident_id: args.incident || null,
      frozen_lanes: frozenLanes,
      _comment: 'Managed by CI automation. See docs/ops/AUTOPILOT_FREEZE_MATRIX.md',
    };

    writeState(newState);

    console.log('='.repeat(60));
    console.log('AUTOPILOT FREEZE ACTIVATED');
    console.log('='.repeat(60));
    console.log();
    console.log(`  Mode:          SAFE`);
    console.log(`  Scope:         ${newState.scope}`);
    console.log(`  Reason:        ${newState.reason}`);
    console.log(`  Triggered At:  ${newState.triggered_at}`);
    console.log(`  Triggered By:  ${newState.triggered_by}`);
    if (newState.incident_id) {
      console.log(`  Incident ID:   ${newState.incident_id}`);
    }
    if (newState.auto_unfreeze_at) {
      console.log(`  Auto Unfreeze: ${newState.auto_unfreeze_at}`);
    }
    if (frozenLanes.length > 0) {
      console.log(`  Frozen Lanes:  ${frozenLanes.join(', ')}`);
    }
    console.log();
    console.log('Agents will skip risky operations until unfrozen.');
    console.log();
    console.log('To unfreeze: npx tsx scripts/ops/set-autopilot-mode.ts --mode=NORMAL');
    console.log();
  } else if (args.mode === 'NORMAL') {
    // Unfreeze
    const previousState = { ...currentState };

    const newState: AutopilotState = {
      ...DEFAULT_STATE,
      _comment: 'Managed by CI automation. See docs/ops/AUTOPILOT_FREEZE_MATRIX.md',
    };

    writeState(newState);

    console.log('='.repeat(60));
    console.log('AUTOPILOT UNFROZEN');
    console.log('='.repeat(60));
    console.log();
    console.log(`  Mode:           NORMAL`);
    console.log(`  Previous State: ${previousState.frozen ? 'FROZEN' : 'NORMAL'}`);
    if (previousState.reason) {
      console.log(`  Previous Reason: ${previousState.reason}`);
    }
    console.log();
    console.log('Agents will resume normal operation.');
    console.log();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});

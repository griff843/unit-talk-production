/**
 * Claude OS — LLM Routing Engine
 *
 * Implements Mode B (Prompt Orchestration) from the multi-LLM orchestration
 * blueprint: `docs/02_architecture/claude_os_multi_llm_orchestration_blueprint.md`
 *
 * Given a sprint planning context, the router:
 *   1. Classifies the sprint into work types
 *   2. Assigns the relevant execution lanes
 *   3. Routes each lane to the appropriate model
 *   4. Recommends a Claude Code instance count
 *   5. Generates structured prompts for external helper LLMs
 *   6. Produces a formatted operator-readable routing plan
 *
 * AUTHORITY: Claude Code remains the single final authority.
 * External LLMs are advisory only — no git ops, no proof generation,
 * no sprint-complete declarations.
 *
 * NEVER DELEGATED (regardless of routing decision):
 *   - Lane 2 (Audit/Truth) — always Claude Opus, always internal
 *   - Lane 3 (Verification) — always Claude Code, always internal
 *   - Lane 5 (Operations/Runtime) — always Claude Sonnet, always internal
 *   - git commit / tag / push — always Claude Code
 *   - docs/status/ writes — always Claude Code
 *   - sprint:close — always Claude Code
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { resolveRepoPath } from './fs-utils.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkClassification =
  | 'implementation'
  | 'architecture'
  | 'audit'
  | 'verification'
  | 'documentation'
  | 'runtime_operations'
  | 'design';

export type LaneId = 1 | 2 | 3 | 4 | 5 | 6;

export type InternalModel = 'claude_sonnet' | 'claude_opus' | 'claude_haiku';

export type ExternalModel = 'chatgpt_4o' | 'codex_gpt4_turbo' | 'gemini_advanced';

export type InstanceMode = 'SINGLE_INSTANCE' | 'TWO_INSTANCES' | 'THREE_INSTANCES';

export type OrchestrationMode = 'A' | 'B' | 'C';

export const LANE_NAMES: Record<LaneId, string> = {
  1: 'Implementation',
  2: 'Audit / Truth',
  3: 'Verification',
  4: 'Governance / Docs',
  5: 'Operations / Runtime',
  6: 'Design / Architecture',
};

export const MODEL_DISPLAY: Record<InternalModel | ExternalModel, string> = {
  claude_sonnet: 'Claude Sonnet',
  claude_opus: 'Claude Opus',
  claude_haiku: 'Claude Haiku',
  chatgpt_4o: 'ChatGPT-4o',
  codex_gpt4_turbo: 'Codex / GPT-4-turbo',
  gemini_advanced: 'Gemini Advanced',
};

export interface RoutingInput {
  sprintId: string;
  sprintType: string;
  summary: string;
  objective?: string;
  layer?: string; // e.g. "Layer 2"
  phase?: string; // e.g. "Phase 8 — Recovery & Replay"
  touchedAreas?: string[];
  orchestrationMode?: OrchestrationMode; // defaults to 'A'
}

export interface LaneAssignment {
  laneId: LaneId;
  laneName: string;
  purpose: string;
  preferredModel: InternalModel;
  executionMode: 'claude_code_internal' | 'external_advisory';
  externalModel?: ExternalModel;
  allowedOutputs: string[];
  neverDelegate: string[];
  canRunInParallel: boolean;
}

export interface ExternalPrompt {
  forLane: LaneId;
  laneName: string;
  agentModel: ExternalModel;
  purpose: string;
  promptTemplate: string;
}

export interface InstanceRecommendation {
  mode: InstanceMode;
  rationale: string;
  laneToInstance: Partial<Record<LaneId, number>>;
  mergeOrder: string[];
}

export interface RoutingPlan {
  sprintId: string;
  sprintType: string;
  summary: string;
  classifiedAs: WorkClassification[];
  lanesAssigned: LaneAssignment[];
  instanceRecommendation: InstanceRecommendation;
  externalPrompts: ExternalPrompt[];
  orchestrationMode: OrchestrationMode;
  generatedAt: string;
  classificationRationale: string;
}

export interface RoutingResult {
  success: boolean;
  plan?: RoutingPlan;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/** Keywords for each work classification (checked against lowercased input) */
const CLASSIFICATION_KEYWORDS: Record<WorkClassification, string[]> = {
  implementation: [
    'fix',
    'migrate',
    'migration',
    'activate',
    'activation',
    'implement',
    'build',
    'add',
    'create',
    'feature',
    'refactor',
    'expose',
    'wire',
    'endpoint',
    'api',
    'service',
    'agent',
    'worker',
    'handler',
  ],
  architecture: [
    'architecture',
    'redesign',
    'contract',
    'blueprint',
    'cross-system',
    'restructure',
    'multi-system',
    'orchestration',
    'consensus',
    'design system',
    'interface definition',
    'adr',
  ],
  audit: [
    'audit',
    'truth',
    'reconcile',
    'drift',
    'verify system',
    'status sync',
    'truth audit',
    'system audit',
    'status check',
    'health check',
    'review system',
  ],
  verification: [
    'gate',
    'verification',
    'test suite',
    'ci gate',
    'validate',
    'proof',
    'smoke test',
    'e2e',
    'integration test',
  ],
  documentation: [
    'docs',
    'document',
    'governance',
    'runbook',
    'playbook',
    'readme',
    'closeout',
    'status update',
    'sprint plan',
    'spec',
    'canonical doc',
  ],
  runtime_operations: [
    'monitor',
    'runtime',
    'operations',
    'ops',
    'incident',
    'alert',
    'slo',
    'health summary',
    'on-call',
    'dashboard',
    'observability',
    'reliability',
  ],
  design: [
    'design',
    'blueprint',
    'schema design',
    'data model',
    'interface design',
    'system design',
    'architecture blueprint',
    'operator model',
    'routing engine',
    'multi-llm',
    'orchestration design',
  ],
};

/** Sprint type → primary classification mapping */
const SPRINT_TYPE_PRIMARY: Record<string, WorkClassification> = {
  fix: 'implementation',
  migration: 'implementation',
  activation: 'implementation',
  feature: 'implementation',
  architecture: 'architecture',
  audit: 'audit',
  governance: 'documentation',
  docs: 'documentation',
  runtime: 'runtime_operations',
  build_fix: 'implementation',
  e2e_lifecycle: 'verification',
  ui: 'implementation',
  schema: 'implementation',
};

/**
 * Classify a sprint into one or more work types.
 * Primary classification comes from sprint type; secondary from keyword scan.
 */
export function classifyTask(input: RoutingInput): {
  classifications: WorkClassification[];
  rationale: string;
} {
  const text =
    `${input.sprintId} ${input.sprintType} ${input.summary} ${input.objective ?? ''} ${(input.touchedAreas ?? []).join(' ')}`.toLowerCase();

  const found = new Set<WorkClassification>();
  const rationale: string[] = [];

  // Primary classification from sprint type
  const primaryFromType = SPRINT_TYPE_PRIMARY[input.sprintType];
  if (primaryFromType) {
    found.add(primaryFromType);
    rationale.push(`sprint type '${input.sprintType}' → primary: ${primaryFromType}`);
  }

  // Secondary classification from keyword scan
  for (const [cls, keywords] of Object.entries(CLASSIFICATION_KEYWORDS) as [
    WorkClassification,
    string[],
  ][]) {
    const matched = keywords.filter(kw => text.includes(kw));
    if (matched.length > 0) {
      found.add(cls);
      rationale.push(`keywords [${matched.slice(0, 2).join(', ')}] → ${cls}`);
    }
  }

  // If nothing found, default to implementation
  if (found.size === 0) {
    found.add('implementation');
    rationale.push('no classification matched — defaulting to implementation');
  }

  // Layer 2 + Reliability/Monitoring keywords → runtime_operations
  if (input.layer?.includes('2') && text.includes('reliability')) {
    found.add('runtime_operations');
    rationale.push('Layer 2 reliability work → runtime_operations');
  }

  return {
    classifications: [...found],
    rationale: rationale.join('; '),
  };
}

// ---------------------------------------------------------------------------
// Lane Assignment
// ---------------------------------------------------------------------------

/** Map classification → which lanes are relevant */
const CLASSIFICATION_TO_LANES: Record<WorkClassification, LaneId[]> = {
  implementation: [1, 3], // Implementation + Verification (always paired)
  architecture: [6, 3], // Design/Architecture + Verification
  audit: [2], // Audit/Truth only (never delegated)
  verification: [3], // Verification only
  documentation: [4, 3], // Governance/Docs + light Verification
  runtime_operations: [5, 3], // Operations/Runtime + Verification
  design: [6, 4], // Design/Architecture + Governance/Docs
};

const LANE_DEFINITIONS: Record<
  LaneId,
  {
    purpose: string;
    preferredModel: InternalModel;
    allowedOutputs: string[];
    neverDelegate: string[];
    canUseExternal: boolean;
    externalModel?: ExternalModel;
    canRunInParallel: boolean;
  }
> = {
  1: {
    purpose: 'Write code, create migrations, fix tests, activate features',
    preferredModel: 'claude_sonnet',
    allowedOutputs: ['Code diffs', 'Migration files', 'Test updates', 'Config changes'],
    neverDelegate: ['Gate enforcement', 'git commit', 'Architecture decisions'],
    canUseExternal: true,
    externalModel: 'codex_gpt4_turbo',
    canRunInParallel: true,
  },
  2: {
    purpose: 'Read and reconcile system state; produce truth reports and status updates',
    preferredModel: 'claude_opus',
    allowedOutputs: ['Status docs', 'Drift reports', 'Truth reconciliation notes'],
    neverDelegate: ['Everything — truth reconciliation requires highest-fidelity judgment'],
    canUseExternal: false, // NEVER
    canRunInParallel: true, // Can read in parallel (no writes)
  },
  3: {
    purpose: 'Run test suites, CI gates, capture proof artifacts',
    preferredModel: 'claude_sonnet',
    allowedOutputs: ['proof_*.txt files', 'Gate outputs', 'Test run summaries'],
    neverDelegate: ['All gate execution — Claude Code must run shell commands directly'],
    canUseExternal: false, // NEVER
    canRunInParallel: false, // Must run after Implementation
  },
  4: {
    purpose: 'Sprint planning, closeout reports, governance doc updates, ADRs, blueprints',
    preferredModel: 'claude_sonnet',
    allowedOutputs: ['Sprint plans', 'Closeout reports', 'Canonical doc updates', 'ADRs'],
    neverDelegate: ['Governance contract edits', 'Sprint plans', 'Canonical doc writes'],
    canUseExternal: true,
    externalModel: 'chatgpt_4o',
    canRunInParallel: true, // Always safe to run in parallel with any lane
  },
  5: {
    purpose: 'Monitor production, debug incidents, execute runbooks, incident response',
    preferredModel: 'claude_sonnet',
    allowedOutputs: ['Runbook execution outputs', 'Incident reports', 'Health snapshots'],
    neverDelegate: ['All runtime operations — direct system access required'],
    canUseExternal: false, // NEVER
    canRunInParallel: true,
  },
  6: {
    purpose: 'Contract design, cross-service architecture decisions, new system blueprints',
    preferredModel: 'claude_opus',
    allowedOutputs: ['ADRs', 'Contract specs', 'Architecture blueprints', 'Interface definitions'],
    neverDelegate: ['Architecture decisions', 'ADR ratification'],
    canUseExternal: true,
    externalModel: 'gemini_advanced',
    canRunInParallel: true,
  },
};

/**
 * Assign execution lanes based on sprint classifications.
 * Returns deduplicated, ordered list of lane assignments.
 * Lane 3 (Verification) is always included if Lane 1 is present.
 */
export function assignLanes(
  classifications: WorkClassification[],
  orchestrationMode: OrchestrationMode = 'A'
): LaneAssignment[] {
  const laneIds = new Set<LaneId>();

  for (const cls of classifications) {
    for (const laneId of CLASSIFICATION_TO_LANES[cls] ?? []) {
      laneIds.add(laneId);
    }
  }

  // Lane 3 is always required when Lane 1 is present (verify all implementation)
  if (laneIds.has(1)) {
    laneIds.add(3);
  }

  // Build assignment objects
  const assignments: LaneAssignment[] = [];

  for (const laneId of [1, 2, 3, 4, 5, 6] as LaneId[]) {
    if (!laneIds.has(laneId)) continue;

    const def = LANE_DEFINITIONS[laneId];

    // External advisory only available in Mode B or C, and only for eligible lanes
    const useExternal = def.canUseExternal && orchestrationMode !== 'A' && !!def.externalModel;

    assignments.push({
      laneId,
      laneName: LANE_NAMES[laneId],
      purpose: def.purpose,
      preferredModel: def.preferredModel,
      executionMode: useExternal ? 'external_advisory' : 'claude_code_internal',
      externalModel: useExternal ? def.externalModel : undefined,
      allowedOutputs: def.allowedOutputs,
      neverDelegate: def.neverDelegate,
      canRunInParallel: def.canRunInParallel,
    });
  }

  return assignments;
}

// ---------------------------------------------------------------------------
// Model Routing
// ---------------------------------------------------------------------------

/**
 * Route model selection for each lane.
 * Returns a summary record suitable for display and logging.
 */
export function routeModels(assignments: LaneAssignment[]): Record<LaneId, string> {
  const routing: Partial<Record<LaneId, string>> = {};

  for (const lane of assignments) {
    const primary = MODEL_DISPLAY[lane.preferredModel];
    if (lane.executionMode === 'external_advisory' && lane.externalModel) {
      routing[lane.laneId] =
        `${primary} (primary) + ${MODEL_DISPLAY[lane.externalModel]} (advisory, Mode B/C)`;
    } else {
      routing[lane.laneId] = primary;
    }
  }

  return routing as Record<LaneId, string>;
}

// ---------------------------------------------------------------------------
// Instance Recommendation
// ---------------------------------------------------------------------------

/**
 * Recommend how many Claude Code instances should execute this sprint.
 *
 * Rules (from blueprint §11):
 *   - SINGLE_INSTANCE  : ≤2 lanes, or all sequential (Lane 3 must follow Lane 1)
 *   - TWO_INSTANCES    : Lane 1 + Lane 4 can run in parallel; or Lane 6 + Lane 1
 *   - THREE_INSTANCES  : Lane 1 + Lane 3 + Lane 4 all active, or pipeline N+N+1
 */
export function recommendInstances(
  assignments: LaneAssignment[],
  orchestrationMode: OrchestrationMode = 'A'
): InstanceRecommendation {
  const laneIds = new Set(assignments.map(a => a.laneId));

  // Parallelizable pairs (lanes that can run concurrently per blueprint)
  const parallelPairs: [LaneId, LaneId][] = [
    [1, 4], // Implementation + Governance/Docs
    [2, 4], // Audit/Truth + Governance/Docs
    [6, 4], // Design/Architecture + Governance/Docs
    [5, 4], // Operations/Runtime + Governance/Docs
    [6, 1], // Design + Implementation (non-overlapping files required)
  ];

  const hasParallelPair = parallelPairs.some(([a, b]) => laneIds.has(a) && laneIds.has(b));

  const hasThreeLanes = laneIds.size >= 3;
  const hasPipeline = laneIds.has(1) && laneIds.has(3) && laneIds.has(4);

  let mode: InstanceMode;
  let rationale: string;
  let laneToInstance: Partial<Record<LaneId, number>>;
  let mergeOrder: string[];

  if (orchestrationMode === 'A' || !hasParallelPair) {
    // Mode A: always single instance; or no parallel opportunity
    mode = 'SINGLE_INSTANCE';
    rationale =
      orchestrationMode === 'A'
        ? 'Orchestration Mode A — single-LLM execution; all lanes run sequentially in one Claude Code instance.'
        : 'No parallelizable lane pairs detected — sequential execution is equivalent to parallel.';
    laneToInstance = Object.fromEntries(assignments.map(a => [a.laneId, 1])) as Partial<
      Record<LaneId, number>
    >;
    mergeOrder = assignments.map(a => `Lane ${a.laneId} (${a.laneName})`);
  } else if (hasPipeline) {
    // Full pipeline: Lane 1 + Lane 3 + Lane 4
    mode = 'THREE_INSTANCES';
    rationale =
      'Lane 1 (Implementation) + Lane 3 (Verification) + Lane 4 (Governance/Docs) detected. ' +
      'Three instances enable: Instance 1 implements, Instance 3 verifies after Instance 1, ' +
      'Instance 2 handles docs concurrently. Verification pipeline overlaps with next sprint implementation.';
    laneToInstance = {
      1: 1,
      4: 2,
      3: 3,
    } as Partial<Record<LaneId, number>>;
    // Add remaining lanes to instance 1
    for (const a of assignments) {
      if (!laneToInstance[a.laneId]) {
        laneToInstance[a.laneId] = 1;
      }
    }
    mergeOrder = [
      'Instance 1 (Lane 1) → complete implementation',
      'Instance 3 (Lane 3) → run verification gates',
      'Instance 2 (Lane 4) → finish governance docs',
      'Claude Code (Authority) → assemble proof bundle, commit, tag',
    ];
  } else if (hasThreeLanes) {
    mode = 'THREE_INSTANCES';
    rationale =
      `${laneIds.size} active lanes with parallelism opportunities. ` +
      'Three instances distribute: Orchestrator (audit/design/docs), Executor (implementation), Verifier (gates).';
    laneToInstance = {} as Partial<Record<LaneId, number>>;
    for (const a of assignments) {
      if ([2, 4, 6].includes(a.laneId)) {
        laneToInstance[a.laneId] = 1; // Orchestrator handles knowledge lanes
      } else if (a.laneId === 1) {
        laneToInstance[a.laneId] = 2; // Executor handles implementation
      } else {
        laneToInstance[a.laneId] = 3; // Verifier handles gates
      }
    }
    mergeOrder = [
      'Instance 2 (Implementation) → complete, stable',
      'Instance 3 (Verification) → all gates pass',
      'Instance 1 (Orchestrator) → assemble proof, commit, tag, push',
    ];
  } else {
    // Simple parallel pair (e.g. Lane 1 + Lane 4)
    mode = 'TWO_INSTANCES';
    const instance1Lanes = assignments.filter(a => [2, 4, 6].includes(a.laneId));
    const instance2Lanes = assignments.filter(a => [1, 3, 5].includes(a.laneId));
    rationale =
      `Parallel lane pair detected (${instance1Lanes.map(a => `Lane ${a.laneId}`).join('+')} ‖ ` +
      `${instance2Lanes.map(a => `Lane ${a.laneId}`).join('+')}). ` +
      'Two instances allow documentation/design to proceed while implementation runs concurrently. ' +
      'Instance boundary aligns with lane boundary per blueprint §11.';
    laneToInstance = {} as Partial<Record<LaneId, number>>;
    for (const a of instance1Lanes) {
      laneToInstance[a.laneId] = 1;
    }
    for (const a of instance2Lanes) {
      laneToInstance[a.laneId] = 2;
    }
    mergeOrder = [
      'Instance 2 (Implementation/Executor) → complete implementation + gates',
      'Instance 1 (Orchestrator) → collect Instance 2 artifacts, finish docs, assemble proof bundle, commit',
    ];
  }

  return { mode, rationale, laneToInstance, mergeOrder };
}

// ---------------------------------------------------------------------------
// Prompt Generation
// ---------------------------------------------------------------------------

/** Template fragments for external LLM prompts */
const PROMPT_TEMPLATES: Record<ExternalModel, (context: PromptContext) => string> = {
  chatgpt_4o:
    ctx => `You are a technical documentation assistant supporting a governed software sprint.

CONTEXT
Sprint: ${ctx.sprintId}
Objective: ${ctx.objective}
Layer/Phase: ${ctx.layerPhase}

TASK
Draft the following governance document section: ${ctx.taskDescription}

SCOPE BOUNDARIES
- Do NOT modify governance contract files (CLAUDE_EXECUTION_CONTRACT.md, CLAUDE_OS_GOVERNANCE_CONTRACT.md)
- Do NOT write to docs/status/ — that is Claude Code's authority
- Do NOT make factual claims about system state you have not been given
- Write in the existing document style (markdown, concise, evidence-linked)

EXPECTED OUTPUT FORMAT
${ctx.outputFormat}

AUTHORITY NOTE
This output is a DRAFT. Claude Code (Claude OS) will review, validate against
governance contracts, and integrate or reject. Your output is not authoritative
until Claude Code validates it. Do not include completion or verification claims.`,

  codex_gpt4_turbo:
    ctx => `You are a code generation assistant supporting a governed software sprint.
Claude Code (Claude OS) will validate all output before integration.

CONTEXT
Sprint: ${ctx.sprintId}
Objective: ${ctx.objective}
Files in scope: ${ctx.filesInScope}

TASK
${ctx.taskDescription}

SCOPE BOUNDARIES
- Implement ONLY the specified scope. Do not refactor adjacent code.
- Do NOT write directly to unified_picks table — use lifecycle adapters:
  lifecycleInsert(), lifecycleUpdate(), atomicClaimForPost()
- TypeScript strict mode is enforced — no implicit any, no ts-ignore
- All exported functions must have explicit return types
- Follow the existing patterns in the codebase

EXPECTED OUTPUT FORMAT
${ctx.outputFormat}

AUTHORITY NOTE
This code is a DRAFT. Claude Code will run type-check, tests, and lifecycle gate
validation before integration. Do not claim the code is "production ready" or
"passes tests" — that determination belongs to Claude Code.`,

  gemini_advanced:
    ctx => `You are a research and analysis assistant supporting a software architecture sprint.
Your output will be reviewed by Claude Code (Claude OS) before any design decisions are made.

CONTEXT
Sprint: ${ctx.sprintId}
Objective: ${ctx.objective}
Layer/Phase: ${ctx.layerPhase}

RESEARCH TASK
${ctx.taskDescription}

SCOPE BOUNDARIES
- Provide research synthesis and options only — no implementation decisions
- Do NOT make architecture decisions — that authority belongs to Claude Opus / Claude Code
- Source your claims — indicate which are established practice vs. inference
- Focus on: ${ctx.focusAreas}

EXPECTED OUTPUT FORMAT
${ctx.outputFormat}

AUTHORITY NOTE
This is advisory research. Claude Code will review findings, select applicable
insights, and make all final architecture decisions. Research that contradicts
the Unit Talk governance model will be set aside.`,
};

interface PromptContext {
  sprintId: string;
  objective: string;
  layerPhase: string;
  taskDescription: string;
  outputFormat: string;
  filesInScope: string;
  focusAreas: string;
}

/**
 * Generate structured prompts for external LLM advisory lanes.
 * Only generates prompts for lanes with external models and Mode B/C orchestration.
 */
export function generatePrompts(
  input: RoutingInput,
  assignments: LaneAssignment[]
): ExternalPrompt[] {
  const prompts: ExternalPrompt[] = [];

  for (const lane of assignments) {
    if (lane.executionMode !== 'external_advisory' || !lane.externalModel) {
      continue;
    }

    const ctx: PromptContext = {
      sprintId: input.sprintId,
      objective: input.objective ?? input.summary,
      layerPhase: [input.layer, input.phase].filter(Boolean).join(' / ') || 'Not specified',
      filesInScope: (input.touchedAreas ?? []).join(', ') || 'See sprint plan',
      focusAreas: '',
      taskDescription: '',
      outputFormat: '',
    };

    // Customize per lane
    switch (lane.laneId) {
      case 4: // Governance/Docs — ChatGPT-4o
        ctx.taskDescription = `Draft a technical document section for the sprint closeout or governance doc update. Topic: ${input.summary}`;
        ctx.outputFormat = `Markdown sections only. No metadata headers. Use ## and ### heading levels. Concise — 200-400 words per section.`;
        break;

      case 1: // Implementation sub-task — Codex
        ctx.taskDescription = `Implement the following isolated module per the sprint spec: ${input.summary}. Scope: self-contained TypeScript module, no cross-service side effects.`;
        ctx.outputFormat = `Complete TypeScript source file(s) only. Include all imports. Add JSDoc for exported functions. No test files in this output (tests are a separate sub-task).`;
        break;

      case 6: // Design/Architecture research — Gemini
        ctx.taskDescription = `Research and synthesize options for: ${input.summary}`;
        ctx.focusAreas = `Implementation patterns, trade-offs, prior art, known failure modes`;
        ctx.outputFormat = `Option matrix with columns: Approach | Pros | Cons | Unit Talk compatibility. Add a 2-3 sentence recommendation that Claude Opus will evaluate.`;
        break;

      default:
        ctx.taskDescription = input.summary;
        ctx.outputFormat = 'Markdown format. Be concise.';
    }

    const templateFn = PROMPT_TEMPLATES[lane.externalModel];
    if (!templateFn) continue;

    prompts.push({
      forLane: lane.laneId,
      laneName: lane.laneName,
      agentModel: lane.externalModel,
      purpose: lane.purpose,
      promptTemplate: templateFn(ctx),
    });
  }

  return prompts;
}

// ---------------------------------------------------------------------------
// Routing Plan Assembly
// ---------------------------------------------------------------------------

/**
 * Assemble a complete routing plan from a routing input.
 * This is the primary entry point for the routing engine.
 */
export function buildRoutingPlan(input: RoutingInput): RoutingResult {
  try {
    const mode = input.orchestrationMode ?? 'A';

    const { classifications, rationale } = classifyTask(input);
    const lanes = assignLanes(classifications, mode);
    const instances = recommendInstances(lanes, mode);
    const prompts = generatePrompts(input, lanes);

    const plan: RoutingPlan = {
      sprintId: input.sprintId,
      sprintType: input.sprintType,
      summary: input.summary,
      classifiedAs: classifications,
      lanesAssigned: lanes,
      instanceRecommendation: instances,
      externalPrompts: prompts,
      orchestrationMode: mode,
      generatedAt: new Date().toISOString(),
      classificationRationale: rationale,
    };

    return { success: true, plan, errors: [] };
  } catch (err) {
    return {
      success: false,
      errors: [(err as Error).message],
    };
  }
}

// ---------------------------------------------------------------------------
// Operator Output Formatting
// ---------------------------------------------------------------------------

/**
 * Format the routing plan into a human-readable operator summary.
 * This is emitted by /sprint-plan in the routing section.
 */
export function formatRoutingPlan(plan: RoutingPlan): string {
  const lines: string[] = [];
  const hr = '─'.repeat(60);

  lines.push('');
  lines.push('## LLM Routing Plan');
  lines.push(hr);
  lines.push('');
  lines.push(`Sprint:            ${plan.sprintId}`);
  lines.push(`Work type(s):      ${plan.classifiedAs.join(', ')}`);
  lines.push(`Orchestration:     Mode ${plan.orchestrationMode}`);
  lines.push(`Instance mode:     ${plan.instanceRecommendation.mode}`);
  lines.push('');
  lines.push('### Lane Assignments');
  lines.push('');

  for (const lane of plan.lanesAssigned) {
    const model = MODEL_DISPLAY[lane.preferredModel];
    const external = lane.externalModel ? ` + ${MODEL_DISPLAY[lane.externalModel]} (advisory)` : '';
    const execMode =
      lane.executionMode === 'external_advisory' ? '⬡ External advisory' : '● Claude Code internal';

    lines.push(`Lane ${lane.laneId} — ${lane.laneName}`);
    lines.push(`  Model:    ${model}${external}`);
    lines.push(`  Mode:     ${execMode}`);
    lines.push(`  Purpose:  ${lane.purpose}`);
    if (lane.neverDelegate.length > 0) {
      lines.push(`  Locked:   ${lane.neverDelegate[0]}`);
    }
    lines.push('');
  }

  lines.push('### Instance Recommendation');
  lines.push('');
  lines.push(`Recommended: ${plan.instanceRecommendation.mode}`);
  lines.push(`Rationale:   ${plan.instanceRecommendation.rationale}`);
  lines.push('');

  if (Object.keys(plan.instanceRecommendation.laneToInstance).length > 0) {
    lines.push('Lane → Instance mapping:');
    for (const [laneId, instanceNum] of Object.entries(
      plan.instanceRecommendation.laneToInstance
    )) {
      const name = LANE_NAMES[Number(laneId) as LaneId] ?? 'Unknown';
      lines.push(`  Lane ${laneId} (${name}) → Instance ${instanceNum}`);
    }
    lines.push('');
    lines.push('Merge order:');
    for (const step of plan.instanceRecommendation.mergeOrder) {
      lines.push(`  ${step}`);
    }
  }

  if (plan.externalPrompts.length > 0) {
    lines.push('');
    lines.push('### External LLM Prompts (Mode B/C Advisory)');
    lines.push('');
    lines.push(`${plan.externalPrompts.length} prompt(s) generated for operator dispatch:`);
    lines.push('');
    for (const prompt of plan.externalPrompts) {
      lines.push(
        `  Lane ${prompt.forLane} (${prompt.laneName}) → ${MODEL_DISPLAY[prompt.agentModel]}`
      );
      lines.push(`  Purpose: ${prompt.purpose}`);
      lines.push(`  → Prompt available in LLM_ROUTING_DECISION.md`);
      lines.push('');
    }
    lines.push('Note: These prompts require operator dispatch. Claude Code remains');
    lines.push('      final authority — outputs are DRAFTS until Claude Code validates.');
  } else {
    lines.push('');
    lines.push('### External LLM Prompts');
    lines.push('');
    lines.push('Mode A — no external prompts generated. All lanes run internally in Claude Code.');
  }

  lines.push('');
  lines.push(hr);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Evidence Logging
// ---------------------------------------------------------------------------

/**
 * Write the routing decision to LLM_ROUTING_DECISION.md in the given output directory.
 * Returns the path written.
 */
export function writeRoutingDecision(plan: RoutingPlan, outputDir: string): string {
  const outPath = path.join(outputDir, 'LLM_ROUTING_DECISION.md');

  const lines: string[] = [
    `# LLM Routing Decision — ${plan.sprintId}`,
    '',
    `**Generated**: ${plan.generatedAt}`,
    `**Sprint**: ${plan.sprintId}`,
    `**Sprint Type**: ${plan.sprintType}`,
    `**Orchestration Mode**: ${plan.orchestrationMode}`,
    '',
    '---',
    '',
    '## 1. Classification Result',
    '',
    `**Classifications**: ${plan.classifiedAs.join(', ')}`,
    '',
    `**Rationale**: ${plan.classificationRationale}`,
    '',
    '---',
    '',
    '## 2. Lanes Selected',
    '',
    '| Lane | Name | Preferred Model | Execution Mode | External? |',
    '|------|------|----------------|----------------|-----------|',
  ];

  for (const lane of plan.lanesAssigned) {
    const ext = lane.externalModel ? MODEL_DISPLAY[lane.externalModel] : 'None';
    const execMode =
      lane.executionMode === 'external_advisory' ? 'External advisory' : 'Claude Code internal';
    lines.push(
      `| ${lane.laneId} | ${lane.laneName} | ${MODEL_DISPLAY[lane.preferredModel]} | ${execMode} | ${ext} |`
    );
  }

  lines.push('', '---', '', '## 3. Model Routing Summary', '');

  for (const lane of plan.lanesAssigned) {
    const model = MODEL_DISPLAY[lane.preferredModel];
    const ext = lane.externalModel ? ` + ${MODEL_DISPLAY[lane.externalModel]} (advisory)` : '';
    lines.push(`- **Lane ${lane.laneId} (${lane.laneName})**: ${model}${ext}`);
  }

  lines.push(
    '',
    '---',
    '',
    '## 4. Instance Recommendation',
    '',
    `**Mode**: ${plan.instanceRecommendation.mode}`,
    '',
    `**Rationale**: ${plan.instanceRecommendation.rationale}`,
    '',
    '**Lane → Instance Mapping**:',
    ''
  );

  for (const [laneId, instanceNum] of Object.entries(plan.instanceRecommendation.laneToInstance)) {
    const name = LANE_NAMES[Number(laneId) as LaneId] ?? 'Unknown';
    lines.push(`- Lane ${laneId} (${name}) → Instance ${instanceNum}`);
  }

  lines.push('', '**Merge Order**:', '');
  for (const step of plan.instanceRecommendation.mergeOrder) {
    lines.push(`1. ${step}`);
  }

  lines.push('', '---', '', '## 5. Generated Prompts', '');

  if (plan.externalPrompts.length === 0) {
    lines.push('*Mode A — no external prompts generated.*');
  } else {
    for (const prompt of plan.externalPrompts) {
      lines.push(
        `### Lane ${prompt.forLane} — ${prompt.laneName} → ${MODEL_DISPLAY[prompt.agentModel]}`,
        '',
        `**Purpose**: ${prompt.purpose}`,
        '',
        '```',
        prompt.promptTemplate,
        '```',
        ''
      );
    }
  }

  lines.push(
    '---',
    '',
    '## 6. Governance Constraints (Non-Negotiable)',
    '',
    '- Claude Code retains final authority over all git operations (commit, tag, push)',
    '- Claude Code retains final authority over all proof bundle generation and gate enforcement',
    '- Claude Code retains final authority over all status document updates (docs/status/)',
    '- External LLM outputs are DRAFTS until Claude Code validates them',
    '- Lane 2 (Audit/Truth) is always Claude Opus — never delegated',
    '- Lane 3 (Verification) always runs in Claude Code — never delegated',
    '- Lane 5 (Operations/Runtime) always runs in Claude Code — never delegated',
    '',
    '---',
    '',
    `*Authority: docs/02_architecture/claude_os_multi_llm_orchestration_blueprint.md*`
  );

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
  return outPath;
}

// ---------------------------------------------------------------------------
// CLI Helper (for integration with tools/claude-os/src/cli.ts)
// ---------------------------------------------------------------------------

/** Run the router from CLI args and print output to console */
export function runRouterCli(args: string[]): void {
  // Parse args: --sprint, --type, --summary, --objective, --layer, --phase,
  //             --touched-areas, --orchestration-mode, --output-dir
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const sprintId = get('--sprint') ?? '';
  const sprintType = get('--type') ?? 'feature';
  const summary = get('--summary') ?? '';
  const objective = get('--objective');
  const layer = get('--layer');
  const phase = get('--phase');
  const touchedAreasRaw = get('--touched-areas');
  const touchedAreas = touchedAreasRaw ? touchedAreasRaw.split(',').map(s => s.trim()) : [];
  const orchestrationMode = (get('--orchestration-mode') as OrchestrationMode | undefined) ?? 'A';
  const outputDir =
    get('--output-dir') ??
    resolveRepoPath(`out/sprints/${sprintId}/${new Date().toISOString().slice(0, 10)}`);

  if (!sprintId || !summary) {
    console.error(
      'Usage: cli.ts route --sprint <id> --summary "<text>" [--type <type>] [--layer <L>] [--phase <P>] [--orchestration-mode A|B|C] [--output-dir <path>]'
    );
    process.exit(1);
  }

  const input: RoutingInput = {
    sprintId,
    sprintType,
    summary,
    objective,
    layer,
    phase,
    touchedAreas,
    orchestrationMode,
  };

  const result = buildRoutingPlan(input);

  if (!result.success || !result.plan) {
    console.error('Routing failed:', result.errors.join(', '));
    process.exit(1);
  }

  // Print formatted plan to stdout
  console.log(formatRoutingPlan(result.plan));

  // Write decision artifact
  const writtenPath = writeRoutingDecision(result.plan, outputDir);
  console.log(`\nRouting decision logged: ${writtenPath}`);
}

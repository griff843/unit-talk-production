/**
 * Claude OS — Prompt Pack Generator
 *
 * Implements PROMPT_STANDARDIZATION_SPEC.md requirements.
 *
 * Generates governed, role-specific prompt files for the active sprint.
 * Each file follows the 9-section PROMPT_STANDARDIZATION_SPEC.md structure:
 *   1. Role  2. Objective  3. Scope  4. Authority Surfaces
 *   5. Constraints  6. Required Outputs  7. Verification Criteria
 *   8. Stop Conditions  9. Artifact Expectations
 *
 * Output location:
 *   out/prompts/<SPRINT_ID>/<DATE>/
 *     claude-implementation.md
 *     codex-support.md
 *     gpt-audit.md
 *     gemini-synthesis.md
 *
 * Design law (CLAUDE_OS_UPGRADE_ROADMAP.md Phase C):
 *   - fail-closed: write failures propagate as errors to caller
 *   - role-specific: each prompt file targets exactly one model lane
 *   - evidence-aware: prompts embed repo truth from context pack when available
 *   - protected-surface aware: elevated constraints injected for all 4 roles
 */

import * as path from 'node:path';

import {
  resolveRepoPath,
  getWorkspaceRoot,
  ensureDir,
  safeWriteText,
  normalizePath,
} from './fs-utils.js';

import type {
  AuthoritySurface,
  GovernanceDocRef,
  PromptPackFileRef,
  PromptPackGenerationResult,
  PromptPackGenerateOptions,
  ReceiptClass,
  RepoContextPack,
  PromptRole,
  ActiveSprintState,
} from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_OUTPUT_ROOT = 'out/prompts';

const ROLE_FILENAMES: Record<PromptRole, string> = {
  claude: 'claude-implementation.md',
  codex: 'codex-support.md',
  gpt: 'gpt-audit.md',
  gemini: 'gemini-synthesis.md',
};

const ROLES: PromptRole[] = ['claude', 'codex', 'gpt', 'gemini'];

// ---------------------------------------------------------------------------
// Internal build context
// ---------------------------------------------------------------------------

interface PromptBuildContext {
  sprintId: string;
  sprintTitle: string;
  authoritySurfaces: AuthoritySurface[];
  expectedProofClasses: ReceiptClass[];
  governanceDocs: GovernanceDocRef[];
  isProtected: boolean;
  sprintState?: ActiveSprintState;
  contextPack?: RepoContextPack;
  subsystem?: string;
  knownBlockers?: string[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function resolveOutputDir(
  sprintId: string,
  dateStr: string,
  options?: PromptPackGenerateOptions
): string {
  const root = options?.outputRoot
    ? path.resolve(options.outputRoot)
    : resolveRepoPath(DEFAULT_OUTPUT_ROOT);
  return path.join(root, sprintId, dateStr);
}

function toRepoRelativePath(absPath: string): string {
  const root = getWorkspaceRoot();
  const rel = path.relative(root, absPath);
  return normalizePath(rel);
}

// ---------------------------------------------------------------------------
// Shared prompt sections
// ---------------------------------------------------------------------------

function renderHeader(role: PromptRole, ctx: PromptBuildContext): string {
  const roleLabels: Record<PromptRole, string> = {
    claude: 'Claude Code — Primary Builder / Protected Surface Implementer',
    codex: 'Codex — Parallel Support Executor / Repo Inspector',
    gpt: 'GPT-5.4 — Architect / Sprint Judge / Status Judge',
    gemini: 'Gemini — Large-Context Analyst',
  };
  const roleTitles: Record<PromptRole, string> = {
    claude: 'Claude OS — Implementation Prompt',
    codex: 'Claude OS — Codex Support Prompt',
    gpt: 'Claude OS — GPT Audit Prompt',
    gemini: 'Claude OS — Gemini Synthesis Prompt',
  };
  return [
    `# ${roleTitles[role]}`,
    ``,
    `**Sprint**: ${ctx.sprintId}`,
    `**Role**: ${roleLabels[role]}`,
    `**Generated**: ${ctx.generatedAt}`,
    ctx.subsystem ? `**Subsystem**: ${ctx.subsystem}` : '',
    ``,
    `---`,
    ``,
  ]
    .filter(l => l !== undefined && !(l === '' && l !== ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

function renderProtectedSurfaceConstraints(ctx: PromptBuildContext): string {
  if (!ctx.isProtected) return '';
  const surfaceList = ctx.authoritySurfaces.map(s => `- \`${s}\``).join('\n');
  const proofList = ctx.expectedProofClasses.map(p => `- ${p}`).join('\n');
  return [
    `## ⚠️ Protected Surface Constraints (ELEVATED)`,
    ``,
    `This sprint holds authority locks on the following protected surfaces`,
    `per \`governance/ai-orchestration/LLM_AUTHORITY_MAP.md\` §10 (Authority Freeze Rule):`,
    ``,
    surfaceList,
    ``,
    `**Authority Freeze Rule enforcement:**`,
    `- No second sprint may begin on these surfaces until this sprint closes`,
    `- All writes to protected surfaces must use designated lifecycle adapters`,
    `- **Fail-closed**: any error on protected surfaces must STOP execution immediately`,
    `- Partial completion is NOT acceptable for protected-surface work`,
    ``,
    `**Required proof receipts for this sprint (elevated):**`,
    ``,
    proofList || '- (standard)',
    ``,
  ].join('\n');
}

function renderGovernanceDocs(ctx: PromptBuildContext): string {
  const existingDocs = ctx.governanceDocs.filter(d => d.exists);
  if (existingDocs.length === 0) return '';
  return [
    `## Governance Reference Documents`,
    ``,
    `The following governance documents are present in this repository:`,
    ``,
    ...existingDocs.map(d => `- \`${d.path}\``),
    ``,
  ].join('\n');
}

function renderScopeFromContextPack(ctx: PromptBuildContext): string {
  const cp = ctx.contextPack;
  if (!cp) return '';
  const lines: string[] = [];
  if (cp.repository_name) lines.push(`- **Repository**: ${cp.repository_name}`);
  if (cp.current_branch) lines.push(`- **Branch**: ${cp.current_branch}`);
  if (cp.affected_directories.length > 0) {
    lines.push(`- **Affected directories**: ${cp.affected_directories.join(', ')}`);
  }
  if (cp.changed_files.length > 0) {
    lines.push(`- **Changed files** (${cp.changed_files.length}):`);
    for (const f of cp.changed_files.slice(0, 10)) lines.push(`  - ${f}`);
    if (cp.changed_files.length > 10)
      lines.push(`  - ... and ${cp.changed_files.length - 10} more`);
  }
  return lines.join('\n');
}

function renderBlockers(ctx: PromptBuildContext): string {
  const blockers = ctx.knownBlockers ?? ctx.sprintState?.blockers?.map(b => b.description) ?? [];
  if (blockers.length === 0) return '';
  return [`### Known Blockers`, ``, ...blockers.map(b => `- ${b}`), ``].join('\n');
}

// ---------------------------------------------------------------------------
// Role-specific builders
// ---------------------------------------------------------------------------

function buildClaudePrompt(ctx: PromptBuildContext): string {
  const stage = ctx.sprintState?.stage ?? 'planning';
  const owner = ctx.sprintState?.primary_owner ?? 'claude_code';
  const nextAction = ctx.sprintState?.next_action ?? 'Begin implementation';
  const scopeLines = renderScopeFromContextPack(ctx);
  const proofList =
    ctx.expectedProofClasses.map(p => `- ${p} receipt`).join('\n') ||
    '- repo, build, test receipts (minimum)';
  const surfaceSection = ctx.isProtected
    ? ctx.authoritySurfaces
        .map(s => `- \`${s}\` — **protected, you hold the authority lock**`)
        .join('\n')
    : '_Standard sprint — no protected surfaces claimed._';

  return [
    renderHeader('claude', ctx),
    renderProtectedSurfaceConstraints(ctx),
    `## 1. Role`,
    ``,
    `You are **Claude Code**, Primary Builder and Protected Surface Implementer for the Unit Talk platform.`,
    ``,
    `**You own**: Production implementation, protected surfaces, multi-file refactors, Claude OS upgrades.`,
    `**You do NOT own**: Architecture decisions (GPT-5.4), bounded support tasks (Codex), synthesis (Gemini).`,
    ``,
    `**Current sprint owner**: ${owner}`,
    `**Current stage**: ${stage}`,
    ``,
    `---`,
    ``,
    `## 2. Objective`,
    ``,
    ctx.sprintTitle,
    ``,
    `**Sprint ID**: ${ctx.sprintId}`,
    ctx.subsystem ? `**Subsystem**: ${ctx.subsystem}` : '',
    ``,
    `---`,
    ``,
    `## 3. Scope`,
    ``,
    scopeLines || `_Scope to be determined from sprint contract._`,
    ``,
    renderBlockers(ctx),
    `---`,
    ``,
    `## 4. Authority Surfaces`,
    ``,
    surfaceSection,
    ``,
    `---`,
    ``,
    `## 5. Constraints`,
    ``,
    `- **No speculative refactors** — implement only what is specified in the sprint objective`,
    `- **No modification of governance law** unless required to resolve a true implementation ambiguity (surface explicitly)`,
    `- **Fail-closed** on all protected-surface operations — errors must STOP execution`,
    `- **Single-writer discipline** — canonical table writes via lifecycle adapters only (never direct \`supabase.from(...).insert/update\`)`,
    `- **Proof artifacts required** before claiming completion`,
    `- **No static claims** — "100%", "Production Ready", hard-coded pass counts are forbidden`,
    ctx.isProtected
      ? `- **Authority lock active** — surfaces listed in §4 are locked to this sprint`
      : '',
    ``,
    `---`,
    ``,
    `## 6. Required Outputs`,
    ``,
    `Code changes implementing the sprint objective, plus the following proof receipts:`,
    ``,
    proofList,
    ``,
    `Proof artifacts location: \`out/sprints/${ctx.sprintId}/<DATE>/proofs/\``,
    ``,
    `---`,
    ``,
    `## 7. Verification Criteria`,
    ``,
    `- TypeScript typecheck: exit 0 (\`npm run type-check\`)`,
    `- Tests: all passing (\`npm run test\`)`,
    `- Lifecycle gate: 0 violations (\`npm run lifecycle:single-writer -- --strict\`)`,
    ctx.isProtected ? `- Elevated: all protected-surface receipts present before close` : '',
    ``,
    `---`,
    ``,
    `## 8. Stop Conditions`,
    ``,
    `**STOP and escalate if:**`,
    ``,
    `- Tests fail unexpectedly after implementation`,
    `- TypeScript errors introduced by changes`,
    `- Unclear which lifecycle adapter to use for a write`,
    `- Single-writer violation detected by gate`,
    `- Required proof receipt cannot be generated`,
    ctx.isProtected ? `- Protected surface operation produces an error` : '',
    ``,
    `---`,
    ``,
    `## 9. Artifact Expectations`,
    ``,
    `| Artifact | Location |`,
    `|----------|----------|`,
    `| Code changes | \`tools/claude-os/src/\` (or per sprint scope) |`,
    ...ctx.expectedProofClasses.map(
      p => `| ${p} receipt | \`out/sprints/${ctx.sprintId}/<DATE>/proofs/proof_${p}.txt\` |`
    ),
    `| Closeout report | \`out/sprints/${ctx.sprintId}/<DATE>/SPRINT_CLOSEOUT_REPORT.md\` |`,
    ``,
    `**Next action**: ${nextAction}`,
    ``,
    renderGovernanceDocs(ctx),
  ]
    .filter(l => l !== undefined)
    .join('\n');
}

function buildCodexPrompt(ctx: PromptBuildContext): string {
  const scopeLines = renderScopeFromContextPack(ctx);
  const surfaceInfo = ctx.isProtected
    ? ctx.authoritySurfaces
        .map(s => `- \`${s}\` _(for context only — you have no authority over this surface)_`)
        .join('\n')
    : '_No protected surfaces in this sprint._';

  return [
    renderHeader('codex', ctx),
    renderProtectedSurfaceConstraints(ctx),
    `## 1. Role`,
    ``,
    `You are **Codex**, Parallel Support Executor and Repo Inspector for the Unit Talk platform.`,
    ``,
    `**You own**: Tests, CI helpers, documentation sync, bounded tooling, repo inspection.`,
    `**You do NOT own**: Protected surface implementations, sprint contract modifications, architecture decisions, status judgments.`,
    ``,
    `---`,
    ``,
    `## 2. Objective`,
    ``,
    `**Bounded support for**: ${ctx.sprintTitle}`,
    ``,
    `**Sprint ID**: ${ctx.sprintId}`,
    ``,
    `Your role is to provide bounded, factual, repo-grounded support within the scope below.`,
    `You are NOT executing the sprint objective itself — that belongs to Claude Code.`,
    ``,
    `---`,
    ``,
    `## 3. Scope — BOUNDED`,
    ``,
    `**ONLY the following work types are within your scope:**`,
    ``,
    `- Writing or updating tests`,
    `- CI configuration helpers`,
    `- Documentation updates`,
    `- Repo inspection and analysis`,
    `- Bounded tooling scripts`,
    ``,
    `**Do NOT**:`,
    `- Modify production code outside the above categories`,
    `- Modify protected surface logic`,
    `- Create or modify sprint contracts`,
    `- Make authoritative status claims`,
    ``,
    scopeLines ? `**Repo context:**\n\n${scopeLines}\n` : '',
    renderBlockers(ctx),
    `---`,
    ``,
    `## 4. Authority Surfaces (FOR INFORMATION ONLY)`,
    ``,
    surfaceInfo,
    ``,
    `---`,
    ``,
    `## 5. Constraints`,
    ``,
    `- **Bounded support work ONLY** — no protected-surface redesign`,
    `- **Factual and repo-grounded output only** — no speculative claims`,
    `- **Do not create or modify sprint contracts**`,
    `- **Do not make authoritative status claims** — status is owned by GPT-5.4`,
    `- **Do not modify canonical tables** directly — writes go through lifecycle adapters`,
    ctx.isProtected
      ? `- **Protected surfaces are locked** — do not touch the surfaces listed in the elevated constraints above`
      : '',
    ``,
    `---`,
    ``,
    `## 6. Required Outputs`,
    ``,
    `Tests and support artifacts that serve the sprint objective:`,
    ``,
    `- Test files covering sprint deliverables`,
    `- CI configuration updates if needed`,
    `- Documentation updates within bounded scope`,
    ``,
    `---`,
    ``,
    `## 7. Verification Criteria`,
    ``,
    `- Tests pass locally`,
    `- No new ESLint violations`,
    `- CI checks pass`,
    `- No protected-surface code modified`,
    ``,
    `---`,
    ``,
    `## 8. Stop Conditions`,
    ``,
    `**STOP and defer to Claude Code if:**`,
    ``,
    `- The task would modify a protected surface`,
    `- The task is outside the bounded support scope defined above`,
    `- No clear test harness is available for the work`,
    ctx.isProtected ? `- Any doubt about whether an action touches a locked surface` : '',
    ``,
    `---`,
    ``,
    `## 9. Artifact Expectations`,
    ``,
    `| Artifact | Location |`,
    `|----------|----------|`,
    `| Test files | Adjacent to the code under test |`,
    `| CI config | \`.github/workflows/\` |`,
    `| Docs | \`docs/\` or inline with code |`,
    ``,
    renderGovernanceDocs(ctx),
  ]
    .filter(l => l !== undefined)
    .join('\n');
}

function buildGptPrompt(ctx: PromptBuildContext): string {
  const surfaceAuditList =
    ctx.authoritySurfaces.length > 0
      ? ctx.authoritySurfaces.map(s => `- \`${s}\``).join('\n')
      : '_No protected surfaces claimed — standard sprint audit._';
  const existingDocs = ctx.governanceDocs.filter(d => d.exists);

  return [
    renderHeader('gpt', ctx),
    renderProtectedSurfaceConstraints(ctx),
    `## 1. Role`,
    ``,
    `You are **GPT-5.4**, Architect, Sprint Judge, and Status Judge for the Unit Talk platform.`,
    ``,
    `**You own**: Architecture decisions, sprint contract review, compliance auditing, status judgments.`,
    `**You do NOT own**: Direct code implementation, repo inspection, deployment operations.`,
    ``,
    `---`,
    ``,
    `## 2. Objective`,
    ``,
    `**Evidence review and compliance audit for**: ${ctx.sprintTitle}`,
    ``,
    `**Sprint ID**: ${ctx.sprintId}`,
    ``,
    `Review provided sprint artifacts for governance compliance and produce an audit report.`,
    `Do NOT assume repo state beyond the artifacts and documents provided.`,
    ``,
    `---`,
    ``,
    `## 3. Scope`,
    ``,
    `Review the following (as available):`,
    ``,
    `- Sprint closeout report at \`out/sprints/${ctx.sprintId}/<DATE>/SPRINT_CLOSEOUT_REPORT.md\``,
    `- Proof artifacts at \`out/sprints/${ctx.sprintId}/<DATE>/proofs/\``,
    `- Governance documents listed in §Governance Reference Documents`,
    `- Sprint state (current stage, receipts found vs missing)`,
    ``,
    `---`,
    ``,
    `## 4. Authority Surfaces`,
    ``,
    surfaceAuditList,
    ``,
    `**Audit scope for protected surfaces**: Verify that implementation evidence covers all protected surfaces claimed, authority locks were acquired, and proof receipts match the elevated requirements.`,
    ``,
    `---`,
    ``,
    `## 5. Constraints`,
    ``,
    `- **Evidence-only claims** — no assumptions beyond provided sprint artifacts`,
    `- **No speculation** about repo state not evidenced in provided inputs`,
    `- **Blocked claims**: cannot create sprint contracts, cannot directly modify repo, cannot deploy code`,
    `- **Status and maturity implications** only from evidence per \`STATUS_RUBRIC.md\``,
    `- **Compliance judgments** must cite specific governance document and section`,
    ctx.isProtected
      ? `- **Elevated audit standard** for protected surfaces — verify fail-closed behavior is evidenced`
      : '',
    ``,
    `---`,
    ``,
    `## 6. Required Outputs`,
    ``,
    `- Compliance report (pass/fail per governance document)`,
    `- Gap analysis (missing proofs, missing artifacts, incomplete receipts)`,
    `- Status judgment per \`STATUS_RUBRIC.md\` (if evidence supports a maturity claim)`,
    ctx.isProtected
      ? `- Protected surface verification (authority lock evidence, elevated proof receipts present)`
      : '',
    ``,
    `---`,
    ``,
    `## 7. Verification Criteria`,
    ``,
    `- Audit covers all governance documents listed in §Governance Reference Documents`,
    `- Every compliance claim cites a specific document and section`,
    `- Gap analysis identifies all missing required proof receipts`,
    `- Status judgment is consistent with STATUS_RUBRIC.md maturity definitions`,
    ``,
    `---`,
    ``,
    `## 8. Stop Conditions`,
    ``,
    `**STOP if:**`,
    ``,
    `- Evidence is insufficient for a status claim — report the gap, do not extrapolate`,
    `- Asked to make implementation decisions — defer to Claude Code`,
    `- Asked to directly modify repo state — out of scope for this role`,
    ``,
    `---`,
    ``,
    `## 9. Artifact Expectations`,
    ``,
    `| Artifact | Description |`,
    `|----------|-------------|`,
    `| Compliance report | Pass/fail matrix against governance docs |`,
    `| Gap analysis | Missing proofs, incomplete receipts |`,
    `| Status judgment | Maturity evaluation per STATUS_RUBRIC.md |`,
    ``,
    existingDocs.length > 0
      ? [
          `## Governance Reference Documents`,
          ``,
          `The following governance documents are present and must be consulted:`,
          ``,
          ...existingDocs.map(d => `- \`${d.path}\``),
          ``,
        ].join('\n')
      : `_No governance documents found on disk — consult repository governance directory._`,
    ``,
  ]
    .filter(l => l !== undefined)
    .join('\n');
}

function buildGeminiPrompt(ctx: PromptBuildContext): string {
  const scopeLines = renderScopeFromContextPack(ctx);
  const surfaceContext =
    ctx.authoritySurfaces.length > 0
      ? ctx.authoritySurfaces
          .map(s => `- \`${s}\` _(context only — you have no authority over this surface)_`)
          .join('\n')
      : '_No protected surfaces in this sprint._';

  return [
    renderHeader('gemini', ctx),
    renderProtectedSurfaceConstraints(ctx),
    `## 1. Role`,
    ``,
    `You are **Gemini**, Large-Context Analyst for the Unit Talk platform.`,
    ``,
    `**You own**: Synthesis, spec drift analysis, external research, comparative architecture, terminology mapping.`,
    `**You do NOT own**: Authoritative repo-state claims, implementation decisions, sprint contract creation, status judgments.`,
    ``,
    `---`,
    ``,
    `## 2. Objective`,
    ``,
    `**Synthesis and research support for**: ${ctx.sprintTitle}`,
    ``,
    `**Sprint ID**: ${ctx.sprintId}`,
    ``,
    `Your role is synthesis, comparison, and research. You do not make authoritative decisions about the Unit Talk codebase.`,
    ``,
    `---`,
    ``,
    `## 3. Scope — SYNTHESIS ONLY`,
    ``,
    `**Within scope:**`,
    `- Spec drift analysis (comparing governance docs to implementation evidence)`,
    `- External research and comparative architecture`,
    `- Terminology mapping and standardization suggestions`,
    `- Large-context synthesis across provided inputs`,
    ``,
    `**Out of scope:**`,
    `- Authoritative implementation decisions`,
    `- Repo state claims beyond provided inputs`,
    `- Status judgments (owned by GPT-5.4)`,
    ``,
    scopeLines ? `**Provided repo context:**\n\n${scopeLines}\n` : '',
    `---`,
    ``,
    `## 4. Authority Surfaces (FOR CONTEXT ONLY)`,
    ``,
    surfaceContext,
    ``,
    `---`,
    ``,
    `## 5. Constraints`,
    ``,
    `- **NO authoritative repo-state claims** beyond the inputs provided in this prompt`,
    `- **NO implementation directives** — synthesis and research only`,
    `- **NO modification of sprint contracts** — you are a consumer, not an author`,
    `- **Drift, comparison, and research role only**`,
    `- **Attribute external claims** — cite sources for external research findings`,
    ctx.isProtected
      ? `- **Protected surfaces are locked** — do not make implementation claims about them beyond provided evidence`
      : '',
    ``,
    `---`,
    ``,
    `## 6. Required Outputs`,
    ``,
    `- Synthesis report grounded in provided inputs`,
    `- Comparison findings (if applicable)`,
    `- Terminology analysis (if applicable)`,
    `- Spec drift identification (if applicable)`,
    ``,
    `---`,
    ``,
    `## 7. Verification Criteria`,
    ``,
    `- All synthesis claims are grounded in provided inputs`,
    `- External claims are attributed to sources`,
    `- No authoritative implementation decisions made`,
    ``,
    `---`,
    ``,
    `## 8. Stop Conditions`,
    ``,
    `**STOP if:**`,
    ``,
    `- Asked for authoritative repo-state judgment — defer to GPT-5.4 or Claude Code`,
    `- No synthesis task is clearly defined — clarify scope before proceeding`,
    `- Asked to make implementation decisions — out of scope for this role`,
    ``,
    `---`,
    ``,
    `## 9. Artifact Expectations`,
    ``,
    `| Artifact | Description |`,
    `|----------|-------------|`,
    `| Synthesis report | Grounded findings from provided inputs |`,
    `| Comparison analysis | Drift, gaps, terminology |`,
    `| Research findings | External sources cited |`,
    ``,
    renderGovernanceDocs(ctx),
  ]
    .filter(l => l !== undefined)
    .join('\n');
}

// ---------------------------------------------------------------------------
// Prompt builder dispatch
// ---------------------------------------------------------------------------

const ROLE_BUILDERS: Record<PromptRole, (ctx: PromptBuildContext) => string> = {
  claude: buildClaudePrompt,
  codex: buildCodexPrompt,
  gpt: buildGptPrompt,
  gemini: buildGeminiPrompt,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a role-specific prompt pack for the given sprint.
 *
 * Writes 4 markdown files to out/prompts/<SPRINT_ID>/<DATE>/:
 *   claude-implementation.md, codex-support.md, gpt-audit.md, gemini-synthesis.md
 *
 * Fail-closed: any write failure returns success=false with errors populated.
 * Caller (sprint start) must treat this as a hard blocker for protected-surface sprints.
 */
export function generatePromptPack(
  sprintId: string,
  sprintTitle: string,
  authoritySurfaces: AuthoritySurface[],
  expectedProofClasses: ReceiptClass[],
  governanceDocs: GovernanceDocRef[],
  options?: PromptPackGenerateOptions
): PromptPackGenerationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const now = new Date();
  const dateStr = options?.dateOverride ?? now.toISOString().split('T')[0];
  const generatedAt = now.toISOString();

  const outDir = resolveOutputDir(sprintId, dateStr, options);

  // Ensure output directory exists
  const dirResult = ensureDir(outDir);
  if (!dirResult.success) {
    errors.push(`Failed to create prompt pack output directory: ${dirResult.error}`);
    return {
      success: false,
      output_dir: null,
      repo_relative_dir: null,
      generated_files: [],
      warnings,
      errors,
    };
  }

  const ctx: PromptBuildContext = {
    sprintId,
    sprintTitle,
    authoritySurfaces,
    expectedProofClasses,
    governanceDocs,
    isProtected: authoritySurfaces.length > 0,
    sprintState: options?.sprintState,
    contextPack: options?.contextPack,
    subsystem: options?.subsystem,
    knownBlockers: options?.knownBlockers,
    generatedAt,
  };

  const generatedFiles: PromptPackFileRef[] = [];

  for (const role of ROLES) {
    const filename = ROLE_FILENAMES[role];
    const absPath = path.join(outDir, filename);

    let content: string;
    try {
      content = ROLE_BUILDERS[role](ctx);
    } catch (err) {
      errors.push(
        `Failed to build ${role} prompt: ${err instanceof Error ? err.message : String(err)}`
      );
      return {
        success: false,
        output_dir: null,
        repo_relative_dir: null,
        generated_files: [],
        warnings,
        errors,
      };
    }

    const writeResult = safeWriteText(absPath, content);
    if (!writeResult.success) {
      errors.push(`Failed to write ${filename}: ${writeResult.error}`);
      return {
        success: false,
        output_dir: null,
        repo_relative_dir: null,
        generated_files: [],
        warnings,
        errors,
      };
    }

    generatedFiles.push({
      role,
      filename,
      abs_path: absPath,
      repo_relative_path: toRepoRelativePath(absPath),
    });
  }

  const repoRelativeDir = toRepoRelativePath(outDir);

  return {
    success: true,
    output_dir: outDir,
    repo_relative_dir: repoRelativeDir,
    generated_files: generatedFiles,
    warnings,
    errors: [],
  };
}

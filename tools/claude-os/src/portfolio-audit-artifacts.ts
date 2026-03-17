/**
 * SPOA — Sprint Portfolio Optimization Audit
 * Artifact writer: generates all required markdown files for a SPOA bundle.
 *
 * Sprint: SPRINT-SPOA-FOUNDATION-MANUAL-COMMAND
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { RunnerSummary } from './portfolio-audit-runners.js';
import type {
  PortfolioAuditResult,
  ClassifiedSprint,
  ParallelizationEntry,
} from './portfolio-audit-types.js';

// ---------------------------------------------------------------------------
// Bundle writer
// ---------------------------------------------------------------------------

export interface ArtifactBundle {
  outputDir: string;
  files: string[];
}

export function writeArtifactBundle(
  result: PortfolioAuditResult,
  runnerSummary: RunnerSummary,
  outputDir: string
): ArtifactBundle {
  fs.mkdirSync(outputDir, { recursive: true });

  const files: string[] = [];

  const write = (filename: string, content: string) => {
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, sanitizeForWindows(content), 'utf-8');
    files.push(filePath);
  };

  write('SUMMARY.md', buildSummary(result));
  write('SPRINT_CLASSIFICATION.md', buildSprintClassification(result.sprints));
  write('PARALLELIZATION_MATRIX.md', buildParallelizationMatrix(result));
  write('COMBINE_SPLIT_RECOMMENDATIONS.md', buildCombineSplitRecommendations(result));
  write('RUNNER_ASSIGNMENT.md', buildRunnerAssignment(result, runnerSummary));
  write('RISK_NOTES.md', buildRiskNotes(result));
  write('NEXT_ACTIONS.md', buildNextActions(result));
  write('INPUT_SOURCES.md', buildInputSources(result));

  return { outputDir, files };
}

// ---------------------------------------------------------------------------
// SUMMARY.md
// ---------------------------------------------------------------------------

function buildSummary(result: PortfolioAuditResult): string {
  const { sprints, recommendedNextSprint, rankedNextSprints, riskNotes, nextActions, limitations } =
    result;

  const totalSprints = sprints.length;
  const blocked = sprints.filter(s => s.classification === 'Blocked').length;
  const deferred = sprints.filter(s => s.classification === 'Deferred').length;
  const codexSafe = sprints.filter(s => s.classification === 'Codex-Safe').length;
  const govOnly = sprints.filter(s => s.classification === 'Governance-Only').length;
  const parallelPairs = result.parallelOpportunities.filter(p => p.safe).length;
  const highRisks = riskNotes.filter(r => r.severity === 'HIGH').length;

  const lines: string[] = [
    `# SPOA — Portfolio Audit Summary`,
    ``,
    `**Audit ID**: \`${result.auditId}\``,
    `**Run At**: ${result.runAt}`,
    `**Trigger**: ${result.trigger}`,
    `**Mode**: Report-Only (v1 — no queue mutations)`,
    ``,
    `---`,
    ``,
    `## Queue Overview`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total sprints reviewed | ${totalSprints} |`,
    `| Blocked | ${blocked} |`,
    `| Deferred | ${deferred} |`,
    `| Codex-Safe | ${codexSafe} |`,
    `| Governance-Only | ${govOnly} |`,
    `| Safe parallel pairs | ${parallelPairs} |`,
    `| High-risk notes | ${highRisks} |`,
    ``,
    `---`,
    ``,
    `## Top Recommendations`,
    ``,
  ];

  if (recommendedNextSprint) {
    lines.push(`**Recommended Next Sprint**: \`${recommendedNextSprint}\``);
    lines.push(``);
  } else {
    lines.push(
      `**Recommended Next Sprint**: Run \`/sprint-plan\` to determine from phase priorities`
    );
    lines.push(``);
  }

  if (rankedNextSprints && rankedNextSprints.length > 0) {
    lines.push(`### Ranked Next-Sprint Candidates`);
    lines.push(``);
    lines.push(`| Rank | Sprint ID | Confidence | Rationale |`);
    lines.push(`|------|-----------|------------|-----------|`);
    for (let i = 0; i < rankedNextSprints.length; i++) {
      const c = rankedNextSprints[i];
      const blockedNote = c.blockedBy ? ` [BLOCKED by ${c.blockedBy}]` : '';
      lines.push(
        `| ${i + 1} | \`${c.id}\` | ${c.confidence}${blockedNote} | ${truncate(c.rationale, 80)} |`
      );
    }
    lines.push(``);
  }

  if (parallelPairs > 0) {
    lines.push(
      `**Parallel Lane Opportunity**: ${parallelPairs} safe parallel pair(s) identified. See PARALLELIZATION_MATRIX.md.`
    );
    lines.push(``);
  }

  if (codexSafe > 0) {
    lines.push(
      `**Codex Lane**: ${codexSafe} sprint(s) classified Codex-Safe. See RUNNER_ASSIGNMENT.md.`
    );
    lines.push(``);
  }

  if (govOnly > 0) {
    lines.push(
      `**Governance Lane**: ${govOnly} sprint(s) Governance-Only (docs/audit/policy) — may run in parallel with implementation lanes.`
    );
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(``);
  lines.push(`## Highest-Risk Observations`);
  lines.push(``);

  const high = riskNotes.filter(r => r.severity === 'HIGH');
  if (high.length === 0) {
    lines.push(`No HIGH severity risk notes identified.`);
  } else {
    for (const r of high) {
      lines.push(
        `- **[${r.category.toUpperCase()}]** ${r.description}${r.sprint ? ` *(${r.sprint})*` : ''}`
      );
    }
  }

  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## Immediate Next Actions`);
  lines.push(``);
  for (const a of nextActions.slice(0, 3)) {
    lines.push(`- ${a}`);
  }

  if (limitations.length > 0) {
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
    lines.push(`## Audit Limitations`);
    lines.push(``);
    lines.push(
      `> This audit operated with incomplete sprint queue truth. Recommendations are conservative.`
    );
    lines.push(``);
    for (const l of limitations) {
      lines.push(`- ${l}`);
    }
  }

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// SPRINT_CLASSIFICATION.md
// ---------------------------------------------------------------------------

function buildSprintClassification(sprints: ClassifiedSprint[]): string {
  const lines: string[] = [
    `# Sprint Classification`,
    ``,
    `> Classifications follow SPOA_CLASSIFICATION_MATRIX.md.`,
    `> Fail-closed: when in doubt, Sequential Only.`,
    ``,
    `| Sprint ID | Title | Classification | Runner | Parallel-Safe | Tags | Rationale |`,
    `|-----------|-------|---------------|--------|--------------|------|-----------|`,
  ];

  for (const s of sprints) {
    const tags = s.secondaryTags.join(', ') || '—';
    const parallel = s.parallelSafe ? '✅' : '❌';
    const title = truncate(s.entry.title, 50);
    const rationale = truncate(s.rationale, 80);
    lines.push(
      `| \`${s.entry.id}\` | ${title} | ${s.classification} | ${s.runner} | ${parallel} | ${tags} | ${rationale} |`
    );
  }

  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## Classification Definitions`);
  lines.push(``);
  lines.push(`| Classification | Meaning |`);
  lines.push(`|---------------|---------|`);
  lines.push(`| Sequential Only | Must run isolated; no parallel partner appropriate |`);
  lines.push(`| Claude-Core | Architecture-sensitive; requires Claude Core execution |`);
  lines.push(`| Parallel-Safe | Can run alongside another approved sprint |`);
  lines.push(`| Multi-Claude Safe | Can decompose into non-overlapping Claude instances |`);
  lines.push(`| Codex-Safe | Bounded, low-ambiguity — eligible for Codex execution |`);
  lines.push(`| Governance-Only | Docs/audit/policy — no core product mutation |`);
  lines.push(`| Combine Candidate | Multiple small sprints better as one |`);
  lines.push(`| Split Candidate | One sprint too large or mixed risk profile |`);
  lines.push(`| Blocked | Dependency not met — cannot execute yet |`);
  lines.push(`| Deferred | Executable but strategically delayed |`);

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// PARALLELIZATION_MATRIX.md
// ---------------------------------------------------------------------------

function buildParallelizationMatrix(result: PortfolioAuditResult): string {
  const { parallelOpportunities, sprints } = result;

  const lines: string[] = [
    `# Parallelization Matrix`,
    ``,
    `> Conservative: only safe pairings are approved.`,
    `> Fail-closed: when parallel safety cannot be confirmed, mark unsafe.`,
    ``,
  ];

  const safePairs = parallelOpportunities.filter(p => p.safe);
  const unsafePairs = parallelOpportunities.filter(p => !p.safe);

  if (safePairs.length === 0) {
    lines.push(`## Safe Parallel Pairs`);
    lines.push(``);
    lines.push(`No safe parallel pairs identified in current queue.`);
    lines.push(``);

    // Explain why
    const parallelSafeCount = sprints.filter(s => s.parallelSafe).length;
    if (parallelSafeCount < 2) {
      lines.push(
        `> **Reason**: Fewer than 2 parallel-safe sprints are in the queue. ` +
          `Parallel execution requires at least 2 Codex-Safe, Multi-Claude Safe, or Governance-Only sprints with non-overlapping scope.`
      );
    }
  } else {
    lines.push(`## Safe Parallel Pairs`);
    lines.push(``);
    lines.push(`| Sprint A | Sprint B | Reason | Merge Risk |`);
    lines.push(`|----------|----------|--------|------------|`);
    for (const p of safePairs) {
      lines.push(`| \`${p.sprintA}\` | \`${p.sprintB}\` | ${p.reason} | ${p.mergeRisk} |`);
    }
  }

  lines.push(``);

  if (unsafePairs.length > 0) {
    lines.push(`## Unsafe / Not-Approved Pairings`);
    lines.push(``);
    lines.push(`| Sprint A | Sprint B | Reason | Merge Risk |`);
    lines.push(`|----------|----------|--------|------------|`);
    // Limit to first 10 to avoid noise
    for (const p of unsafePairs.slice(0, 10)) {
      lines.push(`| \`${p.sprintA}\` | \`${p.sprintB}\` | ${p.reason} | ${p.mergeRisk} |`);
    }
    if (unsafePairs.length > 10) {
      lines.push(`| ... | ... | (${unsafePairs.length - 10} more pairs suppressed) | — |`);
    }
  }

  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## Multi-Claude Wave Guidance`);
  lines.push(``);
  lines.push(`For Multi-Claude wave execution:`);
  lines.push(`- Each instance must own non-overlapping files`);
  lines.push(`- Each instance needs explicit ownership declaration in wave plan`);
  lines.push(`- Merge and convergence must be governed (use wave plan template)`);
  lines.push(`- All instances must pass their individual verification lanes before merge`);
  lines.push(`- See: \`docs/claude-os/MULTI_CLAUDE_WAVE_PLANNING_TEMPLATE.md\``);

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// COMBINE_SPLIT_RECOMMENDATIONS.md
// ---------------------------------------------------------------------------

function buildCombineSplitRecommendations(result: PortfolioAuditResult): string {
  const { combineCandidates, splitCandidates } = result;

  const lines: string[] = [`# Combine / Split Recommendations`, ``];

  if (combineCandidates.length === 0) {
    lines.push(`## Combine Candidates`);
    lines.push(``);
    lines.push(`No combine candidates identified in current queue.`);
    lines.push(``);
    lines.push(
      `> Combine candidates require at least 2 small, adjacent sprints with trivial dependency order.`
    );
  } else {
    lines.push(`## Combine Candidates`);
    lines.push(``);
    for (const c of combineCandidates) {
      lines.push(`### ${c.sprints.join(' + ')}`);
      lines.push(``);
      lines.push(`**Rationale**: ${c.rationale}`);
      lines.push(`**Expected Benefit**: ${c.benefit}`);
      lines.push(`**Cautions**: ${c.cautions}`);
      lines.push(``);
    }
  }

  lines.push(`---`);
  lines.push(``);

  if (splitCandidates.length === 0) {
    lines.push(`## Split Candidates`);
    lines.push(``);
    lines.push(`No split candidates identified in current queue.`);
    lines.push(``);
    lines.push(
      `> Split candidates require a sprint that mixes multiple risk profiles or would benefit from separate runners for different slices.`
    );
  } else {
    lines.push(`## Split Candidates`);
    lines.push(``);
    for (const s of splitCandidates) {
      lines.push(`### ${s.sprint}`);
      lines.push(``);
      lines.push(`**Rationale**: ${s.rationale}`);
      lines.push(`**Proposed Parts**:`);
      for (const part of s.proposedParts) {
        lines.push(`- ${part}`);
      }
      lines.push(``);
    }
  }

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// RUNNER_ASSIGNMENT.md
// ---------------------------------------------------------------------------

function buildRunnerAssignment(result: PortfolioAuditResult, runnerSummary: RunnerSummary): string {
  const lines: string[] = [
    `# Runner Assignment`,
    ``,
    `> Runners: Claude Core | Claude Secondary | Multi-Claude Wave | Codex | Governance Lane | Unassigned`,
    ``,
    `---`,
    ``,
  ];

  const sections: Array<{
    title: string;
    sprints: ClassifiedSprint[];
    description: string;
  }> = [
    {
      title: 'Claude Core',
      sprints: runnerSummary.claudeCore,
      description:
        'Architecture-sensitive sprints requiring full Claude context. Must run sequentially unless explicitly verified safe.',
    },
    {
      title: 'Claude Secondary (Multi-Claude candidate)',
      sprints: runnerSummary.claudeSecondary,
      description:
        'Sprints suitable for a second Claude instance in a coordinated wave plan with explicit ownership.',
    },
    {
      title: 'Multi-Claude Wave',
      sprints: runnerSummary.multiClaudeWave,
      description:
        'Sprints decomposed into non-overlapping lanes — suitable for coordinated multi-Claude execution under a wave plan.',
    },
    {
      title: 'Codex',
      sprints: runnerSummary.codex,
      description:
        'Bounded, low-ambiguity sprints with settled contracts — eligible for Codex execution.',
    },
    {
      title: 'Governance Lane',
      sprints: runnerSummary.governanceLane,
      description:
        'Docs, audit, and policy sprints — route to governance / Claude OS / architecture lane.',
    },
    {
      title: 'Unassigned (Pending Clarification)',
      sprints: runnerSummary.unassigned,
      description: 'Cannot assign runner without more truth. Review sprint spec before executing.',
    },
  ];

  for (const section of sections) {
    lines.push(`## ${section.title}`);
    lines.push(``);
    lines.push(`> ${section.description}`);
    lines.push(``);

    if (section.sprints.length === 0) {
      lines.push(`_No sprints assigned to this runner._`);
    } else {
      lines.push(`| Sprint | Classification | Notes |`);
      lines.push(`|--------|---------------|-------|`);
      for (const s of section.sprints) {
        const notes = s.blockerNote ?? s.entry.notes ?? s.rationale.slice(0, 60);
        lines.push(`| \`${s.entry.id}\` | ${s.classification} | ${truncate(notes, 60)} |`);
      }
    }

    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  }

  lines.push(`## Multi-Claude Instance Notes`);
  lines.push(``);
  lines.push(
    `This audit represents multi-Claude and Codex as classification/output recommendation concepts.`
  );
  lines.push(
    `Actual parallel execution is NOT launched by this command (v1 foundation — report-only).`
  );
  lines.push(``);
  lines.push(`To proceed with multi-Claude execution:`);
  lines.push(`1. Review PARALLELIZATION_MATRIX.md for approved safe pairs`);
  lines.push(
    `2. Create a wave plan using \`docs/claude-os/MULTI_CLAUDE_WAVE_PLANNING_TEMPLATE.md\``
  );
  lines.push(`3. Assign explicit ownership to each instance before launch`);
  lines.push(`4. Enforce gate-before-merge discipline per Lane Model rules`);

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// RISK_NOTES.md
// ---------------------------------------------------------------------------

function buildRiskNotes(result: PortfolioAuditResult): string {
  const { riskNotes } = result;

  const lines: string[] = [
    `# Risk Notes`,
    ``,
    `> Risk categories: architecture | schema | file-overlap | sequencing | proof`,
    ``,
  ];

  const byCategory = new Map<string, typeof riskNotes>();
  for (const r of riskNotes) {
    const list = byCategory.get(r.category) ?? [];
    list.push(r);
    byCategory.set(r.category, list);
  }

  if (riskNotes.length === 0) {
    lines.push(`No explicit risk notes generated. Portfolio is small or truth is limited.`);
    lines.push(``);
    lines.push(`> Run SPOA with a populated sprint queue for more specific risk analysis.`);
  } else {
    for (const [cat, notes] of byCategory) {
      lines.push(`## ${cat.charAt(0).toUpperCase() + cat.slice(1)} Risks`);
      lines.push(``);
      for (const n of notes) {
        const icon = n.severity === 'HIGH' ? '[HIGH]' : n.severity === 'MEDIUM' ? '[MED]' : '[LOW]';
        lines.push(
          `- ${icon} **[${n.severity}]** ${n.description}${n.sprint ? ` *(${n.sprint})*` : ''}`
        );
      }
      lines.push(``);
    }
  }

  lines.push(`---`);
  lines.push(``);
  lines.push(`## Standard Risk Categories`);
  lines.push(``);
  lines.push(`| Category | Description |`);
  lines.push(`|----------|-------------|`);
  lines.push(
    `| Architecture | Changes to core contracts, lifecycle boundaries, or service interfaces |`
  );
  lines.push(`| Schema | Database migrations, column changes, constraint modifications |`);
  lines.push(`| File-overlap | Multiple sprints touching the same files — merge collision risk |`);
  lines.push(`| Sequencing | Sprint ordered incorrectly relative to dependencies |`);
  lines.push(`| Proof | Sprint lacks clear proof artifact path or verification plan |`);

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// NEXT_ACTIONS.md
// ---------------------------------------------------------------------------

function buildNextActions(result: PortfolioAuditResult): string {
  const { nextActions, blockedItems, recommendedNextSprint, parallelOpportunities } = result;
  const safePairs = parallelOpportunities.filter(p => p.safe);

  const lines: string[] = [`# Next Actions`, ``];

  lines.push(`## Recommended Next Sprint`);
  lines.push(``);
  if (recommendedNextSprint) {
    lines.push(`\`\`\``);
    lines.push(`Next Sprint: ${recommendedNextSprint}`);
    lines.push(`\`\`\``);
  } else {
    lines.push(
      `> No explicit next sprint locked. Run \`/sprint-plan\` to determine from current phase priorities.`
    );
  }
  lines.push(``);

  if (safePairs.length > 0) {
    lines.push(`## Optional Parallel Lane`);
    lines.push(``);
    lines.push(`The following parallel pairs are safe to execute simultaneously:`);
    lines.push(``);
    for (const p of safePairs.slice(0, 3)) {
      lines.push(`- **${p.sprintA}** ↔ **${p.sprintB}** — ${p.reason}`);
    }
    lines.push(``);
    lines.push(`> Requires wave plan and explicit instance ownership before launch.`);
    lines.push(``);
  }

  if (blockedItems.length > 0) {
    lines.push(`## Blocked Items`);
    lines.push(``);
    for (const b of blockedItems) {
      lines.push(`- \`${b.sprint}\`: ${b.blockerNote}`);
      if (b.unblockCondition) {
        lines.push(`  - Unblock condition: ${b.unblockCondition}`);
      }
    }
    lines.push(``);
  }

  lines.push(`## All Recommended Actions`);
  lines.push(``);
  for (let i = 0; i < nextActions.length; i++) {
    lines.push(`${i + 1}. ${nextActions[i]}`);
  }

  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## Review / Escalation Notes`);
  lines.push(``);
  lines.push(`- Run \`/sprint-plan\` to populate the queue before next SPOA run`);
  lines.push(`- Update \`docs/status/NEXT_5_SPRINTS.md\` after each sprint closeout`);
  lines.push(`- Re-run \`claude-os portfolio:audit\` when queue changes significantly`);

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// INPUT_SOURCES.md (optional)
// ---------------------------------------------------------------------------

function buildInputSources(result: PortfolioAuditResult): string {
  const lines: string[] = [
    `# SPOA Input Sources`,
    ``,
    `**Audit ID**: \`${result.auditId}\``,
    `**Run At**: ${result.runAt}`,
    ``,
    `## Loaded Sources`,
    ``,
  ];

  for (const src of result.inputSources) {
    lines.push(`- \`${src}\``);
  }

  lines.push(``);
  lines.push(`## Source Authority`);
  lines.push(``);
  lines.push(`| Source | Authority |`);
  lines.push(`|--------|-----------|`);
  lines.push(`| \`docs/status/NEXT_5_SPRINTS.md\` | Explicit sprint queue (highest) |`);
  lines.push(`| \`docs/status/PHASE_STATUS.md\` | Phase remaining work (medium) |`);
  lines.push(`| \`docs/status/CURRENT_SYSTEM_STATUS.md\` | Current platform state (medium) |`);
  lines.push(`| \`docs/roadmap/*.md\` | Sprint order locks (medium) |`);
  lines.push(`| Inferred items | Derived from phase context (lowest) |`);

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '...';
}

/**
 * Replace Unicode symbols with ASCII-safe equivalents so output renders
 * correctly in PowerShell and Windows terminals without a UTF-8 BOM.
 */
function sanitizeForWindows(content: string): string {
  return (
    content
      .replace(/\u2705/g, '[PASS]') // ✅
      .replace(/\u274c/g, '[FAIL]') // ❌
      .replace(/\u26a0[\ufe0f]?/g, '[WARN]') // ⚠️
      .replace(/\u2014/g, '-') // —  em dash
      .replace(/\u2013/g, '-') // –  en dash
      .replace(/\u2192/g, '->') // →
      .replace(/\u2190/g, '<-') // ←
      .replace(/\u2194/g, '<->') // ↔
      .replace(/\u2026/g, '...') // …
      .replace(/\u2018/g, "'") // '
      .replace(/\u2019/g, "'") // '
      .replace(/\u201c/g, '"') // "
      .replace(/\u201d/g, '"') // "
      // Catch any remaining non-ASCII (fallback) — \x00 is intentional range start
      // eslint-disable-next-line no-control-regex
      .replace(/[^\x00-\x7F]/g, char => {
        const cp = char.codePointAt(0);
        return cp !== undefined ? `[U+${cp.toString(16).toUpperCase()}]` : '?';
      })
  );
}

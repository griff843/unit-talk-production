// UT-156: Structured issue templates for sprints, bugs, features, enhancements
// Templates produce standardized markdown bodies with acceptance criteria and proof fields.

export interface IssueTemplate {
  /** Template key used in CLI --template flag */
  key: string;
  /** Human-readable name */
  name: string;
  /** Default priority (1=urgent, 2=high, 3=medium, 4=low) */
  defaultPriority: number;
  /** Generate the issue body markdown */
  render(vars: TemplateVars): string;
}

export interface TemplateVars {
  title: string;
  description?: string;
  sprintId?: string;
  owner?: string;
  priority?: string;
  acceptanceCriteria?: string[];
  proofPath?: string;
  prUrl?: string;
  [key: string]: unknown;
}

// ── Template Definitions ─────────────────────────────────────────────────

const sprintTemplate: IssueTemplate = {
  key: 'sprint',
  name: 'Sprint Issue',
  defaultPriority: 1,
  render(vars) {
    const ac = vars.acceptanceCriteria ?? [
      'All sub-tasks completed',
      'Proof bundle generated',
      'Type-check passes',
    ];
    return [
      `## Sprint: ${vars.sprintId ?? 'TBD'}`,
      '',
      vars.description ?? '_No description provided._',
      '',
      '## Acceptance Criteria',
      ...ac.map(c => `- [ ] ${c}`),
      '',
      '## Proof',
      vars.proofPath ? `Bundle: \`${vars.proofPath}\`` : '_Generate proof before closeout._',
      '',
      '## Owner',
      vars.owner ?? '_Unassigned_',
      '',
      `**Priority:** ${vars.priority ?? 'P1'}`,
    ].join('\n');
  },
};

const bugTemplate: IssueTemplate = {
  key: 'bug',
  name: 'Bug Report',
  defaultPriority: 2,
  render(vars) {
    return [
      '## Bug Report',
      '',
      '### Description',
      vars.description ?? '_Describe the bug._',
      '',
      '### Steps to Reproduce',
      '1. ',
      '',
      '### Expected Behavior',
      '_What should happen._',
      '',
      '### Actual Behavior',
      '_What actually happens._',
      '',
      '### Environment',
      '- Branch: ',
      vars.prUrl ? `- PR: ${vars.prUrl}` : '',
      '',
      '## Acceptance Criteria',
      '- [ ] Bug is fixed',
      '- [ ] Regression test added',
      '- [ ] No new warnings introduced',
      ...(vars.acceptanceCriteria ?? []).map(c => `- [ ] ${c}`),
      '',
      `**Priority:** ${vars.priority ?? 'P2'}`,
      `**Owner:** ${vars.owner ?? '_Unassigned_'}`,
    ]
      .filter(Boolean)
      .join('\n');
  },
};

const featureTemplate: IssueTemplate = {
  key: 'feature',
  name: 'Feature Request',
  defaultPriority: 3,
  render(vars) {
    return [
      '## Feature Request',
      '',
      '### Description',
      vars.description ?? '_Describe the feature._',
      '',
      '### Motivation',
      '_Why is this needed?_',
      '',
      '### Proposed Solution',
      '_How should it work?_',
      '',
      '## Acceptance Criteria',
      ...(
        vars.acceptanceCriteria ?? ['Feature implemented', 'Tests pass', 'Documentation updated']
      ).map(c => `- [ ] ${c}`),
      '',
      '## Proof',
      vars.proofPath ? `Bundle: \`${vars.proofPath}\`` : '_Generate proof on completion._',
      '',
      `**Priority:** ${vars.priority ?? 'P3'}`,
      `**Owner:** ${vars.owner ?? '_Unassigned_'}`,
    ].join('\n');
  },
};

const enhancementTemplate: IssueTemplate = {
  key: 'enhancement',
  name: 'Enhancement',
  defaultPriority: 3,
  render(vars) {
    return [
      '## Enhancement',
      '',
      '### Description',
      vars.description ?? '_Describe the enhancement._',
      '',
      '### Current Behavior',
      '_What exists today._',
      '',
      '### Desired Behavior',
      '_What should change._',
      '',
      '## Acceptance Criteria',
      ...(
        vars.acceptanceCriteria ?? [
          'Enhancement implemented',
          'Backward-compatible',
          'Type-check passes',
        ]
      ).map(c => `- [ ] ${c}`),
      '',
      `**Priority:** ${vars.priority ?? 'P3'}`,
      `**Owner:** ${vars.owner ?? '_Unassigned_'}`,
    ].join('\n');
  },
};

// ── Registry ─────────────────────────────────────────────────────────────

const TEMPLATES = new Map<string, IssueTemplate>([
  ['sprint', sprintTemplate],
  ['bug', bugTemplate],
  ['feature', featureTemplate],
  ['enhancement', enhancementTemplate],
]);

/** Get a template by key. Returns undefined if not found. */
export function getTemplate(key: string): IssueTemplate | undefined {
  return TEMPLATES.get(key);
}

/** List all available template keys. */
export function listTemplateKeys(): string[] {
  return [...TEMPLATES.keys()];
}

/** Render an issue body using a named template. Falls back to plain description. */
export function renderTemplate(key: string, vars: TemplateVars): string {
  const tmpl = TEMPLATES.get(key);
  if (!tmpl) return vars.description ?? vars.title;
  return tmpl.render(vars);
}

/** Get the default priority for a template. */
export function templateDefaultPriority(key: string): number {
  return TEMPLATES.get(key)?.defaultPriority ?? 3;
}

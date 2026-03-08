/**
 * Claude OS — Contract Parser
 *
 * Parses governance contracts (markdown) and recipe files (JSON).
 * Conservative parser: extracts what is reliably detectable,
 * marks unresolved sections explicitly. Never fabricates parsed values.
 */

import { resolveRepoPath, safeReadText } from './fs-utils.js';

import type {
  ParsedSprintContract,
  ContractSection,
  ChecklistItem,
  ParsedTable,
  VerificationRecipeSet,
  VerificationRecipe,
  ProofRecipeSet,
  ProofRecipe,
  SprintType,
} from './types.js';

// ---------------------------------------------------------------------------
// Markdown Parsing Utilities
// ---------------------------------------------------------------------------

/** Extract headings and their content from markdown */
function extractSections(markdown: string): ContractSection[] {
  const sections: ContractSection[] = [];
  const headingPattern = /^(#{1,6})\s+(.+)$/gm;
  const matches: { level: number; heading: string; index: number }[] = [];

  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(markdown)) !== null) {
    matches.push({
      level: match[1].length,
      heading: match[2].trim(),
      index: match.index + match[0].length,
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end =
      i + 1 < matches.length
        ? matches[i + 1].index - matches[i + 1].heading.length - matches[i + 1].level - 2
        : markdown.length;
    const content = markdown.slice(start, end).trim();

    sections.push({
      heading: matches[i].heading,
      level: matches[i].level,
      content,
      checklists: extractChecklists(content),
      tables: extractTables(content),
    });
  }

  return sections;
}

/** Extract checklist items from markdown content */
function extractChecklists(content: string): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const checklistPattern = /^- \[([ xX])\]\s+(.+)$/gm;

  let match: RegExpExecArray | null;
  while ((match = checklistPattern.exec(content)) !== null) {
    items.push({
      checked: match[1].toLowerCase() === 'x',
      text: match[2].trim(),
    });
  }

  return items;
}

/** Extract simple markdown tables */
function extractTables(content: string): ParsedTable[] {
  const tables: ParsedTable[] = [];
  // Match table blocks: header row, separator, data rows
  // eslint-disable-next-line security/detect-unsafe-regex
  const tablePattern = /(\|[^\n]+\|)\n(\|[-| :]+\|)\n((?:\|[^\n]+\|\n?)+)/g;

  let match: RegExpExecArray | null;
  while ((match = tablePattern.exec(content)) !== null) {
    const headerRow = match[1];
    const dataBlock = match[3];

    const headers = headerRow
      .split('|')
      .map(h => h.trim())
      .filter(h => h.length > 0);

    const rows = dataBlock
      .trim()
      .split('\n')
      .map(row =>
        row
          .split('|')
          .map(cell => cell.trim())
          .filter(cell => cell.length > 0)
      );

    tables.push({ headers, rows });
  }

  return tables;
}

/** Extract key: value metadata from markdown (e.g., **Key**: Value) */
function extractMetadata(markdown: string): Record<string, string> {
  const metadata: Record<string, string> = {};
  const metaPattern = /\*\*(.+?)\*\*:\s*(.+)/g;

  let match: RegExpExecArray | null;
  while ((match = metaPattern.exec(markdown)) !== null) {
    const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
    metadata[key] = match[2].trim();
  }

  return metadata;
}

// ---------------------------------------------------------------------------
// Contract Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a sprint contract markdown file.
 * This is a template-aware parser — it recognizes placeholder patterns
 * like {SPRINT_ID} and marks those sections as unresolved.
 */
export function parseSprintContract(markdown: string): ParsedSprintContract {
  const sections = extractSections(markdown);
  const metadata = extractMetadata(markdown);

  // Identify sections that contain template placeholders
  const templatePattern = /\{[A-Z_]+\}/;
  const unresolvedSections = sections
    .filter(s => templatePattern.test(s.content) || templatePattern.test(s.heading))
    .map(s => s.heading);

  return {
    raw: markdown,
    sections,
    unresolvedSections,
    metadata,
  };
}

/**
 * Load and parse a contract from a repo-relative path.
 */
export function loadContract(relativePath: string): ParsedSprintContract | null {
  const result = safeReadText(resolveRepoPath(relativePath));
  if (!result.success || result.content === null) {
    return null;
  }
  return parseSprintContract(result.content);
}

// ---------------------------------------------------------------------------
// Recipe Access Helpers
// ---------------------------------------------------------------------------

/**
 * Get a verification recipe by ID.
 */
export function getVerificationRecipe(
  recipes: VerificationRecipeSet,
  recipeId: string
): VerificationRecipe | null {
  return recipes.recipes.find(r => r.id === recipeId) ?? null;
}

/**
 * Get a proof recipe by sprint type.
 */
export function getProofRecipe(
  recipes: ProofRecipeSet,
  sprintType: SprintType
): ProofRecipe | null {
  // Handle the naming difference: SprintType uses underscores, recipes may use underscores
  return recipes.sprint_types.find(r => r.type === sprintType) ?? null;
}

/**
 * Check if a verification recipe command is a real command vs a placeholder.
 * Commands starting with "TODO:" are considered unresolved.
 */
export function isCommandResolved(command: string): boolean {
  return !command.startsWith('TODO:') && !command.startsWith('TODO ');
}

/**
 * Extract all section headings from a contract for validation/summary.
 */
export function getContractSectionHeadings(contract: ParsedSprintContract): string[] {
  return contract.sections.map(s => s.heading);
}

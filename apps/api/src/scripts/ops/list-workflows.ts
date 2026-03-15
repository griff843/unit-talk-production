/**
 * ops:list — Workflow Discovery CLI
 *
 * SPRINT-052-LAYER3-PHASE11-OPERATOR-WORKFLOW-FOUNDATION
 *
 * Usage:
 *   pnpm ops:list
 *   pnpm ops:list --category analysis
 *   pnpm ops:list --category health
 */

import {
  getAllWorkflows,
  getCategories,
  getCategoryCounts,
  getWorkflowsByCategory,
} from '../../lib/workflow-registry';
import type { WorkflowCategory } from '../../lib/workflow-registry';

const RISK_COLOR: Record<string, string> = {
  low: '\x1b[32m', // green
  medium: '\x1b[33m', // yellow
  high: '\x1b[31m', // red
};
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

function riskLabel(level: string): string {
  return `${RISK_COLOR[level] ?? ''}${level.toUpperCase()}${RESET}`;
}

function main(): void {
  const args = process.argv.slice(2);
  const categoryIdx = args.indexOf('--category');
  const requestedCategory = categoryIdx !== -1 ? args[categoryIdx + 1] : undefined;

  const allWorkflows = getAllWorkflows();
  const categories = getCategories();
  const counts = getCategoryCounts();

  if (requestedCategory) {
    const workflows = getWorkflowsByCategory(requestedCategory as WorkflowCategory);
    if (workflows.length === 0) {
      console.error(`No workflows found for category: ${requestedCategory}`);
      console.error(`Available categories: ${categories.join(', ')}`);
      process.exit(1);
    }

    console.log(`\n${BOLD}Workflows — Category: ${requestedCategory}${RESET}\n`);
    for (const w of workflows) {
      console.log(`  ${BOLD}${w.name}${RESET} [${riskLabel(w.riskLevel)}]`);
      console.log(`  ${DIM}${w.description}${RESET}`);
      console.log(`  ${DIM}$ ${w.invocation}${RESET}`);
      if (w.parameters && w.parameters.length > 0) {
        for (const p of w.parameters) {
          console.log(`    ${p.required ? '*' : ' '} ${p.name}: ${p.description}`);
        }
      }
      console.log();
    }
    console.log(`  Total: ${workflows.length} workflow(s) in '${requestedCategory}'\n`);
    return;
  }

  // Show all workflows grouped by category
  console.log(`\n${BOLD}Unit Talk — Operator Workflow Registry${RESET}`);
  console.log(
    `${DIM}${allWorkflows.length} workflows across ${categories.length} categories${RESET}\n`
  );

  for (const category of categories) {
    const workflows = getWorkflowsByCategory(category);
    console.log(`${BOLD}${category.toUpperCase()} (${counts[category]})${RESET}`);
    for (const w of workflows) {
      console.log(
        `  ${w.name.padEnd(36)} [${riskLabel(w.riskLevel).padEnd(12)}]  ${DIM}${w.description.slice(0, 70)}${w.description.length > 70 ? '…' : ''}${RESET}`
      );
    }
    console.log();
  }

  console.log(
    `${DIM}Run 'pnpm ops:list --category <name>' for full details and parameters.${RESET}\n`
  );
}

main();

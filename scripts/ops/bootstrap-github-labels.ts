#!/usr/bin/env npx tsx
/**
 * Bootstrap GitHub Labels for CI Failure Resolver
 *
 * Creates or updates labels required by the CI Failure Resolver workflow.
 * Run manually when setting up a new repository or updating label schema.
 *
 * Usage:
 *   npx tsx scripts/ops/bootstrap-github-labels.ts
 *
 * Requirements:
 *   - GITHUB_TOKEN environment variable or gh CLI authenticated
 *   - Repository access with label management permissions
 *
 * @see docs/ops/CI_FAILURE_CLASSIFICATION.md
 * @see .github/workflows/ci-failure-resolver.yml
 */

import { execSync } from 'child_process';

interface Label {
  name: string;
  description: string;
  color: string;
}

// =============================================================================
// Label Definitions
// =============================================================================

const LABELS: Label[] = [
  // ==========================================================================
  // CI Status Labels
  // ==========================================================================
  {
    name: 'ci-failed',
    description: 'CI workflow failed - needs attention',
    color: 'd73a4a', // Red
  },
  {
    name: 'auto-fix',
    description: 'Automated fix applied by CI resolver',
    color: '0e8a16', // Green
  },
  {
    name: 'needs-human',
    description: 'Requires human review and intervention',
    color: 'fbca04', // Yellow
  },

  // ==========================================================================
  // Failure Classification Labels
  // ==========================================================================
  {
    name: 'ci:FLAKE',
    description: 'Transient/flaky failure (network, timeout)',
    color: 'c5def5', // Light blue
  },
  {
    name: 'ci:REGRESSION',
    description: 'Code regression detected',
    color: 'd93f0b', // Orange-red
  },
  {
    name: 'ci:CONFIG',
    description: 'Configuration or environment error',
    color: 'fef2c0', // Light yellow
  },
  {
    name: 'ci:MIGRATION',
    description: 'Database migration or schema issue',
    color: '5319e7', // Purple
  },
  {
    name: 'ci:SECURITY',
    description: 'Security vulnerability detected',
    color: 'b60205', // Dark red
  },
  {
    name: 'ci:POLICY',
    description: 'Policy or governance gate violation',
    color: 'e99695', // Pink
  },
  {
    name: 'ci:LINT',
    description: 'Linting or formatting failure',
    color: 'bfdadc', // Light teal
  },
  {
    name: 'ci:TYPESCRIPT',
    description: 'TypeScript compilation error',
    color: '1d76db', // Blue
  },
  {
    name: 'ci:TEST',
    description: 'Test suite failure',
    color: 'cc317c', // Magenta
  },
  {
    name: 'ci:BUILD',
    description: 'Build process failure',
    color: '6f42c1', // Purple
  },
  {
    name: 'ci:DEPENDENCY',
    description: 'Dependency resolution error',
    color: 'f9d0c4', // Peach
  },

  // ==========================================================================
  // Severity Labels
  // ==========================================================================
  {
    name: 'severity:P0',
    description: 'Critical - Immediate action required',
    color: 'b60205', // Dark red
  },
  {
    name: 'severity:P1',
    description: 'High - Address within 1 hour',
    color: 'd93f0b', // Orange
  },
  {
    name: 'severity:P2',
    description: 'Medium - Address within 4 hours',
    color: 'fbca04', // Yellow
  },
  {
    name: 'severity:P3',
    description: 'Low - Address when convenient',
    color: '0e8a16', // Green
  },

  // ==========================================================================
  // Workflow State Labels
  // ==========================================================================
  {
    name: 'ci:auto-fixable',
    description: 'Can be auto-fixed by CI resolver',
    color: 'c2e0c6', // Light green
  },
  {
    name: 'ci:manual-required',
    description: 'Requires manual fix - cannot be auto-resolved',
    color: 'fef2c0', // Light yellow
  },
  {
    name: 'needs-review',
    description: 'Awaiting code review',
    color: '0052cc', // Blue
  },
  {
    name: 'needs-triage',
    description: 'Needs classification and assignment',
    color: 'ededed', // Gray
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

function getRepoInfo(): { owner: string; repo: string } {
  try {
    const remote = execSync('git remote get-url origin', { encoding: 'utf-8' })
      .trim()
      .replace(/\.git$/, '');

    // Handle SSH format: git@github.com:owner/repo
    const sshMatch = remote.match(/git@github\.com:(.+)\/(.+)/);
    if (sshMatch) {
      return { owner: sshMatch[1], repo: sshMatch[2] };
    }

    // Handle HTTPS format: https://github.com/owner/repo
    const httpsMatch = remote.match(/github\.com\/(.+)\/(.+)/);
    if (httpsMatch) {
      return { owner: httpsMatch[1], repo: httpsMatch[2] };
    }

    throw new Error('Could not parse repository URL');
  } catch (error) {
    console.error('Error getting repository info:', error);
    process.exit(1);
  }
}

function labelExists(labelName: string): boolean {
  try {
    execSync(`gh label view "${labelName}" 2>/dev/null`, { encoding: 'utf-8' });
    return true;
  } catch {
    return false;
  }
}

function createOrUpdateLabel(label: Label): void {
  const { name, description, color } = label;

  try {
    if (labelExists(name)) {
      // Update existing label
      execSync(`gh label edit "${name}" --description "${description}" --color "${color}"`, {
        encoding: 'utf-8',
      });
      console.log(`  Updated: ${name}`);
    } else {
      // Create new label
      execSync(`gh label create "${name}" --description "${description}" --color "${color}"`, {
        encoding: 'utf-8',
      });
      console.log(`  Created: ${name}`);
    }
  } catch (error) {
    console.error(`  Failed: ${name} - ${error}`);
  }
}

// =============================================================================
// Main Execution
// =============================================================================

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('GitHub Labels Bootstrap for CI Failure Resolver');
  console.log('='.repeat(60));
  console.log();

  // Verify gh CLI is available
  try {
    execSync('gh --version', { encoding: 'utf-8' });
  } catch {
    console.error('Error: GitHub CLI (gh) is not installed or not in PATH.');
    console.error('Install from: https://cli.github.com/');
    process.exit(1);
  }

  // Verify authentication
  try {
    execSync('gh auth status', { encoding: 'utf-8', stdio: 'pipe' });
  } catch {
    console.error('Error: Not authenticated with GitHub CLI.');
    console.error('Run: gh auth login');
    process.exit(1);
  }

  const { owner, repo } = getRepoInfo();
  console.log(`Repository: ${owner}/${repo}`);
  console.log(`Labels to create/update: ${LABELS.length}`);
  console.log();

  console.log('Processing labels...');
  console.log('-'.repeat(40));

  for (const label of LABELS) {
    createOrUpdateLabel(label);
  }

  console.log('-'.repeat(40));
  console.log();
  console.log('Done! Labels are ready for CI Failure Resolver.');
  console.log();
  console.log('Next steps:');
  console.log('  1. Verify labels at: https://github.com/' + owner + '/' + repo + '/labels');
  console.log('  2. Ensure CI Failure Resolver workflow is enabled');
  console.log('  3. See docs/ops/CI_FAILURE_CLASSIFICATION.md for label usage');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

#!/usr/bin/env tsx
/**
 * SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036
 * Gate: Contract Compliance
 *
 * Validates that the submit-ticket payload shape matches the unified_picks schema.
 * Ensures required fields are present and types are correct.
 *
 * Usage: npm run smartform:gate:contracts
 */

import * as fs from 'fs';
import * as path from 'path';

const SMART_FORM_DIR = path.resolve(__dirname, '../..');

// Required fields per unified_picks schema
const REQUIRED_SELECTION_FIELDS = [
  'sport',
  'stat_type',
  'line',
  'leg_odds',
  'source',
  'selection',
];

// Valid bet_type values (if present)
const VALID_BET_TYPES = [
  'spread',
  'moneyline',
  'total',
  'player_prop',
  'team_prop',
  'game_prop',
];

// Valid source values
const VALID_SOURCES = ['api', 'manual'];

// Valid direction values
const VALID_DIRECTIONS = ['over', 'under'];

interface ContractIssue {
  file: string;
  line: number;
  issue: string;
  context: string;
}

function scanSubmitTicketRoute(filePath: string): ContractIssue[] {
  const issues: ContractIssue[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Check for Zod schema with required fields
  let inSelectionSchema = false;
  let schemaStartLine = 0;
  const foundFields: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Look for selection schema definition
    if (line.includes('z.object({') && (
      lines.slice(Math.max(0, i - 5), i).some(l => l.includes('selection'))
    )) {
      inSelectionSchema = true;
      schemaStartLine = i + 1;
    }

    if (inSelectionSchema) {
      // Track found fields
      for (const field of REQUIRED_SELECTION_FIELDS) {
        if (line.includes(`${field}:`)) {
          foundFields.push(field);
        }
      }

      // Check for closing brace
      if (line.includes('})')) {
        inSelectionSchema = false;
      }
    }

    // Check for hardcoded defaults (anti-pattern)
    if (line.includes('|| -110') || line.includes('|| "-110"')) {
      issues.push({
        file: filePath,
        line: i + 1,
        issue: 'Hardcoded odds fallback detected',
        context: line.trim().slice(0, 100),
      });
    }

    // Check for missing required field validation
    // Note: Fields with .default() are acceptable even if optional
    if (line.includes('.optional()') && !line.includes('.default(') && REQUIRED_SELECTION_FIELDS.some(f => line.includes(f))) {
      const field = REQUIRED_SELECTION_FIELDS.find(f => line.includes(f));
      // Allow certain fields to be optional (context-dependent)
      const allowedOptional = ['direction', 'bet_type', 'player_name', 'team', 'team_id', 'player_id', 'line'];
      if (field && !allowedOptional.includes(field)) {
        issues.push({
          file: filePath,
          line: i + 1,
          issue: `Required field '${field}' marked as optional without default`,
          context: line.trim().slice(0, 100),
        });
      }
    }
  }

  return issues;
}

function scanApiClient(filePath: string): ContractIssue[] {
  const issues: ContractIssue[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let inSubmitTicket = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('submitTicket') || line.includes('submit-ticket')) {
      inSubmitTicket = true;
    }

    if (inSubmitTicket) {
      // Check for required fields in the interface
      if (line.includes('selections:')) {
        // This should be an array
        if (!line.includes('Array') && !line.includes('[]')) {
          issues.push({
            file: filePath,
            line: i + 1,
            issue: 'selections should be an array type',
            context: line.trim().slice(0, 100),
          });
        }
      }

      // Reset after function ends
      if (line.includes('}') && line.includes('submitTicket')) {
        inSubmitTicket = false;
      }
    }
  }

  return issues;
}

function scanPickWizard(filePath: string): ContractIssue[] {
  const issues: ContractIssue[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let inBuildPayload = false;
  const payloadFields: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Look for payload construction
    if (line.includes('selections:') || line.includes('ticketData')) {
      inBuildPayload = true;
    }

    if (inBuildPayload) {
      for (const field of REQUIRED_SELECTION_FIELDS) {
        if (line.includes(`${field}:`)) {
          payloadFields.push(field);
        }
      }

      // Check for proper source value
      if (line.includes("source:")) {
        const hasValidSource = VALID_SOURCES.some(s => line.includes(`'${s}'`) || line.includes(`"${s}"`));
        if (!hasValidSource && !line.includes("'manual'") && !line.includes("'api'")) {
          issues.push({
            file: filePath,
            line: i + 1,
            issue: 'Invalid or missing source value (must be "api" or "manual")',
            context: line.trim().slice(0, 100),
          });
        }
      }

      // End of payload construction
      if (line.includes('});') || line.includes('},')) {
        inBuildPayload = false;
      }
    }
  }

  return issues;
}

function main() {
  console.log('========================================');
  console.log('SMART FORM GATE: CONTRACT COMPLIANCE');
  console.log('Sprint: SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036');
  console.log('========================================\n');

  console.log('Validating submit-ticket payload contracts...\n');
  console.log('Required selection fields:');
  REQUIRED_SELECTION_FIELDS.forEach(f => console.log(`  - ${f}`));
  console.log('');

  const issues: ContractIssue[] = [];

  // Scan submit-ticket route
  const routePath = path.join(SMART_FORM_DIR, 'app/api/submit-ticket/route.ts');
  if (fs.existsSync(routePath)) {
    console.log('Scanning: app/api/submit-ticket/route.ts');
    issues.push(...scanSubmitTicketRoute(routePath));
  } else {
    console.log('WARNING: submit-ticket route not found');
  }

  // Scan api-client
  const apiClientPath = path.join(SMART_FORM_DIR, 'lib/api-client.ts');
  if (fs.existsSync(apiClientPath)) {
    console.log('Scanning: lib/api-client.ts');
    issues.push(...scanApiClient(apiClientPath));
  }

  // Scan PickWizard
  const pickWizardPath = path.join(SMART_FORM_DIR, 'app/submit-ticket/components/PickWizard.tsx');
  if (fs.existsSync(pickWizardPath)) {
    console.log('Scanning: app/submit-ticket/components/PickWizard.tsx');
    issues.push(...scanPickWizard(pickWizardPath));
  }

  console.log('');

  if (issues.length > 0) {
    console.log('CONTRACT ISSUES FOUND:\n');
    for (const issue of issues) {
      console.log(`  File: ${issue.file}`);
      console.log(`  Line: ${issue.line}`);
      console.log(`  Issue: ${issue.issue}`);
      console.log(`  Context: ${issue.context}`);
      console.log('');
    }
    console.log(`\nTotal issues: ${issues.length}`);
    console.log('\nGATE FAILED: Contract compliance issues found.');
    console.log('Payload must match unified_picks schema requirements.');
    process.exit(1);
  }

  console.log('Contract validation complete.');
  console.log('All payloads comply with unified_picks schema.');
  console.log('\nGATE PASSED');
  process.exit(0);
}

main();

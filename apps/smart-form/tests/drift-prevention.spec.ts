import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Drift Prevention Tests — Canonical Betslip Rewrite (Sections A-H)
 *
 * Static analysis tests that enforce architectural rules introduced by
 * the canonical betslip rewrite. These read source files as strings and
 * assert patterns — no browser or API required.
 *
 * Violations prevented:
 * - V-01: Free-text team input fallback
 * - V-02: Free-text player/team input in ManualPropCreator
 * - V-03: Missing submission receipt
 * - V-04: Silent error swallowing
 * - V-05: Missing canonical IDs in payload
 * - V-07: Sport reset bug
 */

const COMPONENTS_DIR = path.resolve(__dirname, '..', 'app', 'submit-ticket', 'components');
const TYPES_PATH = path.resolve(__dirname, '..', 'app', 'submit-ticket', 'types.ts');

function readComponent(filename: string): string {
  const fullPath = path.join(COMPONENTS_DIR, filename);
  return fs.readFileSync(fullPath, 'utf-8');
}

// =============================================================================
// 1. No free-text team inputs (V-01)
// =============================================================================

test.describe('V-01: No free-text team fallback in ManualEntryForm', () => {
  test('renderTeamField does not contain <Input fallback for team entry', () => {
    const src = readComponent('ManualEntryForm.tsx');

    // The renderTeamField function must NOT have an <Input that allows free-text team entry.
    // We check that there is no pattern where <Input appears directly inside renderTeamField
    // alongside team-related onChange handlers setting homeTeam/awayTeam from e.target.value.
    const teamInputFallback = /renderTeamField[\s\S]*?<Input[\s\S]*?onChange[\s\S]*?set(Home|Away)Team\(e\.target\.value\)/;
    expect(src).not.toMatch(teamInputFallback);
  });

  test('ManualEntryForm imports Combobox for team selection', () => {
    const src = readComponent('ManualEntryForm.tsx');
    expect(src).toContain('Combobox');
  });

  test('ManualEntryForm has teamsError state', () => {
    const src = readComponent('ManualEntryForm.tsx');
    expect(src).toContain('teamsError');
  });

  test('ManualEntryForm renders error banner for teams', () => {
    const src = readComponent('ManualEntryForm.tsx');
    // Must have a conditional render path for teamsError
    expect(src).toMatch(/teamsError\s*\?/);
  });
});

// =============================================================================
// 2. No free-text player/team inputs in ManualPropCreator (V-02)
// =============================================================================

test.describe('V-02: No free-text player/team in ManualPropCreator', () => {
  test('ManualPropCreator does NOT have plain <Input for player name', () => {
    const src = readComponent('ManualPropCreator.tsx');

    // The old pattern was <Input ... placeholder="e.g., Aaron Judge" with onChange setting player_name
    // It should now use Combobox or SmartPlayerInput, not a raw <Input for player names.
    // We check that there's no <Input that directly sets player_name from e.target.value.
    const freeTextPlayer = /<Input[\s\S]*?player_name:\s*e\.target\.value/;
    expect(src).not.toMatch(freeTextPlayer);
  });

  test('ManualPropCreator does NOT have plain <Input for team', () => {
    const src = readComponent('ManualPropCreator.tsx');

    // The old pattern was <Input placeholder="e.g., NYY" with onChange setting team from e.target.value
    const freeTextTeam = /<Input[\s\S]*?team:\s*e\.target\.value/;
    expect(src).not.toMatch(freeTextTeam);
  });

  test('ManualPropCreator uses Combobox for player and team selection', () => {
    const src = readComponent('ManualPropCreator.tsx');
    expect(src).toContain('Combobox');
    expect(src).toContain('teamItems');
  });

  test('ManualPropCreator accepts teamItems prop', () => {
    const src = readComponent('ManualPropCreator.tsx');
    expect(src).toMatch(/teamItems\??\s*:\s*ComboboxItem\[\]/);
  });
});

// =============================================================================
// 3. GameSelection carries canonical IDs (V-05)
// =============================================================================

test.describe('V-05: GameSelection has canonical ID fields', () => {
  test('types.ts GameSelection interface has team_id field', () => {
    const src = fs.readFileSync(TYPES_PATH, 'utf-8');
    expect(src).toMatch(/team_id\??\s*:\s*string/);
  });

  test('types.ts GameSelection interface has player_id field', () => {
    const src = fs.readFileSync(TYPES_PATH, 'utf-8');
    expect(src).toMatch(/player_id\??\s*:\s*string/);
  });
});

// =============================================================================
// 4. API payload includes canonical IDs (V-05)
// =============================================================================

test.describe('V-05: SmartTicketForm forwards canonical IDs in API payload', () => {
  test('SmartTicketForm payload construction includes team_id', () => {
    const src = readComponent('SmartTicketForm.tsx');
    // The selections mapping must include team_id from gs
    expect(src).toMatch(/team_id:\s*gs\.team_id/);
  });

  test('SmartTicketForm payload construction includes player_id', () => {
    const src = readComponent('SmartTicketForm.tsx');
    expect(src).toMatch(/player_id:\s*gs\.player_id/);
  });
});

// =============================================================================
// 5. Submit response renders receipt (V-03)
// =============================================================================

test.describe('V-03: Submission receipt replaces immediate reset', () => {
  test('SmartTicketForm has submissionResult state', () => {
    const src = readComponent('SmartTicketForm.tsx');
    expect(src).toContain('submissionResult');
  });

  test('SmartTicketForm renders SubmissionReceipt component', () => {
    const src = readComponent('SmartTicketForm.tsx');
    expect(src).toContain('SubmissionReceipt');
    expect(src).toMatch(/<SubmissionReceipt/);
  });

  test('SubmissionReceipt component exists and exports correctly', () => {
    const src = readComponent('SubmissionReceipt.tsx');
    expect(src).toContain('export function SubmissionReceipt');
    expect(src).toContain('bet_slip_id');
    expect(src).toContain('onSubmitAnother');
  });
});

// =============================================================================
// 6. Error states surfaced, not swallowed (V-04)
// =============================================================================

test.describe('V-04: Error states are surfaced in UI', () => {
  test('ManualEntryForm has teamsError state variable', () => {
    const src = readComponent('ManualEntryForm.tsx');
    expect(src).toMatch(/\[teamsError,\s*setTeamsError\]/);
  });

  test('ManualEntryForm has playersError state variable', () => {
    const src = readComponent('ManualEntryForm.tsx');
    expect(src).toMatch(/\[playersError,\s*setPlayersError\]/);
  });

  test('PlayerPropsPanel has playersError state variable', () => {
    const src = readComponent('PlayerPropsPanel.tsx');
    expect(src).toMatch(/\[playersError,\s*setPlayersError\]/);
  });

  test('ManualEntryForm renders error UI, not just console.error', () => {
    const src = readComponent('ManualEntryForm.tsx');
    // Must render an error banner/message that references teamsError
    expect(src).toContain('ErrorBanner');
  });
});

// =============================================================================
// 7. Sport preserved on form reset (V-07)
// =============================================================================

test.describe('V-07: Form reset preserves last sport', () => {
  test('SmartTicketForm preserves sport when resetting from receipt', () => {
    const src = readComponent('SmartTicketForm.tsx');
    // The handleSubmitAnother function should capture lastSport and pass it to INITIAL_DATA
    expect(src).toMatch(/lastSport.*=.*formState\.data\.sport/);
    expect(src).toMatch(/sport:\s*lastSport/);
  });

  test('Step1TicketSetup defaults to NBA (not MLB)', () => {
    const src = readComponent('Step1TicketSetup.tsx');
    expect(src).toMatch(/updates\.sport\s*=\s*'NBA'/);
  });
});

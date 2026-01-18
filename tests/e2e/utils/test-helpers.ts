import { expect, Page, APIRequestContext } from '@playwright/test';
import { randomUUID } from 'crypto';

/**
 * Test Helpers for E2E Validation
 *
 * Shared utilities for Smart Form, Command Center, and Daily Recap testing.
 */

export interface TestCapper {
  id: string;
  username: string;
  active: boolean;
}

export interface TestTicket {
  bet_slip_id: string;
  capper_id: string;
  sport: string;
  ticket_type: string;
  selections: TestSelection[];
  total_units: number;
}

export interface TestSelection {
  sport: string;
  stat_type: string;
  line: number;
  leg_odds: number;
  source: 'api' | 'manual';
  selection: 'over' | 'under';
  confidence?: number;
}

export interface TemporalWorkflowStatus {
  workflowId: string;
  runId: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TIMED_OUT';
  result?: any;
}

/**
 * Database Helpers
 */
export class DatabaseHelper {
  constructor(private supabaseUrl: string, private supabaseKey: string) {}

  async getActiveCapper(): Promise<TestCapper | null> {
    const response = await fetch(`${this.supabaseUrl}/rest/v1/users?active=eq.true&select=id,username,active&limit=1`, {
      headers: {
        'apikey': this.supabaseKey,
        'Authorization': `Bearer ${this.supabaseKey}`,
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch active capper:', await response.text());
      return null;
    }

    const cappers = await response.json();
    return cappers.length > 0 ? cappers[0] : null;
  }

  async verifyTicketCreated(betSlipId: string): Promise<boolean> {
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/smart_tickets?bet_slip_id=eq.${betSlipId}&select=*`,
      {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
        },
      }
    );

    if (!response.ok) return false;
    const tickets = await response.json();
    return tickets.length > 0;
  }

  async verifyPicksCreated(betSlipId: string): Promise<boolean> {
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/picks?bet_slip_id=eq.${betSlipId}&select=*`,
      {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
        },
      }
    );

    if (!response.ok) return false;
    const picks = await response.json();
    return picks.length > 0;
  }

  async verifyPickPublishCreated(betSlipId: string): Promise<boolean> {
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/pick_publish?bet_slip_id=eq.${betSlipId}&select=*`,
      {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
        },
      }
    );

    if (!response.ok) return false;
    const records = await response.json();
    return records.length > 0;
  }

  async getBridgeOutboxEvent(betSlipId: string): Promise<any> {
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/bridge_outbox?bet_slip_id=eq.${betSlipId}&select=*&order=created_at.desc&limit=1`,
      {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
        },
      }
    );

    if (!response.ok) return null;
    const events = await response.json();
    return events.length > 0 ? events[0] : null;
  }

  async getDailyRecap(recapDate: string): Promise<any> {
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/daily_recaps?recap_date=eq.${recapDate}&select=*&limit=1`,
      {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
        },
      }
    );

    if (!response.ok) return null;
    const recaps = await response.json();
    return recaps.length > 0 ? recaps[0] : null;
  }

  async cleanupTestData(betSlipId: string): Promise<void> {
    // Delete in reverse order of foreign key constraints
    const tables = ['pick_publish', 'picks', 'smart_tickets', 'bridge_outbox'];

    for (const table of tables) {
      await fetch(
        `${this.supabaseUrl}/rest/v1/${table}?bet_slip_id=eq.${betSlipId}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`,
          },
        }
      );
    }
  }
}

/**
 * Temporal Workflow Helpers
 */
export class TemporalHelper {
  constructor(private temporalUrl: string) {}

  async getWorkflowStatus(workflowId: string): Promise<TemporalWorkflowStatus | null> {
    try {
      const response = await fetch(`${this.temporalUrl}/api/v1/workflows/${workflowId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Failed to get workflow status:', error);
      return null;
    }
  }

  async waitForWorkflowCompletion(
    workflowId: string,
    timeoutMs: number = 120000
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getWorkflowStatus(workflowId);

      if (!status) {
        await this.sleep(2000);
        continue;
      }

      if (status.status === 'COMPLETED') return true;
      if (status.status === 'FAILED' || status.status === 'TIMED_OUT') return false;

      await this.sleep(2000); // Poll every 2 seconds
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Smart Form Helpers
 */
export class SmartFormHelper {
  constructor(private page: Page) {}

  async fillTicketForm(ticket: Partial<TestTicket>): Promise<void> {
    // Wait for form to load
    await this.page.waitForSelector('[data-testid="ticket-form"]', { timeout: 30000 });

    // Select capper if provided
    if (ticket.capper_id) {
      await this.page.selectOption('[data-testid="capper-select"]', ticket.capper_id);
    }

    // Select sport
    if (ticket.sport) {
      await this.page.selectOption('[data-testid="sport-select"]', ticket.sport);
    }

    // Select ticket type
    if (ticket.ticket_type) {
      await this.page.selectOption('[data-testid="ticket-type-select"]', ticket.ticket_type);
    }

    // Fill selections
    if (ticket.selections && ticket.selections.length > 0) {
      for (let i = 0; i < ticket.selections.length; i++) {
        const selection = ticket.selections[i];
        await this.fillSelection(i, selection);
      }
    }

    // Fill total units
    if (ticket.total_units) {
      await this.page.fill('[data-testid="total-units-input"]', ticket.total_units.toString());
    }
  }

  private async fillSelection(index: number, selection: TestSelection): Promise<void> {
    const prefix = `[data-testid="selection-${index}`;

    await this.page.selectOption(`${prefix}-stat-type"]`, selection.stat_type);
    await this.page.fill(`${prefix}-line"]`, selection.line.toString());
    await this.page.fill(`${prefix}-odds"]`, selection.leg_odds.toString());
    await this.page.selectOption(`${prefix}-selection"]`, selection.selection);
  }

  async submitForm(): Promise<string> {
    // Click submit button
    await this.page.click('[data-testid="submit-button"]');

    // Wait for success message
    await this.page.waitForSelector('[data-testid="success-message"]', { timeout: 30000 });

    // Extract bet_slip_id from response
    const betSlipId = await this.page.getAttribute('[data-testid="bet-slip-id"]', 'data-value');
    expect(betSlipId).toBeTruthy();

    return betSlipId!;
  }
}

/**
 * Command Center Helpers
 */
export class CommandCenterHelper {
  constructor(private page: Page) {}

  async navigateToDashboard(): Promise<void> {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  async filterByLeague(league: string): Promise<void> {
    await this.page.selectOption('[data-testid="league-filter"]', league);
    await this.page.waitForTimeout(1000); // Wait for filter to apply
  }

  async filterByDate(date: string): Promise<void> {
    await this.page.fill('[data-testid="date-filter"]', date);
    await this.page.waitForTimeout(1000);
  }

  async getVisibleProps(): Promise<number> {
    const props = await this.page.$$('[data-testid^="prop-card-"]');
    return props.length;
  }

  async verifyCanonicalMapping(): Promise<boolean> {
    // Check that player/team names are properly displayed (not raw feed IDs)
    const propCards = await this.page.$$('[data-testid^="prop-card-"]');

    for (const card of propCards) {
      const playerName = await card.$eval('[data-testid="player-name"]', el => el.textContent);

      // Should not contain UUIDs or raw API identifiers
      if (!playerName || playerName.match(/^[0-9a-f-]{36}$/i)) {
        return false;
      }
    }

    return true;
  }

  async verifyNoErrors(): Promise<boolean> {
    const errorMessages = await this.page.$$('[data-testid="error-message"]');
    return errorMessages.length === 0;
  }
}

/**
 * Test Data Generator
 */
export function generateTestTicket(capperId: string): TestTicket {
  return {
    bet_slip_id: randomUUID(),
    capper_id: capperId,
    sport: 'NFL',
    ticket_type: 'single',
    selections: [
      {
        sport: 'NFL',
        stat_type: 'passing_yards',
        line: 275.5,
        leg_odds: -110,
        source: 'manual',
        selection: 'over',
        confidence: 0.75,
      },
    ],
    total_units: 1.5,
  };
}

/**
 * Wait Helper with Polling
 */
export async function waitForCondition(
  condition: () => Promise<boolean>,
  timeoutMs: number = 60000,
  pollIntervalMs: number = 2000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  return false;
}

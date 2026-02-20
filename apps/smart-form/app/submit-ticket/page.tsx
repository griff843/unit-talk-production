import { V3TicketBuilder } from './components/V3TicketBuilder';

/**
 * V3 Ticket Submission Page
 *
 * SPRINT: SPRINT-SMARTFORM-UX-REBUILD-080
 *
 * Uses V3TicketBuilder which implements:
 * - Single-page sportsbook-grade UI
 * - Canonical V3 views for data
 * - atomic_submit_ticket_v2 for submission
 * - Provider-first with manual fallback
 * - Fail-closed error handling
 */
export default function SubmitTicketPage() {
  return <V3TicketBuilder />;
}

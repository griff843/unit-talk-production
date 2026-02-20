import { SportsbookManualEntry } from './components/SportsbookManualEntry';

/**
 * V3 Ticket Submission Page
 *
 * SPRINT: SPRINT-SMARTFORM-Sportsbook-ManualEntry-UX-085
 *
 * Sportsbook-grade manual entry UI:
 * - Single page, two-column layout (Builder + Bet Slip)
 * - Bet type selector first with dynamic fields
 * - Sticky bet slip panel with validation summary
 * - Compact leg cards with sport/type badges
 * - Keyboard shortcuts (Enter to add, Esc to clear)
 * - Combined odds and payout preview for parlays
 * - atomic_submit_ticket_v2 with entry_mode: 'manual'
 */
export default function SubmitTicketPage() {
  return <SportsbookManualEntry />;
}

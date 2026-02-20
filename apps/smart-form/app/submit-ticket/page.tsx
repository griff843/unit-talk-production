import { TrueManualEntryForm } from './components/TrueManualEntryForm';

/**
 * V3 Ticket Submission Page
 *
 * SPRINT: SPRINT-SMARTFORM-TRUE-MANUAL-ENTRY-084
 *
 * Uses TrueManualEntryForm which implements:
 * - 2-step tabs (Ticket Setup / Pick Details)
 * - True manual entry - NO sentinel events, NULL FK columns
 * - Manual data stored in provider_value/effective_value JSONB
 * - atomic_submit_ticket_v2 with entry_mode: 'manual'
 * - Fail-closed error handling
 */
export default function SubmitTicketPage() {
  return <TrueManualEntryForm />;
}

import { V2Builder } from './V2Builder';

/**
 * SPRINT-SMARTFORM-V2-MATCHUP-FIRST-063
 *
 * Smart Form V2 - One-Page Sportsbook Builder
 *
 * Features:
 * - One page (no wizard/stepper)
 * - Matchup REQUIRED for every ticket
 * - Units REQUIRED before submit
 * - Filter order: Sport → Matchup → Markets
 */

export default function SubmitTicketV2Page() {
  return <V2Builder />;
}

export const metadata = {
  title: 'Smart Form V2 | Submit Ticket',
  description: 'One-page sportsbook builder for ticket submission',
};

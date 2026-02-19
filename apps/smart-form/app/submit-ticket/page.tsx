import { PickWizard } from './components/PickWizard';

/**
 * Canonical ticket submission page
 *
 * SPRINT: SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036
 *
 * Uses the new PickWizard component which implements:
 * - Guided step-by-step flow
 * - Progressive disclosure
 * - First-class manual mode
 * - No mock data (fail-closed)
 * - Skeleton loading states
 */
export default function SubmitTicketPage() {
  return <PickWizard />;
}

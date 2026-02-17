import { redirect } from 'next/navigation';

/**
 * Root page - redirects to canonical /submit-ticket route
 *
 * PHASE: ui/surface-reset-020
 * Single Surface Policy: Only /submit-ticket is the canonical form surface
 */
export default function Home() {
  redirect('/submit-ticket');
}

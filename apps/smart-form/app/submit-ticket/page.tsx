// Force dynamic rendering to avoid prerendering issues
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { SmartTicketForm } from './components/SmartTicketForm';

export default function SubmitTicketPage() {
  return (
    <div className="container mx-auto py-8">
      <SmartTicketForm />
    </div>
  );
}

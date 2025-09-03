import { redirect } from 'next/navigation';

export default async function HealthPage() {
  // Redirect to the professional dashboard health section
  redirect('/dashboard/health');
}
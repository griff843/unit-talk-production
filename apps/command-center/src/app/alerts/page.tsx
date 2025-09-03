import { redirect } from 'next/navigation';

export default async function AlertsPage() {
  // Redirect to professional dashboard (no specific alerts page exists yet, but could be created)
  redirect('/dashboard');
}
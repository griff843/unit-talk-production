import { redirect } from 'next/navigation';

export default async function TemporalPage() {
  // Redirect to professional dashboard (no specific temporal page exists yet)
  redirect('/dashboard');
}
import { redirect } from 'next/navigation';

export default function HomePage() {
  // Immediately redirect to the professional Command Center dashboard
  redirect('/dashboard');
}
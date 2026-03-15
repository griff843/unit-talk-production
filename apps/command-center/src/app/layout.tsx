import type { Metadata } from 'next';

import './globals.css';
import { BuildInfo } from '@/components/BuildInfo';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'Unit Talk Command Center',
  description:
    'Fortune 100 SaaS-grade admin dashboard for Unit Talk sports betting intelligence platform',
};

/**
 * Resolve operator identity for the client-side AuthProvider.
 * Current source: NEXT_PUBLIC_OPERATOR_ID env var (development default).
 * Future: Supabase session-based identity.
 */
function getServerUser() {
  const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
  if (operatorId) {
    return { userId: operatorId };
  }
  return null;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const user = getServerUser();
  return (
    <html lang="en" className="dark">
      <body className="dark bg-background text-foreground">
        <AuthProvider user={user}>
          <div className="min-h-screen pb-8">{children}</div>
          <BuildInfo />
        </AuthProvider>
      </body>
    </html>
  );
}

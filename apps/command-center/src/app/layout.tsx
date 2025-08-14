import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/components/providers/query-provider';

export const metadata: Metadata = {
  title: 'Unit Talk Command Center',
  description:
    'Fortune 100 SaaS-grade admin dashboard for Unit Talk sports betting intelligence platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="dark bg-background text-foreground">
        <QueryProvider>
          <div className="min-h-screen">{children}</div>
        </QueryProvider>
      </body>
    </html>
  );
}

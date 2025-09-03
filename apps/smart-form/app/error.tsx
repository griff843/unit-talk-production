'use client';

export const dynamic = 'error';
export const revalidate = 0;

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
        <p className="mb-4 text-muted-foreground">
          {error?.message || 'An unexpected error occurred'}
        </p>
        <div className="flex flex-col space-y-2">
          <button
            onClick={() => reset()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md"
          >
            Try again
          </button>
          <Link href="/" className="text-center text-primary hover:underline">
            Go back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

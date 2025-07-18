'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export function ErrorBoundary({ children }: ErrorBoundaryProps) {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const errorHandler = (error: ErrorEvent) => {
      console.error('Caught error:', error);
      setError(error.error);
      setHasError(true);
    };

    window.addEventListener('error', errorHandler);
    return () => window.removeEventListener('error', errorHandler);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
          <p className="mb-4 text-muted-foreground">
            {error?.message || 'An unexpected error occurred'}
          </p>
          <div className="flex flex-col space-y-2">
            <button
              onClick={() => {
                setHasError(false);
                setError(null);
              }}
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

  return <>{children}</>;
}
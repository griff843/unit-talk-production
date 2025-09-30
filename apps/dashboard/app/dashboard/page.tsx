'use client';

import React, { Suspense } from 'react';

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';
import { CustomizableLayout } from '@/components/dashboard/CustomizableLayout';
import { GuidedTour } from '@/components/onboarding/GuidedTour';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4 p-6 glass-morphism rounded-lg">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-500 mx-auto"></div>
        <p className="mt-4 text-white text-lg">Loading Unit Talk Dashboard...</p>
        <p className="text-sm text-gray-400">
          Please wait while we prepare your personalized experience
        </p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <ErrorBoundary>
        <GuidedTour />
        <Suspense fallback={<LoadingSpinner />}>
          <div className="container mx-auto p-6">
            <CustomizableLayout />
          </div>
        </Suspense>
      </ErrorBoundary>
    </main>
  );
}

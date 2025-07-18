"use client";
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      // Send page view to analytics
      const analyticsData = {
        path: url,
        timestamp: new Date().toISOString(),
        performance: {
          fcp: getFCP(),
          lcp: getLCP(),
          fid: getFID(),
          cls: getCLS(),
        },
      };
      
      // In production, send to your analytics service
      console.log('Analytics:', analyticsData);
    };

    // Track initial page load
    handleRouteChange(pathname + searchParams.toString());
  }, [pathname, searchParams]);

  return null;
}

// Web Vitals measurement functions
function getFCP() {
  const entry = performance.getEntriesByType('paint').find(
    (entry) => entry.name === 'first-contentful-paint'
  );
  return entry?.startTime ?? 0;
}

function getLCP() {
  let lcp = 0;
  new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries() as PerformanceEntry[];
    const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
    lcp = lastEntry.startTime;
  }).observe({ entryTypes: ['largest-contentful-paint'] });
  return lcp;
}

function getFID() {
  let fid = 0;
  new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries() as (PerformanceEntry & { processingStart: number; startTime: number })[];
    const firstEntry = entries[0];
    fid = firstEntry.processingStart - firstEntry.startTime;
  }).observe({ entryTypes: ['first-input'] });
  return fid;
}

function getCLS() {
  let cls = 0;
  new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries() as (PerformanceEntry & { hadRecentInput: boolean; value: number })[];
    entries.forEach((entry) => {
      if (!entry.hadRecentInput) {
        cls += entry.value;
      }
    });
  }).observe({ entryTypes: ['layout-shift'] });
  return cls;
} 
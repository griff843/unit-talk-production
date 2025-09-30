'use client';
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
    handleRouteChange(pathname + (searchParams?.toString() || ''));
  }, [pathname, searchParams]);

  return null;
}

// Enhanced performance measurement interfaces
interface PerformancePaintTiming extends PerformanceEntry {
  readonly name: 'first-contentful-paint' | 'first-paint';
}

interface LargestContentfulPaint extends PerformanceEntry {
  readonly entryType: 'largest-contentful-paint';
  readonly size: number;
  readonly renderTime: number;
  readonly loadTime: number;
  readonly element?: Element;
  readonly url?: string;
}

interface FirstInputDelay extends PerformanceEntry {
  readonly entryType: 'first-input';
  readonly processingStart: number;
  readonly processingEnd: number;
  readonly cancelable: boolean;
  readonly target?: Node;
}

interface LayoutShift extends PerformanceEntry {
  readonly entryType: 'layout-shift';
  readonly value: number;
  readonly hadRecentInput: boolean;
  readonly lastInputTime: number;
  readonly sources: LayoutShiftAttribution[];
}

interface LayoutShiftAttribution {
  readonly node?: Node;
  readonly currentRect: DOMRectReadOnly;
  readonly previousRect: DOMRectReadOnly;
}

// Web Vitals measurement functions with proper typing
function getFCP(): number {
  if (typeof window === 'undefined' || !('performance' in window)) {
    return 0;
  }

  const entry = performance
    .getEntriesByType('paint')
    .find((entry): entry is PerformancePaintTiming =>
      entry.name === 'first-contentful-paint'
    );
  return entry?.startTime ?? 0;
}

function getLCP(): number {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
    return 0;
  }

  let lcp = 0;
  try {
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries() as LargestContentfulPaint[];
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        lcp = lastEntry.startTime;
      }
    }).observe({ entryTypes: ['largest-contentful-paint'] });
  } catch (error) {
    console.warn('LCP measurement not supported:', error);
  }
  return lcp;
}

function getFID(): number {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
    return 0;
  }

  let fid = 0;
  try {
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries() as FirstInputDelay[];
      const firstEntry = entries[0];
      if (firstEntry) {
        fid = firstEntry.processingStart - firstEntry.startTime;
      }
    }).observe({ entryTypes: ['first-input'] });
  } catch (error) {
    console.warn('FID measurement not supported:', error);
  }
  return fid;
}

function getCLS(): number {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
    return 0;
  }

  let cls = 0;
  try {
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries() as LayoutShift[];
      entries.forEach(entry => {
        if (!entry.hadRecentInput) {
          cls += entry.value;
        }
      });
    }).observe({ entryTypes: ['layout-shift'] });
  } catch (error) {
    console.warn('CLS measurement not supported:', error);
  }
  return cls;
}

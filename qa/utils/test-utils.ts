/**
 * QA Test Utilities
 * Common utilities for QA testing
 */

export function createTimestamp(): string {
  return new Date().toISOString();
}

export function createQATestResult(
  testName: string,
  status: 'PASS' | 'FAIL' | 'WARNING' | 'SKIP',
  message: string,
  duration: number,
  metrics?: any
): {
  testName: string;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'SKIP';
  message: string;
  duration: number;
  timestamp: string;
  metrics?: any;
} {
  return {
    testName,
    status,
    message,
    duration,
    timestamp: createTimestamp(),
    ...(metrics && { metrics })
  };
}
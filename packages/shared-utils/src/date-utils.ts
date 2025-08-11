/**
 * Date utility functions for consistent date handling across the platform
 * Resolves Date | string type conflicts throughout the codebase
 */

/**
 * Safely convert a Date or string to ISO string format
 */
export function toISOString(date: Date | string | null | undefined): string {
  if (!date) return new Date().toISOString();
  return typeof date === 'string' ? date : date.toISOString();
}

/**
 * Safely convert a Date or string to Date object
 */
export function toDate(date: Date | string | null | undefined): Date {
  if (!date) return new Date();
  return typeof date === 'string' ? new Date(date) : date;
}

/**
 * Format date for database storage (always returns ISO string)
 */
export function formatForDB(date: Date | string | null | undefined): string {
  return toISOString(date);
}

/**
 * Safely get time in milliseconds
 */
export function getTime(date: Date | string | null | undefined): number {
  return toDate(date).getTime();
}

/**
 * Safely format date to locale string
 */
export function toLocaleString(
  date: Date | string | null | undefined,
  locale?: string,
  options?: Intl.DateTimeFormatOptions
): string {
  return toDate(date).toLocaleString(locale, options);
}

/**
 * Safely format time to locale string
 */
export function toLocaleTimeString(
  date: Date | string | null | undefined,
  locale?: string,
  options?: Intl.DateTimeFormatOptions
): string {
  return toDate(date).toLocaleTimeString(locale, options);
}

/**
 * Safely format date to locale date string
 */
export function toLocaleDateString(
  date: Date | string | null | undefined,
  locale?: string,
  options?: Intl.DateTimeFormatOptions
): string {
  return toDate(date).toLocaleDateString(locale, options);
}

/**
 * Get hours from date
 */
export function getHours(date: Date | string | null | undefined): number {
  return toDate(date).getHours();
}

/**
 * Get date of month
 */
export function getDate(date: Date | string | null | undefined): number {
  return toDate(date).getDate();
}

/**
 * Set date of month (returns new Date)
 */
export function setDate(date: Date | string | null | undefined, day: number): Date {
  const d = toDate(date);
  const newDate = new Date(d);
  newDate.setDate(day);
  return newDate;
}

/**
 * Add days to date (returns new Date)
 */
export function addDays(date: Date | string | null | undefined, days: number): Date {
  const d = toDate(date);
  const newDate = new Date(d);
  newDate.setDate(newDate.getDate() + days);
  return newDate;
}

/**
 * Check if date is before another date
 */
export function isBefore(
  date1: Date | string | null | undefined,
  date2: Date | string | null | undefined
): boolean {
  return toDate(date1) < toDate(date2);
}

/**
 * Check if date is after another date
 */
export function isAfter(
  date1: Date | string | null | undefined,
  date2: Date | string | null | undefined
): boolean {
  return toDate(date1) > toDate(date2);
}

/**
 * Check if date is between two dates
 */
export function isBetween(
  date: Date | string | null | undefined,
  start: Date | string | null | undefined,
  end: Date | string | null | undefined
): boolean {
  const d = toDate(date);
  return d >= toDate(start) && d <= toDate(end);
}

/**
 * Get difference in milliseconds
 */
export function diffInMs(
  date1: Date | string | null | undefined,
  date2: Date | string | null | undefined
): number {
  return Math.abs(getTime(date1) - getTime(date2));
}

/**
 * Get difference in days
 */
export function diffInDays(
  date1: Date | string | null | undefined,
  date2: Date | string | null | undefined
): number {
  return Math.floor(diffInMs(date1, date2) / (1000 * 60 * 60 * 24));
}

/**
 * Get difference in hours
 */
export function diffInHours(
  date1: Date | string | null | undefined,
  date2: Date | string | null | undefined
): number {
  return Math.floor(diffInMs(date1, date2) / (1000 * 60 * 60));
}

/**
 * Format date for display (with fallback)
 */
export function formatForDisplay(
  date: Date | string | null | undefined,
  format?: 'short' | 'medium' | 'long' | 'full'
): string {
  try {
    const d = toDate(date);
    const options: Intl.DateTimeFormatOptions | undefined = format
      ? { dateStyle: format, timeStyle: 'short' }
      : undefined;
    return d.toLocaleString(undefined, options);
  } catch {
    return 'Invalid Date';
  }
}

// Re-export as namespace for easier migration
export const dateUtils = {
  toISOString,
  toDate,
  formatForDB,
  getTime,
  toLocaleString,
  toLocaleTimeString,
  toLocaleDateString,
  getHours,
  getDate,
  setDate,
  addDays,
  isBefore,
  isAfter,
  isBetween,
  diffInMs,
  diffInDays,
  diffInHours,
  formatForDisplay,
};

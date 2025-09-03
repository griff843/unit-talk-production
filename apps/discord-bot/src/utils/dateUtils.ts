/**
 * Date utility functions for consistent date handling across the Discord bot
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
 * Add days to date (returns new Date)
 */
export function addDays(date: Date | string | null | undefined, days: number): Date {
  const d = toDate(date);
  const newDate = new Date(d);
  newDate.setDate(newDate.getDate() + days);
  return newDate;
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
 * Get minutes from date
 */
export function getMinutes(date: Date | string | null | undefined): number {
  return toDate(date).getMinutes();
}

/**
 * Get full year from date
 */
export function getFullYear(date: Date | string | null | undefined): number {
  return toDate(date).getFullYear();
}

/**
 * Get month from date (0-based)
 */
export function getMonth(date: Date | string | null | undefined): number {
  return toDate(date).getMonth();
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

/**
 * Date utility functions for consistent date handling across the platform
 * Resolves Date | string type conflicts throughout the codebase
 */
/**
 * Safely convert a Date or string to ISO string format
 */
export declare function toISOString(date: Date | string | null | undefined): string;
/**
 * Safely convert a Date or string to Date object
 */
export declare function toDate(date: Date | string | null | undefined): Date;
/**
 * Format date for database storage (always returns ISO string)
 */
export declare function formatForDB(date: Date | string | null | undefined): string;
/**
 * Safely get time in milliseconds
 */
export declare function getTime(date: Date | string | null | undefined): number;
/**
 * Add days to date (returns new Date)
 */
export declare function addDays(date: Date | string | null | undefined, days: number): Date;
/**
 * Safely format date to locale string
 */
export declare function toLocaleString(date: Date | string | null | undefined, locale?: string, options?: Intl.DateTimeFormatOptions): string;
/**
 * Safely format time to locale string
 */
export declare function toLocaleTimeString(date: Date | string | null | undefined, locale?: string, options?: Intl.DateTimeFormatOptions): string;
/**
 * Safely format date to locale date string
 */
export declare function toLocaleDateString(date: Date | string | null | undefined, locale?: string, options?: Intl.DateTimeFormatOptions): string;
/**
 * Get hours from date
 */
export declare function getHours(date: Date | string | null | undefined): number;
/**
 * Get date of month
 */
export declare function getDate(date: Date | string | null | undefined): number;
/**
 * Set date of month (returns new Date)
 */
export declare function setDate(date: Date | string | null | undefined, day: number): Date;
/**
 * Check if date is before another date
 */
export declare function isBefore(date1: Date | string | null | undefined, date2: Date | string | null | undefined): boolean;
/**
 * Check if date is after another date
 */
export declare function isAfter(date1: Date | string | null | undefined, date2: Date | string | null | undefined): boolean;
/**
 * Get difference in milliseconds
 */
export declare function diffInMs(date1: Date | string | null | undefined, date2: Date | string | null | undefined): number;
/**
 * Get difference in days
 */
export declare function diffInDays(date1: Date | string | null | undefined, date2: Date | string | null | undefined): number;
//# sourceMappingURL=dateUtils.d.ts.map
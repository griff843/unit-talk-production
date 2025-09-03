"use strict";
/**
 * Date utility functions for consistent date handling across the platform
 * Resolves Date | string type conflicts throughout the codebase
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dateUtils = void 0;
exports.toISOString = toISOString;
exports.toDate = toDate;
exports.formatForDB = formatForDB;
exports.getTime = getTime;
exports.toLocaleString = toLocaleString;
exports.toLocaleTimeString = toLocaleTimeString;
exports.toLocaleDateString = toLocaleDateString;
exports.getHours = getHours;
exports.getDate = getDate;
exports.setDate = setDate;
exports.addDays = addDays;
exports.isBefore = isBefore;
exports.isAfter = isAfter;
exports.isBetween = isBetween;
exports.diffInMs = diffInMs;
exports.diffInDays = diffInDays;
exports.diffInHours = diffInHours;
exports.formatForDisplay = formatForDisplay;
/**
 * Safely convert a Date or string to ISO string format
 */
function toISOString(date) {
    if (!date)
        return new Date().toISOString();
    return typeof date === 'string' ? date : date.toISOString();
}
/**
 * Safely convert a Date or string to Date object
 */
function toDate(date) {
    if (!date)
        return new Date();
    return typeof date === 'string' ? new Date(date) : date;
}
/**
 * Format date for database storage (always returns ISO string)
 */
function formatForDB(date) {
    return toISOString(date);
}
/**
 * Safely get time in milliseconds
 */
function getTime(date) {
    return toDate(date).getTime();
}
/**
 * Safely format date to locale string
 */
function toLocaleString(date, locale, options) {
    return toDate(date).toLocaleString(locale, options);
}
/**
 * Safely format time to locale string
 */
function toLocaleTimeString(date, locale, options) {
    return toDate(date).toLocaleTimeString(locale, options);
}
/**
 * Safely format date to locale date string
 */
function toLocaleDateString(date, locale, options) {
    return toDate(date).toLocaleDateString(locale, options);
}
/**
 * Get hours from date
 */
function getHours(date) {
    return toDate(date).getHours();
}
/**
 * Get date of month
 */
function getDate(date) {
    return toDate(date).getDate();
}
/**
 * Set date of month (returns new Date)
 */
function setDate(date, day) {
    const d = toDate(date);
    const newDate = new Date(d);
    newDate.setDate(day);
    return newDate;
}
/**
 * Add days to date (returns new Date)
 */
function addDays(date, days) {
    const d = toDate(date);
    const newDate = new Date(d);
    newDate.setDate(newDate.getDate() + days);
    return newDate;
}
/**
 * Check if date is before another date
 */
function isBefore(date1, date2) {
    return toDate(date1) < toDate(date2);
}
/**
 * Check if date is after another date
 */
function isAfter(date1, date2) {
    return toDate(date1) > toDate(date2);
}
/**
 * Check if date is between two dates
 */
function isBetween(date, start, end) {
    const d = toDate(date);
    return d >= toDate(start) && d <= toDate(end);
}
/**
 * Get difference in milliseconds
 */
function diffInMs(date1, date2) {
    return Math.abs(getTime(date1) - getTime(date2));
}
/**
 * Get difference in days
 */
function diffInDays(date1, date2) {
    return Math.floor(diffInMs(date1, date2) / (1000 * 60 * 60 * 24));
}
/**
 * Get difference in hours
 */
function diffInHours(date1, date2) {
    return Math.floor(diffInMs(date1, date2) / (1000 * 60 * 60));
}
/**
 * Format date for display (with fallback)
 */
function formatForDisplay(date, format) {
    try {
        const d = toDate(date);
        const options = format
            ? { dateStyle: format, timeStyle: 'short' }
            : undefined;
        return d.toLocaleString(undefined, options);
    }
    catch {
        return 'Invalid Date';
    }
}
// Re-export as namespace for easier migration
exports.dateUtils = {
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

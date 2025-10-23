"use strict";
// src/types/player.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerPhysicalUtils = void 0;
/**
 * Utility functions for unit conversions
 */
class PlayerPhysicalUtils {
    /**
     * Convert feet and inches to centimeters
     * @param feet - Height in feet
     * @param inches - Additional inches
     * @returns Height in centimeters (rounded to nearest integer)
     */
    static feetInchesToCm(feet, inches = 0) {
        const totalInches = (feet * 12) + inches;
        return Math.round(totalInches * 2.54);
    }
    /**
     * Convert height string like "6'2\"" or "6-2" to centimeters
     * @param heightStr - Height string in various formats
     * @returns Height in centimeters or null if parsing fails
     */
    static parseHeightToCm(heightStr) {
        if (!heightStr) {
            return null;
        }
        // Handle formats like "6'2\"", "6'2", "6-2", "6 2"
        const match = heightStr.match(/(\d+)['"\-\s]+(\d+)/);
        if (match && match[1] && match[2]) {
            const feet = parseInt(match[1]);
            const inches = parseInt(match[2]);
            return this.feetInchesToCm(feet, inches);
        }
        // Handle format like "6'" (feet only)
        const feetMatch = heightStr.match(/(\d+)['"]?$/);
        if (feetMatch && feetMatch[1]) {
            const feet = parseInt(feetMatch[1]);
            return this.feetInchesToCm(feet, 0);
        }
        return null;
    }
    /**
     * Convert pounds to kilograms
     * @param pounds - Weight in pounds
     * @returns Weight in kilograms (rounded to 1 decimal place)
     */
    static poundsToKg(pounds) {
        return Math.round(pounds * 0.453592 * 10) / 10;
    }
    /**
     * Parse weight string and convert to kilograms
     * @param weightStr - Weight string (e.g., "185 lbs", "185")
     * @returns Weight in kilograms or null if parsing fails
     */
    static parseWeightToKg(weightStr) {
        if (!weightStr) {
            return null;
        }
        const match = weightStr.match(/(\d+)/);
        if (match && match[1]) {
            const pounds = parseInt(match[1]);
            return this.poundsToKg(pounds);
        }
        return null;
    }
    /**
     * Parse and validate birthday string to ISO format
     * @param dateStr - Date string in various formats
     * @returns ISO date string (YYYY-MM-DD) or null if invalid
     */
    static parseBirthday(dateStr) {
        if (!dateStr) {
            return null;
        }
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                return null;
            }
            // Return in YYYY-MM-DD format
            const isoString = date.toISOString().split('T')[0];
            return isoString || null;
        }
        catch {
            return null;
        }
    }
}
exports.PlayerPhysicalUtils = PlayerPhysicalUtils;

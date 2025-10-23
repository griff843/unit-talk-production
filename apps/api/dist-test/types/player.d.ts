/**
 * Player physical attributes interface
 */
export interface PlayerPhysicals {
    height_cm: number | null;
    weight_kg: number | null;
    birthday: string | null;
}
/**
 * Complete player enrichment data including headshot and physicals
 */
export interface PlayerEnrichmentData extends PlayerPhysicals {
    headshot_url: string | null;
}
/**
 * Utility functions for unit conversions
 */
export declare class PlayerPhysicalUtils {
    /**
     * Convert feet and inches to centimeters
     * @param feet - Height in feet
     * @param inches - Additional inches
     * @returns Height in centimeters (rounded to nearest integer)
     */
    static feetInchesToCm(feet: number, inches?: number): number;
    /**
     * Convert height string like "6'2\"" or "6-2" to centimeters
     * @param heightStr - Height string in various formats
     * @returns Height in centimeters or null if parsing fails
     */
    static parseHeightToCm(heightStr: string): number | null;
    /**
     * Convert pounds to kilograms
     * @param pounds - Weight in pounds
     * @returns Weight in kilograms (rounded to 1 decimal place)
     */
    static poundsToKg(pounds: number): number;
    /**
     * Parse weight string and convert to kilograms
     * @param weightStr - Weight string (e.g., "185 lbs", "185")
     * @returns Weight in kilograms or null if parsing fails
     */
    static parseWeightToKg(weightStr: string): number | null;
    /**
     * Parse and validate birthday string to ISO format
     * @param dateStr - Date string in various formats
     * @returns ISO date string (YYYY-MM-DD) or null if invalid
     */
    static parseBirthday(dateStr: string): string | null;
}
//# sourceMappingURL=player.d.ts.map
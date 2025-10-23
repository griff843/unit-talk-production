import { PlayerPhysicals } from '../../types/player';
/**
 * NHL Player from roster API
 */
interface NhlRosterPlayer {
    id: number;
    fullName: string;
    firstName: string;
    lastName: string;
    primaryNumber?: string;
    birthDate?: string;
    currentAge?: number;
    birthCity?: string;
    birthStateProvince?: string;
    birthCountry?: string;
    nationality?: string;
    height?: string;
    weight?: number;
    active: boolean;
    primaryPosition?: {
        code: string;
        name: string;
        type: string;
        abbreviation: string;
    };
    rosterStatus?: string;
}
/**
 * Get NHL player headshot URL
 * @param playerName - Full name of the player
 * @returns Headshot URL or null if not found
 */
export declare function getNhlHeadshot(playerName: string): Promise<string | null>;
/**
 * Get NHL player physical attributes (height, weight, birthday)
 * @param playerName - Full name of the player
 * @returns PlayerPhysicals object with height_cm, weight_kg, and birthday
 */
export declare function getNhlPhysicals(playerName: string): Promise<PlayerPhysicals>;
/**
 * Fetch all NHL team rosters
 */
export declare function getNhlRosters(): Promise<NhlRosterPlayer[]>;
/**
 * Convert NHL roster player to standardized format
 */
export declare function convertNhlRosterPlayer(player: NhlRosterPlayer): {
    external_id: string;
    player_name: string;
    sport: string;
    height_cm: number | null;
    weight_kg: number | null;
    birthday: string | null;
    photo_url: null;
    position: string | null;
    jersey_number: string | null;
    active: boolean;
};
export {};
//# sourceMappingURL=nhlEnrichment.d.ts.map
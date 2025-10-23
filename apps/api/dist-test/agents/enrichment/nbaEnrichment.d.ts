import { PlayerPhysicals } from '../../types/player';
/**
 * NBA Player from roster API
 */
interface NbaRosterPlayer {
    personId: number;
    firstName: string;
    lastName: string;
    displayName: string;
    jersey: string;
    pos: string;
    heightFeet: number;
    heightInches: number;
    weightPounds: number;
    dateOfBirthUTC: string;
    nbaDebutYear: number;
    yearsPro: number;
    collegeName: string;
    country: string;
    isActive: boolean;
}
/**
 * Fetch all NBA team rosters
 */
export declare function getNbaRosters(): Promise<NbaRosterPlayer[]>;
/**
 * Convert NBA roster player to standardized format
 */
export declare function convertNbaRosterPlayer(player: NbaRosterPlayer): {
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
/**
 * Get NBA player headshot URL
 * @param playerName - Full name of the player
 * @returns Headshot URL or null if not found
 */
export declare function getNbaHeadshot(playerName: string): Promise<string | null>;
/**
 * Get NBA player physical attributes (height, weight, birthday)
 * @param playerName - Full name of the player
 * @returns PlayerPhysicals object with height_cm, weight_kg, and birthday
 */
export declare function getNbaPhysicals(playerName: string): Promise<PlayerPhysicals>;
export {};
//# sourceMappingURL=nbaEnrichment.d.ts.map
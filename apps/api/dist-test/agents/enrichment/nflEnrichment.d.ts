import { PlayerPhysicals } from '../../types/player';
/**
 * NFL Player from ESPN API
 */
interface NflRosterPlayer {
    id: string;
    displayName: string;
    firstName: string;
    lastName: string;
    jersey?: string;
    position?: {
        name: string;
        abbreviation: string;
    };
    age?: number;
    height?: number;
    weight?: number;
    birthPlace?: {
        city: string;
        state: string;
        country: string;
    };
    dateOfBirth?: string;
    headshot?: {
        href: string;
    };
    active: boolean;
}
/**
 * Get NFL player headshot URL
 * @param playerName - Full name of the player
 * @returns Headshot URL or null if not found
 */
export declare function getNflHeadshot(playerName: string): Promise<string | null>;
/**
 * Get NFL player physical attributes (height, weight, birthday)
 * @param playerName - Full name of the player
 * @returns PlayerPhysicals object with height_cm, weight_kg, and birthday
 */
export declare function getNflPhysicals(playerName: string): Promise<PlayerPhysicals>;
/**
 * Fetch all NFL team rosters
 */
export declare function getNflRosters(): Promise<NflRosterPlayer[]>;
/**
 * Convert NFL roster player to standardized format
 */
export declare function convertNflRosterPlayer(player: NflRosterPlayer): {
    external_id: string;
    player_name: string;
    sport: string;
    height_cm: number | null;
    weight_kg: number | null;
    birthday: string | null;
    photo_url: string | null;
    position: string | null;
    jersey_number: string | null;
    active: boolean;
};
export {};
//# sourceMappingURL=nflEnrichment.d.ts.map
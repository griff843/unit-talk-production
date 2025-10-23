import { PlayerPhysicals } from '../../types/player';
/**
 * MLB player enrichment using MLB Stats API
 * Fetches headshot URLs and physical attributes for MLB players
 */
/**
 * MLB Player from roster API
 */
interface MlbRosterPlayer {
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
    height?: string;
    weight?: number;
    active: boolean;
    primaryPosition?: {
        code: string;
        name: string;
        type: string;
        abbreviation: string;
    };
}
/**
 * Fetch all MLB team rosters
 */
export declare function getMlbRosters(): Promise<MlbRosterPlayer[]>;
/**
 * Convert MLB roster player to standardized format
 */
export declare function convertMlbRosterPlayer(player: MlbRosterPlayer): {
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
 * Get MLB player headshot URL
 * @param playerName - Full name of the player
 * @returns Headshot URL or null if not found
 */
export declare function getMlbHeadshot(playerId: string): Promise<string>;
export declare function getMlbStats(_playerId: string): Promise<any>;
export declare function getMlbTeam(_playerId: string): Promise<any>;
export declare function getMlbGameLog(_playerId: string): Promise<any>;
export declare function getMlbInjuryStatus(_playerId: string): Promise<any>;
export declare function getMlbProjections(_playerId: string): Promise<any>;
/**
 * Get MLB player physical attributes (height, weight, birthday)
 * @param playerName - Full name of the player
 * @returns PlayerPhysicals object with height_cm, weight_kg, and birthday
 */
export declare function getMlbPhysicals(playerName: string): Promise<PlayerPhysicals>;
export {};
//# sourceMappingURL=mlbEnrichment.d.ts.map
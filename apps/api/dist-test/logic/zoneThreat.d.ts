export type ZoneThreatLevel = 'low' | 'medium' | 'high';
export interface ZoneThreatConfig {
    thresholds: {
        low: number;
        medium: number;
        high: number;
    };
    weights: {
        [key: string]: number;
    };
}
export interface ZoneThreatResult {
    level: ZoneThreatLevel;
    score: number;
    factors: {
        [key: string]: number;
    };
}
export declare function calculateZoneThreat(data: any, config: ZoneThreatConfig): ZoneThreatResult;
export declare const zoneThreatRating: typeof calculateZoneThreat;
export declare function calculateZoneThreatBoost(threatResult: ZoneThreatResult): number;
export declare function logZoneThreatDecision(decision: any): void;
export interface PitcherStats {
    era: number;
    whip: number;
    k9: number;
    bb9: number;
    hr9: number;
    gb_rate?: number;
    fb_rate?: number;
    ld_rate?: number;
    hard_contact_rate?: number;
    barrel_rate?: number;
}
export interface MatchupData {
    pitcher: PitcherStats;
    batter_vs_pitcher?: {
        avg: number;
        ops: number;
        hr_rate: number;
        k_rate: number;
    };
    park_factor?: number;
    weather?: {
        wind_speed: number;
        wind_direction: string;
        temperature: number;
    };
}
//# sourceMappingURL=zoneThreat.d.ts.map
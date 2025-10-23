export interface CapperProfile {
    id: string;
    name: string;
    discord_id: string;
    discord_username?: string;
    display_name?: string;
    tier?: string;
    status: 'active' | 'inactive' | 'suspended';
    specialties?: string[];
    bio?: string;
    created_at: string;
    updated_at: string;
}
export interface CapperStats {
    total_picks: number;
    win_rate: number;
    roi: number;
    streak: number;
    pushes?: number;
    profit_loss?: number;
    current_streak?: number;
}
//# sourceMappingURL=capper.d.ts.map
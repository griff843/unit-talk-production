export interface RawProp {
    id: string;
    external_id?: string;
    player_name: string | null;
    team?: string | null;
    opponent?: string | null;
    stat_type: string | null;
    line: number;
    over_odds?: number;
    under_odds?: number;
    market?: string;
    provider?: string | null;
    source?: string | null;
    sport?: string | null;
    created_at?: string | Date | null;
    game_time?: string;
    scraped_at?: string;
    promoted?: boolean;
    is_valid?: boolean;
    label?: string;
    abbr?: string;
    bookmaker?: string;
    league?: string;
    outcomes?: any;
    [key: string]: unknown;
}
//# sourceMappingURL=rawProps.d.ts.map
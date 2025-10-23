export type PickTier = 'S+' | 'S' | 'A+' | 'A' | 'B' | 'C';
export type PickStatus = 'pending' | 'won' | 'lost' | 'void' | 'push';
export type TicketType = 'single' | 'parlay' | 'rr' | 'contest';
export type PickType = 'prop' | 'spread' | 'total' | 'moneyline' | 'parlay';
export interface PickMeta {
    capper: string;
    tier: PickTier;
    status: PickStatus;
    odds: number;
    stake: number;
    result?: number;
    postedAt: string;
    settledAt?: string;
}
export interface Pick {
    id: string;
    pick_id: string;
    player?: string;
    team?: string;
    statType?: string;
    direction?: 'over' | 'under' | 'ml' | 'spread';
    line?: number;
    odds: number;
    ticketType: TicketType;
    pick_type?: PickType;
    status: PickStatus;
    meta: PickMeta;
}
//# sourceMappingURL=pick.d.ts.map
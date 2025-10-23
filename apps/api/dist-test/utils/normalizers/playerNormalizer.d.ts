interface RawProp {
    playerName?: unknown;
    marketType?: unknown;
    line?: unknown;
    source?: unknown;
    sport?: unknown;
    expiresAt?: unknown;
}
export declare function normalizeRawProps(rawProps: RawProp[]): {
    player_name: unknown;
    market_type: unknown;
    line: unknown;
    source: unknown;
    sport: unknown;
    expires_at: unknown;
    created_at: string;
}[];
export {};
//# sourceMappingURL=playerNormalizer.d.ts.map
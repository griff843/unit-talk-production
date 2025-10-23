export interface SGOFlattenedProp {
    eventID: string;
    leagueID: string;
    sportID: string;
    startsAtUTC: string;
    startsAtET: string;
    homeTeam: string;
    homeTeamID: string;
    awayTeam: string;
    awayTeamID: string;
    playerId: string | null;
    playerName: string | null;
    statType: string;
    ou: string | null;
    direction: string | null;
    marketKey: string;
    line: number | string | null;
    odds: number | string | null;
    sportsbook: string | null;
    period: string | null;
    meta: any;
}
export declare function fetchSGOEvents({ apiKey, leagueID, startsAfter, startsBefore, includeAltLine, oddsAvailable, limit, oddIDs, eventID, finalized, oddsPresent, }: {
    apiKey: string;
    leagueID?: string;
    startsAfter?: string;
    startsBefore?: string;
    includeAltLine?: boolean;
    oddsAvailable?: boolean;
    limit?: number;
    oddIDs?: string | string[];
    eventID?: string;
    finalized?: boolean;
    oddsPresent?: boolean;
}): Promise<any[]>;
export declare function flattenSGOEvents(events: any[]): SGOFlattenedProp[];
export declare function fetchAndFlattenSGOProps(opts: Parameters<typeof fetchSGOEvents>[0]): Promise<SGOFlattenedProp[]>;
export declare function fetchSGOEventsWithPagination({ apiKey, leagueID, startsAfter, startsBefore, finalized, includeAltLine, maxPages, }: {
    apiKey: string;
    leagueID: string;
    startsAfter: string;
    startsBefore: string;
    finalized?: boolean;
    includeAltLine?: boolean;
    maxPages?: number;
}): Promise<any[]>;
/**
 * Fetch specific player props for a given player
 * Example: fetchSGOPlayerProps(apiKey, "NBA", "JALEN_DUREN_1_NBA", ["points", "rebounds"])
 */
export declare function fetchSGOPlayerProps({ apiKey, leagueID, playerID, propTypes, startsAfter, startsBefore, finalized, }: {
    apiKey: string;
    leagueID: string;
    playerID: string;
    propTypes: string[];
    startsAfter?: string;
    startsBefore?: string;
    finalized?: boolean;
}): Promise<SGOFlattenedProp[]>;
/**
 * Fetch historic league data for backtesting
 * Example: fetchSGOHistoricData(apiKey, "NBA", "2024-03-28T07:00:00Z", "2024-09-30T06:59:59Z")
 */
export declare function fetchSGOHistoricData({ apiKey, leagueID, startsAfter, startsBefore, includeAltLine, limit, }: {
    apiKey: string;
    leagueID: string;
    startsAfter: string;
    startsBefore: string;
    includeAltLine?: boolean;
    limit?: number;
}): Promise<SGOFlattenedProp[]>;
/**
 * Fetch specific event by ID
 * Example: fetchSGOEventByID(apiKey, "EPL", "THE_EVENT_ID")
 */
export declare function fetchSGOEventByID({ apiKey, leagueID, eventID, }: {
    apiKey: string;
    leagueID: string;
    eventID: string;
}): Promise<SGOFlattenedProp[]>;
/**
 * Fetch upcoming games for a league starting after a specific time
 * Example: fetchSGOUpcomingGames(apiKey, "NCAAB", "2025-02-27T18:00:00Z")
 */
export declare function fetchSGOUpcomingGames({ apiKey, leagueID, startsAfter, limit, }: {
    apiKey: string;
    leagueID: string;
    startsAfter: string;
    limit?: number;
}): Promise<SGOFlattenedProp[]>;
//# sourceMappingURL=sgoFetcher.d.ts.map
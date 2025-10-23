/**
 * Temporal activity for processing alerts
 */
export declare function processAlert(): Promise<void>;
/**
 * Temporal activity for evaluating alert conditions
 */
export declare function evaluateConditions(): Promise<void>;
/**
 * Temporal activity for sending notifications
 */
export declare function sendNotification(): Promise<void>;
/**
 * Temporal activity for escalating alerts
 */
export declare function escalateAlert(): Promise<void>;
/**
 * Missing activities required by syndicate-scheduler workflow
 */
export declare function detectSuspiciousActivity(params: {
    leagues: string[];
    patterns: string[];
}): Promise<Array<{
    propId: string;
    league: string;
    pattern: string;
    confidence: number;
    details: any;
}>>;
export declare function detectLineMovement(params: {
    leagues: string[];
    significantThreshold: number;
    timeWindow: number;
}): Promise<Array<{
    propId: string;
    league: string;
    movement: number;
    direction: 'up' | 'down';
    timestamp: Date;
}>>;
export declare function detectSteamMovement(params: {
    leagues: string[];
    threshold: number;
    timeWindow: number;
}): Promise<Array<{
    propId: string;
    league: string;
    oldLine: number;
    newLine: number;
    movement: number;
    timestamp: Date;
}>>;
export declare function detectHedgeOpportunities(params: {
    leagues: string[];
    minProfitMargin: number;
}): Promise<Array<{
    propId: string;
    league: string;
    hedgeOpportunity: {
        originalBet: any;
        hedgeBet: any;
        guaranteedProfit: number;
    };
}>>;
export declare function detectMiddleOpportunities(params: {
    leagues: string[];
    minGap: number;
}): Promise<Array<{
    propId: string;
    league: string;
    middleOpportunity: {
        lowBet: any;
        highBet: any;
        gap: number;
        winProbability: number;
    };
}>>;
export declare function detectInjuryImpacts(params: {
    leagues: string[];
    sources: string[];
}): Promise<Array<{
    playerId: string;
    playerName: string;
    league: string;
    injuryType: string;
    severity: 'minor' | 'major' | 'season-ending';
    affectedProps: string[];
    source: string;
}>>;
export declare function detectStaleLines(params: {
    leagues: string[];
    maxAge: number;
}): Promise<Array<{
    propId: string;
    league: string;
    age: number;
    lastUpdate: Date;
}>>;
//# sourceMappingURL=index.d.ts.map
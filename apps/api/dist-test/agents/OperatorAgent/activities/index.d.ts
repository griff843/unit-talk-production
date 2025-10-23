export declare function monitorSystem(): Promise<void>;
export declare function handleAlert(alert: any): Promise<void>;
export declare function performMaintenance(): Promise<void>;
export declare function handleCriticalError(params: {
    errorMessage: string;
    agentId: string;
    timestamp?: string;
}): Promise<{
    success: boolean;
    message: string;
}>;
export declare function updateLiveGameStatus(params: {
    liveGames: any[];
    totalCount: number;
    leaguesWithLiveGames: string[];
    timestamp?: string;
    agentId?: string;
}): Promise<{
    success: boolean;
    message: string;
    data?: any;
}>;
export declare function logUSPError(params: {
    uspType: string;
    error: string;
    cycleCount?: number;
    timestamp?: string;
    agentId?: string;
}): Promise<{
    success: boolean;
    message: string;
}>;
//# sourceMappingURL=index.d.ts.map
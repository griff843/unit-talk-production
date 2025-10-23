export declare function performHealthCheck(params: {
    includeDatabse?: boolean;
    includeRedis?: boolean;
    includeExternalAPIs?: boolean;
    includeAgents?: boolean;
}): Promise<{
    success: boolean;
    message: string;
    data?: any;
}>;
export declare function monitorSystemHealth(): Promise<{
    success: boolean;
    message: string;
    data?: any;
}>;
//# sourceMappingURL=healthMonitoring.d.ts.map
/**
 * RiskManagementAgent Temporal Activities
 *
 * Activity functions for portfolio optimization, risk assessment,
 * and position sizing calculations.
 */
export declare function calculatePortfolioRisk(data: {
    portfolioId: string;
    positions: Array<{
        symbol: string;
        allocation: number;
        expectedReturn: number;
        volatility: number;
    }>;
}): Promise<{
    success: boolean;
    riskAssessment?: {
        totalRisk: number;
        diversificationScore: number;
        riskLevel: 'low' | 'medium' | 'high' | 'extreme';
        recommendations: string[];
    };
}>;
export declare function optimizePortfolio(data: {
    userId: string;
    availableCapital: number;
    riskTolerance: number;
    objectives: string[];
    currentPositions: any[];
}): Promise<{
    success: boolean;
    optimization?: {
        recommendedAllocations: Array<{
            asset: string;
            currentAllocation: number;
            recommendedAllocation: number;
            reason: string;
        }>;
        expectedReturn: number;
        expectedRisk: number;
        sharpeRatio: number;
    };
}>;
export declare function calculatePositionSize(data: {
    userId: string;
    pickData: {
        odds: number;
        confidence: number;
        expectedValue: number;
    };
    accountBalance: number;
    riskPercentage: number;
}): Promise<{
    success: boolean;
    positionSize?: {
        recommendedAmount: number;
        maxAmount: number;
        minAmount: number;
        kellyPercentage: number;
        reasoning: string;
    };
}>;
export declare function assessDrawdownRisk(data: {
    userId: string;
    historicalReturns: number[];
    currentDrawdown: number;
}): Promise<{
    success: boolean;
    drawdownAnalysis?: {
        maxDrawdown: number;
        currentDrawdownPercentile: number;
        recoveryTimeEstimate: number;
        riskLevel: 'low' | 'medium' | 'high' | 'critical';
        recommendations: string[];
    };
}>;
export declare function checkRiskManagementAgentHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
}>;
//# sourceMappingURL=index.d.ts.map
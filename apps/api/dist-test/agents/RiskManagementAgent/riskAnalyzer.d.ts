import { Logger } from '../../shared/logger/types';
interface Position {
    id: string;
    gameId: string;
    betType: string;
    stake: number;
    odds: number;
    expectedValue: number;
    volatility: number;
    correlation: Map<string, number>;
    timestamp: Date;
}
interface PortfolioAnalysis {
    totalExposure: number;
    riskScore: number;
    maxDrawdown: number;
    valueAtRisk: number;
    expectedShortfall: number;
    sharpeRatio: number;
    diversificationBenefit: number;
    concentrationRisk: number;
    liquidityRisk: number;
    correlationRisk: number;
    scenarios: ScenarioAnalysis[];
}
interface ScenarioAnalysis {
    name: string;
    probability: number;
    expectedReturn: number;
    worstCaseReturn: number;
    bestCaseReturn: number;
    impactDescription: string;
}
interface CorrelationChange {
    assets: string[];
    oldCorrelation: number;
    newCorrelation: number;
    changeDate: Date;
    significanceLevel: number;
    impactOnPortfolio: number;
}
interface RiskFactorExposure {
    factorName: string;
    exposure: number;
    contribution: number;
    sensitivity: number;
    riskAttribution: number;
}
export declare class RiskAnalyzer {
    private readonly logger;
    private correlationHistory;
    private riskModels;
    private benchmarkData;
    private stressScenarios;
    constructor(logger: Logger);
    initialize(): Promise<void>;
    analyzePortfolio(positions: Position[], bankroll: number): Promise<PortfolioAnalysis>;
    calculateCorrelations(positions: Position[]): Promise<Map<string, number>>;
    performStressTest(positions: Position[], scenarios: string[]): Promise<Map<string, any>>;
    detectCorrelationShifts(): Promise<CorrelationChange[]>;
    calculateRiskFactorExposures(positions: Position[]): Promise<RiskFactorExposure[]>;
    private calculateTotalExposure;
    private simulatePortfolioReturns;
    private calculateVaR;
    private calculateExpectedShortfall;
    private calculateMaxDrawdown;
    private calculateSharpeRatio;
    private calculateConcentrationRisk;
    private calculateDiversificationBenefit;
    private calculateCorrelationRisk;
    private calculateLiquidityRisk;
    private calculateOverallRiskScore;
    private performScenarioAnalysis;
    private calculateScenario;
    private getScenarioProbability;
    private getScenarioDescription;
    private calculatePairwiseCorrelation;
    private isSameSport;
    private isSameDay;
    private calculatePortfolioVolatility;
    private applyStressScenario;
    private calculateRiskMetrics;
    private calculateCorrelationChangeImpact;
    private calculateFactorExposure;
    private calculateFactorContribution;
    private calculateFactorSensitivity;
    private updateCorrelationHistory;
    private loadRiskModels;
    private loadBenchmarkData;
    private loadStressScenarios;
    private loadCorrelationHistory;
    isHealthy(): Promise<boolean>;
    cleanup(): Promise<void>;
}
export {};
//# sourceMappingURL=riskAnalyzer.d.ts.map
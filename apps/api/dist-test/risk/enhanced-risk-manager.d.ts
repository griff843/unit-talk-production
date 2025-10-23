import { Position, RiskMetrics, KellyResult, RiskManagerConfig } from '../types/risk';
export declare class EnhancedRiskManager {
    private config;
    constructor(config: RiskManagerConfig);
    calculateRiskMetrics(position: Position): Promise<RiskMetrics>;
    calculateKelly(position: Position): Promise<KellyResult>;
    validatePosition(position: Position): Promise<boolean>;
    private calculateVaR;
    private calculateSharpeRatio;
    private calculateMaxDrawdown;
    private calculateExpectedValue;
    private calculateWinProbability;
}
//# sourceMappingURL=enhanced-risk-manager.d.ts.map
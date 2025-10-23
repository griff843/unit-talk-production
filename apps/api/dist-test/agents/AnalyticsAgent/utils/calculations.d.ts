import { ROIAnalysis, TrendAnalysis, CapperPerformance } from '../types';
export declare function calculateROI(picks: any[]): ROIAnalysis;
export declare function calculateTrend(picks: any[]): TrendAnalysis;
export declare function calculatePerformance(roiAnalysis: ROIAnalysis, statTypePerformance: Record<string, {
    wins: number;
    total: number;
}>): CapperPerformance;
//# sourceMappingURL=calculations.d.ts.map
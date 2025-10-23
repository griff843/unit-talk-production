import * as client from 'prom-client';
import { BetType, GradeTier } from '../types';
declare const register: client.Registry<"text/plain; version=0.0.4; charset=utf-8">;
export declare const picksProcessed: client.Counter<"status" | "bet_type">;
export declare const pickGrades: client.Counter<"tier" | "bet_type">;
export declare const processingDuration: client.Histogram<"bet_type">;
export declare const failedOperations: client.Counter<"error_type" | "operation_type">;
export declare const queueSize: client.Gauge<string>;
export declare function trackPickProcessed(betType: BetType, status: 'success' | 'failure'): void;
export declare function trackPickGrade(tier: GradeTier, betType: BetType): void;
export declare function trackProcessingTime(betType: BetType, durationMs: number): void;
export declare function trackFailedOperation(operationType: string, errorType: string): void;
export declare function updateQueueSize(size: number): void;
export { register };
//# sourceMappingURL=metrics.d.ts.map
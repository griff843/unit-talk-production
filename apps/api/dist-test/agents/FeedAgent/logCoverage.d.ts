import { SupabaseClient } from '@supabase/supabase-js';
import { Provider } from './types';
interface CoverageLog {
    provider: Provider;
    data: Record<string, unknown> | null;
    timestamp: string;
}
interface CoverageResult {
    covered: number;
    missing: string[];
}
/**
 * Log coverage data to the coverage_logs table and calculate coverage metrics
 * @param log - Coverage log data
 * @param supabase - Supabase client instance
 * @returns Coverage metrics
 */
export declare function logCoverage(log: CoverageLog, supabase: SupabaseClient): Promise<CoverageResult>;
export {};
//# sourceMappingURL=logCoverage.d.ts.map
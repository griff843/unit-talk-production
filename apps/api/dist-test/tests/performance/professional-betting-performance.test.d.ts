/**
 * Professional Betting System Performance Tests
 *
 * Validates that all professional betting components meet performance requirements:
 * - Devigging calculations: <1ms per market
 * - CLV tracking: <10ms per pick
 * - Feedback loops: <30s for full optimization
 * - Alert processing: <5s for monitoring cycle
 *
 * These benchmarks ensure the system can handle production load.
 */
export {};
/**
 * Performance Benchmark Results Expected:
 *
 * Devigging:
 * - Two-way markets: <1ms (typically 0.1-0.3ms)
 * - Multi-way markets: <2ms (typically 0.5-1ms)
 * - Edge calculations: <0.1ms (typically 0.01-0.05ms)
 *
 * CLV Tracking:
 * - Pick tracking: <10ms (typically 2-5ms)
 * - Closing line updates: <5ms (typically 1-3ms)
 * - Stats aggregation: <100ms (typically 20-50ms)
 *
 * Feedback Loops:
 * - Complete optimization: <30s (typically 10-20s)
 * - Weight adjustments: <5s (typically 2-3s)
 * - Book adjustments: <2s (typically 0.5-1s)
 *
 * Alerts:
 * - Monitoring cycle: <5s (typically 1-3s)
 * - Single alert check: <1s (typically 0.2-0.5s)
 *
 * These benchmarks ensure the system can handle:
 * - 1000+ concurrent users
 * - 10,000+ picks per day
 * - Real-time monitoring (1-minute intervals)
 * - High-frequency market updates
 */ 
//# sourceMappingURL=professional-betting-performance.test.d.ts.map
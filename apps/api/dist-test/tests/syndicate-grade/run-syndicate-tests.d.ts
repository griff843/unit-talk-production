#!/usr/bin/env tsx
/**
 * Comprehensive Syndicate-Grade Test Suite Runner
 *
 * Executes the complete test suite for Unit Talk's syndicate-grade system:
 * - High-volume performance tests (8K+ props processing)
 * - Integration tests for complete data flow validation
 * - Chaos engineering tests for fault tolerance
 * - Real-time processing validation with <1s latency
 * - Professional grading feature verification
 * - System resilience and recovery testing
 *
 * Usage:
 *   npm run test:syndicate-grade              # Run full suite
 *   npm run test:syndicate-grade --performance # Performance tests only
 *   npm run test:syndicate-grade --integration # Integration tests only
 *   npm run test:syndicate-grade --chaos       # Chaos tests only
 *   npm run test:syndicate-grade --quick       # Quick validation suite
 *
 * Environment Requirements:
 * - Docker environment must be running (./dev.sh start)
 * - All services must be healthy
 * - Database migrations must be applied
 * - Sufficient system resources (8GB+ RAM recommended)
 */
declare class SyndicateTestRunner {
    private config;
    private results;
    private startTime;
    private healthCheck;
    constructor();
    /**
     * Main entry point for test execution
     */
    run(): Promise<void>;
    /**
     * Parse command line arguments
     */
    private parseCommandLineArgs;
    /**
     * Ensure output directory exists
     */
    private ensureOutputDirectory;
    /**
     * Perform comprehensive system health checks
     */
    private performSystemHealthChecks;
    /**
     * Validate test environment
     */
    private validateEnvironment;
    /**
     * Prepare test environment
     */
    private prepareTestEnvironment;
    /**
     * Execute all configured test suites
     */
    private executeTestSuites;
    /**
     * Get configured test suites based on command line args
     */
    private getConfiguredTestSuites;
    /**
     * Execute test suites sequentially
     */
    private executeTestSuitesSequential;
    /**
     * Execute test suites in parallel
     */
    private executeTestSuitesParallel;
    /**
     * Execute a single test suite
     */
    private executeTestSuite;
    /**
     * Run Jest tests with specified command and files
     */
    private runJestTests;
    /**
     * Parse Jest output to extract test results
     */
    private parseJestOutput;
    /**
     * Generate comprehensive test report
     */
    private generateTestReport;
    /**
     * Generate HTML test report
     */
    private generateHTMLReport;
    /**
     * Generate recommendations based on test results
     */
    private generateRecommendations;
    /**
     * Clean up test environment
     */
    private cleanupTestEnvironment;
    /**
     * Display final test results
     */
    private displayFinalResults;
    private checkDockerEnvironment;
    private checkDatabaseConnectivity;
    private checkServiceHealth;
    private checkMemoryAvailability;
    private checkDiskSpace;
    private logHealthCheckResults;
    private validateTestDataSetup;
    private validateAgentConfigurations;
    private cleanExistingTestData;
    private setupTestDatabase;
    private initializeTestAgents;
    private setupTestMonitoring;
    private resetTestAgents;
    private clearTestMonitoring;
    private runCommand;
}
export default SyndicateTestRunner;
//# sourceMappingURL=run-syndicate-tests.d.ts.map
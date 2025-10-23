#!/usr/bin/env node
/**
 * Comprehensive test script for multi-league player enrichment system
 * Tests headshot and physical attributes (height, weight, birthday) enrichment
 * for all supported leagues: MLB, NBA, NFL, NHL
 */
import { PlayerPhysicals } from '../../types/player';
/**
 * Test result interface
 */
interface TestResult {
    player: string;
    league: string;
    headshot: {
        success: boolean;
        url: string | null;
        error?: string;
    };
    physicals: {
        success: boolean;
        data: PlayerPhysicals;
        error?: string;
    };
}
/**
 * Test headshot and physicals for a specific player and league
 */
declare function testPlayerEnrichment(playerName: string, league: string, headshotFn: (name: string) => Promise<string | null>, physicalsFn: (name: string) => Promise<PlayerPhysicals>): Promise<TestResult>;
/**
 * Main test execution
 */
declare function runTests(): Promise<void>;
export { runTests, testPlayerEnrichment };
//# sourceMappingURL=multi-league-enrichment-test.d.ts.map
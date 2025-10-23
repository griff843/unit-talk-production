"use strict";
// Manual test script for PlayerEnrichmentAgent
// Run with: node -r ts-node/register src/agents/PlayerEnrichmentAgent/manual-test.ts
Object.defineProperty(exports, "__esModule", { value: true });
const mlbEnrichment_1 = require("../enrichment/mlbEnrichment");
async function testMlbEnrichment() {
    console.log('Testing MLB Enrichment...\n');
    // Test with a known MLB player
    console.log('Testing with known player: Mike Trout');
    try {
        const result1 = await (0, mlbEnrichment_1.getMlbHeadshot)('Mike Trout');
        console.log('Result:', result1);
        console.log('Success: ✅\n');
    }
    catch (error) {
        console.error('Error:', error);
        console.log('Failed: ❌\n');
    }
    // Test with a non-existent player
    console.log('Testing with non-existent player: John Doe');
    try {
        const result2 = await (0, mlbEnrichment_1.getMlbHeadshot)('John Doe');
        console.log('Result:', result2);
        console.log('Success: ✅ (null expected for non-existent player)\n');
    }
    catch (error) {
        console.error('Error:', error);
        console.log('Failed: ❌\n');
    }
    // Test with another known player
    console.log('Testing with known player: Aaron Judge');
    try {
        const result3 = await (0, mlbEnrichment_1.getMlbHeadshot)('Aaron Judge');
        console.log('Result:', result3);
        console.log('Success: ✅\n');
    }
    catch (error) {
        console.error('Error:', error);
        console.log('Failed: ❌\n');
    }
    console.log('Manual testing completed!');
}
// Run the test
testMlbEnrichment().catch(console.error);

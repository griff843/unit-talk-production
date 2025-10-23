"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = require("dotenv");
const optimal_1 = require("./agents/FeedAgent/optimal");
// Load environment variables
(0, dotenv_1.config)();
async function testOptimalIntegration() {
    console.log('🧪 Testing Optimal API Integration...\n');
    try {
        // Initialize Supabase client
        const supabase = (0, supabase_js_1.createClient)(process.env['SUPABASE_URL'], process.env['SUPABASE_KEY']);
        console.log('1️⃣ Fetching props from Optimal API...');
        const props = await (0, optimal_1.fetchOptimalProps)('MLB');
        console.log(`✅ Fetched ${props.length} props from Optimal API\n`);
        if (props.length === 0) {
            console.log('⚠️ No props returned from Optimal API');
            return;
        }
        console.log('2️⃣ Sample prop structure:');
        console.log(JSON.stringify(props[0], null, 2));
        console.log('');
        console.log('3️⃣ Testing database insertion of first 5 props...');
        const testProps = props.slice(0, 5);
        // Insert props directly into database
        const { data, error } = await supabase
            .from('raw_props')
            .insert(testProps)
            .select();
        if (error) {
            console.error('❌ Database insertion failed:', error);
            return;
        }
        console.log('✅ Database insertion successful!');
        console.log(`📊 Inserted ${data?.length || 0} props into database`);
        console.log('📋 Inserted prop IDs:', data?.map(p => p.id));
        // Clean up test data
        if (data && data.length > 0) {
            const ids = data.map(p => p.id);
            await supabase
                .from('raw_props')
                .delete()
                .in('id', ids);
            console.log('🧹 Cleaned up test data');
        }
        console.log('\n🎉 Integration test completed successfully!');
        console.log(`\n📈 Summary:`);
        console.log(`   • Fetched: ${props.length} props from Optimal API`);
        console.log(`   • Tested: ${testProps.length} props for database insertion`);
        console.log(`   • Status: ✅ All systems working correctly`);
    }
    catch (error) {
        console.error('❌ Integration test failed:', error);
        process.exit(1);
    }
}
// Run the test
testOptimalIntegration();

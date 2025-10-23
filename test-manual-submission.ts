import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const SUPABASE_URL = 'https://ewyzymdqzzooeymznzzb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3eXp5bWRxenpvb2V5bXpuenpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjE4NjIyNjcsImV4cCI6MjAzNzQzODI2N30.r8mBDv8TD6x4M0gh7vRzAseNvQnNqzywQbo3I4w7XJg';

async function testManualPickSubmission() {
  console.log('🚀 Testing Manual Pick Submission');
  console.log('=====================================\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // First, let's get griff843's user ID
  console.log('1️⃣ Looking up griff843 user...');
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('username', 'griff843')
    .single();

  if (userError || !userData) {
    console.log('❌ User not found, creating griff843...');
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([{
        username: 'griff843',
        discord_id: 'griff843_discord',
        tier: 'vip',
        favorite_sport: 'NFL'
      }])
      .select()
      .single();

    if (createError) {
      console.error('Error creating user:', createError);
      return;
    }
    console.log('✅ Created user:', newUser?.id);
  } else {
    console.log('✅ Found user:', userData.id);
  }

  // Prepare the test pick
  const testPick = {
    capper: 'griff843',
    ticket_type: 'single',
    sport: 'NFL',
    game_date: new Date().toISOString().split('T')[0],
    unit_size: 2,
    risk_amount: 100,
    confidence_level: 8,
    user_tier: 'vip',
    legs: [{
      game: 'Ravens vs Steelers',
      bet_type: 'spread',
      selection: 'Ravens -3.5',
      odds: '-110',
      status: 'pending'
    }],
    timestamp: new Date().toISOString()
  };

  console.log('\n2️⃣ Submitting pick via API...');
  console.log('Pick data:', JSON.stringify(testPick, null, 2));

  try {
    const response = await axios.post('http://localhost:3002/api/submit-ticket', testPick, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 200) {
      console.log('\n✅ Pick submitted successfully!');
      console.log('Response:', response.data);

      // Verify in database
      console.log('\n3️⃣ Verifying in database...');
      const { data: picks, error: pickError } = await supabase
        .from('unified_picks')
        .select(`
          *,
          users!unified_picks_user_id_fkey (
            username,
            discord_id
          )
        `)
        .eq('capper_name', 'griff843')
        .order('created_at', { ascending: false })
        .limit(1);

      if (picks && picks.length > 0) {
        console.log('✅ Pick found in database:');
        console.log('  - ID:', picks[0].id);
        console.log('  - Sport:', picks[0].sport);
        console.log('  - Status:', picks[0].status);
        console.log('  - Created:', picks[0].created_at);
      } else {
        console.log('⚠️ Pick not found in database yet');
      }

      // Check command center endpoint
      console.log('\n4️⃣ Checking Command Center API...');
      try {
        const ccResponse = await axios.get('http://localhost:3004/api/picks/pending');
        if (ccResponse.data) {
          const ourPick = ccResponse.data.find((p: any) => p.capper_name === 'griff843');
          if (ourPick) {
            console.log('✅ Pick visible in Command Center!');
            console.log('  - Status:', ourPick.status);
          } else {
            console.log('⚠️ Pick not yet visible in Command Center');
          }
        }
      } catch (ccError) {
        console.log('⚠️ Could not verify Command Center (may need auth)');
      }

      console.log('\n' + '='.repeat(50));
      console.log('📊 TEST SUMMARY:');
      console.log('='.repeat(50));
      console.log('✅ API Submission: Successful');
      console.log(picks && picks.length > 0 ? '✅ Database: Pick stored' : '⚠️ Database: Verification pending');
      console.log('⏳ Command Center: Check manually at http://localhost:3004');
      console.log('⏳ Discord: Check bot logs for thread creation');

    } else {
      console.error('❌ Submission failed with status:', response.status);
    }
  } catch (error: any) {
    console.error('❌ Error submitting pick:', error.response?.data || error.message);

    // Let's check if the API is even running
    try {
      const healthCheck = await axios.get('http://localhost:3002/api/health');
      console.log('API Health:', healthCheck.data);
    } catch (healthError) {
      console.log('⚠️ Smart Form API may not be running properly');
    }
  }
}

// Run the test
testManualPickSubmission().catch(console.error);
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const client = createClient(
  'https://lxqmuzmqtnnlpfapvief.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E'
);

async function insertSimpleHistoricalData() {
  console.log('🚀 Creating simple historical test data for settlement...\n');
  
  // Clear existing data first
  console.log('🧹 Clearing existing data...');
  await client.from('raw_props').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  const testProps = [
    {
      id: uuidv4(),
      player_name: 'Aaron Judge', 
      sport: 'MLB',
      stat_type: 'HR',
      line: 0.5,
      game_date: '2024-09-15',
      outcome: 'win',  // Judge hit 1 HR (actual), over 0.5 = WIN
      external_id: 'test_hr_win_1',
      processed_at: null // Unsettled - for settlement system to process
    },
    {
      id: uuidv4(),
      player_name: 'Mookie Betts',
      sport: 'MLB',
      stat_type: 'H', 
      line: 1.5,
      game_date: '2024-09-15',
      outcome: 'loss', // Betts got 1 hit (actual), under 1.5 = LOSS
      external_id: 'test_hits_loss_1',
      processed_at: null
    },
    {
      id: uuidv4(),
      player_name: 'Shohei Ohtani',
      sport: 'MLB',
      stat_type: 'RBI',
      line: 0.5,
      game_date: '2024-09-15', 
      outcome: 'win',  // Ohtani had 2 RBI (actual), over 0.5 = WIN
      external_id: 'test_rbi_win_1',
      processed_at: null
    },
    {
      id: uuidv4(),
      player_name: 'Ronald Acuna Jr',
      sport: 'MLB',
      stat_type: 'R',
      line: 0.5,
      game_date: '2024-09-15',
      outcome: 'loss', // Acuna scored 0 runs (actual), under 0.5 = LOSS  
      external_id: 'test_runs_loss_1',
      processed_at: null
    },
    {
      id: uuidv4(),
      player_name: 'Vladimir Guerrero Jr',
      sport: 'MLB',
      stat_type: 'TB',
      line: 2.5,
      game_date: '2024-09-15',
      outcome: 'win',  // Vlad Jr had 4 total bases (actual), over 2.5 = WIN
      external_id: 'test_tb_win_1',
      processed_at: null
    }
  ];
  
  console.log('💾 Inserting historical props with known outcomes...');
  const { data, error } = await client
    .from('raw_props')
    .insert(testProps)
    .select('id, player_name, stat_type, outcome, line');
    
  if (error) {
    console.error('❌ Insert failed:', error.message);
    return 0;
  } else {
    console.log('✅ Successfully inserted historical test data:\n');
    data.forEach(prop => {
      console.log(`  ${prop.player_name} ${prop.stat_type} O${prop.line} = ${prop.outcome.toUpperCase()}`);
    });
    
    console.log('\n🎯 Settlement Test Data Ready:');
    console.log('  📊 5 props with known outcomes');
    console.log('  📅 All from 2024-09-15 (completed games)');
    console.log('  ⚾ Mix of wins and losses for testing');
    console.log('  🔧 All unsettled (processed_at = null)');
    
    return data.length;
  }
}

insertSimpleHistoricalData()
  .then((count) => {
    if (count > 0) {
      console.log('\n🚀 Ready to test settlement system with real historical outcomes!');
      console.log('Run: ./start-settlement.sh');
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
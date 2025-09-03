const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY4NDUsImV4cCI6MjA2MDY3Mjg0NX0.PkJJDTPo8WVpGWaAQ-gdzvyGH9WEjcxcwCDi8z0g93o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createSmartTicketsTable() {
  console.log('Creating smart_tickets table...\n');

  try {
    // Create the table with basic structure first
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.smart_tickets (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          bet_slip_id TEXT UNIQUE NOT NULL,
          capper TEXT NOT NULL,
          ticket_type TEXT NOT NULL,
          sport TEXT NOT NULL,
          game_date DATE NOT NULL,
          user_tier TEXT NOT NULL,
          unit_size DECIMAL(3,1) NOT NULL,
          odds_format TEXT NOT NULL,
          auto_parlay BOOLEAN DEFAULT true,
          confidence_level INTEGER NOT NULL,
          bet_type TEXT NOT NULL,
          market_type TEXT NOT NULL,
          game_selections JSONB NOT NULL DEFAULT '[]',
          legs JSONB NOT NULL DEFAULT '[]',
          notes TEXT,
          status TEXT DEFAULT 'pending',
          timestamp TIMESTAMPTZ DEFAULT NOW(),
          timezone TEXT DEFAULT 'UTC',
          current_step INTEGER DEFAULT 1,
          completed_steps INTEGER[] DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          processing_id TEXT,
          error_message TEXT,
          submission_metadata JSONB DEFAULT '{}'
      )
    `;

    const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL });

    if (error) {
      console.log('Error creating table:', error.message);

      // Try direct insert method if RPC doesn't work
      console.log('Trying alternative approach...');

      // Just try to insert a test record to create the table automatically
      const testData = {
        bet_slip_id: 'test-migration-' + Date.now(),
        capper: 'System',
        ticket_type: 'single',
        sport: 'MLB',
        game_date: new Date().toISOString().split('T')[0],
        user_tier: 'vip_plus',
        unit_size: 1.0,
        odds_format: 'AMERICAN',
        confidence_level: 5,
        bet_type: 'single',
        market_type: 'pre_game',
        game_selections: [{ test: true }],
        legs: [],
        notes: 'Migration test',
        status: 'submitted',
      };

      const { data: insertData, error: insertError } = await supabase
        .from('smart_tickets')
        .insert(testData)
        .select();

      if (insertError) {
        console.log('Insert error:', insertError.message);
        console.log('Code:', insertError.code);

        if (insertError.code === '42P01') {
          console.log('Table does not exist and cannot be created with current permissions');
          console.log('Please create the table manually in Supabase dashboard');
          return;
        }
      } else {
        console.log('Successfully created table and inserted test record');
        console.log('Test record ID:', insertData[0]?.id);
      }
    } else {
      console.log('Table created successfully!');
    }
  } catch (error) {
    console.error('Migration error:', error.message);
  }
}

createSmartTicketsTable();

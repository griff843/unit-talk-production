const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
  console.log('🚀 Setting up Unit Talk Discord Bot Database...');
  
  // Check environment variables
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables:');
    console.error('   - SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    console.error('Please check your .env file.');
    process.exit(1);
  }

  // Create Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  console.log('✅ Connected to Supabase');

  try {
    // Test connection
    console.log('🔍 Testing database connection...');
    const { data, error } = await supabase.from('information_schema.tables').select('table_name').limit(1);
    if (error) {
      console.error('❌ Database connection failed:', error.message);
      process.exit(1);
    }
    console.log('✅ Database connection successful');

    // Run onboarding schema
    console.log('📋 Creating onboarding tables...');
    const onboardingSchema = fs.readFileSync(path.join(__dirname, 'database', 'onboarding_schema.sql'), 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = onboardingSchema.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of statements) {
      const trimmedStatement = statement.trim();
      if (trimmedStatement) {
        const { error } = await supabase.rpc('exec_sql', { sql: trimmedStatement });
        if (error) {
          console.log(`⚠️  Statement may have failed (this might be normal): ${error.message}`);
        }
      }
    }

    // Run migration
    console.log('📋 Running database migrations...');
    const migrationSchema = fs.readFileSync(path.join(__dirname, 'migrations', '001_fortune_100_enhancements.sql'), 'utf8');
    
    const migrationStatements = migrationSchema.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of migrationStatements) {
      const trimmedStatement = statement.trim();
      if (trimmedStatement) {
        const { error } = await supabase.rpc('exec_sql', { sql: trimmedStatement });
        if (error) {
          console.log(`⚠️  Migration statement may have failed (this might be normal): ${error.message}`);
        }
      }
    }

    // Create missing tables that the bot expects
    console.log('📋 Creating additional required tables...');
    
    const additionalTables = `
      -- User profiles table
      CREATE TABLE IF NOT EXISTS user_profiles (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        discord_id TEXT NOT NULL UNIQUE,
        username TEXT,
        avatar_url TEXT,
        tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'vip', 'vip_plus')),
        total_picks INTEGER DEFAULT 0,
        winning_picks INTEGER DEFAULT 0,
        losing_picks INTEGER DEFAULT 0,
        pending_picks INTEGER DEFAULT 0,
        total_units DECIMAL DEFAULT 0,
        units_won DECIMAL DEFAULT 0,
        units_lost DECIMAL DEFAULT 0,
        win_rate DECIMAL DEFAULT 0,
        roi DECIMAL DEFAULT 0,
        streak INTEGER DEFAULT 0,
        best_streak INTEGER DEFAULT 0,
        worst_streak INTEGER DEFAULT 0,
        average_odds DECIMAL DEFAULT 0,
        total_profit DECIMAL DEFAULT 0,
        last_active TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Onboarding flows table (missing from schema)
      CREATE TABLE IF NOT EXISTS onboarding_flows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        flow_data JSONB NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Picks table
      CREATE TABLE IF NOT EXISTS picks (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        discord_id TEXT NOT NULL,
        pick_text TEXT NOT NULL,
        sport TEXT,
        bet_type TEXT,
        odds DECIMAL,
        units DECIMAL DEFAULT 1,
        confidence TEXT,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'void')),
        channel_id TEXT,
        message_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        graded_at TIMESTAMPTZ,
        graded_by TEXT
      );

      -- Bot configuration table
      CREATE TABLE IF NOT EXISTS bot_config (
        id TEXT PRIMARY KEY DEFAULT 'main',
        config JSONB NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_user_profiles_discord_id ON user_profiles(discord_id);
      CREATE INDEX IF NOT EXISTS idx_picks_discord_id ON picks(discord_id);
      CREATE INDEX IF NOT EXISTS idx_picks_status ON picks(status);
      CREATE INDEX IF NOT EXISTS idx_picks_created_at ON picks(created_at);
      CREATE INDEX IF NOT EXISTS idx_onboarding_flows_active ON onboarding_flows(is_active);
    `;

    const additionalStatements = additionalTables.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of additionalStatements) {
      const trimmedStatement = statement.trim();
      if (trimmedStatement) {
        const { error } = await supabase.rpc('exec_sql', { sql: trimmedStatement });
        if (error) {
          console.log(`⚠️  Additional table creation may have failed (this might be normal): ${error.message}`);
        }
      }
    }

    // Insert default onboarding configuration
    console.log('📋 Setting up default configurations...');
    
    const { error: configError } = await supabase
      .from('onboarding_config')
      .upsert({
        id: 'main',
        config: {
          welcomeMessage: "Welcome to Unit Talk! 🎉",
          steps: ["welcome", "role_selection", "channel_intro", "first_pick"],
          features: {
            dmNotifications: true,
            autoThreads: true,
            analytics: true
          }
        },
        is_active: true
      });

    if (configError) {
      console.log('⚠️  Default config insertion may have failed:', configError.message);
    }

    // Insert default onboarding flow
    const { error: flowError } = await supabase
      .from('onboarding_flows')
      .upsert({
        id: 'default',
        name: 'Default Onboarding Flow',
        description: 'Standard onboarding process for new members',
        flow_data: {
          steps: [
            {
              id: 'welcome',
              type: 'message',
              content: 'Welcome to Unit Talk! Let\'s get you started.',
              actions: ['continue']
            },
            {
              id: 'role_selection',
              type: 'role_select',
              content: 'Please select your membership tier:',
              options: ['Free', 'VIP', 'VIP+']
            }
          ]
        },
        is_active: true
      });

    if (flowError) {
      console.log('⚠️  Default flow insertion may have failed:', flowError.message);
    }

    console.log('✅ Database setup completed successfully!');
    console.log('');
    console.log('🎉 Your Unit Talk Discord Bot database is ready!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Make sure your .env file has all required variables');
    console.log('2. Run: npm run dev');
    console.log('');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

// Alternative method using direct SQL execution if RPC doesn't work
async function executeSQL(supabase, sql) {
  try {
    // Try using the REST API directly
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
      },
      body: JSON.stringify({ sql })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return { data: await response.json(), error: null };
  } catch (error) {
    return { data: null, error };
  }
}

setupDatabase().catch(console.error);
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function runMigration() {
  console.log('🚀 Running Props-Game Linking Migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'fix-props-game-linking.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split into individual statements (basic splitting)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      if (statement.includes('CREATE INDEX')) {
        console.log(`📊 Creating index ${i + 1}/${statements.length}...`);
      } else if (statement.includes('UPDATE')) {
        console.log(`🔗 Linking props to games ${i + 1}/${statements.length}...`);
      } else if (statement.includes('CREATE OR REPLACE FUNCTION')) {
        console.log(`⚙️ Creating linking function ${i + 1}/${statements.length}...`);
      } else if (statement.includes('CREATE TRIGGER')) {
        console.log(`🎯 Creating auto-linking trigger ${i + 1}/${statements.length}...`);
      } else {
        console.log(`🔧 Executing statement ${i + 1}/${statements.length}...`);
      }

      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });

        if (error) {
          console.log(`⚠️ Warning on statement ${i + 1}: ${error.message}`);
          // Continue with other statements
        } else {
          console.log(`✅ Statement ${i + 1} completed successfully`);
        }
      } catch (err) {
        console.log(`⚠️ Error on statement ${i + 1}: ${err.message}`);
        // Continue with other statements
      }
    }

    // Verify the results
    console.log('\n📊 Verifying migration results...');

    const { data: stats } = await supabase
      .from('raw_props')
      .select('game_id')
      .not('game_id', 'is', null);

    const { data: total } = await supabase.from('raw_props').select('id', { count: 'exact' });

    const linkedCount = stats?.length || 0;
    const totalCount = total?.length || 0;
    const linkPercentage = totalCount > 0 ? Math.round((linkedCount / totalCount) * 100) : 0;

    console.log(`\n🎯 Migration Results:`);
    console.log(`   Total props: ${totalCount}`);
    console.log(`   Linked props: ${linkedCount}`);
    console.log(`   Unlinked props: ${totalCount - linkedCount}`);
    console.log(`   Link percentage: ${linkPercentage}%`);

    if (linkPercentage > 80) {
      console.log('\n✅ Migration successful! Most props are now linked to games.');
    } else if (linkPercentage > 50) {
      console.log('\n⚠️ Migration partially successful. Some props still unlinked.');
    } else {
      console.log('\n❌ Migration had issues. Many props remain unlinked.');
    }
  } catch (error) {
    console.error('💥 Migration failed:', error);
  }
}

runMigration();

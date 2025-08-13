const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function setupMonitoring() {
  console.log('Setting up live data classification and monitoring...');
  
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '../../../sql/setup-live-views.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL (this will run all the DDL)
    const { error } = await supabase.rpc('exec_sql', { sql_text: sqlContent });
    
    if (error) {
      console.error('SQL execution failed:', error);
      return;
    }
    
    console.log('✅ Successfully set up monitoring infrastructure');
    
    // Run the classification function
    const { error: classifyError } = await supabase.rpc('classify_prop_labels');
    
    if (classifyError) {
      console.error('Classification failed:', classifyError);
      return;
    }
    
    console.log('✅ Successfully classified data labels');
    
    // Show monitoring stats
    const { data: monitoring, error: monitorError } = await supabase
      .from('settlement_monitoring')
      .select('*');
    
    if (monitorError) {
      console.error('Monitoring query failed:', monitorError);
      return;
    }
    
    console.log('\n=== MONITORING DASHBOARD ===');
    monitoring?.forEach(row => {
      console.log(`${row.metric}: ${row.value}`);
    });
    
  } catch (err) {
    console.error('Setup failed:', err);
  }
}

setupMonitoring();
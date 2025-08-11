#!/usr/bin/env tsx

import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

async function checkTableStructure() {
  console.log('Checking raw_props table structure...');
  
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  
  try {
    // Get a sample row to see the columns
    const { data, error } = await supabase
      .from('raw_props')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error fetching sample data:', error);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('Available columns:');
      console.log(Object.keys(data[0]).join(', '));
      
      // Check if specific grading columns exist
      const sampleRow = data[0];
      console.log('\nGrading-related columns:');
      console.log('- actual_result:', 'actual_result' in sampleRow ? '✅ exists' : '❌ missing');
      console.log('- actual_value:', 'actual_value' in sampleRow ? '✅ exists' : '❌ missing');
      console.log('- graded_at:', 'graded_at' in sampleRow ? '✅ exists' : '❌ missing');
      console.log('- confidence_score:', 'confidence_score' in sampleRow ? '✅ exists' : '❌ missing');
      console.log('- data_source:', 'data_source' in sampleRow ? '✅ exists' : '❌ missing');
      
      // Count total rows
      const { count } = await supabase
        .from('raw_props')
        .select('id', { count: 'exact', head: true });
      console.log('\nTotal rows in raw_props:', count);
      
    } else {
      console.log('No data found in raw_props table');
    }
  } catch (err) {
    console.error('Failed to check table structure:', err);
  }
}

checkTableStructure();
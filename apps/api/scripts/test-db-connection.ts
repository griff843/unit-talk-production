#!/usr/bin/env tsx

import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

async function testDatabaseConnection() {
  console.log('Testing Supabase connection...');
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
  console.log('SUPABASE_SERVICE_ROLE_KEY exists:', Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY));
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase environment variables');
    return;
  }
  
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { data, error } = await supabase
      .from('raw_props')
      .select('count')
      .limit(1);
    
    console.log('Database test result:', { data, error });
    
    if (error) {
      console.error('Database error:', error);
    } else {
      console.log('✅ Database connection successful');
    }
  } catch (err) {
    console.error('Connection test failed:', err);
  }
}

testDatabaseConnection();
/**
 * Create Database Functions
 * 
 * Applies database functions needed for the settlement pipeline
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

require('dotenv').config({ path: '.env' });

async function createFunctions() {
  console.log('Creating database functions for settlement pipeline...');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : undefined
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Read and execute the function SQL
    const functionPath = path.join(__dirname, '../../sql/functions/select_unsettled_picks_for_grading.sql');
    
    if (fs.existsSync(functionPath)) {
      const functionSQL = fs.readFileSync(functionPath, 'utf8');
      await client.query(functionSQL);
      console.log('✓ Created function: select_unsettled_picks_for_grading');
    } else {
      console.log('⚠ Function file not found:', functionPath);
    }

    console.log('Database functions created successfully');

  } catch (error) {
    console.error('Error creating database functions:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createFunctions();
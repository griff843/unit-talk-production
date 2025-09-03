#!/usr/bin/env tsx

/**
 * Database Connection Test Script
 * Tests the connection to Supabase and checks table status
 */

import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

// Debug environment variables
console.log('Environment check:')
console.log('- NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Found' : 'Missing')
console.log('- NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Found' : 'Missing')
console.log('- SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Found' : 'Missing')
console.log('')

import { testDatabaseConnection, checkRequiredTables, dbOperations } from '../lib/supabase'

async function main() {
  console.log('🔍 Testing database connection...\n')
  
  // Test basic connection
  console.log('1. Testing basic connection...')
  const isConnected = await testDatabaseConnection()
  
  if (!isConnected) {
    console.log('❌ Database connection failed\n')
    console.log('Please check:')
    console.log('- NEXT_PUBLIC_SUPABASE_URL is correct')
    console.log('- SUPABASE_SERVICE_ROLE_KEY is correct')
    console.log('- Supabase project is active')
    return
  }
  
  console.log('✅ Database connection successful\n')
  
  // Check table status
  console.log('2. Checking required tables...')
  const tableStatus = await checkRequiredTables()
  
  console.log('Table Status:')
  Object.entries(tableStatus).forEach(([table, exists]) => {
    console.log(`  ${exists ? '✅' : '❌'} ${table}`)
  })
  
  const allTablesExist = Object.values(tableStatus).every(Boolean)
  
  if (!allTablesExist) {
    console.log('\n⚠️  Some tables are missing. Please run the database schema migration:')
    console.log('Execute the SQL from src/lib/migrations/001_initial_schema.sql in Supabase SQL editor')
    console.log('')
  }
  
  // Test data operations
  console.log('\n3. Testing data operations...')
  
  try {
    const dbStatus = await dbOperations.getDatabaseStatus()
    console.log('Database Status:', dbStatus)
    
    if (dbStatus.connected) {
      console.log('\n4. Testing actual data retrieval...')
      
      const users = await dbOperations.getUsers()
      console.log(`Retrieved ${users.length} users`)
      
      const agents = await dbOperations.getAgents()
      console.log(`Retrieved ${agents.length} agents`)
      
      const securityEvents = await dbOperations.getSecurityEvents(5)
      console.log(`Retrieved ${securityEvents.length} security events`)
      
      const analytics = await dbOperations.getAnalytics()
      console.log('Analytics data retrieved successfully')
      
      console.log('\n✅ All database operations working!')
      
      if (users.length === 0 && agents.length === 0) {
        console.log('\n💡 The database is empty. You may want to:')
        console.log('1. Add some test data')
        console.log('2. Import existing data from your main platform')
        console.log('3. Run in hybrid mode (real DB + mock fallbacks)')
      }
      
    } else {
      console.log('❌ Database not properly connected - will use mock data fallbacks')
    }
    
  } catch (error) {
    console.error('Error during data operations test:', error)
  }
  
  console.log('\n🎉 Database connection test completed!')
}

// Run the test
main().catch((error) => {
  console.error('Test script failed:', error)
  process.exit(1)
})
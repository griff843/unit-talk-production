// src/agents/FeedAgent/optimal-example.ts

/**
 * Example usage of the Optimal API integration
 * 
 * This file demonstrates how to use the fetchOptimalProps function
 * to integrate with the Optimal API feed.
 */

import { fetchOptimalProps, getRateLimitStatus } from './optimal';

async function exampleUsage() {
  try {
    // Check rate limit status before making requests
    const rateLimitStatus = getRateLimitStatus();
    console.log('Rate limit status:', rateLimitStatus);

    if (!rateLimitStatus.canMakeRequest) {
      console.log('Rate limit exceeded, skipping request');
      return;
    }

    // Fetch props for NBA on a specific date
    console.log('Fetching NBA props for 2024-01-15...');
    const nbaProps = await fetchOptimalProps('NBA', '2024-01-15');
    
    console.log(`Received ${nbaProps.length} NBA props`);
    
    // Display first few props as examples
    nbaProps.slice(0, 3).forEach((prop, index) => {
      console.log(`\nProp ${index + 1}:`);
      console.log(`  Player: ${prop.player_name}`);
      console.log(`  Stat Type: ${prop.stat_type}`);
      console.log(`  Line: ${prop.line}`);
      console.log(`  Over Odds: ${prop.over_odds}`);
      console.log(`  Under Odds: ${prop.under_odds}`);
      console.log(`  Team: ${prop.team} vs ${prop.opponent}`);
      console.log(`  Game Time: ${prop.game_time}`);
    });

    // Example of batch fetching for multiple leagues
    const leagues = ['NBA', 'NFL', 'MLB'];
    const date = '2024-01-15';
    
    console.log('\n--- Batch Fetching Example ---');
    
    for (const league of leagues) {
      try {
        // Check rate limit before each request
        const status = getRateLimitStatus();
        if (!status.canMakeRequest) {
          console.log(`Rate limit reached, skipping ${league}`);
          continue;
        }

        console.log(`\nFetching ${league} props...`);
        const props = await fetchOptimalProps(league, date);
        console.log(`${league}: ${props.length} props fetched`);
        
        // Brief delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Failed to fetch ${league} props:`, error);
        // Continue with other leagues even if one fails
      }
    }

  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Environment setup example
function setupEnvironment() {
  console.log('Required environment variables:');
  console.log('- OPTIMAL_API_KEY: Your Optimal API key');
  console.log('- OPTIMAL_API_BASE_URL: Base URL for Optimal API (optional, defaults to https://api.optimal.com)');
  
  const apiKey = process.env['OPTIMAL_API_KEY'];
  const baseUrl = process.env['OPTIMAL_API_BASE_URL'];
  
  if (!apiKey) {
    console.warn('WARNING: OPTIMAL_API_KEY not set. Please set this environment variable.');
  }
  
  if (!baseUrl) {
    console.log('Using default base URL: https://api.optimal.com');
  }
}

// Integration with existing FeedAgent workflow example
async function integrationExample() {
  console.log('\n--- Integration Example ---');
  
  try {
    const league = 'NBA';
    const currentDate = new Date().toISOString().split('T')[0]!; // Today's date

    // Fetch from Optimal API
    const optimalProps = await fetchOptimalProps(league, currentDate);
    
    if (optimalProps.length === 0) {
      console.log('No props from Optimal, would fallback to SGO/OddsAPI');
      return;
    }
    
    console.log(`Successfully fetched ${optimalProps.length} props from Optimal`);
    
    // Here you would typically:
    // 1. Insert props into your database
    // 2. Run them through your grading/analysis pipeline
    // 3. Generate picks and alerts
    
    console.log('Props would now be processed by GradingAgent...');
    
  } catch (error) {
    console.error('Optimal API failed, falling back to other providers:', error);
    // Implement fallback logic here
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  setupEnvironment();
  exampleUsage()
    .then(() => integrationExample())
    .catch(console.error);
}

export { exampleUsage, setupEnvironment, integrationExample };
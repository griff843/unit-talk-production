// src/agents/FeedAgent/optimal-example.ts

/**
 * Example usage of the Optimal API integration
 *
 * This file demonstrates how to use the fetchOptimalProps function
 * to integrate with the Optimal API feed.
 */

import { createClient } from '@supabase/supabase-js';

import { fetchOptimalProps, getRateLimitStatus } from './optimal';
import { dedupePublicProps } from './utils/dedupePublicProps';

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
  console.log(
    '- OPTIMAL_API_BASE_URL: Base URL for Optimal API (optional, defaults to https://api.optimal.com)'
  );

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
    const league = 'MLB'; // Changed from NBA to MLB
    const currentDate = new Date().toISOString().split('T')[0]!; // Today's date

    // Initialize Supabase client
    const supabaseUrl = process.env['SUPABASE_URL']!;
    const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY']!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch from Optimal API
    const optimalProps = await fetchOptimalProps(league, currentDate);

    if (optimalProps.length === 0) {
      console.log('No props from Optimal, would fallback to SGO/OddsAPI');
      return;
    }

    console.log(`Successfully fetched ${optimalProps.length} props from Optimal`);

    // Deduplicate props
    const dedupedProps = await dedupePublicProps(optimalProps, 'Optimal', supabase);
    console.log(`After deduplication: ${dedupedProps.length} props`);

    // Insert into database in chunks to avoid rate limits
    const CHUNK_SIZE = 1000;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < dedupedProps.length; i += CHUNK_SIZE) {
      const chunk = dedupedProps.slice(i, i + CHUNK_SIZE);
      try {
        const { error } = await supabase.from('raw_props').insert(chunk);

        if (error) {
          console.error(`Error inserting chunk ${i / CHUNK_SIZE + 1}:`, error);
          errors++;
        } else {
          inserted += chunk.length;
          console.log(`Inserted chunk ${i / CHUNK_SIZE + 1}: ${chunk.length} props`);
        }

        // Brief delay between chunks
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to insert chunk ${i / CHUNK_SIZE + 1}:`, error);
        errors++;
      }
    }

    console.log(`\nDatabase insertion complete:`);
    console.log(`- Total props: ${dedupedProps.length}`);
    console.log(`- Inserted: ${inserted}`);
    console.log(`- Failed chunks: ${errors}`);
  } catch (error) {
    console.error('Optimal API failed:', error);
  }
}

// Run both examples
async function run() {
  await exampleUsage();
  await integrationExample();
}

run().catch(console.error);
export { exampleUsage, setupEnvironment, integrationExample };

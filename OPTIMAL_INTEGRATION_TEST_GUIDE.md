# Optimal API Integration Test Setup

This guide will help you set up and test the Optimal API integration with the Unit Talk platform.

## Prerequisites

1. **Environment Variables**: Ensure you have the following environment variables set in your `.env` file:

```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Optimal API Configuration
OPTIMAL_API_KEY=your_optimal_api_key
OPTIMAL_API_BASE_URL=https://api.optimal.com  # Optional, defaults to this URL
```

2. **Database Setup**: Ensure your Supabase database has the `raw_props` table properly configured.

3. **Dependencies**: Make sure all npm dependencies are installed:
```bash
npm install
```

## Running the Test

### Option 1: Using npm script (Recommended)
```bash
npm run agents:optimal
```

### Option 2: Direct execution
```bash
npx tsx src/runner/optimalIngestionTest.ts
```

## What the Test Does

1. **Environment Check**: Verifies all required environment variables are set
2. **Rate Limit Check**: Tests the Optimal API rate limit status
3. **Initial State**: Checks the current number of props in the `raw_props` table
4. **Ingestion Process**: Runs the IngestionAgent with Optimal provider configuration
5. **Results Analysis**: Compares before/after prop counts and shows recent props
6. **Cleanup**: Properly stops the agent and cleans up resources

## Expected Output

```
🚀 Starting Optimal API Ingestion Test
=====================================

✅ Environment variables loaded successfully
📊 Supabase URL: https://your-project.supabase.co
🔑 Optimal API Key: sk_test_...

1️⃣ Checking initial state...
📊 Raw props count (before ingestion): 1250

2️⃣ Testing Optimal API rate limit...
🚦 Optimal API Rate Limit Status:
  Requests in window: 5/900
  Can make request: ✅
  Window: 60 minutes

3️⃣ Creating IngestionAgent with Optimal provider...
4️⃣ Starting ingestion process...
[IngestionAgent] Fetching NBA props from Optimal for 2024-01-15
[IngestionAgent] Fetched 45 NBA props from Optimal
[IngestionAgent] Fetching NFL props from Optimal for 2024-01-15
[IngestionAgent] Fetched 23 NFL props from Optimal
[IngestionAgent] Total props fetched from Optimal: 68
✅ Ingestion completed in 3247ms

5️⃣ Checking final state...
📊 Raw props count (after ingestion): 1318

📈 Results:
  Initial props: 1250
  Final props: 1318
  New props added: 68

🎉 SUCCESS: Props were successfully ingested from Optimal API!

📋 Recent 10 props:
  1. LeBron James - PTS 27.5 (Optimal) [NBA]
  2. Stephen Curry - 3PM 4.5 (Optimal) [NBA]
  3. Josh Allen - PASS_YDS 275.5 (Optimal) [NFL]
  ...

✅ Test completed successfully
```

## Troubleshooting

### No Props Added
If no new props are added, check:
- **API Key**: Ensure your Optimal API key is valid and has sufficient quota
- **Rate Limits**: Check if you've exceeded the API rate limits
- **Date/League**: Optimal might not have props for the current date/leagues
- **Duplicates**: Props might be filtered out as duplicates

### API Errors
- **401 Unauthorized**: Check your `OPTIMAL_API_KEY`
- **429 Rate Limited**: Wait for the rate limit window to reset
- **500 Server Error**: Optimal API might be experiencing issues

### Database Errors
- **Connection Issues**: Verify your Supabase credentials
- **Permission Errors**: Ensure your service role key has write access to `raw_props`
- **Schema Issues**: Check that the `raw_props` table schema matches expectations

## Configuration Options

You can modify the test configuration in `src/runner/optimalIngestionTest.ts`:

```typescript
// Modify leagues to fetch
const leagues = ['NBA', 'NFL', 'MLB', 'NHL']; // Add/remove leagues

// Adjust batch size
batchSize: 50, // Reduce for testing

// Modify rate limits
rateLimit: {
  requests: 900,
  window: 3600000 // 1 hour
}
```

## Next Steps

After successful testing:

1. **Production Configuration**: Update your production environment variables
2. **Scheduling**: Set up cron jobs or Temporal workflows to run ingestion regularly
3. **Monitoring**: Add monitoring and alerting for ingestion failures
4. **Scaling**: Consider implementing multiple provider fallbacks

## Support

If you encounter issues:
1. Check the console output for detailed error messages
2. Verify all environment variables are correctly set
3. Test your Supabase connection independently
4. Check the Optimal API documentation for any changes
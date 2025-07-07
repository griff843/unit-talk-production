# Optimal API Feed Integration

This document describes the implementation of the Optimal API feed integration for the Unit Talk platform.

## Overview

The Optimal API integration provides a new feed source for sports betting props, implementing batch fetching, normalization, and rate limiting according to the business requirements.

## Files Created

- `src/agents/FeedAgent/optimal.ts` - Main integration file
- `src/agents/FeedAgent/optimal.test.ts` - Comprehensive test suite
- `src/agents/FeedAgent/optimal-example.ts` - Usage examples
- `config/optimal.env.example` - Environment configuration template

## Key Features

### 1. Batch Fetching
- Single API call per league/date combination
- Efficient data retrieval using `/v1/props?league={league}&date={date}`
- Never makes per-game, per-market, or per-player calls

### 2. Prop Type Mapping
- Uses `/v1/playerPropTypes` endpoint for mapping
- Caches prop type mappings for 1 hour
- Maps `api_key` to `stat_type`, `display_name` to `label`, `abbreviation` to `abbr`
- Fallback to `api_key` if display names are missing

### 3. Rate Limiting
- Respects 900 requests/hour limit on trial plan
- Built-in request tracking and validation
- Throws errors when rate limit is exceeded
- Utility functions to check rate limit status

### 4. Data Normalization
- Maps Optimal fields to internal `RawProp` structure
- Handles all required fields: `player_id`, `player_name`, `stat_type`, `label`, `abbr`, `line`, `odds`, `bookmaker`, `start_time`
- Preserves additional fields for flexibility

### 5. Error Handling & Logging
- Comprehensive logging for every API call
- Logs league, date, and number of props returned
- Warning for zero props (allows fallback to other feeds)
- Detailed error messages for debugging

### 6. Deduplication
- Removes duplicate props based on unique identifiers
- Uses player name, stat type, line, and bookmaker as key
- Logs number of duplicates removed

## Usage

### Basic Usage

```typescript
import { fetchOptimalProps } from './src/agents/FeedAgent/optimal';

// Fetch props for NBA on a specific date
const props = await fetchOptimalProps('NBA', '2024-01-15');
console.log(`Fetched ${props.length} props`);
```

### Batch Fetching

```typescript
const leagues = ['NBA', 'NFL', 'MLB'];
const date = '2024-01-15';

for (const league of leagues) {
  try {
    const props = await fetchOptimalProps(league, date);
    console.log(`${league}: ${props.length} props`);
  } catch (error) {
    console.error(`Failed to fetch ${league}:`, error);
    // Continue with other leagues
  }
}
```

### Rate Limit Checking

```typescript
import { getRateLimitStatus } from './src/agents/FeedAgent/optimal';

const status = getRateLimitStatus();
if (status.canMakeRequest) {
  // Safe to make request
  const props = await fetchOptimalProps('NBA', '2024-01-15');
} else {
  console.log('Rate limit exceeded, waiting...');
}
```

## Environment Configuration

Create a `.env` file with the following variables:

```bash
# Required
OPTIMAL_API_KEY=your_optimal_api_key_here

# Optional (defaults to https://api.optimal.com)
OPTIMAL_API_BASE_URL=https://api.optimal.com
```

## Integration with Existing System

The Optimal integration is designed to work seamlessly with the existing FeedAgent workflow:

1. **Provider Addition**: Added 'Optimal' to the `ProviderSchema` enum
2. **Type Compatibility**: Returns `RawProp[]` compatible with existing processing
3. **Error Handling**: Allows fallback to SGO/OddsAPI when Optimal fails
4. **Logging**: Uses consistent logging format with existing agents

## API Response Structure

### Props Response
```typescript
interface OptimalPropsResponse {
  props: OptimalProp[];
  total: number;
  page: number;
  per_page: number;
}
```

### Prop Type Response
```typescript
interface OptimalPlayerPropTypesResponse {
  prop_types: OptimalPlayerPropType[];
}
```

## Testing

Run the test suite:

```bash
npm test src/agents/FeedAgent/optimal.test.ts
```

The test suite covers:
- Successful prop fetching and normalization
- Empty response handling
- API error handling
- Rate limiting
- Deduplication logic
- Environment variable validation

## Rate Limiting Details

- **Limit**: 900 requests per hour (trial plan)
- **Window**: Rolling 1-hour window
- **Tracking**: In-memory request queue
- **Behavior**: Throws error when limit exceeded
- **Utilities**: `getRateLimitStatus()` for monitoring

## Error Scenarios

1. **Missing API Key**: Throws error immediately
2. **Rate Limit Exceeded**: Throws error with wait time
3. **HTTP Errors**: Throws error with status code
4. **Zero Props**: Logs warning, returns empty array
5. **Network Errors**: Throws error, allows fallback

## Performance Considerations

- **Caching**: Prop type mappings cached for 1 hour
- **Batch Processing**: Single call per league/date
- **Memory Usage**: Rate limit queue cleaned automatically
- **Response Time**: Typical response under 2 seconds

## Future Enhancements

1. **Persistent Rate Limiting**: Use Redis for multi-instance deployments
2. **Advanced Caching**: Cache prop data for short periods
3. **Retry Logic**: Implement exponential backoff for failed requests
4. **Metrics**: Add Prometheus metrics for monitoring
5. **Webhooks**: Support real-time prop updates if available

## Troubleshooting

### Common Issues

1. **Rate Limit Errors**: Check `getRateLimitStatus()` and wait
2. **Empty Results**: Verify league name and date format
3. **Authentication**: Ensure `OPTIMAL_API_KEY` is set correctly
4. **Network Issues**: Check `OPTIMAL_API_BASE_URL` configuration

### Debug Logging

Enable debug logging to see detailed API interactions:

```typescript
// Set log level in your configuration
process.env.LOG_LEVEL = 'debug';
```

## Support

For issues with the Optimal API integration:

1. Check the test suite for expected behavior
2. Review the example file for usage patterns
3. Verify environment configuration
4. Check rate limit status before requests
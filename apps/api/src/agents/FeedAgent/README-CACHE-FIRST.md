# Cache-First FeedAgent Refactoring

This document outlines the comprehensive refactoring of the FeedAgent to use cache-first architecture with direct unified_picks writes.

## 🚀 Key Changes

### Architecture Overview

The FeedAgent has been refactored from a raw_props-based system to a cache-first unified_picks system:

```
OLD: Providers → raw_props → Processing → unified_picks
NEW: CachedProviders → Redis Cache → unified_picks (direct)
```

### Major Components Added

1. **CacheFirstUnifiedPicksService** - L1/L2/L3 cache hierarchy
2. **CachedOddsApiClient** - Redis-first provider calls
3. **FeatureFlagService** - Shadow mode and rollout control
4. **CLI Arguments** - Runtime configuration
5. **Credit Usage Tracking** - Monitoring and cost control

## 📋 Features

### Cache-First Architecture

- **L1 Cache**: In-memory cache (30 seconds TTL)
- **L2 Cache**: Redis cache (5 minutes TTL)
- **L3 Cache**: Database (unified_picks table)
- **Circuit Breaker**: Automatic failover on errors
- **Cache Warmup**: Pre-populate frequently accessed data

### Direct Unified Picks Writes

```typescript
// OLD: Write to raw_props, then process to unified_picks
await supabase.from('sports_game_odds').insert(rawProps);

// NEW: Direct unified_picks writes with cache coordination
await unifiedPicksService.createPick(unifiedPick);
```

### CLI Configuration

```bash
# Basic usage
npm run feed-agent

# With configuration
npm run feed-agent --sports=NFL,NBA --rate=500 --batch=50

# Verbose logging
npm run feed-agent --verbose --cache --sports=MLB

# Dry run testing
npm run feed-agent --dry-run --sports=NFL,NBA,MLB,NHL
```

### Feature Flags & Shadow Mode

```bash
# Enable shadow mode (compare old vs new)
FEED_AGENT_SHADOW_MODE=true npm run feed-agent --verbose

# Gradual rollout (50% of requests)
FEED_AGENT_ROLLOUT_PERCENTAGE=50 npm run feed-agent

# Specific sports only
FEED_AGENT_ENABLED_SPORTS=NFL,NBA npm run feed-agent

# Disable cache-first (fallback to legacy)
FEED_AGENT_CACHE_FIRST=false npm run feed-agent
```

## 🎯 Performance Improvements

### Response Times

- **Cache Hit**: <100ms response time
- **Cache Miss**: <2000ms (includes API call)
- **Hit Ratio Target**: >90%

### Credit Usage Optimization

- **Cache Hits**: 0 API credits used
- **Deduplication**: Prevents redundant API calls
- **Batch Processing**: Efficient database writes

### Monitoring & Metrics

- Real-time cache performance tracking
- Credit usage monitoring per provider
- Shadow mode comparison logging
- Processing time optimization

## 🔧 Implementation Details

### Workflow Integration

Each unified pick includes workflow metadata:

```typescript
{
  workflowStage: 'ingested',
  status: 'pending',
  processingPriority: 1,
  batchId: 'batch_1695656789_abc123',
  groupKey: 'NFL_PatrickMahomes_PassingYards_batch_abc123'
}
```

### Deduplication Strategy

1. **In-Batch Deduplication**: Remove duplicates within current processing batch
2. **Database Deduplication**: Check against existing unified_picks
3. **Cache Coordination**: Leverage cache for fast duplicate detection

### Error Handling & Resilience

- **Circuit Breaker**: Automatic failover when Redis is unavailable
- **Graceful Degradation**: Falls back to direct database operations
- **Retry Logic**: Exponential backoff for failed operations
- **Shadow Mode**: Compare approaches without impacting production

## 📊 Monitoring & Observability

### Cache Metrics

```typescript
{
  l1Hits: 150,        // In-memory cache hits
  l2Hits: 75,         // Redis cache hits
  l3Hits: 25,         // Database hits
  misses: 10,         // Total misses
  hitRatio: 92.3,     // Overall hit percentage
  avgResponseTime: 85 // Average response time (ms)
}
```

### Credit Usage Tracking

```typescript
{
  oddsApi: { used: 250, remaining: 750 },
  sgo: { status: 'Active - API calls tracked' },
  optimal: { status: 'API key expired - needs renewal' }
}
```

### Shadow Mode Comparisons

```typescript
{
  sport: 'NFL',
  newApproach: { count: 1250, fromCache: true, creditUsed: 0 },
  legacyApproach: { count: 1248, creditUsed: 1 },
  difference: { percentage: 0.16 }
}
```

## 🚦 Rollout Strategy

### Phase 1: Shadow Mode (0% Impact)

```bash
FEED_AGENT_SHADOW_MODE=true
FEED_AGENT_ROLLOUT_PERCENTAGE=0
```

- Run both approaches in parallel
- Compare results and log differences
- Validate cache performance
- No production impact

### Phase 2: Canary (10% Traffic)

```bash
FEED_AGENT_ROLLOUT_PERCENTAGE=10
FEED_AGENT_ENABLED_SPORTS=NFL
```

- Process 10% of requests with new approach
- Monitor for errors and performance issues
- Start with single sport (NFL)
- Easy rollback if issues occur

### Phase 3: Gradual Rollout (50% Traffic)

```bash
FEED_AGENT_ROLLOUT_PERCENTAGE=50
FEED_AGENT_ENABLED_SPORTS=NFL,NBA,MLB
```

- Expand to 50% of traffic
- Add more sports to rollout
- Monitor cache hit ratios
- Validate credit usage savings

### Phase 4: Full Rollout (100% Traffic)

```bash
FEED_AGENT_ROLLOUT_PERCENTAGE=100
FEED_AGENT_ENABLED_SPORTS=NFL,NBA,MLB,NHL,NCAAF
```

- Process all requests with new approach
- Disable shadow mode comparisons
- Monitor for sustained performance
- Celebrate success! 🎉

## 🛠️ Usage Examples

### Basic Development Testing

```bash
# Test with dry run
npx tsx src/runner/runCacheFirstFeedAgent.ts --dry-run --verbose

# Test specific sport
npx tsx src/runner/runCacheFirstFeedAgent.ts --sports=NFL --batch=10

# Test with shadow mode
FEED_AGENT_SHADOW_MODE=true npx tsx src/runner/runCacheFirstFeedAgent.ts --verbose
```

### Production Deployment

```bash
# Canary deployment
FEED_AGENT_ROLLOUT_PERCENTAGE=10 \
FEED_AGENT_ENABLED_SPORTS=NFL \
npm run feed-agent --sports=NFL --rate=1000

# Full deployment
FEED_AGENT_CACHE_FIRST=true \
FEED_AGENT_ROLLOUT_PERCENTAGE=100 \
npm run feed-agent --sports=NFL,NBA,MLB,NHL --rate=2000 --batch=200
```

### Emergency Rollback

```bash
# Disable new features immediately
FEED_AGENT_CACHE_FIRST=false \
FEED_AGENT_UNIFIED_PICKS_DIRECT=false \
FEED_AGENT_ROLLOUT_PERCENTAGE=0 \
npm run feed-agent
```

## 🔍 Troubleshooting

### Common Issues

1. **Redis Connection Failures**
   - System automatically falls back to memory cache
   - Check Redis connection with health check endpoint

2. **Cache Hit Ratio Low (<50%)**
   - Review cache TTL configuration
   - Check for cache invalidation patterns
   - Monitor cache warmup effectiveness

3. **Credit Usage Higher Than Expected**
   - Verify cache-first feature flag is enabled
   - Check deduplication logic
   - Review provider routing strategy

4. **Shadow Mode Differences**
   - Compare data sources and timing
   - Check for API rate limiting
   - Validate provider fallback logic

### Health Check Endpoints

```bash
# Overall agent health
curl http://localhost:3000/health/agents/feed

# Cache service health
curl http://localhost:3000/health/cache-service

# Credit usage status
curl http://localhost:3000/health/api-credits
```

## 📈 Expected Benefits

### Performance

- **90%+ Cache Hit Ratio**: Sub-100ms response times
- **60% Reduction in API Calls**: Significant credit savings
- **3x Faster Processing**: Batch operations with cache coordination

### Cost Optimization

- **Reduced API Credits**: Cache hits use zero credits
- **Better Resource Utilization**: Efficient Redis and database usage
- **Lower Operational Costs**: Fewer provider API calls

### Reliability

- **Circuit Breaker Protection**: Automatic failover on errors
- **Graceful Degradation**: System continues operating during failures
- **Comprehensive Monitoring**: Proactive issue detection

### Developer Experience

- **Feature Flags**: Safe rollout and testing
- **CLI Configuration**: Easy testing and debugging
- **Shadow Mode**: Compare approaches safely
- **Rich Logging**: Detailed performance insights

## 🎉 Conclusion

The cache-first FeedAgent refactoring delivers significant performance improvements while maintaining backward compatibility and providing safe rollout mechanisms. The new architecture reduces API costs, improves response times, and provides better monitoring and observability.

Key architectural improvements:
- ✅ Cache-first unified_picks writes
- ✅ Redis coordination and circuit breaker
- ✅ Feature flags and shadow mode testing
- ✅ CLI configuration and monitoring
- ✅ Credit usage tracking and optimization
- ✅ Comprehensive error handling and resilience

The system is production-ready with built-in rollback mechanisms and extensive monitoring capabilities.
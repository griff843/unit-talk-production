# Pipeline Monitoring Cards Documentation

This directory contains React components for the Unit Talk Command Center pipeline monitoring system. Each card provides real-time operational visibility into different aspects of the data processing pipeline.

## Component Overview

### Architecture Pattern

All monitoring cards follow a consistent architectural pattern:

```
Card Component
├── React Hook (30s auto-refresh)
│   ├── API Endpoint (Server-side authentication)
│   └── PostgreSQL View (Real-time data)
├── Loading States (Professional indicators)
├── Error Handling (Retry logic with exponential backoff)
└── Interactive Features (Filtering, actions)
```

### Common Features

- **30-Second Auto-Refresh**: All cards update automatically every 30 seconds
- **Intelligent Error Handling**: Exponential backoff retry with 3 maximum attempts
- **Professional Loading States**: Skeleton loading with smooth transitions
- **AbortController**: Request cancellation for efficient resource management
- **Contextual Styling**: Dynamic styling based on data state and health indicators

## Components

### 1. PipelineLagCard

**File**: `PipelineLagCard.tsx`  
**Hook**: `usePipelineLag.ts`  
**API**: `GET /api/pipeline/lag`  
**Data Source**: Materialized view `mv_pipeline_lag_24h`

**Purpose**: Monitors promotion processing lag metrics with p50/p95 percentiles.

**Features**:
- Sport-specific filtering (NFL, NBA, MLB, NHL, etc.)
- p50 and p95 lag time visualization
- Total promotions count tracking
- Interactive charts with threshold reference lines
- Health status indicators (healthy/warning/critical)

**Key Metrics**:
- p50 lag time (median processing time)
- p95 lag time (95th percentile processing time)
- Total promotions processed in 24h
- Average processing time

**Usage**:
```tsx
import { PipelineLagCard } from '@/components/cards/PipelineLagCard';

<PipelineLagCard />
```

### 2. UnifiedPicksHealthCard

**File**: `UnifiedPicksHealthCard.tsx`  
**Hook**: `useUnifiedPicksHealth.ts`  
**API**: `GET /api/pipeline/health/summary`  
**Data Source**: PostgreSQL view `v_unified_picks_health_24h`

**Purpose**: Comprehensive health monitoring for the unified picks processing system.

**Features**:
- Total, System, and Manual pick counts (24h)
- Writer audit percentage tracking (target: 100%)
- Alert badges for data quality issues
- Health status indicators with contextual styling
- Real-time data integrity monitoring

**Key Metrics**:
- Total picks processed (24h)
- System vs Manual pick breakdown
- Duplicate fingerprint detection
- Missing prop ID alerts
- Writer GradingAgent audit percentage

**Alert Conditions**:
- `dup_fingerprints_24h > 0`: Duplicate detection alert
- `system_rows_missing_prop_id_24h > 0`: Data integrity alert
- `writer_gradingagent_pct < 100%`: Writer audit alert

**Usage**:
```tsx
import UnifiedPicksHealthCard from '@/components/dashboard/UnifiedPicksHealthCard';

<UnifiedPicksHealthCard />
```

### 3. PromoBacklogCard

**File**: `PromoBacklogCard.tsx`  
**Hook**: `usePromoBacklog.ts`  
**API**: `GET /api/pipeline/promo-backlog`  
**Data Source**: PostgreSQL view `v_promo_backlog`

**Purpose**: Interactive management of the promotion processing backlog.

**Features**:
- Interactive table with sport and tier filtering
- Copy-ID functionality for operational efficiency
- Processing time indicators with relative timestamps
- Backlog status management (normal/moderate/high)
- Real-time backlog monitoring

**Key Metrics**:
- Total items in backlog
- Processing time per item
- Sport and tier distribution
- Status classification

**Interactive Features**:
- Sport filtering dropdown (All, NFL, NBA, MLB, etc.)
- Tier filtering dropdown (All, A, B, C)
- Copy-to-clipboard for pick IDs
- Sortable columns

**Usage**:
```tsx
import PromoBacklogCard from '@/components/cards/PromoBacklogCard';

<PromoBacklogCard />
```

### 4. RecentPromotionsCard

**File**: `RecentPromotionsCard.tsx`  
**Hook**: `useRecentPromotions.ts`  
**API**: `GET /api/pipeline/recent-promotions`  
**Data Source**: PostgreSQL view `v_recent_promotions_24h`

**Purpose**: Tracking and analysis of recently processed promotions.

**Features**:
- Comprehensive promotion tracking with success rate metrics
- Detailed table with pick source, sport, selection, and odds
- Promotion status badges (promoted/pending/failed)
- Game start time and processing time tracking
- Performance analytics

**Key Metrics**:
- Total promotions (24h)
- Success rate percentage
- Average processing time
- Promotion status distribution

**Status Indicators**:
- **Promoted**: Successfully processed and promoted
- **Pending**: Currently in processing queue
- **Failed**: Failed validation or processing

**Usage**:
```tsx
import RecentPromotionsCard from '@/components/cards/RecentPromotionsCard';

<RecentPromotionsCard />
```

## Shared Utilities and Hooks

### Common Hook Pattern

All monitoring hooks follow this pattern:

```typescript
interface UseMonitoringHookReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const POLLING_INTERVAL = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

export function useMonitoringHook<T>(): UseMonitoringHookReturn<T> {
  // Implementation with:
  // - 30s polling with cleanup
  // - AbortController for cancellation
  // - Exponential backoff retry logic
  // - Structured error handling
}
```

### Error Handling Strategy

```typescript
// Retry Logic with Exponential Backoff
if (retryCount < MAX_RETRIES) {
  retryCount += 1;
  setTimeout(() => {
    fetchData(true); // isRetry = true
  }, RETRY_DELAY * retryCount);
  return;
}
```

### Loading State Management

```typescript
// Professional Loading States
if (loading && !data) {
  return (
    <Card>
      <CardHeader>/* Header with spinning icon */</CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="h-4 w-24 animate-pulse rounded bg-muted"></div>
          <div className="grid grid-cols-2 gap-4">
            {/* Skeleton loading placeholders */}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

## Dashboard Integration

### Grid Layout

The monitoring cards are integrated into the main dashboard using a responsive grid system:

```tsx
// Pipeline Monitoring Cards
<div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-2 mb-6">
  <PipelineLagCard />
  <UnifiedPicksHealthCard />
</div>

// Additional Pipeline Views
<div className="grid gap-6 lg:grid-cols-1 xl:grid-cols-2 mb-6">
  <PromoBacklogCard />
  <RecentPromotionsCard />
</div>
```

### Real-time Updates

All cards automatically refresh every 30 seconds without requiring user interaction:

```typescript
// Automatic polling setup in useEffect
useEffect(() => {
  // Initial fetch
  fetchData();

  // Setup polling interval
  const startPolling = () => {
    timeoutRef.current = setTimeout(() => {
      fetchData().finally(() => {
        startPolling(); // Continue polling
      });
    }, POLLING_INTERVAL);
  };

  startPolling();

  // Cleanup on unmount
  return () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };
}, [fetchData]);
```

## Performance Considerations

### Optimization Strategies

1. **Request Cancellation**: AbortController prevents overlapping requests
2. **Efficient Re-rendering**: React.memo and useMemo for expensive computations
3. **Intelligent Polling**: Adapts to network conditions and errors
4. **Server-side Caching**: 30-second cache headers reduce database load

### Resource Management

```typescript
// Efficient cleanup and resource management
const abortControllerRef = useRef<AbortController | null>(null);
const timeoutRef = useRef<NodeJS.Timeout | null>(null);

// Cancel existing requests before new ones
if (abortControllerRef.current) {
  abortControllerRef.current.abort();
}

abortControllerRef.current = new AbortController();
```

### Memory Management

- Proper cleanup of timeouts and intervals
- AbortController cancellation prevents memory leaks
- Efficient state updates to minimize re-renders

## Testing Strategy

### Unit Testing

Each card component should have comprehensive unit tests:

```typescript
describe('PipelineLagCard', () => {
  it('displays loading state correctly', () => {
    // Test loading skeleton
  });

  it('handles error states gracefully', () => {
    // Test error display and retry functionality
  });

  it('displays data correctly when loaded', () => {
    // Test data rendering and formatting
  });

  it('handles empty data states', () => {
    // Test empty state display
  });
});
```

### Integration Testing

Hook integration tests ensure proper API communication:

```typescript
describe('usePipelineLag', () => {
  it('fetches data on mount', async () => {
    // Test initial data fetch
  });

  it('polls data every 30 seconds', async () => {
    // Test polling interval
  });

  it('handles API errors with retry', async () => {
    // Test retry logic
  });

  it('cancels requests on unmount', () => {
    // Test cleanup
  });
});
```

## Future Enhancements

### Planned Features

1. **Real-time WebSocket Updates**: Migrate from polling to push-based updates
2. **Advanced Filtering**: More granular filtering options
3. **Historical Data Views**: Time-series charts for trend analysis
4. **Export Functionality**: CSV/JSON export for operational data
5. **Custom Alerts**: User-defined alert thresholds
6. **Mobile Optimization**: Enhanced mobile responsiveness

### Performance Improvements

1. **GraphQL Migration**: More efficient data fetching
2. **Service Worker Caching**: Offline capability and faster loading
3. **Virtual Scrolling**: Handle large datasets efficiently
4. **Progressive Loading**: Load critical data first

## Troubleshooting

### Common Issues

1. **No Data Displayed**: Check PostgreSQL view availability
2. **Slow Loading**: Verify database query performance
3. **Polling Stopped**: Check for JavaScript errors in console
4. **Stale Data**: Verify API endpoint caching headers

### Debug Commands

```bash
# Test API endpoints
curl http://localhost:3004/api/pipeline/health/summary
curl http://localhost:3004/api/pipeline/promo-backlog
curl http://localhost:3004/api/pipeline/recent-promotions
curl http://localhost:3004/api/pipeline/lag

# Check PostgreSQL views
docker-compose exec postgres psql -U postgres -d unit_talk_production -c "\dv"

# Monitor network requests
# Use browser dev tools Network tab
```

---

**Component Documentation Owner**: Frontend Development Team  
**Last Updated**: January 2025  
**Next Review**: Monthly component review
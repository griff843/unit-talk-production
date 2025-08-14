# Command Center Technical Overview

## Health Endpoint Unification

### Overview

The Command Center implements a unified health tiles system that provides canonical health metrics through a consistent API interface. This system replaces fragmented health data endpoints with a single, reliable source of truth.

### Architecture

#### Canonical Health Service (`src/server/health.ts`)

The core health service provides a unified interface for health metrics:

```typescript
interface CanonicalHealthTiles {
  feedFreshnessSeconds: number;
  temporalBacklogAgeSeconds: number;
  canaryLastSeenAt: string | null;
  failureBurnRateLevel: 'green' | 'yellow' | 'red' | 'unknown';
  providerCreditsPerMin: number | null;
  providerPctDailyBudget: number | null;
  dlqCount: number;
  source: 'live' | 'fallback';
  timestamp: string;
}
```

**Key Features:**
- **Graceful Degradation**: Automatically falls back to safe default values when live data is unavailable
- **Consistent Schema**: Single, well-defined interface for all health metrics
- **Source Transparency**: Clearly indicates whether data is live or fallback
- **Timestamp Tracking**: Provides data freshness information

#### API Endpoints

**Canonical Endpoint**: `/api/ops/health/tiles`
- Returns current canonical health tiles format
- Always returns HTTP 200 with valid data structure
- Includes fallback logic for service resilience

**Legacy Adapter**: `/api/pipeline/tiles`
- Provides backward compatibility during migration period
- Includes deprecation headers: `X-Deprecation: Use /api/ops/health/tiles by 2025-09-30`
- Maps canonical format to legacy field names (`providerPctDailyBudget` → `percentOfDailyBudget`)

#### Frontend Integration

**React Query Hook**: `src/lib/hooks/useHealthTiles.ts`

```typescript
export function useHealthTiles() {
  return useQuery<CanonicalHealthTiles>({
    queryKey: ['health', 'tiles'],
    queryFn: async () => { /* fetch logic */ },
    refetchInterval: 10000, // 10 second polling
    retry: 3,
    placeholderData: (previousData) => previousData,
  })
}
```

**Helper Functions:**
- `useHealthTileStatus()`: Converts raw metrics to status levels (healthy/warning/critical)
- `useFormattedHealthTiles()`: Formats values for display (durations, percentages, etc.)
- `getHealthStatusColor()`: Returns appropriate CSS classes for status indicators
- `getHealthTooltips()`: Provides threshold explanations for user interface

#### Health Tile Component

The `HealthTilesCard` component has been fully refactored to use the new unified system:

**Key Improvements:**
- Uses React Query for data fetching with automatic retries and caching
- Shows live/fallback source badges with tooltips
- Displays loading and error states appropriately  
- Provides hover tooltips explaining threshold values
- Maintains existing test IDs for E2E test compatibility

### Health Metrics & Thresholds

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Feed Freshness | < 5 minutes | < 30 minutes | ≥ 30 minutes |
| Temporal Backlog | < 5 minutes | < 30 minutes | ≥ 30 minutes |
| Canary Heartbeat | < 5 minutes | < 15 minutes | ≥ 15 minutes |
| Failure Burn Rate | Green (≤0.2) | Yellow (≤0.5) | Red (>0.5) |
| Provider Budget | < 50% | < 80% | ≥ 80% |
| Dead Letter Queue | 0 items | < 10 items | ≥ 10 items |

### Data Flow

```
Live Data Sources → getCanonicalHealthTiles() → API Endpoints → React Query → UI Components
                     ↓ (on failure)
                  Fallback Data → Safe Defaults
```

1. **Data Collection**: Health service attempts to gather live metrics from various sources
2. **Fallback Logic**: If live data is unavailable, returns safe default values
3. **API Layer**: Endpoints serve data with appropriate caching headers
4. **Frontend Consumption**: React Query hook manages caching, polling, and error handling
5. **UI Rendering**: Components display formatted data with status indicators

### Migration Strategy

**Phase 1**: Canonical Implementation (✅ Complete)
- Implemented `getCanonicalHealthTiles()` service
- Created new `/api/ops/health/tiles` endpoint  
- Built React Query integration

**Phase 2**: Legacy Compatibility (✅ Complete)
- Created `/api/pipeline/tiles` legacy adapter
- Added deprecation headers
- Maintained backward compatibility

**Phase 3**: Frontend Migration (✅ Complete)
- Refactored `HealthTilesCard` component
- Integrated React Query hook
- Added source badges and tooltips

**Phase 4**: Testing & Documentation (✅ Complete)
- Comprehensive test suite covering API, unit, and E2E scenarios
- Technical documentation
- Migration guide

**Phase 5**: Deprecation (Scheduled: 2025-09-30)**
- Remove legacy `/api/pipeline/tiles` endpoint
- Clean up legacy adapter code
- Update any remaining references

### Testing Strategy

**API Tests** (`tests/api/health-canonical.spec.ts`):
- Validates canonical data structure
- Tests fallback behavior
- Verifies performance requirements
- Ensures error handling

**Unit Tests** (`tests/unit/health-adapter.spec.ts`):
- Tests status calculation logic
- Validates formatting functions
- Covers edge cases and thresholds
- Verifies helper utilities

**E2E Tests** (`tests/e2e/tiles-render.spec.ts`):
- End-to-end user interface testing
- Verifies loading states and error handling
- Tests responsive design
- Validates accessibility compliance

### Performance Considerations

**Caching Strategy:**
- API responses cached for 10 seconds with stale-while-revalidate
- React Query maintains client-side cache with background updates
- Fallback data generation is optimized for sub-100ms response times

**Polling Frequency:**
- 10-second polling interval balances real-time updates with performance
- Background polling continues even when page is not focused
- Automatic retry with exponential backoff on failures

**Resource Usage:**
- Minimal database queries with prepared statements
- In-memory fallback data to eliminate external dependencies
- Efficient data transformation pipelines

### Error Handling

**Service Level:**
- Never throws exceptions - always returns valid data structure
- Logs errors for monitoring while maintaining user experience
- Graceful degradation to fallback mode

**API Level:**
- Always returns HTTP 200 with valid JSON structure
- Includes error indicators in response metadata
- Proper CORS headers for cross-origin requests

**Frontend Level:**
- Loading states during data fetching
- Error boundaries for component isolation
- Retry mechanisms with user feedback

### Monitoring & Observability

**Health Checks:**
- Service health endpoint: `/api/health`
- Dependency status monitoring
- Performance metric collection

**Logging:**
- Structured logs for all health data operations
- Error tracking with context preservation
- Performance timing logs for optimization

**Alerting:**
- Threshold-based alerts for critical metrics
- Fallback mode activation notifications
- Performance degradation warnings

### Security Considerations

**Data Protection:**
- No sensitive information in health metrics
- Rate limiting on API endpoints
- Input validation and sanitization

**Access Control:**
- Health endpoints use standard authentication
- RBAC integration for administrative functions
- Audit logging for security events

### Future Enhancements

**Planned Improvements:**
- WebSocket real-time updates for critical alerts
- Historical trending data integration
- Advanced analytics dashboard
- Multi-region health aggregation
- Custom threshold configuration

**API Evolution:**
- GraphQL interface for complex queries
- Streaming endpoints for real-time data
- Webhook notifications for external systems
- Enhanced filtering and aggregation capabilities

---

**Version**: 1.0  
**Last Updated**: January 2025  
**Next Review**: March 2025
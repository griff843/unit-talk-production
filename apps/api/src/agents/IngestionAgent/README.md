# 📥 IngestionAgent

The IngestionAgent handles the intake and normalization of raw sports betting
propositions from multiple data sources into the Unit Talk platform.

## 🎯 Purpose

Manages the complete data ingestion pipeline:

- Raw proposition fetching from external sources
- Data validation and normalization
- Duplicate detection and prevention
- Quality assurance and enrichment
- Integration with downstream processing

## 🏗️ Architecture

### Core Components

- **Raw Prop Fetcher**: Multi-source data collection
- **Validator**: Data quality and schema validation
- **Normalizer**: Format standardization across sources
- **Duplicate Detector**: Prevents data duplication
- **Enrichment Engine**: Adds metadata and context

### Processing Flow

```
External Sources → Raw Fetch → Validation → Normalization → Deduplication → Enrichment → Storage
```

## ⚙️ Configuration

```typescript
interface IngestionAgentConfig extends BaseAgentConfig {
  sources: DataSourceConfig[]; // Configured data sources
  batchSize: number; // Processing batch size
  pollingInterval: number; // Data polling frequency
  validationRules: ValidationConfig;
  enableDuplicateCheck: boolean; // Duplicate detection enabled
  maxRetryAttempts: number; // Retry attempts per source
}
```

### Data Source Configuration

```typescript
interface DataSourceConfig {
  name: string; // Source identifier
  endpoint: string; // API endpoint
  apiKey?: string; // Authentication key
  rateLimit: number; // Requests per minute
  timeout: number; // Request timeout
  priority: number; // Processing priority
}
```

## 📊 Metrics

### Ingestion Metrics

```typescript
interface IngestionMetrics {
  totalFetched: number; // Raw props fetched
  validationPassed: number; // Passed validation
  validationFailed: number; // Failed validation
  duplicatesDetected: number; // Duplicates found
  normalized: number; // Successfully normalized
  enriched: number; // Successfully enriched
  processingTimeMs: number; // Average processing time
  sourcePerformance: SourceMetrics[];
}
```

## 🔄 Data Processing Pipeline

### 1. Raw Prop Fetching

```typescript
// Fetch from configured sources
const rawProps = await fetchRawProps({
  sources: config.sources,
  timeout: 30000,
  retries: 3,
});
```

### 2. Validation

- Schema validation against expected format
- Business rule validation (odds ranges, dates, etc.)
- Data completeness checks
- Format consistency verification

### 3. Normalization

- Standardize player names and teams
- Normalize odds formats
- Unify date/time formats
- Convert units and measurements

### 4. Duplicate Detection

```typescript
const isDuplicate = await isDuplicateProp(normalizedProp, {
  checkWindow: '24h',
  matchCriteria: ['player', 'stat', 'line', 'game'],
});
```

### 5. Enrichment

- Add player metadata and statistics
- Include team information
- Weather data for outdoor sports
- Injury reports and news

## 🚀 Usage

### Basic Usage

```typescript
const ingestionAgent = new IngestionAgent(config, dependencies);

// Start continuous ingestion
await ingestionAgent.startIngestion();

// Manual ingestion trigger
const results = await ingestionAgent.ingestBatch();

// Stop ingestion
await ingestionAgent.stopIngestion();
```

### Integration with Workflows

```typescript
// In Temporal workflow
const ingestionResult = await proxyActivities<IngestionActivities>({
  startToCloseTimeout: '10m',
  retry: { maximumAttempts: 3 },
}).ingestAndProcess({
  sources: ['source1', 'source2'],
  validateOnly: false,
});
```

## 📝 Data Sources

### Supported Sources

- **Sports APIs**: Official league data feeds
- **Betting APIs**: Sportsbook proposition feeds
- **Market Data**: Live odds and line movement
- **Statistics APIs**: Player and team statistics
- **News APIs**: Injury reports and breaking news

### Source Management

```typescript
interface SourceStatus {
  name: string;
  status: 'active' | 'inactive' | 'error';
  lastFetch: Date;
  successRate: number;
  avgResponseTime: number;
  errorCount: number;
}
```

## 🛡️ Quality Assurance

### Validation Rules

```typescript
interface ValidationRules {
  requiredFields: string[]; // Must-have fields
  oddsBounds: [number, number]; // Valid odds range
  dateRange: [Date, Date]; // Valid date range
  playerNameFormat: RegExp; // Name format validation
  customRules: ValidationFunction[];
}
```

### Error Handling

- Invalid data rejection with logging
- Partial data recovery attempts
- Source-specific error handling
- Retry logic with exponential backoff

## 📈 Performance Optimization

### Batch Processing

- Configurable batch sizes for efficiency
- Parallel processing of independent sources
- Memory-efficient streaming for large datasets
- Rate limiting to respect API constraints

### Caching Strategy

- Player/team metadata caching
- Duplicate check result caching
- API response caching with TTL
- Normalized data template caching

## 🚨 Monitoring & Alerts

### Health Checks

- Source availability monitoring
- Processing pipeline health
- Data quality metrics
- Error rate thresholds

### Alert Conditions

- Source failure or timeout
- High validation failure rate
- Unusual duplicate detection patterns
- Processing backlog accumulation

## 🧪 Testing

### Test Coverage

```bash
# Unit tests
npm test src/agents/IngestionAgent

# Integration tests with live sources
npm run test:integration -- --grep "IngestionAgent"

# Data quality tests
npm run test:data-quality
```

### Test Scenarios

- Source failure handling
- Invalid data processing
- Duplicate detection accuracy
- Performance under load

## 🔧 Troubleshooting

### Common Issues

1. **Source Timeouts**
   - Check network connectivity
   - Verify API endpoint status
   - Adjust timeout settings

2. **High Validation Failures**
   - Review validation rules
   - Check source data format changes
   - Verify schema compatibility

3. **Memory Issues**
   - Reduce batch sizes
   - Check for memory leaks
   - Monitor processing queues

4. **Duplicate Detection Problems**
   - Verify detection criteria
   - Check database indexes
   - Review matching algorithms

### Debug Commands

```bash
# Test single source ingestion
npm run ingestion:test -- --source=source1

# Validate data quality
npm run validate:data-quality

# Check source connectivity
npm run check:sources

# Performance analysis
npm run profile:ingestion
```

## 📊 Business Impact

### Key Metrics

- **Data Coverage**: Percentage of available propositions captured
- **Data Quality**: Validation pass rate and error categorization
- **Timeliness**: Time from source publication to platform availability
- **Reliability**: Uptime and successful ingestion percentage

### Success Criteria

- > 95% data coverage across all sources
- <2% validation failure rate
- <5 minute average ingestion latency
- > 99.5% uptime and reliability

## 🔗 Integration Points

### Upstream Dependencies

- External sports data APIs
- Betting platform APIs
- Market data providers
- News and information services

### Downstream Integrations

- GradingAgent for pick evaluation
- AnalyticsAgent for trend analysis
- NotificationAgent for alerts
- Database storage systems

## 📝 Configuration Examples

### Production Configuration

```json
{
  "agentName": "IngestionAgent",
  "enabled": true,
  "batchSize": 200,
  "pollingInterval": 60000,
  "sources": [
    {
      "name": "primary-api",
      "endpoint": "https://api.source1.com/props",
      "rateLimit": 100,
      "priority": 1
    }
  ],
  "validationRules": {
    "requiredFields": ["player", "stat", "line", "odds"],
    "oddsBounds": [-1000, 1000]
  }
}
```

### Development Configuration

```json
{
  "agentName": "IngestionAgent",
  "enabled": true,
  "batchSize": 50,
  "pollingInterval": 30000,
  "logLevel": "debug",
  "enableDuplicateCheck": false
}
```

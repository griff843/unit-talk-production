# 📊 DataAgent

The DataAgent serves as the central data management hub, handling data
transformation, aggregation, storage optimization, and data quality assurance
across the Unit Talk platform.

## 🎯 Purpose

Manages comprehensive data operations:

- Data transformation and normalization
- Cross-system data aggregation
- Storage optimization and archival
- Data quality monitoring and validation
- Analytics data preparation and enrichment

## 🏗️ Architecture

### Core Components

- **Transformation Engine**: Data format conversion and standardization
- **Aggregation Service**: Cross-system data consolidation
- **Quality Monitor**: Data integrity and validation checks
- **Storage Optimizer**: Efficient data storage and retrieval
- **Analytics Preparer**: Data preparation for analytics and reporting

### Processing Flow

```
Raw Data → Transformation → Quality Check → Aggregation → Storage → Analytics Preparation
```

## ⚙️ Configuration

```typescript
interface DataAgentConfig extends BaseAgentConfig {
  transformation: {
    batchSize: number; // Processing batch size
    parallelJobs: number; // Concurrent transformation jobs
    retryAttempts: number; // Failed transformation retries
    validationEnabled: boolean; // Enable data validation
  };

  storage: {
    compressionEnabled: boolean; // Enable data compression
    archivalPolicy: ArchivalConfig; // Data archival rules
    backupStrategy: BackupConfig; // Backup configuration
    retentionPeriod: number; // Data retention (days)
  };

  quality: {
    monitoringEnabled: boolean; // Enable quality monitoring
    alertThresholds: QualityThresholds; // Quality alert thresholds
    autoCorrection: boolean; // Enable automatic correction
    validationRules: ValidationConfig; // Custom validation rules
  };
}
```

## 📊 Data Operations

### Data Transformation

```typescript
interface TransformationJob {
  id: string; // Job identifier
  sourceType: string; // Source data type
  targetType: string; // Target data format
  rules: TransformationRule[]; // Transformation rules
  status: 'pending' | 'running' | 'completed' | 'failed';

  processing: {
    recordsProcessed: number; // Records processed count
    recordsSuccess: number; // Successfully transformed
    recordsFailed: number; // Failed transformations
    startTime: Date; // Job start time
    endTime?: Date; // Job completion time
  };
}
```

### Data Aggregation

- **Cross-System Integration**: Combine data from multiple sources
- **Real-time Aggregation**: Live data consolidation
- **Historical Aggregation**: Time-series data summarization
- **Performance Metrics**: System-wide performance aggregation
- **User Analytics**: User behavior and engagement aggregation

### Storage Optimization

```typescript
interface StorageOptimization {
  compression: {
    algorithm: 'gzip' | 'lz4' | 'zstd'; // Compression algorithm
    level: number; // Compression level
    ratio: number; // Achieved compression ratio
  };

  partitioning: {
    strategy: 'date' | 'hash' | 'range'; // Partitioning strategy
    columns: string[]; // Partitioning columns
    retention: number; // Partition retention (days)
  };

  indexing: {
    primaryIndexes: IndexConfig[]; // Primary indexes
    secondaryIndexes: IndexConfig[]; // Secondary indexes
    autoOptimize: boolean; // Auto-optimize indexes
  };
}
```

## 🚀 Usage

### Basic Data Operations

```typescript
const dataAgent = new DataAgent(config, dependencies);

// Transform data batch
const transformResult = await dataAgent.transformBatch({
  sourceData: rawData,
  targetFormat: 'normalized',
  validationLevel: 'strict',
});

// Aggregate data across sources
const aggregatedData = await dataAgent.aggregateData({
  sources: ['picks', 'users', 'performance'],
  timeRange: { start: startDate, end: endDate },
  granularity: 'daily',
});

// Optimize storage
await dataAgent.optimizeStorage({
  tables: ['raw_props', 'daily_picks'],
  compression: true,
  indexOptimization: true,
});
```

### Integration with Workflows

```typescript
// In Temporal workflow
const dataResult = await proxyActivities<DataActivities>({
  startToCloseTimeout: '30m',
  retry: { maximumAttempts: 3 },
}).processDataPipeline({
  sources: ['ingestion', 'grading', 'analytics'],
  operations: ['transform', 'aggregate', 'optimize'],
  quality: 'strict',
});
```

## 🔍 Data Quality Management

### Quality Metrics

```typescript
interface DataQualityMetrics {
  completeness: {
    totalRecords: number; // Total records processed
    completeRecords: number; // Complete records
    missingFields: number; // Records with missing fields
    completenessRate: number; // Completeness percentage
  };

  accuracy: {
    validatedRecords: number; // Validated records
    invalidRecords: number; // Invalid records
    accuracyRate: number; // Accuracy percentage
    errorTypes: Record<string, number>; // Error type breakdown
  };

  consistency: {
    duplicateRecords: number; // Duplicate records found
    conflictingRecords: number; // Conflicting data records
    consistencyRate: number; // Consistency percentage
  };

  timeliness: {
    freshRecords: number; // Fresh/current records
    staleRecords: number; // Stale/outdated records
    avgDataAge: number; // Average data age (hours)
  };
}
```

### Quality Monitoring

- **Real-time Validation**: Continuous data quality checks
- **Anomaly Detection**: Identify unusual data patterns
- **Compliance Monitoring**: Regulatory compliance validation
- **Performance Impact**: Quality impact on system performance
- **Automated Alerts**: Quality threshold breach notifications

## 📈 Analytics Data Preparation

### Data Enrichment

```typescript
interface DataEnrichment {
  contextualData: {
    userSegments: boolean; // Add user segmentation
    marketConditions: boolean; // Add market context
    seasonalFactors: boolean; // Add seasonal information
    competitorData: boolean; // Add competitor insights
  };

  calculatedFields: {
    performanceMetrics: boolean; // Calculate performance KPIs
    trendsAnalysis: boolean; // Add trend indicators
    riskMetrics: boolean; // Calculate risk measures
    predictiveScores: boolean; // Add predictive scores
  };

  aggregations: {
    timeSeriesRollups: boolean; // Time-based aggregations
    cohortAnalysis: boolean; // User cohort data
    segmentAnalysis: boolean; // Segment-based analysis
    comparativeMetrics: boolean; // Comparative benchmarks
  };
}
```

### Analytics Schema

- **Dimensional Modeling**: Star and snowflake schema design
- **Time Series Optimization**: Time-based data organization
- **User Journey Mapping**: User interaction data structure
- **Performance Hierarchies**: Multi-level performance aggregation
- **Real-time Views**: Live analytics data availability

## 🗄️ Storage Management

### Archival Strategy

```typescript
interface ArchivalPolicy {
  retention: {
    hotData: number; // Hot data retention (days)
    warmData: number; // Warm data retention (days)
    coldData: number; // Cold data retention (days)
    archiveData: number; // Archive retention (years)
  };

  migration: {
    hotToWarm: number; // Hot to warm migration (days)
    warmToCold: number; // Warm to cold migration (days)
    coldToArchive: number; // Cold to archive migration (days)
    automaticMigration: boolean; // Enable automatic migration
  };

  compression: {
    coldDataCompression: boolean; // Compress cold data
    archiveCompression: boolean; // Compress archive data
    compressionRatio: number; // Target compression ratio
  };
}
```

### Backup and Recovery

- **Incremental Backups**: Regular incremental data backup
- **Point-in-Time Recovery**: Time-specific data recovery
- **Cross-Region Replication**: Multi-region data redundancy
- **Disaster Recovery**: Complete system recovery capabilities
- **Data Validation**: Backup integrity verification

## 🔄 Data Pipeline Management

### Pipeline Orchestration

```typescript
interface DataPipeline {
  stages: PipelineStage[]; // Pipeline processing stages
  dependencies: StageDepency[]; // Stage dependencies
  scheduling: ScheduleConfig; // Pipeline scheduling
  monitoring: MonitoringConfig; // Pipeline monitoring

  performance: {
    throughput: number; // Records per second
    latency: number; // Processing latency
    errorRate: number; // Pipeline error rate
    resourceUsage: ResourceMetrics; // Resource utilization
  };
}
```

### Error Handling

- **Stage-Level Recovery**: Individual stage error recovery
- **Data Lineage Tracking**: Track data transformation history
- **Rollback Capabilities**: Reverse failed transformations
- **Dead Letter Queues**: Handle permanently failed records
- **Alert Integration**: Pipeline failure notifications

## 🧪 Testing

### Test Coverage

```bash
# Unit tests
npm test src/agents/DataAgent

# Data transformation tests
npm run test:data-transformation

# Quality validation tests
npm run test:data-quality

# Storage optimization tests
npm run test:storage-optimization

# Performance tests
npm run test:data-performance
```

### Test Scenarios

- Data transformation accuracy
- Quality monitoring effectiveness
- Storage optimization performance
- Pipeline reliability and recovery
- Cross-system data consistency

## 🔧 Troubleshooting

### Common Issues

1. **Transformation Failures**
   - Check source data format
   - Validate transformation rules
   - Monitor resource availability
   - Review error logs

2. **Quality Issues**
   - Analyze data source quality
   - Review validation rules
   - Check data freshness
   - Monitor anomaly detection

3. **Performance Problems**
   - Optimize batch sizes
   - Check storage performance
   - Monitor resource usage
   - Review indexing strategy

### Debug Commands

```bash
# Data quality report
npm run data:quality-report

# Transformation status
npm run data:transformation-status

# Storage optimization report
npm run data:storage-report

# Pipeline health check
npm run data:pipeline-health
```

## 📊 Business Impact

### Key Performance Indicators

- **Data Quality Score**: Overall data quality rating
- **Processing Throughput**: Records processed per hour
- **Storage Efficiency**: Storage utilization and cost
- **Pipeline Reliability**: Uptime and success rate
- **Analytics Readiness**: Data preparation timeliness

### Success Metrics

- > 95% data quality score across all metrics
- > 100K records/hour processing throughput
- <30% storage utilization increase annually
- > 99.5% pipeline reliability and uptime
- <15 minute analytics data preparation time

## 🔗 Integration Points

### Data Sources

- IngestionAgent: Raw data from external sources
- GradingAgent: Scored and graded proposition data
- AnalyticsAgent: Performance and behavioral analytics
- User systems: User profiles and interaction data

### Data Consumers

- AnalyticsAgent: Prepared analytics data
- RecapAgent: Aggregated performance data
- FeedAgent: Enriched content data
- Reporting systems: Business intelligence data

## 📝 Configuration Examples

### Production Configuration

```json
{
  "agentName": "DataAgent",
  "enabled": true,
  "transformation": {
    "batchSize": 1000,
    "parallelJobs": 8,
    "retryAttempts": 3,
    "validationEnabled": true
  },
  "storage": {
    "compressionEnabled": true,
    "retentionPeriod": 2555
  },
  "quality": {
    "monitoringEnabled": true,
    "autoCorrection": false
  }
}
```

### Development Configuration

```json
{
  "agentName": "DataAgent",
  "enabled": true,
  "transformation": {
    "batchSize": 100,
    "parallelJobs": 2,
    "validationEnabled": false
  },
  "storage": {
    "compressionEnabled": false,
    "retentionPeriod": 30
  },
  "logLevel": "debug"
}
```

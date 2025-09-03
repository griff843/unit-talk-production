# Unit Talk Professional Grading System - Workflow Overview

**Professional Grading Workflows v2025.07.31**

## 🚀 Complete Professional Processing Workflow

### Master Workflow: Raw Prop → Professional Pick

```mermaid
graph TD
    A[Raw Prop Ingestion] --> B{Professional Processing Required?}
    B -->|Yes| C[ProfessionalPropProcessor.processRawProps]
    B -->|No| D[Standard Processing]
    
    C --> E[STEP 1: Devigging Service]
    E --> F[Remove Vig, Calculate True Probabilities]
    
    F --> G[STEP 2: CLV Tracking Service]
    G --> H[Initialize Line Movement Tracking]
    
    H --> I[STEP 3: SyndicateGradingEngine]
    I --> J[8 Professional Features Processing]
    
    subgraph "8 Professional Features"
        K[Steam Detection]
        L[Closing Line Prediction]
        M[Optimal Timing]
        N[Line Shopping Edge]
        O[Public vs Sharp Split]
        P[Market Timing Advantage]
        Q[Injury Timing Edge]
        R[Cross Market Discrepancy]
    end
    
    J --> K
    J --> L
    J --> M
    J --> N
    J --> O
    J --> P
    J --> Q
    J --> R
    
    K --> S[ML Model Ensemble]
    L --> S
    M --> S
    N --> S
    O --> S
    P --> S
    Q --> S
    R --> S
    
    S --> T[Risk Assessment & Kelly Sizing]
    T --> U[Professional Score Calculation]
    U --> V[Unified Pick Creation]
    
    V --> W[Promotion Gates]
    W --> X[Shadow Mode Testing]
    X --> Y[Monitoring & Validation]
    
    Y --> Z[Professional Pick Complete]
```

## 🔧 Core Service Workflows

### 1. ProfessionalPropProcessor Workflow

**Purpose**: Main orchestrator for all professional processing

```mermaid
graph TD
    A[processRawProps Called] --> B[Get Unprocessed Raw Props]
    B --> C[For Each Raw Prop]
    
    C --> D[processIndividualProp]
    D --> E[deviggOdds]
    E --> F[startCLVTracking]
    F --> G[runProfessionalGrading]
    G --> H[calculateRiskAssessment]
    H --> I[shouldAutoApprove?]
    I --> J[createUnifiedPick]
    
    J --> K[Mark Raw Prop Processed]
    K --> L[Generate Processing Summary]
    
    subgraph "Error Handling"
        M[Catch Processing Error]
        N[Mark Raw Prop Error]
        O[Log Failure Details]
    end
    
    D --> M
    M --> N
    N --> O
```

**Key Performance Metrics**:
- **Processing Time**: <2.1 seconds per prop
- **Success Rate**: 99.5% processing success
- **Auto-Approval Rate**: 80% for S/A tier picks
- **Batch Size**: Up to 50 props per batch

### 2. SyndicateGradingEngine Workflow

**Purpose**: Professional grading with 8 advanced features

```mermaid
graph TD
    A[gradeWithEnhancedFeatures Called] --> B[Feature Extraction]
    B --> C[Professional Features Pipeline]
    
    subgraph "Feature Processing"
        D[Steam Detection Analysis]
        E[Closing Line Prediction ML]
        F[Optimal Timing Calculation]
        G[Line Shopping Comparison]
        H[Public vs Sharp Analysis]
        I[Market Timing Assessment]
        J[Injury News Processing]
        K[Cross Market Analysis]
    end
    
    C --> D
    C --> E
    C --> F
    C --> G
    C --> H
    C --> I
    C --> J
    C --> K
    
    D --> L[ML Model Ensemble]
    E --> L
    F --> L
    G --> L
    H --> L
    I --> L
    J --> L
    K --> L
    
    L --> M[Neural Network]
    L --> N[Gradient Boosting]
    L --> O[Random Forest]
    
    M --> P[Ensemble Scoring]
    N --> P
    O --> P
    
    P --> Q[Risk Assessment]
    Q --> R[Kelly Fraction Calculation]
    R --> S[Tier Assignment]
    S --> T[Final GradingResult]
```

### 3. Promotion Gates Workflow

**Purpose**: S/A tier validation and approval logic

```mermaid
graph TD
    A[Professional Pick Created] --> B[PromotionGatekeeper.validatePromotion]
    
    B --> C{Professional Score >= Threshold?}
    C -->|No| D[Reject Promotion]
    C -->|Yes| E[STierEnforcer.validateQuality]
    
    E --> F{S-Tier Quality Criteria Met?}
    F -->|No| G[Assign A-Tier]
    F -->|Yes| H[PortfolioRiskManager.assessRisk]
    
    H --> I{Portfolio Risk Acceptable?}
    I -->|No| J[Delay/Queue Pick]
    I -->|Yes| K[Approve S-Tier Promotion]
    
    G --> L[A-Tier Processing]
    K --> M[S-Tier Processing]
    
    subgraph "Promotion Criteria"
        N[Professional Score > 3.0]
        O[Confidence > 75%]
        P[Kelly Fraction > 0.05]
        Q[CLV Positive Expectation]
        R[Risk Score < 0.3]
    end
```

### 4. Shadow Mode Workflow

**Purpose**: A/B testing and validation framework

```mermaid
graph TD
    A[Pick Processed] --> B{Shadow Mode Enabled?}
    B -->|No| C[Standard Processing]
    B -->|Yes| D[ShadowMode.processInParallel]
    
    D --> E[Production Processing]
    D --> F[Shadow Processing]
    
    E --> G[Production Result]
    F --> H[Shadow Result]
    
    G --> I[ShadowMode.compareResults]
    H --> I
    
    I --> J[Record in shadow_decisions Table]
    J --> K[Generate Comparison Metrics]
    K --> L[Alert if Significant Divergence]
    
    subgraph "Comparison Metrics"
        M[Score Difference]
        N[Tier Agreement]
        O[Professional Features Delta]
        P[Risk Assessment Variance]
    end
    
    I --> M
    I --> N
    I --> O
    I --> P
```

## 📊 Monitoring & Validation Workflows

### 1. AutoRecheckService Workflow

**Purpose**: Automated pick validation and updates

```mermaid
graph TD
    A[Scheduled Recheck Trigger] --> B[Get Active Picks]
    B --> C[For Each Pick]
    
    C --> D[Check Current Odds]
    D --> E[Calculate Odds Movement]
    E --> F{Significant Movement?}
    
    F -->|Yes| G[Recalculate Professional Score]
    F -->|No| H[No Action Required]
    
    G --> I{Score Changed Significantly?}
    I -->|Yes| J[Update Pick Status]
    I -->|No| K[Log Minor Update]
    
    J --> L[Notify Stakeholders]
    L --> M[Update CLV Tracking]
    
    subgraph "Recheck Triggers"
        N[5-15 minutes pre-game]
        O[Significant line movement]
        P[Injury news detected]
        Q[Market conditions change]
    end
```

### 2. RollingMetricsService Workflow

**Purpose**: Performance tracking and analysis

```mermaid
graph TD
    A[Metrics Update Trigger] --> B[Calculate 7-Day Metrics]
    B --> C[Calculate 30-Day Metrics]
    C --> D[Calculate Lifetime Metrics]
    
    D --> E[CLV Performance Analysis]
    E --> F[Hit Rate Calculation]
    F --> G[ROI Analysis]
    G --> H[Kelly-at-Risk Assessment]
    
    H --> I[Update Performance Dashboard]
    I --> J[Generate Alerts if Needed]
    
    subgraph "Key Metrics"
        K[CLV% > 55% Target]
        L[Hit Rate by Tier]
        M[ROI by Sport]
        N[Portfolio Risk Level]
        O[Professional Features Performance]
    end
    
    E --> K
    F --> L
    G --> M
    H --> N
    H --> O
```

### 3. PickMonitoringService Workflow

**Purpose**: Real-time monitoring and alerting

```mermaid
graph TD
    A[Real-Time Monitoring] --> B[Professional Pick Created]
    B --> C[Monitor Professional Score]
    C --> D[Monitor Processing Time]
    D --> E[Monitor Feature Performance]
    E --> F[Monitor Risk Metrics]
    
    F --> G{Thresholds Exceeded?}
    G -->|No| H[Continue Monitoring]
    G -->|Yes| I[Generate Alert]
    
    I --> J[Send to AlertAgent]
    J --> K[Discord Notification]
    
    subgraph "Alert Conditions"
        L[Processing Time > 5s]
        M[Professional Score < 1.0]
        N[Feature Failure Detected]
        O[Risk Score > 0.8]
        P[CLV Tracking Failed]
    end
    
    G --> L
    G --> M
    G --> N
    G --> O
    G --> P
```

## 🔄 Temporal Workflow Integration

### Professional Processing Temporal Workflow

**Purpose**: Orchestrate professional processing with fault tolerance

```typescript
// Temporal Workflow: Professional Prop Processing
export async function professionalPropProcessingWorkflow(
  batchId: string
): Promise<ProfessionalProcessingResult> {
  
  // Step 1: Get raw props batch
  const rawProps = await activities.getRawPropsBatch(batchId);
  
  // Step 2: Process each prop through professional pipeline
  const results = [];
  for (const prop of rawProps) {
    try {
      // Professional processing with retry and timeout
      const result = await activities.processIndividualProp(prop, {
        startToCloseTimeout: '30s',
        retry: { maximumAttempts: 3 }
      });
      results.push(result);
      
      // Update progress
      await activities.updateProcessingProgress(batchId, results.length);
      
    } catch (error) {
      // Handle individual prop failures
      await activities.handlePropProcessingError(prop.id, error);
    }
  }
  
  // Step 3: Generate final summary
  return activities.generateProcessingSummary(batchId, results);
}
```

### Shadow Mode Temporal Workflow

```typescript
// Temporal Workflow: Shadow Mode Testing
export async function shadowModeWorkflow(
  propId: string
): Promise<ShadowComparisonResult> {
  
  // Run production and shadow processing in parallel
  const [productionResult, shadowResult] = await Promise.all([
    activities.processWithProductionSystem(propId),
    activities.processWithShadowSystem(propId)
  ]);
  
  // Compare results
  const comparison = await activities.compareShadowResults(
    productionResult,
    shadowResult
  );
  
  // Store comparison for analysis
  await activities.storeShadowComparison(propId, comparison);
  
  // Alert if significant divergence
  if (comparison.divergenceScore > 0.5) {
    await activities.alertShadowDivergence(propId, comparison);
  }
  
  return comparison;
}
```

## 📈 Performance Optimization Workflows

### Batch Processing Optimization

```mermaid
graph TD
    A[Large Prop Volume Detected] --> B[Optimize Batch Size]
    B --> C[Parallel Processing Pools]
    C --> D[Database Connection Pooling]
    D --> E[Redis Caching Layer]
    E --> F[ML Model Warm-up]
    
    F --> G[Process Batches in Parallel]
    G --> H[Monitor Resource Usage]
    H --> I{Resource Limits Reached?}
    
    I -->|Yes| J[Throttle Processing]
    I -->|No| K[Continue Full Speed]
    
    J --> L[Queue Remaining Props]
    K --> M[Complete Processing]
    L --> M
```

### Caching Strategy Workflow

```mermaid
graph TD
    A[Professional Processing Request] --> B{Check Redis Cache}
    
    B -->|Hit| C[Return Cached Result]
    B -->|Miss| D[Process Through Pipeline]
    
    D --> E[Devigging Calculation]
    E --> F{Cache Devigged Odds?}
    F -->|Yes| G[Store in Redis - 24h TTL]
    
    G --> H[Professional Feature Processing]
    H --> I{Cache Feature Results?}
    I -->|Yes| J[Store Features - 1h TTL]
    
    J --> K[Final Score Calculation]
    K --> L[Store Final Result - 6h TTL]
    
    subgraph "Cache Strategy"
        M[Devigged Odds: 24h TTL]
        N[Professional Features: 1h TTL]
        O[Final Scores: 6h TTL]
        P[Player Stats: 30m TTL]
    end
```

## 🚨 Error Handling & Recovery Workflows

### Comprehensive Error Recovery

```mermaid
graph TD
    A[Processing Error Detected] --> B{Error Type?}
    
    B -->|Devigging Failure| C[Use Cached Odds]
    B -->|CLV Tracking Failure| D[Create Manual Tracking Entry]
    B -->|ML Model Failure| E[Use Fallback Scoring]
    B -->|Database Error| F[Retry with Exponential Backoff]
    
    C --> G[Continue Processing]
    D --> G
    E --> G
    F --> H{Max Retries Reached?}
    
    H -->|No| I[Retry Processing]
    H -->|Yes| J[Mark as Failed]
    
    I --> G
    J --> K[Generate Alert]
    K --> L[Human Review Required]
    
    G --> M[Log Recovery Action]
    M --> N[Update System Metrics]
```

## 🎯 Quality Gates & Validation

### Professional Quality Validation Workflow

```mermaid
graph TD
    A[Professional Pick Generated] --> B[Quality Gate 1: Score Validation]
    B --> C{Professional Score >= 1.0?}
    
    C -->|No| D[Reject - Low Quality]
    C -->|Yes| E[Quality Gate 2: Feature Validation]
    
    E --> F{All 8 Features Processed?}
    F -->|No| G[Reject - Incomplete Features]
    F -->|Yes| H[Quality Gate 3: Risk Validation]
    
    H --> I{Risk Score <= 0.8?}
    I -->|No| J[Reject - High Risk]
    I -->|Yes| K[Quality Gate 4: CLV Validation]
    
    K --> L{CLV Tracking Active?}
    L -->|No| M[Reject - No CLV Tracking]
    L -->|Yes| N[Pass All Quality Gates]
    
    N --> O[Approve for Promotion Consideration]
    
    subgraph "Quality Standards"
        P[Professional Score >= 1.0]
        Q[All 8 Features Processed]
        R[Risk Score <= 0.8]
        S[CLV Tracking Active]
        T[Devigging Applied]
    end
```

---

**Document Version**: v2025.07.31  
**Last Updated**: August 9, 2025  
**Workflow Review**: Monthly workflow optimization review  
**Integration Status**: ✅ ALL WORKFLOWS OPERATIONAL
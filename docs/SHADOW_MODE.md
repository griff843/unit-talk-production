# Unit Talk Professional Grading System - Shadow Mode Documentation

**Shadow Mode Testing Framework v2025.07.31**

## 🌓 Shadow Mode Overview

Shadow Mode is a comprehensive A/B testing framework that enables safe deployment and validation of new professional grading features by running them in parallel with the production system. This allows for continuous improvement while maintaining system reliability.

### Core Shadow Mode Architecture

```mermaid
graph TD
    A[Incoming Pick Request] --> B{Shadow Mode Enabled?}
    
    B -->|No| C[Standard Production Processing]
    B -->|Yes| D[Shadow Mode Controller]
    
    D --> E[Production Processing]
    D --> F[Shadow Processing]
    
    E --> G[Production Result]
    F --> H[Shadow Result]
    
    G --> I[ShadowMode.compareResults]
    H --> I
    
    I --> J[Store Comparison in shadow_decisions]
    J --> K[Generate Metrics]
    K --> L[Check for Divergence]
    
    L --> M{Significant Divergence?}
    M -->|Yes| N[Alert Development Team]
    M -->|No| O[Continue Monitoring]
    
    subgraph "Shadow Infrastructure"
        P[Shadow Environment]
        Q[Shadow Database]
        R[Shadow Configuration]
        S[Shadow Monitoring]
    end
    
    F --> P
    P --> Q
    Q --> R
    R --> S
```

## 🏗️ Shadow Mode Components

### 1. ShadowMode Controller

**Purpose**: Orchestrates parallel processing and result comparison

```typescript
export class ShadowMode {
  private isEnabled: boolean;
  private shadowConfig: ShadowConfiguration;
  private comparisonMetrics: ComparisonMetrics;
  
  constructor(config: ShadowConfiguration) {
    this.isEnabled = config.enabled && process.env.SHADOW_MODE === 'true';
    this.shadowConfig = config;
    this.comparisonMetrics = new ComparisonMetrics();
  }
  
  async processInParallel(
    pickRequest: PickProcessingRequest
  ): Promise<ShadowProcessingResult> {
    
    if (!this.isEnabled) {
      return this.processProductionOnly(pickRequest);
    }
    
    // Execute both systems in parallel
    const [productionResult, shadowResult] = await Promise.all([
      this.executeProductionProcessing(pickRequest),
      this.executeShadowProcessing(pickRequest)
    ]);
    
    // Compare results
    const comparison = await this.compareResults(productionResult, shadowResult);
    
    // Store decision for analysis
    await this.storeShadowDecision(pickRequest, comparison);
    
    // Update metrics
    this.comparisonMetrics.recordComparison(comparison);
    
    // Alert on significant divergence
    if (comparison.divergenceScore > this.shadowConfig.alertThreshold) {
      await this.alertDivergence(comparison);
    }
    
    return {
      productionResult,
      shadowResult,
      comparison,
      useProductionResult: true // Always use production in shadow mode
    };
  }
}
```

### 2. Shadow Processing Pipeline

**Purpose**: Isolated shadow processing environment

```mermaid
graph TD
    A[Shadow Processing Request] --> B[Shadow Environment Setup]
    B --> C[Shadow Configuration Loading]
    C --> D[Shadow Feature Flags]
    
    D --> E[Shadow Devigging Service]
    E --> F[Shadow CLV Tracking]
    F --> G[Shadow Grading Engine]
    
    G --> H[Shadow Professional Features]
    H --> I[Shadow ML Models]
    I --> J[Shadow Risk Assessment]
    
    J --> K[Shadow Result Generation]
    K --> L[Shadow Metrics Collection]
    
    subgraph "Shadow Feature Testing"
        M[New Professional Features]
        N[Updated ML Models]
        O[Modified Risk Algorithms]
        P[Experimental Workflows]
    end
    
    H --> M
    I --> N
    J --> O
    G --> P
```

### 3. Result Comparison Engine

**Purpose**: Comprehensive comparison of production vs shadow results

```typescript
export class ResultComparison {
  
  async compareResults(
    production: ProfessionalPropResult,
    shadow: ProfessionalPropResult
  ): Promise<ComparisonResult> {
    
    const comparison: ComparisonResult = {
      propId: production.pickId,
      timestamp: new Date().toISOString(),
      
      // Score Comparison
      scoreComparison: {
        productionScore: production.professionalScore,
        shadowScore: shadow.professionalScore,
        scoreDifference: Math.abs(production.professionalScore - shadow.professionalScore),
        percentageDifference: this.calculatePercentageDifference(
          production.professionalScore, 
          shadow.professionalScore
        )
      },
      
      // Tier Comparison
      tierComparison: {
        productionTier: production.tier,
        shadowTier: shadow.tier,
        tierAgreement: production.tier === shadow.tier,
        tierDifference: this.calculateTierDifference(production.tier, shadow.tier)
      },
      
      // Feature Comparison
      featureComparison: this.compareFeatures(
        production.professional_insights,
        shadow.professional_insights
      ),
      
      // Risk Comparison
      riskComparison: this.compareRiskAssessments(
        production.kelly_fraction,
        shadow.kelly_fraction
      ),
      
      // Overall Divergence Score
      divergenceScore: this.calculateDivergenceScore({
        scoreDifference: Math.abs(production.professionalScore - shadow.professionalScore),
        tierAgreement: production.tier === shadow.tier,
        featureDifferences: this.countFeatureDifferences(production, shadow)
      })
    };
    
    return comparison;
  }
  
  private calculateDivergenceScore(factors: DivergenceFactors): number {
    const weights = {
      scoreDifference: 0.40,
      tierDisagreement: 0.35,
      featureDifferences: 0.25
    };
    
    const scoreComponent = Math.min(factors.scoreDifference / 2.0, 1.0);
    const tierComponent = factors.tierAgreement ? 0 : 1.0;
    const featureComponent = Math.min(factors.featureDifferences / 8.0, 1.0);
    
    return (
      scoreComponent * weights.scoreDifference +
      tierComponent * weights.tierDisagreement +
      featureComponent * weights.featureDifferences
    );
  }
}
```

## 📊 Shadow Decisions Database Schema

### shadow_decisions Table Structure

```sql
-- Shadow Mode Decisions Table
CREATE TABLE shadow_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prop_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Production Results
  production_score DECIMAL(5,3),
  production_tier VARCHAR(1),
  production_confidence DECIMAL(4,3),
  production_kelly_fraction DECIMAL(6,4),
  production_processing_time_ms INTEGER,
  
  -- Shadow Results
  shadow_score DECIMAL(5,3),
  shadow_tier VARCHAR(1),
  shadow_confidence DECIMAL(4,3),
  shadow_kelly_fraction DECIMAL(6,4),
  shadow_processing_time_ms INTEGER,
  
  -- Comparison Metrics
  score_difference DECIMAL(5,3),
  tier_agreement BOOLEAN,
  divergence_score DECIMAL(4,3),
  
  -- Feature Comparison (JSONB)
  feature_comparison JSONB,
  
  -- Metadata
  shadow_version TEXT,
  experiment_name TEXT,
  feature_flags JSONB,
  
  -- Indexes for performance
  INDEX idx_shadow_decisions_prop_id (prop_id),
  INDEX idx_shadow_decisions_created_at (created_at),
  INDEX idx_shadow_decisions_divergence (divergence_score DESC),
  INDEX idx_shadow_decisions_experiment (experiment_name, created_at)
);

-- Shadow Metrics Summary Table
CREATE TABLE shadow_metrics_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  experiment_name TEXT NOT NULL,
  
  total_comparisons INTEGER,
  avg_divergence_score DECIMAL(4,3),
  tier_agreement_rate DECIMAL(4,3),
  score_correlation DECIMAL(4,3),
  
  production_avg_score DECIMAL(5,3),
  shadow_avg_score DECIMAL(5,3),
  
  alerts_triggered INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(date, experiment_name)
);
```

## 🧪 Shadow Experiments & A/B Testing

### Experiment Configuration

```typescript
export interface ShadowExperiment {
  name: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  
  // Feature flags for shadow processing
  featureFlags: {
    newProfessionalFeatures?: string[];
    mlModelVersions?: Record<string, string>;
    scoringWeights?: Record<string, number>;
    riskParameters?: Record<string, number>;
  };
  
  // Sampling configuration
  samplingRate: number; // 0.0 to 1.0
  targetProps?: string[]; // Specific prop types to test
  
  // Alert configuration
  divergenceThreshold: number;
  alertChannels: string[];
}

// Example experiment configurations
const experiments: ShadowExperiment[] = [
  {
    name: 'enhanced_steam_detection_v2',
    description: 'Testing improved steam detection algorithm',
    startDate: new Date('2025-08-01'),
    endDate: new Date('2025-08-15'),
    featureFlags: {
      newProfessionalFeatures: ['steamDetectionV2'],
      scoringWeights: { steamDetection: 0.85 } // Increased from 0.80
    },
    samplingRate: 0.25, // Test on 25% of props
    divergenceThreshold: 0.15,
    alertChannels: ['discord', 'email']
  },
  
  {
    name: 'ml_ensemble_optimization',
    description: 'Testing optimized ML model ensemble weights',
    startDate: new Date('2025-08-05'),
    featureFlags: {
      mlModelVersions: {
        neuralNetwork: 'v2.1',
        gradientBoosting: 'v1.8'
      }
    },
    samplingRate: 0.50,
    divergenceThreshold: 0.20,
    alertChannels: ['discord']
  }
];
```

### A/B Test Result Analysis

```mermaid
graph TD
    A[Shadow Experiment Running] --> B[Collect Comparison Data]
    B --> C[Statistical Analysis]
    
    C --> D[Calculate Key Metrics]
    D --> E[Significance Testing]
    E --> F[Confidence Intervals]
    
    F --> G{Statistical Significance?}
    G -->|Yes| H[Analyze Business Impact]
    G -->|No| I[Extend Test Duration]
    
    H --> J{Positive Impact?}
    J -->|Yes| K[Recommend Production Deployment]
    J -->|No| L[Recommend Rejection]
    
    subgraph "Key Metrics"
        M[Score Improvement]
        N[Tier Agreement Rate]
        O[Processing Time Impact]
        P[Accuracy Improvement]
        Q[Risk Assessment Quality]
    end
    
    D --> M
    D --> N
    D --> O
    D --> P
    D --> Q
```

## 📈 Shadow Mode Monitoring & Analytics

### Real-Time Monitoring Dashboard

```typescript
export class ShadowModeMonitoring {
  
  async generateShadowMetrics(): Promise<ShadowMetrics> {
    const timeWindow = '24h';
    
    return {
      // Overall Statistics
      totalComparisons: await this.getTotalComparisons(timeWindow),
      averageDivergenceScore: await this.getAverageDivergence(timeWindow),
      tierAgreementRate: await this.getTierAgreementRate(timeWindow),
      
      // Performance Metrics
      productionAvgProcessingTime: await this.getAvgProcessingTime('production', timeWindow),
      shadowAvgProcessingTime: await this.getAvgProcessingTime('shadow', timeWindow),
      
      // Quality Metrics
      scoreCorrelation: await this.getScoreCorrelation(timeWindow),
      featureAgreementRates: await this.getFeatureAgreementRates(timeWindow),
      
      // Alert Statistics
      alertsTriggered: await this.getAlertsTriggered(timeWindow),
      highDivergenceCount: await this.getHighDivergenceCount(timeWindow),
      
      // Experiment Status
      activeExperiments: await this.getActiveExperiments(),
      experimentMetrics: await this.getExperimentMetrics(timeWindow)
    };
  }
  
  async detectAnomalies(): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    
    // Sudden spike in divergence scores
    const avgDivergence = await this.getAverageDivergence('1h');
    const baselineDivergence = await this.getAverageDivergence('24h');
    
    if (avgDivergence > baselineDivergence * 2.0) {
      anomalies.push({
        type: 'HIGH_DIVERGENCE_SPIKE',
        severity: 'HIGH',
        description: `Divergence score spiked to ${avgDivergence.toFixed(3)} (baseline: ${baselineDivergence.toFixed(3)})`,
        timestamp: new Date()
      });
    }
    
    // Processing time degradation
    const shadowProcessingTime = await this.getAvgProcessingTime('shadow', '1h');
    const productionProcessingTime = await this.getAvgProcessingTime('production', '1h');
    
    if (shadowProcessingTime > productionProcessingTime * 1.5) {
      anomalies.push({
        type: 'PROCESSING_TIME_DEGRADATION',
        severity: 'MEDIUM',
        description: `Shadow processing time increased significantly: ${shadowProcessingTime}ms vs ${productionProcessingTime}ms`,
        timestamp: new Date()
      });
    }
    
    return anomalies;
  }
}
```

### Shadow Mode Alerting System

```mermaid
graph TD
    A[Shadow Mode Monitoring] --> B[Collect Metrics]
    B --> C[Check Alert Conditions]
    
    C --> D{High Divergence?}
    D -->|Yes| E[Divergence Alert]
    
    C --> F{Processing Time Issue?}
    F -->|Yes| G[Performance Alert]
    
    C --> H{Tier Agreement Low?}
    H -->|Yes| I[Quality Alert]
    
    C --> J{Shadow Errors High?}
    J -->|Yes| K[Reliability Alert]
    
    E --> L[Send to Discord/Email]
    G --> L
    I --> L
    K --> L
    
    L --> M[Create Support Ticket]
    M --> N[Notify Development Team]
    
    subgraph "Alert Thresholds"
        O[Divergence > 0.3: HIGH]
        P[Processing Time > 2x: MEDIUM]
        Q[Tier Agreement < 80%: HIGH]
        R[Error Rate > 5%: HIGH]
    end
```

## 🔧 Shadow Mode Configuration

### Environment Configuration

```bash
# Shadow Mode Environment Variables
SHADOW_MODE=true
SHADOW_SAMPLING_RATE=0.50
SHADOW_DIVERGENCE_THRESHOLD=0.25
SHADOW_EXPERIMENT_NAME=enhanced_features_test
SHADOW_DATABASE_URL=postgresql://shadow:pass@shadow-db:5432/shadow_db

# Shadow Feature Flags
SHADOW_STEAM_DETECTION_V2=true
SHADOW_ML_MODEL_VERSION=v2.1
SHADOW_RISK_ALGORITHM=enhanced

# Alert Configuration
SHADOW_ALERT_DISCORD_WEBHOOK=https://discord.com/api/webhooks/...
SHADOW_ALERT_EMAIL=dev-team@unittalk.ai
SHADOW_ALERT_THRESHOLD_HIGH=0.30
SHADOW_ALERT_THRESHOLD_MEDIUM=0.20
```

### Feature Flag Management

```typescript
export class ShadowFeatureFlags {
  
  private flags: Map<string, FeatureFlag> = new Map();
  
  constructor() {
    this.initializeFlags();
  }
  
  private initializeFlags(): void {
    // Steam Detection Enhancement
    this.flags.set('steamDetectionV2', {
      enabled: process.env.SHADOW_STEAM_DETECTION_V2 === 'true',
      description: 'Enhanced steam detection with volume correlation',
      version: '2.0',
      rolloutPercentage: 25
    });
    
    // ML Model Updates
    this.flags.set('mlEnsembleV2', {
      enabled: process.env.SHADOW_ML_MODEL_VERSION === 'v2.1',
      description: 'Optimized ML ensemble weights',
      version: '2.1',
      rolloutPercentage: 50
    });
    
    // Risk Assessment Enhancement
    this.flags.set('enhancedRiskAssessment', {
      enabled: process.env.SHADOW_RISK_ALGORITHM === 'enhanced',
      description: 'Advanced portfolio risk calculation',
      version: '1.5',
      rolloutPercentage: 75
    });
  }
  
  isEnabled(flagName: string, propId?: string): boolean {
    const flag = this.flags.get(flagName);
    if (!flag || !flag.enabled) return false;
    
    // Consistent sampling based on prop ID
    if (propId) {
      const hash = this.hashString(propId);
      const sample = hash % 100;
      return sample < flag.rolloutPercentage;
    }
    
    return true;
  }
}
```

## 🚀 Shadow Mode Deployment & Operations

### Deployment Strategy

```mermaid
graph TD
    A[Shadow Mode Deployment] --> B[Shadow Infrastructure Setup]
    B --> C[Shadow Database Migration]
    C --> D[Feature Flag Configuration]
    D --> E[Monitoring Setup]
    
    E --> F[Gradual Rollout]
    F --> G{5% Traffic}
    G --> H[Monitor for 24h]
    H --> I{No Issues?}
    
    I -->|Yes| J{25% Traffic}
    J --> K[Monitor for 48h]
    K --> L{No Issues?}
    
    L -->|Yes| M{50% Traffic}
    M --> N[Monitor for 72h]
    N --> O{Ready for Full?}
    
    O -->|Yes| P[Full Shadow Mode]
    I -->|No| Q[Rollback]
    L -->|No| Q
    O -->|No| Q
    
    Q --> R[Investigate Issues]
    R --> S[Fix and Retry]
```

### Operational Runbooks

#### Shadow Mode Health Check

```bash
#!/bin/bash
# Shadow Mode Health Check Script

echo "🌓 Shadow Mode Health Check"
echo "=========================="

# Check if shadow mode is enabled
SHADOW_ENABLED=$(curl -s localhost:3000/health/shadow | jq -r '.shadowMode.enabled')
echo "Shadow Mode Enabled: $SHADOW_ENABLED"

# Check recent divergence scores
RECENT_DIVERGENCE=$(psql -t -c "SELECT AVG(divergence_score) FROM shadow_decisions WHERE created_at > NOW() - INTERVAL '1 hour';")
echo "Recent Avg Divergence: $RECENT_DIVERGENCE"

# Check processing time comparison
PROD_TIME=$(psql -t -c "SELECT AVG(production_processing_time_ms) FROM shadow_decisions WHERE created_at > NOW() - INTERVAL '1 hour';")
SHADOW_TIME=$(psql -t -c "SELECT AVG(shadow_processing_time_ms) FROM shadow_decisions WHERE created_at > NOW() - INTERVAL '1 hour';")
echo "Production Avg Time: ${PROD_TIME}ms"
echo "Shadow Avg Time: ${SHADOW_TIME}ms"

# Check tier agreement rate
TIER_AGREEMENT=$(psql -t -c "SELECT ROUND(AVG(CASE WHEN tier_agreement THEN 1.0 ELSE 0.0 END) * 100, 1) FROM shadow_decisions WHERE created_at > NOW() - INTERVAL '1 hour';")
echo "Tier Agreement Rate: $TIER_AGREEMENT%"

echo "✅ Shadow Mode Health Check Complete"
```

#### Shadow Mode Emergency Disable

```bash
#!/bin/bash
# Emergency Shadow Mode Disable

echo "🚨 EMERGENCY: Disabling Shadow Mode"

# Update environment variable
export SHADOW_MODE=false

# Restart services
docker-compose restart api

# Verify disable
sleep 5
SHADOW_STATUS=$(curl -s localhost:3000/health/shadow | jq -r '.shadowMode.enabled')

if [ "$SHADOW_STATUS" = "false" ]; then
    echo "✅ Shadow Mode successfully disabled"
else
    echo "❌ Failed to disable Shadow Mode - manual intervention required"
fi

# Send alert
curl -X POST "$DISCORD_WEBHOOK" \
  -H "Content-Type: application/json" \
  -d '{"content": "🚨 EMERGENCY: Shadow Mode has been disabled due to critical issues"}'
```

---

**Document Version**: v2025.07.31  
**Last Updated**: August 9, 2025  
**Shadow Review**: Bi-weekly shadow mode performance review  
**Experiment Status**: ✅ SHADOW FRAMEWORK OPERATIONAL AND TESTING ACTIVE
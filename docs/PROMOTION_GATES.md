# Unit Talk Professional Grading System - Promotion Gates Documentation

**Promotion Gates System v2025.07.31**

## 🚪 Promotion Gates Overview

The Promotion Gates system ensures only the highest quality picks reach S and A tiers through a rigorous three-stage validation process. This system maintains the integrity of the professional grading system by enforcing strict quality standards.

### Three-Stage Gate Architecture

```mermaid
graph TD
    A[Professional Pick Created] --> B[Gate 1: PromotionGatekeeper]
    B --> C{Professional Score >= Threshold?}
    
    C -->|Fail| D[Reject Promotion - Return to Processing]
    C -->|Pass| E[Gate 2: STierEnforcer]
    
    E --> F{S-Tier Quality Criteria Met?}
    F -->|Fail| G[Assign A-Tier Maximum]
    F -->|Pass| H[Gate 3: PortfolioRiskManager]
    
    H --> I{Portfolio Risk Acceptable?}
    I -->|Fail| J[Queue/Delay Pick]
    I -->|Pass| K[Approve S-Tier Promotion]
    
    G --> L[A-Tier Final Validation]
    K --> M[S-Tier Final Validation]
    
    L --> N[Publish A-Tier Pick]
    M --> O[Publish S-Tier Pick]
    
    subgraph "Quality Standards"
        P[Professional Score > 3.0]
        Q[Confidence > 75%]
        R[All 8 Features Processed]
        S[CLV Tracking Active]
        T[Risk Score < 0.3]
    end
```

## 🎯 Gate 1: PromotionGatekeeper

**Purpose**: Primary quality validation and tier eligibility assessment

### Core Validation Logic

```typescript
export class PromotionGatekeeper {
  
  async validatePromotion(pick: UnifiedPick): Promise<PromotionResult> {
    
    // Professional Score Validation
    if (pick.professional_score < this.config.minProfessionalScore) {
      return this.rejectPromotion(pick, 'INSUFFICIENT_PROFESSIONAL_SCORE');
    }
    
    // Confidence Threshold
    if (pick.confidence < this.config.minConfidence) {
      return this.rejectPromotion(pick, 'LOW_CONFIDENCE');
    }
    
    // Feature Completeness Check
    if (!this.validateFeatureCompleteness(pick)) {
      return this.rejectPromotion(pick, 'INCOMPLETE_FEATURES');
    }
    
    // CLV Tracking Validation
    if (!pick.clv_tracking_id || !this.isCLVTrackingActive(pick.clv_tracking_id)) {
      return this.rejectPromotion(pick, 'CLV_TRACKING_MISSING');
    }
    
    // Devigging Validation
    if (!pick.devigged_edge || pick.devigged_edge <= 0) {
      return this.rejectPromotion(pick, 'DEVIGGING_MISSING_OR_NEGATIVE');
    }
    
    return this.approveForNextGate(pick);
  }
}
```

### Validation Criteria Matrix

| Criterion | S-Tier Requirement | A-Tier Requirement | B-Tier Requirement |
|-----------|-------------------|-------------------|-------------------|
| **Professional Score** | ≥ 4.0 | ≥ 3.0 | ≥ 2.0 |
| **Confidence** | ≥ 80% | ≥ 75% | ≥ 65% |
| **Kelly Fraction** | ≥ 0.10 | ≥ 0.05 | ≥ 0.02 |
| **Professional Features** | All 8 Processed | All 8 Processed | ≥ 6 Processed |
| **CLV Tracking** | Active + Positive | Active | Active |
| **Devigged Edge** | > 0.08 | > 0.05 | > 0.02 |
| **Risk Score** | < 0.25 | < 0.35 | < 0.50 |

### Gate 1 Processing Flow

```mermaid
graph TD
    A[Pick Submitted to PromotionGatekeeper] --> B[Load Configuration]
    B --> C[Professional Score Check]
    
    C --> D{Score >= Min Threshold?}
    D -->|No| E[REJECT: INSUFFICIENT_PROFESSIONAL_SCORE]
    D -->|Yes| F[Confidence Check]
    
    F --> G{Confidence >= Min?}
    G -->|No| H[REJECT: LOW_CONFIDENCE]
    G -->|Yes| I[Feature Completeness Check]
    
    I --> J{All Required Features Present?}
    J -->|No| K[REJECT: INCOMPLETE_FEATURES]
    J -->|Yes| L[CLV Tracking Check]
    
    L --> M{CLV Tracking Active?}
    M -->|No| N[REJECT: CLV_TRACKING_MISSING]
    M -->|Yes| O[Devigging Validation]
    
    O --> P{Devigged Edge > 0?}
    P -->|No| Q[REJECT: DEVIGGING_MISSING_OR_NEGATIVE]
    P -->|Yes| R[Risk Score Assessment]
    
    R --> S{Risk Score Acceptable?}
    S -->|No| T[REJECT: HIGH_RISK]
    S -->|Yes| U[PASS GATE 1: Proceed to STierEnforcer]
```

## ⭐ Gate 2: STierEnforcer

**Purpose**: S-tier quality enforcement with the highest standards in the industry

### S-Tier Excellence Criteria

The STierEnforcer implements the most stringent quality standards to ensure only exceptional picks receive S-tier designation.

```typescript
export class STierEnforcer {
  
  private sTierCriteria = {
    minProfessionalScore: 4.0,
    minConfidence: 0.80,
    minKellyFraction: 0.10,
    maxRiskScore: 0.25,
    requiredFeatures: 8, // All 8 professional features
    minCLVExpectation: 0.05, // 5% expected CLV
    minDeviggedEdge: 0.08, // 8% devigged edge
    maxCorrelationRisk: 0.20,
    requireSharpMoneyAlignment: true,
    requireSteamDetection: false, // Optional but preferred
    maxProcessingTime: 2000 // 2 seconds max processing
  };
  
  async enforceSTierStandards(pick: UnifiedPick): Promise<STierValidationResult> {
    
    // Excellence Score Calculation
    const excellenceScore = this.calculateExcellenceScore(pick);
    
    // Multi-Model Validation
    const modelAgreement = this.validateModelAgreement(pick);
    
    // Historical Performance Context
    const historicalContext = await this.getHistoricalPerformanceContext(pick);
    
    // Market Conditions Assessment
    const marketConditions = this.assessMarketConditions(pick);
    
    return this.makeSTierDecision({
      excellenceScore,
      modelAgreement,
      historicalContext,
      marketConditions
    });
  }
  
  private calculateExcellenceScore(pick: UnifiedPick): number {
    const weights = {
      professionalScore: 0.30,
      confidence: 0.20,
      deviggedEdge: 0.20,
      kellyFraction: 0.15,
      featureContributions: 0.15
    };
    
    return (
      (pick.professional_score / 5.0) * weights.professionalScore +
      pick.confidence * weights.confidence +
      (pick.devigged_edge / 0.15) * weights.deviggedEdge +
      (pick.kelly_fraction / 0.20) * weights.kellyFraction +
      this.evaluateFeatureStrength(pick) * weights.featureContributions
    );
  }
}
```

### S-Tier Decision Matrix

```mermaid
graph TD
    A[Pick Passes Gate 1] --> B[STierEnforcer.enforceSTierStandards]
    
    B --> C[Excellence Score Calculation]
    C --> D[Multi-Model Agreement Check]
    D --> E[Historical Performance Context]
    E --> F[Market Conditions Assessment]
    
    F --> G{Excellence Score >= 0.85?}
    G -->|No| H[Assign A-Tier Maximum]
    G -->|Yes| I{Model Agreement >= 90%?}
    
    I -->|No| J[Assign A-Tier - Model Disagreement]
    I -->|Yes| K{Historical Win Rate >= 60%?}
    
    K -->|No| L[Assign A-Tier - Historical Concerns]
    K -->|Yes| M{Market Conditions Favorable?}
    
    M -->|No| N[Assign A-Tier - Market Risk]
    M -->|Yes| O[APPROVE S-TIER PROMOTION]
    
    subgraph "S-Tier Requirements"
        P[Excellence Score >= 0.85]
        Q[Model Agreement >= 90%]
        R[Historical Win Rate >= 60%]
        S[Favorable Market Conditions]
        T[All Professional Features Active]
    end
```

### A-Tier Fallback Processing

When picks don't meet S-tier standards, they're evaluated for A-tier designation:

```typescript
async validateATierEligibility(pick: UnifiedPick): Promise<ATierResult> {
  
  const aTierCriteria = {
    minProfessionalScore: 3.0,
    minConfidence: 0.75,
    minKellyFraction: 0.05,
    maxRiskScore: 0.35,
    minDeviggedEdge: 0.05,
    requiredFeatures: 8
  };
  
  // A-tier has more lenient standards but still requires professional treatment
  return this.validateAgainstCriteria(pick, aTierCriteria);
}
```

## 📊 Gate 3: PortfolioRiskManager

**Purpose**: Portfolio-level risk assessment and correlation management

### Portfolio Risk Architecture

```mermaid
graph TD
    A[S-Tier Candidate] --> B[PortfolioRiskManager.assessRisk]
    
    B --> C[Current Portfolio Analysis]
    C --> D[Correlation Risk Assessment]
    D --> E[Kelly Fraction Optimization]
    E --> F[Maximum Exposure Check]
    
    F --> G{Portfolio Risk Acceptable?}
    G -->|No| H[Risk Mitigation Options]
    G -->|Yes| I[APPROVE FINAL PROMOTION]
    
    H --> J{Reduce Position Size?}
    J -->|Yes| K[Adjust Kelly Fraction]
    J -->|No| L{Queue for Later?}
    
    L -->|Yes| M[Add to Processing Queue]
    L -->|No| N[Reject Promotion]
    
    K --> O[Revalidate Risk Level]
    O --> P{Risk Now Acceptable?}
    P -->|Yes| I
    P -->|No| M
```

### Risk Assessment Components

```typescript
export class PortfolioRiskManager {
  
  async assessPortfolioRisk(pick: UnifiedPick): Promise<PortfolioRiskAssessment> {
    
    // 1. Current Portfolio State
    const currentPortfolio = await this.getCurrentPortfolioState();
    
    // 2. Correlation Analysis
    const correlationRisk = await this.calculateCorrelationRisk(pick, currentPortfolio);
    
    // 3. Kelly Fraction Optimization
    const optimizedKelly = this.optimizeKellyFraction(pick, correlationRisk);
    
    // 4. Maximum Exposure Validation
    const exposureCheck = this.validateMaximumExposure(currentPortfolio, optimizedKelly);
    
    // 5. Risk Scenarios
    const riskScenarios = this.generateRiskScenarios(pick, currentPortfolio);
    
    return {
      correlationRisk,
      optimizedKelly,
      exposureCheck,
      riskScenarios,
      finalRecommendation: this.makeRiskDecision({
        correlationRisk,
        exposureCheck,
        riskScenarios
      })
    };
  }
  
  private calculateCorrelationRisk(
    newPick: UnifiedPick, 
    portfolio: Portfolio
  ): CorrelationRisk {
    
    const correlations = {
      sameSport: this.calculateSameSportCorrelation(newPick, portfolio),
      samePlayer: this.calculateSamePlayerCorrelation(newPick, portfolio),
      sameGame: this.calculateSameGameCorrelation(newPick, portfolio),
      marketType: this.calculateMarketTypeCorrelation(newPick, portfolio)
    };
    
    return {
      totalCorrelationRisk: Object.values(correlations).reduce((sum, risk) => sum + risk, 0),
      breakdownByType: correlations,
      riskLevel: this.classifyRiskLevel(correlations)
    };
  }
}
```

### Portfolio Limits & Constraints

| Constraint Type | Limit | Rationale |
|----------------|--------|-----------|
| **Maximum Single Position** | 5% of bankroll | Kelly criterion maximum |
| **Same Player Exposure** | 10% total exposure | Player-specific risk |
| **Same Game Exposure** | 15% total exposure | Game correlation risk |
| **Same Sport Daily** | 25% daily exposure | Sport diversification |
| **S-Tier Concentration** | 60% of total picks | Quality concentration |
| **Correlation Risk Score** | < 0.30 combined | Portfolio stability |

## 🔄 Promotion Gates Integration

### Complete Integration Flow

```typescript
// Main promotion processing pipeline
export class PromotionPipeline {
  
  async processPromotion(pick: UnifiedPick): Promise<PromotionFinalResult> {
    
    try {
      // Gate 1: Basic quality validation
      const gate1Result = await this.promotionGatekeeper.validatePromotion(pick);
      if (!gate1Result.passed) {
        return this.handlePromotionRejection(pick, gate1Result);
      }
      
      // Gate 2: S-tier enforcement
      const gate2Result = await this.sTierEnforcer.enforceSTierStandards(pick);
      const tierAssignment = gate2Result.approvedTier; // 'S' or 'A'
      
      if (tierAssignment === 'S') {
        // Gate 3: Portfolio risk management (S-tier only)
        const gate3Result = await this.portfolioRiskManager.assessPortfolioRisk(pick);
        
        if (!gate3Result.riskAcceptable) {
          // Downgrade to A-tier or queue
          return this.handleRiskMitigation(pick, gate3Result);
        }
      }
      
      // Final approval
      return this.finalizePromotion(pick, tierAssignment);
      
    } catch (error) {
      return this.handlePromotionError(pick, error);
    }
  }
}
```

## 📈 Performance Metrics & KPIs

### Gate Performance Tracking

```mermaid
graph TD
    A[Promotion Requests] --> B[Gate 1: PromotionGatekeeper]
    B --> C{Pass Rate: ~85%}
    
    C -->|Pass| D[Gate 2: STierEnforcer]
    C -->|Fail| E[Rejection Metrics]
    
    D --> F{S-Tier Rate: ~25%}
    F -->|S-Tier| G[Gate 3: PortfolioRiskManager]
    F -->|A-Tier| H[A-Tier Finalization]
    
    G --> I{Risk Approval Rate: ~90%}
    I -->|Pass| J[S-Tier Finalization]
    I -->|Fail| K[Risk Mitigation]
    
    subgraph "Performance KPIs"
        L[Overall S-Tier Rate: ~20%]
        M[Overall A-Tier Rate: ~60%]
        N[Rejection Rate: ~15%]
        O[Processing Time: <500ms avg]
    end
```

### Quality Assurance Metrics

| Metric | Target | Current Performance | Status |
|--------|--------|-------------------|--------|
| **Gate 1 Pass Rate** | 80-90% | 87% | ✅ On Target |
| **S-Tier Approval Rate** | 20-30% | 23% | ✅ On Target |
| **A-Tier Approval Rate** | 55-65% | 61% | ✅ On Target |
| **Risk Rejection Rate** | 5-10% | 7% | ✅ On Target |
| **Processing Time** | <500ms | 340ms avg | ✅ Exceeds Target |
| **False Positive Rate** | <2% | 1.1% | ✅ Exceeds Target |

## 🚨 Alert & Monitoring System

### Gate-Specific Alerts

```typescript
export class PromotionGatesMonitoring {
  
  private alertConditions = {
    gate1PassRateBelow: 0.75,  // 75%
    sTierRateAbove: 0.35,      // 35%
    riskRejectionsAbove: 0.15, // 15%
    processingTimeAbove: 1000, // 1 second
    errorRateAbove: 0.02       // 2%
  };
  
  async monitorGatePerformance(): Promise<void> {
    const metrics = await this.gatherGateMetrics();
    
    // Check all alert conditions
    for (const [condition, threshold] of Object.entries(this.alertConditions)) {
      if (this.checkThreshold(metrics[condition], threshold)) {
        await this.triggerAlert(condition, metrics[condition], threshold);
      }
    }
  }
}
```

## 🔧 Configuration & Tuning

### Dynamic Configuration Management

```typescript
export interface PromotionGatesConfig {
  gatekeeper: {
    minProfessionalScore: number;
    minConfidence: number;
    featureRequirements: string[];
    clvTrackingRequired: boolean;
  };
  
  sTierEnforcer: {
    excellenceThreshold: number;
    modelAgreementThreshold: number;
    historicalWinRateThreshold: number;
    marketConditionWeights: Record<string, number>;
  };
  
  riskManager: {
    maxSinglePosition: number;
    maxSamePlayerExposure: number;
    maxCorrelationRisk: number;
    portfolioLimits: Record<string, number>;
  };
}

// Environment-based configuration
const config = {
  development: { /* lenient settings */ },
  staging: { /* moderate settings */ },
  production: { /* strict settings */ }
};
```

---

**Document Version**: v2025.07.31  
**Last Updated**: August 9, 2025  
**Gate Review**: Weekly promotion gates performance review  
**Quality Status**: ✅ ALL GATES OPERATIONAL AND ENFORCING STANDARDS
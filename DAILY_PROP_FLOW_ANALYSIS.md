# Daily Prop Flow Analysis - Current vs Professional System Integration

## 🚨 Critical Gap Identified

**Current Issue**: Props are flowing through the system but **NOT getting the
full professional grading treatment** with our new devigging, CLV tracking, and
automated optimization system.

## 📊 Current Daily Flow Analysis

### Current Flow (Missing Professional Features)

```
1. Raw Props Ingestion
   └── raw_props table (stat_type, player_name, line, over_odds, under_odds)

2. Basic Grading (LIMITED)
   └── gradeProps.ts → only calculateEdgeScore() → basic tier assignment

3. Auto-Promotion (BYPASSES PROFESSIONAL SYSTEM)
   └── promoteDailyProps.ts → raw_props (edge_score ≥ 20) → unified_picks

4. SmartForm Bypass (COMPLETELY SKIPS GRADING)
   └── SmartFormBridge.ts → direct to unified_picks (auto-approved)

5. Admin Review (LEGACY SYSTEM)
   └── unified_picks (status: pending_review → approved)
```

### ❌ What's Missing from Current Flow

1. **No Devigging Integration**: Props use raw odds instead of devigged true
   probabilities
2. **No CLV Tracking**: No opening line capture or closing line monitoring
3. **No Professional Feature Analysis**: Missing 45+ professional scoring
   factors
4. **No Feedback Loop Integration**: No weight optimization based on performance
5. **Limited Grading Engine**: Only basic edge score vs full professional
   analysis

## 🏆 Required Professional Daily Flow

### Ideal Professional Flow (Full System Integration)

```
1. Raw Props Ingestion
   └── raw_props → Enhanced with opening line capture

2. 🆕 PROFESSIONAL GRADING (MANDATORY)
   ├── DeviggingService: Remove vig from ALL odds
   ├── Professional GradingEngine: 45+ scoring factors
   ├── CLV Tracking: Start monitoring opening line
   ├── Feature Engineering: Professional capper insights
   └── Risk Assessment: Kelly sizing and portfolio impact

3. 🆕 PROFESSIONAL SCORING PIPELINE
   ├── Enhanced scoring with devigged odds
   ├── Professional insights generation
   ├── Tier assignment based on comprehensive analysis
   └── CLV tracking initialization

4. Admin Review Integration
   ├── unified_picks with professional scoring data
   ├── Admin dashboard showing professional insights
   └── CLV performance context for approval decisions

5. 🆕 POST-APPROVAL MONITORING
   ├── Closing line updates via CLV tracking
   ├── Performance feedback to optimization system
   └── Automated weight adjustments
```

## 🔧 Implementation Required

### 1. Enhanced Raw Props Processing

**Current**:

```typescript
// gradeProps.ts - LIMITED
const edgeScore = calculateEdgeScore(pick); // Basic calculation
```

**Required**:

```typescript
// Enhanced grading with professional system
async function gradePropsWithProfessionalSystem(picks: RawProp[]) {
  for (const pick of picks) {
    // STEP 1: Devig the odds FIRST
    const devigged = await deviggingService.devigTwoWay({
      option1: { odds: pick.over_odds },
      option2: { odds: pick.under_odds },
    });

    // STEP 2: Start CLV tracking
    await clvTrackingService.trackPick({
      propId: pick.id,
      userId: 'system',
      sport: pick.sport,
      market: pick.stat_type,
      book: 'aggregated',
      openingLine: pick.line,
      openingOdds: pick.over_odds, // or under based on prediction
      betLine: pick.line,
      betOdds: pick.over_odds,
      gameTime: pick.game_start_time,
      modelEdge: 0, // Will be calculated by grading engine
    });

    // STEP 3: Full professional grading
    const gradingResult = await syndicateGradingEngine.gradeProp({
      ...pick,
      devigged_odds: devigged,
      true_probabilities: {
        over: devigged.option1TrueProb,
        under: devigged.option2TrueProb,
      },
    });

    // STEP 4: Update with professional insights
    await supabase.from('unified_picks').insert({
      raw_prop_id: pick.id,
      user_id: 'system',
      sport: pick.sport,
      professional_score: gradingResult.finalScore,
      tier: gradingResult.tier,
      confidence: gradingResult.confidence,
      kelly_fraction: gradingResult.kellyFraction,
      professional_insights: gradingResult.professionalInsights,
      devigged_edge: gradingResult.edgeScore,
      status: 'pending_review', // Admin approval required
    });
  }
}
```

### 2. SmartForm Professional Integration

**Current**:

```typescript
// SmartFormBridge.ts - BYPASSES GRADING
await this.promoteToFinalPicks(pickId, dailyPick, insights); // Auto-approved
```

**Required**:

```typescript
// Professional grading for SmartForm submissions
async processSmartFormWithProfessionalGrading(smartTicket: SmartTicket) {
  // STEP 1: Convert to professional format
  const rawProp = await this.convertSmartTicketToRawProp(smartTicket);

  // STEP 2: Run through professional grading system
  const professionalGrading = await this.runProfessionalGrading(rawProp);

  // STEP 3: Store with professional data
  const pickId = await supabase.from('unified_picks').insert({
    user_id: smartTicket.capper_id,
    sport: smartTicket.sport,
    professional_score: professionalGrading.finalScore,
    tier: professionalGrading.tier,
    confidence: professionalGrading.confidence,
    devigged_edge: professionalGrading.edgeScore,
    professional_insights: professionalGrading.professionalInsights,
    clv_tracking_id: professionalGrading.clvTrackingId,
    status: professionalGrading.tier >= 'A' ? 'approved' : 'pending_review'
  });

  // STEP 4: Start CLV monitoring
  await clvTrackingService.trackPick({
    propId: pickId,
    userId: smartTicket.capper_id,
    // ... professional tracking data
  });
}
```

### 3. Admin Review Enhancement

**Current**: Basic approval/denial based on limited data

**Required**: Professional insights in admin dashboard

```typescript
// Admin dashboard should show:
interface AdminReviewData {
  pickId: string;
  professionalScore: number;
  tier: string;
  devigged_edge: number;
  kelly_fraction: number;
  professional_insights: {
    steamMoveDetected: boolean;
    predictedClosingLine: number;
    bestAvailableLine: number;
    publicBettingPercentage: number;
    // ... all professional insights
  };
  clv_context: {
    opening_line: number;
    current_line: number;
    line_movement: number;
  };
  risk_assessment: {
    portfolio_impact: number;
    correlation_risk: number;
    position_size_recommended: number;
  };
}
```

## 📋 Required Database Enhancements

### Enhanced unified_picks Schema

```sql
-- Add professional grading columns to unified_picks
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS professional_score DECIMAL(8,4);
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS devigged_edge DECIMAL(8,4);
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS kelly_fraction DECIMAL(8,4);
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS professional_insights JSONB;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS clv_tracking_id UUID REFERENCES clv_tracking(id);
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS feature_contributions JSONB;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS risk_assessment JSONB;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_unified_picks_professional_score ON unified_picks(professional_score);
CREATE INDEX IF NOT EXISTS idx_unified_picks_tier_score ON unified_picks(tier, professional_score);
CREATE INDEX IF NOT EXISTS idx_unified_picks_clv_tracking ON unified_picks(clv_tracking_id);
```

### Raw Props Enhancement

```sql
-- Add opening line tracking to raw_props
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS opening_line DECIMAL(10,2);
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS opening_over_odds INTEGER;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS opening_under_odds INTEGER;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS book VARCHAR(100);
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS market_open_time TIMESTAMPTZ;
```

## 🚀 Implementation Plan

### Phase 1: Core Professional Integration (1-2 weeks)

1. **Enhanced Raw Props Processing**
   - Update `gradeProps.ts` to use professional grading system
   - Integrate devigging service for all props
   - Start CLV tracking for all ingested props

2. **SmartForm Professional Pipeline**
   - Update `SmartFormBridge.ts` to use professional grading
   - Route through full professional scoring before approval
   - Generate professional insights for capper feedback

3. **Database Schema Updates**
   - Add professional scoring columns to unified_picks
   - Add opening line tracking to raw_props
   - Create necessary indexes

### Phase 2: Admin Dashboard Enhancement (1 week)

1. **Professional Admin Interface**
   - Display professional scoring data in approval workflow
   - Show CLV context and line movement data
   - Include risk assessment and portfolio impact

2. **Approval Logic Enhancement**
   - Auto-approve S/A tier picks from professional system
   - Flag B/C tier picks for manual review
   - Include professional insights in approval decisions

### Phase 3: Monitoring & Optimization (Ongoing)

1. **CLV Performance Tracking**
   - Monitor closing line performance of approved picks
   - Feed performance data back to optimization system
   - Automated weight adjustments based on results

2. **System Health Monitoring**
   - Ensure all props flow through professional system
   - Monitor grading performance and accuracy
   - Alert on system bottlenecks or failures

## 🎯 Success Metrics

1. **Coverage**: 100% of props receive professional grading
2. **Performance**: <30s end-to-end professional grading per prop
3. **Quality**: CLV tracking shows positive performance
4. **Automation**: 80%+ auto-approval rate for S/A tier picks
5. **Admin Efficiency**: 50% reduction in manual review time

## 🚨 Critical Action Items

1. **IMMEDIATE**: Stop bypassing professional grading system
2. **URGENT**: Integrate devigging into all prop processing
3. **HIGH**: Add CLV tracking to all new props
4. **MEDIUM**: Enhance admin dashboard with professional data
5. **LOW**: Optimize performance and add monitoring

**Current Status**: ❌ Props are flowing but NOT getting professional treatment
**Required Status**: ✅ All props receive full professional grading with
devigging, CLV tracking, and comprehensive analysis

This represents a critical gap that must be addressed to realize the full value
of our professional betting system implementation.

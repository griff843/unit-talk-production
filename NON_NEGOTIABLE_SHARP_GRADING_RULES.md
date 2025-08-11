# Non-Negotiable Sharp Grading Rules

**Unit Talk Professional Betting System Compliance Standards**

This document outlines the mandatory rules that EVERY pick, parlay leg, and
round robin combination MUST follow. These rules separate professional sharp
systems from amateur public cappers.

---

## 🏆 Core Professional Standards

### **Rule #1: Universal Devigging** ⚡

- **Requirement**: EVERY odds source must be devigged to remove hidden vig
- **Scope**: All books, exchanges, live odds, opening lines, closing lines
- **Priority**: #1 edge gap between sharp and public systems
- **Implementation**: DeviggingService must process ALL odds before any analysis
- **Validation**: `devigged_edge` field must be populated for every pick
- **No Exceptions**: Even "fair" odds at -110/-110 contain hidden vig

### **Rule #2: Universal CLV Tracking** 📈

- **Requirement**: EVERY pick must have CLV tracking initiated at creation
- **Scope**: Singles, parlays, round robins, live bets, pre-game bets
- **Metric**: CLV is THE metric for long-term success validation
- **Implementation**: CLVTrackingService must start tracking before pick
  approval
- **Validation**: `clv_tracking_id` field must be populated for every pick
- **Monitoring**: Continuous monitoring until line closes or game starts

### **Rule #3: Professional Grading Only** 🎯

- **Requirement**: NO pick bypasses professional grading system
- **Scope**: All picks regardless of source, tier, or confidence
- **Implementation**: ProfessionalPropProcessor handles ALL props
- **Validation**: `professional_score` and `feature_contributions` must be
  populated
- **No Shortcuts**: Basic grading is not acceptable for any pick

### **Rule #4: Kelly Criterion Sizing** 💰

- **Requirement**: Every pick must have optimal Kelly fraction calculated
- **Scope**: Risk management and position sizing for all picks
- **Implementation**: Kelly calculation based on devigged edge and confidence
- **Validation**: `kelly_fraction` field must be > 0 for all approved picks
- **Risk Management**: Maximum Kelly of 0.25 (25% of bankroll)

### **Rule #5: Complete Odds Processing** 🔄

- **Requirement**: ALL available odds must be processed and analyzed
- **Scope**: Over/under, moneyline, spread - all available markets
- **Implementation**: Process both sides of two-way markets when available
- **Validation**: Devigging results must include all available odds
- **Line Shopping**: Best available line identification required

### **Rule #6: Universal Processing Pipeline** 🏗️

- **Requirement**: NO picks bypass the professional processing pipeline
- **Scope**: Every pick follows: Raw → Devigging → CLV → Grading → Approval
- **Implementation**: ProfessionalPropProcessor orchestrates full pipeline
- **Validation**: `processing_time` must be > 0 for all picks
- **No Exceptions**: Manual picks, imported picks, API picks - ALL go through
  pipeline

---

## 🎲 Parlay & Combination Bet Rules

### **Rule #7: Individual Leg Processing**

- **Requirement**: EVERY parlay leg receives individual professional treatment
- **Scope**: 2-leg parlays through 10+ leg parlays
- **Implementation**: Each leg processed through full professional pipeline
- **Validation**: Each leg has its own professional score and devigged edge
- **Correlation Analysis**: Leg correlation impact on combined Kelly sizing

### **Rule #8: Round Robin Compliance**

- **Requirement**: ALL round robin combinations get full professional analysis
- **Scope**: Every possible combination within round robin structure
- **Implementation**: Each combination treated as individual parlay
- **Validation**: Professional analysis for every combination bet
- **Risk Assessment**: Portfolio impact analysis required

### **Rule #9: Parlay Edge Calculation**

- **Requirement**: Combined parlay edge uses devigged probabilities only
- **Scope**: No raw odds calculations for parlay expected value
- **Implementation**: Multiply devigged implied probabilities for true parlay
  edge
- **Validation**: Parlay edge calculation must show devigging methodology
- **Kelly Adjustment**: Reduce Kelly sizing for correlation risk

---

## 🔍 Quality Assurance Rules

### **Rule #10: Automated Feedback Loops** 🔄

- **Requirement**: Performance feedback must auto-adjust system weights
- **Scope**: CLV results, ROI performance, feature effectiveness
- **Implementation**: FeedbackLoopService runs automated optimization
- **Validation**: Weight adjustments logged and tracked
- **Frequency**: Minimum weekly optimization cycles

### **Rule #11: Feature Performance Validation** 📊

- **Requirement**: All grading features must prove statistical significance
- **Scope**: Remove underperforming features to prevent overfitting
- **Implementation**: Automated feature pruning based on CLV correlation
- **Validation**: Feature effectiveness tracking and removal logging
- **Threshold**: Features with <0.01 CLV correlation get pruned

### **Rule #12: Sportsbook Weight Dynamics** ⚖️

- **Requirement**: Book-specific weights adjust based on CLV performance
- **Scope**: Different books get different confidence weights
- **Implementation**: Dynamic weighting based on historical CLV performance
- **Validation**: Book weight adjustments logged and tracked
- **Monitoring**: Book performance dashboards for weight validation

---

## 🚨 Emergency & Exception Handling

### **Rule #13: No System Bypassing** 🚫

- **Requirement**: NO manual overrides that bypass professional rules
- **Scope**: Admin approvals, rush picks, live betting - ALL follow rules
- **Implementation**: System-enforced validation at every approval step
- **Validation**: Audit trail for any administrative actions
- **Escalation**: Rule violations require documented exception approval

### **Rule #14: Error Handling Compliance** ⚠️

- **Requirement**: System errors CANNOT result in rule bypassing
- **Scope**: Failed devigging, CLV service down, grading failures
- **Implementation**: Graceful degradation maintains rule compliance
- **Validation**: Error recovery logs show continued rule adherence
- **Fallback**: Picks wait for service recovery rather than bypass rules

### **Rule #15: Performance Threshold Enforcement** ⚡

- **Requirement**: System performance cannot compromise rule compliance
- **Scope**: High load, time pressure, large batch processing
- **Implementation**: Performance optimization preserves rule integrity
- **Validation**: Performance metrics with rule compliance correlation
- **Priority**: Rule compliance over processing speed

---

## 📋 Testing & Validation Framework

### **Historical Validation Requirements**

- Test system against minimum 100 historical props with known outcomes
- Validate rule compliance rate ≥95% on historical data
- Measure scoring accuracy correlation with actual results
- Verify CLV tracking would have captured line movements
- Confirm all rule violations are properly flagged

### **Live System Validation Requirements**

- Process today's props through complete professional pipeline
- Verify 100% rule compliance on live data
- Validate processing time stays within performance thresholds
- Test parlay and round robin processing compliance
- Confirm automated monitoring systems are operational

### **Compliance Monitoring**

- Real-time rule compliance dashboards
- Automated alerts for any rule violations
- Daily compliance reports with violation analysis
- Weekly system optimization based on compliance metrics
- Monthly rule effectiveness review and updates

---

## 🏆 Success Metrics

### **Compliance Targets**

- **Rule Compliance Rate**: ≥99% (target 100%)
- **Processing Time**: <5 seconds per pick (target <2 seconds)
- **CLV Performance**: Positive CLV on ≥60% of picks
- **Auto-Approval Rate**: ≥80% for S/A tier picks
- **System Uptime**: 99.9% during market hours

### **Performance Indicators**

- **Devigging Coverage**: 100% of odds processed
- **CLV Tracking**: 100% of picks monitored
- **Professional Grading**: 100% of picks scored
- **Kelly Calculations**: 100% of approved picks sized
- **Pipeline Completion**: 100% end-to-end processing

---

## ⚡ Implementation Commands

### **Test Historical Props**

```bash
# Test system against historical props
npx tsx src/runner/testHistoricalProps.ts

# Historical testing with specific parameters
npx tsx src/runner/testHistoricalProps.ts --sample-size 200 --only-settled
```

### **Test Today's Props**

```bash
# Test live system on today's props
npx tsx src/runner/testTodaysProps.ts

# Live testing with parlay validation
npx tsx src/runner/testTodaysProps.ts --test-parlays --validate-scheduler
```

### **Professional Processing**

```bash
# Process props through professional system
npx tsx src/runner/processProfessionalProps.ts

# Show processing statistics
npx tsx src/runner/processProfessionalProps.ts --stats

# System health check
npx tsx src/runner/processProfessionalProps.ts --health
```

### **Monitoring Commands**

```bash
# Monitor rule compliance
npm run professional:compliance-monitor

# CLV performance tracking
npm run professional:clv-monitor

# Automated feedback loops
npm run professional:feedback-loop
```

---

## 🚫 Absolute Prohibitions

**NEVER ALLOWED:**

- ❌ Raw odds calculations without devigging
- ❌ Picks approved without CLV tracking
- ❌ Manual overrides bypassing professional grading
- ❌ System errors resulting in rule bypassing
- ❌ Performance shortcuts compromising rule compliance
- ❌ Parlay legs processed without individual analysis
- ❌ Emergency exceptions to core rules
- ❌ Basic grading for any pick regardless of tier
- ❌ Kelly sizing without devigged edge calculation
- ❌ Book odds used without confidence weighting

**REQUIRED FOR ALL PICKS:**

- ✅ Devigging applied to ALL odds sources
- ✅ CLV tracking initiated before approval
- ✅ Professional grading with feature contributions
- ✅ Kelly fraction calculated from devigged edge
- ✅ Complete processing pipeline traversal
- ✅ Rule compliance validation before approval
- ✅ Performance monitoring and feedback integration
- ✅ Quality assurance validation at every step

---

**Status**: ✅ **MANDATORY COMPLIANCE**  
**Effective**: Immediately  
**Review Cycle**: Monthly  
**Enforcement**: Automated + Manual Audit  
**Exceptions**: None Permitted

_These rules are the foundation of professional betting excellence. Every
violation represents a potential edge leak that amateur systems cannot identify
or address._

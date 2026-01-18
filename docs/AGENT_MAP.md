# AGENT_MAP.md

**Unit Talk Platform - Agent Architecture Map**
**Version**: 1.0.0
**Date**: 2025-01-14
**Status**: Production Ready

---

## Executive Summary

This document provides a comprehensive map of all agents in the Unit Talk platform, defining their inputs, outputs, failure modes, dependencies, and operational characteristics. This serves as the authoritative reference for agent orchestration and autonomous decision-making.

**System Architecture**: Event-driven agent system extending BaseAgent with 22+ specialized agents organized into 6 functional categories.

---

## Table of Contents

1. [Agent Architecture Diagram](#agent-architecture-diagram)
2. [Core Business Agents](#core-business-agents)
3. [Analytics & Insights Agents](#analytics--insights-agents)
4. [Operational & Management Agents](#operational--management-agents)
5. [Intelligence & Optimization Agents](#intelligence--optimization-agents)
6. [Advanced AI & Automation Agents](#advanced-ai--automation-agents)
7. [Base Agent Framework](#base-agent-framework)
8. [Agent Dependency Matrix](#agent-dependency-matrix)
9. [Failure Mode Analysis](#failure-mode-analysis)

---

## Agent Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        UNIT TALK AGENT SYSTEM                        │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                    BaseAgent Framework                      │    │
│  │  • Lifecycle Management  • Health Monitoring  • Metrics    │    │
│  │  • Error Handling        • Logging           • Config      │    │
│  └────────────────────────────────────────────────────────────┘    │
│                              ▲                                        │
│                              │                                        │
│  ┌───────────────────────────┴────────────────────────────────┐    │
│  │                                                              │    │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌───────────┐│    │
│  │  │ CORE BUSINESS    │  │  ANALYTICS &     │  │ OPERATIONS││    │
│  │  │                  │  │  INSIGHTS        │  │           ││    │
│  │  │ • GradingAgent   │  │ • RecapAgent     │  │ • Alert   ││    │
│  │  │ • ScoringAgent   │  │ • AnalyticsAgent │  │ • Notify  ││    │
│  │  │ • SettlementAgent│  │ • FeedAgent      │  │ • Audit   ││    │
│  │  │ • IngestionAgent │  │ • PredictiveAgent│  │ • Operator││    │
│  │  └──────────────────┘  └──────────────────┘  └───────────┘│    │
│  │                                                              │    │
│  │  ┌──────────────────┐  ┌──────────────────┐               │    │
│  │  │ INTELLIGENCE     │  │  AUTOMATION      │               │    │
│  │  │                  │  │                  │               │    │
│  │  │ • RiskMgmt       │  │ • AIAssist       │               │    │
│  │  │ • Optimization   │  │ • Onboarding     │               │    │
│  │  │ • Retention      │  │ • Marketing      │               │    │
│  │  └──────────────────┘  └──────────────────┘               │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                   EXTERNAL INTEGRATIONS                     │    │
│  │  Supabase │ Temporal │ Discord │ OpenAI │ Redis │ Stripe  │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘

Event Flow:
  raw_props → IngestionAgent → GradingAgent → unified_picks → AlertAgent → Discord
                                     ↓
                              ScoringAgent
                                     ↓
                              SettlementAgent
```

---

## Core Business Agents

### 1. GradingAgent

**Location**: `apps/api/src/agents/GradingAgent/GradingAgent.ts`

**Responsibility**: Multi-model ensemble pick grading, scoring, and tier assignment

**Inputs**:
- **Primary**: `raw_props` table records (stat_type, player_name, line, odds)
- **Context**: Market data, historical performance, line movements
- **Configuration**: `USE_PRO_SCORER` flag, batch size, timeout settings

**Outputs**:
- **Database Writes**:
  - `raw_props` updates: tier (S/A/B/C/D), edge_score, confidence, professional_score
  - `unified_picks` inserts: High-confidence picks (≥8% edge, ≥85% confidence)
- **Events**: Pick graded events for downstream agents
- **Metrics**: picksProcessed, picksGraded, tierDistribution, avgConfidence

**Processing Logic**:
```typescript
IF USE_PRO_SCORER:
  professional_score = ProfessionalPropProcessor.process(prop)
  // 8 advanced features: steam, CLV, timing, line shopping, etc.
ELSE:
  score = SyndicateGradingEngine.grade(prop)

IF edge_score ≥ 8% AND confidence ≥ 85%:
  PROMOTE to unified_picks
  tier = assign_tier(edge_score, confidence)
```

**Failure Modes**:
1. **Database Connection Loss**
   - Impact: Cannot read raw_props or write results
   - Recovery: Circuit breaker retry with exponential backoff (1s, 2s, 4s, 8s)
   - Fallback: Queue processing for retry after reconnection

2. **Professional Scorer Timeout**
   - Impact: Processing delays, batch incomplete
   - Recovery: Timeout after 10s per pick, fall back to legacy scorer
   - Fallback: Log timeout, mark pick for manual review

3. **Insufficient Data Quality**
   - Impact: Cannot calculate reliable edge/confidence
   - Recovery: Mark pick as 'unknown' tier, skip promotion
   - Fallback: Store in raw_props with quality_flag for later review

4. **Memory Exhaustion**
   - Impact: Batch processing crashes
   - Recovery: Reduce batch size from 200 to 50, increase processing interval
   - Fallback: Process sequentially if memory pressure continues

**Dependencies**:
- **Critical**: Supabase (raw_props, unified_picks tables)
- **Required**: ProfessionalPropProcessor or SyndicateGradingEngine
- **Optional**: Redis cache for performance

**Health Checks**:
- Database connectivity
- Processing rate (expect ≥100 picks/minute)
- Error rate (must be <5%)
- Memory usage (warn at 80%, critical at 95%)

---

### 2. ScoringAgent

**Location**: `apps/api/src/agents/ScoringAgent/index.ts`

**Responsibility**: Edge scoring and probability calculations for all props

**Inputs**:
- **Primary**: `raw_props` table (line, over_odds, under_odds, stat_type)
- **Context**: Market movements, historical lines, implied probabilities

**Outputs**:
- **Database Writes**: `raw_props` edge_score field
- **Metrics**: success count, error rate, processing time

**Processing Logic**:
```typescript
implied_prob_over = convert_american_to_probability(over_odds)
implied_prob_under = convert_american_to_probability(under_odds)
devigged_prob = remove_vig(implied_prob_over, implied_prob_under)
edge_score = calculate_edge(devigged_prob, true_probability)
```

**Failure Modes**:
1. **Invalid Odds Data**
   - Impact: Cannot calculate edge
   - Recovery: Log error, mark prop as invalid
   - Fallback: Skip prop, flag for data quality review

2. **Calculation Overflow**
   - Impact: Edge score exceeds bounds
   - Recovery: Cap at maximum/minimum values, log anomaly
   - Fallback: Mark for manual review

**Dependencies**:
- **Critical**: Supabase (raw_props table)

**Health Checks**:
- Database connectivity
- Calculation success rate (≥98%)

---

### 3. SettlementAgent

**Location**: `apps/api/src/agents/SettlementAgent/index.ts`

**Responsibility**: Post-game result settlement and pick outcome reconciliation

**Inputs**:
- **Primary**: `game_results`, `prop_settlements` tables
- **Context**: Game completion status, official statistics
- **Configuration**: Settlement intervals (immediate, 30min, 3h, 24h)

**Outputs**:
- **Database Writes**:
  - `unified_picks` outcome updates (win/loss/push)
  - `prop_settlements` final results
- **Events**: Settlement complete events
- **Metrics**: gamesProcessed, propsSettled, settlementSuccessRate, disputedSettlements

**Processing Logic**:
```typescript
FOR EACH completed_game:
  results = fetch_official_stats(game_id)
  FOR EACH pick in game:
    outcome = compare_pick_vs_result(pick, results)
    IF outcome = CLEAR:
      UPDATE unified_picks SET outcome, settled_at
    ELSE IF outcome = DISPUTED:
      FLAG for manual_review
      NOTIFY operators
```

**Failure Modes**:
1. **Official Stats Unavailable**
   - Impact: Cannot settle picks
   - Recovery: Retry with increasing intervals (30min, 3h, 24h)
   - Fallback: Manual settlement queue after 24h

2. **Disputed Outcome**
   - Impact: Cannot determine win/loss/push
   - Recovery: Flag for manual review, notify operators
   - Fallback: Human resolution required

3. **Stat Source API Down**
   - Impact: No settlement data
   - Recovery: Switch to backup stat provider
   - Fallback: Queue for later settlement

**Dependencies**:
- **Critical**: Supabase (game_results, unified_picks, prop_settlements)
- **Required**: Official stats API (Odds API)
- **Optional**: Backup stats provider

**Health Checks**:
- Stats API availability
- Settlement success rate (≥95%)
- Average settlement time (<2 hours for standard games)

---

### 4. IngestionAgent

**Location**: `apps/api/src/agents/IngestionAgent/index.ts`

**Responsibility**: Fetching, validating, and normalizing raw property data from providers

**Inputs**:
- **External APIs**: Optimal API, Odds API
- **Configuration**: Provider selection, polling intervals, batch sizes
- **Context**: Sports schedules, active games

**Outputs**:
- **Database Writes**: `raw_props` inserts (player_name, stat_type, line, odds)
- **Events**: New prop available events
- **Metrics**: propsIngested, duplicatesFiltered, validationErrors, providerStats

**Processing Logic**:
```typescript
FETCH props from provider_api
FOR EACH prop:
  IF is_duplicate(prop, lookback_24h):
    SKIP
  ELSE:
    validated_prop = validate_and_normalize(prop)
    IF validated_prop.valid:
      INSERT INTO raw_props
      EMIT new_prop_event
```

**Failure Modes**:
1. **Provider API Downtime**
   - Impact: No new props ingested
   - Recovery: Circuit breaker switches to backup provider
   - Fallback: Queue requests for retry after circuit reset (45s)

2. **Rate Limit Exceeded**
   - Impact: API requests rejected
   - Recovery: Exponential backoff, reduce request rate
   - Fallback: Prioritize high-value sports (NFL, NBA)

3. **Invalid Data Format**
   - Impact: Prop cannot be normalized
   - Recovery: Log validation error, skip prop
   - Fallback: Alert data quality team

4. **Duplicate Detection Failure**
   - Impact: Duplicate props inserted
   - Recovery: Background deduplication job
   - Fallback: Dedupe constraints prevent critical issues

**Dependencies**:
- **Critical**: Optimal API, Odds API
- **Required**: Supabase (raw_props table)
- **Optional**: Redis cache for duplicate detection

**Health Checks**:
- Provider API availability
- Ingestion rate (expect ≥50 props/minute during peak)
- Duplicate rate (must be <5%)
- Validation error rate (must be <2%)

---

### 5. AlertAgent

**Location**: `apps/api/src/agents/AlertAgent/index.ts`

**Responsibility**: Real-time alerts, Discord notifications, event-driven subscriptions

**Inputs**:
- **Event Subscriptions**: Supabase real-time (bridge_outbox, unified_picks, injury_news)
- **Database Polling**: Fallback for missed events
- **Context**: User notification preferences, channel configurations

**Outputs**:
- **Discord Posts**: Live pick notifications, injury alerts, hedge/middle opportunities
- **Database Writes**: `unit_talk_alerts_log` table
- **Events**: Alert sent confirmations
- **Metrics**: alertsSent, alertsFailed, duplicatesSkipped, llmCallsCount, circuitBreakerTrips

**Processing Logic**:
```typescript
// Event-driven mode (primary)
ON bridge_outbox UPDATE WHERE status='processed':
  pick = load_pick_details(event.pick_id)
  IF should_alert(pick):
    embed = format_discord_embed(pick)
    POST to Discord webhook
    LOG alert_sent

// Polling mode (fallback)
EVERY 30s:
  recent_picks = fetch_unalerted_picks(last_5min)
  FOR EACH pick:
    process_as_event(pick)
```

**Failure Modes**:
1. **Discord API Down**
   - Impact: Alerts not delivered
   - Recovery: Circuit breaker after 3 failures, 45s reset
   - Fallback: Queue alerts for retry after circuit reset

2. **Rate Limit Exceeded (Discord)**
   - Impact: Alerts delayed
   - Recovery: Rate limiter enforces 2s delays between posts
   - Fallback: Batch alerts together to reduce count

3. **LLM API Down (OpenAI)**
   - Impact: Cannot format alert text
   - Recovery: Circuit breaker switches to template-based formatting
   - Fallback: Basic template without AI enhancement

4. **Event Subscription Disconnect**
   - Impact: Real-time events missed
   - Recovery: Automatic reconnection after 5s
   - Fallback: Polling mode processes missed events

**Dependencies**:
- **Critical**: Discord webhook API
- **Required**: Supabase (real-time subscriptions, alert_log)
- **Optional**: OpenAI API for enhanced formatting

**Health Checks**:
- Discord API availability
- Event subscription connection status
- Alert delivery success rate (≥98%)
- Rate limiter effectiveness

---

## Analytics & Insights Agents

### 6. RecapAgent

**Location**: `apps/api/src/agents/RecapAgent/index.ts`

**Responsibility**: Daily recap generation, performance analysis, Notion sync

**Inputs**:
- **Database Queries**: `unified_picks` (daily performance), `game_results`, `prop_settlements`
- **Context**: Historical performance data, tier distributions
- **Triggers**: Scheduled (10 AM EST), Discord slash command (`/recap`)

**Outputs**:
- **Discord Posts**: Daily/weekly recap embeds
- **Notion Pages**: Persistent performance records
- **Database Writes**: `daily_recaps` table
- **Metrics**: Prometheus metrics for recap generation

**Processing Logic**:
```typescript
// Scheduled daily recap
AT 10:00 EST:
  yesterday_picks = fetch_picks(date=yesterday)
  results = aggregate_results(yesterday_picks)
  analysis = {
    total_picks: count,
    win_rate: wins / total,
    roi: calculate_roi(results),
    tier_breakdown: group_by_tier(results)
  }
  recap_text = format_recap(analysis)
  POST to Discord
  SYNC to Notion
```

**Failure Modes**:
1. **Insufficient Data**
   - Impact: Cannot generate meaningful recap
   - Recovery: Note data gap in recap message
   - Fallback: Generate partial recap with available data

2. **Notion API Down**
   - Impact: Recap not persisted to Notion
   - Recovery: Queue for retry when API returns
   - Fallback: Discord post still succeeds

3. **Discord API Down**
   - Impact: Recap not delivered
   - Recovery: Circuit breaker retry after 45s
   - Fallback: Store recap in database for manual posting

**Dependencies**:
- **Critical**: Supabase (unified_picks, game_results)
- **Required**: Discord webhook API
- **Optional**: Notion API for persistence

**Health Checks**:
- Data availability for recap period
- Discord/Notion API connectivity
- Recap generation success rate (≥99%)

---

### 7. AnalyticsAgent

**Location**: `apps/api/src/agents/AnalyticsAgent/index.ts`

**Responsibility**: Data analysis, insights generation, performance tracking

**Inputs**:
- **Database Queries**: All picks, settlements, user behavior, market trends
- **Context**: Historical data for trend analysis

**Outputs**:
- **Database Writes**: Analytics tables, computed metrics
- **Reports**: Performance insights, trend analysis
- **Metrics**: Analysis job completion rate

**Processing Logic**:
```typescript
// Temporal workflow scheduled analysis
WORKFLOW AnalyticsWorkflow:
  data = fetch_analytics_data(date_range)
  insights = {
    trend_analysis: compute_trends(data),
    correlation_matrix: calculate_correlations(data),
    anomaly_detection: detect_anomalies(data)
  }
  STORE insights in analytics_cache
```

**Failure Modes**:
1. **Computation Timeout**
   - Impact: Analysis incomplete
   - Recovery: Break into smaller chunks
   - Fallback: Return partial results

2. **Data Quality Issues**
   - Impact: Inaccurate insights
   - Recovery: Filter outliers, validate inputs
   - Fallback: Mark insights as low confidence

**Dependencies**:
- **Critical**: Supabase (all tables)
- **Required**: Temporal workflows

**Health Checks**:
- Data quality metrics
- Analysis completion rate (≥95%)

---

### 8. FeedAgent

**Location**: `apps/api/src/agents/FeedAgent/index.ts`

**Responsibility**: Content feed generation, data ingestion optimization

**Inputs**:
- **External APIs**: Optimal API for prop data
- **Context**: Feed preferences, content filters

**Outputs**:
- **Content Feeds**: Normalized prop feeds
- **Database Writes**: Feed metadata
- **Metrics**: Feed generation success rate

**Processing Logic**:
```typescript
data = fetch_from_optimal_api()
normalized = normalize_feed(data)
PUBLISH to feed_channel
```

**Failure Modes**:
1. **API Unavailable**
   - Impact: No feed updates
   - Recovery: Switch to cached data
   - Fallback: Display stale feed with timestamp

**Dependencies**:
- **Critical**: Optimal API
- **Optional**: Redis cache

**Health Checks**:
- API availability
- Feed freshness (<5 minutes)

---

## Operational & Management Agents

### 9. NotificationAgent

**Location**: `apps/api/src/agents/NotificationAgent/NotificationAgent.ts`

**Responsibility**: Multi-channel user notifications (Discord, SMS, Email, Notion)

**Inputs**:
- **Notification Requests**: Database triggers, scheduled notifications
- **Context**: User preferences, notification history

**Outputs**:
- **Discord Messages**: User-specific notifications
- **SMS**: Via Twilio
- **Email**: Via SendGrid
- **Notion**: Page updates
- **Metrics**: Notifications sent per channel

**Processing Logic**:
```typescript
FOR EACH notification_request:
  user_prefs = fetch_user_preferences(user_id)
  channels = filter_by_preferences(user_prefs)
  FOR EACH channel:
    send_via_channel(notification, channel)
    LOG delivery_status
```

**Failure Modes**:
1. **Channel API Down**
   - Impact: Notifications not delivered via that channel
   - Recovery: Queue for retry, attempt other channels
   - Fallback: Multi-channel redundancy ensures delivery

2. **User Preferences Unavailable**
   - Impact: Cannot determine delivery channels
   - Recovery: Use default channels (Discord)
   - Fallback: Deliver to all channels with opt-out support

**Dependencies**:
- **Critical**: Supabase (user_preferences)
- **Required**: Discord, Twilio, SendGrid, Notion APIs

**Health Checks**:
- All channel API availability
- Delivery success rate per channel (≥95%)

---

### 10. AuditAgent

**Location**: `apps/api/src/agents/AuditAgent/index.ts`

**Responsibility**: Audit trail and compliance tracking

**Inputs**:
- **Event Streams**: All system events requiring audit
- **Context**: User actions, system changes, data modifications

**Outputs**:
- **Database Writes**: `audit_events` table
- **Compliance Reports**: Periodic audit summaries
- **Metrics**: Events audited, compliance violations

**Processing Logic**:
```typescript
ON auditable_event:
  audit_record = {
    event_type, user_id, resource_id, action,
    before_state, after_state, timestamp, metadata
  }
  INSERT INTO audit_events
  CHECK compliance_rules(audit_record)
  IF violation:
    ALERT compliance_team
```

**Failure Modes**:
1. **Audit Database Unavailable**
   - Impact: Audit trail gaps
   - Recovery: Queue audit records in memory
   - Fallback: Write to backup audit log file

2. **Compliance Rule Engine Error**
   - Impact: Violations not detected
   - Recovery: Log error, continue auditing
   - Fallback: Manual compliance review scheduled

**Dependencies**:
- **Critical**: Supabase (audit_events table)

**Health Checks**:
- Audit database connectivity
- Event capture rate (100%)
- Compliance check success rate (≥99%)

---

## Intelligence & Optimization Agents

### 11. RiskManagementAgent

**Location**: `apps/api/src/agents/RiskManagementAgent/index.ts`

**Responsibility**: Portfolio optimization and risk analysis

**Inputs**:
- **Portfolio Data**: All active picks, bankroll, exposure
- **Market Data**: Odds movements, line changes
- **Configuration**: Risk thresholds, Kelly criterion settings

**Outputs**:
- **Risk Reports**: Portfolio exposure analysis
- **Hedge Recommendations**: Hedge calculations for parlays and singles
- **Database Writes**: `portfolio_snapshots`, `hedge_opportunities`
- **Metrics**: Risk score distribution, hedge success rate

**Processing Logic**:
```typescript
portfolio = fetch_active_picks()
exposure = calculate_exposure_by_sport_and_book()
risk_score = analyze_portfolio_risk(portfolio, exposure)

IF risk_score > THRESHOLD:
  hedges = calculate_hedge_opportunities(portfolio)
  NOTIFY user of hedge_recommendations

position_sizes = kelly_criterion_sizing(portfolio, bankroll)
RECOMMEND position_adjustments
```

**Failure Modes**:
1. **Calculation Error**
   - Impact: Inaccurate risk assessment
   - Recovery: Log error, use conservative fallback values
   - Fallback: Manual risk review

2. **Market Data Stale**
   - Impact: Hedge calculations based on outdated odds
   - Recovery: Flag as stale, recommend manual verification
   - Fallback: Use cached odds with staleness warning

**Dependencies**:
- **Critical**: Supabase (unified_picks, portfolio data)
- **Required**: Real-time odds data

**Health Checks**:
- Market data freshness (<2 minutes)
- Calculation success rate (≥99%)

---

### 12. UserRetentionAgent

**Location**: `apps/api/src/agents/UserRetentionAgent/index.ts`

**Responsibility**: Churn prediction and engagement analysis

**Inputs**:
- **User Behavior**: Activity logs, engagement metrics, login patterns
- **Performance Data**: User win rates, ROI, pick counts

**Outputs**:
- **Churn Predictions**: ML-based churn risk scores
- **Engagement Recommendations**: Personalized re-engagement strategies
- **Database Writes**: `user_retention_scores`, `engagement_campaigns`
- **Metrics**: Churn prediction accuracy, retention rate

**Processing Logic**:
```typescript
users = fetch_active_users()
FOR EACH user:
  behavior = extract_behavior_features(user)
  churn_score = ml_model.predict_churn(behavior)

  IF churn_score > 0.7:
    strategy = generate_retention_strategy(user)
    TRIGGER engagement_campaign(user, strategy)
```

**Failure Modes**:
1. **ML Model Unavailable**
   - Impact: No churn predictions
   - Recovery: Use rule-based fallback (activity < threshold)
   - Fallback: Manual review of at-risk users

2. **Insufficient User Data**
   - Impact: Unreliable predictions
   - Recovery: Mark as low confidence, require manual review
   - Fallback: Apply general retention strategies

**Dependencies**:
- **Critical**: Supabase (user_behavior, engagement_metrics)
- **Required**: ML model service
- **Optional**: Segment API for advanced analytics

**Health Checks**:
- ML model availability
- Prediction accuracy (≥75%)
- Data completeness (≥90%)

---

## Advanced AI & Automation Agents

### 13. AutomatedOnboardingAgent

**Location**: `apps/api/src/agents/AutomatedOnboardingAgent/index.ts`

**Responsibility**: Intelligent user onboarding with behavior tracking

**Inputs**:
- **New User Events**: Registration, first login
- **User Interactions**: Questions, actions, engagement
- **Context**: User profile, preferences, behavior

**Outputs**:
- **Conversational Responses**: Natural language guidance
- **Interventions**: Proactive help based on behavior
- **Database Writes**: `user_profiles`, `onboarding_progress`
- **Metrics**: Onboarding completion rate, time to first pick

**Processing Logic**:
```typescript
ON new_user_registered:
  profile = create_user_profile(user)
  conversation = initialize_conversation_engine(profile)

LOOP:
  user_action = wait_for_user_action()
  behavior = analyze_behavior(user_action)

  IF needs_intervention(behavior):
    intervention = generate_smart_intervention(behavior)
    SEND intervention_message

  IF onboarding_complete(behavior):
    BREAK
```

**Failure Modes**:
1. **Conversation Engine Error**
   - Impact: Cannot provide personalized guidance
   - Recovery: Fall back to static onboarding flow
   - Fallback: Generic welcome message, manual support

2. **Behavior Analysis Timeout**
   - Impact: Delayed interventions
   - Recovery: Skip analysis, use time-based triggers
   - Fallback: Standard onboarding sequence

**Dependencies**:
- **Critical**: Supabase (user_profiles, onboarding_progress)
- **Required**: OpenAI API for conversation engine
- **Optional**: Mixpanel for behavior analytics

**Health Checks**:
- Conversation engine availability
- Intervention effectiveness (measured by engagement)
- Onboarding completion rate (target ≥80%)

---

### 14. AIAssistAgent

**Location**: `apps/api/src/agents/AIAssistAgent/index.ts`

**Responsibility**: AI assistant capabilities for user support

**Inputs**:
- **User Questions**: Discord messages, support tickets
- **Context**: User history, platform documentation, FAQ

**Outputs**:
- **AI Responses**: Natural language answers
- **Action Recommendations**: Suggested next steps
- **Database Writes**: `ai_assist_logs`
- **Metrics**: Response accuracy, user satisfaction

**Processing Logic**:
```typescript
ON user_question:
  context = fetch_user_context(user_id)
  knowledge = retrieve_relevant_docs(question)

  response = llm.generate_response({
    question, context, knowledge
  })

  POST response to user
  LOG interaction

  IF user_feedback_negative:
    ESCALATE to human_support
```

**Failure Modes**:
1. **LLM API Down**
   - Impact: No AI responses
   - Recovery: Circuit breaker, fall back to FAQ matching
   - Fallback: Direct user to human support

2. **Incorrect Response**
   - Impact: User receives bad advice
   - Recovery: User feedback triggers escalation
   - Fallback: Human support override

**Dependencies**:
- **Critical**: OpenAI API
- **Required**: Supabase (user_context, knowledge_base)

**Health Checks**:
- LLM API availability
- Response quality (measured by user feedback)
- Escalation rate (target <10%)

---

## Base Agent Framework

### BaseAgent

**Location**: `apps/api/src/agents/BaseAgent/index.ts`

**Responsibility**: Foundation class providing lifecycle, health, metrics, logging

**Core Features**:
1. **Lifecycle Management**
   - `initialize()`: Setup dependencies, validate configuration
   - `start()`: Begin agent operation, start health checks
   - `process()`: Core agent logic (abstract)
   - `stop()`: Graceful shutdown, cleanup resources
   - `cleanup()`: Final cleanup (abstract)

2. **Health Monitoring**
   - `checkHealth()`: Agent-specific health check (abstract)
   - `getEnhancedHealth()`: Includes dependency health
   - Health check interval: configurable (default 30s)

3. **Metrics Collection**
   - `metrics`: BaseMetrics object (success/error counts, processing time, memory)
   - Prometheus integration for observability
   - Metrics reporting interval: configurable (default 60s)

4. **Error Handling**
   - Centralized error handler with retry logic
   - Error event emission for monitoring
   - Circuit breaker integration

5. **Structured Logging**
   - Correlation IDs for request tracing
   - Distributed tracing with OpenTelemetry
   - Log levels: debug, info, warn, error

6. **Configuration Management**
   - Environment-based configuration
   - Validation with schema enforcement
   - Hot-reload support for non-critical settings

**Dependencies**:
- **Critical**: Logger (tracedLogger)
- **Required**: Configuration validator
- **Optional**: Supabase, ErrorHandler, Circuit Breaker

**Extension Pattern**:
```typescript
export class MyAgent extends BaseAgent {
  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
  }

  protected async initialize(): Promise<void> {
    // Setup agent-specific dependencies
  }

  protected async process(): Promise<void> {
    // Core agent logic
  }

  protected async cleanup(): Promise<void> {
    // Cleanup resources
  }

  protected async checkHealth(): Promise<HealthCheckResult> {
    return {
      status: 'healthy',
      details: { /* agent-specific health info */ }
    };
  }
}
```

---

## Agent Dependency Matrix

| Agent                    | Supabase | Temporal | Discord | OpenAI | Redis | Odds API | Optimal API |
|-------------------------|----------|----------|---------|--------|-------|----------|-------------|
| GradingAgent            | ✅ Critical | ❌ | ❌ | ❌ | 🔶 Optional | ❌ | ❌ |
| ScoringAgent            | ✅ Critical | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| SettlementAgent         | ✅ Critical | ❌ | ❌ | ❌ | ❌ | ✅ Required | ❌ |
| IngestionAgent          | ✅ Critical | ❌ | ❌ | ❌ | 🔶 Optional | ✅ Required | ✅ Required |
| AlertAgent              | ✅ Critical | ❌ | ✅ Critical | 🔶 Optional | ❌ | ❌ | ❌ |
| RecapAgent              | ✅ Critical | ✅ Required | ✅ Required | ❌ | ❌ | ❌ | ❌ |
| AnalyticsAgent          | ✅ Critical | ✅ Required | ❌ | ❌ | ❌ | ❌ | ❌ |
| FeedAgent               | ✅ Critical | ❌ | ❌ | ❌ | 🔶 Optional | ❌ | ✅ Required |
| NotificationAgent       | ✅ Critical | ❌ | ✅ Required | ❌ | ❌ | ❌ | ❌ |
| AuditAgent              | ✅ Critical | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| RiskManagementAgent     | ✅ Critical | ❌ | ❌ | ❌ | ❌ | 🔶 Optional | ❌ |
| UserRetentionAgent      | ✅ Critical | ❌ | ❌ | ✅ Required | ❌ | ❌ | ❌ |
| AutomatedOnboardingAgent| ✅ Critical | ❌ | ✅ Required | ✅ Required | ❌ | ❌ | ❌ |
| AIAssistAgent           | ✅ Critical | ❌ | ❌ | ✅ Critical | ❌ | ❌ | ❌ |

**Legend**:
- ✅ **Critical**: Agent cannot function without this dependency
- ✅ **Required**: Agent requires this for full functionality
- 🔶 **Optional**: Enhances performance but not required

---

## Failure Mode Analysis

### Systemic Failure Scenarios

#### 1. Supabase Database Outage

**Impact**: All agents requiring database access fail

**Affected Agents**: All except purely computational agents

**Recovery Strategy**:
1. Circuit breaker activates after 3 consecutive failures
2. Agents enter degraded mode with local caching
3. Queue all write operations for replay after recovery
4. Health checks report 'degraded' status
5. Alert operations team via Discord/PagerDuty

**Time to Recovery**:
- Circuit breaker reset: 45 seconds
- Full recovery: 2-5 minutes after database returns

**Data Integrity**:
- No data loss: All writes queued for replay
- Read operations serve cached data with staleness warnings

---

#### 2. Discord API Outage

**Impact**: AlertAgent and NotificationAgent cannot deliver messages

**Affected Agents**: AlertAgent, NotificationAgent, RecapAgent, AutomatedOnboardingAgent

**Recovery Strategy**:
1. Circuit breaker activates for Discord channel
2. Queue messages for delivery after circuit reset
3. For critical alerts, attempt fallback channels (SMS, Email)
4. Batch queued messages to prevent rate limit on recovery

**Time to Recovery**:
- Circuit breaker reset: 45 seconds
- Message delivery: 1-5 minutes for queued backlog

**User Impact**:
- Delayed notifications (acceptable for non-critical alerts)
- Critical alerts use fallback channels (zero delay)

---

#### 3. External API Rate Limit (Odds/Optimal API)

**Impact**: IngestionAgent cannot fetch new props

**Affected Agents**: IngestionAgent, SettlementAgent

**Recovery Strategy**:
1. Exponential backoff reduces request rate
2. Prioritize high-value sports (NFL, NBA) over others
3. Switch to backup provider if available
4. Cache recent data for read operations

**Time to Recovery**:
- Rate limit reset: 1-60 minutes (provider-dependent)
- Partial service: Immediate (prioritized sports)

**Data Freshness**:
- High-priority sports: <5 minutes stale
- Other sports: Up to 60 minutes stale during rate limit

---

#### 4. OpenAI API Outage

**Impact**: AI-powered agents lose intelligent capabilities

**Affected Agents**: AIAssistAgent, AutomatedOnboardingAgent, AlertAgent (optional enhancement)

**Recovery Strategy**:
1. Circuit breaker switches to template-based fallbacks
2. AIAssistAgent escalates to human support
3. AutomatedOnboardingAgent uses static onboarding flow
4. AlertAgent uses basic template formatting

**Time to Recovery**:
- Circuit breaker reset: 45 seconds
- Full AI capabilities: Immediate after API returns

**Service Degradation**:
- AIAssistAgent: All questions escalated (100% human support)
- AutomatedOnboardingAgent: Generic onboarding (reduced personalization)
- AlertAgent: Basic formatting (no AI enhancement)

---

### Agent-Specific Failure Modes

See individual agent sections above for detailed failure mode analysis including:
- Failure scenarios
- Impact assessment
- Recovery procedures
- Fallback strategies
- Time to recovery
- Data integrity guarantees

---

## Monitoring & Observability

### Health Check Hierarchy

```
System Health
  ├─ BaseAgent Framework Health
  │    ├─ Logger availability
  │    ├─ Configuration validation
  │    └─ Metrics collection
  │
  ├─ Individual Agent Health
  │    ├─ Agent-specific checks (abstract checkHealth())
  │    ├─ Processing rate
  │    ├─ Error rate
  │    └─ Memory usage
  │
  └─ Dependency Health
       ├─ Supabase connectivity
       ├─ Circuit breaker states
       ├─ External API availability
       └─ Queue depths
```

### Metrics Collection

**Agent Metrics** (collected by BaseAgent):
- `success_count`: Successful operations
- `error_count`: Failed operations
- `warning_count`: Warnings logged
- `processing_time_ms`: Average processing time
- `memory_usage_mb`: Current memory usage

**Agent-Specific Metrics** (varies by agent):
- GradingAgent: `picks_processed`, `tier_distribution`, `avg_confidence`
- IngestionAgent: `props_ingested`, `duplicates_filtered`, `validation_errors`
- AlertAgent: `alerts_sent`, `circuit_breaker_trips`, `llm_call_count`
- SettlementAgent: `games_processed`, `props_settled`, `disputed_settlements`

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Error Rate | >2% | >5% |
| Processing Time | >5s | >10s |
| Memory Usage | >80% | >95% |
| Circuit Breaker Trips | >3/hour | >10/hour |
| Queue Depth | >1000 | >5000 |

---

## Appendix: Configuration Examples

### GradingAgent Configuration

```yaml
name: "GradingAgent"
schedule: "*/5 * * * *"  # Every 5 minutes
enabled: true
batchSize: 200
timeout: 10000  # 10 seconds
logging:
  level: "info"
  structured: true
metrics:
  enabled: true
  interval: 60000  # 60 seconds
healthCheck:
  enabled: true
  interval: 30000  # 30 seconds
features:
  useProfessionalScorer: true
  enableBatchProcessing: true
  enableRetry: true
retryPolicy:
  maxAttempts: 3
  backoffMs: 1000
  exponential: true
```

### AlertAgent Configuration

```yaml
name: "AlertAgent"
enabled: true
mode: "event-driven"  # or "polling"
pollingInterval: 30000  # 30 seconds (fallback)
logging:
  level: "info"
metrics:
  enabled: true
channels:
  discord:
    enabled: true
    webhookUrl: "${DISCORD_WEBHOOK_URL}"
    rateLimitMs: 2000
circuitBreaker:
  enabled: true
  failureThreshold: 3
  resetTimeoutMs: 45000
subscriptions:
  - table: "bridge_outbox"
    event: "UPDATE"
    filter: "status=eq.processed"
  - table: "unified_picks"
    event: "INSERT"
```

---

**Document Maintained By**: Platform Engineering Team
**Last Updated**: 2025-01-14
**Next Review**: Monthly or after major agent changes

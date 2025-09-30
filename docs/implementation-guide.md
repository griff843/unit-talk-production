# Implementation Guide

**Step-by-Step Guide to Leverage Your Database Transformation** _Priority-Based
Action Plan_

## 🎯 **WEEK 1: IMMEDIATE PERFORMANCE GAINS**

### **Day 1-2: Update Critical Queries**

#### **1. Props Loading Optimization**

```javascript
// File: /api/props/index.js
// BEFORE (slow)
const getProps = async gameDate => {
  return await supabase.from('raw_props').select('*').eq('game_date', gameDate);
};

// AFTER (3-10x faster)
const getProps = async (gameDate, sport = null) => {
  let query = supabase
    .from('raw_props')
    .select(
      `
      id, player_name, stat_type, line, odds, confidence,
      games!inner(home_team, away_team, status, game_time)
    `
    )
    .eq('game_date', gameDate)
    .not('game_id', 'is', null); // Only game-specific props

  if (sport) query = query.eq('games.sport', sport);

  return await query.order('confidence', { ascending: false });
};
```

#### **2. User Analytics Optimization**

```javascript
// File: /api/users/analytics.js
// AFTER: Leverage unified_picks and indexes
const getUserAnalytics = async (userId, days = 30) => {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return await supabase
    .from('unified_picks')
    .select(
      `
      status, confidence, potential_payout, sport,
      raw_props!inner(stat_type, player_name)
    `
    )
    .eq('user_id', userId)
    .gte('placed_at', startDate.toISOString())
    .order('placed_at', { ascending: false });
};
```

### **Day 3-4: Implement Cross-Sport Features**

#### **3. Sport-Specific Dashboard**

```javascript
// File: /components/SportDashboard.jsx
import { useState, useEffect } from 'react';

const SportDashboard = ({ sport }) => {
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    const fetchSportAnalytics = async () => {
      // Leverage sport columns in ML tables
      const [evData, dvpData, contests] = await Promise.all([
        supabase.from('ev_modeling').select('*').eq('sport', sport),
        supabase.from('dvp_matchup_ranks').select('*').eq('sport', sport),
        supabase
          .from('contests')
          .select('*')
          .eq('sport', sport)
          .eq('status', 'active'),
      ]);

      setAnalytics({ evData, dvpData, contests });
    };

    fetchSportAnalytics();
  }, [sport]);

  return (
    <div className="sport-dashboard">
      <h2>{sport} Analytics</h2>
      {/* Render sport-specific data */}
    </div>
  );
};
```

#### **4. Enhanced Contest System**

```javascript
// File: /api/contests/create.js
const createSportContest = async contestData => {
  const contest = await supabase
    .from('contests')
    .insert({
      title: contestData.title,
      sport: contestData.sport, // NEW: Sport-specific contests
      status: 'active',
      prize_pool: contestData.prizePool,
      entry_fee: contestData.entryFee,
      max_participants: contestData.maxParticipants,
      start_date: contestData.startDate,
      end_date: contestData.endDate,
    })
    .select()
    .single();

  return contest;
};
```

### **Day 5-7: Database Monitoring Setup**

#### **5. Performance Monitoring**

```javascript
// File: /utils/dbMonitoring.js
const monitorDatabaseHealth = async () => {
  // Check query performance
  const slowQueries = await supabase.rpc('get_slow_queries');

  // Check index usage
  const indexUsage = await supabase.rpc('get_index_usage');

  // Check foreign key violations
  const fkViolations = await supabase.rpc('check_fk_violations');

  return {
    slowQueries,
    indexUsage,
    fkViolations,
    timestamp: new Date(),
  };
};

// Set up monitoring alerts
setInterval(monitorDatabaseHealth, 300000); // Every 5 minutes
```

---

## 📊 **WEEK 2: ANALYTICS ENHANCEMENTS**

### **Day 8-10: Advanced User Analytics**

#### **6. Cross-Sport Performance Analysis**

```javascript
// File: /api/analytics/cross-sport.js
const getCrossSportPerformance = async userId => {
  const performance = await supabase
    .from('unified_picks')
    .select(
      `
      sport,
      status,
      confidence,
      potential_payout,
      placed_at
    `
    )
    .eq('user_id', userId)
    .gte('placed_at', thirtyDaysAgo);

  // Group by sport and calculate metrics
  const sportMetrics = performance.reduce((acc, pick) => {
    if (!acc[pick.sport]) {
      acc[pick.sport] = { wins: 0, total: 0, totalPayout: 0 };
    }

    acc[pick.sport].total++;
    if (pick.status === 'won') {
      acc[pick.sport].wins++;
      acc[pick.sport].totalPayout += pick.potential_payout;
    }

    return acc;
  }, {});

  return Object.entries(sportMetrics).map(([sport, metrics]) => ({
    sport,
    winRate: metrics.wins / metrics.total,
    totalPicks: metrics.total,
    totalPayout: metrics.totalPayout,
  }));
};
```

### **Day 11-14: Enhanced Referral System**

#### **7. Referral Analytics Dashboard**

```javascript
// File: /components/ReferralDashboard.jsx
const ReferralDashboard = () => {
  const [referralData, setReferralData] = useState(null);

  useEffect(() => {
    const fetchReferralAnalytics = async () => {
      // Leverage new foreign key relationships
      const data = await supabase
        .from('referrals')
        .select(
          `
          *,
          referral_rewards(amount, status),
          users!referred_user_id(username, created_at, tier)
        `
        )
        .eq('status', 'completed');

      setReferralData(data);
    };

    fetchReferralAnalytics();
  }, []);

  return (
    <div className="referral-dashboard">
      {/* Render enhanced referral analytics */}
    </div>
  );
};
```

---

## 🤖 **WEEK 3-4: AI/ML ENHANCEMENTS**

### **Day 15-21: Enhanced ScoringAgent**

#### **8. Sport-Specific ML Models**

```python
# File: /ml/sport_specific_models.py
class SportSpecificScoringAgent:
    def __init__(self, sport):
        self.sport = sport
        self.model = self.load_sport_model(sport)

    def extract_features(self, game_date):
        """Extract features using optimized database queries"""
        query = """
        SELECT
            ush.player_name,
            ush.stats,
            dvp.rank as dvp_rank,
            ev.expected_value,
            ev.confidence,
            put.usage_rate
        FROM unified_sports_history ush
        LEFT JOIN dvp_matchup_ranks dvp ON dvp.sport = ush.sport
        LEFT JOIN ev_modeling ev ON ev.sport = ush.sport
        LEFT JOIN player_usage_trends put ON put.sport = ush.sport
        WHERE ush.sport = %s
        AND ush.game_date = %s
        """

        return self.execute_query(query, [self.sport, game_date])

    def grade_props(self, props):
        """Grade props using sport-specific model"""
        features = self.extract_features(props[0]['game_date'])
        return self.model.predict(features)
```

#### **9. Automated RBI Backfill**

```javascript
// File: /jobs/rbi-backfill.js
const processRBIBackfill = async () => {
  const pendingRecords = await supabase
    .from('rbi_backfill_queue')
    .select('*')
    .eq('status', 'pending')
    .limit(100);

  for (const record of pendingRecords) {
    try {
      // Fetch RBI data from external API
      const rbiData = await fetchMLBStats(record.player_name, record.game_date);

      // Update using stored procedure
      await supabase.rpc('update_rbi_data', {
        unified_history_id: record.unified_history_id,
        rbi_value: rbiData.rbi,
        source: 'api',
      });

      console.log(`Updated RBI for ${record.player_name}: ${rbiData.rbi}`);
    } catch (error) {
      console.error('RBI backfill failed:', error);

      // Mark as failed for retry
      await supabase
        .from('rbi_backfill_queue')
        .update({ status: 'failed', error_message: error.message })
        .eq('id', record.id);
    }
  }
};

// Run every hour
setInterval(processRBIBackfill, 3600000);
```

### **Day 22-28: Advanced Analytics**

#### **10. Real-Time Performance Monitoring**

```javascript
// File: /utils/realtime-analytics.js
const setupRealTimeAnalytics = () => {
  // Monitor high-confidence picks
  const highConfidenceChannel = supabase
    .channel('high-confidence-picks')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'unified_picks',
        filter: 'confidence=gte.0.8',
      },
      payload => {
        // Alert system for high-confidence picks
        notifyHighConfidencePick(payload.new);
      }
    )
    .subscribe();

  // Monitor contest updates
  const contestChannel = supabase
    .channel('contest-updates')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'contest_participants',
      },
      payload => {
        updateLeaderboardRealTime(payload.new);
      }
    )
    .subscribe();
};
```

---

## 🏗️ **ONGOING: INFRASTRUCTURE OPTIMIZATIONS**

### **Connection Pool Optimization**

```javascript
// File: /config/database.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Increased for better performance
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});

// Optimized query execution
const executeQuery = async (text, params) => {
  const start = Date.now();
  const client = await pool.connect();

  try {
    const result = await client.query(text, params);
    const duration = Date.now() - start;

    // Log slow queries
    if (duration > 1000) {
      console.warn(`Slow query detected: ${duration}ms`, { text, params });
    }

    return result;
  } finally {
    client.release();
  }
};
```

### **Caching Implementation**

```javascript
// File: /utils/cache.js
const Redis = require('redis');
const client = Redis.createClient(process.env.REDIS_URL);

const cache = {
  // Cache leaderboards (5 minutes)
  async getLeaderboard(contestId) {
    const key = `leaderboard:${contestId}`;
    const cached = await client.get(key);

    if (cached) return JSON.parse(cached);

    const fresh = await supabase
      .from('contest_participants')
      .select('*, users(username)')
      .eq('contest_id', contestId)
      .order('score', { ascending: false })
      .limit(50);

    await client.setex(key, 300, JSON.stringify(fresh));
    return fresh;
  },

  // Cache user analytics (1 hour)
  async getUserAnalytics(userId) {
    const key = `analytics:${userId}`;
    const cached = await client.get(key);

    if (cached) return JSON.parse(cached);

    const fresh = await getCrossSportPerformance(userId);
    await client.setex(key, 3600, JSON.stringify(fresh));
    return fresh;
  },
};
```

---

## 📋 **IMPLEMENTATION CHECKLIST**

### **Week 1: Performance**

- [ ] Update props loading queries
- [ ] Implement sport filtering
- [ ] Add database monitoring
- [ ] Test query performance improvements

### **Week 2: Analytics**

- [ ] Deploy cross-sport analytics
- [ ] Enhance referral dashboard
- [ ] Implement user performance tracking
- [ ] Add sport-specific contests

### **Week 3-4: AI/ML**

- [ ] Deploy sport-specific ML models
- [ ] Implement RBI backfill automation
- [ ] Add real-time analytics
- [ ] Enhance ScoringAgent performance

### **Ongoing: Infrastructure**

- [ ] Optimize connection pooling
- [ ] Implement Redis caching
- [ ] Monitor database health
- [ ] Scale for growth

---

## 🎯 **SUCCESS METRICS**

Track these KPIs to measure success:

- **Performance**: Query times < 100ms for 95% of requests
- **User Engagement**: 20%+ increase in picks per user
- **Contest Participation**: 30%+ increase with sport-specific contests
- **System Reliability**: 99.9% uptime with zero timeout errors
- **Database Health**: Maintain 100/100 health score

**Your enterprise-grade database is ready to power explosive growth!** 🚀

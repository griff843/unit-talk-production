# Business Logic Adjustments Required 🔧

**Critical Updates Needed After Database Transformation**

## ⚠️ **YES - SIGNIFICANT ADJUSTMENTS NEEDED**

Your database transformation introduced new columns, relationships, and data
structures that require updates throughout your application stack.

---

## 🎯 **CRITICAL FRONTEND UPDATES**

### **1. Props Display Components (HIGH PRIORITY)**

Your existing components expect the old data structure. Here's what needs
updating:

#### **Current Issue:**

```javascript
// OLD: Components expect basic props data
const prop = {
  id: '123',
  player_name: 'Player Name',
  stat_type: 'Points',
  line: 25.5,
  odds: -110,
};
```

#### **NEW: Enhanced data structure available**

```javascript
// NEW: Enhanced props with confidence, game context, expected value
const prop = {
  id: '123',
  player_name: 'Player Name',
  stat_type: 'Points',
  line: 25.5,
  odds: -110,
  confidence: 0.85, // NEW
  expected_value: 0.045, // NEW
  game_info: {
    // NEW
    home_team: 'Lakers',
    away_team: 'Warriors',
    game_date: '2025-08-03',
    status: 'scheduled',
  },
};
```

#### **Required Component Updates:**

**File: `components/PropsDisplay.tsx` (or similar)**

```typescript
// ADD: New interfaces for enhanced data
interface EnhancedProp {
  id: string;
  player_name: string;
  stat_type: string;
  line: number;
  odds: number;
  confidence: number;        // NEW
  expected_value: number;    // NEW
  game_info?: {             // NEW
    home_team: string;
    away_team: string;
    game_date: string;
    status: string;
  };
  selection_options: Array<{
    value: string;
    label: string;
    odds: number;
    confidence: number;      // NEW
    expected_value: number;  // NEW
  }>;
}

// UPDATE: Component to display new data
const PropsCard = ({ prop }: { prop: EnhancedProp }) => {
  return (
    <div className="prop-card">
      <h3>{prop.player_name} {prop.stat_type}</h3>

      {/* NEW: Show confidence and expected value */}
      <div className="prop-metrics">
        <Badge variant={prop.confidence >= 0.7 ? 'success' : 'secondary'}>
          {(prop.confidence * 100).toFixed(1)}% Confidence
        </Badge>
        <Badge variant={prop.expected_value > 0 ? 'success' : 'destructive'}>
          EV: {prop.expected_value > 0 ? '+' : ''}{prop.expected_value.toFixed(3)}
        </Badge>
      </div>

      {/* NEW: Show game context */}
      {prop.game_info && (
        <div className="game-context">
          {prop.game_info.away_team} @ {prop.game_info.home_team}
          <span className="game-date">{prop.game_info.game_date}</span>
        </div>
      )}

      {/* UPDATED: Selection options with confidence */}
      <div className="selection-options">
        {prop.selection_options.map(option => (
          <button key={option.value} className="selection-button">
            <span>{option.label}</span>
            <span>{option.odds}</span>
            <small>{(option.confidence * 100).toFixed(1)}%</small>
          </button>
        ))}
      </div>
    </div>
  );
};
```

### **2. User Analytics Components (HIGH PRIORITY)**

#### **Current Issue:**

Your analytics likely don't account for sport-specific performance.

#### **Required Updates:**

**File: `components/UserAnalytics.tsx`**

```typescript
// ADD: Sport-specific analytics interface
interface SportPerformance {
  sport: string;
  total_picks: number;
  wins: number;
  win_rate: number;
  avg_confidence: number;
  total_payout: number;
}

// UPDATE: Component to show cross-sport performance
const UserAnalytics = ({ userId }: { userId: string }) => {
  const [sportPerformance, setSportPerformance] = useState<SportPerformance[]>([]);

  useEffect(() => {
    // NEW: Fetch sport-specific performance
    const fetchSportAnalytics = async () => {
      const performance = await getUserSportPerformance(userId, 30);

      // Group by sport
      const sportStats = performance.reduce((acc, pick) => {
        if (!acc[pick.sport]) {
          acc[pick.sport] = { wins: 0, total: 0, totalPayout: 0, totalConfidence: 0 };
        }
        acc[pick.sport].total++;
        acc[pick.sport].totalConfidence += pick.confidence;
        if (pick.status === 'won') {
          acc[pick.sport].wins++;
          acc[pick.sport].totalPayout += pick.potential_payout;
        }
        return acc;
      }, {});

      const sportPerformanceData = Object.entries(sportStats).map(([sport, stats]) => ({
        sport,
        total_picks: stats.total,
        wins: stats.wins,
        win_rate: stats.wins / stats.total,
        avg_confidence: stats.totalConfidence / stats.total,
        total_payout: stats.totalPayout
      }));

      setSportPerformance(sportPerformanceData);
    };

    fetchSportAnalytics();
  }, [userId]);

  return (
    <div className="user-analytics">
      <h2>Performance by Sport</h2>
      <div className="sport-grid">
        {sportPerformance.map(sport => (
          <div key={sport.sport} className="sport-card">
            <h3>{sport.sport}</h3>
            <div className="metrics">
              <div>Win Rate: {(sport.win_rate * 100).toFixed(1)}%</div>
              <div>Picks: {sport.total_picks}</div>
              <div>Avg Confidence: {(sport.avg_confidence * 100).toFixed(1)}%</div>
              <div>Payout: ${sport.total_payout.toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### **3. Contest Components (MEDIUM PRIORITY)**

#### **Required Updates:**

**File: `components/ContestList.tsx`**

```typescript
// UPDATE: Contest interface to include sport
interface Contest {
  id: string;
  title: string;
  sport: string;           // NEW
  prize_pool: number;
  status: string;
  max_participants: number;
  current_participants: number;
}

// ADD: Sport filtering
const ContestList = () => {
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [contests, setContests] = useState<Contest[]>([]);

  useEffect(() => {
    const fetchContests = async () => {
      // NEW: Use sport-specific contest query
      const contestData = await getSportContests(
        selectedSport === 'all' ? undefined : selectedSport
      );
      setContests(contestData);
    };

    fetchContests();
  }, [selectedSport]);

  return (
    <div className="contest-list">
      {/* NEW: Sport filter */}
      <div className="sport-filter">
        {['all', 'MLB', 'NBA', 'NFL', 'NHL'].map(sport => (
          <button
            key={sport}
            className={selectedSport === sport ? 'active' : ''}
            onClick={() => setSelectedSport(sport)}
          >
            {sport.toUpperCase()}
          </button>
        ))}
      </div>

      {/* UPDATED: Contest cards with sport badges */}
      <div className="contests-grid">
        {contests.map(contest => (
          <div key={contest.id} className="contest-card">
            <div className="contest-header">
              <h3>{contest.title}</h3>
              <Badge>{contest.sport}</Badge>  {/* NEW */}
            </div>
            <div className="contest-details">
              <div>Prize Pool: ${contest.prize_pool}</div>
              <div>Participants: {contest.current_participants}/{contest.max_participants}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

## 🔧 **BACKEND API UPDATES**

### **4. API Response Formats (HIGH PRIORITY)**

#### **Current Issue:**

Your APIs return basic data without the new analytics fields.

#### **Required Updates:**

**File: `api/users/[id]/analytics.ts`**

```typescript
// UPDATE: API to return sport-specific analytics
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const userId = params.id;

  try {
    // NEW: Get sport-specific performance
    const sportPerformance = await getUserSportPerformance(userId, 30);

    // NEW: Get cross-sport analytics
    const crossSportAnalytics = await getCrossSportAnalytics();

    // NEW: Enhanced response format
    return NextResponse.json({
      success: true,
      user_id: userId,
      analytics: {
        sport_performance: sportPerformance,
        cross_sport_comparison: crossSportAnalytics,
        overall_metrics: {
          total_picks: sportPerformance.length,
          sports_active: [...new Set(sportPerformance.map(p => p.sport))],
          avg_confidence:
            sportPerformance.reduce((sum, p) => sum + p.confidence, 0) /
            sportPerformance.length,
        },
      },
      // NEW: Performance metadata
      query_performance: {
        uses_foreign_keys: true,
        optimized_indexes: true,
        response_time_ms: Date.now() - startTime,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

### **5. Contest Management APIs (MEDIUM PRIORITY)**

**File: `api/contests/create.ts`**

```typescript
// UPDATE: Contest creation to include sport
export async function POST(request: Request) {
  const body = await request.json();

  // NEW: Validate sport field
  const contestData = {
    title: body.title,
    sport: body.sport, // NEW - Required field
    prize_pool: body.prize_pool,
    entry_fee: body.entry_fee,
    max_participants: body.max_participants,
    start_date: body.start_date,
    end_date: body.end_date,
    status: 'active',
  };

  // NEW: Validate sport is valid
  const validSports = ['MLB', 'NBA', 'NFL', 'NHL'];
  if (!validSports.includes(contestData.sport)) {
    return NextResponse.json(
      { success: false, error: 'Invalid sport specified' },
      { status: 400 }
    );
  }

  try {
    const contest = await createSportContest(contestData);
    return NextResponse.json({ success: true, contest });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

---

## 🤖 **ML/AI AGENT UPDATES**

### **6. GradingAgent Updates (HIGH PRIORITY)**

#### **Current Issue:**

Your GradingAgent likely doesn't use the new confidence and expected_value
fields.

#### **Required Updates:**

**File: `agents/GradingAgent/index.ts`**

```typescript
// UPDATE: GradingAgent to use enhanced data
class GradingAgent {
  async gradeProp(propId: string): Promise<GradingResult> {
    // NEW: Get prop with game context via foreign key
    const { data: prop } = await this.supabase
      .from('raw_props')
      .select(
        `
        *,
        games!inner(home_team, away_team, game_date, status)
      `
      )
      .eq('id', propId)
      .single();

    if (!prop) throw new Error('Prop not found');

    // NEW: Use sport-specific ML model
    const mlModel = this.getModelForSport(prop.sport);

    // NEW: Extract features including game context
    const features = this.extractEnhancedFeatures(prop);

    // NEW: Get sport-specific historical data
    const historicalData = await this.getHistoricalData(
      prop.sport,
      prop.player_name,
      prop.stat_type
    );

    // Grade the prop
    const grade = await mlModel.predict(features, historicalData);

    // NEW: Store enhanced grading result
    const result = {
      prop_id: propId,
      confidence: grade.confidence,
      expected_value: grade.expected_value,
      sport: prop.sport, // NEW
      game_context: prop.games, // NEW
      model_version: mlModel.version,
      features_used: features,
      created_at: new Date(),
    };

    // NEW: Update prop with confidence and EV
    await this.supabase
      .from('raw_props')
      .update({
        confidence: result.confidence,
        expected_value: result.expected_value,
      })
      .eq('id', propId);

    return result;
  }

  // NEW: Sport-specific model selection
  private getModelForSport(sport: string) {
    switch (sport) {
      case 'MLB':
        return this.mlbModel;
      case 'NBA':
        return this.nbaModel;
      case 'NFL':
        return this.nflModel;
      case 'NHL':
        return this.nhlModel;
      default:
        return this.genericModel;
    }
  }
}
```

### **7. ContestAgent Updates (MEDIUM PRIORITY)**

**File: `agents/ContestAgent/leaderboards.ts`**

```typescript
// UPDATE: Leaderboard to use sport-specific data
class LeaderboardManager {
  async updateLeaderboard(contestId: string): Promise<void> {
    // NEW: Get contest sport
    const { data: contest } = await this.supabase
      .from('contests')
      .select('sport')
      .eq('id', contestId)
      .single();

    if (!contest) return;

    // NEW: Get participants with sport-specific performance
    const { data: participants } = await this.supabase
      .from('contest_participants')
      .select(
        `
        *,
        users(username, tier),
        unified_picks!inner(
          sport,
          status,
          confidence,
          potential_payout
        )
      `
      )
      .eq('contest_id', contestId)
      .eq('unified_picks.sport', contest.sport); // NEW: Filter by contest sport

    // Calculate sport-specific scores
    const updatedParticipants = participants.map(participant => {
      const sportPicks = participant.unified_picks.filter(
        pick => pick.sport === contest.sport
      );
      const score = this.calculateSportSpecificScore(sportPicks);

      return {
        ...participant,
        score,
        sport_performance: {
          picks_count: sportPicks.length,
          wins: sportPicks.filter(p => p.status === 'won').length,
          avg_confidence:
            sportPicks.reduce((sum, p) => sum + p.confidence, 0) /
            sportPicks.length,
        },
      };
    });

    // Update leaderboard with enhanced data
    await this.updateLeaderboardRankings(contestId, updatedParticipants);
  }
}
```

---

## 📱 **MOBILE APP UPDATES**

### **8. React Native Components (if applicable)**

If you have a mobile app, similar updates are needed:

```typescript
// UPDATE: Mobile props component
const PropsScreen = () => {
  const [props, setProps] = useState([]);
  const [selectedSport, setSelectedSport] = useState('MLB');

  const fetchProps = async () => {
    // NEW: Use optimized API with sport filtering
    const response = await fetch(`/api/props?sport=${selectedSport}`);
    const data = await response.json();

    // NEW: Handle enhanced prop data
    setProps(data.props.map(prop => ({
      ...prop,
      hasConfidence: prop.confidence > 0,
      isHighConfidence: prop.confidence >= 0.7,
      hasPositiveEV: prop.expected_value > 0
    })));
  };

  return (
    <View>
      {/* NEW: Sport selector */}
      <SportSelector
        selectedSport={selectedSport}
        onSportChange={setSelectedSport}
      />

      {/* UPDATED: Props list with confidence indicators */}
      <FlatList
        data={props}
        renderItem={({ item }) => (
          <PropCard
            prop={item}
            showConfidence={true}    // NEW
            showExpectedValue={true} // NEW
            showGameContext={true}   // NEW
          />
        )}
      />
    </View>
  );
};
```

---

## 🎯 **IMPLEMENTATION PRIORITY**

### **WEEK 1 (Critical - Do First):**

1. ✅ **Props Display Components** - Show confidence and expected value
2. ✅ **API Response Updates** - Include new fields in responses
3. ✅ **User Analytics** - Add sport-specific performance

### **WEEK 2 (High Priority):**

4. **Contest Components** - Add sport filtering and display
5. **GradingAgent Updates** - Use enhanced data for ML
6. **Mobile App Updates** - If applicable

### **WEEK 3 (Medium Priority):**

7. **ContestAgent Updates** - Sport-specific leaderboards
8. **Additional Analytics** - Cross-sport comparisons
9. **Performance Monitoring** - Track optimization benefits

---

## ✅ **TESTING YOUR UPDATES**

After making these changes:

1. **Run the test script**: `node test-optimized-queries.js`
2. **Check API responses** include new fields
3. **Verify UI displays** confidence and expected value
4. **Test sport filtering** in contests and analytics
5. **Monitor performance** improvements

**Your business logic updates will unlock the full power of your
enterprise-grade database transformation!** 🚀

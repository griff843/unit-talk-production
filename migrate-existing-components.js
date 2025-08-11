#!/usr/bin/env node

/**
 * Component Migration Script
 * Automatically updates existing components to use new database structure
 */

const fs = require('fs');
const path = require('path');

const COMPONENT_UPDATES = {
  // Props-related component updates
  props: {
    // Add new interfaces
    interfaces: `
interface EnhancedProp {
  id: string;
  player_name: string;
  stat_type: string;
  line: number;
  odds: number;
  confidence: number;        // NEW
  expected_value: number;    // NEW
  sport: string;            // NEW
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
}`,

    // Component enhancements
    enhancements: `
// NEW: Confidence badge component
const ConfidenceBadge = ({ confidence }: { confidence: number }) => {
  const getVariant = (conf: number) => {
    if (conf >= 0.8) return 'success';
    if (conf >= 0.6) return 'warning';
    return 'secondary';
  };

  return (
    <Badge variant={getVariant(confidence)}>
      {(confidence * 100).toFixed(1)}% Confidence
    </Badge>
  );
};

// NEW: Expected Value badge component  
const ExpectedValueBadge = ({ expectedValue }: { expectedValue: number }) => (
  <Badge variant={expectedValue > 0 ? 'success' : 'destructive'}>
    EV: {expectedValue > 0 ? '+' : ''}{expectedValue.toFixed(3)}
  </Badge>
);

// NEW: Game context component
const GameContext = ({ gameInfo }: { gameInfo: any }) => {
  if (!gameInfo) return null;
  
  return (
    <div className="game-context text-sm text-muted-foreground">
      {gameInfo.away_team} @ {gameInfo.home_team}
      <span className="ml-2">{new Date(gameInfo.game_date).toLocaleDateString()}</span>
    </div>
  );
};`
  },

  // Analytics component updates
  analytics: {
    interfaces: `
interface SportPerformance {
  sport: string;
  total_picks: number;
  wins: number;
  win_rate: number;
  avg_confidence: number;
  total_payout: number;
}

interface CrossSportAnalytics {
  sport: string;
  confidence: number;
  expected_value: number;
  created_at: string;
}`,

    components: `
// NEW: Sport performance card
const SportPerformanceCard = ({ sport, performance }: { sport: string, performance: SportPerformance }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        {sport}
        <Badge variant="outline">{performance.total_picks} picks</Badge>
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span>Win Rate:</span>
          <Badge variant={performance.win_rate >= 0.6 ? 'success' : 'secondary'}>
            {(performance.win_rate * 100).toFixed(1)}%
          </Badge>
        </div>
        <div className="flex justify-between">
          <span>Avg Confidence:</span>
          <span>{(performance.avg_confidence * 100).toFixed(1)}%</span>
        </div>
        <div className="flex justify-between">
          <span>Total Payout:</span>
          <span className="font-medium">$\{performance.total_payout.toFixed(2)}</span>
        </div>
      </div>
    </CardContent>
  </Card>
);`
  },

  // Contest component updates
  contests: {
    interfaces: `
interface EnhancedContest {
  id: string;
  title: string;
  sport: string;           // NEW
  prize_pool: number;
  status: string;
  max_participants: number;
  current_participants: number;
  entry_fee: number;
  start_date: string;
  end_date: string;
}`,

    components: `
// NEW: Sport filter component
const SportFilter = ({ selectedSport, onSportChange }: { 
  selectedSport: string, 
  onSportChange: (sport: string) => void 
}) => {
  const sports = ['all', 'MLB', 'NBA', 'NFL', 'NHL'];
  
  return (
    <div className="flex gap-2 mb-4">
      {sports.map(sport => (
        <Button
          key={sport}
          variant={selectedSport === sport ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSportChange(sport)}
        >
          {sport.toUpperCase()}
        </Button>
      ))}
    </div>
  );
};

// UPDATED: Contest card with sport badge
const ContestCard = ({ contest }: { contest: EnhancedContest }) => (
  <Card>
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle>{contest.title}</CardTitle>
        <Badge>{contest.sport}</Badge>
      </div>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span>Prize Pool:</span>
          <span className="font-bold">$\{contest.prize_pool}</span>
        </div>
        <div className="flex justify-between">
          <span>Entry Fee:</span>
          <span>$\{contest.entry_fee}</span>
        </div>
        <div className="flex justify-between">
          <span>Participants:</span>
          <span>\{contest.current_participants}/\{contest.max_participants}</span>
        </div>
      </div>
    </CardContent>
  </Card>
);`
  }
};

const API_UPDATES = {
  props: `
// UPDATED: Props API with enhanced data
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get('sport') || 'MLB';
  const gameId = searchParams.get('game_id');

  try {
    const { data: props, error } = await supabase
      .from('raw_props')
      .select(\`
        *,
        games!inner(
          home_team, away_team, game_date, status, game_time
        )
      \`)
      .eq('sport', sport)
      .not('game_id', 'is', null)
      .order('confidence', { ascending: false })
      .limit(100);

    if (error) throw error;

    const enhancedProps = props.map(prop => ({
      ...prop,
      game_info: prop.games,
      selection_options: prop.line ? [
        { 
          value: 'over', 
          label: \`Over \${prop.line}\`, 
          odds: prop.over_odds || prop.odds,
          confidence: prop.confidence || 0,
          expected_value: prop.expected_value || 0
        },
        { 
          value: 'under', 
          label: \`Under \${prop.line}\`, 
          odds: prop.under_odds || (prop.odds ? -(Math.abs(prop.odds) + 20) : null),
          confidence: prop.confidence || 0,
          expected_value: prop.expected_value || 0
        }
      ] : [
        { 
          value: 'yes', 
          label: 'Yes', 
          odds: prop.odds,
          confidence: prop.confidence || 0,
          expected_value: prop.expected_value || 0
        },
        { 
          value: 'no', 
          label: 'No', 
          odds: prop.odds ? -(Math.abs(prop.odds) + 20) : null,
          confidence: prop.confidence || 0,
          expected_value: prop.expected_value || 0
        }
      ]
    }));

    return NextResponse.json({
      success: true,
      props: enhancedProps,
      count: enhancedProps.length,
      analytics: {
        avg_confidence: enhancedProps.reduce((sum, p) => sum + (p.confidence || 0), 0) / enhancedProps.length,
        high_confidence_count: enhancedProps.filter(p => (p.confidence || 0) >= 0.7).length,
        positive_ev_count: enhancedProps.filter(p => (p.expected_value || 0) > 0).length
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}`,

  analytics: `
// NEW: Enhanced user analytics API
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const userId = params.id;
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '30');

  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: picks, error } = await supabase
      .from('unified_picks')
      .select(\`
        sport,
        status,
        confidence,
        potential_payout,
        placed_at,
        raw_props!inner(stat_type, player_name)
      \`)
      .eq('user_id', userId)
      .gte('placed_at', startDate)
      .order('placed_at', { ascending: false });

    if (error) throw error;

    // Group by sport
    const sportPerformance = picks.reduce((acc, pick) => {
      if (!acc[pick.sport]) {
        acc[pick.sport] = { 
          total_picks: 0, 
          wins: 0, 
          total_payout: 0, 
          total_confidence: 0 
        };
      }
      
      acc[pick.sport].total_picks++;
      acc[pick.sport].total_confidence += pick.confidence || 0;
      
      if (pick.status === 'won') {
        acc[pick.sport].wins++;
        acc[pick.sport].total_payout += pick.potential_payout || 0;
      }
      
      return acc;
    }, {});

    const sportAnalytics = Object.entries(sportPerformance).map(([sport, stats]) => ({
      sport,
      total_picks: stats.total_picks,
      wins: stats.wins,
      win_rate: stats.wins / stats.total_picks,
      avg_confidence: stats.total_confidence / stats.total_picks,
      total_payout: stats.total_payout
    }));

    return NextResponse.json({
      success: true,
      user_id: userId,
      period_days: days,
      sport_performance: sportAnalytics,
      overall_metrics: {
        total_picks: picks.length,
        overall_win_rate: picks.filter(p => p.status === 'won').length / picks.length,
        sports_active: Object.keys(sportPerformance),
        avg_confidence: picks.reduce((sum, p) => sum + (p.confidence || 0), 0) / picks.length
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}`
};

function createMigrationFiles() {
  console.log('🔧 Creating component migration files...\n');

  // Create component templates
  Object.entries(COMPONENT_UPDATES).forEach(([category, updates]) => {
    const fileName = \`enhanced-\${category}-components.tsx\`;
    const content = \`// Enhanced \${category.toUpperCase()} Components
// Generated by migration script - integrate these into your existing components

\${updates.interfaces || ''}

\${updates.enhancements || ''}

\${updates.components || ''}

// Usage Examples:
// 1. Replace existing interfaces with enhanced versions
// 2. Add new badge components to your prop displays
// 3. Include sport filtering in contest components
// 4. Update analytics to show sport-specific performance
\`;

    fs.writeFileSync(fileName, content);
    console.log(\`✅ Created \${fileName}\`);
  });

  // Create API templates
  Object.entries(API_UPDATES).forEach(([category, code]) => {
    const fileName = \`enhanced-\${category}-api.ts\`;
    const content = \`// Enhanced \${category.toUpperCase()} API
// Generated by migration script - replace your existing API with this enhanced version

\${code}
\`;

    fs.writeFileSync(fileName, content);
    console.log(\`✅ Created \${fileName}\`);
  });

  // Create migration checklist
  const checklist = \`# Component Migration Checklist

## ✅ Files Created:
- enhanced-props-components.tsx
- enhanced-analytics-components.tsx  
- enhanced-contests-components.tsx
- enhanced-props-api.ts
- enhanced-analytics-api.ts

## 🎯 Next Steps:

### 1. Props Components (HIGH PRIORITY)
- [ ] Update your props display components to use EnhancedProp interface
- [ ] Add ConfidenceBadge and ExpectedValueBadge to prop cards
- [ ] Include GameContext component to show game information
- [ ] Test that confidence and expected value display correctly

### 2. Analytics Components (HIGH PRIORITY)  
- [ ] Update user analytics to use SportPerformance interface
- [ ] Add SportPerformanceCard component to show sport-specific metrics
- [ ] Update analytics API to return sport-specific data
- [ ] Test cross-sport performance comparisons

### 3. Contest Components (MEDIUM PRIORITY)
- [ ] Update contest interfaces to include sport field
- [ ] Add SportFilter component for sport-specific filtering
- [ ] Update ContestCard to display sport badges
- [ ] Test sport-specific contest filtering

### 4. API Updates (HIGH PRIORITY)
- [ ] Replace props API with enhanced version
- [ ] Replace analytics API with sport-specific version
- [ ] Update all API responses to include new fields
- [ ] Test API performance improvements

### 5. Testing (CRITICAL)
- [ ] Run test-optimized-queries.js to verify database performance
- [ ] Test all updated components render correctly
- [ ] Verify new data fields display properly
- [ ] Check that sport filtering works
- [ ] Monitor query performance improvements

## 🚨 Breaking Changes:
- Props now include confidence and expected_value fields
- Analytics APIs return sport-specific data
- Contest APIs require sport parameter
- Selection options include confidence and expected_value

## 📞 Need Help?
If you encounter issues:
1. Check console for errors
2. Verify database has confidence/expected_value columns
3. Ensure foreign key relationships are working
4. Run the test script to validate optimizations
\`;

  fs.writeFileSync('MIGRATION-CHECKLIST.md', checklist);
  console.log('✅ Created MIGRATION-CHECKLIST.md');

  console.log('\n🎉 Migration files created successfully!');
  console.log('\n📋 Next steps:');
  console.log('1. Review the enhanced component files');
  console.log('2. Integrate the new interfaces and components');
  console.log('3. Update your APIs with the enhanced versions');
  console.log('4. Follow the MIGRATION-CHECKLIST.md');
  console.log('5. Test everything works correctly');
  console.log('\n🚀 Your components will then leverage the full power of your optimized database!');
}

// Run the migration
createMigrationFiles();

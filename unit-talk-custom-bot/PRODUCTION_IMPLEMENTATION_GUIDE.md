# Production Implementation Guide

## Phase 1: Critical Database & API Integrations (Week 1-2)

### 1. Replace Mock Database Operations

#### Current Issues:
- All services use mock database calls
- No real user tier validation
- Pick data not actually stored
- User statistics are hardcoded

#### Implementation Steps:

**A. Update Supabase Service Connection**
```typescript
// src/services/database.ts
import { createClient } from '@supabase/supabase-js';
import { Database } from '../db/types/supabase-complete';

export class DatabaseService {
  private supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  async getUserTier(discordId: string): Promise<UserTier> {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .select('tier')
      .eq('discord_id', discordId)
      .single();
    
    if (error || !data) return 'free';
    return data.tier as UserTier;
  }

  async saveUserPick(pickData: PickData): Promise<string> {
    const { data, error } = await this.supabase
      .from('user_picks')
      .insert({
        user_id: pickData.userId,
        sport: pickData.sport,
        bet_type: pickData.betType,
        selection: pickData.selection,
        odds: pickData.odds,
        stake: pickData.stake,
        confidence: pickData.confidence,
        reasoning: pickData.reasoning
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to save pick: ${error.message}`);
    return data.id;
  }

  async getUserStats(discordId: string): Promise<UserStats> {
    const { data, error } = await this.supabase
      .from('user_picks')
      .select('*')
      .eq('discord_id', discordId);

    if (error) throw new Error(`Failed to get user stats: ${error.message}`);
    
    return this.calculateStats(data);
  }
}
```

**B. Update Command Files**
Replace mock database calls in:
- `enhanced-pick.ts` (lines 35-52)
- `validation.ts` (lines 562-585)
- All other services using mock data

### 2. Integrate Real Sports Data API

#### Replace Mock Sports Data Service

**A. ESPN API Integration**
```typescript
// src/services/sportsData.ts
export class SportsDataService {
  private readonly ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports';
  private cache = new Map<string, { data: any; expires: number }>();

  async searchPlayers(query: string, sport: string): Promise<PlayerSearchResult[]> {
    const cacheKey = `players_${sport}_${query}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(
        `${this.ESPN_API_BASE}/${sport}/athletes?search=${encodeURIComponent(query)}`
      );
      
      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`);
      }

      const data = await response.json();
      const players = this.normalizePlayerData(data, sport);
      
      this.setCache(cacheKey, players, 300000); // 5 minutes
      return players;
    } catch (error) {
      console.error('Error fetching player data:', error);
      throw new Error('Failed to fetch player data');
    }
  }

  async getGameSchedule(sport: string, date?: string): Promise<GameSearchResult[]> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const cacheKey = `games_${sport}_${targetDate}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(
        `${this.ESPN_API_BASE}/${sport}/scoreboard?dates=${targetDate.replace(/-/g, '')}`
      );
      
      const data = await response.json();
      const games = this.normalizeGameData(data, sport);
      
      this.setCache(cacheKey, games, 600000); // 10 minutes
      return games;
    } catch (error) {
      console.error('Error fetching game data:', error);
      throw new Error('Failed to fetch game schedule');
    }
  }

  private normalizePlayerData(data: any, sport: string): PlayerSearchResult[] {
    // Implementation specific to ESPN API response format
    return data.athletes?.map((athlete: any) => ({
      id: athlete.id,
      name: athlete.displayName,
      team: athlete.team?.abbreviation || 'N/A',
      position: athlete.position?.abbreviation || 'N/A',
      sport: sport.toUpperCase()
    })) || [];
  }
}
```

**B. Add Environment Variables**
```env
# .env
ESPN_API_KEY=your_espn_api_key
ODDS_API_KEY=your_odds_api_key
OPENAI_API_KEY=your_openai_api_key
```

### 3. Basic User Tier Validation

**Update all commands to use real database:**
```typescript
// Example: ask-unit-talk.ts
export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const databaseService = new DatabaseService();
    const userTier = await databaseService.getUserTier(interaction.user.id);
    
    if (!['vip', 'vip_plus', 'trial'].includes(userTier)) {
      // Show upgrade message
      return;
    }
    
    // Continue with real logic...
  } catch (error) {
    console.error('Database error:', error);
    await interaction.reply({ 
      content: '❌ Database error. Please try again later.', 
      ephemeral: true 
    });
  }
}
```

---

## Phase 2: AI Integration & Core Features (Week 3-4)

### 1. AI Coaching System (ask-unit-talk.ts)

**A. OpenAI Integration**
```typescript
// src/services/aiCoaching.ts
import OpenAI from 'openai';

export class AICoachingService {
  private openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  async analyzeQuestion(
    question: string, 
    userTier: UserTier, 
    userHistory?: UserStats
  ): Promise<AICoachingResponse> {
    const systemPrompt = this.buildSystemPrompt(userTier, userHistory);
    
    try {
      const completion = await this.openai.chat.completions.create({
        model: userTier === 'vip_plus' ? 'gpt-4' : 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        max_tokens: userTier === 'vip_plus' ? 800 : 400,
        temperature: 0.7
      });

      return this.parseAIResponse(completion.choices[0].message.content);
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error('AI analysis temporarily unavailable');
    }
  }

  private buildSystemPrompt(userTier: UserTier, userHistory?: UserStats): string {
    const basePrompt = `You are a professional sports betting analyst and coach. 
    Provide detailed, actionable advice for betting questions.`;
    
    const tierPrompts = {
      trial: `${basePrompt} Keep responses concise and educational.`,
      vip: `${basePrompt} Provide detailed analysis with specific recommendations.`,
      vip_plus: `${basePrompt} Provide advanced analysis including market inefficiencies, 
      statistical models, and professional-level insights.`
    };

    let prompt = tierPrompts[userTier];
    
    if (userHistory) {
      prompt += `\n\nUser's betting history: ${userHistory.totalPicks} picks, 
      ${(userHistory.winRate * 100).toFixed(1)}% win rate, 
      $${userHistory.profit} profit/loss.`;
    }

    return prompt;
  }
}
```

**B. Update ask-unit-talk.ts**
```typescript
// Replace lines 35-55 with:
const aiCoachingService = new AICoachingService();
const databaseService = new DatabaseService();

const userStats = await databaseService.getUserStats(interaction.user.id);
const aiResponse = await aiCoachingService.analyzeQuestion(question, userTier, userStats);

const embed = new EmbedBuilder()
  .setTitle('🧠 Unit Talk AI Coach')
  .setDescription(`**Your Question:** ${question}\n\n${aiResponse.analysis}`)
  .setColor(userTier === 'vip_plus' ? 0xff4500 : userTier === 'vip' ? 0xffd700 : 0x00ffff)
  .setFooter({ text: `${userTier.toUpperCase()} AI Analysis | Powered by ${aiResponse.model}` });
```

### 2. Real Odds Integration (edge-tracker.ts)

**A. Odds API Service**
```typescript
// src/services/oddsApi.ts
export class OddsApiService {
  private readonly API_BASE = 'https://api.the-odds-api.com/v4';
  private readonly API_KEY = process.env.ODDS_API_KEY;

  async getLiveOdds(sport: string): Promise<LiveOddsData[]> {
    try {
      const response = await fetch(
        `${this.API_BASE}/sports/${sport}/odds?apiKey=${this.API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`
      );

      if (!response.ok) {
        throw new Error(`Odds API error: ${response.status}`);
      }

      const data = await response.json();
      return this.normalizeOddsData(data);
    } catch (error) {
      console.error('Error fetching odds:', error);
      throw new Error('Failed to fetch live odds');
    }
  }

  async calculateEdges(odds: LiveOddsData[]): Promise<EdgeAnalysis[]> {
    const edges: EdgeAnalysis[] = [];
    
    for (const game of odds) {
      // Calculate edge using closing line value and market efficiency
      const gameEdges = await this.analyzeGameEdges(game);
      edges.push(...gameEdges);
    }

    return edges.sort((a, b) => b.edgePercentage - a.edgePercentage);
  }

  private async analyzeGameEdges(game: LiveOddsData): Promise<EdgeAnalysis[]> {
    // Implement edge calculation logic
    // Compare current odds to fair value estimates
    // Factor in market movement and volume
    return [];
  }
}
```

**B. Update edge-tracker.ts**
```typescript
// Replace lines 28-46 with:
const oddsService = new OddsApiService();
const edges = await oddsService.calculateEdges(await oddsService.getLiveOdds('basketball_nba'));

const topEdges = edges.slice(0, 5);
const edgeDescription = topEdges.map(edge => 
  `🔥 **${edge.game}**\n• **${edge.selection}** | Edge: +${edge.edgePercentage.toFixed(1)}% | Confidence: ${edge.confidence}%\n• ${edge.reasoning}\n`
).join('\n');

const embed = new EmbedBuilder()
  .setTitle('⚡ Daily Edge Tracker')
  .setDescription(`**Today's Top Edges:**\n\n${edgeDescription}`)
  .setColor(0xff4500)
  .setFooter({ text: `VIP+ Edge Tracker | Last updated: ${new Date().toLocaleTimeString()}` });
```

### 3. Pick Storage System (enhanced-pick.ts)

**Replace mock database (lines 35-52) with real implementation:**
```typescript
const databaseService = new DatabaseService();
const sportsDataService = new SportsDataService();
const aiAnalysisService = new AIAnalysisService();

// Remove mock database object entirely
// Update all database calls to use real service
```

---

## Phase 3: Advanced Analytics (Week 5-8)

### 1. EV Calculation Engine (ev-report.ts)

**A. Expected Value Service**
```typescript
// src/services/expectedValue.ts
export class ExpectedValueService {
  async calculateEV(
    selection: string,
    odds: number,
    trueWinProbability: number
  ): Promise<number> {
    const impliedProbability = this.oddsToImpliedProbability(odds);
    const expectedValue = (trueWinProbability * this.oddsToDecimal(odds)) - 1;
    
    return expectedValue;
  }

  async getTopEVPlays(sport: string, minEV: number = 0.02): Promise<EVPlay[]> {
    const oddsService = new OddsApiService();
    const liveOdds = await oddsService.getLiveOdds(sport);
    
    const evPlays: EVPlay[] = [];
    
    for (const game of liveOdds) {
      const gameEVs = await this.analyzeGameEV(game);
      evPlays.push(...gameEVs.filter(play => play.ev >= minEV));
    }

    return evPlays.sort((a, b) => b.ev - a.ev);
  }

  private async analyzeGameEV(game: LiveOddsData): Promise<EVPlay[]> {
    // Use historical data and models to estimate true win probability
    // Compare to market odds to find positive EV opportunities
    return [];
  }
}
```

### 2. Trend Analysis ML Model (trend-breaker.ts)

**A. Pattern Recognition Service**
```typescript
// src/services/trendAnalysis.ts
export class TrendAnalysisService {
  async analyzeTrendBreaks(sport: string): Promise<TrendBreak[]> {
    const historicalData = await this.getHistoricalData(sport);
    const currentGames = await this.getCurrentGames(sport);
    
    const trendBreaks: TrendBreak[] = [];
    
    for (const game of currentGames) {
      const patterns = await this.identifyPatterns(game, historicalData);
      const breaks = this.detectBreaks(patterns);
      trendBreaks.push(...breaks);
    }

    return trendBreaks.sort((a, b) => b.confidence - a.confidence);
  }

  private async identifyPatterns(
    game: GameData, 
    historical: HistoricalData[]
  ): Promise<Pattern[]> {
    // Machine learning pattern recognition
    // Analyze player performance vs specific opponents
    // Factor in situational variables (rest, travel, weather)
    return [];
  }
}
```

---

## Phase 4: Real-time Systems (Week 9-12)

### 1. Heat Signal Monitoring (heat-signal.ts)

**A. Line Movement Tracker**
```typescript
// src/services/lineMovement.ts
export class LineMovementService {
  private movements: Map<string, LineMovement[]> = new Map();

  async startMonitoring(): Promise<void> {
    setInterval(async () => {
      await this.checkLineMovements();
    }, 30000); // Check every 30 seconds
  }

  private async checkLineMovements(): Promise<void> {
    const oddsService = new OddsApiService();
    const currentOdds = await oddsService.getAllSports();
    
    for (const sport of currentOdds) {
      await this.detectMovements(sport);
    }
  }

  async getActiveAlerts(): Promise<HeatSignal[]> {
    const alerts: HeatSignal[] = [];
    const now = Date.now();
    
    for (const [gameId, movements] of this.movements) {
      const recentMovements = movements.filter(m => now - m.timestamp < 3600000); // 1 hour
      
      if (this.isSteamMove(recentMovements)) {
        alerts.push(this.createHeatSignal(gameId, recentMovements));
      }
    }

    return alerts.sort((a, b) => b.intensity - a.intensity);
  }
}
```

---

## Implementation Checklist

### Week 1-2: Foundation
- [ ] Set up Supabase connection with complete types
- [ ] Replace all mock database calls
- [ ] Integrate ESPN API for sports data
- [ ] Implement real user tier validation
- [ ] Add proper error handling and logging

### Week 3-4: Core Features  
- [ ] Integrate OpenAI for AI coaching
- [ ] Connect to odds API for edge tracking
- [ ] Build pick storage and retrieval system
- [ ] Implement basic EV calculations
- [ ] Add user statistics tracking

### Week 5-8: Advanced Analytics
- [ ] Build ML models for trend analysis
- [ ] Implement comprehensive EV engine
- [ ] Add historical data analysis
- [ ] Create pattern recognition system
- [ ] Build confidence scoring algorithms

### Week 9-12: Real-time Systems
- [ ] Implement line movement monitoring
- [ ] Build steam detection algorithms
- [ ] Add real-time alert system
- [ ] Create performance tracking dashboard
- [ ] Implement A/B testing framework

### Ongoing: Quality & Monitoring
- [ ] Add comprehensive test coverage
- [ ] Implement system monitoring
- [ ] Set up error tracking and alerts
- [ ] Build performance analytics
- [ ] Create user feedback system

This implementation guide provides the technical roadmap for transforming placeholder logic into production-ready betting automation features.
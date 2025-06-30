# AI Coaching Integration

This document describes the AI coaching functionality integrated into the Unit Talk Discord bot, providing personalized betting analysis and coaching sessions.

## Overview

The AI coaching system provides:
- **Personalized Analysis**: AI-powered betting analysis based on user history and tier
- **Session Management**: Persistent coaching sessions with Q&A tracking
- **Tier-Based Features**: Different analysis depth based on user subscription tier
- **Multi-Provider Support**: OpenAI and Claude integration with fallback logic
- **Database Persistence**: All sessions and interactions stored in Supabase

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Discord Bot   │───▶│  AI Coaching     │───▶│   AI Providers  │
│  (ask-unit-talk)│    │    Service       │    │ (OpenAI/Claude) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Database       │    │  Session         │    │   Fallback      │
│  Service        │    │  Management      │    │   Analysis      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Components

### 1. AICoachingService (`src/services/aiCoaching.ts`)

Main service handling AI analysis and session management:

```typescript
// Generate AI analysis
const analysis = await aiCoachingService.generateAnalysis({
  question: "Should I bet the over on LeBron James 25.5 points?",
  userTier: 'vip',
  userHistory: {
    totalPicks: 15,
    winRate: 0.67,
    totalProfit: 12.5,
    recentPicks: [...]
  }
});

// Create coaching session
const sessionId = await aiCoachingService.createCoachingSession(
  userId, 
  discordId, 
  'ai_analysis', 
  'vip'
);

// Add Q&A to session
await aiCoachingService.addQuestionToSession(sessionId, question, analysis);
```

### 2. Database Integration (`src/services/database.ts`)

Extended database service with coaching session methods:

```typescript
// Create coaching session
const session = await databaseService.createCoachingSession({
  user_id: userId,
  discord_id: discordId,
  session_type: 'ai_analysis',
  status: 'in_progress',
  user_tier: 'vip'
});

// Get user's coaching history
const sessions = await databaseService.getUserCoachingSessions(discordId, {
  limit: 10,
  status: 'completed'
});

// Get coaching statistics
const stats = await databaseService.getCoachingSessionStats(discordId);
```

### 3. Discord Command (`src/commands/ask-unit-talk.ts`)

Enhanced Discord slash command with AI integration:

```typescript
// Command: /ask-unit-talk question:"Should I bet the over?" context:"NBA Lakers vs Warriors"
export async function execute(interaction: ChatInputCommandInteraction) {
  // 1. Validate user tier and cooldown
  // 2. Fetch user betting history
  // 3. Generate AI analysis
  // 4. Create/update coaching session
  // 5. Send response with action buttons
}
```

## User Tiers & Features

### Member (Free)
- ❌ No access to AI coaching
- Redirected to VIP upgrade information

### VIP
- ✅ Basic AI analysis
- ✅ 2-minute cooldown
- ✅ Session history
- ✅ Risk assessment

### VIP Plus
- ✅ Advanced AI analysis
- ✅ 30-second cooldown
- ✅ Follow-up question suggestions
- ✅ Detailed performance insights
- ✅ Priority AI provider access

### Staff/Admin/Owner
- ✅ All VIP Plus features
- ✅ Minimal/no cooldown
- ✅ Debug information
- ✅ System monitoring access

## AI Providers

### OpenAI Integration
```typescript
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const completion = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ],
  temperature: 0.7,
  max_tokens: 1000
});
```

### Claude Integration
```typescript
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const message = await anthropic.messages.create({
  model: "claude-3-sonnet-20240229",
  max_tokens: 1000,
  messages: [
    { role: "user", content: prompt }
  ]
});
```

### Fallback Logic
When AI providers are unavailable:
```typescript
function generateFallbackAnalysis(request: AIAnalysisRequest): AIAnalysisResponse {
  // Rule-based analysis using user history and betting patterns
  // Provides basic insights without AI dependency
}
```

## Database Schema

### coaching_sessions Table
```sql
CREATE TABLE coaching_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  discord_id TEXT NOT NULL,
  session_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  user_tier TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  feedback JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Session Metadata Structure
```typescript
interface SessionMetadata {
  totalQuestions: number;
  averageConfidence: number;
  topicsDiscussed: string[];
  aiProvider: 'openai' | 'claude' | 'fallback';
  userSatisfaction?: number;
  followUpScheduled?: boolean;
}
```

## Configuration

### Environment Variables
```bash
# AI Services
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
AI_PREFERRED_PROVIDER=openai

# Feature Flags
ENABLE_AI_COACHING=true
```

### Cooldown Settings
```typescript
const COOLDOWN_DURATION = {
  member: 5 * 60 * 1000,    // 5 minutes
  vip: 2 * 60 * 1000,       // 2 minutes
  vip_plus: 30 * 1000,      // 30 seconds
  staff: 10 * 1000,         // 10 seconds
  admin: 0,                 // No cooldown
  owner: 0                  // No cooldown
};
```

## Usage Examples

### Basic Question
```
/ask-unit-talk question:"Should I bet the over on LeBron James 25.5 points tonight?"
```

### With Context
```
/ask-unit-talk question:"What's your take on the Lakers spread?" context:"NBA, home game, back-to-back"
```

### Follow-up Questions
After receiving an analysis, users can:
1. Click "Ask Follow-up" button
2. Enter additional questions in modal
3. Get contextual responses based on session history

## Testing

### Run AI Coaching Tests
```bash
npm run test:ai-coaching
```

### Test Coverage
- ✅ AI analysis generation
- ✅ Session management
- ✅ Database integration
- ✅ Error handling
- ✅ Fallback logic
- ✅ Tier-based features

## Monitoring & Analytics

### Tracked Events
```typescript
await databaseService.trackUserActivity(discordId, 'ai_coaching_used', {
  question_length: question.length,
  user_tier: userTier,
  session_id: sessionId,
  confidence: analysis.confidence,
  risk_level: analysis.riskAssessment.level
});
```

### Key Metrics
- Questions per session
- Average confidence scores
- User satisfaction ratings
- AI provider performance
- Response times
- Error rates

## Error Handling

### Common Scenarios
1. **AI Provider Unavailable**: Falls back to rule-based analysis
2. **Rate Limiting**: Implements user-tier based cooldowns
3. **Invalid Questions**: Provides helpful error messages
4. **Database Errors**: Graceful degradation with logging

### Logging
```typescript
logger.info('AI coaching question processed', {
  userId: discordId,
  userTier,
  sessionId,
  questionLength: question.length,
  confidence: analysis.confidence
});
```

## Security & Privacy

### Data Protection
- User questions are not stored in plain text logs
- AI provider responses are sanitized
- Personal information is redacted from analytics

### Rate Limiting
- Tier-based cooldowns prevent abuse
- IP-based rate limiting for API protection
- Session limits per user per day

## Future Enhancements

### Planned Features
- [ ] Voice-based coaching sessions
- [ ] Image analysis for bet slips
- [ ] Automated follow-up recommendations
- [ ] Integration with live odds feeds
- [ ] Machine learning model training on user feedback
- [ ] Multi-language support

### Performance Optimizations
- [ ] Response caching for common questions
- [ ] Async processing for complex analysis
- [ ] CDN integration for faster responses
- [ ] Database query optimization

## Troubleshooting

### Common Issues

**AI Analysis Not Working**
```bash
# Check environment variables
echo $OPENAI_API_KEY
echo $ANTHROPIC_API_KEY

# Test AI service connectivity
npm run test:ai-coaching
```

**Database Connection Issues**
```bash
# Verify Supabase configuration
echo $SUPABASE_URL
echo $SUPABASE_KEY

# Test database connectivity
npm run test:database
```

**Discord Command Not Responding**
```bash
# Check bot permissions
# Verify command registration
npm run register-commands

# Check logs
tail -f logs/unit-talk.log
```

## Support

For technical support or feature requests:
- Create an issue in the repository
- Contact the development team
- Check the troubleshooting guide above

---

*Last updated: December 2024*
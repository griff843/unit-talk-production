# PlayerEnrichmentAgent

A comprehensive multi-league player data enrichment system that fetches
headshots and physical attributes (height, weight, birthday) for players across
MLB, NBA, NFL, and NHL.

## Features

### 🏆 Multi-League Support

- **MLB**: Major League Baseball
- **NBA**: National Basketball Association
- **NFL**: National Football League
- **NHL**: National Hockey League

### 📊 Enriched Data Fields

- **Headshots**: High-quality player photos from official league sources
- **Height**: Player height in centimeters (converted from feet/inches when
  needed)
- **Weight**: Player weight in kilograms (converted from pounds when needed)
- **Birthday**: Player birth date in ISO format (YYYY-MM-DD)

### 🔧 Smart Data Management

- **Selective Updates**: Only updates null/missing fields unless
  `FORCE_UPDATE=true`
- **Unit Conversion**: Automatic conversion from imperial to metric units
- **Error Handling**: Comprehensive error logging and recovery
- **Field-Level Tracking**: Detailed metrics for each enriched field

## API Sources

| League  | Headshot Source              | Physical Data Source               | Notes                                      |
| ------- | ---------------------------- | ---------------------------------- | ------------------------------------------ |
| **MLB** | MLB Stats API                | MLB Stats API                      | Complete data including birthday           |
| **NBA** | Ball Don't Lie API + NBA CDN | Ball Don't Lie API + NBA.com Stats | Birthday from NBA.com when available       |
| **NFL** | ESPN API                     | ESPN API                           | Complete data from ESPN's athlete database |
| **NHL** | NHL Stats API                | NHL Stats API                      | Complete data from official NHL API        |

## Usage

### CLI Tool

```bash
# Enrich all leagues (headshots + physicals)
npm run enrich-players

# Enrich specific league
npm run enrich-players MLB
npm run enrich-players NBA
npm run enrich-players NFL
npm run enrich-players NHL

# Force update existing data
FORCE_UPDATE=true npm run enrich-players

# Force update specific league
FORCE_UPDATE=true npm run enrich-players NBA
```

### Programmatic Usage

```typescript
import {
  enrichAllPlayers,
  enrichPlayerById,
} from '../agents/PlayerEnrichmentAgent';

// Enrich all players across all leagues
const summary = await enrichAllPlayers();

// Enrich specific league
const nbaSummary = await enrichAllPlayers('NBA');

// Enrich specific player by ID
const success = await enrichPlayerById('player-uuid');
```

### Individual League Functions

```typescript
import { getMlbHeadshot, getMlbPhysicals } from '../enrichment/mlbEnrichment';
import { getNbaHeadshot, getNbaPhysicals } from '../enrichment/nbaEnrichment';
import { getNflHeadshot, getNflPhysicals } from '../enrichment/nflEnrichment';
import { getNhlHeadshot, getNhlPhysicals } from '../enrichment/nhlEnrichment';

// Get MLB player data
const headshot = await getMlbHeadshot('Mike Trout');
const physicals = await getMlbPhysicals('Mike Trout');
// Returns: { height_cm: 185, weight_kg: 107, birthday: '1991-08-07' }

// Get NBA player data
const nbaHeadshot = await getNbaHeadshot('LeBron James');
const nbaPhysicals = await getNbaPhysicals('LeBron James');
// Returns: { height_cm: 206, weight_kg: 113, birthday: '1984-12-30' }
```

## Temporal Workflows

### Multi-League Workflows

```typescript
// League-specific workflows
await client.workflow.start('getMlbHeadshotWorkflow', {
  playerName: 'Mike Trout',
});
await client.workflow.start('getNbaHeadshotWorkflow', {
  playerName: 'LeBron James',
});
await client.workflow.start('getNflHeadshotWorkflow', {
  playerName: 'Tom Brady',
});
await client.workflow.start('getNhlHeadshotWorkflow', {
  playerName: 'Connor McDavid',
});

// Unified workflow (auto-detects league)
await client.workflow.start('getPlayerHeadshotWorkflow', {
  playerName: 'Mike Trout',
  sport: 'MLB',
});
```

### Workflow Activities

```typescript
// Available activities
- enrichAllPlayersActivity({ league?: 'MLB' | 'NBA' | 'NFL' | 'NHL' })
- enrichPlayerByIdActivity({ playerId: string })
- getPlayerHeadshotActivity({ playerName: string, sport: string })
- getMlbHeadshotActivity({ playerName: string })
- getNbaHeadshotActivity({ playerName: string })
- getNflHeadshotActivity({ playerName: string })
- getNhlHeadshotActivity({ playerName: string })
```

## Response Format

### Enrichment Summary

```typescript
interface EnrichmentSummary {
  totalProcessed: number;
  successfulEnrichments: number;
  notFound: number;
  errors: number;
  errorDetails: string[];
  leagueBreakdown: {
    MLB: {
      processed: number;
      successful: number;
      notFound: number;
      errors: number;
    };
    NBA: {
      processed: number;
      successful: number;
      notFound: number;
      errors: number;
    };
    NFL: {
      processed: number;
      successful: number;
      notFound: number;
      errors: number;
    };
    NHL: {
      processed: number;
      successful: number;
      notFound: number;
      errors: number;
    };
  };
  fieldBreakdown: {
    headshot: {
      processed: number;
      successful: number;
      notFound: number;
      errors: number;
    };
    height_cm: {
      processed: number;
      successful: number;
      notFound: number;
      errors: number;
    };
    weight_kg: {
      processed: number;
      successful: number;
      notFound: number;
      errors: number;
    };
    birthday: {
      processed: number;
      successful: number;
      notFound: number;
      errors: number;
    };
  };
}
```

### Physical Attributes

```typescript
interface PlayerPhysicals {
  height_cm: number | null; // Height in centimeters
  weight_kg: number | null; // Weight in kilograms
  birthday: string | null; // ISO date string (YYYY-MM-DD)
}
```

## Database Schema

The system updates the following fields in the `players` table:

```sql
-- Existing fields
headshot VARCHAR          -- Primary headshot URL
photo_url VARCHAR         -- Backup/legacy headshot URL

-- New physical attribute fields
height_cm INTEGER         -- Height in centimeters
weight_kg DECIMAL(5,1)    -- Weight in kilograms (e.g., 85.5)
birthday DATE             -- Birth date (YYYY-MM-DD)
```

## Configuration

### Environment Variables

```bash
# Required
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key

# Optional
FORCE_UPDATE=true          # Overwrite existing non-null values
```

### Agent Configuration

```typescript
const config: BaseAgentConfig = {
  name: 'PlayerEnrichmentAgent',
  version: '2.0.0',
  description: 'Multi-league player data enrichment with physical attributes',
};
```

## Testing

### Run Test Suite

```bash
# Run comprehensive test suite
npm run test:player-enrichment

# Or run directly
npx ts-node src/agents/PlayerEnrichmentAgent/multi-league-enrichment-test.ts
```

### Test Coverage

The test suite validates:

- ✅ Headshot URL retrieval for all leagues
- ✅ Physical attributes (height, weight, birthday) for all leagues
- ✅ Error handling and recovery
- ✅ Unit conversion accuracy
- ✅ API response parsing

### Sample Test Output

```
🧪 Multi-League Player Enrichment Test Suite
================================================================================

🏟️  Testing MLB enrichment...
   Testing Mike Trout...
      Headshot: ✅ | Physicals: ✅
   Testing Mookie Betts...
      Headshot: ✅ | Physicals: ✅

📈 TEST SUMMARY STATISTICS
================================================================================

🏟️  MLB:
   Players Tested: 5
   📸 Headshot Success: 5/5 (100.0%)
   📊 Physicals Success: 5/5 (100.0%)
   📏 Height Found: 5/5 (100.0%)
   ⚖️  Weight Found: 5/5 (100.0%)
   🎂 Birthday Found: 5/5 (100.0%)
```

## Monitoring & Metrics

### Health Checks

```typescript
const agent = new PlayerEnrichmentAgent(config, dependencies);

// Check all league APIs
const health = await agent.healthCheck();
// Returns status for MLB, NBA, NFL, NHL APIs
```

### Metrics Tracking

```typescript
// Access detailed metrics
console.log(agent.metrics);
// Includes:
// - League-specific processing counts
// - Field-level success rates
// - Error tracking
// - Performance metrics
```

## Error Handling

### Common Issues & Solutions

| Issue                      | Cause                          | Solution                                     |
| -------------------------- | ------------------------------ | -------------------------------------------- |
| **Player Not Found**       | Name spelling, inactive player | Verify exact name, check if player is active |
| **API Rate Limiting**      | Too many requests              | Implement delays, use batch processing       |
| **Missing Physical Data**  | API doesn't provide field      | Expected for some APIs (e.g., NBA birthday)  |
| **Unit Conversion Errors** | Invalid height/weight format   | Check API response format, update parser     |

### Logging

```typescript
// Error logs include:
- Player name and league
- API endpoint and response status
- Specific field that failed
- Full error message and stack trace
```

## Performance

### Benchmarks

- **MLB**: ~500ms per player (includes detailed stats)
- **NBA**: ~800ms per player (multiple API calls for birthday)
- **NFL**: ~400ms per player (comprehensive ESPN data)
- **NHL**: ~600ms per player (two-step API process)

### Optimization Tips

1. **Batch Processing**: Process players in batches to avoid rate limits
2. **Caching**: Cache successful API responses for repeated requests
3. **Selective Updates**: Use `FORCE_UPDATE=false` to skip existing data
4. **League Filtering**: Process specific leagues during off-peak hours

## Migration Guide

### From v1.x (Headshots Only)

The new system is backward compatible. Existing headshot functionality remains
unchanged, with new physical attributes added seamlessly.

```typescript
// v1.x - Still works
const summary = await enrichAllPlayers('MLB');

// v2.x - Enhanced with physical attributes
// Same function now enriches headshots + height + weight + birthday
const enhancedSummary = await enrichAllPlayers('MLB');
```

### Database Migration

```sql
-- Add new columns to existing players table
ALTER TABLE players
ADD COLUMN height_cm INTEGER,
ADD COLUMN weight_kg DECIMAL(5,1),
ADD COLUMN birthday DATE;

-- Create indexes for performance
CREATE INDEX idx_players_height ON players(height_cm);
CREATE INDEX idx_players_weight ON players(weight_kg);
CREATE INDEX idx_players_birthday ON players(birthday);
```

## Contributing

### Adding New Leagues

1. Create `src/agents/enrichment/{league}Enrichment.ts`
2. Implement `get{League}Headshot()` and `get{League}Physicals()` functions
3. Add league to `SupportedLeague` type
4. Update main enrichment logic
5. Add test cases

### Adding New Fields

1. Update `PlayerPhysicals` interface in `src/types/player.ts`
2. Add field to database schema
3. Update enrichment functions to fetch new field
4. Add field tracking to metrics and summary
5. Update tests and documentation

## License

This project is part of the Unit Talk platform and follows the same licensing
terms.

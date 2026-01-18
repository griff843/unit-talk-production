# Unit Talk Partner SDK - JavaScript/TypeScript

Official JavaScript/TypeScript SDK for the Unit Talk Partner API.

## Installation

```bash
npm install @unittalk/partner-sdk
```

## Quick Start

```typescript
import { UnitTalkClient } from '@unittalk/partner-sdk';

const client = new UnitTalkClient({
  apiKey: 'ut_live_your_api_key',
  environment: 'production'
});

// Fetch picks
const picks = await client.picks.list({
  sport: 'NFL',
  limit: 50
});

// Create a pick
const newPick = await client.picks.create({
  sport: 'NFL',
  market_type: 'player_props',
  selection: 'over',
  line: 250.5,
  odds: -110,
  stake: 100,
  player_name: 'Patrick Mahomes',
  game_date: '2025-10-26'
});
```

## Documentation

See [Partner API Documentation](../../docs/partners/PHASE14_PARTNER_API.md) for complete API reference.

## License

MIT

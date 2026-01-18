# Unit Talk Partner SDK - Python

Official Python SDK for the Unit Talk Partner API.

## Installation

```bash
pip install unittalk-partner-sdk
```

## Quick Start

```python
from unittalk import UnitTalkClient

client = UnitTalkClient(
    api_key='ut_live_your_api_key',
    environment='production'
)

# Fetch picks
picks = client.list_picks(sport='NFL', limit=50)

# Create a pick
new_pick = client.create_pick(
    sport='NFL',
    market_type='player_props',
    selection='over',
    line=250.5,
    odds=-110,
    stake=100,
    player_name='Patrick Mahomes',
    game_date='2025-10-26'
)

# Get statistics
stats = client.get_stats(
    date_from='2025-10-01',
    date_to='2025-10-31'
)

# Register webhook
webhook = client.create_webhook(
    url='https://yourapp.com/webhooks/unittalk',
    events=['pick.scored', 'market.closed']
)
```

## Documentation

See [Partner API Documentation](../../docs/partners/PHASE14_PARTNER_API.md) for complete API reference.

## License

MIT

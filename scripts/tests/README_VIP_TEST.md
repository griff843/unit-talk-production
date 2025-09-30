# VIP/VIP+ Discord E2E Test Runner

This test verifies Unit Talk's VIP/VIP+ Discord flows without changing server structure. It posts controlled test embeds and validates bot behavior, producing JSON + logs under `out/tests/vip/`.

## Prerequisites
- Docker-first workflow (recommended). Ensure services are up (bot online):
  - `./dev.sh start` then `./dev.sh status`
  - Confirm the Discord bot is online in your server
- `.env` at repo root must include:

```
DISCORD_TOKEN=YOUR_BOT_TOKEN
GUILD_ID=YOUR_GUILD_ID

# Speed up mirror test (prod=15)
TEST_DELAY_MINUTES=1
MAX_DAILY_PINGS=3

# Channel IDs (owner-provided)
CHANNEL_HEDGE_ID=1418224620913426442
CHANNEL_INJURY_ID=1418224567075340370
CHANNEL_STEAM_ID=1418224521818800188
CHANNEL_CURATED_ID=1418224476004290620
CHANNEL_VIPPLUS_INSIGHTS_ID=1288613114815840466
# Optional if known; else resolved by name
# CHANNEL_TRADER_INSIGHTS_ID=XXXXXXXXXXXXXX
```

Note: If IDs are not set, the runner will fall back to channel names:
- `steam-alerts`, `injury-shockwave`, `hedge-lab`, `alerts-feed`, `vipplus-insights`, `trader-insights`

## Install (if needed)
The runner prefers `discord.js` v14; if not installed at repo root, it falls back to Discord REST. To force discord.js mode, install at root via Docker:

```
docker-compose exec api npm i -D discord.js dotenv
```

## Run
From repo root:

```
# Docker (preferred)
docker-compose exec api node scripts/tests/vip_bot_e2e_test.js

# Or locally (if Docker unavailable)
node scripts/tests/vip_bot_e2e_test.js
```

Run a single step:

```
node scripts/tests/vip_bot_e2e_test.js --step vipplus-mirror
```

## What the runner does
Posts embeds and validates outcomes in this order:
1) 📈 Steam → one embed to `#steam-alerts`
2) 🚑 Injury Shockwave → one embed to `#injury-shockwave`
3) 🧪 Hedge Lab → one embed to `#hedge-lab`
4) 🎯 Curated PASS → posts S-tier candidate upstream; expects bot to forward to `#alerts-feed` (with @VIP ping if under cap)
5) 🎯 Curated FAIL → posts a failing candidate upstream; expects no forward to `#alerts-feed`
6) 🔁 Idempotency → posts the same Idem twice; expects only one forward to `#alerts-feed`
7) 🧠→📊 VIP+ Mirror → posts to `#vipplus-insights`; expects lite mirror to `#trader-insights` after `TEST_DELAY_MINUTES`
8) 🔕 VIP Ping Cap → attempts `MAX_DAILY_PINGS+1` curated posts; expects last forward without role ping
9) 🔒 Perms sanity → verifies alert channels are read-only for `@everyone` and VIP chats allow member posts (log-only check)

## Output
- Results JSON: `out/tests/vip/results.json`
- Console log: `out/tests/vip/console.log`
- On failure: `out/tests/vip/fail_<step>.json` with `{ error, stack, channel }`

`results.json` includes `summary: "PASS"` only if all steps passed.

## Curated Gate Expectations (for the bot)
- Allowed if `Tier S` OR (`Tier A` AND edge ≥ 12 AND confidence ≥ 88)
- Freshness ≤ 300s; bounds OK
- Cap `@VIP` pings to `MAX_DAILY_PINGS` per day

## Troubleshooting
- Missing messages in `#alerts-feed`:
  - Ensure curated aggregator bot is running and watching upstream channels
  - Check channel IDs and bot permissions (Send Messages)
- VIP+ mirror not appearing:
  - Ensure mirror bot is online; confirm `TEST_DELAY_MINUTES` is set (default 1)
- Idempotency not enforced:
  - Aggregator may not de-duplicate by `Idem` footer; verify production logic
- Ping cap test fails:
  - Verify the VIP role mention is permitted for the bot and daily cap status

## Clean exit
The runner writes artifacts regardless of PASS/FAIL. Re-run individual steps to iterate quickly:

```
node scripts/tests/vip_bot_e2e_test.js --step curated-pass
```


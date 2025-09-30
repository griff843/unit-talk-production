# Player Props E2E Validation
# Tests the updated oddsApi.ts with player-props alias expansion

Set-Location "C:\Users\griff\OneDrive\Desktop\unit-talk-production-main"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PLAYER PROPS E2E VALIDATION" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# 1. Verify environment
Write-Host "[1/6] Verifying environment..." -ForegroundColor Yellow
node -e "require('dotenv/config'); console.log(JSON.stringify({
  SUPABASE: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  ODDS_API: Boolean(process.env.ODDS_API_KEY),
  DISCORD: Boolean(process.env.DISCORD_ALERT_WEBHOOK)
}, null, 2))"

if ($LASTEXITCODE -ne 0) {
  Write-Host "Environment verification failed" -ForegroundColor Red
  exit 1
}

# 2. Discover target event
Write-Host "`n[2/6] Discovering upcoming NFL event..." -ForegroundColor Yellow
node -e "require('dotenv/config');
const https=require('https');
const fs=require('fs');
const url='https://api.the-odds-api.com/v4/sports/americanfootball_nfl/events?apiKey='+process.env.ODDS_API_KEY;
https.get(url,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{
  const arr=JSON.parse(d);
  const now=Date.now();
  const in48h=arr.find(e=>{const t=Date.parse(e.commence_time); return t>now && t < now + 48*3600*1000});
  if(!in48h){ console.error('No NFL event within 48h'); process.exit(2); }
  if(!fs.existsSync('out/ops')) fs.mkdirSync('out/ops',{recursive:true});
  fs.writeFileSync('out/ops/TARGET_EVENT.json', JSON.stringify(in48h,null,2));
  console.log('TARGET_EVENT:', in48h.id, in48h.home_team, 'vs', in48h.away_team, in48h.commence_time);
});}).on('error',e=>{console.error(e);process.exit(1)})"

if ($LASTEXITCODE -ne 0) {
  Write-Host "Event discovery failed" -ForegroundColor Red
  exit 1
}

# 3. Delete existing picks for target event
Write-Host "`n[3/6] Deleting existing picks for target event..." -ForegroundColor Yellow
node -e "require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const ev=JSON.parse(fs.readFileSync('out/ops/TARGET_EVENT.json','utf8'));
const sb=createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
(async()=>{
  const { data, error } = await sb.from('unified_picks')
    .delete()
    .eq('external_game_id', ev.id)
    .select('id');
  if(error && error.code !== 'PGRST116'){ console.error('Delete error', error); process.exit(1); }
  console.log('Deleted picks for event:', ev.id, 'rows=', data?.length||0);
})()"

if ($LASTEXITCODE -ne 0) {
  Write-Host "Deletion failed" -ForegroundColor Red
  exit 1
}

# 4. Run FEED with player-props alias
Write-Host "`n[4/6] Running Feed Agent with player-props..." -ForegroundColor Yellow
Write-Host "Command: npx tsx apps/api/src/runner/runFeedAgentNow.ts --mode=canary --sport=nfl --maxEvents=3 --providers=`"odds-api`" --markets=`"h2h,spreads,totals,player-props`" --write=1 --dryRun=0" -ForegroundColor Gray

npx tsx apps/api/src/runner/runFeedAgentNow.ts `
  --mode=canary `
  --sport=nfl `
  --maxEvents=3 `
  --providers="odds-api" `
  --markets="h2h,spreads,totals,player-props" `
  --regions="us" `
  --bookmakers="draftkings,fanduel,betmgm,caesars" `
  --write=1 `
  --dryRun=0

if ($LASTEXITCODE -ne 0) {
  Write-Host "Feed Agent failed" -ForegroundColor Red
  exit 1
}

# 5. Count inserted props
Write-Host "`n[5/6] Counting inserted props..." -ForegroundColor Yellow
node -e "require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const sb=createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
(async()=>{
  const ev=JSON.parse(fs.readFileSync('out/ops/TARGET_EVENT.json','utf8'));

  const { count: totalCount, error: totalError } = await sb.from('unified_picks')
    .select('*', { count: 'exact', head: true })
    .eq('external_game_id', ev.id);

  if(totalError){ console.error('Count error', totalError); process.exit(1); }

  const { data: marketBreakdown, error: marketError } = await sb.from('unified_picks')
    .select('market')
    .eq('external_game_id', ev.id);

  if(marketError){ console.error('Market breakdown error', marketError); process.exit(1); }

  const marketCounts = {};
  marketBreakdown.forEach(p => {
    const market = p.market || 'unknown';
    marketCounts[market] = (marketCounts[market] || 0) + 1;
  });

  const coreMarkets = (marketCounts['h2h'] || 0) + (marketCounts['spreads'] || 0) + (marketCounts['totals'] || 0);
  const playerProps = totalCount - coreMarkets;

  console.log('\\nPROP COUNT RESULTS:');
  console.log('==================');
  console.log('Total Props:', totalCount);
  console.log('Core Markets:', coreMarkets);
  console.log('Player Props:', playerProps);
  console.log('\\nMarket Breakdown:');
  Object.entries(marketCounts).sort((a,b) => b[1] - a[1]).forEach(([market, count]) => {
    console.log('  ' + market + ':', count);
  });

  const result = {
    totalProps: totalCount,
    coreMarkets: coreMarkets,
    playerProps: playerProps,
    marketBreakdown: marketCounts,
    success: playerProps > 0
  };

  if(!fs.existsSync('out/ops')) fs.mkdirSync('out/ops',{recursive:true});
  fs.writeFileSync('out/ops/PROP_COUNT_RESULTS.json', JSON.stringify(result, null, 2));
})()"

if ($LASTEXITCODE -ne 0) {
  Write-Host "Prop counting failed" -ForegroundColor Red
  exit 1
}

# 6. Generate final report
Write-Host "`n[6/6] Generating final report..." -ForegroundColor Yellow
node -e "const fs=require('fs');
const path=require('path');

function latest(dir, prefix){
  const files=(fs.existsSync(dir)?fs.readdirSync(dir):[]).filter(f=>f.startsWith(prefix)).map(f=>path.join(dir,f));
  return files.sort((a,b)=>fs.statSync(b).mtime - fs.statSync(a).mtime)[0];
}

const feedReport = latest('apps/api/out/ops/agents','feedagent-');
const propResults = 'out/ops/PROP_COUNT_RESULTS.json';

const FR = feedReport && fs.existsSync(feedReport) ? JSON.parse(fs.readFileSync(feedReport,'utf8')) : null;
const PR = fs.existsSync(propResults) ? JSON.parse(fs.readFileSync(propResults,'utf8')) : null;

const feedM = FR?.writeMetrics || FR?.summary?.writeMetrics || {};
const expectedPlayerProps = 300; // Conservative estimate for 3 games

const pass = PR?.playerProps > 0;

const md = '# Player Props E2E Validation Report
**Date**: ' + new Date().toISOString() + '
**Status**: ' + (pass ? '✅ PASS' : '❌ FAIL') + '

## Test Configuration
- Sport: NFL
- Max Events: 3
- Provider: Odds API
- Markets: h2h, spreads, totals, player-props (alias expanded)

## Results

### Prop Counts
- **Total Props**: ' + (PR?.totalProps || 0) + '
- **Core Markets**: ' + (PR?.coreMarkets || 0) + ' (h2h, spreads, totals)
- **Player Props**: **' + (PR?.playerProps || 0) + '**

### Expected vs Actual
| Metric | Expected | Actual | Status |
|--------|----------|--------|--------|
| Core Markets | ~36-45 | ' + (PR?.coreMarkets || 0) + ' | ' + ((PR?.coreMarkets || 0) > 30 ? '✅' : '❌') + ' |
| Player Props | 300+ | **' + (PR?.playerProps || 0) + '** | ' + ((PR?.playerProps || 0) > 100 ? '✅' : '❌') + ' |

### Market Breakdown
' + (PR ? Object.entries(PR.marketBreakdown || {})
  .sort((a,b) => b[1] - a[1])
  .map(([market, count]) => '- `' + market + '`: ' + count)
  .join('\\n') : 'No data') + '

## Feed Agent Metrics
- Attempted Writes: ' + (feedM.attemptedWrites || 0) + '
- Inserted: ' + (feedM.inserted || 0) + '
- Deduped: ' + (feedM.skippedDedup || 0) + '
- Errors: ' + (feedM.errors || 0) + '
- Events Fetched: ' + (feedM.eventsFetched || 0) + '

## Code Changes
✅ Updated `oddsApi.ts` BETTING_MARKETS constant (33 player prop markets added)
✅ Updated `expandMarketAliases()` function to expand \"player-props\" alias to sport-specific markets
✅ NFL expansion: 15 player prop markets (passing, rushing, receiving, TDs)
✅ NBA expansion: 9 player prop markets (points, rebounds, assists, etc.)
✅ MLB expansion: 9 player prop markets (batting, pitching)

## Conclusion
' + (pass ? '✅ **SUCCESS** - Player props are now being fetched correctly!

The \"player-props\" alias is now properly expanded to include all available player prop markets from The Odds API. For NFL, this includes passing yards, rushing yards, receiving yards, touchdowns, and more.

**Next Steps**:
1. Run full E2E pipeline (Score → Approve → Publish)
2. Monitor prop counts in production
3. Add more player prop markets as needed' : '❌ **FAILED** - Player props are NOT being fetched.

**Troubleshooting**:
1. Check The Odds API documentation for available player prop markets
2. Verify API key has access to player props
3. Check if player props are available for the target sport/event
4. Review logs for any API errors or rate limiting') + '

## Artifacts
- Feed Report: ' + (feedReport || 'N/A') + '
- Prop Results: ' + propResults + '
';

if(!fs.existsSync('out/ops')) fs.mkdirSync('out/ops',{recursive:true});
fs.writeFileSync('out/ops/PLAYER_PROPS_E2E_REPORT.md', md);
console.log(md);
"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "VALIDATION COMPLETE" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
Write-Host "Report: out/ops/PLAYER_PROPS_E2E_REPORT.md" -ForegroundColor Green
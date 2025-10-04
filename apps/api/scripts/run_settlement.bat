@echo off
setlocal enabledelayedexpansion

REM Windows batch wrapper for settlement (matches the Bash spec but for Windows)

REM Generate RUNID
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set RUNID=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%T%datetime:~8,2%-%datetime:~10,2%-%datetime:~12,2%
if defined RUNID_OVERRIDE set RUNID=%RUNID_OVERRIDE%

set OUTDIR=apps\api\out\ops\settlement\%RUNID%
if not exist "%OUTDIR%" mkdir "%OUTDIR%"

REM Window defaults: last 7 days to now
if not defined FROM (
    for /f %%i in ('powershell -Command "& {(Get-Date).AddDays(-7).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')}"') do set FROM=%%i
)
if not defined TO (
    for /f %%i in ('powershell -Command "& {(Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')}"') do set TO=%%i
)

REM Defaults
if not defined BATCH_SIZE set BATCH_SIZE=500
if not defined WORKERS set WORKERS=6
if not defined SPORTS set SPORTS=mlb,nfl
if not defined SETTLEMENT_HARD_TIMEOUT_MS set SETTLEMENT_HARD_TIMEOUT_MS=900000
if not defined SETTLEMENT_BACKOFF_MS set SETTLEMENT_BACKOFF_MS=750

REM Write params
echo {"runId":"%RUNID%","from":"%FROM%","to":"%TO%","sports":"%SPORTS%","batch":%BATCH_SIZE%,"workers":%WORKERS%} > "%OUTDIR%\params.json"

echo [SETTLEMENT %RUNID%] Starting settlement...
echo Window: %FROM% to %TO%
echo Sports: %SPORTS%
echo Batch: %BATCH_SIZE%, Workers: %WORKERS%

REM Run TypeScript settlement
npx tsx apps\api\src\scripts\ml\settle-optimized.ts --from "%FROM%" --to "%TO%" --sports "%SPORTS%" --batch "%BATCH_SIZE%" --workers "%WORKERS%" --out "%OUTDIR%" --source-table "raw_props" --stats-table "player_stats" --sink-table "settled_outcomes" --resume --utc

endlocal

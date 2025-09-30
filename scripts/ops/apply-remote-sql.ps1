Param(
  [Parameter(Mandatory=$true)]
  [string]$SqlPath
)

$ErrorActionPreference = 'Stop'

# Repo root
$root = (Resolve-Path "$PSScriptRoot/../..").Path
$envPath = Join-Path $root ".env"

if (!(Test-Path $envPath)) {
  Write-Error ".env not found at $envPath"
}

# Extract DATABASE_URL line
$dbLine = (Get-Content $envPath | Select-String '^DATABASE_URL=').Line
if (-not $dbLine) {
  Write-Error 'DATABASE_URL not found in .env'
}
$dbUrl = $dbLine -replace '^DATABASE_URL=',''

Write-Host "Using Supabase DB host:" ([Uri]$dbUrl).Host

# Ensure path is under workspace mount
$containerSqlPath = $SqlPath

# Run psql in a postgres container
$hostPath = $root
$env:DBURL = $dbUrl

$dburlEsc = $env:DBURL
$cmd = 'psql "{0}" -v ON_ERROR_STOP=1 -f {1}' -f $dburlEsc, $containerSqlPath

Write-Host "Executing: $cmd"

$volumeArg = '{0}:/workspace' -f $hostPath

docker run --rm `
  -e DBURL="$dbUrl" `
  -v $volumeArg `
  -w /workspace `
  postgres:15-alpine sh -lc "$cmd"


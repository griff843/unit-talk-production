Param(
  [Parameter(Mandatory=$true)] [string]$TargetFileName,
  [Parameter(Mandatory=$true)] [string]$ProjectRef,
  [Parameter(Mandatory=$true)] [string]$SupabaseAccessToken
)

$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
$migDir = Join-Path $root 'supabase/migrations'
$tmpDir = Join-Path $root 'supabase/tmp/pushonly'

Write-Host "Root: $root"
Write-Host "Migrations: $migDir"
Write-Host "Temp: $tmpDir"

if (!(Test-Path $migDir)) { throw "Migrations directory not found: $migDir" }
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

# Move all except target
$others = Get-ChildItem $migDir -Filter '*.sql' | Where-Object { $_.Name -ne $TargetFileName }

Write-Host "Isolating target: $TargetFileName (moving $($others.Count) other file(s))"

foreach ($f in $others) { Move-Item -Force -Path $f.FullName -Destination (Join-Path $tmpDir $f.Name) }

$exitCode = 0
try {
  # Run Supabase CLI in node:alpine
  $hostPath = $root
  $vol = ('{0}:/workspace' -f $hostPath)
  $cmd = "npx --yes supabase@latest link --project-ref $ProjectRef && npx --yes supabase@latest db push --yes"
  Write-Host "Running: $cmd"
  docker run --rm -e SUPABASE_ACCESS_TOKEN=$SupabaseAccessToken -v $vol -w /workspace node:20-alpine sh -lc "$cmd"
  if ($LASTEXITCODE -ne 0) { throw "Supabase CLI returned code $LASTEXITCODE" }
}
catch {
  Write-Error $_
  $exitCode = 1
}
finally {
  # Restore moved files
  Write-Host "Restoring $($others.Count) file(s) back to $migDir"
  foreach ($f in (Get-ChildItem $tmpDir -Filter '*.sql' -ErrorAction SilentlyContinue)) {
    Move-Item -Force -Path $f.FullName -Destination (Join-Path $migDir $f.Name)
  }
}

exit $exitCode


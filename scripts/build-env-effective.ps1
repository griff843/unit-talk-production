# =============================================================================
# Build .env.effective - Auto-discover and merge all environment files
# Date: 2025-10-26
# =============================================================================
# Discovers all .env files in repository and merges them with proper precedence
# Ensures all required keys exist with normalization and defaults
# =============================================================================

param(
    [string]$OutputFile = ".env.effective"
)

$ErrorActionPreference = "Stop"

Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "  BUILDING .env.effective FROM REPOSITORY FILES" -ForegroundColor White
Write-Host "================================================================`n" -ForegroundColor Cyan

# Precedence order (highest to lowest)
$precedenceOrder = @(
    ".env.production.local"
    ".env.production"
    ".env.local"
    ".env"
    "apps/smart-form/.env"
    "apps/command-center/.env.local"
    "supabase/.env"
)

# Environment map (first occurrence wins by precedence)
$envMap = @{}
$sourceMap = @{}
$filesFound = @()
$filesMissing = @()

# Function to parse env file
function Parse-EnvFile {
    param([string]$FilePath)
    
    if (-not (Test-Path $FilePath)) {
        return @{}
    }
    
    $result = @{}
    $content = Get-Content $FilePath -ErrorAction SilentlyContinue
    
    foreach ($line in $content) {
        # Skip comments and blank lines
        if ($line -match '^\s*#' -or $line -match '^\s*$') {
            continue
        }
        
        # Parse KEY=VALUE
        if ($line -match '^([A-Z_][A-Z0-9_]*)=(.*)$') {
            $key = $matches[1]
            $value = $matches[2]
            
            # Remove quotes if present
            if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'$") {
                $value = $matches[1]
            }
            
            $result[$key] = $value
        }
    }
    
    return $result
}

# Discover and parse files in precedence order
Write-Host "📁 Discovering environment files..." -ForegroundColor Yellow

foreach ($file in $precedenceOrder) {
    if (Test-Path $file) {
        Write-Host "  ✅ Found: $file" -ForegroundColor Green
        $filesFound += $file

        $parsed = Parse-EnvFile -FilePath $file
        foreach ($key in $parsed.Keys) {
            if (-not $envMap.ContainsKey($key)) {
                $envMap[$key] = $parsed[$key]
                $sourceMap[$key] = $file
            }
        }
    } else {
        $filesMissing += $file
    }
}

Write-Host "`n📊 Files found: $($filesFound.Count)" -ForegroundColor Cyan
Write-Host "📊 Keys discovered: $($envMap.Keys.Count)" -ForegroundColor Cyan

# Normalization and required keys
Write-Host "`n🔧 Normalizing and ensuring required keys..." -ForegroundColor Yellow

$required = @{
    "PICK_DRIVER" = "canonical"
    "PUBLISH_MODE" = "outbox"
    "CDN_BASE" = "https://cdn.unit-talk.app"
    "SMARTFORM_FEATURES" = "capperSelect,playerSearch,gameResolve,discordPreview,scoringSlider,aiAssist"
}

$addedKeys = @()
$missingCritical = @()

# Ensure PICK_DRIVER
if (-not $envMap.ContainsKey("PICK_DRIVER")) {
    $envMap["PICK_DRIVER"] = "canonical"
    $sourceMap["PICK_DRIVER"] = "DEFAULT"
    $addedKeys += "PICK_DRIVER=canonical"
    Write-Host "  ➕ Added: PICK_DRIVER=canonical" -ForegroundColor Green
}

# Ensure PUBLISH_MODE
if (-not $envMap.ContainsKey("PUBLISH_MODE")) {
    $envMap["PUBLISH_MODE"] = "outbox"
    $sourceMap["PUBLISH_MODE"] = "DEFAULT"
    $addedKeys += "PUBLISH_MODE=outbox"
    Write-Host "  ➕ Added: PUBLISH_MODE=outbox" -ForegroundColor Green
}

# Normalize TENANT_ID → DEFAULT_TENANT_ID
if ($envMap.ContainsKey("TENANT_ID") -and -not $envMap.ContainsKey("DEFAULT_TENANT_ID")) {
    $envMap["DEFAULT_TENANT_ID"] = $envMap["TENANT_ID"]
    $sourceMap["DEFAULT_TENANT_ID"] = "NORMALIZED from TENANT_ID"
    $addedKeys += "DEFAULT_TENANT_ID=$($envMap['TENANT_ID']) (from TENANT_ID)"
    Write-Host "  ➕ Normalized: DEFAULT_TENANT_ID from TENANT_ID" -ForegroundColor Green
}

# Ensure DEFAULT_TENANT_ID exists
if (-not $envMap.ContainsKey("DEFAULT_TENANT_ID")) {
    $envMap["DEFAULT_TENANT_ID"] = "12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a"
    $sourceMap["DEFAULT_TENANT_ID"] = "DEFAULT"
    $addedKeys += "DEFAULT_TENANT_ID=12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a"
    Write-Host "  ➕ Added: DEFAULT_TENANT_ID=12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a" -ForegroundColor Green
}

# Ensure CDN_BASE
if (-not $envMap.ContainsKey("CDN_BASE")) {
    $envMap["CDN_BASE"] = "https://cdn.unit-talk.app"
    $sourceMap["CDN_BASE"] = "DEFAULT"
    $addedKeys += "CDN_BASE=https://cdn.unit-talk.app"
    Write-Host "  ➕ Added: CDN_BASE=https://cdn.unit-talk.app" -ForegroundColor Green
}

# Ensure SMARTFORM_FEATURES
if (-not $envMap.ContainsKey("SMARTFORM_FEATURES")) {
    $envMap["SMARTFORM_FEATURES"] = "capperSelect,playerSearch,gameResolve,discordPreview,scoringSlider,aiAssist"
    $sourceMap["SMARTFORM_FEATURES"] = "DEFAULT"
    $addedKeys += "SMARTFORM_FEATURES=capperSelect,playerSearch,gameResolve,discordPreview,scoringSlider,aiAssist"
    Write-Host "  ➕ Added: SMARTFORM_FEATURES" -ForegroundColor Green
}

# Check for NEXT_PUBLIC_SUPABASE_URL
if (-not $envMap.ContainsKey("NEXT_PUBLIC_SUPABASE_URL") -or $envMap["NEXT_PUBLIC_SUPABASE_URL"] -eq "") {
    Write-Host "  ❌ CRITICAL: NEXT_PUBLIC_SUPABASE_URL is missing or empty!" -ForegroundColor Red
    $missingCritical += "NEXT_PUBLIC_SUPABASE_URL"
}

# Check for NEXT_PUBLIC_SUPABASE_ANON_KEY
if (-not $envMap.ContainsKey("NEXT_PUBLIC_SUPABASE_ANON_KEY") -or $envMap["NEXT_PUBLIC_SUPABASE_ANON_KEY"] -eq "") {
    Write-Host "  ❌ CRITICAL: NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or empty!" -ForegroundColor Red
    $missingCritical += "NEXT_PUBLIC_SUPABASE_ANON_KEY"
}

# STOP if critical keys are missing
if ($missingCritical.Count -gt 0) {
    Write-Host "`n❌ CRITICAL KEYS MISSING - CANNOT PROCEED" -ForegroundColor Red
    Write-Host "`nFiles searched:" -ForegroundColor Yellow
    foreach ($file in $filesFound) {
        Write-Host "  - $file" -ForegroundColor White
    }
    Write-Host "`nMissing keys:" -ForegroundColor Yellow
    foreach ($key in $missingCritical) {
        Write-Host "  - $key" -ForegroundColor Red
    }
    Write-Host "`nExpected to find these keys in one of the .env files listed above." -ForegroundColor Yellow
    Write-Host "Please add them to .env.local or .env and re-run this script.`n" -ForegroundColor Yellow
    exit 1
}

# Write .env.effective
Write-Host "`n📝 Writing $OutputFile..." -ForegroundColor Yellow

$sortedKeys = $envMap.Keys | Sort-Object
$output = @()

$output += "# ============================================================================="
$output += "# .env.effective - Auto-generated merged environment configuration"
$output += "# Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$output += "# ============================================================================="
$output += "# DO NOT EDIT THIS FILE MANUALLY - It is auto-generated"
$output += "# Run scripts/build-env-effective.ps1 to regenerate"
$output += "# ============================================================================="
$output += ""

foreach ($key in $sortedKeys) {
    $value = $envMap[$key]
    $source = $sourceMap[$key]
    $output += "$key=$value"
}

$output | Out-File -FilePath $OutputFile -Encoding UTF8

Write-Host "  ✅ Written: $OutputFile ($($sortedKeys.Count) keys)" -ForegroundColor Green

# Show first 10 and last 10 lines (mask secrets)
Write-Host "`n📄 Preview of $OutputFile (first 10 lines):" -ForegroundColor Cyan
$preview = Get-Content $OutputFile | Select-Object -First 10
foreach ($line in $preview) {
    if ($line -match '(KEY|TOKEN|SECRET|PASSWORD)=(.+)') {
        $masked = $line -replace '=.+', '=***MASKED***'
        Write-Host "  $masked" -ForegroundColor DarkGray
    } else {
        Write-Host "  $line" -ForegroundColor White
    }
}

Write-Host "`n📄 Preview of $OutputFile (last 10 lines):" -ForegroundColor Cyan
$preview = Get-Content $OutputFile | Select-Object -Last 10
foreach ($line in $preview) {
    if ($line -match '(KEY|TOKEN|SECRET|PASSWORD)=(.+)') {
        $masked = $line -replace '=.+', '=***MASKED***'
        Write-Host "  $masked" -ForegroundColor DarkGray
    } else {
        Write-Host "  $line" -ForegroundColor White
    }
}

# Summary
Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "  ✅ .env.effective BUILT SUCCESSFULLY" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "Files merged: $($filesFound.Count)" -ForegroundColor White
Write-Host "Total keys: $($sortedKeys.Count)" -ForegroundColor White
Write-Host "Keys added/normalized: $($addedKeys.Count)" -ForegroundColor White
Write-Host "`nCritical keys verified:" -ForegroundColor Yellow
Write-Host "  ✅ PICK_DRIVER=$($envMap['PICK_DRIVER'])" -ForegroundColor Green
Write-Host "  ✅ PUBLISH_MODE=$($envMap['PUBLISH_MODE'])" -ForegroundColor Green
Write-Host "  ✅ DEFAULT_TENANT_ID=$($envMap['DEFAULT_TENANT_ID'])" -ForegroundColor Green
Write-Host "  ✅ NEXT_PUBLIC_SUPABASE_URL=$($envMap['NEXT_PUBLIC_SUPABASE_URL'].Substring(0, 30))..." -ForegroundColor Green
Write-Host "  ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY=***$(($envMap['NEXT_PUBLIC_SUPABASE_ANON_KEY']).Substring(0, 10))...***" -ForegroundColor Green
Write-Host ""

exit 0


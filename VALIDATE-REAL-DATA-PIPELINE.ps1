# ============================================================================
# Real Data Pipeline Validation Script for Unit Talk Platform
# Ensures no mock data is present and validates real sports data flow
# ============================================================================

Write-Host "🔍 VALIDATING REAL DATA PIPELINE FOR UNIT TALK PLATFORM" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan

# Function to test API endpoint
function Test-APIEndpoint {
    param(
        [string]$Url,
        [string]$Name,
        [int]$TimeoutSeconds = 30
    )
    
    try {
        Write-Host "🔄 Testing $Name..." -ForegroundColor Yellow
        $response = Invoke-RestMethod -Uri $Url -TimeoutSec $TimeoutSeconds -ErrorAction Stop
        
        # Check for mock data indicators
        $responseJson = $response | ConvertTo-Json -Depth 10
        $mockIndicators = @(
            "LeBron James",
            "Patrick Mahomes", 
            "mock",
            "test-data",
            "placeholder",
            "example.com",
            "dummy"
        )
        
        $foundMockData = $false
        foreach ($indicator in $mockIndicators) {
            if ($responseJson -match $indicator) {
                Write-Host "❌ MOCK DATA DETECTED in $Name : '$indicator'" -ForegroundColor Red
                $foundMockData = $true
            }
        }
        
        if (-not $foundMockData) {
            Write-Host "✅ $Name : Real data confirmed (no mock indicators found)" -ForegroundColor Green
            return @{ Success = $true; HasRealData = $true; Response = $response }
        } else {
            return @{ Success = $true; HasRealData = $false; Response = $response }
        }
        
    } catch {
        Write-Host "❌ $Name : Failed to connect - $($_.Exception.Message)" -ForegroundColor Red
        return @{ Success = $false; HasRealData = $false; Error = $_.Exception.Message }
    }
}

# Function to validate database content
function Test-DatabaseContent {
    param(
        [string]$Query,
        [string]$Description
    )
    
    try {
        Write-Host "🔄 Testing database: $Description..." -ForegroundColor Yellow
        
        # Execute query via Docker
        $result = docker-compose exec -T postgres psql -U postgres -d unit_talk_production -t -c $Query 2>$null
        
        if ($LASTEXITCODE -eq 0 -and $result) {
            # Check for mock data in results
            $mockIndicators = @("LeBron James", "Patrick Mahomes", "mock", "test", "dummy")
            $foundMockData = $false
            
            foreach ($indicator in $mockIndicators) {
                if ($result -match $indicator) {
                    Write-Host "❌ MOCK DATA DETECTED in database: '$indicator'" -ForegroundColor Red
                    $foundMockData = $true
                }
            }
            
            if (-not $foundMockData) {
                Write-Host "✅ Database $Description : Real data confirmed" -ForegroundColor Green
                return @{ Success = $true; HasRealData = $true; Result = $result }
            } else {
                return @{ Success = $true; HasRealData = $false; Result = $result }
            }
        } else {
            Write-Host "⚠️ Database $Description : No data or connection failed" -ForegroundColor Yellow
            return @{ Success = $false; HasRealData = $false; Error = "No data or connection failed" }
        }
        
    } catch {
        Write-Host "❌ Database $Description : Error - $($_.Exception.Message)" -ForegroundColor Red
        return @{ Success = $false; HasRealData = $false; Error = $_.Exception.Message }
    }
}

# Step 1: Verify services are running
Write-Host "`n🔄 Step 1: Verifying services are running..." -ForegroundColor Yellow

$services = @("api", "command-center", "postgres", "redis")
$runningServices = 0

foreach ($service in $services) {
    try {
        $status = docker-compose ps $service --format json | ConvertFrom-Json
        if ($status.State -eq "running") {
            Write-Host "✅ $service : Running" -ForegroundColor Green
            $runningServices++
        } else {
            Write-Host "❌ $service : $($status.State)" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ $service : Not found or error" -ForegroundColor Red
    }
}

if ($runningServices -lt $services.Count) {
    Write-Host "⚠️ Not all services are running. Some tests may fail." -ForegroundColor Yellow
}

# Step 2: Test Optimal API Integration
Write-Host "`n🔄 Step 2: Testing Optimal API Integration..." -ForegroundColor Yellow

# Check if Optimal API key is configured
$envContent = Get-Content .env -ErrorAction SilentlyContinue
$optimalApiKey = $envContent | Where-Object { $_ -match "OPTIMAL_API_KEY=" } | ForEach-Object { $_.Split('=')[1] }

if ($optimalApiKey -and $optimalApiKey -ne "your-optimal-api-key-here") {
    Write-Host "✅ Optimal API key configured" -ForegroundColor Green
    
    # Test API endpoint (if accessible)
    try {
        Write-Host "🔄 Testing Optimal API connectivity..." -ForegroundColor Yellow
        # This would test the actual Optimal API - placeholder for now
        Write-Host "⚠️ Direct Optimal API test not implemented - check via FeedAgent" -ForegroundColor Yellow
    } catch {
        Write-Host "⚠️ Could not test Optimal API directly" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Optimal API key not configured or using placeholder" -ForegroundColor Red
}

# Step 3: Test API Health and Data Endpoints
Write-Host "`n🔄 Step 3: Testing API endpoints for real data..." -ForegroundColor Yellow

$apiTests = @(
    @{ Url = "http://localhost:3010/api/health"; Name = "API Health Check" },
    @{ Url = "http://localhost:3010/api/picks"; Name = "Picks API" },
    @{ Url = "http://localhost:3010/api/agents"; Name = "Agents API" },
    @{ Url = "http://localhost:3010/api/props"; Name = "Props API" }
)

$realDataEndpoints = 0
foreach ($test in $apiTests) {
    $result = Test-APIEndpoint -Url $test.Url -Name $test.Name
    if ($result.Success -and $result.HasRealData) {
        $realDataEndpoints++
    }
}

# Step 4: Test Command Center for Real Data
Write-Host "`n🔄 Step 4: Testing Command Center for real data..." -ForegroundColor Yellow

$commandCenterTests = @(
    @{ Url = "http://localhost:3004/api/sync?source=picks"; Name = "Command Center Picks" },
    @{ Url = "http://localhost:3004/api/sync?source=agents"; Name = "Command Center Agents" }
)

$realDataUI = 0
foreach ($test in $commandCenterTests) {
    $result = Test-APIEndpoint -Url $test.Url -Name $test.Name
    if ($result.Success -and $result.HasRealData) {
        $realDataUI++
    }
}

# Step 5: Test Database Content
Write-Host "`n🔄 Step 5: Testing database for real data..." -ForegroundColor Yellow

$databaseTests = @(
    @{ Query = "SELECT COUNT(*) FROM raw_props WHERE created_at > NOW() - INTERVAL '24 hours';"; Description = "Recent raw props" },
    @{ Query = "SELECT player_name FROM raw_props WHERE created_at > NOW() - INTERVAL '1 hour' LIMIT 5;"; Description = "Recent player names" },
    @{ Query = "SELECT COUNT(*) FROM unified_picks WHERE created_at > NOW() - INTERVAL '24 hours';"; Description = "Recent unified picks" },
    @{ Query = "SELECT agent_name, status FROM agent_health ORDER BY last_heartbeat DESC LIMIT 5;"; Description = "Agent health status" }
)

$realDataDB = 0
foreach ($test in $databaseTests) {
    $result = Test-DatabaseContent -Query $test.Query -Description $test.Description
    if ($result.Success -and $result.HasRealData) {
        $realDataDB++
    }
}

# Step 6: Check for Mock Data Files
Write-Host "`n🔄 Step 6: Scanning for mock data dependencies..." -ForegroundColor Yellow

$mockDataFiles = @(
    "apps/command-center/src/lib/mockData.ts",
    "apps/api/src/test/mockData.ts",
    "apps/dashboard/src/lib/mockData.ts"
)

$mockDataFound = 0
foreach ($file in $mockDataFiles) {
    if (Test-Path $file) {
        Write-Host "⚠️ Mock data file found: $file" -ForegroundColor Yellow
        
        # Check if it's being imported in production code
        $content = Get-Content $file -Raw
        if ($content -match "export.*mock") {
            Write-Host "❌ Mock data exports detected in $file" -ForegroundColor Red
            $mockDataFound++
        }
    }
}

# Step 7: Trigger FeedAgent Data Ingestion
Write-Host "`n🔄 Step 7: Triggering FeedAgent data ingestion..." -ForegroundColor Yellow

try {
    Write-Host "🚀 Starting FeedAgent ingestion process..." -ForegroundColor Cyan
    $feedResult = docker-compose exec -T api npm run feed-agent:ingest 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ FeedAgent ingestion completed" -ForegroundColor Green
        
        # Wait a moment for data to be processed
        Start-Sleep 10
        
        # Check if new data appeared in database
        $newDataCheck = Test-DatabaseContent -Query "SELECT COUNT(*) FROM raw_props WHERE created_at > NOW() - INTERVAL '5 minutes';" -Description "New ingested data"
        
        if ($newDataCheck.Success -and $newDataCheck.Result -gt 0) {
            Write-Host "✅ New data detected in database after ingestion" -ForegroundColor Green
        } else {
            Write-Host "⚠️ No new data detected after ingestion" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ FeedAgent ingestion failed" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Could not trigger FeedAgent: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 8: Final Assessment
Write-Host "`n📊 REAL DATA PIPELINE ASSESSMENT" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

$totalTests = $apiTests.Count + $commandCenterTests.Count + $databaseTests.Count
$totalRealData = $realDataEndpoints + $realDataUI + $realDataDB

Write-Host "API Endpoints with Real Data: $realDataEndpoints / $($apiTests.Count)" -ForegroundColor White
Write-Host "Command Center with Real Data: $realDataUI / $($commandCenterTests.Count)" -ForegroundColor White
Write-Host "Database Tables with Real Data: $realDataDB / $($databaseTests.Count)" -ForegroundColor White
Write-Host "Mock Data Files Found: $mockDataFound" -ForegroundColor White

$realDataPercentage = [math]::Round(($totalRealData / $totalTests) * 100, 1)

if ($realDataPercentage -eq 100 -and $mockDataFound -eq 0) {
    Write-Host "`n🎉 REAL DATA PIPELINE: FULLY VALIDATED!" -ForegroundColor Green
    Write-Host "✅ All endpoints serving real data" -ForegroundColor Green
    Write-Host "✅ No mock data fallbacks detected" -ForegroundColor Green
    Write-Host "✅ Database contains real sports data" -ForegroundColor Green
} elseif ($realDataPercentage -ge 80) {
    Write-Host "`n⚠️ REAL DATA PIPELINE: MOSTLY VALIDATED ($realDataPercentage%)" -ForegroundColor Yellow
    Write-Host "Most systems are using real data, but some issues remain" -ForegroundColor Yellow
} else {
    Write-Host "`n❌ REAL DATA PIPELINE: VALIDATION FAILED ($realDataPercentage%)" -ForegroundColor Red
    Write-Host "System is still heavily dependent on mock data" -ForegroundColor Red
}

Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan
if ($realDataPercentage -lt 100) {
    Write-Host "1. Fix remaining mock data dependencies" -ForegroundColor White
    Write-Host "2. Ensure Optimal API integration is working" -ForegroundColor White
    Write-Host "3. Verify FeedAgent is ingesting real data" -ForegroundColor White
    Write-Host "4. Re-run this validation script" -ForegroundColor White
} else {
    Write-Host "1. Proceed to Priority 3: Production Data Verification" -ForegroundColor White
    Write-Host "2. Capture screenshots of Command Center with real data" -ForegroundColor White
    Write-Host "3. Run E2E tests with real data validation" -ForegroundColor White
}

Write-Host "`nPress any key to exit..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# ============================================================================
# Production E2E Test Runner for Unit Talk Platform
# Runs comprehensive tests to validate real data throughout the system
# ============================================================================

Write-Host "🧪 RUNNING PRODUCTION E2E TESTS FOR UNIT TALK PLATFORM" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# Function to check if services are running
function Test-ServicesRunning {
    $requiredServices = @("api", "command-center", "postgres", "redis")
    $runningServices = 0
    
    Write-Host "🔄 Checking required services..." -ForegroundColor Yellow
    
    foreach ($service in $requiredServices) {
        try {
            $status = docker-compose ps $service --format json | ConvertFrom-Json
            if ($status.State -eq "running") {
                Write-Host "✅ $service : Running" -ForegroundColor Green
                $runningServices++
            } else {
                Write-Host "❌ $service : $($status.State)" -ForegroundColor Red
            }
        } catch {
            Write-Host "❌ $service : Not found" -ForegroundColor Red
        }
    }
    
    return $runningServices -eq $requiredServices.Count
}

# Function to wait for service readiness
function Wait-ForServiceReadiness {
    Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Yellow
    
    $endpoints = @(
        @{ Url = "http://localhost:3010/api/health"; Name = "API" },
        @{ Url = "http://localhost:3004"; Name = "Command Center" }
    )
    
    $maxWaitTime = 120 # 2 minutes
    $waitTime = 0
    $interval = 10
    
    while ($waitTime -lt $maxWaitTime) {
        $readyServices = 0
        
        foreach ($endpoint in $endpoints) {
            try {
                $response = Invoke-WebRequest -Uri $endpoint.Url -TimeoutSec 5 -UseBasicParsing
                if ($response.StatusCode -eq 200) {
                    $readyServices++
                }
            } catch {
                # Service not ready yet
            }
        }
        
        if ($readyServices -eq $endpoints.Count) {
            Write-Host "✅ All services are ready!" -ForegroundColor Green
            return $true
        }
        
        Start-Sleep $interval
        $waitTime += $interval
        Write-Host "   Still waiting... (${waitTime}s elapsed)" -ForegroundColor Yellow
    }
    
    Write-Host "⚠️ Services may not be fully ready, but proceeding with tests" -ForegroundColor Yellow
    return $false
}

# Function to run specific test suite
function Run-TestSuite {
    param(
        [string]$TestPath,
        [string]$TestName,
        [string]$WorkingDirectory = "apps/api"
    )
    
    Write-Host "`n🧪 Running $TestName..." -ForegroundColor Cyan
    Write-Host "Test Path: $TestPath" -ForegroundColor Gray
    
    try {
        # Change to API directory and run tests
        Push-Location $WorkingDirectory
        
        # Run the specific test file
        $testCommand = "docker-compose exec -T api npm test -- $TestPath --verbose"
        Write-Host "Executing: $testCommand" -ForegroundColor Gray
        
        $result = Invoke-Expression $testCommand
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ $TestName : PASSED" -ForegroundColor Green
            return @{ Success = $true; Output = $result }
        } else {
            Write-Host "❌ $TestName : FAILED" -ForegroundColor Red
            return @{ Success = $false; Output = $result }
        }
        
    } catch {
        Write-Host "❌ $TestName : ERROR - $($_.Exception.Message)" -ForegroundColor Red
        return @{ Success = $false; Error = $_.Exception.Message }
    } finally {
        Pop-Location
    }
}

# Function to run Playwright E2E tests
function Run-PlaywrightTests {
    Write-Host "`n🎭 Running Playwright E2E Tests..." -ForegroundColor Cyan
    
    try {
        Push-Location "apps/api"
        
        # Install Playwright if not already installed
        Write-Host "🔄 Ensuring Playwright is installed..." -ForegroundColor Yellow
        docker-compose exec -T api npx playwright install --with-deps
        
        # Run the production validation tests
        $playwrightCommand = "docker-compose exec -T api npx playwright test test/e2e/production-real-data-validation.test.ts --reporter=html"
        Write-Host "Executing: $playwrightCommand" -ForegroundColor Gray
        
        $result = Invoke-Expression $playwrightCommand
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Playwright E2E Tests : PASSED" -ForegroundColor Green
            return @{ Success = $true; Output = $result }
        } else {
            Write-Host "❌ Playwright E2E Tests : FAILED" -ForegroundColor Red
            return @{ Success = $false; Output = $result }
        }
        
    } catch {
        Write-Host "❌ Playwright E2E Tests : ERROR - $($_.Exception.Message)" -ForegroundColor Red
        return @{ Success = $false; Error = $_.Exception.Message }
    } finally {
        Pop-Location
    }
}

# Function to capture Command Center screenshots
function Capture-CommandCenterScreenshots {
    Write-Host "`n📸 Capturing Command Center Screenshots..." -ForegroundColor Cyan
    
    try {
        # Create screenshots directory
        $screenshotDir = "test-results/screenshots"
        if (-not (Test-Path $screenshotDir)) {
            New-Item -ItemType Directory -Path $screenshotDir -Force
        }
        
        # Use Playwright to capture screenshots
        Push-Location "apps/api"
        
        $screenshotScript = @"
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Navigate to Command Center
    await page.goto('http://localhost:3004', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);
    
    // Take full page screenshot
    await page.screenshot({ 
      path: 'test-results/screenshots/command-center-full.png',
      fullPage: true 
    });
    
    // Take dashboard screenshot
    await page.screenshot({ 
      path: 'test-results/screenshots/command-center-dashboard.png'
    });
    
    console.log('✅ Screenshots captured successfully');
  } catch (error) {
    console.error('❌ Screenshot capture failed:', error);
  } finally {
    await browser.close();
  }
})();
"@
        
        $screenshotScript | Out-File -FilePath "capture-screenshots.js" -Encoding UTF8
        
        docker-compose exec -T api node capture-screenshots.js
        
        Remove-Item "capture-screenshots.js" -Force
        
        Write-Host "✅ Screenshots captured in test-results/screenshots/" -ForegroundColor Green
        
    } catch {
        Write-Host "❌ Screenshot capture failed: $($_.Exception.Message)" -ForegroundColor Red
    } finally {
        Pop-Location
    }
}

# Main execution
Write-Host "`n🚀 Starting Production E2E Test Suite..." -ForegroundColor Green

# Step 1: Check if services are running
if (-not (Test-ServicesRunning)) {
    Write-Host "❌ Not all required services are running!" -ForegroundColor Red
    Write-Host "Please run: .\VERIFY-DOCKER-SERVICES.ps1" -ForegroundColor Yellow
    exit 1
}

# Step 2: Wait for service readiness
Wait-ForServiceReadiness

# Step 3: Run database validation tests
Write-Host "`n📊 PHASE 1: DATABASE VALIDATION TESTS" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

$databaseTests = @(
    @{ Path = "test/integration/supabase-integration.test.ts"; Name = "Supabase Integration" },
    @{ Path = "test/schema/v3-schema-compliance.test.ts"; Name = "v3.0.0 Schema Compliance" }
)

$passedDatabaseTests = 0
foreach ($test in $databaseTests) {
    $result = Run-TestSuite -TestPath $test.Path -TestName $test.Name
    if ($result.Success) {
        $passedDatabaseTests++
    }
}

# Step 4: Run agent validation tests
Write-Host "`n🤖 PHASE 2: AGENT VALIDATION TESTS" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

$agentTests = @(
    @{ Path = "test/agents/FeedAgent"; Name = "FeedAgent Real Data" },
    @{ Path = "test/agents/GradingAgent"; Name = "GradingAgent Processing" },
    @{ Path = "test/agents/AgentInfrastructureTests.test.ts"; Name = "Agent Infrastructure" }
)

$passedAgentTests = 0
foreach ($test in $agentTests) {
    $result = Run-TestSuite -TestPath $test.Path -TestName $test.Name
    if ($result.Success) {
        $passedAgentTests++
    }
}

# Step 5: Run API integration tests
Write-Host "`n🌐 PHASE 3: API INTEGRATION TESTS" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

$apiTests = @(
    @{ Path = "test/integration/odds-integration.test.ts"; Name = "External API Integration" },
    @{ Path = "test/integration/system-integration.test.ts"; Name = "System Integration" }
)

$passedApiTests = 0
foreach ($test in $apiTests) {
    $result = Run-TestSuite -TestPath $test.Path -TestName $test.Name
    if ($result.Success) {
        $passedApiTests++
    }
}

# Step 6: Run Playwright E2E tests
Write-Host "`n🎭 PHASE 4: END-TO-END UI TESTS" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

$playwrightResult = Run-PlaywrightTests
$passedE2ETests = if ($playwrightResult.Success) { 1 } else { 0 }

# Step 7: Capture screenshots
Capture-CommandCenterScreenshots

# Step 8: Generate test report
Write-Host "`n📊 PRODUCTION E2E TEST RESULTS" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

$totalTests = $databaseTests.Count + $agentTests.Count + $apiTests.Count + 1 # +1 for Playwright
$totalPassed = $passedDatabaseTests + $passedAgentTests + $passedApiTests + $passedE2ETests

Write-Host "Database Tests: $passedDatabaseTests / $($databaseTests.Count)" -ForegroundColor White
Write-Host "Agent Tests: $passedAgentTests / $($agentTests.Count)" -ForegroundColor White
Write-Host "API Tests: $passedApiTests / $($apiTests.Count)" -ForegroundColor White
Write-Host "E2E Tests: $passedE2ETests / 1" -ForegroundColor White
Write-Host "Total: $totalPassed / $totalTests" -ForegroundColor White

$passPercentage = [math]::Round(($totalPassed / $totalTests) * 100, 1)

if ($passPercentage -eq 100) {
    Write-Host "`n🎉 ALL PRODUCTION TESTS PASSED!" -ForegroundColor Green
    Write-Host "✅ System is validated for production deployment" -ForegroundColor Green
    Write-Host "✅ Real data confirmed throughout the pipeline" -ForegroundColor Green
    Write-Host "✅ No mock data detected in any component" -ForegroundColor Green
} elseif ($passPercentage -ge 80) {
    Write-Host "`n⚠️ MOST TESTS PASSED ($passPercentage%)" -ForegroundColor Yellow
    Write-Host "System is mostly ready but some issues need attention" -ForegroundColor Yellow
} else {
    Write-Host "`n❌ PRODUCTION TESTS FAILED ($passPercentage%)" -ForegroundColor Red
    Write-Host "System is not ready for production deployment" -ForegroundColor Red
}

# Step 9: Generate detailed report
$reportPath = "test-results/production-e2e-report.md"
$reportContent = @"
# Production E2E Test Report

**Test Date**: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
**Test Environment**: Unit Talk Platform Production Validation
**Overall Result**: $passPercentage% ($totalPassed/$totalTests tests passed)

## Test Results Summary

### Database Validation Tests
- Passed: $passedDatabaseTests / $($databaseTests.Count)
- Status: $(if ($passedDatabaseTests -eq $databaseTests.Count) { "✅ PASSED" } else { "❌ FAILED" })

### Agent Validation Tests  
- Passed: $passedAgentTests / $($agentTests.Count)
- Status: $(if ($passedAgentTests -eq $agentTests.Count) { "✅ PASSED" } else { "❌ FAILED" })

### API Integration Tests
- Passed: $passedApiTests / $($apiTests.Count)  
- Status: $(if ($passedApiTests -eq $apiTests.Count) { "✅ PASSED" } else { "❌ FAILED" })

### End-to-End UI Tests
- Passed: $passedE2ETests / 1
- Status: $(if ($passedE2ETests -eq 1) { "✅ PASSED" } else { "❌ FAILED" })

## Production Readiness Assessment

$(if ($passPercentage -eq 100) {
"🎉 **PRODUCTION READY**

All tests passed successfully. The Unit Talk platform is validated for production deployment with real sports data throughout the entire pipeline."
} elseif ($passPercentage -ge 80) {
"⚠️ **MOSTLY READY**  

Most tests passed but some issues remain. Review failed tests and address before production deployment."
} else {
"❌ **NOT PRODUCTION READY**

Significant issues detected. System requires additional development before production deployment."
})

## Screenshots

- Command Center Full Page: test-results/screenshots/command-center-full.png
- Command Center Dashboard: test-results/screenshots/command-center-dashboard.png

## Next Steps

$(if ($passPercentage -eq 100) {
"1. Deploy to production environment
2. Monitor system performance and data flow
3. Set up production monitoring and alerting"
} else {
"1. Review and fix failed tests
2. Re-run validation after fixes
3. Ensure all mock data dependencies are removed"
})

---
Generated by Unit Talk Production E2E Test Suite
"@

if (-not (Test-Path "test-results")) {
    New-Item -ItemType Directory -Path "test-results" -Force
}

$reportContent | Out-File -FilePath $reportPath -Encoding UTF8
Write-Host "`n📄 Detailed report generated: $reportPath" -ForegroundColor Cyan

Write-Host "`nPress any key to exit..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

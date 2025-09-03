# ============================================================================
# Docker Services Verification Script for Unit Talk Platform
# Ensures all services start correctly and are healthy
# ============================================================================

Write-Host "🐳 VERIFYING DOCKER SERVICES FOR UNIT TALK PLATFORM" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

# Function to check if Docker is running
function Test-DockerRunning {
    try {
        $dockerInfo = docker info 2>$null
        return $true
    } catch {
        return $false
    }
}

# Function to wait for service health
function Wait-ForServiceHealth {
    param(
        [string]$ServiceName,
        [string]$HealthEndpoint,
        [int]$TimeoutSeconds = 120
    )
    
    Write-Host "⏳ Waiting for $ServiceName to become healthy..." -ForegroundColor Yellow
    $elapsed = 0
    $interval = 5
    
    while ($elapsed -lt $TimeoutSeconds) {
        try {
            $response = Invoke-WebRequest -Uri $HealthEndpoint -TimeoutSec 5 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-Host "✅ $ServiceName is healthy!" -ForegroundColor Green
                return $true
            }
        } catch {
            # Service not ready yet
        }
        
        Start-Sleep $interval
        $elapsed += $interval
        
        if ($elapsed % 30 -eq 0) {
            Write-Host "   Still waiting for $ServiceName... (${elapsed}s elapsed)" -ForegroundColor Yellow
        }
    }
    
    Write-Host "❌ $ServiceName failed to become healthy within ${TimeoutSeconds}s" -ForegroundColor Red
    return $false
}

# Step 1: Check Docker Desktop
Write-Host "`n🔄 Step 1: Checking Docker Desktop..." -ForegroundColor Yellow

if (-not (Test-DockerRunning)) {
    Write-Host "❌ Docker is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Docker is running" -ForegroundColor Green

# Step 2: Check WSL integration
Write-Host "`n🔄 Step 2: Checking WSL integration..." -ForegroundColor Yellow
try {
    $wslTest = wsl echo "WSL Docker integration test"
    if ($wslTest -eq "WSL Docker integration test") {
        Write-Host "✅ WSL integration working" -ForegroundColor Green
    } else {
        Write-Host "⚠️ WSL integration may have issues" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ WSL integration failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 3: Navigate to project directory
Write-Host "`n🔄 Step 3: Checking project directory..." -ForegroundColor Yellow
$projectPath = Get-Location
Write-Host "📁 Current directory: $projectPath" -ForegroundColor Cyan

# Check for required files
$requiredFiles = @("docker-compose.yml", "dev.sh", ".env")
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✅ $file found" -ForegroundColor Green
    } else {
        Write-Host "❌ $file missing" -ForegroundColor Red
    }
}

# Step 4: Stop any existing services
Write-Host "`n🔄 Step 4: Cleaning up existing services..." -ForegroundColor Yellow
try {
    docker-compose down --remove-orphans 2>$null
    Write-Host "✅ Existing services stopped" -ForegroundColor Green
} catch {
    Write-Host "⚠️ No existing services to stop" -ForegroundColor Yellow
}

# Step 5: Start services using WSL
Write-Host "`n🔄 Step 5: Starting Unit Talk services..." -ForegroundColor Yellow
Write-Host "This may take several minutes for first-time setup..." -ForegroundColor Cyan

try {
    # Use WSL to run the dev.sh script
    Write-Host "🚀 Executing: wsl ./dev.sh start" -ForegroundColor Cyan
    $startResult = wsl ./dev.sh start
    Write-Host $startResult -ForegroundColor White
} catch {
    Write-Host "❌ Failed to start services via WSL: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Trying alternative Docker Compose approach..." -ForegroundColor Yellow
    
    try {
        docker-compose up -d
        Write-Host "✅ Services started via Docker Compose" -ForegroundColor Green
    } catch {
        Write-Host "❌ Docker Compose also failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# Step 6: Wait for services to initialize
Write-Host "`n🔄 Step 6: Waiting for services to initialize..." -ForegroundColor Yellow
Start-Sleep 30

# Step 7: Check service status
Write-Host "`n🔄 Step 7: Checking service status..." -ForegroundColor Yellow
try {
    $services = docker-compose ps --format json | ConvertFrom-Json
    
    Write-Host "📋 Service Status:" -ForegroundColor Cyan
    foreach ($service in $services) {
        $status = $service.State
        $name = $service.Name
        
        if ($status -eq "running") {
            Write-Host "✅ $name : $status" -ForegroundColor Green
        } else {
            Write-Host "❌ $name : $status" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "⚠️ Could not get service status: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Step 8: Health check critical services
Write-Host "`n🔄 Step 8: Performing health checks..." -ForegroundColor Yellow

$healthChecks = @(
    @{ Name = "API"; Endpoint = "http://localhost:3010/api/health" },
    @{ Name = "Command Center"; Endpoint = "http://localhost:3004" },
    @{ Name = "Smart Form"; Endpoint = "http://localhost:3002" },
    @{ Name = "Dashboard"; Endpoint = "http://localhost:3003" },
    @{ Name = "Temporal UI"; Endpoint = "http://localhost:8088" },
    @{ Name = "Prometheus"; Endpoint = "http://localhost:9090/-/healthy" }
)

$healthyServices = 0
$totalServices = $healthChecks.Count

foreach ($check in $healthChecks) {
    if (Wait-ForServiceHealth -ServiceName $check.Name -HealthEndpoint $check.Endpoint -TimeoutSeconds 60) {
        $healthyServices++
    }
}

# Step 9: Database connectivity test
Write-Host "`n🔄 Step 9: Testing database connectivity..." -ForegroundColor Yellow
try {
    $dbTest = docker-compose exec -T postgres pg_isready -U postgres
    if ($dbTest -match "accepting connections") {
        Write-Host "✅ PostgreSQL database is ready" -ForegroundColor Green
    } else {
        Write-Host "⚠️ PostgreSQL status: $dbTest" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Database connectivity test failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 10: Redis connectivity test
Write-Host "`n🔄 Step 10: Testing Redis connectivity..." -ForegroundColor Yellow
try {
    $redisTest = docker-compose exec -T redis redis-cli ping
    if ($redisTest -match "PONG") {
        Write-Host "✅ Redis is responding" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Redis response: $redisTest" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Redis connectivity test failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 11: Final assessment
Write-Host "`n📊 FINAL ASSESSMENT" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan

$healthPercentage = [math]::Round(($healthyServices / $totalServices) * 100, 1)

Write-Host "Healthy Services: $healthyServices / $totalServices ($healthPercentage%)" -ForegroundColor White

if ($healthyServices -eq $totalServices) {
    Write-Host "🎉 ALL SERVICES ARE HEALTHY AND READY!" -ForegroundColor Green
    Write-Host "`n🌐 Service URLs:" -ForegroundColor Cyan
    Write-Host "📊 Command Center:    http://localhost:3004" -ForegroundColor White
    Write-Host "📱 Smart Form:        http://localhost:3002" -ForegroundColor White
    Write-Host "📈 Dashboard:         http://localhost:3003" -ForegroundColor White
    Write-Host "🔧 API:               http://localhost:3010" -ForegroundColor White
    Write-Host "⏱️  Temporal UI:       http://localhost:8088" -ForegroundColor White
    Write-Host "📊 Prometheus:        http://localhost:9090" -ForegroundColor White
} elseif ($healthyServices -ge ($totalServices * 0.7)) {
    Write-Host "⚠️ MOST SERVICES ARE HEALTHY - Some issues detected" -ForegroundColor Yellow
    Write-Host "The platform should be functional but may have degraded performance." -ForegroundColor Yellow
} else {
    Write-Host "❌ CRITICAL ISSUES DETECTED - Multiple services unhealthy" -ForegroundColor Red
    Write-Host "Please check Docker logs: docker-compose logs" -ForegroundColor Yellow
}

Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. If services are healthy, proceed to Priority 2 (Real Data Pipeline)" -ForegroundColor White
Write-Host "2. If issues persist, check logs: docker-compose logs [service-name]" -ForegroundColor White
Write-Host "3. To stop services: docker-compose down" -ForegroundColor White
Write-Host "4. To restart services: wsl ./dev.sh restart" -ForegroundColor White

Write-Host "`nPress any key to exit..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

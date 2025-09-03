# ==============================================
# Unit Talk Development Environment Startup
# SaaS-Grade Production-Ready Orchestration
# Windows PowerShell Version
# ==============================================

param(
    [Parameter(Position=0)]
    [ValidateSet('start', 'stop', 'restart', 'logs', 'status', 'clean', 'reset', 'health', 'monitor', 'scale', 'backup')]
    [string]$Command = 'start',
    
    [Parameter()]
    [string]$Service = '',
    
    [Parameter()]
    [switch]$Force,
    
    [Parameter()]
    [switch]$Production
)

# Set strict error handling
$ErrorActionPreference = "Stop"
$ProgressPreference = 'SilentlyContinue'

# Configuration
$global:ComposeFile = "docker-compose.yml"
$global:ProductionComposeFile = "docker-compose.prod.yml"
$global:HealthCheckTimeout = 300  # 5 minutes
$global:HealthCheckInterval = 5   # 5 seconds
$global:LogPath = ".\logs"
$global:MetricsPort = 9090

# Color definitions for output
function Write-Status { Write-Host "[$(Get-Date -Format 'HH:mm:ss')]" -ForegroundColor Blue -NoNewline; Write-Host " $args" }
function Write-Success { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ✅" -ForegroundColor Green -NoNewline; Write-Host " $args" }
function Write-Warning { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ⚠️" -ForegroundColor Yellow -NoNewline; Write-Host " $args" }
function Write-Error { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ❌" -ForegroundColor Red -NoNewline; Write-Host " $args" }
function Write-Info { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ℹ️" -ForegroundColor Cyan -NoNewline; Write-Host " $args" }

# Function to check prerequisites
function Test-Prerequisites {
    Write-Status "Checking prerequisites..."
    
    # Check if Docker is installed
    try {
        $dockerVersion = docker version --format '{{.Server.Version}}' 2>$null
        if (-not $dockerVersion) {
            throw "Docker is not installed or not running"
        }
        Write-Success "Docker version: $dockerVersion"
    }
    catch {
        Write-Error "Docker is not running. Please start Docker Desktop."
        exit 1
    }
    
    # Check if docker-compose is available
    try {
        $composeVersion = docker-compose version --short 2>$null
        if (-not $composeVersion) {
            # Try Docker Compose V2
            $composeVersion = docker compose version --short 2>$null
            if (-not $composeVersion) {
                throw "Docker Compose is not installed"
            }
            $global:ComposeCommand = "docker compose"
        } else {
            $global:ComposeCommand = "docker-compose"
        }
        Write-Success "Docker Compose version: $composeVersion"
    }
    catch {
        Write-Error "Docker Compose is not installed or not in PATH."
        exit 1
    }
    
    # Check if required files exist
    if (-not (Test-Path $ComposeFile)) {
        Write-Error "Docker Compose file not found: $ComposeFile"
        exit 1
    }
    
    # Check if .env file exists
    if (-not (Test-Path ".env")) {
        Write-Warning ".env file not found. Creating from .env.example..."
        if (Test-Path ".env.example") {
            Copy-Item ".env.example" ".env"
            Write-Info "Please update .env with your actual values before continuing."
            exit 1
        }
        else {
            Write-Error "No .env.example file found. Please create .env manually."
            exit 1
        }
    }
    
    # Check available resources
    $memory = (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB
    $cpu = (Get-CimInstance Win32_Processor).NumberOfLogicalProcessors
    
    Write-Info "System Resources: $([math]::Round($memory, 2))GB RAM, $cpu CPU cores"
    
    if ($memory -lt 8) {
        Write-Warning "System has less than 8GB RAM. Performance may be impacted."
    }
    
    Write-Success "Prerequisites check passed!"
}

# Function to setup monitoring
function Initialize-Monitoring {
    Write-Status "Setting up monitoring infrastructure..."
    
    # Create monitoring directories
    $monitoringDirs = @(
        ".\monitoring\prometheus",
        ".\monitoring\grafana\dashboards",
        ".\monitoring\grafana\provisioning",
        ".\monitoring\loki",
        ".\monitoring\alertmanager",
        ".\logs\apps",
        ".\logs\system",
        ".\logs\audit"
    )
    
    foreach ($dir in $monitoringDirs) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
    }
    
    # Create Prometheus configuration
    $prometheusConfig = @'
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    monitor: 'unit-talk-monitor'
    environment: 'development'

# Alerting configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

# Load rules once and periodically evaluate them
rule_files:
  - "alerts/*.yml"

scrape_configs:
  # Application metrics
  - job_name: 'unit-talk-api'
    static_configs:
      - targets: ['api:9464']
    scrape_interval: 5s
    metrics_path: /metrics
    
  - job_name: 'unit-talk-workers'
    static_configs:
      - targets: ['workers:9464']
    scrape_interval: 5s
    
  - job_name: 'unit-talk-discord-bot'
    static_configs:
      - targets: ['discord-bot:9464']
      
  # Infrastructure metrics
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
      
  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']
      
  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['postgres-exporter:9187']
      
  - job_name: 'redis-exporter'
    static_configs:
      - targets: ['redis-exporter:9121']
      
  - job_name: 'temporal'
    static_configs:
      - targets: ['temporal:7233']
    scrape_interval: 10s
'@
    
    Set-Content -Path ".\monitoring\prometheus\prometheus.yml" -Value $prometheusConfig
    
    # Create alert rules
    $alertRules = @'
groups:
  - name: application_alerts
    interval: 30s
    rules:
      - alert: APIDown
        expr: up{job="unit-talk-api"} == 0
        for: 1m
        labels:
          severity: critical
          component: api
        annotations:
          summary: "API service is down"
          description: "The Unit Talk API has been down for more than 1 minute"
          
      - alert: HighMemoryUsage
        expr: container_memory_usage_bytes{name=~"unit-talk-.*"} / container_spec_memory_limit_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"
          description: "Container {{ $labels.name }} memory usage is above 90%"
          
      - alert: HighCPUUsage
        expr: rate(container_cpu_usage_seconds_total{name=~"unit-talk-.*"}[5m]) * 100 > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage detected"
          description: "Container {{ $labels.name }} CPU usage is above 80%"
          
      - alert: DatabaseConnectionPoolExhausted
        expr: pg_stat_database_numbackends{datname="unit_talk_dev"} / pg_settings_max_connections > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Database connection pool nearly exhausted"
          description: "PostgreSQL connection pool is at {{ $value | humanizePercentage }} capacity"
'@
    
    if (-not (Test-Path ".\monitoring\prometheus\alerts")) {
        New-Item -ItemType Directory -Path ".\monitoring\prometheus\alerts" -Force | Out-Null
    }
    Set-Content -Path ".\monitoring\prometheus\alerts\application.yml" -Value $alertRules
    
    Write-Success "Monitoring infrastructure configured!"
}

# Function to wait for service health
function Wait-ForService {
    param(
        [string]$ServiceName,
        [string]$HealthEndpoint,
        [int]$Timeout = 60
    )
    
    $elapsed = 0
    Write-Status "Waiting for $ServiceName to become healthy..."
    
    while ($elapsed -lt $Timeout) {
        try {
            $response = Invoke-WebRequest -Uri $HealthEndpoint -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Success "$ServiceName is healthy!"
                return $true
            }
        }
        catch {
            # Service not ready yet
        }
        
        Start-Sleep -Seconds $global:HealthCheckInterval
        $elapsed += $global:HealthCheckInterval
        
        if ($elapsed % 15 -eq 0) {
            Write-Status "Still waiting for $ServiceName... ($elapsed`s elapsed)"
        }
    }
    
    Write-Error "$ServiceName failed to become healthy within $Timeout seconds"
    return $false
}

# Function to perform comprehensive health checks
function Test-ServiceHealth {
    Write-Status "Performing comprehensive health checks..."
    
    $services = @(
        @{Name="PostgreSQL"; Port=5432; Type="tcp"},
        @{Name="Redis"; Port=6379; Type="tcp"},
        @{Name="API"; Endpoint="http://localhost:3001/health"; Type="http"},
        @{Name="Command Center"; Endpoint="http://localhost:3004"; Type="http"},
        @{Name="Smart Form"; Endpoint="http://localhost:3002"; Type="http"},
        @{Name="Temporal"; Endpoint="http://localhost:8088"; Type="http"},
        @{Name="Prometheus"; Endpoint="http://localhost:9090/-/healthy"; Type="http"},
        @{Name="Grafana"; Endpoint="http://localhost:3000/api/health"; Type="http"}
    )
    
    $healthStatus = @{}
    $allHealthy = $true
    
    foreach ($service in $services) {
        $isHealthy = $false
        
        if ($service.Type -eq "tcp") {
            # Test TCP connection
            try {
                $connection = Test-NetConnection -ComputerName localhost -Port $service.Port -WarningAction SilentlyContinue
                $isHealthy = $connection.TcpTestSucceeded
            }
            catch {
                $isHealthy = $false
            }
        }
        elseif ($service.Type -eq "http") {
            # Test HTTP endpoint
            try {
                $response = Invoke-WebRequest -Uri $service.Endpoint -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
                $isHealthy = $response.StatusCode -eq 200
            }
            catch {
                $isHealthy = $false
            }
        }
        
        $healthStatus[$service.Name] = $isHealthy
        
        if ($isHealthy) {
            Write-Success "$($service.Name) is healthy"
        }
        else {
            Write-Warning "$($service.Name) is not responding"
            $allHealthy = $false
        }
    }
    
    return $allHealthy
}

# Function to start services with orchestration
function Start-Services {
    Write-Status "Starting Unit Talk services with orchestration..."
    
    # Phase 1: Infrastructure layer
    Write-Status "Phase 1: Starting infrastructure services..."
    & $global:ComposeCommand up -d postgres redis temporal-postgres 2>&1 | Out-Null
    Start-Sleep -Seconds 10
    
    # Phase 2: Message queue and workflow engine
    Write-Status "Phase 2: Starting workflow engine..."
    & $global:ComposeCommand up -d temporal temporal-ui 2>&1 | Out-Null
    Start-Sleep -Seconds 5
    
    # Phase 3: Monitoring stack
    Write-Status "Phase 3: Starting monitoring stack..."
    & $global:ComposeCommand up -d prometheus grafana loki node-exporter cadvisor 2>&1 | Out-Null
    
    # Phase 4: Core API
    Write-Status "Phase 4: Starting core API..."
    & $global:ComposeCommand up -d api 2>&1 | Out-Null
    
    # Wait for API to be healthy
    if (Wait-ForService -ServiceName "API" -HealthEndpoint "http://localhost:3001/health" -Timeout 60) {
        # Phase 5: Workers and background services
        Write-Status "Phase 5: Starting workers and background services..."
        & $global:ComposeCommand up -d workers discord-bot 2>&1 | Out-Null
        
        # Phase 6: Frontend applications
        Write-Status "Phase 6: Starting frontend applications..."
        & $global:ComposeCommand up -d smart-form dashboard command-center 2>&1 | Out-Null
        
        Write-Success "All services started successfully!"
        return $true
    }
    else {
        Write-Error "Failed to start core services"
        return $false
    }
}

# Function to show service URLs
function Show-ServiceUrls {
    Write-Host ""
    Write-Host "🌐 Service URLs:" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "📊 Command Center:    http://localhost:3004" -ForegroundColor Green
    Write-Host "📱 Smart Form:        http://localhost:3002" -ForegroundColor Green
    Write-Host "📈 Dashboard:         http://localhost:3003" -ForegroundColor Green
    Write-Host "🔧 API:               http://localhost:3001" -ForegroundColor Green
    Write-Host ""
    Write-Host "🛠️  DevOps Tools:" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "⏱️  Temporal UI:       http://localhost:8088" -ForegroundColor Yellow
    Write-Host "📊 Prometheus:        http://localhost:9090" -ForegroundColor Yellow
    Write-Host "📈 Grafana:           http://localhost:3000 (admin/admin)" -ForegroundColor Yellow
    Write-Host "🗄️  pgAdmin:           http://localhost:5050" -ForegroundColor Yellow
    Write-Host "📮 Redis Commander:   http://localhost:8081" -ForegroundColor Yellow
    Write-Host ""
}

# Function to show real-time monitoring
function Show-Monitoring {
    Write-Status "Starting real-time monitoring dashboard..."
    
    while ($true) {
        Clear-Host
        Write-Host "🎯 UNIT TALK - REAL-TIME MONITORING" -ForegroundColor Magenta
        Write-Host "==================================================" -ForegroundColor Magenta
        Write-Host ""
        
        # Get container stats
        $stats = docker stats --no-stream --format "json" | ConvertFrom-Json
        
        Write-Host "📊 Service Status:" -ForegroundColor Cyan
        Write-Host "-------------------" -ForegroundColor Cyan
        
        foreach ($stat in $stats) {
            if ($stat.Name -like "unit-talk-*") {
                $name = $stat.Name -replace "unit-talk-", ""
                $cpu = $stat.CPUPerc
                $mem = $stat.MemUsage
                
                $cpuColor = if ([double]($cpu -replace '%','') -gt 80) { "Red" } 
                            elseif ([double]($cpu -replace '%','') -gt 50) { "Yellow" } 
                            else { "Green" }
                
                Write-Host "$name".PadRight(20) -NoNewline
                Write-Host "CPU: " -NoNewline
                Write-Host $cpu.PadRight(8) -ForegroundColor $cpuColor -NoNewline
                Write-Host "MEM: $mem"
            }
        }
        
        Write-Host ""
        Write-Host "Press Ctrl+C to exit monitoring..." -ForegroundColor Gray
        Start-Sleep -Seconds 2
    }
}

# Function to backup data
function Backup-Data {
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupDir = ".\backups\$timestamp"
    
    Write-Status "Creating backup at $backupDir..."
    
    if (-not (Test-Path ".\backups")) {
        New-Item -ItemType Directory -Path ".\backups" -Force | Out-Null
    }
    
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    
    # Backup database
    Write-Status "Backing up PostgreSQL database..."
    docker exec unit-talk-postgres pg_dump -U postgres unit_talk_dev > "$backupDir\database.sql"
    
    # Backup Redis
    Write-Status "Backing up Redis data..."
    docker exec unit-talk-redis redis-cli BGSAVE
    Start-Sleep -Seconds 2
    docker cp unit-talk-redis:/data/dump.rdb "$backupDir\redis.rdb"
    
    # Backup environment files
    Write-Status "Backing up configuration..."
    Copy-Item ".env" "$backupDir\.env"
    Copy-Item "docker-compose.yml" "$backupDir\docker-compose.yml"
    
    # Compress backup
    Write-Status "Compressing backup..."
    Compress-Archive -Path "$backupDir\*" -DestinationPath "$backupDir.zip"
    Remove-Item -Path $backupDir -Recurse -Force
    
    Write-Success "Backup completed: $backupDir.zip"
}

# Function to scale services
function Scale-Service {
    param(
        [string]$ServiceName,
        [int]$Replicas
    )
    
    Write-Status "Scaling $ServiceName to $Replicas replicas..."
    & $global:ComposeCommand up -d --scale $ServiceName=$Replicas 2>&1 | Out-Null
    Write-Success "$ServiceName scaled to $Replicas replicas"
}

# Main execution
function Main {
    # Show banner
    Write-Host ""
    Write-Host "===================================================" -ForegroundColor Magenta
    Write-Host "    UNIT TALK PLATFORM - SAAS-GRADE DEVOPS" -ForegroundColor Magenta
    Write-Host "    Enterprise Production-Ready Environment" -ForegroundColor Magenta
    Write-Host "===================================================" -ForegroundColor Magenta
    Write-Host ""
    
    switch ($Command) {
        'start' {
            Test-Prerequisites
            Initialize-Monitoring
            
            if ($Production) {
                Write-Warning "Starting in PRODUCTION mode..."
                $global:ComposeFile = $ProductionComposeFile
            }
            
            if (Start-Services) {
                Write-Status "Waiting for services to stabilize..."
                Start-Sleep -Seconds 15
                
                if (Test-ServiceHealth) {
                    Show-ServiceUrls
                    Write-Success "🚀 Unit Talk platform is ready for SaaS operations!"
                    Write-Info "Run '.\dev.ps1 monitor' for real-time monitoring"
                    Write-Info "Run '.\dev.ps1 logs' to view service logs"
                    
                    # Open browser tabs
                    $openBrowser = Read-Host "Open browser tabs for key services? (Y/n)"
                    if ($openBrowser -ne 'n') {
                        Start-Process "http://localhost:3004"  # Command Center
                        Start-Process "http://localhost:9090"  # Prometheus
                        Start-Process "http://localhost:3000"  # Grafana
                    }
                }
                else {
                    Write-Warning "Some services may not be fully ready. Check logs with '.\dev.ps1 logs'"
                }
            }
        }
        
        'stop' {
            Write-Status "Stopping all services..."
            & $global:ComposeCommand down 2>&1 | Out-Null
            Write-Success "All services stopped"
        }
        
        'restart' {
            Write-Status "Restarting services..."
            & $global:ComposeCommand restart 2>&1 | Out-Null
            Write-Success "Services restarted"
        }
        
        'logs' {
            if ($Service) {
                & $global:ComposeCommand logs -f --tail=100 $Service
            }
            else {
                & $global:ComposeCommand logs -f --tail=50
            }
        }
        
        'status' {
            Write-Info "Service Status:"
            & $global:ComposeCommand ps
            Write-Host ""
            Write-Info "Resource Usage:"
            docker stats --no-stream
        }
        
        'health' {
            Test-ServiceHealth
        }
        
        'monitor' {
            Show-Monitoring
        }
        
        'scale' {
            if (-not $Service) {
                Write-Error "Please specify a service to scale with -Service parameter"
                exit 1
            }
            $replicas = Read-Host "Number of replicas"
            Scale-Service -ServiceName $Service -Replicas $replicas
        }
        
        'backup' {
            Backup-Data
        }
        
        'clean' {
            Write-Status "Cleaning up environment..."
            & $global:ComposeCommand down --remove-orphans 2>&1 | Out-Null
            docker system prune -f
            Write-Success "Cleanup complete"
        }
        
        'reset' {
            Write-Warning "This will delete all data and volumes!"
            $confirm = Read-Host "Are you sure? (type 'yes' to confirm)"
            if ($confirm -eq 'yes') {
                Write-Status "Resetting environment..."
                & $global:ComposeCommand down --volumes --remove-orphans 2>&1 | Out-Null
                docker system prune -af
                Write-Success "Environment reset complete"
            }
        }
        
        default {
            Write-Error "Unknown command: $Command"
            Write-Host "Available commands: start, stop, restart, logs, status, health, monitor, scale, backup, clean, reset"
        }
    }
}

# Execute main function
Main
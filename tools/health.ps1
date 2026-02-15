#Requires -Version 5.1
<#
.SYNOPSIS
    Unit Talk DX-OPS Health Check Script (v2 - Hardened)
.DESCRIPTION
    Fast ops preflight diagnostic for the Unit Talk platform.
    Checks required tools, Docker daemon, container health, and HTTP endpoints.
    Features: Dynamic service discovery, fallback endpoints, timeout visibility.
.EXAMPLE
    .\tools\health.ps1
    .\tools\health.ps1 -Verbose
#>

[CmdletBinding()]
param(
    [switch]$CollectLogs,
    [string]$OutputDir = "$PSScriptRoot\..\out\dx-ops-pack\$(Get-Date -Format 'yyyy-MM-dd')"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ============================================================================
# Configuration
# ============================================================================
$Config = @{
    RequiredTools = @(
        @{ Name = "docker"; InstallHint = "Install Docker Desktop from https://docker.com/products/docker-desktop" }
        @{ Name = "node"; InstallHint = "Install Node.js from https://nodejs.org" }
        @{ Name = "pnpm"; InstallHint = "Run: npm install -g pnpm" }
    )
    # Critical services mapped by compose service name (NOT container name)
    # Container names are discovered dynamically
    CriticalServiceMap = @{
        "postgres" = @{ Critical = $true }
        "redis" = @{ Critical = $true }
        "temporal" = @{ Critical = $true }
        "api" = @{ Critical = $true }
        "smart-form" = @{ Critical = $false }
        "command-center" = @{ Critical = $false }
        "dashboard" = @{ Critical = $false }
        "workers" = @{ Critical = $false }
        "temporal-ui" = @{ Critical = $false }
        "prometheus" = @{ Critical = $false }
        "grafana" = @{ Critical = $false }
        "outbox-consumer" = @{ Critical = $false }
        "discord-bot" = @{ Critical = $false }
        "temporal-postgres" = @{ Critical = $false }
    }
    # HTTP endpoints with fallback support
    HttpEndpoints = @(
        @{ Name = "API Health"; Urls = @("http://127.0.0.1:3010/api/health"); Critical = $true }
        @{ Name = "Smart Form"; Urls = @("http://127.0.0.1:3002/api/health", "http://127.0.0.1:3002"); Critical = $false }
        @{ Name = "Command Center"; Urls = @("http://127.0.0.1:3004/api/health", "http://127.0.0.1:3004"); Critical = $false }
        @{ Name = "Dashboard"; Urls = @("http://127.0.0.1:3003"); Critical = $false }
        @{ Name = "Prometheus"; Urls = @("http://127.0.0.1:9090/-/healthy"); Critical = $false }
        @{ Name = "Temporal UI"; Urls = @("http://127.0.0.1:8088"); Critical = $false }
    )
}

# ============================================================================
# Helper Functions
# ============================================================================
function Write-StatusLine {
    param(
        [string]$Status,
        [string]$Name,
        [string]$Details = ""
    )
    $icon = switch ($Status) {
        "OK" { "[OK]" }
        "WARN" { "[!!]" }
        "FAIL" { "[XX]" }
        "INFO" { "[--]" }
        default { "[??]" }
    }
    $color = switch ($Status) {
        "OK" { "Green" }
        "WARN" { "Yellow" }
        "FAIL" { "Red" }
        "INFO" { "Cyan" }
        default { "White" }
    }
    $line = "{0,-6} {1,-25}" -f $icon, $Name
    if ($Details) { $line += " $Details" }
    Write-Host $line -ForegroundColor $color
}

function Test-CommandExists {
    param([string]$Command)
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

function Get-DockerComposeCommand {
    # Prefer "docker compose" (v2), fall back to "docker-compose" (v1)
    if (Test-CommandExists "docker") {
        try {
            $null = & docker compose version 2>&1
            if ($LASTEXITCODE -eq 0) { return "docker compose" }
        } catch {}
    }
    if (Test-CommandExists "docker-compose") { return "docker-compose" }
    return $null
}

function Test-DockerRunning {
    try {
        $null = & docker info 2>&1
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Get-ComposeServices {
    param([string]$ComposeCmd)
    try {
        $services = & cmd /c "$ComposeCmd config --services 2>&1"
        if ($LASTEXITCODE -eq 0) {
            return $services | Where-Object { $_ -match '^\w' }
        }
    } catch {}
    return @()
}

function Get-ContainerStatus {
    param([string]$ComposeCmd)
    try {
        $json = & cmd /c "$ComposeCmd ps --format json 2>&1"
        if ($LASTEXITCODE -ne 0) { return @() }
        # docker compose ps --format json outputs one JSON object per line
        $containers = $json | Where-Object { $_ -match '^\{' } | ForEach-Object {
            try { $_ | ConvertFrom-Json } catch { $null }
        } | Where-Object { $_ -ne $null }
        return $containers
    } catch {
        return @()
    }
}

function Test-HttpEndpointWithFallback {
    param(
        [string[]]$Urls,
        [int]$TimeoutSec = 5
    )
    foreach ($url in $Urls) {
        try {
            $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec $TimeoutSec -ErrorAction Stop
            return @{ Success = $true; StatusCode = $response.StatusCode; UsedUrl = $url }
        } catch {
            # Try next URL
        }
    }
    return @{ Success = $false; Error = "All endpoints unreachable"; UsedUrl = $null }
}

function Save-ServiceLogs {
    param(
        [string]$ComposeCmd,
        [string]$ServiceName,
        [string]$OutputPath,
        [int]$Lines = 200
    )
    try {
        if (-not (Test-Path $OutputPath)) {
            New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
        }
        $logFile = Join-Path $OutputPath "logs_$ServiceName.txt"
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

        # Add timestamp header
        "# Log capture for service: $ServiceName" | Out-File -FilePath $logFile -Encoding utf8
        "# Captured at: $timestamp" | Out-File -FilePath $logFile -Encoding utf8 -Append
        "# Lines: $Lines" | Out-File -FilePath $logFile -Encoding utf8 -Append
        "# " + "=" * 60 | Out-File -FilePath $logFile -Encoding utf8 -Append
        "" | Out-File -FilePath $logFile -Encoding utf8 -Append

        $logs = & cmd /c "$ComposeCmd logs --tail=$Lines $ServiceName 2>&1"
        $logs | Out-File -FilePath $logFile -Encoding utf8 -Append
        return $logFile
    } catch {
        return $null
    }
}

# ============================================================================
# Main Health Check Logic
# ============================================================================
function Invoke-HealthCheck {
    $startTime = Get-Date
    $exitCode = 0
    $results = @{
        Tools = @()
        Docker = $null
        Services = @()
        Containers = @()
        Endpoints = @()
        FailedServices = @()
    }

    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host "  UNIT TALK DX-OPS HEALTH CHECK (v2)" -ForegroundColor Cyan
    Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host ""

    # -------------------------------------------------------------------------
    # 1. Check required tools
    # -------------------------------------------------------------------------
    Write-Host "REQUIRED TOOLS" -ForegroundColor White
    Write-Host ("-" * 40)

    foreach ($tool in $Config.RequiredTools) {
        if (Test-CommandExists $tool.Name) {
            $version = switch ($tool.Name) {
                "docker" {
                    try { (& docker --version 2>&1) -replace 'Docker version ', '' } catch { "error" }
                }
                "node" {
                    try { (& node --version 2>&1) } catch { "error" }
                }
                "pnpm" {
                    try {
                        $output = & cmd /c "pnpm --version 2>&1" | Out-String
                        $lines = $output -split "`r?`n"
                        $versionLine = $lines | Where-Object { $_ -match '^\d+\.\d+\.\d+$' } | Select-Object -First 1
                        if ($versionLine) { $versionLine.Trim() } else { "unknown" }
                    } catch { "error" }
                }
                default { "installed" }
            }
            Write-StatusLine -Status "OK" -Name $tool.Name -Details $version
            $results.Tools += @{ Name = $tool.Name; Status = "OK"; Version = $version }
        } else {
            Write-StatusLine -Status "FAIL" -Name $tool.Name -Details "NOT FOUND"
            Write-Host "       Hint: $($tool.InstallHint)" -ForegroundColor DarkGray
            $results.Tools += @{ Name = $tool.Name; Status = "FAIL" }
            $exitCode = 1
        }
    }
    Write-Host ""

    # -------------------------------------------------------------------------
    # 2. Check Docker daemon
    # -------------------------------------------------------------------------
    Write-Host "DOCKER DAEMON" -ForegroundColor White
    Write-Host ("-" * 40)

    if (-not (Test-DockerRunning)) {
        Write-StatusLine -Status "FAIL" -Name "Docker Daemon" -Details "NOT RUNNING"
        Write-Host ""
        Write-Host "  ACTION REQUIRED: Start Docker Desktop" -ForegroundColor Red
        Write-Host "  On Windows: Open Docker Desktop application" -ForegroundColor Yellow
        Write-Host ""
        $results.Docker = "FAIL"
        return 1
    }
    Write-StatusLine -Status "OK" -Name "Docker Daemon" -Details "running"
    $results.Docker = "OK"

    $composeCmd = Get-DockerComposeCommand
    if (-not $composeCmd) {
        Write-StatusLine -Status "FAIL" -Name "Docker Compose" -Details "NOT FOUND"
        return 1
    }
    Write-StatusLine -Status "OK" -Name "Docker Compose" -Details $composeCmd
    Write-Host ""

    # -------------------------------------------------------------------------
    # 3. Discover services dynamically
    # -------------------------------------------------------------------------
    Write-Host "SERVICE DISCOVERY" -ForegroundColor White
    Write-Host ("-" * 40)

    Push-Location (Split-Path $PSScriptRoot -Parent)
    try {
        $discoveredServices = Get-ComposeServices -ComposeCmd $composeCmd
        if ($discoveredServices.Count -eq 0) {
            Write-StatusLine -Status "WARN" -Name "Services" -Details "None discovered (compose not configured?)"
        } else {
            Write-StatusLine -Status "OK" -Name "Services" -Details "$($discoveredServices.Count) services in compose"
            $results.Services = $discoveredServices
        }
        Write-Host ""

        # -------------------------------------------------------------------------
        # 4. Check container status (dynamically matched)
        # -------------------------------------------------------------------------
        Write-Host "CONTAINER STATUS" -ForegroundColor White
        Write-Host ("-" * 40)

        $containers = Get-ContainerStatus -ComposeCmd $composeCmd
        $containerByService = @{}
        foreach ($c in $containers) {
            # Map by Service field (compose service name)
            if ($c.Service) {
                $containerByService[$c.Service] = $c
            }
        }

        foreach ($svcName in $discoveredServices) {
            $svcConfig = $Config.CriticalServiceMap[$svcName]
            $isCritical = if ($svcConfig) { $svcConfig.Critical } else { $false }

            $container = $containerByService[$svcName]
            if (-not $container) {
                $status = "NOT RUNNING"
                $statusCode = if ($isCritical) { "FAIL" } else { "WARN" }
            } else {
                $state = $container.State
                $health = if ($container.Health) { $container.Health } else { "N/A" }

                if ($state -eq "running" -and ($health -eq "healthy" -or $health -eq "N/A")) {
                    $status = "running"
                    if ($health -ne "N/A") { $status += " ($health)" }
                    $statusCode = "OK"
                } elseif ($state -eq "running") {
                    $status = "running ($health)"
                    $statusCode = if ($isCritical) { "WARN" } else { "INFO" }
                } else {
                    $status = $state
                    $statusCode = if ($isCritical) { "FAIL" } else { "WARN" }
                }
            }

            Write-StatusLine -Status $statusCode -Name $svcName -Details $status
            $results.Containers += @{ Name = $svcName; Status = $statusCode; Details = $status }

            if ($statusCode -eq "FAIL") {
                $results.FailedServices += $svcName
                if ($isCritical) { $exitCode = 1 }
            } elseif ($statusCode -eq "WARN" -and $isCritical) {
                $results.FailedServices += $svcName
            }
        }
        Write-Host ""

        # -------------------------------------------------------------------------
        # 5. Check HTTP endpoints with fallback
        # -------------------------------------------------------------------------
        Write-Host "HTTP ENDPOINTS" -ForegroundColor White
        Write-Host ("-" * 40)

        foreach ($ep in $Config.HttpEndpoints) {
            $result = Test-HttpEndpointWithFallback -Urls $ep.Urls -TimeoutSec 5
            if ($result.Success) {
                $details = "HTTP $($result.StatusCode)"
                # Show which URL was used if fallback occurred
                if ($ep.Urls.Count -gt 1) {
                    $urlIndex = [Array]::IndexOf($ep.Urls, $result.UsedUrl)
                    if ($urlIndex -gt 0) {
                        $details += " (fallback)"
                    }
                }
                Write-StatusLine -Status "OK" -Name $ep.Name -Details $details
                $results.Endpoints += @{ Name = $ep.Name; Status = "OK"; UsedUrl = $result.UsedUrl }
            } else {
                $statusCode = if ($ep.Critical) { "FAIL" } else { "WARN" }
                Write-StatusLine -Status $statusCode -Name $ep.Name -Details "UNREACHABLE"
                $results.Endpoints += @{ Name = $ep.Name; Status = $statusCode; Error = $result.Error }
                if ($ep.Critical) { $exitCode = 1 }
            }
        }
        Write-Host ""

        # -------------------------------------------------------------------------
        # 6. Collect logs for failed services
        # -------------------------------------------------------------------------
        if (($exitCode -ne 0 -or $CollectLogs) -and $results.FailedServices.Count -gt 0) {
            Write-Host "COLLECTING LOGS FOR FAILED SERVICES" -ForegroundColor Yellow
            Write-Host ("-" * 40)

            foreach ($svcName in $results.FailedServices) {
                $logFile = Save-ServiceLogs -ComposeCmd $composeCmd -ServiceName $svcName -OutputPath $OutputDir
                if ($logFile) {
                    Write-Host "  Saved: $logFile" -ForegroundColor DarkGray
                }
            }
            Write-Host ""
        }

    } finally {
        Pop-Location
    }

    # -------------------------------------------------------------------------
    # Summary
    # -------------------------------------------------------------------------
    $duration = (Get-Date) - $startTime
    Write-Host ("=" * 60) -ForegroundColor Cyan
    if ($exitCode -eq 0) {
        Write-Host "  HEALTH CHECK PASSED" -ForegroundColor Green
    } else {
        Write-Host "  HEALTH CHECK FAILED" -ForegroundColor Red
    }
    Write-Host "  Duration: $($duration.TotalSeconds.ToString('F1'))s" -ForegroundColor DarkGray
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host ""

    return $exitCode
}

# ============================================================================
# Entry Point
# ============================================================================
try {
    $code = Invoke-HealthCheck
    exit $code
} catch {
    Write-Host "FATAL ERROR: $_" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor DarkRed
    exit 1
}

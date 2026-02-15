#Requires -Version 5.1
<#
.SYNOPSIS
    Unit Talk DX-OPS Restart Script (v2 - Hardened)
.DESCRIPTION
    One-command full restart to avoid half-restarted states.
    Features: Wipe confirmation guard, post-restart validation, log collection.
.PARAMETER Wipe
    DANGEROUS: Stop compose, remove volumes, prune orphaned containers.
    Requires -Confirm WIPE to execute.
.PARAMETER Confirm
    Confirmation string for wipe operation. Must be "WIPE".
.PARAMETER NoWait
    Skip waiting for health check after restart.
.PARAMETER Services
    Comma-separated list of specific services to restart.
.EXAMPLE
    .\tools\restart.ps1
    .\tools\restart.ps1 -Wipe -Confirm WIPE
    .\tools\restart.ps1 -Services "api,smart-form"
    .\tools\restart.ps1 -NoWait
#>

[CmdletBinding()]
param(
    [Alias("w")]
    [switch]$Wipe,

    [string]$Confirm = "",

    [switch]$NoWait,

    [string]$Services = "",

    [string]$OutputDir = "$PSScriptRoot\..\out\dx-ops-pack\$(Get-Date -Format 'yyyy-MM-dd')"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$SCRIPT_DIR = Split-Path $PSScriptRoot -Parent
$PROJECT_ROOT = $SCRIPT_DIR

# ============================================================================
# Helper Functions
# ============================================================================
function Write-Banner {
    param([string]$Text)
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host ""
}

function Write-Section {
    param([string]$Text)
    Write-Host ""
    Write-Host $Text -ForegroundColor White
    Write-Host ("-" * 40)
}

function Write-Step {
    param([string]$Text)
    Write-Host "[>>] $Text" -ForegroundColor Yellow
}

function Write-Ok {
    param([string]$Text)
    Write-Host "[OK] $Text" -ForegroundColor Green
}

function Write-Fail {
    param([string]$Text)
    Write-Host "[XX] $Text" -ForegroundColor Red
}

function Write-Info {
    param([string]$Text)
    Write-Host "[--] $Text" -ForegroundColor Cyan
}

function Write-Warn {
    param([string]$Text)
    Write-Host "[!!] $Text" -ForegroundColor Yellow
}

function Test-CommandExists {
    param([string]$Command)
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

function Get-DockerComposeCommand {
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

function Get-ContainerValidation {
    param([string]$ComposeCmd)
    try {
        $json = & cmd /c "$ComposeCmd ps --format json 2>&1"
        if ($LASTEXITCODE -ne 0) { return @() }
        $containers = $json | Where-Object { $_ -match '^\{' } | ForEach-Object {
            try { $_ | ConvertFrom-Json } catch { $null }
        } | Where-Object { $_ -ne $null }
        return $containers
    } catch {
        return @()
    }
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

        "# Log capture for service: $ServiceName" | Out-File -FilePath $logFile -Encoding utf8
        "# Captured at: $timestamp" | Out-File -FilePath $logFile -Encoding utf8 -Append
        "# Lines: $Lines" | Out-File -FilePath $logFile -Encoding utf8 -Append
        "# " + ("=" * 60) | Out-File -FilePath $logFile -Encoding utf8 -Append
        "" | Out-File -FilePath $logFile -Encoding utf8 -Append

        $logs = & cmd /c "$ComposeCmd logs --tail=$Lines $ServiceName 2>&1"
        $logs | Out-File -FilePath $logFile -Encoding utf8 -Append
        return $logFile
    } catch {
        return $null
    }
}

# ============================================================================
# Main Restart Logic
# ============================================================================
function Invoke-Restart {
    $startTime = Get-Date
    $proofLog = @()

    # Ensure output directory exists
    if (-not (Test-Path $OutputDir)) {
        New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    }

    Write-Banner "UNIT TALK DX-OPS RESTART (v2)"

    $proofLog += "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $proofLog += "Wipe: $Wipe"
    $proofLog += "Confirm: $Confirm"
    $proofLog += "NoWait: $NoWait"
    $proofLog += "Services: $(if ($Services) { $Services } else { 'all' })"
    $proofLog += ""

    # -------------------------------------------------------------------------
    # Check Docker
    # -------------------------------------------------------------------------
    if (-not (Test-DockerRunning)) {
        Write-Fail "Docker is not running. Please start Docker Desktop."
        return 1
    }

    $composeCmd = Get-DockerComposeCommand
    if (-not $composeCmd) {
        Write-Fail "Docker Compose not found"
        return 1
    }
    Write-Info "Using: $composeCmd"
    $proofLog += "Compose command: $composeCmd"

    Push-Location $PROJECT_ROOT
    try {
        # Parse services if provided
        $servicesList = @()
        if ($Services) {
            $servicesList = $Services -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
        }

        # -------------------------------------------------------------------------
        # Wipe Mode (Dangerous) - REQUIRES CONFIRMATION
        # -------------------------------------------------------------------------
        if ($Wipe) {
            Write-Section "WIPE MODE (DANGEROUS)"

            # GUARD: Require --Confirm WIPE
            if ($Confirm -ne "WIPE") {
                Write-Fail "WIPE ABORTED: Missing confirmation"
                Write-Host ""
                Write-Host "  To wipe volumes, you must provide:" -ForegroundColor Yellow
                Write-Host "    .\tools\restart.ps1 -Wipe -Confirm WIPE" -ForegroundColor White
                Write-Host ""
                Write-Host "  Or via pnpm:" -ForegroundColor Yellow
                Write-Host "    pnpm ops:restart -- --wipe --confirm WIPE" -ForegroundColor White
                Write-Host ""
                Write-Warn "This guard exists to prevent accidental data loss."
                $proofLog += "WIPE: ABORTED - missing confirmation"
                $proofLog | Out-File -FilePath (Join-Path $OutputDir "proof_restart.txt") -Encoding utf8
                return 1
            }

            Write-Warn "WIPE CONFIRMED - Proceeding with volume removal"
            $proofLog += "WIPE: Confirmed by user"

            Write-Step "Stopping compose with volumes removal..."
            $output = & cmd /c "$composeCmd down --volumes --remove-orphans 2>&1"
            Write-Host $output -ForegroundColor DarkGray
            $proofLog += "DOWN --volumes --remove-orphans:"
            $proofLog += $output

            Write-Step "Pruning project containers..."
            $pruneOutput = & docker container prune -f --filter "label=com.docker.compose.project=unit-talk-production" 2>&1
            Write-Host $pruneOutput -ForegroundColor DarkGray
            $proofLog += "PRUNE:"
            $proofLog += $pruneOutput

            Write-Ok "Wipe complete"
            $proofLog += "WIPE: Complete"
        } else {
            # -------------------------------------------------------------------------
            # Normal Restart
            # -------------------------------------------------------------------------
            Write-Section "STOPPING SERVICES"

            if ($servicesList.Count -gt 0) {
                Write-Step "Stopping: $($servicesList -join ', ')"
                $output = & cmd /c "$composeCmd stop $($servicesList -join ' ') 2>&1"
            } else {
                Write-Step "Stopping all services..."
                $output = & cmd /c "$composeCmd down 2>&1"
            }
            Write-Host $output -ForegroundColor DarkGray
            $proofLog += "DOWN:"
            $proofLog += $output
            Write-Ok "Services stopped"
        }

        # -------------------------------------------------------------------------
        # Start Services
        # -------------------------------------------------------------------------
        Write-Section "STARTING SERVICES"

        if ($servicesList.Count -gt 0) {
            Write-Step "Starting: $($servicesList -join ', ')"
            $output = & cmd /c "$composeCmd up -d $($servicesList -join ' ') 2>&1"
        } else {
            Write-Step "Starting all services..."
            $output = & cmd /c "$composeCmd up -d 2>&1"
        }
        Write-Host $output -ForegroundColor DarkGray
        $proofLog += "UP:"
        $proofLog += $output
        Write-Ok "Services started"

        # -------------------------------------------------------------------------
        # Post-Restart Validation
        # -------------------------------------------------------------------------
        if (-not $NoWait) {
            Write-Section "POST-RESTART VALIDATION"
            Write-Info "Waiting for services to become healthy..."

            # Give services a moment to start
            $waitSeconds = 10
            for ($i = $waitSeconds; $i -gt 0; $i--) {
                Write-Host "`r  Stabilization countdown: ${i}s " -NoNewline -ForegroundColor DarkGray
                Start-Sleep -Seconds 1
            }
            Write-Host ""

            $healthScript = "$PSScriptRoot\health.ps1"
            $maxAttempts = 20
            $retryInterval = 10
            $healthy = $false
            $unhealthyServices = @()

            for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
                Write-Info "Health check attempt $attempt/$maxAttempts..."

                try {
                    & $healthScript -ErrorAction SilentlyContinue
                    if ($LASTEXITCODE -eq 0) {
                        $healthy = $true
                        break
                    }
                } catch {
                    # Continue
                }

                if ($attempt -lt $maxAttempts) {
                    Write-Info "Waiting ${retryInterval}s..."
                    Start-Sleep -Seconds $retryInterval
                }
            }

            if ($healthy) {
                Write-Ok "All services healthy"
                $proofLog += "VALIDATION: Passed"
            } else {
                Write-Warn "Some services may not be fully healthy"
                $proofLog += "VALIDATION: Warning - not all services healthy"

                # Collect logs for unhealthy services
                Write-Section "COLLECTING LOGS FOR UNHEALTHY SERVICES"
                $containers = Get-ContainerValidation -ComposeCmd $composeCmd
                foreach ($c in $containers) {
                    if ($c.Health -and $c.Health -ne "healthy") {
                        $logFile = Save-ServiceLogs -ComposeCmd $composeCmd -ServiceName $c.Service -OutputPath $OutputDir
                        if ($logFile) {
                            Write-Host "  Saved: $logFile" -ForegroundColor DarkGray
                        }
                        $unhealthyServices += $c.Service
                    }
                }

                if ($unhealthyServices.Count -gt 0) {
                    $proofLog += "UNHEALTHY SERVICES: $($unhealthyServices -join ', ')"
                }
            }
        } else {
            Write-Info "Skipping health check (--NoWait)"
            $proofLog += "VALIDATION: Skipped"
        }

        # -------------------------------------------------------------------------
        # Final Status with Validation
        # -------------------------------------------------------------------------
        Write-Section "FINAL STATUS"

        $psOutput = & cmd /c "$composeCmd ps 2>&1" | Out-String
        Write-Host $psOutput -ForegroundColor DarkGray
        $proofLog += "FINAL STATUS:"
        $proofLog += $psOutput

        # Validate container states
        $containers = Get-ContainerValidation -ComposeCmd $composeCmd
        $allHealthy = $true
        $exitCode = 0

        foreach ($c in $containers) {
            $state = $c.State
            $health = if ($c.Health) { $c.Health } else { "N/A" }

            if ($state -ne "running") {
                $allHealthy = $false
            } elseif ($health -ne "healthy" -and $health -ne "N/A") {
                # Service is running but not healthy yet
                $allHealthy = $false
            }
        }

        if (-not $allHealthy -and -not $NoWait) {
            $exitCode = 1
        }

        # -------------------------------------------------------------------------
        # Summary
        # -------------------------------------------------------------------------
        $duration = (Get-Date) - $startTime
        $proofLog += ""
        $proofLog += "RESTART COMPLETED"
        $proofLog += "Duration: $($duration.TotalSeconds.ToString('F1'))s"
        $proofLog += "Exit Code: $exitCode"

        Write-Banner "RESTART COMPLETE"
        if ($exitCode -eq 0) {
            Write-Ok "Restart finished in $($duration.TotalSeconds.ToString('F1'))s"
        } else {
            Write-Warn "Restart finished with warnings in $($duration.TotalSeconds.ToString('F1'))s"
        }

        $proofLog | Out-File -FilePath (Join-Path $OutputDir "proof_restart.txt") -Encoding utf8
        Write-Info "Proof saved: $(Join-Path $OutputDir 'proof_restart.txt')"

        return $exitCode

    } finally {
        Pop-Location
    }
}

# ============================================================================
# Entry Point
# ============================================================================
try {
    $code = Invoke-Restart
    exit $code
} catch {
    Write-Host "FATAL ERROR: $_" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor DarkRed
    exit 1
}

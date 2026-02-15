#Requires -Version 5.1
<#
.SYNOPSIS
    Unit Talk DX-OPS Bootstrap Script
.DESCRIPTION
    Fresh machine bootstrap and deterministic bring-up for the Unit Talk platform.
    Installs dependencies, starts containers, and waits for health.
.EXAMPLE
    .\tools\bootstrap.ps1
    .\tools\bootstrap.ps1 -SkipInstall
#>

[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [int]$HealthTimeoutMinutes = 8,
    [int]$HealthRetryIntervalSec = 15,
    [string]$OutputDir = "$PSScriptRoot\..\out\dx-ops-pack\$(Get-Date -Format 'yyyy-MM-dd')"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$SCRIPT_DIR = Split-Path $PSScriptRoot -Parent
$PROJECT_ROOT = $SCRIPT_DIR

# ============================================================================
# Configuration
# ============================================================================
$Config = @{
    RequiredTools = @(
        @{ Name = "docker"; InstallHint = "Install Docker Desktop from https://docker.com/products/docker-desktop"; Version = "docker --version" }
        @{ Name = "node"; InstallHint = "Install Node.js LTS from https://nodejs.org"; Version = "node --version" }
        @{ Name = "pnpm"; InstallHint = "Run: npm install -g pnpm"; Version = "pnpm --version" }
    )
    HealthScript = "$PSScriptRoot\health.ps1"
}

# ============================================================================
# Helper Functions
# ============================================================================
function Write-Banner {
    param([string]$Text)
    Write-Host ""
    Write-Host "=" * 60 -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host "=" * 60 -ForegroundColor Cyan
    Write-Host ""
}

function Write-Section {
    param([string]$Text)
    Write-Host ""
    Write-Host $Text -ForegroundColor White
    Write-Host "-" * 40
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

function Test-CommandExists {
    param([string]$Command)
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

function Get-DockerComposeCommand {
    if (Test-CommandExists "docker") {
        $result = & docker compose version 2>&1
        if ($LASTEXITCODE -eq 0) { return "docker compose" }
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

function Invoke-HealthCheckWithRetry {
    param(
        [int]$TimeoutMinutes,
        [int]$RetryIntervalSec
    )

    $startTime = Get-Date
    $deadline = $startTime.AddMinutes($TimeoutMinutes)
    $attempt = 0

    while ((Get-Date) -lt $deadline) {
        $attempt++
        Write-Info "Health check attempt $attempt..."

        try {
            & $Config.HealthScript -ErrorAction SilentlyContinue
            if ($LASTEXITCODE -eq 0) {
                return $true
            }
        } catch {
            # Continue retrying
        }

        $remaining = [math]::Round(($deadline - (Get-Date)).TotalSeconds)
        if ($remaining -gt 0) {
            Write-Info "Waiting ${RetryIntervalSec}s before retry... (${remaining}s remaining)"
            Start-Sleep -Seconds $RetryIntervalSec
        }
    }

    return $false
}

# ============================================================================
# Main Bootstrap Logic
# ============================================================================
function Invoke-Bootstrap {
    $startTime = Get-Date
    $proofLog = @()

    # Ensure output directory exists
    if (-not (Test-Path $OutputDir)) {
        New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    }

    Write-Banner "UNIT TALK DX-OPS BOOTSTRAP"

    # -------------------------------------------------------------------------
    # 1. Environment Info
    # -------------------------------------------------------------------------
    Write-Section "ENVIRONMENT INFO"

    $platform = if ($PSVersionTable.ContainsKey("Platform")) { $PSVersionTable.Platform } else { "Win32NT" }
    $envInfo = @(
        "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        "OS: $([System.Environment]::OSVersion.VersionString)"
        "Platform: $platform"
        "PowerShell: $($PSVersionTable.PSVersion)"
        "Project Root: $PROJECT_ROOT"
    )
    $envInfo | ForEach-Object {
        Write-Host "  $_" -ForegroundColor DarkGray
        $proofLog += $_
    }
    $proofLog += ""

    # -------------------------------------------------------------------------
    # 2. Validate Required Tools
    # -------------------------------------------------------------------------
    Write-Section "VALIDATING REQUIRED TOOLS"

    $toolsOk = $true
    foreach ($tool in $Config.RequiredTools) {
        if (Test-CommandExists $tool.Name) {
            $version = & cmd /c "$($tool.Version) 2>&1"
            Write-Ok "$($tool.Name): $version"
            $proofLog += "TOOL OK: $($tool.Name) = $version"
        } else {
            Write-Fail "$($tool.Name): NOT FOUND"
            Write-Host "    Hint: $($tool.InstallHint)" -ForegroundColor Yellow
            $proofLog += "TOOL MISSING: $($tool.Name)"
            $toolsOk = $false
        }
    }

    if (-not $toolsOk) {
        Write-Fail "Missing required tools. Please install them and retry."
        $proofLog += "BOOTSTRAP FAILED: Missing required tools"
        $proofLog | Out-File -FilePath (Join-Path $OutputDir "proof_bootstrap_windows.txt") -Encoding utf8
        return 1
    }
    $proofLog += ""

    # -------------------------------------------------------------------------
    # 3. Check Docker
    # -------------------------------------------------------------------------
    Write-Section "CHECKING DOCKER"

    if (-not (Test-DockerRunning)) {
        Write-Fail "Docker is not running. Please start Docker Desktop."
        $proofLog += "DOCKER: NOT RUNNING"
        $proofLog | Out-File -FilePath (Join-Path $OutputDir "proof_bootstrap_windows.txt") -Encoding utf8
        return 1
    }
    Write-Ok "Docker daemon is running"
    $proofLog += "DOCKER: Running"

    $composeCmd = Get-DockerComposeCommand
    if (-not $composeCmd) {
        Write-Fail "Docker Compose not found"
        $proofLog += "COMPOSE: NOT FOUND"
        $proofLog | Out-File -FilePath (Join-Path $OutputDir "proof_bootstrap_windows.txt") -Encoding utf8
        return 1
    }
    Write-Ok "Docker Compose: $composeCmd"
    $proofLog += "COMPOSE: $composeCmd"
    $proofLog += ""

    # -------------------------------------------------------------------------
    # 4. Install Dependencies
    # -------------------------------------------------------------------------
    Push-Location $PROJECT_ROOT
    try {
        if (-not $SkipInstall) {
            Write-Section "INSTALLING DEPENDENCIES"
            Write-Step "Running: pnpm install"

            $installOutput = & pnpm install 2>&1 | Out-String
            if ($LASTEXITCODE -ne 0) {
                Write-Fail "pnpm install failed"
                $proofLog += "PNPM INSTALL: FAILED"
                $proofLog += $installOutput
                $proofLog | Out-File -FilePath (Join-Path $OutputDir "proof_bootstrap_windows.txt") -Encoding utf8
                return 1
            }
            Write-Ok "Dependencies installed"
            $proofLog += "PNPM INSTALL: OK"
        } else {
            Write-Info "Skipping pnpm install (--SkipInstall)"
            $proofLog += "PNPM INSTALL: Skipped"
        }
        $proofLog += ""

        # -------------------------------------------------------------------------
        # 5. Start Containers
        # -------------------------------------------------------------------------
        Write-Section "STARTING CONTAINERS"
        Write-Step "Running: $composeCmd up -d"

        $composeOutput = & cmd /c "$composeCmd up -d 2>&1"
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "docker compose up failed"
            $proofLog += "COMPOSE UP: FAILED"
            $proofLog += $composeOutput
            $proofLog | Out-File -FilePath (Join-Path $OutputDir "proof_bootstrap_windows.txt") -Encoding utf8
            return 1
        }
        Write-Ok "Containers started"
        $proofLog += "COMPOSE UP: OK"
        $proofLog += $composeOutput
        $proofLog += ""

        # -------------------------------------------------------------------------
        # 6. Wait for Health
        # -------------------------------------------------------------------------
        Write-Section "WAITING FOR HEALTH"
        Write-Info "Timeout: $HealthTimeoutMinutes minutes, retry interval: ${HealthRetryIntervalSec}s"

        $healthy = Invoke-HealthCheckWithRetry -TimeoutMinutes $HealthTimeoutMinutes -RetryIntervalSec $HealthRetryIntervalSec

        if (-not $healthy) {
            Write-Fail "Health check failed after $HealthTimeoutMinutes minutes"
            $proofLog += "HEALTH: FAILED after timeout"
            $proofLog | Out-File -FilePath (Join-Path $OutputDir "proof_bootstrap_windows.txt") -Encoding utf8
            return 1
        }
        Write-Ok "All services healthy"
        $proofLog += "HEALTH: PASSED"
        $proofLog += ""

        # -------------------------------------------------------------------------
        # 7. Basic Proof
        # -------------------------------------------------------------------------
        Write-Section "BASIC PROOF"

        Write-Step "Container status:"
        $psOutput = & cmd /c "$composeCmd ps 2>&1" | Out-String
        Write-Host $psOutput -ForegroundColor DarkGray
        $proofLog += "CONTAINER STATUS:"
        $proofLog += $psOutput

        # Save container status to separate file
        $psOutput | Out-File -FilePath (Join-Path $OutputDir "proof_container_status.txt") -Encoding utf8

        # -------------------------------------------------------------------------
        # Summary
        # -------------------------------------------------------------------------
        $duration = (Get-Date) - $startTime
        $proofLog += ""
        $proofLog += "BOOTSTRAP COMPLETED"
        $proofLog += "Duration: $($duration.TotalSeconds.ToString('F1'))s"

        Write-Banner "BOOTSTRAP COMPLETE"
        Write-Ok "Unit Talk platform is ready!"
        Write-Info "Duration: $($duration.TotalSeconds.ToString('F1'))s"
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor White
        Write-Host "  - Open Command Center: http://localhost:3004" -ForegroundColor DarkGray
        Write-Host "  - Open Smart Form: http://localhost:3002" -ForegroundColor DarkGray
        Write-Host "  - Run health check: pnpm ops:health" -ForegroundColor DarkGray
        Write-Host ""

        $proofLog | Out-File -FilePath (Join-Path $OutputDir "proof_bootstrap_windows.txt") -Encoding utf8
        Write-Info "Proof saved: $(Join-Path $OutputDir 'proof_bootstrap_windows.txt')"

        return 0

    } finally {
        Pop-Location
    }
}

# ============================================================================
# Entry Point
# ============================================================================
try {
    $code = Invoke-Bootstrap
    exit $code
} catch {
    Write-Host "FATAL ERROR: $_" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor DarkRed
    exit 1
}

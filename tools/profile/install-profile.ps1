#Requires -Version 5.1
<#
.SYNOPSIS
    Unit Talk Profile Installer
.DESCRIPTION
    Optionally installs PowerShell aliases and functions for Unit Talk development.
    By default, prints what would be installed without modifying your profile.
.PARAMETER Apply
    Actually install the aliases to your PowerShell profile.
.PARAMETER Uninstall
    Remove previously installed Unit Talk aliases from your profile.
.EXAMPLE
    .\install-profile.ps1          # Preview what would be installed
    .\install-profile.ps1 -Apply   # Install the aliases
    .\install-profile.ps1 -Uninstall  # Remove the aliases
#>

[CmdletBinding()]
param(
    [switch]$Apply,
    [switch]$Uninstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ============================================================================
# Configuration
# ============================================================================
$MARKER_START = "# >>> UNIT-TALK-DX-OPS-PROFILE >>>"
$MARKER_END = "# <<< UNIT-TALK-DX-OPS-PROFILE <<<"

# Get the project root (two levels up from this script)
$PROJECT_ROOT = (Get-Item $PSScriptRoot).Parent.Parent.FullName

# The profile content to install
$PROFILE_BLOCK = @"
$MARKER_START
# Unit Talk DX-OPS Aliases
# Installed: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
# Project: $PROJECT_ROOT

# Navigate to project
function ut-cd { Set-Location "$PROJECT_ROOT" }

# Docker Compose shortcuts
function ut-up {
    Push-Location "$PROJECT_ROOT"
    docker compose up -d
    Pop-Location
}

function ut-down {
    Push-Location "$PROJECT_ROOT"
    docker compose down
    Pop-Location
}

function ut-logs {
    param([string]`$Service = "")
    Push-Location "$PROJECT_ROOT"
    if (`$Service) {
        docker compose logs -f `$Service
    } else {
        docker compose logs -f
    }
    Pop-Location
}

function ut-ps {
    Push-Location "$PROJECT_ROOT"
    docker compose ps
    Pop-Location
}

# DX-OPS commands
function ut-health {
    Push-Location "$PROJECT_ROOT"
    pnpm ops:health
    Pop-Location
}

function ut-bootstrap {
    Push-Location "$PROJECT_ROOT"
    pnpm ops:bootstrap
    Pop-Location
}

function ut-restart {
    param([switch]`$Wipe, [switch]`$NoWait)
    Push-Location "$PROJECT_ROOT"
    `$args = @()
    if (`$Wipe) { `$args += "--wipe" }
    if (`$NoWait) { `$args += "--no-wait" }
    if (`$args.Count -gt 0) {
        pnpm ops:restart -- `$args
    } else {
        pnpm ops:restart
    }
    Pop-Location
}

function ut-proof {
    param([string]`$Script = "")
    `$proofDir = "$PROJECT_ROOT\out\dx-ops-pack\`$(Get-Date -Format 'yyyy-MM-dd')"
    if (`$Script) {
        `$proofFile = Join-Path `$proofDir "proof_`$Script.txt"
        if (Test-Path `$proofFile) {
            Get-Content `$proofFile
        } else {
            Write-Host "Proof file not found: `$proofFile" -ForegroundColor Yellow
            Write-Host "Available proof files:" -ForegroundColor Cyan
            Get-ChildItem `$proofDir -Filter "proof_*.txt" | ForEach-Object { Write-Host "  - `$(`$_.BaseName -replace '^proof_','')" }
        }
    } else {
        Write-Host "Available proof files:" -ForegroundColor Cyan
        if (Test-Path `$proofDir) {
            Get-ChildItem `$proofDir -Filter "proof_*.txt" | ForEach-Object { Write-Host "  - `$(`$_.BaseName -replace '^proof_','')" }
        } else {
            Write-Host "  (no proof files found for today)" -ForegroundColor DarkGray
        }
    }
}

# Alias shortcuts
Set-Alias -Name utup -Value ut-up
Set-Alias -Name utdown -Value ut-down
Set-Alias -Name utlogs -Value ut-logs
Set-Alias -Name uthealth -Value ut-health

Write-Host "[Unit Talk] DX-OPS aliases loaded. Type 'ut-' and press Tab to see available commands." -ForegroundColor DarkCyan
$MARKER_END
"@

# ============================================================================
# Helper Functions
# ============================================================================
function Get-ProfilePath {
    # Use CurrentUserCurrentHost profile
    return $PROFILE
}

function Test-ProfileHasBlock {
    param([string]$ProfilePath)
    if (-not (Test-Path $ProfilePath)) { return $false }
    $content = Get-Content $ProfilePath -Raw
    return $content -match [regex]::Escape($MARKER_START)
}

function Remove-ProfileBlock {
    param([string]$ProfilePath)
    if (-not (Test-Path $ProfilePath)) { return }

    $content = Get-Content $ProfilePath -Raw
    $pattern = [regex]::Escape($MARKER_START) + "[\s\S]*?" + [regex]::Escape($MARKER_END)
    $newContent = $content -replace $pattern, ""
    # Clean up extra blank lines
    $newContent = $newContent -replace "(\r?\n){3,}", "`n`n"
    $newContent = $newContent.Trim()

    if ($newContent) {
        Set-Content -Path $ProfilePath -Value $newContent -Encoding utf8
    } else {
        # If profile is now empty, optionally delete it
        Remove-Item $ProfilePath -Force
    }
}

function Add-ProfileBlock {
    param([string]$ProfilePath)

    # Ensure profile directory exists
    $profileDir = Split-Path $ProfilePath -Parent
    if (-not (Test-Path $profileDir)) {
        New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
    }

    # Remove existing block if present (idempotent)
    if (Test-ProfileHasBlock -ProfilePath $ProfilePath) {
        Remove-ProfileBlock -ProfilePath $ProfilePath
    }

    # Append new block
    if (Test-Path $ProfilePath) {
        $existing = Get-Content $ProfilePath -Raw
        $newContent = $existing.TrimEnd() + "`n`n" + $PROFILE_BLOCK
    } else {
        $newContent = $PROFILE_BLOCK
    }

    Set-Content -Path $ProfilePath -Value $newContent -Encoding utf8
}

# ============================================================================
# Main Logic
# ============================================================================
function Main {
    $profilePath = Get-ProfilePath

    Write-Host ""
    Write-Host "=" * 60 -ForegroundColor Cyan
    Write-Host "  UNIT TALK PROFILE INSTALLER" -ForegroundColor Cyan
    Write-Host "=" * 60 -ForegroundColor Cyan
    Write-Host ""
    Write-Host "PowerShell Profile: $profilePath" -ForegroundColor DarkGray
    Write-Host "Project Root: $PROJECT_ROOT" -ForegroundColor DarkGray
    Write-Host ""

    # -------------------------------------------------------------------------
    # Uninstall
    # -------------------------------------------------------------------------
    if ($Uninstall) {
        if (Test-ProfileHasBlock -ProfilePath $profilePath) {
            Remove-ProfileBlock -ProfilePath $profilePath
            Write-Host "[OK] Unit Talk aliases removed from profile." -ForegroundColor Green
            Write-Host ""
            Write-Host "Restart PowerShell or run:" -ForegroundColor Yellow
            Write-Host "  . `$PROFILE" -ForegroundColor White
            Write-Host ""
        } else {
            Write-Host "[--] No Unit Talk aliases found in profile." -ForegroundColor Cyan
        }
        return
    }

    # -------------------------------------------------------------------------
    # Preview (default)
    # -------------------------------------------------------------------------
    if (-not $Apply) {
        Write-Host "PREVIEW MODE - No changes will be made" -ForegroundColor Yellow
        Write-Host "-" * 40
        Write-Host ""

        if (Test-ProfileHasBlock -ProfilePath $profilePath) {
            Write-Host "[!!] Unit Talk aliases are ALREADY installed." -ForegroundColor Yellow
            Write-Host "     Running with -Apply will update them." -ForegroundColor DarkGray
        } else {
            Write-Host "[--] Unit Talk aliases are NOT installed." -ForegroundColor Cyan
        }

        Write-Host ""
        Write-Host "The following aliases/functions would be added:" -ForegroundColor White
        Write-Host "-" * 40
        Write-Host ""
        Write-Host "  ut-cd        - Navigate to project root" -ForegroundColor DarkGray
        Write-Host "  ut-up        - docker compose up -d" -ForegroundColor DarkGray
        Write-Host "  ut-down      - docker compose down" -ForegroundColor DarkGray
        Write-Host "  ut-logs [svc]- docker compose logs -f [service]" -ForegroundColor DarkGray
        Write-Host "  ut-ps        - docker compose ps" -ForegroundColor DarkGray
        Write-Host "  ut-health    - pnpm ops:health" -ForegroundColor DarkGray
        Write-Host "  ut-bootstrap - pnpm ops:bootstrap" -ForegroundColor DarkGray
        Write-Host "  ut-restart   - pnpm ops:restart [-Wipe] [-NoWait]" -ForegroundColor DarkGray
        Write-Host "  ut-proof [n] - View proof files" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host "To install, run:" -ForegroundColor Yellow
        Write-Host "  .\tools\profile\install-profile.ps1 -Apply" -ForegroundColor White
        Write-Host ""
        Write-Host "To uninstall later:" -ForegroundColor Yellow
        Write-Host "  .\tools\profile\install-profile.ps1 -Uninstall" -ForegroundColor White
        Write-Host ""
        return
    }

    # -------------------------------------------------------------------------
    # Apply
    # -------------------------------------------------------------------------
    Add-ProfileBlock -ProfilePath $profilePath

    Write-Host "[OK] Unit Talk aliases installed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "To activate immediately, run:" -ForegroundColor Yellow
    Write-Host "  . `$PROFILE" -ForegroundColor White
    Write-Host ""
    Write-Host "Or restart PowerShell." -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "Available commands after activation:" -ForegroundColor White
    Write-Host "  ut-cd, ut-up, ut-down, ut-logs, ut-ps" -ForegroundColor DarkGray
    Write-Host "  ut-health, ut-bootstrap, ut-restart, ut-proof" -ForegroundColor DarkGray
    Write-Host ""
}

# ============================================================================
# Entry Point
# ============================================================================
try {
    Main
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    exit 1
}

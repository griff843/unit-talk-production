# ==============================================================================
# QUARANTINE ARTIFACTS - Move untracked files to quarantine
# ==============================================================================
# Purpose: Clean up repository by moving all untracked files to timestamped
#          quarantine directory while preserving folder structure
# Usage: .\scripts\ops\quarantine-artifacts.ps1 [-DryRun] [-Verbose]
# ==============================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [switch]$DryRun = $false,

    [Parameter(Mandatory=$false)]
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Stop"

# ==============================================================================
# Configuration
# ==============================================================================

$REPO_ROOT = Split-Path (Split-Path (Split-Path $PSScriptRoot))
$TIMESTAMP = Get-Date -Format "yyyyMMdd-HHmmss"
$QUARANTINE_DIR = Join-Path $REPO_ROOT "out\_quarantine\$TIMESTAMP"

# Colors for output
$COLOR_SUCCESS = "Green"
$COLOR_WARNING = "Yellow"
$COLOR_ERROR = "Red"
$COLOR_INFO = "Cyan"

# ==============================================================================
# Functions
# ==============================================================================

function Write-StatusMessage {
    param(
        [string]$Message,
        [string]$Type = "INFO"
    )

    $color = switch ($Type) {
        "SUCCESS" { $COLOR_SUCCESS }
        "WARNING" { $COLOR_WARNING }
        "ERROR"   { $COLOR_ERROR }
        default   { $COLOR_INFO }
    }

    $prefix = switch ($Type) {
        "SUCCESS" { "✅" }
        "WARNING" { "⚠️ " }
        "ERROR"   { "❌" }
        default   { "ℹ️ " }
    }

    Write-Host "$prefix $Message" -ForegroundColor $color
}

function Get-UntrackedFiles {
    Write-StatusMessage "Scanning for untracked files..." "INFO"

    Push-Location $REPO_ROOT
    try {
        $gitStatus = git status --short --porcelain | Where-Object { $_ -match '^\?\?' }

        if (-not $gitStatus) {
            return @()
        }

        $untrackedFiles = $gitStatus | ForEach-Object {
            # Remove the '?? ' prefix
            $_.Substring(3).Trim()
        }

        return $untrackedFiles
    }
    finally {
        Pop-Location
    }
}

function Test-ShouldQuarantine {
    param([string]$FilePath)

    # Files/directories that should NEVER be quarantined
    $WHITELIST = @(
        '.git',
        '.github',
        'node_modules',
        '.env.example',
        '.env.template',
        'README.md',
        'LICENSE',
        'package.json',
        'package-lock.json',
        'tsconfig.json'
    )

    # Check if file is whitelisted
    foreach ($item in $WHITELIST) {
        if ($FilePath -eq $item -or $FilePath.StartsWith("$item\") -or $FilePath.StartsWith("$item/")) {
            return $false
        }
    }

    # Always quarantine these patterns
    $QUARANTINE_PATTERNS = @(
        '*.md',      # Except specific docs
        '*.txt',
        '*.log',
        '*.sql',
        '*.ps1',
        '*.py',
        '*.json',
        'PHASE*',
        '*_SUMMARY.*',
        '*_PROOF_BUNDLE.*',
        '*_REPORT.*',
        'smoke-pack*',
        'canary_e2e*',
        'analytics\*',
        'out\*',
        'artifacts\*',
        'infra\*',
        'monitoring\*'
    )

    foreach ($pattern in $QUARANTINE_PATTERNS) {
        if ($FilePath -like $pattern) {
            # Special case: Don't quarantine intentional docs
            if ($FilePath -match '^docs\\[^\\]+\.md$' -and
                $FilePath -notmatch 'PHASE|PROOF|SUMMARY|REPORT|APPLY|EXECUTE') {
                return $false
            }
            return $true
        }
    }

    return $true
}

function Move-ToQuarantine {
    param(
        [string]$SourcePath,
        [string]$QuarantineRoot
    )

    $sourceFull = Join-Path $REPO_ROOT $SourcePath
    $destPath = Join-Path $QuarantineRoot $SourcePath

    if (-not (Test-Path $sourceFull)) {
        Write-StatusMessage "Source does not exist: $SourcePath" "WARNING"
        return $false
    }

    try {
        # Create destination directory
        $destDir = Split-Path $destPath -Parent
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }

        if ($DryRun) {
            Write-StatusMessage "[DRY RUN] Would move: $SourcePath -> out\_quarantine\$TIMESTAMP\$SourcePath" "INFO"
        }
        else {
            Move-Item -Path $sourceFull -Destination $destPath -Force
            if ($Verbose) {
                Write-StatusMessage "Moved: $SourcePath" "SUCCESS"
            }
        }

        return $true
    }
    catch {
        Write-StatusMessage "Failed to move $SourcePath : $_" "ERROR"
        return $false
    }
}

# ==============================================================================
# Main Execution
# ==============================================================================

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ARTIFACT QUARANTINE - Repository Cleanup" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-StatusMessage "Running in DRY RUN mode - no files will be moved" "WARNING"
    Write-Host ""
}

# Get untracked files
$untrackedFiles = Get-UntrackedFiles

if ($untrackedFiles.Count -eq 0) {
    Write-StatusMessage "No untracked files found. Repository is clean!" "SUCCESS"
    Write-Host ""
    exit 0
}

Write-StatusMessage "Found $($untrackedFiles.Count) untracked files/directories" "INFO"
Write-Host ""

# Filter files that should be quarantined
$filesToQuarantine = $untrackedFiles | Where-Object { Test-ShouldQuarantine $_ }

if ($filesToQuarantine.Count -eq 0) {
    Write-StatusMessage "No files need to be quarantined" "SUCCESS"
    Write-Host ""
    exit 0
}

Write-StatusMessage "Files to quarantine: $($filesToQuarantine.Count)" "WARNING"
Write-Host ""

if ($Verbose -or $DryRun) {
    Write-Host "Files to be quarantined:" -ForegroundColor Yellow
    $filesToQuarantine | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }
    Write-Host ""
}

# Confirm if not dry run
if (-not $DryRun) {
    Write-Host "Quarantine directory: $QUARANTINE_DIR" -ForegroundColor Cyan
    Write-Host ""

    $confirmation = Read-Host "Proceed with quarantine? (yes/no)"
    if ($confirmation -ne "yes" -and $confirmation -ne "y") {
        Write-StatusMessage "Operation cancelled by user" "WARNING"
        exit 0
    }
    Write-Host ""
}

# Create quarantine directory
if (-not $DryRun) {
    if (-not (Test-Path $QUARANTINE_DIR)) {
        New-Item -ItemType Directory -Path $QUARANTINE_DIR -Force | Out-Null
        Write-StatusMessage "Created quarantine directory: out\_quarantine\$TIMESTAMP" "SUCCESS"
    }
}

# Move files to quarantine
$successCount = 0
$failCount = 0

foreach ($file in $filesToQuarantine) {
    if (Move-ToQuarantine -SourcePath $file -QuarantineRoot $QUARANTINE_DIR) {
        $successCount++
    }
    else {
        $failCount++
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  QUARANTINE SUMMARY" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-StatusMessage "DRY RUN COMPLETE - No files were actually moved" "INFO"
    Write-StatusMessage "Would have quarantined: $successCount files" "INFO"
}
else {
    Write-StatusMessage "Successfully quarantined: $successCount files" "SUCCESS"
    if ($failCount -gt 0) {
        Write-StatusMessage "Failed to quarantine: $failCount files" "ERROR"
    }
    Write-Host ""
    Write-StatusMessage "Quarantine location: out\_quarantine\$TIMESTAMP" "INFO"
}

Write-Host ""

# Verify git status is now clean
if (-not $DryRun) {
    Write-StatusMessage "Verifying repository is now clean..." "INFO"

    $remainingUntracked = Get-UntrackedFiles
    $remainingToQuarantine = $remainingUntracked | Where-Object { Test-ShouldQuarantine $_ }

    if ($remainingToQuarantine.Count -eq 0) {
        Write-StatusMessage "✓ Repository is now clean!" "SUCCESS"
    }
    else {
        Write-StatusMessage "⚠ Still have $($remainingToQuarantine.Count) untracked files" "WARNING"
        if ($Verbose) {
            $remainingToQuarantine | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }
        }
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Create summary file in quarantine
if (-not $DryRun -and $successCount -gt 0) {
    $summaryFile = Join-Path $QUARANTINE_DIR "_QUARANTINE_SUMMARY.txt"
    $summaryContent = @"
QUARANTINE SUMMARY
==================

Timestamp: $TIMESTAMP
Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Files quarantined: $successCount
Failed: $failCount

Files moved to quarantine:
--------------------------
$($filesToQuarantine -join "`n")

Quarantine location:
-------------------
$QUARANTINE_DIR

To restore files:
-----------------
cd "$QUARANTINE_DIR"
# Review files and move back to repo root if needed

To permanently delete:
----------------------
Remove-Item -Recurse -Force "$QUARANTINE_DIR"

"@

    Set-Content -Path $summaryFile -Value $summaryContent
    Write-StatusMessage "Summary saved to: out\_quarantine\$TIMESTAMP\_QUARANTINE_SUMMARY.txt" "INFO"
    Write-Host ""
}

if ($DryRun) {
    Write-Host "To execute for real, run:" -ForegroundColor Yellow
    Write-Host "  .\scripts\ops\quarantine-artifacts.ps1" -ForegroundColor White
    Write-Host ""
}

exit 0

# ============================================================================
# Install Nightly Validation Task (Windows Task Scheduler)
# ============================================================================
# Creates a scheduled task to run nightly validation at 03:00 UTC
# Date: 2025-10-30
# ============================================================================

#Requires -RunAsAdministrator

param(
    [switch]$Uninstall = $false
)

$ErrorActionPreference = "Stop"

$taskName = "UnitTalk-NightlyValidation"
$workspaceRoot = "C:\Users\griff\OneDrive\Desktop\unit-talk-production-main"
$scriptPath = Join-Path $workspaceRoot "scripts\ops\nightly-validation-runner.ps1"

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "NIGHTLY VALIDATION TASK INSTALLER" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

if ($Uninstall) {
    Write-Host "Uninstalling nightly validation task..." -ForegroundColor Yellow
    
    try {
        $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        
        if ($existingTask) {
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
            Write-Host "✅ Task '$taskName' uninstalled successfully" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Task '$taskName' not found" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Failed to uninstall task: $_" -ForegroundColor Red
        exit 1
    }
    
    exit 0
}

# Verify script exists
if (-not (Test-Path $scriptPath)) {
    Write-Host "❌ Script not found: $scriptPath" -ForegroundColor Red
    exit 1
}

Write-Host "Script: $scriptPath" -ForegroundColor White
Write-Host "Task Name: $taskName" -ForegroundColor White
Write-Host "Schedule: Daily at 03:00 UTC" -ForegroundColor White
Write-Host ""

# Check if task already exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "⚠️  Task '$taskName' already exists" -ForegroundColor Yellow
    $response = Read-Host "Do you want to replace it? (y/n)"
    
    if ($response -ne 'y') {
        Write-Host "Installation cancelled" -ForegroundColor Yellow
        exit 0
    }
    
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "✅ Existing task removed" -ForegroundColor Green
}

# Calculate UTC offset for local time
$utcNow = (Get-Date).ToUniversalTime()
$localNow = Get-Date
$utcOffset = ($localNow - $utcNow).TotalHours

# 03:00 UTC in local time
$localHour = (3 + $utcOffset) % 24
if ($localHour -lt 0) { $localHour += 24 }

Write-Host "UTC Offset: $utcOffset hours" -ForegroundColor White
Write-Host "03:00 UTC = $($localHour):00 local time" -ForegroundColor White
Write-Host ""

# Create scheduled task action
$action = New-ScheduledTaskAction `
    -Execute "PowerShell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" `
    -WorkingDirectory $workspaceRoot

# Create scheduled task trigger (daily at 03:00 UTC)
$trigger = New-ScheduledTaskTrigger `
    -Daily `
    -At "$($localHour):00"

# Create scheduled task settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)

# Create scheduled task principal (run as current user)
$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Highest

# Register the task
try {
    Register-ScheduledTask `
        -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description "Unit Talk nightly E2E validation - runs at 03:00 UTC daily" | Out-Null
    
    Write-Host "✅ Task '$taskName' installed successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to install task: $_" -ForegroundColor Red
    exit 1
}

# Verify installation
$installedTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($installedTask) {
    Write-Host ""
    Write-Host "Task Details:" -ForegroundColor Cyan
    Write-Host "  Name: $($installedTask.TaskName)" -ForegroundColor White
    Write-Host "  State: $($installedTask.State)" -ForegroundColor White
    Write-Host "  Next Run: $((Get-ScheduledTaskInfo -TaskName $taskName).NextRunTime)" -ForegroundColor White
    Write-Host ""
    
    # Offer to run now for testing
    $runNow = Read-Host "Do you want to run the validation now for testing? (y/n)"
    
    if ($runNow -eq 'y') {
        Write-Host ""
        Write-Host "Running validation now..." -ForegroundColor Yellow
        Start-ScheduledTask -TaskName $taskName
        Write-Host "✅ Task started - check logs in out/ops/cutover/metrics/nightly/" -ForegroundColor Green
    }
} else {
    Write-Host "❌ Task installation verification failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "INSTALLATION COMPLETE" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor White
Write-Host "  1. Task will run daily at 03:00 UTC ($($localHour):00 local time)" -ForegroundColor White
Write-Host "  2. Logs saved to: out/ops/cutover/metrics/nightly/" -ForegroundColor White
Write-Host "  3. Last 7 runs are kept automatically" -ForegroundColor White
Write-Host ""
Write-Host "Management Commands:" -ForegroundColor White
Write-Host "  View task: Get-ScheduledTask -TaskName '$taskName'" -ForegroundColor Gray
Write-Host "  Run now: Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor Gray
Write-Host "  Disable: Disable-ScheduledTask -TaskName '$taskName'" -ForegroundColor Gray
Write-Host "  Uninstall: .\scripts\ops\install-nightly-validation.ps1 -Uninstall" -ForegroundColor Gray
Write-Host ""


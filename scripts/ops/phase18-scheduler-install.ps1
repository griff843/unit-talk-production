#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Phase 18: Continuous Validation Framework - Windows Task Scheduler Installation

.DESCRIPTION
    Installs Phase 18 validation tasks into Windows Task Scheduler:
    - Health checks every 10 minutes
    - E2E smoke tests every 6 hours
    - Self-heal worker as background service

.PARAMETER ScheduleHealth
    Cron-like schedule for health checks (default: every 10 minutes)

.PARAMETER ScheduleE2e
    Cron-like schedule for E2E tests (default: every 6 hours)

.PARAMETER AlertWebhookSlack
    Slack webhook URL for alerts

.PARAMETER AlertWebhookDiscord
    Discord webhook URL for alerts

.EXAMPLE
    .\phase18-scheduler-install.ps1
    .\phase18-scheduler-install.ps1 -AlertWebhookSlack "https://hooks.slack.com/..."

.NOTES
    Date: 2025-11-10
    Author: Unit Talk Ops
    Version: 1.0.0
#>

[CmdletBinding()]
param(
    [string]$ScheduleHealth = "*/10 * * * *",
    [string]$ScheduleE2e = "0 */6 * * *",
    [string]$AlertWebhookSlack = "",
    [string]$AlertWebhookDiscord = ""
)

$ErrorActionPreference = "Stop"
$workspaceRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Phase 18: Continuous Validation Framework - Task Scheduler    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $isAdmin) {
    Write-Host "❌ This script must be run as Administrator" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Running as Administrator" -ForegroundColor Green
Write-Host ""

# Function to create scheduled task
function New-Phase18Task {
    param(
        [string]$TaskName,
        [string]$ScriptPath,
        [string]$Arguments,
        [string]$Trigger,
        [string]$Description
    )
    
    Write-Host "Installing task: $TaskName..." -ForegroundColor Yellow
    
    try {
        # Remove existing task if it exists
        $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        if ($existingTask) {
            Write-Host "  Removing existing task..." -ForegroundColor Gray
            Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        }
        
        # Create task action
        $action = New-ScheduledTaskAction `
            -Execute "powershell.exe" `
            -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`" $Arguments"
        
        # Create task trigger based on schedule
        $taskTrigger = switch ($Trigger) {
            "*/10 * * * *" {
                New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 10) -RepetitionDuration (New-TimeSpan -Days 365)
            }
            "0 */6 * * *" {
                New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 6) -RepetitionDuration (New-TimeSpan -Days 365)
            }
            default {
                New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 10) -RepetitionDuration (New-TimeSpan -Days 365)
            }
        }
        
        # Create task settings
        $settings = New-ScheduledTaskSettingsSet `
            -AllowStartIfOnBatteries `
            -DontStopIfGoingOnBatteries `
            -StartWhenAvailable `
            -RunOnlyIfNetworkAvailable `
            -MultipleInstances IgnoreNew
        
        # Register task
        Register-ScheduledTask `
            -TaskName $TaskName `
            -Action $action `
            -Trigger $taskTrigger `
            -Settings $settings `
            -Description $Description `
            -RunLevel Highest `
            -Force | Out-Null
        
        Write-Host "  ✅ Task installed successfully" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "  ❌ Failed to install task: $_" -ForegroundColor Red
        return $false
    }
}

# Build arguments
$commonArgs = ""
if ($AlertWebhookSlack) {
    $commonArgs += " --alert-webhook-slack `"$AlertWebhookSlack`""
}
if ($AlertWebhookDiscord) {
    $commonArgs += " --alert-webhook-discord `"$AlertWebhookDiscord`""
}

# Create wrapper scripts
$healthCheckScript = @"
cd "$workspaceRoot"
npm run ops:phase18:run -- --dry-run --verbose$commonArgs
"@

$e2eScript = @"
cd "$workspaceRoot"
npm run ops:phase18:run -- --dry-run --verbose$commonArgs
"@

$selfHealScript = @"
cd "$workspaceRoot"
npm run ops:phase18:self-heal-worker -- --interval 60000$commonArgs
"@

# Write wrapper scripts
$healthCheckPath = Join-Path $workspaceRoot "scripts\ops\phase18-health-check-wrapper.ps1"
$e2ePath = Join-Path $workspaceRoot "scripts\ops\phase18-e2e-wrapper.ps1"
$selfHealPath = Join-Path $workspaceRoot "scripts\ops\phase18-self-heal-wrapper.ps1"

Set-Content -Path $healthCheckPath -Value $healthCheckScript -Encoding UTF8
Set-Content -Path $e2ePath -Value $e2eScript -Encoding UTF8
Set-Content -Path $selfHealPath -Value $selfHealScript -Encoding UTF8

Write-Host "📝 Wrapper scripts created" -ForegroundColor Cyan
Write-Host ""

# Install tasks
$tasks = @(
    @{
        Name = "Phase18-HealthCheck"
        Script = $healthCheckPath
        Arguments = ""
        Trigger = "*/10 * * * *"
        Description = "Phase 18 health checks every 10 minutes"
    },
    @{
        Name = "Phase18-E2ESmoke"
        Script = $e2ePath
        Arguments = ""
        Trigger = "0 */6 * * *"
        Description = "Phase 18 E2E smoke tests every 6 hours"
    },
    @{
        Name = "Phase18-SelfHealWorker"
        Script = $selfHealPath
        Arguments = ""
        Trigger = "*/10 * * * *"
        Description = "Phase 18 self-heal worker (background)"
    }
)

$successCount = 0
foreach ($task in $tasks) {
    if (New-Phase18Task -TaskName $task.Name -ScriptPath $task.Script -Arguments $task.Arguments -Trigger $task.Trigger -Description $task.Description) {
        $successCount++
    }
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Installation Summary                                          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Installed: $successCount/$($tasks.Count) tasks" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Installed Tasks:" -ForegroundColor Yellow
Get-ScheduledTask -TaskName "Phase18-*" | ForEach-Object {
    Write-Host "  • $($_.TaskName)" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "🔍 To view task details:" -ForegroundColor Yellow
Write-Host "  Get-ScheduledTask -TaskName 'Phase18-*' | Select-Object TaskName, State, LastRunTime" -ForegroundColor Gray
Write-Host ""
Write-Host "▶️  To run a task manually:" -ForegroundColor Yellow
Write-Host "  Start-ScheduledTask -TaskName 'Phase18-HealthCheck'" -ForegroundColor Gray
Write-Host ""
Write-Host "📊 To view task history:" -ForegroundColor Yellow
Write-Host "  Get-ScheduledTaskInfo -TaskName 'Phase18-HealthCheck'" -ForegroundColor Gray
Write-Host ""

if ($successCount -eq $tasks.Count) {
    Write-Host "✅ Phase 18 scheduler installation complete!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "⚠️  Some tasks failed to install. Please check the errors above." -ForegroundColor Yellow
    exit 1
}


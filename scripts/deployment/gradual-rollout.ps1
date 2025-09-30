# =============================================
# Unit Talk Syndicate-Grade Gradual Rollout Script (PowerShell)
# Comprehensive deployment orchestration with safety gates
# =============================================

param(
    [Parameter(Mandatory = $false)]
    [string]$FeatureFlag = "",
    
    [Parameter(Mandatory = $false)]
    [int]$TargetPercentage = 100,
    
    [Parameter(Mandatory = $false)]
    [int]$StepSize = 25,
    
    [Parameter(Mandatory = $false)]
    [int]$StabilizationPeriod = 300,
    
    [Parameter(Mandatory = $false)]
    [string]$Environment = "production",
    
    [Parameter(Mandatory = $false)]
    [int]$MaxRolloutDuration = 14400,
    
    [Parameter(Mandatory = $false)]
    [switch]$NoValidation,
    
    [Parameter(Mandatory = $false)]
    [switch]$NoAutoRollback,
    
    [Parameter(Mandatory = $false)]
    [switch]$DryRun,
    
    [Parameter(Mandatory = $false)]
    [switch]$Help
)

# Configuration
$script:ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$script:ValidationEnabled = -not $NoValidation
$script:AutoRollbackEnabled = -not $NoAutoRollback

# Color constants for output
$script:Colors = @{
    Red    = [ConsoleColor]::Red
    Green  = [ConsoleColor]::Green
    Yellow = [ConsoleColor]::Yellow
    Blue   = [ConsoleColor]::Blue
    Purple = [ConsoleColor]::Magenta
    White  = [ConsoleColor]::White
}

# Logging functions
function Write-LogMessage {
    param(
        [string]$Message,
        [ConsoleColor]$Color = [ConsoleColor]::White,
        [string]$Prefix = "INFO"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$Prefix] $timestamp - $Message" -ForegroundColor $Color
}

function Write-LogInfo { param([string]$Message) Write-LogMessage -Message $Message -Color $script:Colors.Blue -Prefix "INFO" }
function Write-LogSuccess { param([string]$Message) Write-LogMessage -Message $Message -Color $script:Colors.Green -Prefix "SUCCESS" }
function Write-LogWarning { param([string]$Message) Write-LogMessage -Message $Message -Color $script:Colors.Yellow -Prefix "WARNING" }
function Write-LogError { param([string]$Message) Write-LogMessage -Message $Message -Color $script:Colors.Red -Prefix "ERROR" }
function Write-LogStep { param([string]$Message) Write-LogMessage -Message $Message -Color $script:Colors.Purple -Prefix "STEP" }

# Usage function
function Show-Usage {
    @"
Unit Talk Syndicate-Grade Gradual Rollout Script (PowerShell)

USAGE:
    .\gradual-rollout.ps1 [OPTIONS]

PARAMETERS:
    -FeatureFlag <FLAG>          Feature flag name to rollout (required)
    -TargetPercentage <PERCENT>  Target rollout percentage (default: 100)
    -StepSize <SIZE>             Rollout step size (default: 25)
    -StabilizationPeriod <SEC>   Wait time between steps (default: 300)
    -Environment <ENV>           Environment (default: production)
    -MaxRolloutDuration <SEC>    Max rollout duration (default: 14400)
    -NoValidation               Disable validation gates
    -NoAutoRollback             Disable automatic rollback
    -DryRun                     Preview rollout plan without execution
    -Help                       Show this help message

EXAMPLES:
    # Rollout enhanced grading to 50% with 5% steps
    .\gradual-rollout.ps1 -FeatureFlag "enhanced_45_factor_grading" -TargetPercentage 50 -StepSize 5
    
    # Full rollout with custom stabilization period
    .\gradual-rollout.ps1 -FeatureFlag "hot_warm_cold_pipeline" -TargetPercentage 100 -StabilizationPeriod 600
    
    # Dry run to preview deployment plan
    .\gradual-rollout.ps1 -FeatureFlag "event_driven_alert_agent" -DryRun

FEATURE FLAGS:
    - enhanced_45_factor_grading
    - event_driven_alert_agent 
    - hot_warm_cold_pipeline
    - feature_store_integration
    - slo_monitoring_system
"@
}

# Validation functions
function Test-Configuration {
    Write-LogStep "Validating deployment configuration"
    
    if ([string]::IsNullOrEmpty($FeatureFlag)) {
        Write-LogError "Feature flag name is required. Use -FeatureFlag parameter"
        throw "Configuration validation failed"
    }
    
    if ($TargetPercentage -lt 0 -or $TargetPercentage -gt 100) {
        Write-LogError "Target percentage must be between 0 and 100"
        throw "Configuration validation failed"
    }
    
    if ($StepSize -lt 1 -or $StepSize -gt 50) {
        Write-LogError "Step size must be between 1 and 50"
        throw "Configuration validation failed"
    }
    
    # Test Docker Compose availability
    try {
        $null = docker-compose --version
    }
    catch {
        Write-LogError "Docker Compose is required but not available"
        throw "Docker Compose not found"
    }
    
    # Test API connectivity
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -ne 200) {
            throw "API returned status $($response.StatusCode)"
        }
    }
    catch {
        Write-LogError "API service is not available at http://localhost:3000"
        Write-LogInfo "Please run './dev.sh start' to start all services"
        throw "API connectivity test failed"
    }
    
    Write-LogSuccess "Configuration validation passed"
}

# Get current rollout percentage
function Get-CurrentPercentage {
    param([string]$FlagName)
    
    $nodeScript = @"
const { FeatureFlagService } = require('./dist/services/feature-flags/FeatureFlagService');
const { createClient } = require('@supabase/supabase-js');

async function getCurrentPercentage() {
    try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        
        const { data } = await supabase
            .from('feature_flags')
            .select('rollout_percentage')
            .eq('flag_name', '$FlagName')
            .single();
            
        console.log(data?.rollout_percentage || 0);
    } catch (error) {
        console.log(0);
    }
}

getCurrentPercentage();
"@
    
    $tempFile = [System.IO.Path]::GetTempFileName()
    $nodeScript | Out-File -FilePath $tempFile -Encoding UTF8
    
    try {
        $result = docker-compose exec -T api node $tempFile 2>$null
        return [int]($result -replace '[^\d]', '')
    }
    catch {
        return 0
    }
    finally {
        if (Test-Path $tempFile) {
            Remove-Item $tempFile -Force
        }
    }
}

# Calculate rollout steps
function Get-RolloutSteps {
    param(
        [int]$Current,
        [int]$Target,
        [int]$StepSize
    )
    
    $steps = @()
    
    if ($Target -gt $Current) {
        # Increasing rollout
        for ($percentage = $Current + $StepSize; $percentage -le $Target; $percentage += $StepSize) {
            if ($percentage -gt $Target) {
                $percentage = $Target
            }
            $steps += $percentage
            if ($percentage -eq $Target) {
                break
            }
        }
        if ($steps.Count -eq 0 -or $steps[-1] -ne $Target) {
            $steps += $Target
        }
    }
    elseif ($Target -lt $Current) {
        # Decreasing rollout (rollback)
        for ($percentage = $Current - $StepSize; $percentage -ge $Target; $percentage -= $StepSize) {
            if ($percentage -lt $Target) {
                $percentage = $Target
            }
            $steps += $percentage
            if ($percentage -eq $Target) {
                break
            }
        }
        if ($steps.Count -eq 0 -or $steps[-1] -ne $Target) {
            $steps += $Target
        }
    }
    
    return $steps
}

# Update feature flag percentage
function Set-FlagPercentage {
    param(
        [string]$FlagName,
        [int]$Percentage
    )
    
    Write-LogInfo "Updating $FlagName rollout to $Percentage%"
    
    $nodeScript = @"
const { FeatureFlagService } = require('./dist/services/feature-flags/FeatureFlagService');
const { createClient } = require('@supabase/supabase-js');

async function updateFlag() {
    try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const service = new FeatureFlagService(supabase);
        
        await service.updateFlag('$FlagName', {
            rolloutPercentage: $Percentage,
            enabled: true
        });
        
        console.log('SUCCESS');
    } catch (error) {
        console.log('ERROR: ' + error.message);
    }
}

updateFlag();
"@
    
    $tempFile = [System.IO.Path]::GetTempFileName()
    $nodeScript | Out-File -FilePath $tempFile -Encoding UTF8
    
    try {
        $result = docker-compose exec -T api node $tempFile 2>$null
        if ($result -match "SUCCESS") {
            Write-LogSuccess "Successfully updated $FlagName to $Percentage%"
            return $true
        }
        else {
            Write-LogError "Failed to update flag: $result"
            return $false
        }
    }
    catch {
        Write-LogError "Failed to execute flag update"
        return $false
    }
    finally {
        if (Test-Path $tempFile) {
            Remove-Item $tempFile -Force
        }
    }
}

# Run health checks
function Test-HealthChecks {
    Write-LogInfo "Running comprehensive health checks"
    
    $healthEndpoints = @(
        @{ Endpoint = "http://localhost:3000/health"; Service = "API" }
        @{ Endpoint = "http://localhost:3000/health/scoring"; Service = "ScoringAgent" }
        @{ Endpoint = "http://localhost:3004/api/health"; Service = "CommandCenter" }
        @{ Endpoint = "http://localhost:9090/api/v1/targets"; Service = "Prometheus" }
    )
    
    $failedChecks = 0
    
    foreach ($check in $healthEndpoints) {
        Write-LogInfo "Checking $($check.Service) health: $($check.Endpoint)"
        
        try {
            $response = Invoke-WebRequest -Uri $check.Endpoint -UseBasicParsing -TimeoutSec 10
            if ($response.StatusCode -eq 200) {
                Write-LogSuccess "$($check.Service) health check passed"
            }
            else {
                Write-LogError "$($check.Service) health check failed with status $($response.StatusCode)"
                $failedChecks++
            }
        }
        catch {
            Write-LogError "$($check.Service) health check failed: $($_.Exception.Message)"
            $failedChecks++
        }
    }
    
    if ($failedChecks -gt 0) {
        Write-LogError "$failedChecks health checks failed"
        return $false
    }
    
    Write-LogSuccess "All health checks passed"
    return $true
}

# Collect rollout metrics
function Get-RolloutMetrics {
    param([string]$FlagName)
    
    Write-LogInfo "Collecting rollout metrics for $FlagName"
    
    $nodeScript = @"
const { FeatureFlagService } = require('./dist/services/feature-flags/FeatureFlagService');
const { createClient } = require('@supabase/supabase-js');

async function collectMetrics() {
    try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const service = new FeatureFlagService(supabase);
        
        const metrics = await service.getRolloutMetrics('$FlagName');
        const healthStatus = service.getHealthStatus();
        
        const combinedMetrics = {
            flagMetrics: metrics,
            serviceHealth: healthStatus,
            timestamp: new Date().toISOString()
        };
        
        console.log(JSON.stringify(combinedMetrics));
    } catch (error) {
        console.log(JSON.stringify({ error: error.message }));
    }
}

collectMetrics();
"@
    
    $tempFile = [System.IO.Path]::GetTempFileName()
    $nodeScript | Out-File -FilePath $tempFile -Encoding UTF8
    
    try {
        $result = docker-compose exec -T api node $tempFile 2>$null
        $metrics = $result | ConvertFrom-Json
        
        if ($metrics.error) {
            Write-LogError "Failed to collect metrics: $($metrics.error)"
            return $false
        }
        
        Write-LogSuccess "Metrics collected successfully"
        
        $errorRate = if ($metrics.flagMetrics.errorRate) { $metrics.flagMetrics.errorRate } else { 0 }
        $activeUsers = if ($metrics.flagMetrics.activeUsers) { $metrics.flagMetrics.activeUsers } else { 0 }
        
        Write-LogInfo "Current metrics - Error Rate: $errorRate, Active Users: $activeUsers"
        return $true
    }
    catch {
        Write-LogError "Failed to collect metrics"
        return $false
    }
    finally {
        if (Test-Path $tempFile) {
            Remove-Item $tempFile -Force
        }
    }
}

# Run validation gates
function Test-ValidationGates {
    param([string]$FlagName)
    
    if (-not $script:ValidationEnabled) {
        Write-LogInfo "Validation gates disabled, skipping"
        return $true
    }
    
    Write-LogInfo "Running validation gates for $FlagName"
    
    $nodeScript = @"
const { FeatureFlagService } = require('./dist/services/feature-flags/FeatureFlagService');
const { createClient } = require('@supabase/supabase-js');

async function runValidation() {
    try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        
        const { data: gates } = await supabase
            .from('rollout_validation_gates')
            .select('*')
            .eq('flag_name', '$FlagName')
            .eq('is_active', true);
        
        if (!gates || gates.length === 0) {
            console.log('NO_GATES');
            return;
        }
        
        const service = new FeatureFlagService(supabase);
        const metrics = await service.getRolloutMetrics('$FlagName');
        
        if (!metrics) {
            console.log('NO_METRICS');
            return;
        }
        
        let passedGates = 0;
        let totalGates = gates.length;
        
        for (const gate of gates) {
            const metricValue = metrics[gate.metric_name] || 0;
            let passed = false;
            
            switch (gate.comparison_operator) {
                case 'gt': passed = metricValue > gate.threshold_value; break;
                case 'lt': passed = metricValue < gate.threshold_value; break;
                case 'gte': passed = metricValue >= gate.threshold_value; break;
                case 'lte': passed = metricValue <= gate.threshold_value; break;
                case 'eq': passed = metricValue === gate.threshold_value; break;
            }
            
            if (passed) passedGates++;
        }
        
        const passRate = passedGates / totalGates;
        console.log(passRate >= 0.8 ? 'PASSED' : 'FAILED');
        
    } catch (error) {
        console.log('ERROR');
    }
}

runValidation();
"@
    
    $tempFile = [System.IO.Path]::GetTempFileName()
    $nodeScript | Out-File -FilePath $tempFile -Encoding UTF8
    
    try {
        $result = docker-compose exec -T api node $tempFile 2>$null
        
        switch ($result.Trim()) {
            "PASSED" {
                Write-LogSuccess "Validation gates passed"
                return $true
            }
            "FAILED" {
                Write-LogError "Validation gates failed"
                return $false
            }
            "NO_GATES" {
                Write-LogWarning "No validation gates configured for $FlagName"
                return $true
            }
            "NO_METRICS" {
                Write-LogWarning "No metrics available for validation"
                return $true
            }
            default {
                Write-LogError "Validation gate execution failed: $result"
                return $false
            }
        }
    }
    catch {
        Write-LogError "Validation gate execution failed"
        return $false
    }
    finally {
        if (Test-Path $tempFile) {
            Remove-Item $tempFile -Force
        }
    }
}

# Wait for stabilization
function Wait-ForStabilization {
    param([int]$Duration)
    
    Write-LogInfo "Stabilization period: ${Duration}s"
    
    for ($i = $Duration; $i -gt 0; $i--) {
        Write-Progress -Activity "Stabilizing" -Status "$i seconds remaining" -PercentComplete ((($Duration - $i) / $Duration) * 100)
        Start-Sleep -Seconds 1
    }
    
    Write-Progress -Activity "Stabilizing" -Completed
    Write-LogSuccess "Stabilization period completed"
}

# Emergency rollback
function Invoke-EmergencyRollback {
    param([string]$Reason)
    
    Write-LogError "EMERGENCY ROLLBACK TRIGGERED: $Reason"
    
    $nodeScript = @"
const { FeatureFlagService } = require('./dist/services/feature-flags/FeatureFlagService');
const { createClient } = require('@supabase/supabase-js');

async function emergencyRollback() {
    try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const service = new FeatureFlagService(supabase);
        
        await service.emergencyRollback('$FeatureFlag', '$Reason');
        console.log('ROLLBACK_SUCCESS');
    } catch (error) {
        console.log('ROLLBACK_FAILED: ' + error.message);
    }
}

emergencyRollback();
"@
    
    $tempFile = [System.IO.Path]::GetTempFileName()
    $nodeScript | Out-File -FilePath $tempFile -Encoding UTF8
    
    try {
        $result = docker-compose exec -T api node $tempFile 2>$null
        Write-LogWarning "Emergency rollback completed for $FeatureFlag"
    }
    finally {
        if (Test-Path $tempFile) {
            Remove-Item $tempFile -Force
        }
    }
}

# Create rollout plan
function Show-RolloutPlan {
    param(
        [int]$Current,
        [int]$Target,
        [array]$Steps
    )
    
    Write-LogStep "Creating rollout plan"
    
    Write-Host ""
    Write-Host "====================================================" -ForegroundColor White
    Write-Host "SYNDICATE-GRADE ROLLOUT PLAN" -ForegroundColor White
    Write-Host "====================================================" -ForegroundColor White
    Write-Host "Feature Flag:      $FeatureFlag" -ForegroundColor White
    Write-Host "Environment:       $Environment" -ForegroundColor White
    Write-Host "Current Rollout:   $Current%" -ForegroundColor White
    Write-Host "Target Rollout:    $Target%" -ForegroundColor White
    Write-Host "Step Size:         $StepSize%" -ForegroundColor White
    Write-Host "Stabilization:     ${StabilizationPeriod}s between steps" -ForegroundColor White
    Write-Host "Max Duration:      ${MaxRolloutDuration}s" -ForegroundColor White
    Write-Host "Validation Gates:  $(if ($script:ValidationEnabled) { "Enabled" } else { "Disabled" })" -ForegroundColor White
    Write-Host "Auto Rollback:     $(if ($script:AutoRollbackEnabled) { "Enabled" } else { "Disabled" })" -ForegroundColor White
    Write-Host ""
    Write-Host "ROLLOUT STEPS:" -ForegroundColor White
    
    for ($i = 0; $i -lt $Steps.Count; $i++) {
        Write-Host "  Step $($i + 1): $($Steps[$i])%" -ForegroundColor White
    }
    
    Write-Host ""
    Write-Host "Total Steps: $($Steps.Count)" -ForegroundColor White
    Write-Host "Estimated Duration: $(($Steps.Count * $StabilizationPeriod + 300))s" -ForegroundColor White
    Write-Host "====================================================" -ForegroundColor White
    Write-Host ""
}

# Execute rollout step
function Invoke-RolloutStep {
    param(
        [int]$StepNum,
        [int]$Percentage,
        [int]$TotalSteps
    )
    
    Write-LogStep "Step $StepNum/$TotalSteps`: Rolling out to $Percentage%"
    
    # Update flag percentage
    if (-not (Set-FlagPercentage -FlagName $FeatureFlag -Percentage $Percentage)) {
        Write-LogError "Failed to update flag percentage"
        return $false
    }
    
    # Short wait for changes to propagate
    Start-Sleep -Seconds 10
    
    # Run health checks
    if (-not (Test-HealthChecks)) {
        Write-LogError "Health checks failed at $Percentage%"
        return $false
    }
    
    # Collect metrics
    if (-not (Get-RolloutMetrics -FlagName $FeatureFlag)) {
        Write-LogWarning "Metrics collection failed, continuing"
    }
    
    # Run validation gates
    if (-not (Test-ValidationGates -FlagName $FeatureFlag)) {
        Write-LogError "Validation gates failed at $Percentage%"
        return $false
    }
    
    Write-LogSuccess "Step $StepNum completed successfully at $Percentage%"
    return $true
}

# Main rollout execution
function Invoke-Rollout {
    $currentPercentage = Get-CurrentPercentage -FlagName $FeatureFlag
    Write-LogInfo "Current rollout percentage: $currentPercentage%"
    
    if ($currentPercentage -eq $TargetPercentage) {
        Write-LogSuccess "Feature flag is already at target percentage ($TargetPercentage%)"
        return $true
    }
    
    $steps = Get-RolloutSteps -Current $currentPercentage -Target $TargetPercentage -StepSize $StepSize
    
    if ($steps.Count -eq 0) {
        Write-LogSuccess "No rollout steps needed"
        return $true
    }
    
    # Create and display rollout plan
    Show-RolloutPlan -Current $currentPercentage -Target $TargetPercentage -Steps $steps
    
    if ($DryRun) {
        Write-LogInfo "Dry run mode - no changes will be made"
        return $true
    }
    
    # Confirm execution
    if ([Console]::IsInputRedirected -eq $false) {
        $confirmation = Read-Host "Proceed with rollout? (y/N)"
        if ($confirmation -notmatch "^[Yy]$") {
            Write-LogInfo "Rollout cancelled by user"
            return $true
        }
    }
    
    $startTime = Get-Date
    Write-LogInfo "Starting rollout execution"
    
    # Execute rollout steps
    for ($i = 0; $i -lt $steps.Count; $i++) {
        $elapsed = (Get-Date) - $startTime
        
        if ($elapsed.TotalSeconds -gt $MaxRolloutDuration) {
            Write-LogError "Maximum rollout duration exceeded ($MaxRolloutDuration s)"
            return $false
        }
        
        if (-not (Invoke-RolloutStep -StepNum ($i + 1) -Percentage $steps[$i] -TotalSteps $steps.Count)) {
            Write-LogError "Rollout step $($i + 1) failed"
            return $false
        }
        
        # Stabilization period (except for last step)
        if ($i -lt ($steps.Count - 1)) {
            Wait-ForStabilization -Duration $StabilizationPeriod
        }
    }
    
    $totalDuration = ((Get-Date) - $startTime).TotalSeconds
    Write-LogSuccess "Rollout completed successfully in $([math]::Round($totalDuration))s"
    
    # Final metrics collection
    Write-LogInfo "Collecting final metrics"
    Get-RolloutMetrics -FlagName $FeatureFlag | Out-Null
    
    return $true
}

# Error handling
function Handle-Error {
    param([string]$ErrorMessage)
    
    Write-LogError "Script execution failed: $ErrorMessage"
    
    if ($script:AutoRollbackEnabled) {
        Write-LogWarning "Auto-rollback enabled, triggering emergency rollback"
        Invoke-EmergencyRollback -Reason "PowerShell script failure: $ErrorMessage"
    }
    
    exit 1
}

# Main execution
function Main {
    try {
        if ($Help) {
            Show-Usage
            return
        }
        
        Write-LogInfo "Unit Talk Syndicate-Grade Gradual Rollout Script (PowerShell)"
        Write-LogInfo "Starting deployment orchestration"
        
        Test-Configuration
        
        if (-not (Invoke-Rollout)) {
            Handle-Error "Rollout execution failed"
        }
        
        Write-LogSuccess "Deployment orchestration completed successfully"
    }
    catch {
        Handle-Error $_.Exception.Message
    }
}

# Execute main function
Main
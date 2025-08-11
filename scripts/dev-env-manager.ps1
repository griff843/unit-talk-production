# Unit Talk Development Environment Manager
# Permanent solution for Windows development issues

param(
    [string]$Action = "start",
    [string]$App = "all",
    [switch]$Clean = $false,
    [switch]$Force = $false
)

# Configuration
$Apps = @{
    "smart-form" = @{
        "path" = "apps\smart-form"
        "port" = 3021
        "name" = "Smart Form"
        "startup_time" = 30
    }
    "command-center" = @{
        "path" = "apps\command-center" 
        "port" = 3020
        "name" = "Command Center"
        "startup_time" = 45
    }
    "dashboard" = @{
        "path" = "apps\dashboard"
        "port" = 3000
        "name" = "Dashboard"
        "startup_time" = 30
    }
    "api" = @{
        "path" = "apps\api"
        "port" = 3001
        "name" = "API Server"
        "startup_time" = 20
    }
    "discord-bot" = @{
        "path" = "apps\discord-bot"
        "port" = 0
        "name" = "Discord Bot"
        "startup_time" = 15
    }
}

$LogFile = "scripts\dev-env.log"

function Write-Log {
    param($Message, $Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    Write-Host $logMessage -ForegroundColor $(if($Level -eq "ERROR") { "Red" } elseif($Level -eq "WARN") { "Yellow" } else { "Green" })
    Add-Content -Path $LogFile -Value $logMessage
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Stop-ProcessOnPort {
    param([int]$Port)
    
    if ($Port -eq 0) { return }
    
    try {
        Write-Log "Checking port $Port..."
        $processes = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
        
        foreach ($pid in $processes) {
            if ($pid -and $pid -ne 0) {
                try {
                    $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
                    if ($process) {
                        Write-Log "Killing process $($process.ProcessName) (PID: $pid) on port $Port" "WARN"
                        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                        Start-Sleep -Seconds 2
                    }
                } catch {
                    Write-Log "Could not kill process $pid: $($_.Exception.Message)" "WARN"
                }
            }
        }
    } catch {
        Write-Log "Port $Port check failed: $($_.Exception.Message)" "WARN"
    }
}

function Clear-NodeModules {
    param([string]$AppPath)
    
    $nodeModulesPath = Join-Path $AppPath "node_modules"
    $nextPath = Join-Path $AppPath ".next"
    
    if (Test-Path $nodeModulesPath) {
        Write-Log "Clearing node_modules in $AppPath..."
        try {
            Remove-Item -Path $nodeModulesPath -Recurse -Force -ErrorAction SilentlyContinue
            Write-Log "Cleared node_modules"
        } catch {
            Write-Log "Failed to clear node_modules: $($_.Exception.Message)" "ERROR"
        }
    }
    
    if (Test-Path $nextPath) {
        Write-Log "Clearing .next cache in $AppPath..."
        try {
            Remove-Item -Path $nextPath -Recurse -Force -ErrorAction SilentlyContinue
            Write-Log "Cleared .next cache"
        } catch {
            Write-Log "Failed to clear .next cache: $($_.Exception.Message)" "ERROR"
        }
    }
}

function Install-Dependencies {
    param([string]$AppPath)
    
    Write-Log "Installing dependencies in $AppPath..."
    Push-Location $AppPath
    try {
        & npm install --silent
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Dependencies installed successfully"
        } else {
            Write-Log "npm install failed with exit code $LASTEXITCODE" "ERROR"
        }
    } catch {
        Write-Log "npm install error: $($_.Exception.Message)" "ERROR"
    } finally {
        Pop-Location
    }
}

function Start-App {
    param([string]$AppName)
    
    $appConfig = $Apps[$AppName]
    if (-not $appConfig) {
        Write-Log "Unknown app: $AppName" "ERROR"
        return $false
    }
    
    $appPath = $appConfig.path
    $port = $appConfig.port
    $name = $appConfig.name
    $startupTime = $appConfig.startup_time
    
    Write-Log "Starting $name..."
    
    # Stop any existing processes on the port
    Stop-ProcessOnPort $port
    
    # Clean if requested
    if ($Clean) {
        Clear-NodeModules $appPath
        Install-Dependencies $appPath
    }
    
    # Start the application
    Push-Location $appPath
    try {
        if ($port -gt 0) {
            $env:PORT = $port
        }
        
        Write-Log "Launching $name on port $port..."
        
        # Start in background
        $process = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -NoNewWindow -PassThru -RedirectStandardOutput "..\..\logs\$AppName-stdout.log" -RedirectStandardError "..\..\logs\$AppName-stderr.log"
        
        Write-Log "$name started with PID $($process.Id)"
        
        # Wait for startup
        Write-Log "Waiting $startupTime seconds for $name to start..."
        Start-Sleep -Seconds $startupTime
        
        # Verify it's running
        if ($port -gt 0) {
            try {
                $response = Invoke-WebRequest -Uri "http://localhost:$port" -TimeoutSec 5 -ErrorAction SilentlyContinue
                if ($response.StatusCode -eq 200) {
                    Write-Log "$name is running successfully at http://localhost:$port"
                    return $true
                } else {
                    Write-Log "$name may not be ready yet (Status: $($response.StatusCode))" "WARN"
                }
            } catch {
                Write-Log "$name health check failed: $($_.Exception.Message)" "WARN"
            }
        }
        
    } catch {
        Write-Log "Failed to start $name: $($_.Exception.Message)" "ERROR"
        return $false
    } finally {
        Pop-Location
    }
    
    return $true
}

function Stop-App {
    param([string]$AppName)
    
    $appConfig = $Apps[$AppName]
    if (-not $appConfig) {
        Write-Log "Unknown app: $AppName" "ERROR"
        return
    }
    
    $port = $appConfig.port
    $name = $appConfig.name
    
    Write-Log "Stopping $name..."
    Stop-ProcessOnPort $port
    Write-Log "$name stopped"
}

function Show-Status {
    Write-Log "=== Unit Talk Development Environment Status ==="
    
    foreach ($appName in $Apps.Keys) {
        $appConfig = $Apps[$appName]
        $port = $appConfig.port
        $name = $appConfig.name
        
        if ($port -gt 0) {
            try {
                $response = Invoke-WebRequest -Uri "http://localhost:$port" -TimeoutSec 2 -ErrorAction SilentlyContinue
                Write-Log "$name: ✅ RUNNING (http://localhost:$port)"
            } catch {
                Write-Log "$name: ❌ NOT RUNNING (port $port)"
            }
        } else {
            # Check for process by name
            $processes = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*$name*" }
            if ($processes) {
                Write-Log "$name: ✅ RUNNING (PID: $($processes[0].Id))"
            } else {
                Write-Log "$name: ❌ NOT RUNNING"
            }
        }
    }
}

# Main execution
Write-Log "=== Unit Talk Development Environment Manager ==="
Write-Log "Action: $Action, App: $App, Clean: $Clean, Force: $Force"

# Create logs directory
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" -Force
}

switch ($Action.ToLower()) {
    "start" {
        if ($App -eq "all") {
            # Start all apps
            $appsToStart = @("api", "smart-form", "command-center", "dashboard", "discord-bot")
            foreach ($appName in $appsToStart) {
                Start-App $appName
                Start-Sleep -Seconds 5  # Stagger startups
            }
        } else {
            Start-App $App
        }
    }
    "stop" {
        if ($App -eq "all") {
            foreach ($appName in $Apps.Keys) {
                Stop-App $appName
            }
        } else {
            Stop-App $App
        }
    }
    "restart" {
        if ($App -eq "all") {
            foreach ($appName in $Apps.Keys) {
                Stop-App $appName
            }
            Start-Sleep -Seconds 5
            $appsToStart = @("api", "smart-form", "command-center", "dashboard", "discord-bot")
            foreach ($appName in $appsToStart) {
                Start-App $appName
                Start-Sleep -Seconds 5
            }
        } else {
            Stop-App $App
            Start-Sleep -Seconds 5
            Start-App $App
        }
    }
    "status" {
        Show-Status
    }
    "clean" {
        Write-Log "Cleaning all development environments..."
        foreach ($appName in $Apps.Keys) {
            $appConfig = $Apps[$appName]
            Clear-NodeModules $appConfig.path
            Install-Dependencies $appConfig.path
        }
        Write-Log "Clean complete"
    }
    default {
        Write-Log "Usage: .\dev-env-manager.ps1 [-Action start|stop|restart|status|clean] [-App app-name|all] [-Clean] [-Force]"
        Write-Log "Examples:"
        Write-Log "  .\dev-env-manager.ps1 -Action start -App smart-form"
        Write-Log "  .\dev-env-manager.ps1 -Action start -App all -Clean"
        Write-Log "  .\dev-env-manager.ps1 -Action status"
        Write-Log "  .\dev-env-manager.ps1 -Action stop -App all"
    }
}

Write-Log "=== Operation Complete ==="
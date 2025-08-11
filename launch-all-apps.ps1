# Unit Talk Platform - Universal App Launcher for Windows
# This script reliably starts all apps without shell compatibility issues

param(
    [string]$App = "all",
    [switch]$Debug = $false
)

$ErrorActionPreference = "Stop"

# Color coding for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

# Base paths
$basePath = Split-Path -Parent $MyInvocation.MyCommand.Path

# App configurations with their ports and commands
$apps = @{
    "api" = @{
        path = "$basePath\apps\api"
        port = 3004
        name = "Unit Talk API"
        startCmd = "node dist\index.js"
        buildCmd = "npm run build"
        devCmd = "npm run dev"
    }
    "command-center" = @{
        path = "$basePath\apps\command-center"
        port = 3015
        name = "Command Center"
        startCmd = "npm run dev"
        buildCmd = "npm run build"
        devCmd = "npm run dev"
    }
    "dashboard" = @{
        path = "$basePath\apps\dashboard"
        port = 3005
        name = "Analytics Dashboard"
        startCmd = "npm run dev"
        buildCmd = "npm run build"
        devCmd = "npm run dev"
    }
    "discord-bot" = @{
        path = "$basePath\apps\discord-bot"
        port = $null
        name = "Discord Bot"
        startCmd = "node dist\index.js"
        buildCmd = "npm run build"
        devCmd = "npm run dev"
    }
    "smart-form" = @{
        path = "$basePath\apps\smart-form"
        port = 3006
        name = "Smart Form"
        startCmd = "npm run dev"
        buildCmd = "npm run build"
        devCmd = "npm run dev"
    }
}

# Function to check if a port is in use
function Test-Port {
    param([int]$Port)
    
    if ($null -eq $Port) { return $false }
    
    try {
        $tcpConnection = New-Object System.Net.Sockets.TcpClient
        $tcpConnection.Connect("localhost", $Port)
        $tcpConnection.Close()
        return $true
    } catch {
        return $false
    }
}

# Function to kill process on a specific port
function Stop-ProcessOnPort {
    param([int]$Port)
    
    if ($null -eq $Port) { return }
    
    $process = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | 
               Select-Object -ExpandProperty OwningProcess -Unique
    
    if ($process) {
        Write-Warning "Killing process on port $Port (PID: $process)"
        Stop-Process -Id $process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
}

# Function to wait for app to be ready
function Wait-ForApp {
    param(
        [string]$Name,
        [int]$Port,
        [int]$MaxWaitTime = 60
    )
    
    if ($null -eq $Port) {
        Write-Info "$Name started (no port to check)"
        return $true
    }
    
    Write-Info "Waiting for $Name to be ready on port $Port..."
    
    $startTime = Get-Date
    while ((Get-Date) - $startTime -lt [TimeSpan]::FromSeconds($MaxWaitTime)) {
        if (Test-Port -Port $Port) {
            Write-Success "$Name is ready on port $Port!"
            return $true
        }
        Start-Sleep -Seconds 2
        Write-Host "." -NoNewline
    }
    
    Write-Error "$Name failed to start within $MaxWaitTime seconds"
    return $false
}

# Function to start an app
function Start-App {
    param(
        [string]$AppName,
        [hashtable]$Config
    )
    
    Write-Info "`n=== Starting $($Config.name) ==="
    
    # Check if path exists
    if (-not (Test-Path $Config.path)) {
        Write-Error "Path not found: $($Config.path)"
        return $false
    }
    
    # Kill existing process if port is in use
    if ($null -ne $Config.port) {
        Stop-ProcessOnPort -Port $Config.port
    }
    
    # Navigate to app directory
    Set-Location $Config.path
    
    # Check if node_modules exists
    if (-not (Test-Path "node_modules")) {
        Write-Info "Installing dependencies for $($Config.name)..."
        & npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to install dependencies"
            return $false
        }
    }
    
    # Build if needed (for compiled apps)
    if ($Config.buildCmd -and $AppName -in @("api", "discord-bot")) {
        Write-Info "Building $($Config.name)..."
        Invoke-Expression $Config.buildCmd
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Build failed"
            return $false
        }
    }
    
    # Start the app in a new window
    Write-Info "Starting $($Config.name)..."
    
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = "cmd.exe"
    $startInfo.Arguments = "/c title $($Config.name) && cd /d `"$($Config.path)`" && $($Config.devCmd)"
    $startInfo.WorkingDirectory = $Config.path
    $startInfo.UseShellExecute = $true
    $startInfo.CreateNoWindow = $false
    $startInfo.WindowStyle = "Normal"
    
    $process = [System.Diagnostics.Process]::Start($startInfo)
    
    # Wait for app to be ready
    if ($null -ne $Config.port) {
        return Wait-ForApp -Name $Config.name -Port $Config.port
    }
    
    return $true
}

# Function to start all apps
function Start-AllApps {
    $order = @("api", "command-center", "dashboard", "smart-form", "discord-bot")
    
    foreach ($appName in $order) {
        if (-not (Start-App -AppName $appName -Config $apps[$appName])) {
            Write-Error "Failed to start $appName"
            return $false
        }
        Start-Sleep -Seconds 3
    }
    
    return $true
}

# Main execution
Write-Success "`n=========================================="
Write-Success "Unit Talk Platform - Universal App Launcher"
Write-Success "==========================================`n"

try {
    if ($App -eq "all") {
        if (Start-AllApps) {
            Write-Success "`n✅ All apps started successfully!"
            Write-Info "`nApplication URLs:"
            Write-Info "- API: http://localhost:3004"
            Write-Info "- Command Center: http://localhost:3015"
            Write-Info "- Dashboard: http://localhost:3005"
            Write-Info "- Smart Form: http://localhost:3006"
            Write-Info "- Discord Bot: Running (no web interface)"
        }
    } else {
        if ($apps.ContainsKey($App)) {
            if (Start-App -AppName $App -Config $apps[$App]) {
                Write-Success "`n✅ $($apps[$App].name) started successfully!"
                if ($null -ne $apps[$App].port) {
                    Write-Info "URL: http://localhost:$($apps[$App].port)"
                }
            }
        } else {
            Write-Error "Unknown app: $App"
            Write-Info "Available apps: $($apps.Keys -join ', ')"
        }
    }
} catch {
    Write-Error "An error occurred: $_"
} finally {
    # Return to original directory
    Set-Location $basePath
}

# Keep window open if running directly
if ($Debug) {
    Write-Info "`nPress any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
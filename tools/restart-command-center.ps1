# Stop any existing processes on port 3002
Write-Host "Stopping existing processes on port 3002..." -ForegroundColor Yellow
Get-NetTCPConnection -LocalPort 3002 -EA SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -EA SilentlyContinue }

# Navigate to Command Center directory
$commandCenterPath = "C:\Users\griff\Desktop\Unit Talk Production v3\unit-talk-command-center"
Set-Location $commandCenterPath

# Install missing dependencies
Write-Host "Installing missing dependencies..." -ForegroundColor Yellow
npm install

# Start the development server
Write-Host "Starting Command Center on http://localhost:3002" -ForegroundColor Green
npm run dev
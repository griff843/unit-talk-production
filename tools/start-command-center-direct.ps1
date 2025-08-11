# Navigate to Command Center directory
$commandCenterPath = "C:\Users\griff\Desktop\Unit Talk Production v3\unit-talk-command-center"
Set-Location $commandCenterPath

# Check if dependencies are installed
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Start the development server
Write-Host "Starting Command Center on http://localhost:3002" -ForegroundColor Green
npm run dev
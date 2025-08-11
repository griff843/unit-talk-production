# Install missing dependencies for Command Center
Write-Host "Installing missing Radix UI dependencies..." -ForegroundColor Yellow

# Navigate to Command Center directory
$commandCenterPath = "C:\Users\griff\Desktop\Unit Talk Production v3\unit-talk-command-center"
Set-Location $commandCenterPath

# Install the missing dependencies
npm install @radix-ui/react-dialog @radix-ui/react-label

Write-Host "Dependencies installed successfully!" -ForegroundColor Green
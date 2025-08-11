# Install missing Radix UI tabs dependency
Write-Host "Installing @radix-ui/react-tabs..." -ForegroundColor Yellow

# Navigate to Command Center directory
$commandCenterPath = "C:\Users\griff\Desktop\Unit Talk Production v3\unit-talk-command-center"
Set-Location $commandCenterPath

# Install the tabs dependency
npm install @radix-ui/react-tabs

Write-Host "Tabs dependency installed!" -ForegroundColor Green
# Install missing Radix UI dependency
Write-Host "Installing @radix-ui/react-dropdown-menu..." -ForegroundColor Yellow

# Navigate to Command Center directory
$commandCenterPath = "C:\Users\griff\Desktop\Unit Talk Production v3\unit-talk-command-center"
Set-Location $commandCenterPath

# Install the specific missing dependency
npm install @radix-ui/react-dropdown-menu

Write-Host "Dependency installed! The development server should hot-reload automatically." -ForegroundColor Green
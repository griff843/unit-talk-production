# Generate Secure Environment Configuration
# This script creates a .env file with secure random passwords

Write-Host "🔐 Generating secure environment configuration..." -ForegroundColor Green

# Check if .env already exists
if (Test-Path .env) {
    Write-Host "⚠️  .env file already exists. Creating backup..." -ForegroundColor Yellow
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    Copy-Item .env ".env.backup.$timestamp"
}

# Function to generate secure password
function Generate-Password {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes) -replace '[=+/]', '' | Select-Object -First 25
}

# Copy from example
Copy-Item .env.example .env

# Generate secure passwords
$POSTGRES_PASSWORD = Generate-Password
$POSTGRES_REPLICA_PASSWORD = Generate-Password
$TEMPORAL_POSTGRES_PASSWORD = Generate-Password

# Replace placeholders with secure passwords
(Get-Content .env) -replace 'your-secure-postgres-password', $POSTGRES_PASSWORD | Set-Content .env
(Get-Content .env) -replace 'your-secure-replica-password', $POSTGRES_REPLICA_PASSWORD | Set-Content .env
(Get-Content .env) -replace 'your-secure-temporal-password', $TEMPORAL_POSTGRES_PASSWORD | Set-Content .env

Write-Host "✅ Secure environment configuration generated!" -ForegroundColor Green
Write-Host ""
Write-Host "🔑 Generated passwords:" -ForegroundColor Cyan
Write-Host "   - PostgreSQL: $POSTGRES_PASSWORD" -ForegroundColor White
Write-Host "   - Replica: $POSTGRES_REPLICA_PASSWORD" -ForegroundColor White
Write-Host "   - Temporal: $TEMPORAL_POSTGRES_PASSWORD" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  IMPORTANT: Store these passwords securely!" -ForegroundColor Yellow
Write-Host "   - Add .env to .gitignore (should already be there)" -ForegroundColor White
Write-Host "   - Use a password manager for production" -ForegroundColor White
Write-Host "   - Never commit .env to version control" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Review .env file and update other configuration values" -ForegroundColor White
Write-Host "   2. Run: ./dev.sh restart" -ForegroundColor White
Write-Host "   3. Verify services start with new credentials" -ForegroundColor White

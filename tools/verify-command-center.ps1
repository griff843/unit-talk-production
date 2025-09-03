# Unit Talk Command Center - Verification Script
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Unit Talk Command Center - Verification" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$targetUrl = "http://localhost:3002"
$maxRetries = 10
$retryDelay = 3

Write-Host "Checking if Command Center is running..." -ForegroundColor Blue
Write-Host "Target URL: $targetUrl" -ForegroundColor Gray
Write-Host ""

for ($i = 1; $i -le $maxRetries; $i++) {
    Write-Host "Attempt $i of $maxRetries..." -ForegroundColor Yellow
    
    try {
        # Try to connect to the server
        $response = Invoke-WebRequest -Uri $targetUrl -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        
        if ($response.StatusCode -eq 200) {
            Write-Host ""
            Write-Host "============================================" -ForegroundColor Green
            Write-Host "✅ SUCCESS: Command Center is running!" -ForegroundColor Green
            Write-Host "============================================" -ForegroundColor Green
            Write-Host "🌐 URL: $targetUrl" -ForegroundColor Green
            Write-Host "📊 Status: $($response.StatusCode) $($response.StatusDescription)" -ForegroundColor Green
            Write-Host "📄 Content Length: $($response.Content.Length) bytes" -ForegroundColor Green
            Write-Host ""
            Write-Host "You can now:" -ForegroundColor White
            Write-Host "• Open $targetUrl in your browser" -ForegroundColor White
            Write-Host "• Run Playwright tests against the Command Center" -ForegroundColor White
            Write-Host "• Verify UI/UX components are working" -ForegroundColor White
            Write-Host ""
            exit 0
        }
    } catch {
        $errorMsg = $_.Exception.Message
        if ($errorMsg -match "ConnectFailure" -or $errorMsg -match "refused") {
            Write-Host "Server not responding yet..." -ForegroundColor DarkYellow
        } else {
            Write-Host "Connection error: $errorMsg" -ForegroundColor Red
        }
    }
    
    if ($i -lt $maxRetries) {
        Write-Host "Waiting $retryDelay seconds before next attempt..." -ForegroundColor Gray
        Start-Sleep -Seconds $retryDelay
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Red
Write-Host "❌ TIMEOUT: Command Center not accessible" -ForegroundColor Red
Write-Host "============================================" -ForegroundColor Red
Write-Host "After $maxRetries attempts, could not connect to $targetUrl" -ForegroundColor Red
Write-Host ""
Write-Host "Troubleshooting steps:" -ForegroundColor Yellow
Write-Host "1. Check if the server started without errors" -ForegroundColor Yellow
Write-Host "2. Verify port 3002 is not blocked by firewall" -ForegroundColor Yellow
Write-Host "3. Check if another process is using port 3002" -ForegroundColor Yellow
Write-Host "4. Review server logs for error messages" -ForegroundColor Yellow
Write-Host ""

# Additional port check
Write-Host "Checking port 3002 status..." -ForegroundColor Blue
try {
    $portCheck = Test-NetConnection -ComputerName localhost -Port 3002 -WarningAction SilentlyContinue
    if ($portCheck.TcpTestSucceeded) {
        Write-Host "✅ Port 3002 is open and accepting connections" -ForegroundColor Green
        Write-Host "The server may be starting up or having issues" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Port 3002 is not accepting connections" -ForegroundColor Red
        Write-Host "The server may not be running" -ForegroundColor Red
    }
} catch {
    Write-Host "Could not check port status" -ForegroundColor Yellow
}

exit 1
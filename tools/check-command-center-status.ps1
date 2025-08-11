# Check Command Center Status
Write-Host "Checking Command Center Status..." -ForegroundColor Blue
Write-Host ""

$url = "http://localhost:3002"

try {
    $response = Invoke-WebRequest -Uri $url -TimeoutSec 10 -UseBasicParsing
    Write-Host "SUCCESS: Command Center is running!" -ForegroundColor Green
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "URL: $url" -ForegroundColor Green
} catch {
    Write-Host "Command Center is not accessible at $url" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    # Check if port is listening
    try {
        $portTest = Test-NetConnection -ComputerName localhost -Port 3002 -WarningAction SilentlyContinue
        if ($portTest.TcpTestSucceeded) {
            Write-Host "Port 3002 is open but not responding to HTTP requests" -ForegroundColor Yellow
        } else {
            Write-Host "Port 3002 is not open" -ForegroundColor Red
        }
    } catch {
        Write-Host "Could not test port 3002" -ForegroundColor Yellow
    }
}
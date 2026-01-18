#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

Write-Host "Checking preflight endpoint..." -ForegroundColor Cyan

$response = Invoke-WebRequest -Uri "http://localhost:3010/api/domain/picks/preflight" -UseBasicParsing
Write-Host "Response:" -ForegroundColor Yellow
Write-Host $response.Content

$data = $response.Content | ConvertFrom-Json
Write-Host ""
Write-Host "Parsed data:" -ForegroundColor Yellow
Write-Host "  ok: $($data.ok)"
Write-Host "  driver: $($data.driver)"
Write-Host "  publishMode: $($data.publishMode)"
Write-Host "  reason: $($data.reason)"
Write-Host "  error: $($data.error)"


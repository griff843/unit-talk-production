# Wait for Phase 5 run to complete
$ErrorActionPreference = "Stop"
$GH = "C:\Program Files (x86)\GitHub CLI\gh.exe"
$RUN_ID = "21108160456"

while ($true) {
    $runJson = & $GH run list --workflow=phase5-prod-validation.yml --limit 1 --json databaseId,conclusion,status | ConvertFrom-Json

    if ($runJson.status -eq "completed") {
        Write-Host "Run completed with conclusion: $($runJson.conclusion)"
        exit 0
    }

    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Still running... (status: $($runJson.status))"
    Start-Sleep -Seconds 30
}

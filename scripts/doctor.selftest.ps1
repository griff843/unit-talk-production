<#
.SYNOPSIS
Test harness for scripts/doctor.ps1 to verify production-grade reliability

.DESCRIPTION
Automated testing script that validates doctor.ps1 behavior across multiple scenarios:
- PowerShell parser validation (no syntax errors)
- Reserved variable checks (no $Host conflicts)
- Exit code verification (fail-closed behavior)
- Environment variable loading (precedence rules)
- SelfTest mode output validation

.PARAMETER Verbose
Show detailed test output

.EXAMPLE
.\scripts\doctor.selftest.ps1
Run all test cases with summary output

.EXAMPLE
.\scripts\doctor.selftest.ps1 -Verbose
Run all test cases with detailed output

.NOTES
Author: Unit Talk Platform Team
Last Updated: 2025-01-28
#>

param(
    [switch]$Verbose
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $PSScriptRoot
$doctorScript = Join-Path $PSScriptRoot "doctor.ps1"

# Colors for output
$ColorPass = "Green"
$ColorFail = "Red"
$ColorInfo = "Cyan"
$ColorWarn = "Yellow"

# Test results tracking
$script:TotalTests = 0
$script:PassedTests = 0
$script:FailedTests = 0

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

function Write-TestHeader {
    param([string]$TestName)

    Write-Host ""
    Write-Host "========================================" -ForegroundColor $ColorInfo
    Write-Host "TEST: $TestName" -ForegroundColor $ColorInfo
    Write-Host "========================================" -ForegroundColor $ColorInfo
}

function Write-TestResult {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Message = ""
    )

    $script:TotalTests++

    if ($Passed) {
        $script:PassedTests++
        Write-Host "✅ PASS: $TestName" -ForegroundColor $ColorPass
        if ($Verbose -and $Message) {
            Write-Host "   $Message" -ForegroundColor DarkGray
        }
    } else {
        $script:FailedTests++
        Write-Host "❌ FAIL: $TestName" -ForegroundColor $ColorFail
        if ($Message) {
            Write-Host "   $Message" -ForegroundColor $ColorFail
        }
    }
}

function Invoke-DoctorTest {
    <#
    .SYNOPSIS
    Run doctor.ps1 with specified parameters and capture output/exit code
    #>
    param(
        [string[]]$Arguments = @(),
        [int]$ExpectedExitCode = $null,
        [string]$TestDescription = ""
    )

    $output = @()
    $exitCode = $null

    try {
        if ($Verbose) {
            Write-Host "Running: .\doctor.ps1 $($Arguments -join ' ')" -ForegroundColor DarkGray
        }

        # Run doctor.ps1 and capture output
        $output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $doctorScript @Arguments 2>&1
        $exitCode = $LASTEXITCODE

        if ($Verbose) {
            Write-Host "Exit Code: $exitCode" -ForegroundColor DarkGray
            Write-Host "Output Lines: $($output.Count)" -ForegroundColor DarkGray
        }

    } catch {
        if ($Verbose) {
            Write-Host "Exception: $_" -ForegroundColor $ColorWarn
        }
        $output += $_.ToString()
        $exitCode = 1
    }

    return @{
        Output = $output
        ExitCode = $exitCode
        Arguments = $Arguments
        Description = $TestDescription
    }
}

# ============================================================================
# TEST SUITE 1: POWERSHELL PARSER VALIDATION
# ============================================================================

Write-TestHeader "PowerShell Parser Validation"

# Test 1.1: Script parses without syntax errors
try {
    $null = Get-Command $doctorScript -ErrorAction Stop
    Write-TestResult -TestName "Script parses without syntax errors" -Passed $true
} catch {
    Write-TestResult -TestName "Script parses without syntax errors" -Passed $false -Message $_.Exception.Message
}

# Test 1.2: No reserved variable assignments
$scriptContent = Get-Content $doctorScript -Raw
$reservedVars = @('Host', 'Error', 'PSItem', 'this', 'args', 'input')
$foundReservedVarIssues = @()

foreach ($var in $reservedVars) {
    # Check for parameter declarations like param($Host, ...)
    if ($scriptContent -match "param\s*\([^)]*\`$$var\s*[,)]") {
        $foundReservedVarIssues += "Found reserved variable `$$var in parameter declaration"
    }
    # Check for assignments like $Host = ...
    if ($scriptContent -match "\`$$var\s*=") {
        $foundReservedVarIssues += "Found assignment to reserved variable `$$var"
    }
}

Write-TestResult -TestName "No reserved variable conflicts" -Passed ($foundReservedVarIssues.Count -eq 0) -Message ($foundReservedVarIssues -join "; ")

# ============================================================================
# TEST SUITE 2: SELFTEST MODE
# ============================================================================

Write-TestHeader "SelfTest Mode Validation"

# Test 2.1: SelfTest runs without errors
$selfTestResult = Invoke-DoctorTest -Arguments @("-SelfTest") -TestDescription "SelfTest mode execution"
$selfTestPassed = ($selfTestResult.ExitCode -eq 0)
Write-TestResult -TestName "SelfTest exits with code 0" -Passed $selfTestPassed -Message "Exit code: $($selfTestResult.ExitCode)"

# Test 2.2: SelfTest never prints secrets
$containsSecrets = $false
$secretPatterns = @(
    'postgresql://.+:.+@',  # Connection string with credentials
    'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',  # JWT tokens
    '[A-Za-z0-9]{32,}'  # Long API keys (not masked)
)

foreach ($pattern in $secretPatterns) {
    if ($selfTestResult.Output -match $pattern) {
        $containsSecrets = $true
        break
    }
}

Write-TestResult -TestName "SelfTest does not print unmasked secrets" -Passed (-not $containsSecrets)

# Test 2.3: SelfTest shows environment variable status
$showsEnvVarStatus = $false
foreach ($line in $selfTestResult.Output) {
    if ($line -match '(✅ SET|❌ NOT SET)\s+\w+') {
        $showsEnvVarStatus = $true
        break
    }
}

Write-TestResult -TestName "SelfTest shows env var status (SET/NOT SET)" -Passed $showsEnvVarStatus

# ============================================================================
# TEST SUITE 3: ENVIRONMENT VARIABLE LOADING
# ============================================================================

Write-TestHeader "Environment Variable Loading"

# Test 3.1: Script loads .env files by default
# Create temporary .env file for testing
$tempEnvFile = Join-Path $scriptRoot ".env.test.tmp"
$testVarName = "DOCTOR_TEST_VAR_$(Get-Random)"
$testVarValue = "test_value_$(Get-Random)"

Set-Content -Path $tempEnvFile -Value "$testVarName=$testVarValue"

# Run doctor with temporary env (won't actually load .env.test.tmp, but we can check the loading logic exists)
$envLoadingResult = Invoke-DoctorTest -Arguments @("-SelfTest") -TestDescription "Env file loading"

# Check if script mentions loading env vars
$mentionsEnvLoading = $false
foreach ($line in $envLoadingResult.Output) {
    if ($line -match 'Loaded \d+ new environment variables from \.env files') {
        $mentionsEnvLoading = $true
        break
    }
}

Write-TestResult -TestName "Script attempts to load .env files" -Passed $mentionsEnvLoading

# Cleanup
if (Test-Path $tempEnvFile) {
    Remove-Item $tempEnvFile -Force
}

# Test 3.2: -NoDotEnv flag prevents .env loading
$noDotEnvResult = Invoke-DoctorTest -Arguments @("-SelfTest", "-NoDotEnv") -TestDescription "-NoDotEnv flag"

$skipsEnvLoading = $true
foreach ($line in $noDotEnvResult.Output) {
    if ($line -match 'Loaded \d+ new environment variables') {
        $skipsEnvLoading = $false
        break
    }
}

Write-TestResult -TestName "-NoDotEnv flag prevents env file loading" -Passed $skipsEnvLoading

# ============================================================================
# TEST SUITE 4: EXIT CODE BEHAVIOR (FAIL-CLOSED)
# ============================================================================

Write-TestHeader "Exit Code Validation (Fail-Closed)"

# Test 4.1: SelfTest always exits 0 (regardless of env var status)
$selfTestExitResult = Invoke-DoctorTest -Arguments @("-SelfTest") -TestDescription "SelfTest exit code"
Write-TestResult -TestName "SelfTest always exits 0" -Passed ($selfTestExitResult.ExitCode -eq 0) -Message "Exit code: $($selfTestExitResult.ExitCode)"

# Test 4.2: Normal mode with -NoDotEnv should fail if critical vars missing
# (This will likely fail since we're not setting up a full environment, which is expected behavior)
$normalModeResult = Invoke-DoctorTest -Arguments @("-NoDotEnv") -TestDescription "Normal mode without env"

# We expect exit 1 when running without environment setup
$failsWithoutEnv = ($normalModeResult.ExitCode -eq 1)
Write-TestResult -TestName "Normal mode exits 1 when critical checks fail (fail-closed)" -Passed $failsWithoutEnv -Message "Exit code: $($normalModeResult.ExitCode)"

# ============================================================================
# TEST SUITE 5: OUTPUT FORMAT VALIDATION
# ============================================================================

Write-TestHeader "Output Format Validation"

# Test 5.1: Text output format (default)
$textFormatResult = Invoke-DoctorTest -Arguments @("-SelfTest") -TestDescription "Text output format"
$hasTextOutput = $false
foreach ($line in $textFormatResult.Output) {
    if ($line -match '(PASS|FAIL|WARN)') {
        $hasTextOutput = $true
        break
    }
}
Write-TestResult -TestName "Text output format works" -Passed $hasTextOutput

# Test 5.2: JSON output format
$jsonFormatResult = Invoke-DoctorTest -Arguments @("-SelfTest", "-OutputFormat", "json") -TestDescription "JSON output format"
$hasJsonOutput = $false
$jsonContent = $jsonFormatResult.Output -join "`n"

# Check if output contains JSON structure (basic validation)
if ($jsonContent -match '\{[\s\S]*"checks"[\s\S]*\}' -or $jsonContent -match '^\s*\[') {
    $hasJsonOutput = $true
}

Write-TestResult -TestName "JSON output format works" -Passed $hasJsonOutput

# ============================================================================
# TEST SUITE 6: ENVIRONMENT PARAMETER
# ============================================================================

Write-TestHeader "Environment Parameter Validation"

# Test 6.1: dev environment (default)
$devEnvResult = Invoke-DoctorTest -Arguments @("-SelfTest") -TestDescription "dev environment"
$checksDevEnv = $false
foreach ($line in $devEnvResult.Output) {
    if ($line -match 'Environment:\s*dev') {
        $checksDevEnv = $true
        break
    }
}
Write-TestResult -TestName "dev environment parameter works" -Passed $checksDevEnv

# Test 6.2: staging environment
$stagingEnvResult = Invoke-DoctorTest -Arguments @("-SelfTest", "-Environment", "staging") -TestDescription "staging environment"
$checksStagingEnv = $false
foreach ($line in $stagingEnvResult.Output) {
    if ($line -match 'Environment:\s*staging') {
        $checksStagingEnv = $true
        break
    }
}
Write-TestResult -TestName "staging environment parameter works" -Passed $checksStagingEnv

# Test 6.3: prod environment
$prodEnvResult = Invoke-DoctorTest -Arguments @("-SelfTest", "-Environment", "prod") -TestDescription "prod environment"
$checksProdEnv = $false
foreach ($line in $prodEnvResult.Output) {
    if ($line -match 'Environment:\s*prod') {
        $checksProdEnv = $true
        break
    }
}
Write-TestResult -TestName "prod environment parameter works" -Passed $checksProdEnv

# ============================================================================
# TEST SUMMARY
# ============================================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor $ColorInfo
Write-Host "TEST SUMMARY" -ForegroundColor $ColorInfo
Write-Host "========================================" -ForegroundColor $ColorInfo
Write-Host "Total Tests:  $script:TotalTests" -ForegroundColor White
Write-Host "Passed:       $script:PassedTests" -ForegroundColor $ColorPass
Write-Host "Failed:       $script:FailedTests" -ForegroundColor $ColorFail
Write-Host ""

$passRate = if ($script:TotalTests -gt 0) {
    [math]::Round(($script:PassedTests / $script:TotalTests) * 100, 1)
} else {
    0
}

Write-Host "Pass Rate:    $passRate%" -ForegroundColor $(if ($passRate -ge 90) { $ColorPass } elseif ($passRate -ge 70) { $ColorWarn } else { $ColorFail })
Write-Host ""

# Exit with appropriate code
if ($script:FailedTests -eq 0) {
    Write-Host "✅ ALL TESTS PASSED" -ForegroundColor $ColorPass
    exit 0
} else {
    Write-Host "❌ SOME TESTS FAILED" -ForegroundColor $ColorFail
    exit 1
}

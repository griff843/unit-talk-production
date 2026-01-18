# doctor.ps1
# Purpose: Unified diagnostic script for Unit Talk production infrastructure
# Usage: .\scripts\doctor.ps1 [-Environment dev|staging|prod] [-OutputFormat text|json] [-SelfTest] [-NoDotEnv]

param(
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Environment = 'dev',
    [ValidateSet('text', 'json')]
    [string]$OutputFormat = 'text',
    [switch]$Verbose,
    [switch]$SelfTest,
    [switch]$NoDotEnv
)

$ErrorActionPreference = "Stop"
$WarningPreference = "SilentlyContinue"

# ============================================================================
# CONFIGURATION
# ============================================================================

$script:TotalChecks = 0
$script:PassedChecks = 0
$script:FailedChecks = 0
$script:WarnChecks = 0
$script:Results = @()

# Reserved PowerShell variable names to avoid
$script:ReservedVariables = @('Host', 'Error', 'PSItem', 'this', 'args', 'input', 'MyInvocation', 'PSScriptRoot', 'PSCommandPath')

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

function Get-EnvVar {
    <#
    .SYNOPSIS
    Safely get environment variable value without throwing if missing

    .PARAMETER Name
    Name of the environment variable

    .RETURNS
    String value if exists, $null if missing
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Name
    )

    try {
        return [System.Environment]::GetEnvironmentVariable($Name)
    } catch {
        return $null
    }
}

function Set-EnvVar {
    <#
    .SYNOPSIS
    Safely set environment variable for current process only

    .PARAMETER Name
    Name of the environment variable

    .PARAMETER Value
    Value to set
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Name,
        [Parameter(Mandatory=$true)]
        [string]$Value
    )

    try {
        [System.Environment]::SetEnvironmentVariable($Name, $Value, [System.EnvironmentVariableTarget]::Process)
    } catch {
        Write-Warning "Failed to set environment variable $Name"
    }
}

function Import-DotEnvFiles {
    <#
    .SYNOPSIS
    Load environment variables from .env and .env.local files

    .DESCRIPTION
    Loads env vars with precedence:
    1. Existing process env vars (highest - not overwritten)
    2. .env.local
    3. .env (lowest)

    .PARAMETER RepoRoot
    Root directory of the repository (defaults to script parent directory)
    #>
    param(
        [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot)
    )

    $envFiles = @(
        (Join-Path $RepoRoot ".env"),
        (Join-Path $RepoRoot ".env.local")
    )

    $loadedVars = @{}

    # Process .env first (lowest priority), then .env.local (higher priority)
    foreach ($envFile in $envFiles) {
        if (Test-Path $envFile) {
            if ($Verbose) {
                Write-Host "  Loading env vars from: $envFile" -ForegroundColor DarkGray
            }

            $content = Get-Content $envFile -Raw -ErrorAction SilentlyContinue
            if ($content) {
                $lines = $content -split "`n"

                foreach ($line in $lines) {
                    # Trim whitespace
                    $line = $line.Trim()

                    # Skip comments and blank lines
                    if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) {
                        continue
                    }

                    # Parse KEY=VALUE
                    # Support quoted values and values containing '='
                    if ($line -match '^([^=]+)=(.*)$') {
                        $key = $matches[1].Trim()
                        $value = $matches[2].Trim()

                        # Remove surrounding quotes if present
                        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
                            ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                            $value = $value.Substring(1, $value.Length - 2)
                        }

                        # Check for reserved variable names
                        if ($script:ReservedVariables -contains $key) {
                            Write-Warning "Skipping reserved variable name: $key"
                            continue
                        }

                        # Store in temporary hash (will be set after all files processed)
                        $loadedVars[$key] = $value
                    }
                }
            }
        }
    }

    # Now set env vars, but only if not already present in process env
    $setCount = 0
    foreach ($kvp in $loadedVars.GetEnumerator()) {
        $existing = Get-EnvVar $kvp.Key
        if (-not $existing) {
            Set-EnvVar -Name $kvp.Key -Value $kvp.Value
            $setCount++
            if ($Verbose) {
                $maskedValue = if ($kvp.Key -like "*KEY*" -or $kvp.Key -like "*SECRET*" -or $kvp.Key -like "*PASSWORD*" -or $kvp.Key -like "*TOKEN*") {
                    Mask-Secret -Value $kvp.Value -Type 'key'
                } elseif ($kvp.Key -like "*URL*" -or $kvp.Key -like "*DATABASE*") {
                    Mask-Secret -Value $kvp.Value -Type 'connection_string'
                } else {
                    $kvp.Value
                }
                Write-Host "    Set $($kvp.Key) = $maskedValue" -ForegroundColor DarkGray
            }
        }
    }

    if ($Verbose) {
        Write-Host "  Loaded $setCount new environment variables" -ForegroundColor DarkGray
    }

    return $setCount
}

function Mask-Secret {
    <#
    .SYNOPSIS
    Mask sensitive values for logging

    .PARAMETER Value
    Value to mask

    .PARAMETER Type
    Type of secret (url, token, key, connection_string)
    #>
    param(
        [string]$Value,
        [ValidateSet('url', 'token', 'key', 'connection_string')]
        [string]$Type = 'token'
    )

    if ([string]::IsNullOrEmpty($Value)) {
        return "(not set)"
    }

    switch ($Type) {
        'url' {
            # Mask URL but show protocol and first part
            return $Value -replace '(https?://[^.]+).*', '$1.***'
        }
        'token' {
            # Show first 4 and last 4 characters
            if ($Value.Length -le 8) {
                return "****"
            }
            return $Value.Substring(0, 4) + "****" + $Value.Substring($Value.Length - 4)
        }
        'key' {
            # Show first 8 characters only
            if ($Value.Length -le 8) {
                return "****"
            }
            return $Value.Substring(0, 8) + "****"
        }
        'connection_string' {
            # Mask password and user in connection strings
            return $Value -replace '(postgresql://[^:]+:)[^@]+(@)', '$1****$2' `
                         -replace '(password=)[^;]+', '$1****' `
                         -replace '(://[^:]+:)[^@]+', '$1****'
        }
        default {
            return "****"
        }
    }
}

function Write-CheckHeader {
    param([string]$Message)
    if ($OutputFormat -eq 'text') {
        Write-Host "`n$Message" -ForegroundColor Cyan
        Write-Host ("=" * 80) -ForegroundColor Cyan
    }
}

function Write-CheckResult {
    param(
        [string]$Name,
        [ValidateSet('PASS', 'FAIL', 'WARN')]
        [string]$Status,
        [string]$Message,
        [hashtable]$Data = @{}
    )

    $script:TotalChecks++

    switch ($Status) {
        'PASS' { $script:PassedChecks++; $Color = 'Green'; $Icon = '✅' }
        'FAIL' { $script:FailedChecks++; $Color = 'Red'; $Icon = '❌' }
        'WARN' { $script:WarnChecks++; $Color = 'Yellow'; $Icon = '⚠️ ' }
    }

    $result = @{
        name = $Name
        status = $Status
        message = $Message
        data = $Data
        timestamp = (Get-Date).ToString('o')
    }

    $script:Results += $result

    if ($OutputFormat -eq 'text') {
        Write-Host "$Icon $Name" -ForegroundColor $Color -NoNewline
        Write-Host " - $Message" -ForegroundColor White
        if ($Verbose -and $Data.Count -gt 0) {
            $Data.GetEnumerator() | ForEach-Object {
                Write-Host "    $($_.Key): $($_.Value)" -ForegroundColor DarkGray
            }
        }
    }
}

function Test-TcpPort {
    <#
    .SYNOPSIS
    Test if a TCP port is accessible

    .PARAMETER TargetHost
    Hostname or IP address to test (renamed from Host to avoid PowerShell reserved variable)

    .PARAMETER Port
    Port number to test

    .PARAMETER TimeoutMs
    Timeout in milliseconds
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$TargetHost,
        [Parameter(Mandatory=$true)]
        [int]$Port,
        [int]$TimeoutMs = 3000
    )

    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $asyncResult = $tcpClient.BeginConnect($TargetHost, $Port, $null, $null)
        $wait = $asyncResult.AsyncWaitHandle.WaitOne($TimeoutMs, $false)

        if ($wait) {
            $tcpClient.EndConnect($asyncResult)
            $tcpClient.Close()
            return $true
        } else {
            $tcpClient.Close()
            return $false
        }
    } catch {
        return $false
    }
}

# ============================================================================
# CONFIGURATION - ENVIRONMENT URLS
# ============================================================================

# Command Center URL based on environment (defined after helper functions to avoid ordering issues)
$CommandCenterUrls = @{
    dev = "http://localhost:3015"
    staging = Get-EnvVar "COMMAND_CENTER_URL_STAGING"
    prod = Get-EnvVar "COMMAND_CENTER_URL_PROD"
}

# ============================================================================
# CHECK 1: Local PostgreSQL Connectivity
# ============================================================================

function Test-LocalPostgres {
    Write-CheckHeader "1. Local PostgreSQL Connectivity"

    try {
        # Check if Docker is running
        $dockerRunning = docker ps 2>&1 | Select-String "CONTAINER ID"

        if ($dockerRunning) {
            Write-CheckResult -Name "Docker Status" -Status "PASS" -Message "Docker is running"

            # Check if postgres container is running
            $postgresContainer = docker ps --filter "name=postgres" --format "{{.Names}}"

            if ($postgresContainer) {
                Write-CheckResult -Name "PostgreSQL Container" -Status "PASS" -Message "Container '$postgresContainer' is running"

                # Test connection
                $dbUrl = Get-EnvVar "DATABASE_URL"

                if ($dbUrl) {
                    $maskedUrl = Mask-Secret -Value $dbUrl -Type 'connection_string'
                    Write-CheckResult -Name "DATABASE_URL" -Status "PASS" -Message "Environment variable set" -Data @{ url = $maskedUrl }

                    # Try to connect using psql (if available)
                    try {
                        $testQuery = "SELECT 1"
                        docker exec $postgresContainer psql "$dbUrl" -c "$testQuery" 2>&1 | Out-Null
                        Write-CheckResult -Name "PostgreSQL Connection" -Status "PASS" -Message "Successfully connected to local database"
                    } catch {
                        Write-CheckResult -Name "PostgreSQL Connection" -Status "WARN" -Message "Could not execute test query"
                    }
                } else {
                    Write-CheckResult -Name "DATABASE_URL" -Status "WARN" -Message "Environment variable not set"
                }
            } else {
                Write-CheckResult -Name "PostgreSQL Container" -Status "FAIL" -Message "No postgres container found running"
            }
        } else {
            Write-CheckResult -Name "Docker Status" -Status "WARN" -Message "Docker is not running or not installed"
        }

        # Check if PostgreSQL port is accessible
        $pgPortOpen = Test-TcpPort -TargetHost "localhost" -Port 5432 -TimeoutMs 2000

        if ($pgPortOpen) {
            Write-CheckResult -Name "PostgreSQL Port" -Status "PASS" -Message "Port 5432 is accessible" -Data @{ port = 5432 }
        } else {
            Write-CheckResult -Name "PostgreSQL Port" -Status "WARN" -Message "Port 5432 is not accessible (may be using Docker internal networking)"
        }

    } catch {
        Write-CheckResult -Name "Local PostgreSQL" -Status "FAIL" -Message "Exception: $_"
    }
}

# ============================================================================
# CHECK 2: Supabase Connectivity (Read-Only)
# ============================================================================

function Test-SupabaseConnectivity {
    Write-CheckHeader "2. Supabase Connectivity ($Environment)"

    try {
        $envUpper = $Environment.ToUpper()

        # Check for required environment variables using safe helper
        $supabaseUrl = Get-EnvVar "SUPABASE_URL_$envUpper"
        $serviceRoleKey = Get-EnvVar "SUPABASE_SERVICE_ROLE_KEY_$envUpper"
        $readonlyDbUrl = Get-EnvVar "SUPABASE_READONLY_DATABASE_URL_$envUpper"

        if ($supabaseUrl) {
            $maskedUrl = Mask-Secret -Value $supabaseUrl -Type 'url'
            Write-CheckResult -Name "SUPABASE_URL_$envUpper" -Status "PASS" -Message "Environment variable set" -Data @{ url = $maskedUrl }
        } else {
            Write-CheckResult -Name "SUPABASE_URL_$envUpper" -Status "FAIL" -Message "Environment variable not set"
            return
        }

        if ($serviceRoleKey) {
            $maskedKey = Mask-Secret -Value $serviceRoleKey -Type 'key'
            Write-CheckResult -Name "SUPABASE_SERVICE_ROLE_KEY_$envUpper" -Status "PASS" -Message "Environment variable set" -Data @{ key = $maskedKey }
        } else {
            Write-CheckResult -Name "SUPABASE_SERVICE_ROLE_KEY_$envUpper" -Status "WARN" -Message "Environment variable not set (may use alternate auth)"
        }

        # Test Supabase API connectivity with short timeout
        try {
            $healthUrl = "$supabaseUrl/rest/v1/"
            $response = Invoke-WebRequest -Uri $healthUrl -Method GET -Headers @{
                'apikey' = $serviceRoleKey
            } -TimeoutSec 5 -ErrorAction Stop

            Write-CheckResult -Name "Supabase API" -Status "PASS" -Message "API is accessible" -Data @{ status_code = $response.StatusCode }
        } catch {
            Write-CheckResult -Name "Supabase API" -Status "FAIL" -Message "API request failed: $($_.Exception.Message)"
        }

        # Test read-only database connection using supabase-query.ts
        if ($readonlyDbUrl) {
            Write-CheckResult -Name "Read-Only DB URL" -Status "PASS" -Message "Environment variable set"

            try {
                # Use the safe query runner to test connection
                $testQuery = "SELECT 1 as test"
                $queryResult = npx tsx scripts\ops\supabase-query.ts --env $Environment "$testQuery" 2>&1

                if ($LASTEXITCODE -eq 0) {
                    Write-CheckResult -Name "Read-Only DB Connection" -Status "PASS" -Message "Successfully executed test query"
                } else {
                    Write-CheckResult -Name "Read-Only DB Connection" -Status "WARN" -Message "Test query failed"
                }
            } catch {
                Write-CheckResult -Name "Read-Only DB Connection" -Status "WARN" -Message "Test query failed: $_"
            }
        } else {
            Write-CheckResult -Name "Read-Only DB URL" -Status "WARN" -Message "SUPABASE_READONLY_DATABASE_URL_$envUpper not set"
        }

        # Check core tables exist using safe query
        try {
            $tablesQuery = @"
SELECT COUNT(*) as count FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('picks', 'pick_publish', 'users', 'raw_props', 'agent_health', 'events')
"@

            $tablesResult = npx tsx scripts\ops\supabase-query.ts --env $Environment --output json "$tablesQuery" 2>&1
            if ($LASTEXITCODE -eq 0) {
                $tablesCount = ($tablesResult | ConvertFrom-Json)[0].count

                if ($tablesCount -eq 6) {
                    Write-CheckResult -Name "Core Tables" -Status "PASS" -Message "All 6 core tables exist" -Data @{ count = $tablesCount }
                } elseif ($tablesCount -gt 0) {
                    Write-CheckResult -Name "Core Tables" -Status "WARN" -Message "Only $tablesCount/6 core tables found"
                } else {
                    Write-CheckResult -Name "Core Tables" -Status "FAIL" -Message "No core tables found"
                }
            } else {
                Write-CheckResult -Name "Core Tables" -Status "WARN" -Message "Could not verify tables (query runner failed)"
            }
        } catch {
            Write-CheckResult -Name "Core Tables" -Status "WARN" -Message "Could not verify tables: $_"
        }

    } catch {
        Write-CheckResult -Name "Supabase Connectivity" -Status "FAIL" -Message "Exception: $_"
    }
}

# ============================================================================
# CHECK 3: Command Center API Health
# ============================================================================

function Test-CommandCenterHealth {
    Write-CheckHeader "3. Command Center API Health"

    # Determine Command Center URL with fallback detection
    $envUpper = $Environment.ToUpper()
    $configuredUrl = Get-EnvVar "COMMAND_CENTER_URL_$envUpper"

    # For dev, try to detect running server on common ports
    if ($Environment -eq 'dev' -and -not $configuredUrl) {
        $commonPorts = @(3015, 3017, 3000)
        foreach ($portToTest in $commonPorts) {
            $portOpen = Test-TcpPort -TargetHost "localhost" -Port $portToTest -TimeoutMs 1000
            if ($portOpen) {
                $configuredUrl = "http://localhost:$portToTest"
                Write-CheckResult -Name "Command Center URL" -Status "PASS" -Message "Auto-detected on port $portToTest" -Data @{ url = $configuredUrl }
                break
            }
        }

        if (-not $configuredUrl) {
            Write-CheckResult -Name "Command Center URL" -Status "FAIL" -Message "Not configured and could not auto-detect on ports: $($commonPorts -join ', ')"
            return
        }
    } elseif ($configuredUrl) {
        Write-CheckResult -Name "Command Center URL" -Status "PASS" -Message "URL configured" -Data @{ url = $configuredUrl }
    } else {
        Write-CheckResult -Name "Command Center URL" -Status "FAIL" -Message "COMMAND_CENTER_URL_$envUpper not set and auto-detection only works for dev"
        return
    }

    # Check if Command Center is accessible with short timeout
    try {
        $healthUrl = "$configuredUrl/api/health"

        # Use short timeout to avoid hanging
        $response = Invoke-RestMethod -Uri $healthUrl -Method GET -TimeoutSec 5 -ErrorAction Stop

        if ($response.status -eq 'healthy') {
            Write-CheckResult -Name "/api/health" -Status "PASS" -Message "Command Center is healthy" -Data @{
                status = $response.status
                db_response_time = "$($response.services.database.responseTime)ms"
            }
        } elseif ($response.status -eq 'degraded') {
            Write-CheckResult -Name "/api/health" -Status "WARN" -Message "Command Center is degraded" -Data @{ status = $response.status }
        } else {
            Write-CheckResult -Name "/api/health" -Status "FAIL" -Message "Command Center is unhealthy" -Data @{ status = $response.status }
        }

    } catch [System.Net.WebException] {
        Write-CheckResult -Name "/api/health" -Status "FAIL" -Message "Health check failed: Connection refused or timeout (is Command Center running at $configuredUrl?)"
        return
    } catch {
        Write-CheckResult -Name "/api/health" -Status "FAIL" -Message "Health check failed: $($_.Exception.Message)"
        return
    }

    # Check SLO status endpoint
    try {
        $sloUrl = "$configuredUrl/api/slo/status"
        $sloResponse = Invoke-RestMethod -Uri $sloUrl -Method GET -TimeoutSec 5 -ErrorAction Stop

        if ($sloResponse.current_status) {
            $violationCount = ($sloResponse.violations | Measure-Object).Count
            if ($violationCount -eq 0) {
                Write-CheckResult -Name "/api/slo/status" -Status "PASS" -Message "No SLO violations" -Data @{ status = $sloResponse.current_status }
            } else {
                Write-CheckResult -Name "/api/slo/status" -Status "WARN" -Message "$violationCount SLO violation(s) detected" -Data @{ violations = $violationCount }
            }
        } else {
            Write-CheckResult -Name "/api/slo/status" -Status "WARN" -Message "SLO status endpoint returned unexpected format"
        }

    } catch {
        Write-CheckResult -Name "/api/slo/status" -Status "WARN" -Message "SLO check unavailable: $($_.Exception.Message)"
    }

    # Check autopilot report endpoint
    try {
        $autopilotUrl = "$configuredUrl/api/autopilot/report"
        $autopilotResponse = Invoke-RestMethod -Uri $autopilotUrl -Method GET -TimeoutSec 5 -ErrorAction Stop

        if ($autopilotResponse.daily_summary) {
            Write-CheckResult -Name "/api/autopilot/report" -Status "PASS" -Message "Autopilot report available" -Data @{
                total_evaluated = $autopilotResponse.daily_summary.total_evaluated
                approved = $autopilotResponse.daily_summary.approved_count
            }
        } else {
            Write-CheckResult -Name "/api/autopilot/report" -Status "WARN" -Message "No autopilot data available"
        }

    } catch [System.Net.WebException] {
        # 404 is acceptable - means no data yet
        if ($_.Exception.Response.StatusCode -eq 404) {
            Write-CheckResult -Name "/api/autopilot/report" -Status "WARN" -Message "No autopilot data available yet (404)"
        } else {
            Write-CheckResult -Name "/api/autopilot/report" -Status "WARN" -Message "Autopilot check unavailable"
        }
    } catch {
        Write-CheckResult -Name "/api/autopilot/report" -Status "WARN" -Message "Autopilot check unavailable"
    }
}

# ============================================================================
# CHECK 4: Autopilot Tables Exist
# ============================================================================

function Test-AutopilotTables {
    Write-CheckHeader "4. Autopilot Infrastructure"

    try {
        # Check autopilot_decisions table exists using to_regclass
        $tableCheckQuery = "SELECT to_regclass('public.autopilot_decisions') IS NOT NULL as exists"

        $tableResult = npx tsx scripts\ops\supabase-query.ts --env $Environment --output json "$tableCheckQuery" 2>&1

        if ($LASTEXITCODE -eq 0) {
            $tableExists = ($tableResult | ConvertFrom-Json)[0].exists

            if ($tableExists -eq $true) {
                Write-CheckResult -Name "autopilot_decisions table" -Status "PASS" -Message "Table exists"

                # Check table has data
                $countQuery = "SELECT COUNT(*) as count FROM autopilot_decisions"
                $countResult = npx tsx scripts\ops\supabase-query.ts --env $Environment --output json "$countQuery" 2>&1
                if ($LASTEXITCODE -eq 0) {
                    $recordCount = ($countResult | ConvertFrom-Json)[0].count
                    Write-CheckResult -Name "autopilot_decisions records" -Status "PASS" -Message "Table has $recordCount record(s)" -Data @{ count = $recordCount }
                }

            } else {
                Write-CheckResult -Name "autopilot_decisions table" -Status "FAIL" -Message "Table does not exist - run migrations"
            }
        } else {
            Write-CheckResult -Name "autopilot_decisions table" -Status "FAIL" -Message "Could not verify table (missing connection string or query runner failed)"
        }

    } catch {
        Write-CheckResult -Name "Autopilot Tables" -Status "FAIL" -Message "Could not verify tables: $_"
    }
}

# ============================================================================
# CHECK 5: Node.js and Dependencies
# ============================================================================

function Test-NodeDependencies {
    Write-CheckHeader "5. Node.js and Dependencies"

    try {
        # Check Node.js version
        $nodeVersion = node --version 2>&1
        if ($LASTEXITCODE -eq 0 -and $nodeVersion) {
            Write-CheckResult -Name "Node.js" -Status "PASS" -Message "Version $nodeVersion installed" -Data @{ version = $nodeVersion }
        } else {
            Write-CheckResult -Name "Node.js" -Status "FAIL" -Message "Node.js not found"
            return
        }

        # Check npm version
        $npmVersion = npm --version 2>&1
        if ($LASTEXITCODE -eq 0 -and $npmVersion) {
            Write-CheckResult -Name "npm" -Status "PASS" -Message "Version $npmVersion installed" -Data @{ version = $npmVersion }
        } else {
            Write-CheckResult -Name "npm" -Status "FAIL" -Message "npm not found"
        }

        # Check if node_modules exists
        if (Test-Path "node_modules") {
            Write-CheckResult -Name "node_modules" -Status "PASS" -Message "Dependencies installed"
        } else {
            Write-CheckResult -Name "node_modules" -Status "WARN" -Message "Dependencies not installed - run 'npm install'"
        }

        # Check if Supabase CLI is available
        try {
            $supabaseVersion = supabase --version 2>&1
            if ($LASTEXITCODE -eq 0 -and $supabaseVersion) {
                Write-CheckResult -Name "Supabase CLI" -Status "PASS" -Message "Version $supabaseVersion installed" -Data @{ version = $supabaseVersion }
            }
        } catch {
            Write-CheckResult -Name "Supabase CLI" -Status "WARN" -Message "Supabase CLI not installed (optional)"
        }

    } catch {
        Write-CheckResult -Name "Node Dependencies" -Status "FAIL" -Message "Exception: $_"
    }
}

# ============================================================================
# CHECK 6: Critical Files Exist
# ============================================================================

function Test-CriticalFiles {
    Write-CheckHeader "6. Critical Files"

    $criticalFiles = @(
        @{ path = ".env"; name = ".env file"; required = $false },  # Optional now since we support .env.local
        @{ path = "supabase/config.toml"; name = "Supabase config"; required = $true },
        @{ path = "scripts/ops/supabase-query.ts"; name = "Safe query runner"; required = $true },
        @{ path = "scripts/ops/verify-schema-post-migration.ts"; name = "Schema verifier"; required = $false },
        @{ path = ".github/workflows/supabase-migrate.yml"; name = "Migration CI workflow"; required = $true },
        @{ path = ".github/workflows/ops-run.yml"; name = "Ops runner workflow"; required = $true },
        @{ path = "apps/command-center/playwright.config.ts"; name = "Playwright config"; required = $false }
    )

    foreach ($file in $criticalFiles) {
        if (Test-Path $file.path) {
            Write-CheckResult -Name $file.name -Status "PASS" -Message "File exists" -Data @{ path = $file.path }
        } else {
            $status = if ($file.required) { "FAIL" } else { "WARN" }
            Write-CheckResult -Name $file.name -Status $status -Message "File not found" -Data @{ path = $file.path }
        }
    }
}

# ============================================================================
# CHECK 7: Migration Status and Schema Version
# ============================================================================

function Test-MigrationStatus {
    Write-CheckHeader "7. Migration Status and Schema Version"

    try {
        # Count migration files
        $migrationPath = "supabase/migrations"

        if (Test-Path $migrationPath) {
            $migrationFiles = Get-ChildItem -Path $migrationPath -Filter "*.sql" | Sort-Object Name
            $migrationCount = $migrationFiles.Count

            if ($migrationCount -gt 0) {
                Write-CheckResult -Name "Migration files" -Status "PASS" -Message "Found $migrationCount migration file(s)" -Data @{ count = $migrationCount }

                # Show most recent migration
                $latestMigration = $migrationFiles[-1].Name
                Write-CheckResult -Name "Latest migration" -Status "PASS" -Message $latestMigration -Data @{ file = $latestMigration }
            } else {
                Write-CheckResult -Name "Migration files" -Status "WARN" -Message "No migration files found"
            }
        } else {
            Write-CheckResult -Name "Migration directory" -Status "FAIL" -Message "supabase/migrations/ directory not found"
            return
        }

        # Check for schema_versions table (if exists)
        try {
            $schemaVersionQuery = @"
SELECT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'schema_versions'
) as exists
"@

            $versionTableResult = npx tsx scripts\ops\supabase-query.ts --env $Environment --output json "$schemaVersionQuery" 2>&1

            if ($LASTEXITCODE -eq 0) {
                $tableExists = ($versionTableResult | ConvertFrom-Json)[0].exists

                if ($tableExists -eq $true) {
                    Write-CheckResult -Name "schema_versions table" -Status "PASS" -Message "Version tracking enabled"

                    # Get current schema version
                    $currentVersionQuery = @"
SELECT version, applied_at, applied_by, environment
FROM schema_versions
WHERE environment = '$Environment'
ORDER BY applied_at DESC
LIMIT 1
"@

                    $currentVersionResult = npx tsx scripts\ops\supabase-query.ts --env $Environment --output json "$currentVersionQuery" 2>&1

                    if ($LASTEXITCODE -eq 0 -and $currentVersionResult) {
                        $currentVersion = ($currentVersionResult | ConvertFrom-Json)[0]

                        if ($currentVersion) {
                            Write-CheckResult -Name "Current schema version" -Status "PASS" -Message "Version $($currentVersion.version)" -Data @{
                                version = $currentVersion.version
                                applied_at = $currentVersion.applied_at
                                applied_by = $currentVersion.applied_by
                            }
                        } else {
                            Write-CheckResult -Name "Current schema version" -Status "WARN" -Message "No versions recorded for $Environment"
                        }
                    }
                } else {
                    Write-CheckResult -Name "schema_versions table" -Status "WARN" -Message "Version tracking not enabled (run enhanced migration workflow)"
                }
            }
        } catch {
            Write-CheckResult -Name "Schema version check" -Status "WARN" -Message "Could not check version table: $_"
        }

        # Check for pending migrations (compare local vs applied)
        try {
            $appliedMigrationsQuery = @"
SELECT COALESCE(migrations, '') as migrations
FROM schema_versions
WHERE environment = '$Environment'
ORDER BY applied_at DESC
LIMIT 1
"@

            $appliedResult = npx tsx scripts\ops\supabase-query.ts --env $Environment --output json "$appliedMigrationsQuery" 2>&1

            if ($LASTEXITCODE -eq 0 -and $appliedResult) {
                $appliedMigrations = ($appliedResult | ConvertFrom-Json)[0].migrations

                if ($appliedMigrations) {
                    # Compare with local files
                    $localMigrations = ($migrationFiles | ForEach-Object { $_.Name }) -join ","

                    if ($appliedMigrations -eq $localMigrations) {
                        Write-CheckResult -Name "Migration sync" -Status "PASS" -Message "Local and remote migrations are in sync"
                    } else {
                        Write-CheckResult -Name "Migration sync" -Status "WARN" -Message "Local and remote migrations may be out of sync"
                    }
                }
            }
        } catch {
            Write-CheckResult -Name "Migration sync check" -Status "WARN" -Message "Could not verify migration sync"
        }

        # Validate migration naming convention
        $invalidMigrations = @()
        foreach ($migration in $migrationFiles) {
            $filename = $migration.Name

            # Check format: YYYYMMDD_description.sql
            if ($filename -notmatch '^\d{8}_.*\.sql$') {
                $invalidMigrations += $filename
            }
        }

        if ($invalidMigrations.Count -eq 0) {
            Write-CheckResult -Name "Migration naming" -Status "PASS" -Message "All migrations follow naming convention"
        } else {
            Write-CheckResult -Name "Migration naming" -Status "WARN" -Message "$($invalidMigrations.Count) invalid filename(s)" -Data @{
                invalid_files = ($invalidMigrations -join ", ")
            }
        }

    } catch {
        Write-CheckResult -Name "Migration Status" -Status "FAIL" -Message "Exception: $_"
    }
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

# Load .env files unless -NoDotEnv is specified
if (-not $NoDotEnv) {
    if ($OutputFormat -eq 'text') {
        Write-Host "`n========================================" -ForegroundColor Cyan
        Write-Host "LOADING ENVIRONMENT VARIABLES" -ForegroundColor Cyan
        Write-Host "========================================" -ForegroundColor Cyan
    }

    try {
        $loadedCount = Import-DotEnvFiles
        if ($OutputFormat -eq 'text') {
            Write-Host "Loaded $loadedCount new environment variables from .env files" -ForegroundColor Green
        }
    } catch {
        if ($OutputFormat -eq 'text') {
            Write-Host "Warning: Failed to load .env files: $_" -ForegroundColor Yellow
        }
    }
}

# ============================================================================
# SELF-TEST MODE - Print resolved env var names and exit
# ============================================================================
if ($SelfTest) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "SELF-TEST MODE" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Environment: $Environment" -ForegroundColor Yellow
    Write-Host ""

    $envUpper = $Environment.ToUpper()

    # Define all environment variables we look for
    $envVarNames = @(
        "SUPABASE_URL_$envUpper",
        "SUPABASE_SERVICE_ROLE_KEY_$envUpper",
        "SUPABASE_READONLY_DATABASE_URL_$envUpper",
        "SUPABASE_PROJECT_REF_$envUpper",
        "COMMAND_CENTER_URL_$envUpper",
        "DATABASE_URL",
        "DATABASE_DIRECT_URL_$envUpper"
    )

    Write-Host "Environment Variables Checked:" -ForegroundColor Cyan
    Write-Host ""

    foreach ($varName in $envVarNames) {
        $value = Get-EnvVar $varName
        $status = if ($value) { "✅ SET" } else { "❌ NOT SET" }
        $color = if ($value) { "Green" } else { "Red" }

        Write-Host "  $status" -ForegroundColor $color -NoNewline
        Write-Host " $varName" -ForegroundColor White

        # Show masked value if verbose and set
        if ($Verbose -and $value) {
            $maskedValue = if ($varName -like "*URL*" -or $varName -like "*DATABASE*") {
                Mask-Secret -Value $value -Type 'connection_string'
            } elseif ($varName -like "*KEY*") {
                Mask-Secret -Value $value -Type 'key'
            } else {
                Mask-Secret -Value $value -Type 'token'
            }
            Write-Host "      Value: $maskedValue" -ForegroundColor DarkGray
        }
    }

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "SELF-TEST COMPLETE" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green

    exit 0
}

# ============================================================================
# NORMAL HEALTH CHECK MODE
# ============================================================================

if ($OutputFormat -eq 'text') {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "UNIT TALK PRODUCTION HEALTH CHECK" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Environment: $Environment" -ForegroundColor Yellow
    Write-Host "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Yellow
    Write-Host "========================================`n" -ForegroundColor Cyan
}

# ============================================================================
# CHECK: SUPABASE GOVERNANCE COMPLIANCE
# ============================================================================

function Test-SupabaseGovernance {
    Write-CheckHeader "Supabase Governance Compliance"

    try {
        $repoRoot = Split-Path -Parent $PSScriptRoot

        # Check 1: Verify schema_versions migration exists
        $schemaVersionsMigration = Join-Path $repoRoot "supabase\migrations\20250115_schema_versions_table.sql"
        if (Test-Path $schemaVersionsMigration) {
            Write-CheckResult -Name "Schema Versions Migration" -Status "PASS" -Message "Migration file exists"
        } else {
            Write-CheckResult -Name "Schema Versions Migration" -Status "FAIL" -Message "Missing: 20250115_schema_versions_table.sql"
        }

        # Check 2: Verify readonly role migration exists
        $readonlyMigration = Join-Path $repoRoot "supabase\migrations\20250115_readonly_role_for_claude.sql"
        if (Test-Path $readonlyMigration) {
            Write-CheckResult -Name "Read-Only Role Migration" -Status "PASS" -Message "Migration file exists"
        } else {
            Write-CheckResult -Name "Read-Only Role Migration" -Status "FAIL" -Message "Missing: 20250115_readonly_role_for_claude.sql"
        }

        # Check 3: Verify drift detection script exists
        $driftScript = Join-Path $repoRoot "scripts\ops\detect-schema-drift.ts"
        if (Test-Path $driftScript) {
            Write-CheckResult -Name "Drift Detection Script" -Status "PASS" -Message "Script exists"
        } else {
            Write-CheckResult -Name "Drift Detection Script" -Status "FAIL" -Message "Missing: scripts/ops/detect-schema-drift.ts"
        }

        # Check 4: Verify drift detection workflow exists
        $driftWorkflow = Join-Path $repoRoot ".github\workflows\schema-drift-check.yml"
        if (Test-Path $driftWorkflow) {
            Write-CheckResult -Name "Drift Detection Workflow" -Status "PASS" -Message "GitHub Action exists"
        } else {
            Write-CheckResult -Name "Drift Detection Workflow" -Status "FAIL" -Message "Missing: .github/workflows/schema-drift-check.yml"
        }

        # Check 5: Verify migration count
        $migrationsPath = Join-Path $repoRoot "supabase\migrations"
        if (Test-Path $migrationsPath) {
            $migrationCount = (Get-ChildItem -Path $migrationsPath -Filter "*.sql" | Measure-Object).Count
            Write-CheckResult -Name "Migration Count" -Status "PASS" -Message "Found $migrationCount migration files" -Data @{ count = $migrationCount }
        }

        # Check 6: Verify read-only credentials are configured (not in repo)
        $envUpper = $Environment.ToUpper()
        $readonlyUrl = Get-EnvVar "SUPABASE_READONLY_DATABASE_URL_$envUpper"

        if ($readonlyUrl) {
            $maskedUrl = Mask-Secret -Value $readonlyUrl -Type 'connection_string'
            Write-CheckResult -Name "Read-Only Credentials" -Status "PASS" -Message "SUPABASE_READONLY_DATABASE_URL_$envUpper configured" -Data @{ url = $maskedUrl }
        } else {
            Write-CheckResult -Name "Read-Only Credentials" -Status "WARN" -Message "SUPABASE_READONLY_DATABASE_URL_$envUpper not set (required for Claude automation)"
        }

        # Check 7: Verify service role keys are NOT in repo
        $envFiles = @(
            (Join-Path $repoRoot ".env"),
            (Join-Path $repoRoot ".env.local")
        )

        $foundServiceRole = $false
        foreach ($envFile in $envFiles) {
            if (Test-Path $envFile) {
                $content = Get-Content $envFile -Raw -ErrorAction SilentlyContinue
                if ($content -match "SUPABASE_SERVICE_ROLE_KEY\s*=") {
                    $foundServiceRole = $true
                    Write-CheckResult -Name "Service Role Key Security" -Status "WARN" -Message "Found SUPABASE_SERVICE_ROLE_KEY in $envFile (should only be in GitHub Secrets)"
                }
            }
        }

        if (-not $foundServiceRole) {
            Write-CheckResult -Name "Service Role Key Security" -Status "PASS" -Message "No service role keys found in local env files (good)"
        }

        # Check 8: Verify supabase/config.toml doesn't contain project_id
        $supabaseConfig = Join-Path $repoRoot "supabase\config.toml"
        if (Test-Path $supabaseConfig) {
            $configContent = Get-Content $supabaseConfig -Raw
            if ($configContent -match "project_id\s*=\s*['\"]?[a-z0-9]+['\"]?") {
                Write-CheckResult -Name "Supabase Config Security" -Status "WARN" -Message "project_id found in config.toml (should use env var SUPABASE_PROJECT_REF)"
            } else {
                Write-CheckResult -Name "Supabase Config Security" -Status "PASS" -Message "No project_id in config.toml (good)"
            }
        }

        # Check 9: Verify SUPABASE_GOVERNANCE.md exists
        $governanceDoc = Join-Path $repoRoot "docs\SUPABASE_GOVERNANCE.md"
        if (Test-Path $governanceDoc) {
            Write-CheckResult -Name "Governance Documentation" -Status "PASS" -Message "SUPABASE_GOVERNANCE.md exists"
        } else {
            Write-CheckResult -Name "Governance Documentation" -Status "FAIL" -Message "Missing: docs/SUPABASE_GOVERNANCE.md"
        }

    } catch {
        Write-CheckResult -Name "Supabase Governance" -Status "FAIL" -Message "Exception: $_"
    }
}

# Run all checks
Test-LocalPostgres
Test-SupabaseConnectivity
Test-CommandCenterHealth
Test-AutopilotTables
Test-NodeDependencies
Test-CriticalFiles
Test-MigrationStatus
Test-SupabaseGovernance  # NEW: Add governance checks

# ============================================================================
# FINAL SUMMARY
# ============================================================================

if ($OutputFormat -eq 'text') {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "SUMMARY" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Total Checks: $script:TotalChecks" -ForegroundColor White
    Write-Host "Passed: $script:PassedChecks" -ForegroundColor Green
    Write-Host "Warnings: $script:WarnChecks" -ForegroundColor Yellow
    Write-Host "Failed: $script:FailedChecks" -ForegroundColor Red
    Write-Host "========================================`n" -ForegroundColor Cyan

    $score = if ($script:TotalChecks -gt 0) {
        [math]::Round(($script:PassedChecks / $script:TotalChecks) * 100)
    } else {
        0
    }

    if ($script:FailedChecks -eq 0) {
        Write-Host "✅ SYSTEM HEALTH: PASS ($score% checks passed)" -ForegroundColor Green
    } elseif ($script:FailedChecks -le 2) {
        Write-Host "⚠️  SYSTEM HEALTH: DEGRADED ($score% checks passed, $script:FailedChecks critical failure(s))" -ForegroundColor Yellow
    } else {
        Write-Host "❌ SYSTEM HEALTH: FAIL ($score% checks passed, $script:FailedChecks critical failure(s))" -ForegroundColor Red
    }

    Write-Host ""
} else {
    # JSON output
    $summary = @{
        environment = $Environment
        timestamp = (Get-Date).ToString('o')
        total_checks = $script:TotalChecks
        passed = $script:PassedChecks
        warnings = $script:WarnChecks
        failed = $script:FailedChecks
        score = if ($script:TotalChecks -gt 0) {
            [math]::Round(($script:PassedChecks / $script:TotalChecks) * 100)
        } else {
            0
        }
        status = if ($script:FailedChecks -eq 0) { "PASS" } elseif ($script:FailedChecks -le 2) { "DEGRADED" } else { "FAIL" }
        checks = $script:Results
    }

    $summary | ConvertTo-Json -Depth 10
}

# Exit with appropriate code (fail-closed: exit 1 if any critical failures)
if ($script:FailedChecks -gt 0) {
    exit 1
} else {
    exit 0
}

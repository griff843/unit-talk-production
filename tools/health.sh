#!/bin/bash
# ============================================================================
# Unit Talk DX-OPS Health Check Script (v2 - Hardened)
# Fast ops preflight diagnostic for the Unit Talk platform.
# Features: Dynamic service discovery, fallback endpoints, timeout visibility.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="${PROJECT_ROOT}/out/dx-ops-pack/$(date +%Y-%m-%d)"

# ============================================================================
# Configuration
# ============================================================================
REQUIRED_TOOLS=("docker" "node" "pnpm")

# Critical services (true = exit non-zero if unhealthy)
declare -A CRITICAL_SERVICES=(
    ["postgres"]="true"
    ["redis"]="true"
    ["temporal"]="true"
    ["api"]="true"
    ["smart-form"]="false"
    ["command-center"]="false"
    ["dashboard"]="false"
    ["workers"]="false"
    ["temporal-ui"]="false"
    ["prometheus"]="false"
    ["grafana"]="false"
    ["outbox-consumer"]="false"
    ["discord-bot"]="false"
    ["temporal-postgres"]="false"
)

# HTTP endpoints with fallback (primary|fallback:is_critical)
declare -A HTTP_ENDPOINTS=(
    ["API Health"]="http://127.0.0.1:3010/api/health|:true"
    ["Smart Form"]="http://127.0.0.1:3002/api/health|http://127.0.0.1:3002:false"
    ["Command Center"]="http://127.0.0.1:3004/api/health|http://127.0.0.1:3004:false"
    ["Dashboard"]="http://127.0.0.1:3003|:false"
    ["Prometheus"]="http://127.0.0.1:9090/-/healthy|:false"
    ["Temporal UI"]="http://127.0.0.1:8088|:false"
)

# ============================================================================
# Colors & Output
# ============================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

status_line() {
    local status="$1"
    local name="$2"
    local details="${3:-}"

    local icon color
    case "$status" in
        OK)   icon="[OK]"; color="$GREEN" ;;
        WARN) icon="[!!]"; color="$YELLOW" ;;
        FAIL) icon="[XX]"; color="$RED" ;;
        INFO) icon="[--]"; color="$CYAN" ;;
        *)    icon="[??]"; color="$NC" ;;
    esac

    printf "${color}%-6s %-25s %s${NC}\n" "$icon" "$name" "$details"
}

# ============================================================================
# Helper Functions
# ============================================================================
command_exists() {
    command -v "$1" &>/dev/null
}

get_compose_cmd() {
    if command_exists docker && docker compose version &>/dev/null; then
        echo "docker compose"
    elif command_exists docker-compose; then
        echo "docker-compose"
    else
        echo ""
    fi
}

test_docker_running() {
    docker info &>/dev/null
}

get_compose_services() {
    local compose_cmd="$1"
    $compose_cmd config --services 2>/dev/null || echo ""
}

test_http_with_fallback() {
    local urls="$1"
    local timeout="${2:-5}"

    # Parse URLs (pipe-separated)
    IFS='|' read -ra url_array <<< "$urls"

    for url in "${url_array[@]}"; do
        [[ -z "$url" ]] && continue
        if command_exists curl; then
            if curl -sf --connect-timeout "$timeout" "$url" >/dev/null 2>&1; then
                echo "OK|$url"
                return 0
            fi
        elif command_exists wget; then
            if wget -q --timeout="$timeout" -O /dev/null "$url" 2>/dev/null; then
                echo "OK|$url"
                return 0
            fi
        fi
    done
    echo "FAIL|"
    return 1
}

save_service_logs() {
    local compose_cmd="$1"
    local service="$2"
    local output_dir="$3"
    local lines="${4:-200}"

    mkdir -p "$output_dir"
    local log_file="${output_dir}/logs_${service}.txt"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    # Add timestamp header
    {
        echo "# Log capture for service: $service"
        echo "# Captured at: $timestamp"
        echo "# Lines: $lines"
        echo "# $(printf '=%.0s' {1..60})"
        echo ""
        $compose_cmd logs --tail="$lines" "$service" 2>&1 || true
    } > "$log_file"

    echo "$log_file"
}

# ============================================================================
# Main Health Check
# ============================================================================
run_health_check() {
    local start_time=$(date +%s)
    local exit_code=0
    local failed_services=()

    echo ""
    echo -e "${CYAN}============================================================${NC}"
    echo -e "${CYAN}  UNIT TALK DX-OPS HEALTH CHECK (v2)${NC}"
    echo -e "  $(date '+%Y-%m-%d %H:%M:%S')"
    echo -e "${CYAN}============================================================${NC}"
    echo ""

    # -------------------------------------------------------------------------
    # 1. Check required tools
    # -------------------------------------------------------------------------
    echo "REQUIRED TOOLS"
    echo "----------------------------------------"

    for tool in "${REQUIRED_TOOLS[@]}"; do
        if command_exists "$tool"; then
            local version=""
            case "$tool" in
                docker) version=$(docker --version 2>&1 | sed 's/Docker version //') ;;
                node)   version=$(node --version 2>&1) ;;
                pnpm)   version=$(pnpm --version 2>&1 | grep -E '^[0-9]+\.[0-9]+' | head -1) ;;
            esac
            status_line "OK" "$tool" "$version"
        else
            status_line "FAIL" "$tool" "NOT FOUND"
            case "$tool" in
                docker) echo "       Hint: Install Docker from https://docker.com" ;;
                node)   echo "       Hint: Install Node.js from https://nodejs.org" ;;
                pnpm)   echo "       Hint: Run: npm install -g pnpm" ;;
            esac
            exit_code=1
        fi
    done
    echo ""

    # -------------------------------------------------------------------------
    # 2. Check Docker daemon
    # -------------------------------------------------------------------------
    echo "DOCKER DAEMON"
    echo "----------------------------------------"

    if ! test_docker_running; then
        status_line "FAIL" "Docker Daemon" "NOT RUNNING"
        echo ""
        echo -e "${RED}  ACTION REQUIRED: Start Docker${NC}"
        echo -e "${YELLOW}  Run: sudo systemctl start docker (Linux)${NC}"
        echo -e "${YELLOW}  Or: Open Docker Desktop (macOS/Windows)${NC}"
        echo ""
        return 1
    fi
    status_line "OK" "Docker Daemon" "running"

    local compose_cmd
    compose_cmd=$(get_compose_cmd)
    if [[ -z "$compose_cmd" ]]; then
        status_line "FAIL" "Docker Compose" "NOT FOUND"
        return 1
    fi
    status_line "OK" "Docker Compose" "$compose_cmd"
    echo ""

    # -------------------------------------------------------------------------
    # 3. Discover services dynamically
    # -------------------------------------------------------------------------
    echo "SERVICE DISCOVERY"
    echo "----------------------------------------"

    cd "$PROJECT_ROOT"
    local discovered_services
    discovered_services=$(get_compose_services "$compose_cmd")
    local service_count=$(echo "$discovered_services" | grep -c '^' || echo "0")

    if [[ -z "$discovered_services" ]]; then
        status_line "WARN" "Services" "None discovered"
    else
        status_line "OK" "Services" "$service_count services in compose"
    fi
    echo ""

    # -------------------------------------------------------------------------
    # 4. Check container status
    # -------------------------------------------------------------------------
    echo "CONTAINER STATUS"
    echo "----------------------------------------"

    # Get container status as JSON
    local containers_json
    containers_json=$($compose_cmd ps --format json 2>/dev/null || echo "")

    while IFS= read -r service; do
        [[ -z "$service" ]] && continue

        local is_critical="${CRITICAL_SERVICES[$service]:-false}"

        # Parse container info using node
        local state health
        if [[ -n "$containers_json" ]]; then
            read -r state health < <(echo "$containers_json" | node -e "
                let data = '';
                process.stdin.on('data', chunk => data += chunk);
                process.stdin.on('end', () => {
                    const lines = data.trim().split('\n').filter(l => l.startsWith('{'));
                    for (const line of lines) {
                        try {
                            const c = JSON.parse(line);
                            if (c.Service === '$service') {
                                console.log((c.State || 'unknown') + ' ' + (c.Health || 'N/A'));
                                process.exit(0);
                            }
                        } catch {}
                    }
                    console.log('not_running N/A');
                });
            " 2>/dev/null || echo "not_running N/A")
        else
            state="not_running"
            health="N/A"
        fi

        local status_code details
        if [[ "$state" == "not_running" ]]; then
            details="NOT RUNNING"
            status_code=$([[ "$is_critical" == "true" ]] && echo "FAIL" || echo "WARN")
        elif [[ "$state" == "running" && ("$health" == "healthy" || "$health" == "N/A") ]]; then
            details="running"
            [[ "$health" != "N/A" ]] && details="running ($health)"
            status_code="OK"
        elif [[ "$state" == "running" ]]; then
            details="running ($health)"
            status_code=$([[ "$is_critical" == "true" ]] && echo "WARN" || echo "INFO")
        else
            details="$state"
            status_code=$([[ "$is_critical" == "true" ]] && echo "FAIL" || echo "WARN")
        fi

        status_line "$status_code" "$service" "$details"

        if [[ "$status_code" == "FAIL" ]]; then
            failed_services+=("$service")
            [[ "$is_critical" == "true" ]] && exit_code=1
        elif [[ "$status_code" == "WARN" && "$is_critical" == "true" ]]; then
            failed_services+=("$service")
        fi
    done <<< "$discovered_services"
    echo ""

    # -------------------------------------------------------------------------
    # 5. Check HTTP endpoints with fallback
    # -------------------------------------------------------------------------
    echo "HTTP ENDPOINTS"
    echo "----------------------------------------"

    for name in "${!HTTP_ENDPOINTS[@]}"; do
        local config="${HTTP_ENDPOINTS[$name]}"
        # Parse: urls:is_critical
        local urls is_critical
        urls="${config%:*}"
        is_critical="${config##*:}"

        local result
        result=$(test_http_with_fallback "$urls" 5)
        local status="${result%%|*}"
        local used_url="${result#*|}"

        if [[ "$status" == "OK" ]]; then
            local details="HTTP 200"
            # Check if fallback was used
            local primary="${urls%%|*}"
            if [[ -n "$used_url" && "$used_url" != "$primary" ]]; then
                details="HTTP 200 (fallback)"
            fi
            status_line "OK" "$name" "$details"
        else
            local status_code=$([[ "$is_critical" == "true" ]] && echo "FAIL" || echo "WARN")
            status_line "$status_code" "$name" "UNREACHABLE"
            [[ "$is_critical" == "true" ]] && exit_code=1
        fi
    done
    echo ""

    # -------------------------------------------------------------------------
    # 6. Collect logs for failed services
    # -------------------------------------------------------------------------
    if [[ $exit_code -ne 0 && ${#failed_services[@]} -gt 0 ]]; then
        echo -e "${YELLOW}COLLECTING LOGS FOR FAILED SERVICES${NC}"
        echo "----------------------------------------"

        for service in "${failed_services[@]}"; do
            local log_file
            log_file=$(save_service_logs "$compose_cmd" "$service" "$OUTPUT_DIR")
            echo "  Saved: $log_file"
        done
        echo ""
    fi

    # -------------------------------------------------------------------------
    # Summary
    # -------------------------------------------------------------------------
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo -e "${CYAN}============================================================${NC}"
    if [[ $exit_code -eq 0 ]]; then
        echo -e "${GREEN}  HEALTH CHECK PASSED${NC}"
    else
        echo -e "${RED}  HEALTH CHECK FAILED${NC}"
    fi
    echo "  Duration: ${duration}s"
    echo -e "${CYAN}============================================================${NC}"
    echo ""

    return $exit_code
}

# ============================================================================
# Entry Point
# ============================================================================
run_health_check
exit $?

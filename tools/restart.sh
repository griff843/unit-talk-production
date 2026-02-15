#!/bin/bash
# ============================================================================
# Unit Talk DX-OPS Restart Script (v2 - Hardened)
# One-command full restart to avoid half-restarted states.
# Features: Wipe confirmation guard, post-restart validation, log collection.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="${PROJECT_ROOT}/out/dx-ops-pack/$(date +%Y-%m-%d)"

# ============================================================================
# Options
# ============================================================================
WIPE=false
CONFIRM=""
NO_WAIT=false
SERVICES=""

# ============================================================================
# Colors & Output
# ============================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m'

banner() {
    echo ""
    echo -e "${CYAN}============================================================${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}============================================================${NC}"
    echo ""
}

section() {
    echo ""
    echo -e "$1"
    echo "----------------------------------------"
}

step()  { echo -e "${YELLOW}[>>]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
fail()  { echo -e "${RED}[XX]${NC} $1"; }
info()  { echo -e "${CYAN}[--]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!!]${NC} $1"; }

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

run_health_check() {
    bash "$SCRIPT_DIR/health.sh" 2>/dev/null
    return $?
}

save_service_logs() {
    local compose_cmd="$1"
    local service="$2"
    local output_dir="$3"
    local lines="${4:-200}"

    mkdir -p "$output_dir"
    local log_file="${output_dir}/logs_${service}.txt"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

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
# Main Restart
# ============================================================================
main() {
    local start_time=$(date +%s)
    local proof_file="${OUTPUT_DIR}/proof_restart.txt"

    # Create output directory
    mkdir -p "$OUTPUT_DIR"

    {
        banner "UNIT TALK DX-OPS RESTART (v2)"

        echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "Wipe: $WIPE"
        echo "Confirm: $CONFIRM"
        echo "NoWait: $NO_WAIT"
        echo "Services: ${SERVICES:-all}"
        echo ""

        # -------------------------------------------------------------------------
        # Check Docker
        # -------------------------------------------------------------------------
        if ! test_docker_running; then
            fail "Docker is not running. Please start Docker."
            return 1
        fi

        local compose_cmd
        compose_cmd=$(get_compose_cmd)
        if [[ -z "$compose_cmd" ]]; then
            fail "Docker Compose not found"
            return 1
        fi
        info "Using: $compose_cmd"

        cd "$PROJECT_ROOT"

        # Parse services
        local services_array=()
        if [[ -n "$SERVICES" ]]; then
            IFS=',' read -ra services_array <<< "$SERVICES"
        fi

        # -------------------------------------------------------------------------
        # Wipe Mode (Dangerous) - REQUIRES CONFIRMATION
        # -------------------------------------------------------------------------
        if [[ "$WIPE" == "true" ]]; then
            section "WIPE MODE (DANGEROUS)"

            # GUARD: Require --confirm WIPE
            if [[ "$CONFIRM" != "WIPE" ]]; then
                fail "WIPE ABORTED: Missing confirmation"
                echo ""
                echo -e "${YELLOW}  To wipe volumes, you must provide:${NC}"
                echo -e "    ./tools/restart.sh --wipe --confirm WIPE"
                echo ""
                echo -e "${YELLOW}  Or via pnpm:${NC}"
                echo -e "    pnpm ops:restart -- --wipe --confirm WIPE"
                echo ""
                warn "This guard exists to prevent accidental data loss."
                return 1
            fi

            warn "WIPE CONFIRMED - Proceeding with volume removal"

            step "Stopping compose with volumes removal..."
            $compose_cmd down --volumes --remove-orphans

            step "Pruning project containers..."
            docker container prune -f --filter "label=com.docker.compose.project=unit-talk-production" || true

            ok "Wipe complete"
        else
            # -------------------------------------------------------------------------
            # Normal Restart
            # -------------------------------------------------------------------------
            section "STOPPING SERVICES"

            if [[ ${#services_array[@]} -gt 0 ]]; then
                step "Stopping: ${services_array[*]}"
                $compose_cmd stop "${services_array[@]}"
            else
                step "Stopping all services..."
                $compose_cmd down
            fi
            ok "Services stopped"
        fi

        # -------------------------------------------------------------------------
        # Start Services
        # -------------------------------------------------------------------------
        section "STARTING SERVICES"

        if [[ ${#services_array[@]} -gt 0 ]]; then
            step "Starting: ${services_array[*]}"
            $compose_cmd up -d "${services_array[@]}"
        else
            step "Starting all services..."
            $compose_cmd up -d
        fi
        ok "Services started"

        # -------------------------------------------------------------------------
        # Post-Restart Validation
        # -------------------------------------------------------------------------
        if [[ "$NO_WAIT" != "true" ]]; then
            section "POST-RESTART VALIDATION"
            info "Waiting for services to become healthy..."

            # Stabilization countdown
            for i in {10..1}; do
                printf "\r  Stabilization countdown: ${i}s "
                sleep 1
            done
            echo ""

            local max_attempts=20
            local retry_interval=10
            local healthy=false

            for ((i=1; i<=max_attempts; i++)); do
                info "Health check attempt $i/$max_attempts..."
                if run_health_check; then
                    healthy=true
                    break
                fi

                if [[ $i -lt $max_attempts ]]; then
                    info "Waiting ${retry_interval}s..."
                    sleep $retry_interval
                fi
            done

            if [[ "$healthy" == "true" ]]; then
                ok "All services healthy"
            else
                warn "Some services may not be fully healthy"
            fi
        else
            info "Skipping health check (--no-wait)"
        fi

        # -------------------------------------------------------------------------
        # Final Status
        # -------------------------------------------------------------------------
        section "FINAL STATUS"
        $compose_cmd ps

        # -------------------------------------------------------------------------
        # Summary
        # -------------------------------------------------------------------------
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))

        banner "RESTART COMPLETE"
        ok "Restart finished in ${duration}s"

    } 2>&1 | tee "$proof_file"

    info "Proof saved: $proof_file"
    return 0
}

# ============================================================================
# Parse Arguments
# ============================================================================
while [[ $# -gt 0 ]]; do
    case "$1" in
        --wipe|-w)      WIPE=true; shift ;;
        --confirm)      CONFIRM="$2"; shift 2 ;;
        --no-wait)      NO_WAIT=true; shift ;;
        --services)     SERVICES="$2"; shift 2 ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --wipe, -w       DANGEROUS: Remove volumes (requires --confirm WIPE)"
            echo "  --confirm STR    Confirmation string for wipe (must be 'WIPE')"
            echo "  --no-wait        Skip waiting for health check"
            echo "  --services LIST  Comma-separated list of services to restart"
            echo ""
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# ============================================================================
# Entry Point
# ============================================================================
main
exit $?

#!/bin/bash
# ============================================================================
# Unit Talk DX-OPS Bootstrap Script
# Fresh machine bootstrap and deterministic bring-up for the Unit Talk platform.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="${PROJECT_ROOT}/out/dx-ops-pack/$(date +%Y-%m-%d)"

# ============================================================================
# Configuration
# ============================================================================
HEALTH_TIMEOUT_MINUTES="${HEALTH_TIMEOUT_MINUTES:-8}"
HEALTH_RETRY_INTERVAL_SEC="${HEALTH_RETRY_INTERVAL_SEC:-15}"
SKIP_INSTALL="${SKIP_INSTALL:-false}"

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

health_check_with_retry() {
    local timeout_min="$1"
    local retry_sec="$2"
    local deadline=$(($(date +%s) + timeout_min * 60))
    local attempt=0

    while [[ $(date +%s) -lt $deadline ]]; do
        attempt=$((attempt + 1))
        info "Health check attempt $attempt..."

        if run_health_check; then
            return 0
        fi

        local remaining=$((deadline - $(date +%s)))
        if [[ $remaining -gt 0 ]]; then
            info "Waiting ${retry_sec}s before retry... (${remaining}s remaining)"
            sleep "$retry_sec"
        fi
    done

    return 1
}

# ============================================================================
# Main Bootstrap
# ============================================================================
main() {
    local start_time=$(date +%s)
    local proof_file="${OUTPUT_DIR}/proof_bootstrap.txt"

    # Create output directory
    mkdir -p "$OUTPUT_DIR"

    # Start proof log
    {
        banner "UNIT TALK DX-OPS BOOTSTRAP"

        # -------------------------------------------------------------------------
        # 1. Environment Info
        # -------------------------------------------------------------------------
        section "ENVIRONMENT INFO"
        echo "  Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "  OS: $(uname -s) $(uname -r)"
        echo "  Shell: $BASH_VERSION"
        echo "  Project Root: $PROJECT_ROOT"

        # -------------------------------------------------------------------------
        # 2. Validate Required Tools
        # -------------------------------------------------------------------------
        section "VALIDATING REQUIRED TOOLS"

        local tools_ok=true
        for tool in docker node pnpm; do
            if command_exists "$tool"; then
                local version=""
                case "$tool" in
                    docker) version=$(docker --version 2>&1) ;;
                    node)   version=$(node --version 2>&1) ;;
                    pnpm)   version=$(pnpm --version 2>&1) ;;
                esac
                ok "$tool: $version"
            else
                fail "$tool: NOT FOUND"
                case "$tool" in
                    docker) echo "    Hint: Install Docker from https://docker.com" ;;
                    node)   echo "    Hint: Install Node.js from https://nodejs.org" ;;
                    pnpm)   echo "    Hint: Run: npm install -g pnpm" ;;
                esac
                tools_ok=false
            fi
        done

        if [[ "$tools_ok" != "true" ]]; then
            fail "Missing required tools. Please install them and retry."
            return 1
        fi

        # -------------------------------------------------------------------------
        # 3. Check Docker
        # -------------------------------------------------------------------------
        section "CHECKING DOCKER"

        if ! test_docker_running; then
            fail "Docker is not running. Please start Docker."
            return 1
        fi
        ok "Docker daemon is running"

        local compose_cmd
        compose_cmd=$(get_compose_cmd)
        if [[ -z "$compose_cmd" ]]; then
            fail "Docker Compose not found"
            return 1
        fi
        ok "Docker Compose: $compose_cmd"

        # -------------------------------------------------------------------------
        # 4. Install Dependencies
        # -------------------------------------------------------------------------
        cd "$PROJECT_ROOT"

        if [[ "$SKIP_INSTALL" != "true" ]]; then
            section "INSTALLING DEPENDENCIES"
            step "Running: pnpm install"

            if ! pnpm install; then
                fail "pnpm install failed"
                return 1
            fi
            ok "Dependencies installed"
        else
            info "Skipping pnpm install (SKIP_INSTALL=true)"
        fi

        # -------------------------------------------------------------------------
        # 5. Start Containers
        # -------------------------------------------------------------------------
        section "STARTING CONTAINERS"
        step "Running: $compose_cmd up -d"

        if ! $compose_cmd up -d; then
            fail "docker compose up failed"
            return 1
        fi
        ok "Containers started"

        # -------------------------------------------------------------------------
        # 6. Wait for Health
        # -------------------------------------------------------------------------
        section "WAITING FOR HEALTH"
        info "Timeout: ${HEALTH_TIMEOUT_MINUTES} minutes, retry interval: ${HEALTH_RETRY_INTERVAL_SEC}s"

        if ! health_check_with_retry "$HEALTH_TIMEOUT_MINUTES" "$HEALTH_RETRY_INTERVAL_SEC"; then
            fail "Health check failed after $HEALTH_TIMEOUT_MINUTES minutes"
            return 1
        fi
        ok "All services healthy"

        # -------------------------------------------------------------------------
        # 7. Basic Proof
        # -------------------------------------------------------------------------
        section "BASIC PROOF"

        step "Container status:"
        $compose_cmd ps
        echo ""

        # Save container status to separate file
        $compose_cmd ps > "${OUTPUT_DIR}/proof_container_status.txt" 2>&1

        # -------------------------------------------------------------------------
        # Summary
        # -------------------------------------------------------------------------
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))

        banner "BOOTSTRAP COMPLETE"
        ok "Unit Talk platform is ready!"
        info "Duration: ${duration}s"
        echo ""
        echo "Next steps:"
        echo -e "${GRAY}  - Open Command Center: http://localhost:3004${NC}"
        echo -e "${GRAY}  - Open Smart Form: http://localhost:3002${NC}"
        echo -e "${GRAY}  - Run health check: pnpm ops:health${NC}"
        echo ""

    } 2>&1 | tee "$proof_file"

    info "Proof saved: $proof_file"
    return 0
}

# ============================================================================
# Parse Arguments
# ============================================================================
while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-install) SKIP_INSTALL=true; shift ;;
        --timeout) HEALTH_TIMEOUT_MINUTES="$2"; shift 2 ;;
        --retry-interval) HEALTH_RETRY_INTERVAL_SEC="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# ============================================================================
# Entry Point
# ============================================================================
main
exit $?
